#!/bin/bash
set -euo pipefail
umask 022
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ "${1:-}" != "--skip-build" ]; then
  bash scripts/build.sh
fi

APP="$PROJECT_ROOT/dist/ASCII Sharks Wallpaper.app"
PLIST="$APP/Contents/Info.plist"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")"
SOURCE_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' scripts/Info.plist)"
MANIFEST_VERSION="$(/usr/bin/python3 -c 'import json; print(json.load(open("package.json"))["version"])')"
SOURCE_BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' scripts/Info.plist)"
APP_BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$PLIST")"
if [ "$VERSION" != "$SOURCE_VERSION" ] || [ "$VERSION" != "$MANIFEST_VERSION" ] || [ "$APP_BUILD" != "$SOURCE_BUILD" ]; then
  echo "The built app has a different version/build number. Run scripts/build.sh before packaging." >&2
  exit 1
fi
PACKAGE_ID="dev.asciisharks.wallpaper.pkg"
INSTALLER="$PROJECT_ROOT/dist/ASCII-Sharks-Wallpaper-$VERSION-arm64.pkg"
WORK="$(mktemp -d "$PROJECT_ROOT/build/package.XXXXXX")"
mkdir -p "$WORK/root" "$WORK/packages"

codesign --verify --deep --strict "$APP"
ditto --norsrc --noextattr --noacl "$APP" "$WORK/root/ASCII Sharks Wallpaper.app"
# Package only the staged application, never the ZIP or other release files.
chmod -R u+rwX,go+rX "$WORK/root/ASCII Sharks Wallpaper.app"
pkgbuild --root "$WORK/root" \
  --component-plist scripts/installer/Components.plist \
  --identifier "$PACKAGE_ID" --version "$VERSION" \
  --install-location /Applications --ownership recommended \
  "$WORK/packages/ASCIISharks.pkg"

productbuild --synthesize --product scripts/installer/Requirements.plist \
  --package "$WORK/packages/ASCIISharks.pkg" "$WORK/Distribution.xml"

/usr/bin/python3 - "$WORK/Distribution.xml" <<'PY'
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1]
tree = ET.parse(path)
root = tree.getroot()
ET.SubElement(root, "title").text = "ASCII Sharks Wallpaper"
ET.SubElement(root, "welcome", {"file": "welcome.html", "mime-type": "text/html"})
ET.SubElement(root, "readme", {"file": "readme.html", "mime-type": "text/html"})
ET.SubElement(root, "conclusion", {"file": "conclusion.html", "mime-type": "text/html"})
ET.SubElement(root, "domains", {
    "enable_anywhere": "false", "enable_currentUserHome": "false", "enable_localSystem": "true"
})
options = root.find("options")
if options is not None:
    options.set("customize", "never")
    options.set("allow-external-scripts", "no")
ET.indent(tree, space="  ")
tree.write(path, encoding="utf-8", xml_declaration=True)
PY

productbuild --distribution "$WORK/Distribution.xml" \
  --resources scripts/installer/resources --package-path "$WORK/packages" \
  "$INSTALLER"

# Inspect the exact payload and its signature without installing on this Mac.
pkgutil --expand-full "$INSTALLER" "$WORK/expanded"
codesign --verify --deep --strict "$WORK/expanded/ASCIISharks.pkg/Payload/ASCII Sharks Wallpaper.app"
/usr/bin/python3 - "$WORK/expanded" "$PACKAGE_ID" "$VERSION" <<'PY'
from pathlib import Path
import plistlib
import sys
import xml.etree.ElementTree as ET

root, package_id, version = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
package = ET.parse(root / "ASCIISharks.pkg/PackageInfo").getroot()
assert package.attrib["install-location"] == "/Applications"
assert package.attrib["identifier"] == package_id
assert package.attrib["version"] == version
assert package.attrib["relocatable"] == "false"
assert package.find("relocate/bundle") is None
payload = root / "ASCIISharks.pkg/Payload"
assert [p.name for p in payload.iterdir()] == ["ASCII Sharks Wallpaper.app"]
with (payload / "ASCII Sharks Wallpaper.app/Contents/Info.plist").open("rb") as f:
    app = plistlib.load(f)
assert app["CFBundleShortVersionString"] == version
assert app["LSMinimumSystemVersion"] == "13.0"
assert app["CFBundleName"] == "ASCII Sharks Wallpaper"
assert app["CFBundleDisplayName"] == "ASCII Sharks Wallpaper"
assert app["CFBundleIconFile"] == "AppIcon.icns"
assert app["CFBundleDevelopmentRegion"] == "en"
assert app["CFBundleLocalizations"] == ["en", "zh-Hans"]
assert (payload / "ASCII Sharks Wallpaper.app/Contents/Resources/AppIcon.icns").stat().st_size > 0
for language in ("en", "zh-Hans"):
    strings = payload / "ASCII Sharks Wallpaper.app/Contents/Resources" / f"{language}.lproj/Localizable.strings"
    assert strings.is_file() and strings.stat().st_size > 0
distribution = ET.parse(root / "Distribution").getroot()
assert distribution.find("options").attrib["hostArchitectures"] == "arm64"
assert distribution.find("volume-check/allowed-os-versions/os-version").attrib["min"] == "13.0"
assert not (root / "ASCIISharks.pkg/Scripts").exists()
for file in ("welcome.html", "readme.html", "conclusion.html"):
    resource = root / "Resources" / file
    assert resource.is_file()
    assert '<html lang="en">' in resource.read_text()
print("Installer verified: /Applications · arm64 · macOS 13+ · English and Chinese resources · no installation scripts")
PY

(
  cd "$PROJECT_ROOT/dist"
  shasum -a 256 "ASCII-Sharks-Wallpaper-$VERSION-arm64.pkg" > "ASCII-Sharks-Wallpaper-$VERSION-arm64.pkg.sha256"
)
echo "Installer built: $INSTALLER"
