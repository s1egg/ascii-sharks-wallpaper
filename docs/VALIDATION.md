# Validation Log

Historical entries retain the application names, versions, and artifact paths used at the time. They describe the scope of each check, not a promise of compatibility with every supported deployment target.

## Recorded environment

- Apple Silicon / arm64, macOS 26.5.2.
- Apple Swift 6.2.4, macOS SDK 26.2, Bun 1.4.2.
- Native deployment target: `arm64-apple-macosx13.0`.
- Builds do not download third-party packages. The application has no network fonts or network requests.

## Initial checks passed

- Swift 6 compilation, with no warnings in the final build.
- Info.plist validation, arm64 executable inspection, and minimum deployment target 13.0.
- Ad hoc signature integrity: `codesign --verify --deep --strict`.
- ZIP integrity.
- Actual launch of the then-named `dist/ASCII Sharks.app`, showing ASCII sharks and fish in a desktop window.
- Real WKWebView checks: local resource loading, no JavaScript errors, advancing animation, a 30 FPS ceiling, unchanged frame count and simulation time while paused, zero scheduled work while paused, no catch-up after resume, propagation of the 15 FPS setting, scene replacement, and no scheduling while hidden.
- Native window properties: ignores mouse events, cannot become the main or key window, sits above the system background but below desktop icons, and joins all Spaces.
- Power-saving configuration and combinations of hidden state, manual pause, and system suspension.
- Native screenshot generated and inspected at `build/native-preview.png`.

The native report was written to `build/native-smoke-report.json` with `passed: true`.

## Earlier verification constraints

An earlier restricted terminal environment could not connect to some AppKit graphical services. The browse tool also failed to bind localhost with EPERM. Animation verification therefore used the native `NativeSmoke.app` and desktop app. Restricted command-line attempts were not counted as passing runs.

## Target-environment checks still needed

- Multiple-display hot-plugging, different scale factors, Spaces switching, and Stage Manager.
- Actual locking, sleep, session changes, Low Power Mode transitions, and thermal changes. Configuration and pause logic were checked without changing the user's system state to trigger these events.
- macOS 13–15 compatibility and other M-series devices.
- Long-running CPU, GPU, memory, and battery measurements at different resolutions.
- Developer ID signing, notarization, and distribution to other computers. Current builds use local ad hoc signing.

Launch at login, lock-screen wallpaper, and automatic updates are not implemented.

## Initial macOS installer

The original `dist/ASCII-Sharks-0.1.0-arm64.pkg` used the system `pkgbuild` and `productbuild` tools, with Chinese welcome, instructions, and completion pages.

The packaging script fully expanded the final installer and verified:

- Installation to `/Applications`, containing only `ASCII Sharks.app`. Existing workspace copies must not relocate the installation target.
- macOS 13.0 or later and arm64 architecture.
- Valid bundled app signature and version 0.1.0.
- No pre-install or post-install scripts and no automatic application launch.
- Complete installer resources and a companion SHA-256 checksum.

Package structure and contents were checked. The package was not installed into this Mac's `/Applications` during that run, and was not Developer ID Installer signed or notarized.

## 2026-11-03: Ink-wash ASCII rendering

The adaptation preserved character-based silhouettes while introducing white paper, gray ink, and depth-dependent opacity. It removed colored flicker, black grids, and solid color tiles. Cruising became slower, with stable heads and shoulders, tail-driven propulsion, smoother turns, and boundary anticipation. The native window background was matched to the scene.

Checks completed:

- `bash scripts/test.sh`: four Bun simulation tests, real WKWebView smoke checks, and app signature verification passed.
- Three-minute group-swimming check: stable segment lengths, finite coordinates, limited speed and turning, and no completely empty scene.
- Five-minute solo check: no prolonged absence; a fixed-seed regression covers the boundary correction.
- Head position does not follow the tail wave. Shoulder displacement stays below 0.2% of body length; tail displacement is approximately 4.8%.
- Browser previews at 1440 × 900, 2560 × 1080, and 768 × 1024, covering Classic, Mixed, and Solo.
- Pause preserves frame count and simulation time with no pending scheduling. Reduce Motion stops animation; resume and scene settings work.
- Short local Chromium samples at the 15 / 30 / 60 FPS settings measured approximately 14.94 / 29.95 / 57.26 FPS. At 1440 × 900, rAF callback time was about 2.4 ms median and 5.2 ms P95. These figures do not guarantee long-term energy use or performance on other devices.
- No browser console errors or warnings.

