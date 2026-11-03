import Foundation

enum Scene: String, CaseIterable, Codable {
    case classic, mixed, solo

    var titleKey: String { "scene.\(rawValue)" }
}

enum Suspension: String, Hashable {
    case computerSleep, displaySleep, inactiveSession, screenLocked
}

struct Settings {
    var paused = false
    var visible = true
    var allDisplays = true
    var frameRate = 30
    var speed = 1.0
    var scene = Scene.classic
    var language = AppLanguage.english
    var interaction = true

    init(defaults: UserDefaults = .standard) {
        defaults.register(defaults: ["visible": true, "allDisplays": true, "frameRate": 30, "speed": 1.0, "interaction": true])
        paused = defaults.bool(forKey: "paused")
        visible = defaults.bool(forKey: "visible")
        allDisplays = defaults.bool(forKey: "allDisplays")
        let storedRate = defaults.integer(forKey: "frameRate")
        frameRate = [15, 30, 60].contains(storedRate) ? storedRate : 30
        let storedSpeed = defaults.double(forKey: "speed")
        speed = [0.5, 1.0, 1.5].contains(storedSpeed) ? storedSpeed : 1.0
        scene = Scene(rawValue: defaults.string(forKey: "scene") ?? "") ?? .classic
        language = AppLanguage(rawValue: defaults.string(forKey: "language") ?? "") ?? .english
        interaction = defaults.bool(forKey: "interaction")
    }

    func save(defaults: UserDefaults = .standard) {
        defaults.set(paused, forKey: "paused")
        defaults.set(visible, forKey: "visible")
        defaults.set(allDisplays, forKey: "allDisplays")
        defaults.set(frameRate, forKey: "frameRate")
        defaults.set(speed, forKey: "speed")
        defaults.set(scene.rawValue, forKey: "scene")
        defaults.set(language.rawValue, forKey: "language")
        defaults.set(interaction, forKey: "interaction")
    }

    func configuration(suspended: Bool, savingPower: Bool) -> WebConfiguration {
        WebConfiguration(
            paused: paused || !visible || suspended,
            frameRate: savingPower ? min(frameRate, 15) : frameRate,
            speed: speed,
            pixelRatio: savingPower ? 1 : 1.5,
            scene: scene,
            language: language,
            interaction: interaction
        )
    }
}

struct WebConfiguration: Encodable {
    var paused: Bool
    var frameRate: Int
    var speed: Double
    var pixelRatio: Double
    var scene: Scene
    var language: AppLanguage = .english
    var interaction = true

    func json() throws -> String {
        String(decoding: try JSONEncoder().encode(self), as: UTF8.self)
    }
}
