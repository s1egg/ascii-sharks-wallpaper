import AppKit

enum MenuAction: Equatable {
    case togglePause, toggleVisibility, reload, showError, about, quit
    case scene(Scene)
    case frameRate(Int)
    case speed(Double)
    case allDisplays(Bool)
    case language(AppLanguage)
}

enum WallpaperState: Equatable {
    case playing(Int), savingPower(Int)
    case hidden, paused, suspended, loading, reducedMotion, failed

    func title(using localizer: Localizer) -> String {
        switch self {
        case .playing(let rate): localizer.format("status.playing", rate)
        case .savingPower(let rate): localizer.format("status.savingPower", rate)
        case .hidden: localizer.text("status.hidden")
        case .paused: localizer.text("status.paused")
        case .suspended: localizer.text("status.suspended")
        case .loading: localizer.text("status.loading")
        case .reducedMotion: localizer.text("status.reducedMotion")
        case .failed: localizer.text("status.failed")
        }
    }

    var allowsPlaybackControl: Bool {
        switch self {
        case .playing, .savingPower, .paused: true
        default: false
        }
    }
}

@MainActor
final class WallpaperMenu: NSObject, NSMenuDelegate {
    let menu = NSMenu()
    var onAction: ((MenuAction) -> Void)?
    private var presentation: (settings: Settings, state: WallpaperState, savingPower: Bool, localizer: Localizer)?

    override init() {
        super.init()
        menu.delegate = self
        menu.autoenablesItems = false
    }

    func update(settings: Settings, state: WallpaperState, savingPower: Bool, localizer: Localizer) {
        presentation = (settings, state, savingPower, localizer)
        if menu.items.isEmpty { menuNeedsUpdate(menu) }
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        guard let presentation else { return }
        let (settings, state, savingPower, localizer) = presentation
        // Rebuild before tracking starts; system callbacks must not mutate an open menu.
        menu.removeAllItems()
        menu.addItem(label("ASCII Sharks Wallpaper"))
        menu.addItem(label(state.title(using: localizer)))
        menu.addItem(.separator())

        let pause = item(localizer.text(settings.paused ? "menu.resume" : "menu.pause"),
                         action: .togglePause, symbol: settings.paused ? "play.fill" : "pause.fill")
        pause.isEnabled = state.allowsPlaybackControl
        if !pause.isEnabled { pause.toolTip = state.title(using: localizer) }
        menu.addItem(pause)
        menu.addItem(item(localizer.text(settings.visible ? "menu.hide" : "menu.show"),
                          action: .toggleVisibility, symbol: settings.visible ? "eye.slash" : "eye"))
        menu.addItem(.separator())

        let scenes = submenu(localizer.text("menu.scene"), symbol: "fish")
        for scene in Scene.allCases {
            scenes.addItem(item(localizer.text(scene.titleKey), action: .scene(scene), checked: settings.scene == scene))
        }
        let rates = submenu(localizer.text("menu.frameRate"), symbol: "speedometer")
        for (rate, key) in [(15, "frameRate.low"), (30, "frameRate.balanced"), (60, "frameRate.smooth")] {
            rates.addItem(item(localizer.text(key), action: .frameRate(rate), checked: settings.frameRate == rate))
        }
        if savingPower {
            rates.addItem(.separator())
            rates.addItem(label(localizer.text("frameRate.limited")))
        }
        let speeds = submenu(localizer.text("menu.speed"), symbol: "tortoise")
        for (speed, key) in [(0.5, "speed.slow"), (1.0, "speed.natural"), (1.5, "speed.lively")] {
            speeds.addItem(item(localizer.text(key), action: .speed(speed), checked: settings.speed == speed))
        }
        menu.addItem(.separator())

        let displays = submenu(localizer.text("menu.displays"), symbol: "display.2")
        displays.addItem(item(localizer.text("displays.all"), action: .allDisplays(true), checked: settings.allDisplays))
        displays.addItem(item(localizer.text("displays.primary"), action: .allDisplays(false), checked: !settings.allDisplays))
        let languages = submenu(localizer.text("menu.language"), symbol: "globe")
        for language in AppLanguage.allCases {
            languages.addItem(item(language.nativeName, action: .language(language), checked: settings.language == language))
        }
        menu.addItem(.separator())

        if state == .failed {
            menu.addItem(item(localizer.text("menu.error"), action: .showError, symbol: "exclamationmark.triangle"))
        }
        menu.addItem(item(localizer.text("menu.reload"), action: .reload, symbol: "arrow.clockwise"))
        menu.addItem(item(localizer.text("menu.about"), action: .about))
        menu.addItem(.separator())
        let quit = item(localizer.text("menu.quit"), action: .quit)
        quit.keyEquivalent = "q"
        quit.keyEquivalentModifierMask = .command
        menu.addItem(quit)
    }

    private func label(_ title: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.isEnabled = false
        return item
    }

    private func item(_ title: String, action: MenuAction, symbol: String? = nil, checked: Bool? = nil) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: #selector(select(_:)), keyEquivalent: "")
        item.target = self
        item.representedObject = action
        if let checked { item.state = checked ? .on : .off }
        if let symbol { item.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil) }
        return item
    }

    private func submenu(_ title: String, symbol: String) -> NSMenu {
        let child = NSMenu(title: title)
        child.autoenablesItems = false
        let parent = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        parent.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)
        parent.submenu = child
        menu.addItem(parent)
        return child
    }

    @objc private func select(_ sender: NSMenuItem) {
        guard let action = sender.representedObject as? MenuAction else { return }
        onAction?(action)
    }
}
