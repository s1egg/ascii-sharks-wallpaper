# Changelog

## 0.1.2 — 2026-11-03

### Added

- Optional gentle mouse interaction with velocity-sensitive fish avoidance, ripples only on contact with live small fish, and a nearby shark's brief curiosity after about 0.6 seconds of stillness.
- Distinct swimming habits: horizontal hammerhead patrols, occasional short mako bursts, and slower thresher turns and tail rhythms. Mixed now contains hammerhead, tiger, mako, and thresher residents.
- Sparse ambient moments: an existing school crosses the open water, or one pale, uncommon visitor passes in the distance. Events preserve resident identities and the small-fish budget, and pause with the scene.
- A persisted English/Chinese interaction toggle, browser scene preview links, and regression coverage for input, movement, schools, and ambient lifecycles.
- A reproducible, cursor-free README desktop demo with MP4/GIF frame checks.
- A local release command that validates a clean source commit and collects the app archives, installer, bilingual release notes, SHA-256 checksums, and build provenance.

### Changed

- Reduced small-fish density to 24–64 animals by viewport area, with at most seven per school, wider spacing, weaker cohesion, and softer resting ink.
- Updated the English and Simplified Chinese READMEs and scene previews.
- Build artifacts derive their versioned names from application metadata; ZIP archives now include a checksum sidecar.
- Distribution files share one versioned release directory, temporary installer staging is removed automatically, and the unused legacy animation has been removed.

### Fixed

- Initial size notifications no longer clear pointer input received immediately after scene changes.
- Late native pointer replies cannot revive a paused, replaced, or disposed interaction state.
- Pausing or enabling Reduce Motion paints a clean static frame so transient pointer water marks do not remain frozen on screen.
- Corner steering keeps the solo composition visible while retaining smooth turns and fixed segment lengths.
- Packaging rejects an app whose version or build number differs from the source configuration.
- Rebuilding a distribution artifact invalidates stale release provenance; installer-only builds also work after the temporary build directory has been cleaned.
- App and icon assembly use empty staging directories so stale generated resources cannot leak into new release artifacts.
- README video exports use ordinary PNG frame capture to avoid corrupted opening frames with the tested Chrome rendering path.

## 0.1.1 — 2026-11-03

- Initial tagged macOS release with ink-wash ASCII rendering, three scenes, a native menu bar app, English and Simplified Chinese menus, power-aware scheduling, app icons, and local ZIP/PKG distribution.