Evidence: `build/native-smoke-report.json`, `build/native-preview.png`, `build/ascii-ink-browser-report.json`, and `output/playwright/ascii-ink-*.png`.

The app and installer were rebuilt. That run did not install into `/Applications` or control/restart the user's running older instance; automatic approval had not granted control of that instance.

## 2026-11-03: App icon and name, 0.1.1

- The app display name, menu and About text, webpage title, installer copy, and output app name were standardized to `ASCII Sharks Wallpaper`.
- Added the 1024 × 1024 RGBA `Assets/AppIcon.png`. The build generates `AppIcon.icns` with ten size representations, referenced by `CFBundleIconFile`.
- Dark/light backgrounds and small icon sizes were inspected. AppKit's `NSWorkspace.icon(forFile:)` returned the custom shark icon; the result was saved to `build/resolved-app-icon.png`.
- `bash scripts/test.sh` passed. Installer checks confirmed the app name, icon resources, signature, installation location, and SHA-256 checksum.
- Outputs: `dist/ASCII Sharks Wallpaper.app`, `dist/ASCII-Sharks-Wallpaper-0.1.1-arm64.zip`, and `dist/ASCII-Sharks-Wallpaper-0.1.1-arm64.pkg`.

## 2026-11-03: Warm paper and stroke/glide motion

The background changed to warm paper, light clay, and pale celadon. CSS variables supply the renderer's palette, with the native startup background matched. Sharks gained independent stroke/glide rhythms. Painted spines preserve segment lengths, glyphs use hysteresis and crossfades, and wakes disperse sparsely along the tail direction.

- `bash scripts/test.sh` passed: five Bun simulation tests, real WKWebView smoke checks, arm64 compilation, and app signature verification.
- Added painted-spine checks for all eight shark shapes during strokes and glides. Existing three-minute group, five-minute solo, stable-head, and resize checks continued to pass.
- Chromium previews covered Classic, Mixed, Solo, and 1440 × 900, 2560 × 1080, and 768 × 1024 layouts. Pause and Reduce Motion stop scheduling; resume and scene settings work. No console errors or warnings.
- Short local samples measured approximately 14.97 / 30.75 / 56.55 FPS at the three settings, with frame-count error possible in short samples. At 1440 × 900, callback time was about 1.5 ms median and 4.8 ms P95. These results are not guarantees for long-term energy use or other devices.
- The native harness initially did not animate because WebKit considered its test window hidden. Diagnostics showed `hidden: true` and `scheduled: false`, consistent with power-saving behavior. The harness was changed to activate its test window and support fullscreen auxiliary placement. The complete native checks then passed; the production wallpaper's window level and activation policy stayed unchanged.
- The app, ZIP, and installer were regenerated; signature and package-content checks passed.

Evidence: `build/wabi-browser-report.json`, `build/native-smoke-report.json`, `build/native-preview.png`, and `output/playwright/wabi-*.png`. Recording: `output/playwright/wabi-sharks.webm` (1440 × 900, 30 FPS, approximately 23 seconds). This run did not install into `/Applications` or restart an existing wallpaper instance.

## 2026-11-03: Dark gradient below the menu bar

On the tested Mac, the gradient came from the macOS `Window Server / underbelly` layer, rather than Canvas or a wallpaper-window shadow. It measured 122 pt on the main screen and 217 pt on the portrait screen, above the desktop-icon layer.

At the user's request, enabling Show Menu Bar Background in System Settings removed both underbelly layers while retaining the normal 30 pt menu bar. This was a system appearance preference; it required no app change or reinstall. Other Macs may need their own appearance adjustments. Raising the entire wallpaper window to hide the effect would cover desktop icons.

