import Foundation

enum AppLanguage: String, CaseIterable, Codable {
    case english = "en"
    case simplifiedChinese = "zh-Hans"

    var nativeName: String {
        switch self {
        case .english: "English"
        case .simplifiedChinese: "简体中文"
        }
    }
}

struct Localizer {
    let language: AppLanguage
    private let translated: Bundle?
    private let english: Bundle?

    init(language: AppLanguage, resourceURL: URL? = Bundle.main.resourceURL) {
        self.language = language
        translated = resourceURL.flatMap { Bundle(url: $0.appendingPathComponent("\(language.rawValue).lproj")) }
        english = resourceURL.flatMap { Bundle(url: $0.appendingPathComponent("en.lproj")) }
    }

    func text(_ key: String) -> String {
        let fallback = english?.localizedString(forKey: key, value: key, table: nil) ?? key
        return translated?.localizedString(forKey: key, value: fallback, table: nil) ?? fallback
    }

    func format(_ key: String, _ arguments: CVarArg...) -> String {
        String(format: text(key), locale: Locale(identifier: language.rawValue), arguments: arguments)
    }
}

enum WallpaperFailure {
    case missingResources
    case loadingFailed
    case rendererStopped
    case details(String)

    func message(using localizer: Localizer) -> String {
        switch self {
        case .missingResources: localizer.text("error.missingResources")
        case .loadingFailed: localizer.text("error.loadingFailed")
        case .rendererStopped: localizer.text("error.rendererStopped")
        case .details(let detail): localizer.format("error.details", detail)
        }
    }
}
