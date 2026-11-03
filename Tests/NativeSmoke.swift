import AppKit
import WebKit

enum SmokeFailure: Error, CustomStringConvertible {
    case failed(String)
    var description: String { switch self { case .failed(let message): message } }
}

@MainActor
final class SmokeHarness: NSObject, NSApplicationDelegate {
    private var surface: WallpaperSurface?
    private var projectRoot: URL {
        if CommandLine.arguments.count > 1 { return URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true) }
        return Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent()
    }

    private func saveReport(passed: Bool, message: String) {
        let report: [String: Any] = ["passed": passed, "message": message, "date": ISO8601DateFormatter().string(from: Date())]
        if let data = try? JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]) {
            try? data.write(to: projectRoot.appendingPathComponent("build/native-smoke-report.json"))
        }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        Task {
            do {
                try await runChecks()
                surface?.close()
                saveReport(passed: true, message: "Native WebKit lifecycle, desktop windows, language persistence, localized menus, accessibility and live language switching passed")
                print("PASS: native WebKit, desktop windows, localization and menu checks")
                exit(0)
            } catch {
                surface?.close()
                saveReport(passed: false, message: String(describing: error))
                FileHandle.standardError.write(Data("FAIL: \(error)\n".utf8))
                exit(1)
            }
        }
    }

    private func check(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else { throw SmokeFailure.failed(message) }
    }

    private func wait(_ milliseconds: UInt64) async throws {
        try await Task.sleep(nanoseconds: milliseconds * 1_000_000)
    }

    private func stats() async throws -> [String: Any] {
        guard let surface else { throw SmokeFailure.failed("Missing surface") }
        let result = try await surface.webView.evaluateJavaScript("JSON.stringify(window.wallpaper.stats())")
        guard let value = result as? String,
              let parsed = try JSONSerialization.jsonObject(with: Data(value.utf8)) as? [String: Any] else {
            throw SmokeFailure.failed("Invalid JavaScript diagnostics")
        }
        return parsed
    }

    private func frames(_ stats: [String: Any]) -> Int { (stats["frames"] as? NSNumber)?.intValue ?? -1 }
    private func time(_ stats: [String: Any]) -> Double { (stats["simulationTime"] as? NSNumber)?.doubleValue ?? -1 }

    private func checkLocalization() throws {
        let suite = "dev.asciisharks.localization-test.\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suite) else { throw SmokeFailure.failed("Cannot create isolated preferences") }
        defer { defaults.removePersistentDomain(forName: suite) }
        var settings = Settings(defaults: defaults)
        try check(settings.language == .english, "A fresh install must default to English")
        defaults.set("solo", forKey: "scene")
        defaults.set(60, forKey: "frameRate")
        settings = Settings(defaults: defaults)
        try check(settings.language == .english && settings.scene == .solo && settings.frameRate == 60,
                  "Existing preferences must migrate to English without resetting other choices")
        settings.language = .simplifiedChinese
        settings.paused = true
        settings.visible = false
        settings.allDisplays = false
        settings.speed = 0.5
        settings.save(defaults: defaults)
        let restored = Settings(defaults: defaults)
        try check(restored.language == .simplifiedChinese && restored.paused && !restored.visible && !restored.allDisplays
                  && restored.speed == 0.5 && restored.scene == .solo && restored.frameRate == 60,
                  "Language and wallpaper preferences must survive relaunch")
        defaults.set("unsupported", forKey: "language")
        try check(Settings(defaults: defaults).language == .english, "Unknown language preferences must fall back to English")

        let resources = projectRoot.appendingPathComponent("Resources")
        var keys: Set<String>?
        for language in AppLanguage.allCases {
            let data = try Data(contentsOf: resources.appendingPathComponent("\(language.rawValue).lproj/Localizable.strings"))
            guard let strings = try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: String] else {
                throw SmokeFailure.failed("Invalid translation table")
            }
            if let keys { try check(keys == Set(strings.keys), "Both languages must translate the same keys") }
            keys = Set(strings.keys)
            let localizer = Localizer(language: language, resourceURL: resources)
            for key in strings.keys {
                try check(!localizer.text(key).isEmpty && localizer.text(key) != key, "Missing translation: \(language.rawValue)/\(key)")
            }
            let description = localizer.format("about.description", "TEST-VERSION")
            try check(description.contains("TEST-VERSION") && !description.contains("%@"), "About text must substitute the bundle version")
        }

        settings = Settings(defaults: defaults)
        settings.visible = true
        settings.paused = false
        let menu = WallpaperMenu()
        let english = Localizer(language: .english, resourceURL: resources)
        let chinese = Localizer(language: .simplifiedChinese, resourceURL: resources)
        menu.update(settings: settings, state: .playing(30), savingPower: false, localizer: english)
        func items(_ root: NSMenu) -> [NSMenuItem] {
            root.items.flatMap { [$0] + ($0.submenu.map(items) ?? []) }
        }
        func actionItem(_ action: MenuAction) throws -> NSMenuItem {
            guard let item = items(menu.menu).first(where: { $0.representedObject as? MenuAction == action }) else {
                throw SmokeFailure.failed("Menu action missing: \(action)")
            }
            return item
        }
        let pause = try actionItem(.togglePause)
        try check(pause.title == "Pause Animation" && pause.isEnabled, "English playback control must be actionable")
        try check(try actionItem(.language(.english)).state == .on, "English must be selected initially")
        var selected: MenuAction?
        menu.onAction = { selected = $0 }
        let chineseChoice = try actionItem(.language(.simplifiedChinese))
        guard let selectionAction = chineseChoice.action else { throw SmokeFailure.failed("Language action has no selector") }
        try check(NSApp.sendAction(selectionAction, to: chineseChoice.target, from: chineseChoice), "Language action must reach its target")
        try check(selected == .language(.simplifiedChinese), "Language selection must send the correct action")
        settings.language = .simplifiedChinese
        menu.update(settings: settings, state: .playing(30), savingPower: false, localizer: chinese)
        menu.menuNeedsUpdate(menu.menu)
        try check(try actionItem(.togglePause).title == chinese.text("menu.pause"), "Reopening the menu must use the selected language")
        try check(try actionItem(.language(.simplifiedChinese)).state == .on, "The selected language needs a checkmark")
        try check(try actionItem(.language(.english)).state == .off, "Only one language may be selected")
        try check(try actionItem(.allDisplays(false)).state == .on, "Primary-display preference must remain selected")
        for state in [WallpaperState.hidden, .suspended, .reducedMotion, .failed] {
            menu.update(settings: settings, state: state, savingPower: true, localizer: english)
            menu.menuNeedsUpdate(menu.menu)
            try check(try !actionItem(.togglePause).isEnabled, "Playback must be disabled when the effective state prevents animation")
        }
        try check(try actionItem(.showError).isEnabled, "A failed wallpaper must expose error details")
        let failure = WallpaperFailure.rendererStopped
        try check(failure.message(using: english) != failure.message(using: chinese), "Existing errors must follow the current language")
        print("PASS: preference migration, language persistence, translation coverage, menu actions and effective states")
    }

    private func runChecks() async throws {
        try checkLocalization()
        guard let screen = NSScreen.screens.first else { throw SmokeFailure.failed("No display available") }
        let root = projectRoot
        var settings = Settings()
        settings.paused = false
        settings.visible = true
        settings.frameRate = 30
        settings.speed = 1
        settings.scene = .classic
        settings.language = .english
        try check(settings.configuration(suspended: true, savingPower: false).paused, "Sleep must pause")
        try check(settings.configuration(suspended: false, savingPower: true).frameRate == 15, "Low power must cap FPS")
        settings.paused = true
        try check(settings.configuration(suspended: false, savingPower: false).paused, "Manual pause must survive wake")
        settings.paused = false
        settings.visible = false
        try check(settings.configuration(suspended: false, savingPower: false).paused, "Hidden wallpaper must stop")
        settings.visible = true

        var configuration = settings.configuration(suspended: false, savingPower: false)
        let surface = try WallpaperSurface(screen: screen, resourceURL: root.appendingPathComponent("build/Web"), configuration: configuration)
        self.surface = surface
        try check(surface.window.ignoresMouseEvents, "Wallpaper must pass clicks through")
        try check(!surface.window.canBecomeKey && !surface.window.canBecomeMain, "Wallpaper must never steal keyboard focus")
        try check(surface.window.level.rawValue > Int(CGWindowLevelForKey(.desktopWindow)), "Wallpaper must be above system background")
        try check(surface.window.level.rawValue < Int(CGWindowLevelForKey(.desktopIconWindow)), "Wallpaper must be below desktop icons")
        try check(surface.window.collectionBehavior.contains(.canJoinAllSpaces), "Wallpaper must join Spaces")
        // Make the test view unoccluded; WebKit legitimately suppresses animation
        // when a real desktop is completely covered by other windows.
        surface.window.level = .floating
        surface.window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        surface.window.setFrame(NSRect(x: screen.frame.midX - 480, y: screen.frame.midY - 300, width: 960, height: 600), display: true)
        surface.update(configuration: configuration, visible: true)
        NSApp.activate(ignoringOtherApps: true)
        for _ in 0..<150 {
            if surface.isReady || surface.lastError != nil { break }
            try await wait(100)
        }
        try check(surface.isReady, "WebKit did not load: \(String(describing: surface.lastError))")
        try check(surface.lastError == nil, "JavaScript error: \(String(describing: surface.lastError))")
        let initial = try await stats()
        try check(initial["sharks"] as? Int == 4, "Classic scene must contain four sharks")
        try await wait(1100)
        let animated = try await stats()
        let reducedMotion = animated["reducedMotion"] as? Bool == true
        if !reducedMotion {
            try check(frames(animated) > frames(initial), "Animation did not advance")
            try check(frames(animated) - frames(initial) < 45, "30 FPS cap was ignored")
        }
        configuration.paused = true
        surface.update(configuration: configuration, visible: true)
        try await wait(150)
        let paused = try await stats()
        try await wait(400)
        let still = try await stats()
        try check(frames(paused) == frames(still) && time(paused) == time(still), "Pause must freeze simulation and render")
        try check(still["scheduled"] as? Bool == false, "Paused loop must schedule zero work")

        configuration.language = .simplifiedChinese
        surface.update(configuration: configuration, visible: true)
        try await wait(100)
        let translated = try await stats()
        try check(translated["language"] as? String == "zh-Hans", "The native language must reach WebKit")
        try check(frames(translated) == frames(still) && time(translated) == time(still), "Changing language must not reset or advance a paused scene")
        let accessible = try await surface.webView.evaluateJavaScript("document.documentElement.lang === 'zh-Hans' && /鲨/.test(document.querySelector('canvas').getAttribute('aria-label'))")
        try check(accessible as? Bool == true, "The document language and canvas description must follow the app language")
        configuration.language = .english
        surface.update(configuration: configuration, visible: true)
        try await wait(100)
        let englishAccessibility = try await surface.webView.evaluateJavaScript("document.documentElement.lang === 'en' && document.querySelector('canvas').getAttribute('aria-label').startsWith('Animated ASCII sharks')")
        try check(englishAccessibility as? Bool == true, "Switching back to English must update accessibility immediately")

        configuration.paused = false
        configuration.frameRate = 15
        configuration.speed = 0.5
        surface.update(configuration: configuration, visible: true)
        try await wait(700)
        let resumed = try await stats()
        try check(resumed["frameRate"] as? Int == 15, "Native FPS setting did not reach JavaScript")
        if !reducedMotion {
            try check(frames(resumed) > frames(still), "Resume did not restart animation")
            try check(time(resumed) - time(still) < 0.6, "Resume must not catch up paused wall time")
        }
        configuration.language = .simplifiedChinese
        surface.update(configuration: configuration, visible: true)
        try await wait(200)
        let liveTranslation = try await stats()
        try check(liveTranslation["language"] as? String == "zh-Hans", "Live language switching must reach WebKit")
        try check(time(liveTranslation) >= time(resumed) && frames(liveTranslation) >= frames(resumed),
                  "Changing language must preserve an active simulation")
        if !reducedMotion {
            try check(frames(liveTranslation) > frames(resumed) && liveTranslation["scheduled"] as? Bool == true,
                      "Animation must continue after a language change")
        }
        configuration.scene = .solo
        surface.update(configuration: configuration, visible: true)
        try await wait(200)
        let solo = try await stats()
        try check(solo["sharks"] as? Int == 1, "Solo scene did not replace the previous engine")
        configuration.scene = .mixed
        configuration.pixelRatio = 1
        surface.update(configuration: configuration, visible: true)
        try await wait(200)
        let mixed = try await stats()
        try check(mixed["sharks"] as? Int == 4 && mixed["scene"] as? String == "mixed", "Mixed scene did not load")

        let image = try await surface.webView.takeSnapshot(configuration: nil)
        guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else { throw SmokeFailure.failed("Snapshot failed") }
        try png.write(to: root.appendingPathComponent("build/native-preview.png"))
        configuration.paused = true
        surface.update(configuration: configuration, visible: false)
        try await wait(100)
        try check(!surface.window.isVisible, "Hide must remove desktop window")
        let hidden = try await stats()
        try check(hidden["scheduled"] as? Bool == false, "Hidden wallpaper must not keep rendering")
        print("Diagnostics: \(mixed)")
        if reducedMotion { print("System reduced motion is enabled; animated-frame assertions skipped.") }
    }
}

@main
struct NativeSmoke {
    @MainActor static func main() {
        let app = NSApplication.shared
        // Only the smoke harness activates; the wallpaper stays an accessory.
        // An inactive test window can remain hidden to WebKit in another Space.
        app.setActivationPolicy(.regular)
        let harness = SmokeHarness()
        app.delegate = harness
        withExtendedLifetime(harness) { app.run() }
    }
}