The user subsequently reported a remaining band in the separate menu-bar background. Matching paper backgrounds without fish were exported from the existing Canvas renderer into `Assets/Backdrop/`. The landscape image was copied into `ASCII Sharks Wallpaper/Backdrop/` under the user's Application Support directory and applied through System Settings. Both displays were observed using it. Original wallpaper files were untouched; original locations and display options were backed up to `original-desktop-20261103.plist` in that support directory.

The user then disabled Show Menu Bar Background and reported that the issue was resolved. The resulting setup combines a matching system wallpaper with a transparent menu bar. No app code changed, and the app does not automatically restore the previous photograph on quit. The underbelly layer still exists in transparent mode; its presence alone does not prove a visible dark gradient.

## 2026-11-03: English default and bilingual menus

- Added English and Simplified Chinese resource bundles, with an explicit English default and saved language selection.
- Grouped the native menu into playback, scene/performance, display/language, recovery/information, and quit. Display coverage now uses explicit exclusive choices; visibility names its action.
- Status text reflects hidden, manually paused, system-suspended, loading, failed, reduced-motion, and power-saving states. Playback is disabled when the effective state prevents animation.
- Native menus refresh before tracking starts. App-authored errors are localized when shown, and the About version comes from the app bundle.
- Switching language updates the canvas description and document language without replacing the renderer or restarting its animation loop.
- `bash scripts/test.sh` passed: all five simulation tests and the expanded real WKWebView/native menu harness.
- The harness checks default/migrated preferences, language persistence with other settings intact, invalid-language fallback, translation coverage, About formatting, menu actions/checkmarks, disabled playback states, localized existing errors, and live canvas accessibility in both languages.
- A language change while paused preserves the frame count, simulation time, and paused state. Switching during playback keeps the simulation advancing and the animation scheduled.
- App compilation and ad hoc signature verification passed. Both localization tables passed `plutil -lint`.
- Internal documentation and installer pages were translated into English; the full Chinese README remains maintained.
- The actual AppKit menu was opened in an isolated preview window. Selecting Simplified Chinese through native menu/keyboard navigation updated the status and all menu groups on the next opening.
- The installer was rebuilt and fully expanded. Its checks confirmed both localization bundles, the English development region, English installer pages, installation location, architecture, and app signature.

Evidence: `build/native-smoke-report.json` and `build/native-preview.png`.

## 2026-11-03: Gentle pointer interaction preview

- Added velocity-sensitive fish avoidance, up to three fading character water marks, and a single nearby shark's brief curiosity after approximately two seconds of stillness. Visits release on movement and do not repeat for a parked pointer.
- The native menu includes a persisted, bilingual interaction toggle. Desktop windows remain click-through and cannot take keyboard focus. Pointer sampling is requested by the existing render loop, without a native polling timer or event tap.
- `bash scripts/test.sh` passed after the final change: all ten simulation tests, the real WKWebView/native harness, app compilation, and ad hoc signature verification.
- New simulation checks cover entry without a splash, velocity-dependent local avoidance, bounded/expiring marks, one visitor, interrupted and expired visits, and hover timing independent of swim speed.
- Native checks cover the persisted toggle and menu action, normalized pointer delivery, negative-origin portrait coordinates, leaving a display, disabling interaction while swimming continues, and zero pointer samples while paused. Coordinate checks use injected positions; physical multiple-display hot-plug behavior remains a target-environment check.
- Playwright checks passed at 1440 × 900, 2560 × 1080, and 768 × 1024, across Classic, Mixed, and Solo. Browser input triggered a visit after about 2.02 seconds; movement released it. Pause, Reduce Motion, disabling interaction, invalid coordinates, water-mark expiry, and resize/scene replacement behaved as expected, with no JavaScript errors.
- Browser testing found an initial ResizeObserver notification clearing freshly received pointer input after scene replacement. The engine now skips unchanged size notifications; the same browser checks passed afterward.
- Both localization tables passed `plutil -lint`; `git diff --check` and the Impeccable detector reported no findings.

