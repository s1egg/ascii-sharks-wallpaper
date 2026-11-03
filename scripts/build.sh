#!/bin/bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
APP_DESTINATION="$PROJECT_ROOT/dist/ASCII Sharks Wallpaper.app"
BUILD="$PROJECT_ROOT/build"

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required to build the app, but is not needed at runtime." >&2
  exit 1
fi

APP_VERSION="$(bun -e 'import manifest from "./package.json"; process.stdout.write(manifest.version);')"
if ! [[ "$APP_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Use a three-part numeric application version, such as 0.1.2." >&2
  exit 1
fi
PLIST_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' scripts/Info.plist)"
if [ "$APP_VERSION" != "$PLIST_VERSION" ]; then
  echo "Version mismatch: package.json is $APP_VERSION, Info.plist is $PLIST_VERSION." >&2
  exit 1
fi

mkdir -p "$BUILD/Web" "$BUILD/ModuleCache" "$PROJECT_ROOT/dist"
STAGING_ROOT="$(mktemp -d "$BUILD/app.XXXXXX")"
trap 'rm -rf "$STAGING_ROOT"' EXIT
APP="$STAGING_ROOT/ASCII Sharks Wallpaper.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/Web"

# Assemble from named source files into an empty bundle, never from cached Web output.
bun build Web/src/wallpaper.ts --outfile "$APP/Contents/Resources/Web/wallpaper.js" --target browser --format iife --minify
cp Web/index.html Web/wallpaper.css "$APP/Contents/Resources/Web/"
cp LICENSE THIRD_PARTY_NOTICES.md "$APP/Contents/Resources/"
cp scripts/Info.plist "$APP/Contents/Info.plist"
for strings in Resources/*.lproj/Localizable.strings; do
  locale="$(basename "$(dirname "$strings")")"
  mkdir -p "$APP/Contents/Resources/$locale"
  cp "$strings" "$APP/Contents/Resources/$locale/Localizable.strings"
done
bash scripts/build-icon.sh
cp "$BUILD/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
xcrun swiftc -swift-version 6 -O -target arm64-apple-macosx13.0 \
  -module-cache-path "$BUILD/ModuleCache" \
  -framework AppKit -framework WebKit \
  Sources/Localization.swift Sources/Settings.swift Sources/WallpaperMenu.swift \
  Sources/WallpaperSurface.swift Sources/AppDelegate.swift Sources/main.swift \
  -o "$APP/Contents/MacOS/ASCIISharks"
codesign --force --sign - "$APP"
ZIP_NAME="ASCII-Sharks-Wallpaper-$APP_VERSION-arm64.zip"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$STAGING_ROOT/$ZIP_NAME"
# Keep the existing runnable bundle until its replacement has compiled and signed.
if [ -e "$APP_DESTINATION" ]; then mv "$APP_DESTINATION" "$STAGING_ROOT/Previous.app"; fi
if ! mv "$APP" "$APP_DESTINATION"; then
  if [ -e "$STAGING_ROOT/Previous.app" ]; then mv "$STAGING_ROOT/Previous.app" "$APP_DESTINATION"; fi
  exit 1
fi
mv -f "$STAGING_ROOT/$ZIP_NAME" "$PROJECT_ROOT/dist/$ZIP_NAME"
for resource in index.html wallpaper.css wallpaper.js; do
  cp "$APP_DESTINATION/Contents/Resources/Web/$resource" "$BUILD/Web/$resource"
done
(
  cd "$PROJECT_ROOT/dist"
  shasum -a 256 "$ZIP_NAME" > "$ZIP_NAME.sha256"
)
echo "App built: $APP_DESTINATION"
