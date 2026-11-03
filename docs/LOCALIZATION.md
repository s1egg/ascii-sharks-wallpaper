# Localization

## Behavior

English is the default on every system, including upgrades that have saved wallpaper preferences but no language preference. The Language submenu offers English and Simplified Chinese, each written in its native language. The selected value is stored in UserDefaults under `language`.

Changing the language updates the next menu presentation, status-item tooltip, app-authored alerts, and the web canvas's accessibility description without restarting. It preserves all wallpaper settings and the current simulation. Unknown stored language identifiers fall back to English.

AppKit owns the native menu's appearance and keyboard behavior. System-generated technical error details can follow the system language; the surrounding explanation and recovery instructions use the selected app language.

## Files

| File | Responsibility |
| --- | --- |
| [Localization.swift](../Sources/Localization.swift) | Supported language identifiers, native language names, bundle lookup, English fallback, and typed recoverable errors. |
| [Settings.swift](../Sources/Settings.swift) | Saved language preference and the configuration sent to WebKit. |
| [WallpaperMenu.swift](../Sources/WallpaperMenu.swift) | Native menu groups, checkmarks, actions, and effective playback state. |
| [English strings](../Resources/en.lproj/Localizable.strings) | Default app-authored text and format strings. |
| [Chinese strings](../Resources/zh-Hans.lproj/Localizable.strings) | Simplified Chinese app-authored text. |
| [wallpaper.ts](../Web/src/wallpaper.ts) | Document language and canvas accessibility descriptions. |
| [Info.plist](../scripts/Info.plist) | English development region and supported bundle localizations. |
| [NativeSmoke.swift](../Tests/NativeSmoke.swift) | Preference migration, localization, native menu, and live WebKit checks. |

The build copies each `Resources/*.lproj` directory into the application bundle. The installer verifies that both supported translation tables are included. Installer pages and command-line diagnostics are in English; the application's Language setting does not change macOS Installer.

## Text conventions

- Keep comments and internal documentation in English, including comments inside translation files.
- Put native user-facing copy in `Localizable.strings`; avoid language conditionals scattered through menu code.
- Use stable semantic keys such as `menu.pause` and `error.rendererStopped`.
- Keep format placeholders identical between translations. Use the localizer's formatting helper rather than joining fragments of sentences.
- Keep language names recognizable in their own language.
- Store errors as typed values and localize them when displayed, so changing language also updates an existing app-authored error.
- Preserve technical details as returned by WebKit or macOS.

## Add another language

1. Add a stable BCP 47 identifier and native name to `AppLanguage`.
2. Add a matching `Resources/<identifier>.lproj/Localizable.strings` with all existing keys and compatible format placeholders.
3. Extend the web language type and accessibility description in `Web/src/wallpaper.ts`.
4. Add the identifier to `CFBundleLocalizations` and the installer's resource validation.
5. Run `bash scripts/test.sh`, inspect the native menu, and build the installer with `bash scripts/package.sh --skip-build`.
6. Update both READMEs. Add a separate README translation only when one is maintained.

The localizer falls back to the English table if a language bundle or key is missing. Resource validation should catch incomplete supported translations before distribution.

## Menu lifecycle

`WallpaperMenu.update` records the latest presentation. `menuNeedsUpdate` rebuilds the native menu just before tracking starts, keeping asynchronous system events from changing an open menu. Selecting a language closes the menu normally; reopening it immediately shows the selected language.

Playback is unavailable while hidden, loading, failed, suspended, or respecting Reduce Motion. Its tooltip explains the effective state. The saved frame-rate preference remains checked during power saving; a separate note explains the temporary 15 FPS ceiling.