Evidence: `output/playwright/check-interaction.js`, `output/playwright/interactive-{water,curiosity,mixed,solo}.png`, `build/native-smoke-report.json`, and `build/native-preview.png`. The local preview app and ZIP were rebuilt. The installed application in `/Applications` was not replaced or restarted.

## 2026-11-03: Faster curiosity and stronger water feedback

- Reduced the stillness threshold from 2 seconds to 0.6 seconds and accelerated the attraction response. Curious sharks turn more readily and briefly swim up to roughly 1.7 times cruise speed to close the gap, easing down near the pointer.
- Increased area-based fish density by about 82% (130 to 236 fish at 1440 × 900), capped at 320 animals. Increased fish ink visibility and the velocity-sensitive interaction radius to a maximum of 240 CSS pixels.
- Increased water marks from three to five, with larger, darker broken-character arcs that fade within 2.2 seconds. The total remains bounded at 90 glyphs.
- `bash scripts/test.sh` passed all eleven simulation tests, the real native WebKit harness, compilation, and app signature verification. A new trajectory check verifies that curiosity closes the gap faster while keeping segment lengths, speed, and turning bounded; subsecond hover timing passes at all three swim speeds.
- Browser checks passed in Classic, Mixed, and Solo at 1440 × 900, 2560 × 1080, and 768 × 1024. The measured hover trigger was 0.60 seconds, with no JavaScript errors. Pause, Reduce Motion, interaction disabling, departure, resize, and mark expiry continued to pass.
- A short 238-frame local sample measured render-callback times of about 1.9 ms median and 3.6 ms P95. This is a local sample, not a long-term power or cross-device performance guarantee.
- The current in-app preview was reloaded and inspected. Both localization tables, the diff whitespace check, and the Impeccable detector passed.

Evidence: `build/interactive-v2-browser-report.json`, `output/playwright/interactive-v2-{water,curiosity,mixed,solo}.png`, and `build/native-smoke-report.json`.

## 2026-11-03: Ripples only on fish contact

- Removed movement-generated cursor trails. A ripple is emitted only when an actual pointer segment passes within 28 CSS pixels of a live small fish, at the contact location. Empty water, inactive/dead fish, and stationary cursors do not emit new marks.
- Bounded swept-segment detection catches fast crossings between native samples. Repeated contacts retain the five-mark limit, spacing/cooldown, and 2.2-second expiry; later encounters at the same location still respond.
- `bash scripts/test.sh` passed thirteen simulation tests, the native WebKit harness, compilation, and signature verification. New checks cover empty water, live versus dead/distant fish, fast crossings, repeat encounters, bounded emission, expiry, and departure.
- Browser checks recorded zero marks during a clear-water sweep and one mark when crossing the seeded fish school, with no JavaScript errors. The 0.6-second hover response, pause, Reduce Motion, interaction toggle, scene changes, and landscape/portrait coordinates still passed.
- `git diff --check` and the Impeccable detector passed. The app and ZIP were rebuilt.

Evidence: `build/interactive-contact-browser-report.json`, `output/playwright/interactive-contact-{empty,fish,curiosity,mixed,solo}.png`, and `build/native-smoke-report.json`.

## 2026-11-03: Sparse schools and restored visual hierarchy

- Reduced the initial small-fish population to 24–64 by viewport area, including 54 at 1440 × 900 instead of 236. Schools contain at most seven fish, use wider spacing and weaker cohesion, and no longer mill into dense bait balls.
- Added persistent school identities, cross-school separation within a species, and small returning groups. Initial groups form loose ribbons with separated centers and consistent depth, preserving open water around the main subjects.
- Softened resting fish ink and limited the stronger emphasis to pointer proximity. Contact-only ripples and the 0.6-second curiosity response remain active.
- Long-run checks exposed a wide corner turn that could take the solo shark out of view with the new prey distribution. Boundary anticipation now smoothly tightens the turning radius near threatened edges while retaining the existing angular-speed limits and articulation.
- `bash scripts/test.sh` passed all fifteen simulation tests, native WebKit/menu checks, compilation, and signature verification. New checks cover bounded group sizes after respawn and greater separation between distinct schools of the same species. The five-minute solo visibility check passed.
- Browser checks passed in Classic, Mixed, and Solo at 1440 × 900, 2560 × 1080, and 768 × 1024. The report recorded 54 fish, zero empty-water marks, one contact mark, and a 0.60-second hover trigger, with no JavaScript errors.
- Inspected the three rendered layouts; `git diff --check` and the Impeccable detector passed. The local app and preview ZIP were rebuilt.

