#!/bin/bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
APP="$PROJECT_ROOT/dist/ASCII Sharks Wallpaper.app"
BUILD="$PROJECT_ROOT/build"
mkdir -p "$BUILD/Web" "$BUILD/ModuleCache" "$APP/Contents/MacOS" "$APP/Contents/Resources/Web"

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required to build the app, but is not needed at runtime." >&2
  exit 1
fi

bun build Web/src/wallpaper.ts --outfile "$BUILD/Web/wallpaper.js" --target browser --format iife --minify
cp Web/index.html Web/wallpaper.css "$BUILD/Web/"
cp "$BUILD/Web/"* "$APP/Contents/Resources/Web/"
cp LICENSE THIRD_PARTY_NOTICES.md "$APP/Contents/Resources/"
cp scripts/Info.plist "$APP/Contents/Info.plist"
cp -R Resources/*.lproj "$APP/Contents/Resources/"
bash scripts/build-icon.sh
cp "$BUILD/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
xcrun swiftc -swift-version 6 -O -target arm64-apple-macosx13.0 \
  -module-cache-path "$BUILD/ModuleCache" \
  -framework AppKit -framework WebKit \
  Sources/Localization.swift Sources/Settings.swift Sources/WallpaperMenu.swift \
  Sources/WallpaperSurface.swift Sources/AppDelegate.swift Sources/main.swift \
  -o "$APP/Contents/MacOS/ASCIISharks"
codesign --force --sign - "$APP"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$PROJECT_ROOT/dist/ASCII-Sharks-Wallpaper-0.1.1-arm64.zip"
echo "App built: $APP"
