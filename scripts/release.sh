#!/bin/bash
set -euo pipefail
umask 022
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ "${1:-}" = "--help" ]; then
  echo "Usage: bash scripts/release.sh"
  echo "Verify a clean commit, test, build and package a local release in dist/releases/<version>."
  echo "This command does not commit, tag, push, publish, install or launch the app."
  exit 0
fi
if [ "$#" -gt 0 ]; then
  echo "Unknown argument. Use --help for usage." >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit the release source and documentation first; local release bundles require a clean working tree." >&2
  exit 1
fi

APP_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' scripts/Info.plist)"
RELEASE_COMMIT="$(git rev-parse HEAD)"
RELEASE_TREE="$(git rev-parse 'HEAD^{tree}')"
RELEASE_TAG="v$APP_VERSION"
TAG_COMMIT="$(git rev-parse --verify "refs/tags/$RELEASE_TAG^{commit}" 2>/dev/null || true)"
if [ -n "$TAG_COMMIT" ] && [ "$TAG_COMMIT" != "$RELEASE_COMMIT" ]; then
  echo "$RELEASE_TAG already points at a different commit. Choose a new version before rebuilding a release." >&2
  exit 1
fi
for notes in "docs/releases/$APP_VERSION.md" "docs/releases/$APP_VERSION.zh-CN.md"; do
  if [ ! -s "$notes" ]; then
    echo "Missing release notes: $notes" >&2
    exit 1
  fi
done

bash scripts/test.sh
bash scripts/package.sh --skip-build

# Do not attribute files to a commit if the source changed during verification.
if [ "$(git rev-parse HEAD)" != "$RELEASE_COMMIT" ] || [ -n "$(git status --porcelain)" ]; then
  echo "Source changed during release verification. Commit the changes and run the release again." >&2
  exit 1
fi

RELEASE_DIR="$PROJECT_ROOT/dist/releases/$APP_VERSION"
ZIP_NAME="ASCII-Sharks-Wallpaper-$APP_VERSION-arm64.zip"
PKG_NAME="ASCII-Sharks-Wallpaper-$APP_VERSION-arm64.pkg"
unzip -tq "$RELEASE_DIR/$ZIP_NAME"
for artifact in "$ZIP_NAME" "$PKG_NAME" "$ZIP_NAME.sha256" "$PKG_NAME.sha256"; do
  if [ ! -s "$RELEASE_DIR/$artifact" ]; then
    echo "Missing release artifact: $artifact" >&2
    exit 1
  fi
done
cp "docs/releases/$APP_VERSION.md" "$RELEASE_DIR/RELEASE_NOTES.md"
cp "docs/releases/$APP_VERSION.zh-CN.md" "$RELEASE_DIR/RELEASE_NOTES.zh-CN.md"

python3 - "$PROJECT_ROOT" "$RELEASE_DIR" "$APP_VERSION" "$RELEASE_COMMIT" "$RELEASE_TREE" <<'PY'
import hashlib
import json
import plistlib
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

root, release = Path(sys.argv[1]), Path(sys.argv[2])
version, commit, tree = sys.argv[3:]
manifest = json.loads((root / "package.json").read_text())
with (root / "dist/ASCII Sharks Wallpaper.app/Contents/Info.plist").open("rb") as source:
    app = plistlib.load(source)
report = json.loads((root / "build/native-smoke-report.json").read_text())
assert manifest["version"] == app["CFBundleShortVersionString"] == version
assert report["passed"] is True

names = [f"ASCII-Sharks-Wallpaper-{version}-arm64.{ext}" for ext in ("zip", "pkg")]
names += [f"{name}.sha256" for name in names[:]]
names += ["RELEASE_NOTES.md", "RELEASE_NOTES.zh-CN.md"]
artifacts = []
for name in names:
    path = release / name
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    artifacts.append({"file": name, "bytes": path.stat().st_size, "sha256": digest})
    if path.suffix in (".zip", ".pkg"):
        assert (release / f"{name}.sha256").read_text().split()[0] == digest

data = {
    "name": "ASCII Sharks Wallpaper", "version": version,
    "build_number": app["CFBundleVersion"], "platform": "macOS", "architecture": "arm64",
    "minimum_macos": app["LSMinimumSystemVersion"], "source_commit": commit,
    "source_tree": tree, "source_clean": True,
    "built_at": datetime.now(timezone.utc).isoformat(),
    "toolchain": {
        "bun": subprocess.check_output(["bun", "--version"], text=True).strip(),
        "swift": subprocess.check_output(["xcrun", "swiftc", "--version"], text=True).splitlines()[0],
    },
    "verification": {
        "command": "bash scripts/test.sh && bash scripts/package.sh --skip-build",
        "native_smoke_passed": True, "installer_payload_verified": True, "zip_integrity_verified": True,
    },
    "signing": {"app": "ad-hoc", "installer": "unsigned", "notarized": False},
    "artifacts": artifacts,
}
(release / "release.json").write_text(json.dumps(data, indent=2) + "\n")
names.append("release.json")
checksums = [f"{hashlib.sha256((release / name).read_bytes()).hexdigest()}  {name}\n" for name in sorted(names)]
(release / "SHA256SUMS.txt").write_text("".join(checksums))
print(f"Release verified: {version} (build {app['CFBundleVersion']}) from {commit[:12]}")
PY
(
  cd "$RELEASE_DIR"
  shasum -a 256 -c SHA256SUMS.txt
)
echo "Local release ready: $RELEASE_DIR"
