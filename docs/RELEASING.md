# Release workflow

The local build command creates macOS arm64 artifacts. It does not push commits, publish a GitHub release, install the app, or restart a running instance. The explicit GitHub publishing steps follow below.

## Prepare the source

1. Set the requested three-part version in `package.json` and `scripts/Info.plist` (`CFBundleShortVersionString`). Increment `CFBundleVersion` for the new build. The build rejects mismatched versions.
2. Update `CHANGELOG.md` and write `docs/releases/<version>.md` plus `docs/releases/<version>.zh-CN.md`. Keep both READMEs and affected previews current.
3. Review the changes and run the affected checks. If README media changed, follow `media/readme/README.md` and run its frame check.
4. Commit the source and documentation. Release assembly requires a clean working tree so artifact provenance points to a reproducible commit.

## Build the release

```sh
bun run release
```

This runs the complete simulation/native test command, assembles and signs the app in an empty staging directory, creates a ZIP, builds the PKG, expands and verifies the installer payload, checks ZIP integrity, and validates checksums. Only named source resources enter the bundle; the module cache may be reused. It also rejects an existing version tag if that tag points at a different commit.

Outputs:

- `dist/ASCII Sharks Wallpaper.app` — runnable app.
- `dist/releases/<version>/` — the single distribution folder: versioned ZIP/PKG files, their `.sha256` sidecars, bilingual notes, `SHA256SUMS.txt`, and `release.json`.

`release.json` records the source commit/tree, version/build number, minimum macOS version, toolchain versions, verification results, signing status, and artifact hashes. The command checks the source again after verification to avoid attributing changing files to the starting commit.

An ordinary app build or installer rebuild removes the previous `release.json` and aggregate `SHA256SUMS.txt` before replacing an artifact. Run the complete release command again to produce a verified set; this prevents new binaries from carrying old source/verification metadata.

Once the release command succeeds, an annotated local version tag can identify that exact commit:

```sh
git tag -a v0.1.2 -m "ASCII Sharks Wallpaper 0.1.2"
```

Use the release's actual version in the tag command. Publishing or pushing is a separate, explicit step.

## Publish to GitHub

After publishing is authorized, verify that the release tag resolves to the manifest's `source_commit`. If an unpublished local tag needs to include final cleanup, confirm that it is absent from the remote before updating it locally and rebuilding. Never move an already published version tag.

Push the branch and annotated tag together, then create a draft release with the complete versioned folder:

```sh
git push --atomic origin main refs/tags/v0.1.2
gh release create v0.1.2 dist/releases/0.1.2/* \
  --repo s1egg/ascii-sharks-wallpaper --verify-tag --draft \
  --title "v0.1.2 — ASCII Sharks Wallpaper" \
  --notes-file docs/releases/0.1.2.md
```

Download the draft's attachments to a temporary directory and run `shasum -a 256 -c SHA256SUMS.txt` there. Check that its `release.json` records the pushed tag's commit, that every expected attachment is present, and that the ZIP/PKG metadata matches the version/build number. Then publish and mark it as the latest release:

```sh
gh release edit v0.1.2 --repo s1egg/ascii-sharks-wallpaper --draft=false --latest
```

Verify the published URL, latest-release pointer, tag commit, and attachment list after publishing. Use the actual version throughout; the commands above show 0.1.2.

## Generated files and cleanup

App, icon, and installer staging directories are temporary and clean themselves up. Keep the current app and versioned release kit. `build/`, `output/`, `media/readme/node_modules/`, and `media/readme/public/` contain regenerable build, preview, or media files; they are not source distribution content. Preserve any local settings backups and files currently served by a preview before cleaning those directories. Original artwork archives, `Assets/Backdrop/`, media-generation source, and documentation remain useful source material.

## Individual commands

```sh
# Build an app and ZIP; validate source version consistency.
bun run build

# Run simulation and native WebKit checks, including an app build.
bun run test

# Build and verify the installer from the current app.
bun run package --skip-build
```

`bash scripts/test.sh` is equivalent to `bun run test`.

Current distribution uses ad hoc app signing and an unsigned installer. It is not notarized. Do not describe local signature integrity checks as Developer ID signing or Apple notarization.