Evidence: `build/quiet-browser-report.json`, `output/playwright/quiet-{classic,empty,contact,curiosity,mixed,solo}.png`, and `build/native-smoke-report.json`.

## 2026-11-03: Species personalities and occasional ocean moments

- Hammerheads favor a horizontal patrol lane; makos make smooth three-second bursts when their projected route is clear; threshers cruise, turn, and beat their tails more slowly. The Mixed scene now includes a thresher alongside hammerhead, tiger, and mako residents, with a localized menu hint.
- At 1× simulation speed, the first ambient opportunity is after 55–85 seconds. Events alternate between guiding an existing small school through the center and one distant, temporary visitor. Completed events leave 90–150 seconds of quiet; pointer play, curiosity, and bursts postpone new events.
- School crossings preserve the fish budget. Visitors use absent species where possible, do not interact with foreground predators/pointer input, and fade with pale ink before cleanup. They use the same articulated spine without allocating persistent wake entries. Resize preserves their geometry and adjusts remaining travel time.
- `bash scripts/test.sh` passed twenty simulation tests, real WKWebView/menu checks, compilation, and app signature verification. New checks cover horizontal patrol, slower thresher turns/tail rhythm, brief separated mako bursts and recovery, fifteen simulated minutes of bounded event lifecycles, visitor resizing/removal, and deferral during pointer play.
- In a separate ten-minute Mixed simulation, the scene was never completely empty; resident identities and the sparse fish budget were preserved. Individual animals can briefly swim beyond an edge during turns.
- Playwright verified the production `?scene=mixed` preview contains all requested species, and that pause freezes simulation and ambient counters. Separate rendering fixtures used the real World and AsciiRenderer to advance to a center crossing and a visible distant visitor. Both captures preserved four residents and 54 small fish, with no JavaScript errors.
- The inspected Mixed, crossing, and visitor captures retained the warm paper, open composition, and character-based silhouettes. Updated the Mixed README image and both language descriptions.
- Both localization tables passed `plutil -lint`; `git diff --check` and the Impeccable detector passed. The local app and preview ZIP were rebuilt.

Evidence: `build/personality-browser-report.json`, `output/playwright/personality-mixed.png`, `output/playwright/moment-{crossing,visitor}.png`, and `build/native-smoke-report.json`. The event render fixture lives under ignored build/output directories and is not included in the application.

## 2026-11-03: 0.1.2 release preparation

- Prepared version 0.1.2 with bundle build number 3, a changelog, bilingual release notes, and a documented local release command.
- An independent pre-release review found two issues: a paused canvas could retain old pointer marks, and reused build directories could carry stale resources into a new app. Both were fixed and the review passed on recheck.
- The native harness now verifies that pausing paints exactly one clean static frame without advancing simulation time. All twenty simulation tests and the native WebKit/menu harness passed.
- App and icon assembly now use empty staging directories. A build with harmless sentinel files planted in the old Web cache and old app bundle confirmed that neither file entered the rebuilt signed app or ZIP.
- Negative checks confirmed that local release assembly rejects a dirty source tree and that the app build rejects mismatched manifest/plist versions.
- Rebuilt the arm64 ZIP and PKG as 0.1.2; package expansion, payload, localization, and signature checks passed.
- Regenerated the README's MP4/GIF from the current sparse ocean and refreshed scene previews. Shared-memory capture on the tested installed Chrome corrupted the first two MP4 frames; ordinary PNG frame capture resolved it. The frame check then passed all 300 MP4 frames and 150 GIF frames with no missing Dock frames.
- The post-commit release command records the exact commit/tree, toolchain, signing status, artifact hashes, and fresh verification results in `dist/releases/0.1.2/release.json`.
