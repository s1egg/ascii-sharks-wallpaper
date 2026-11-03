import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private let wallpaperMenu = WallpaperMenu()
    private var surfaces: [UInt32: WallpaperSurface] = [:]
    private var settings = Settings()
    private var suspensions = Set<Suspension>()
    private var resourceURL: URL?
    private var fatalError: WallpaperFailure?

    private var localizer: Localizer { Localizer(language: settings.language) }

    private var savingPower: Bool {
        ProcessInfo.processInfo.isLowPowerModeEnabled ||
        [.serious, .critical].contains(ProcessInfo.processInfo.thermalState)
    }

    private var configuration: WebConfiguration {
        settings.configuration(suspended: !suspensions.isEmpty, savingPower: savingPower)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.setActivationPolicy(.accessory)
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let image = NSImage(systemSymbolName: "fish", accessibilityDescription: nil) {
            image.isTemplate = true
            item.button?.image = image
        } else { item.button?.title = "≈" }
        statusItem = item
        wallpaperMenu.onAction = { [weak self] action in self?.perform(action) }
        item.menu = wallpaperMenu.menu

        resourceURL = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true)
        if let resourceURL, FileManager.default.fileExists(atPath: resourceURL.appendingPathComponent("index.html").path) {
            observeSystem()
            rebuildSurfaces()
        } else { fatalError = .missingResources }
        rebuildMenu()
    }

    func applicationWillTerminate(_ notification: Notification) {
        NotificationCenter.default.removeObserver(self)
        NSWorkspace.shared.notificationCenter.removeObserver(self)
        DistributedNotificationCenter.default().removeObserver(self)
        surfaces.values.forEach { $0.close() }
    }

    private func observeSystem() {
        let local = NotificationCenter.default
        local.addObserver(self, selector: #selector(screensChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
        local.addObserver(self, selector: #selector(powerChanged), name: .NSProcessInfoPowerStateDidChange, object: nil)
        local.addObserver(self, selector: #selector(powerChanged), name: ProcessInfo.thermalStateDidChangeNotification, object: nil)
        let workspace = NSWorkspace.shared.notificationCenter
        workspace.addObserver(self, selector: #selector(powerChanged), name: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification, object: nil)
        let names: [Notification.Name] = [
            NSWorkspace.willSleepNotification, NSWorkspace.didWakeNotification,
            NSWorkspace.screensDidSleepNotification, NSWorkspace.screensDidWakeNotification,
            NSWorkspace.sessionDidResignActiveNotification, NSWorkspace.sessionDidBecomeActiveNotification
        ]
        for name in names { workspace.addObserver(self, selector: #selector(workspaceChanged(_:)), name: name, object: nil) }
        // macOS has no public lock-screen notification in NSWorkspace. These
        // distributed notifications are supplementary; sleep/session observers
        // remain the fallback on versions that do not emit them.
        for name in ["com.apple.screenIsLocked", "com.apple.screenIsUnlocked"] {
            DistributedNotificationCenter.default().addObserver(self, selector: #selector(lockChanged(_:)), name: Notification.Name(name), object: nil)
        }
    }

    @objc private func screensChanged() { rebuildSurfaces() }
    @objc private func powerChanged() { applySettings() }

    @objc private func workspaceChanged(_ notification: Notification) {
        switch notification.name {
        case NSWorkspace.willSleepNotification: suspensions.insert(.computerSleep)
        case NSWorkspace.didWakeNotification: suspensions.remove(.computerSleep)
        case NSWorkspace.screensDidSleepNotification: suspensions.insert(.displaySleep)
        case NSWorkspace.screensDidWakeNotification: suspensions.remove(.displaySleep)
        case NSWorkspace.sessionDidResignActiveNotification: suspensions.insert(.inactiveSession)
        case NSWorkspace.sessionDidBecomeActiveNotification: suspensions.remove(.inactiveSession)
        default: break
        }
        applySettings()
    }

    @objc private func lockChanged(_ notification: Notification) {
        if notification.name.rawValue == "com.apple.screenIsLocked" { suspensions.insert(.screenLocked) }
        else { suspensions.remove(.screenLocked) }
        applySettings()
    }

    private func rebuildSurfaces() {
        guard let resourceURL else { return }
        let screens = settings.allDisplays ? NSScreen.screens : Array(NSScreen.screens.prefix(1))
        let targets = Set(screens.compactMap { ($0.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value })
        for id in Array(surfaces.keys) where !targets.contains(id) { surfaces.removeValue(forKey: id)?.close() }
        for screen in screens {
            guard let id = (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value else { continue }
            if let surface = surfaces[id] { surface.window.setFrame(screen.frame, display: true) }
            else {
                do {
                    let surface = try WallpaperSurface(screen: screen, resourceURL: resourceURL, configuration: configuration)
                    surface.onStatusChange = { [weak self] in self?.rebuildMenu() }
                    surfaces[id] = surface
                } catch { fatalError = .details(error.localizedDescription) }
            }
        }
        applySettings()
    }

    private func applySettings() {
        settings.save()
        surfaces.values.forEach { $0.update(configuration: configuration, visible: settings.visible) }
        rebuildMenu()
    }

    private func rebuildMenu() {
        let state: WallpaperState
        if fatalError != nil || surfaces.values.contains(where: { $0.lastError != nil }) { state = .failed }
        else if !settings.visible { state = .hidden }
        else if !suspensions.isEmpty { state = .suspended }
        else if NSWorkspace.shared.accessibilityDisplayShouldReduceMotion { state = .reducedMotion }
        else if settings.paused { state = .paused }
        else if surfaces.isEmpty || surfaces.values.contains(where: { !$0.isReady }) { state = .loading }
        else { state = savingPower ? .savingPower(configuration.frameRate) : .playing(configuration.frameRate) }
        wallpaperMenu.update(settings: settings, state: state, savingPower: savingPower, localizer: localizer)
        statusItem?.button?.toolTip = "ASCII Sharks Wallpaper · \(state.title(using: localizer))"
        statusItem?.button?.setAccessibilityLabel(localizer.text("accessibility.menu"))
    }

    private func perform(_ action: MenuAction) {
        switch action {
        case .togglePause: settings.paused.toggle()
        case .toggleVisibility: settings.visible.toggle()
        case .scene(let scene): settings.scene = scene
        case .frameRate(let rate): settings.frameRate = rate
        case .speed(let speed): settings.speed = speed
        case .language(let language): settings.language = language
        case .allDisplays(let allDisplays):
            settings.allDisplays = allDisplays
            rebuildSurfaces()
            return
        case .reload:
            guard let resourceURL, FileManager.default.fileExists(atPath: resourceURL.appendingPathComponent("index.html").path) else {
                fatalError = .missingResources
                rebuildMenu()
                return
            }
            fatalError = nil
            if surfaces.isEmpty { rebuildSurfaces() }
            else { surfaces.values.forEach { $0.reload() } }
            return
        case .showError: showError(); return
        case .about: showAbout(); return
        case .quit: NSApplication.shared.terminate(nil); return
        }
        applySettings()
    }

    private func showError() {
        let failures = fatalError.map { [$0] } ?? surfaces.values.compactMap(\.lastError)
        let message = failures.isEmpty
            ? localizer.text("error.loadingFailed")
            : failures.map { $0.message(using: localizer) }.joined(separator: "\n\n")
        showAlert(title: localizer.text("error.title"), message: message)
    }

    private func showAbout() {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "Development"
        showAlert(title: "ASCII Sharks Wallpaper", message: localizer.format("about.description", version))
    }

    private func showAlert(title: String, message: String) {
        NSApplication.shared.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: localizer.text("alert.ok"))
        alert.runModal()
    }
}
