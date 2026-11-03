#!/bin/bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICONSET="$PROJECT_ROOT/build/AppIcon.iconset"
SOURCE="$PROJECT_ROOT/Assets/AppIcon.png"
mkdir -p "$ICONSET"

# Supply every macOS point size and its Retina representation.
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$SOURCE" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  retina=$((size * 2))
  sips -z "$retina" "$retina" "$SOURCE" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil --convert icns "$ICONSET" --output "$PROJECT_ROOT/build/AppIcon.icns"
