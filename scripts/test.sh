#!/bin/bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
bun test Tests/world.test.ts
bash scripts/build.sh
xcrun swiftc -swift-version 6 -parse-as-library -target arm64-apple-macosx13.0 \
  -module-cache-path "$PROJECT_ROOT/build/ModuleCache" \
  -framework AppKit -framework WebKit \
  Sources/Localization.swift Sources/Settings.swift Sources/WallpaperMenu.swift \
  Sources/WallpaperSurface.swift Tests/NativeSmoke.swift \
  -o build/NativeSmoke
if [ "${1:-}" = "--prepare" ]; then
  SMOKE_APP="$PROJECT_ROOT/build/NativeSmoke.app"
  mkdir -p "$SMOKE_APP/Contents/MacOS"
  cp build/NativeSmoke "$SMOKE_APP/Contents/MacOS/NativeSmoke"
  /usr/libexec/PlistBuddy -c 'Clear dict' "$SMOKE_APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c 'Add :CFBundleExecutable string NativeSmoke' "$SMOKE_APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c 'Add :CFBundleIdentifier string dev.asciisharks.smoketest' "$SMOKE_APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c 'Add :CFBundleName string NativeSmoke' "$SMOKE_APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c 'Add :CFBundlePackageType string APPL' "$SMOKE_APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c 'Add :LSUIElement bool true' "$SMOKE_APP/Contents/Info.plist"
  codesign --force --sign - "$SMOKE_APP"
  echo "Native smoke app prepared: $SMOKE_APP"
else
  build/NativeSmoke "$PROJECT_ROOT"
fi
codesign --verify --deep --strict "dist/ASCII Sharks Wallpaper.app"
file "dist/ASCII Sharks Wallpaper.app/Contents/MacOS/ASCIISharks"
