# Local release workflow

The release tools build macOS arm64 artifacts locally. They do not push commits, publish a GitHub release, install the app, or restart a running instance.

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
- `dist/ASCII-Sharks-Wallpaper-<version>-arm64.zip` and `.pkg` — distribution artifacts, each with a `.sha256` sidecar.
- `dist/releases/<version>/` — the versioned release kit: archives, installer, sidecars, bilingual notes, `SHA256SUMS.txt`, and `release.json`.

`release.json` records the source commit/tree, version/build number, minimum macOS version, toolchain versions, verification results, signing status, and artifact hashes. The command checks the source again after verification to avoid attributing changing files to the starting commit.

Once the release command succeeds, an annotated local version tag can identify that exact commit:

```sh
git tag -a v0.1.2 -m "ASCII Sharks Wallpaper 0.1.2"
```

Use the release's actual version in the tag command. Publishing or pushing is a separate, explicit step.

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
