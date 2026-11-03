# ASCII Sharks Wallpaper App Icon

`AppIcon.png` is the 1024 × 1024 RGBA source image: transparent outer margins, a soft white rounded-square background, and a dark gray ASCII shark.

The artwork was generated with the built-in `image_gen` tool. macOS `sips` creates the standard sizes, and `iconutil` packages them as ICNS. The final icon ships at `Contents/Resources/AppIcon.icns` and is referenced by `CFBundleIconFile`. Run `bash scripts/build-icon.sh` to regenerate it; the normal app build already includes that step.

The original files from both generation rounds are archived locally in `.skill-archive/logo-creator/2026-11-03-ascii-sharks-wallpaper/`. Transparent edges were inspected after the first round, and the second round cleaned the outer margins. Small previews were also checked on light and dark backgrounds.

## Generation prompts

The following are English translations of the original prompts.

**First round:** Create a refined macOS icon for ASCII Sharks Wallpaper. Use a square image with transparent outer margins, a soft white rounded-square plate, and a very faint celadon-gray wash at the bottom. The subject is a shark seen from above, swimming from a tail at the lower left toward a head at the upper right. Build the silhouette entirely from densely arranged monospaced ASCII characters `@ # 8 S X % x : ; .`, in ink color `#304643`. Give it a streamlined body, two swept-back pectoral fins, a narrow caudal peduncle, and an asymmetric forked tail. Keep the back dark and the edges and fins lighter, with a clear silhouette at small sizes. Do not add a realistic solid shark, title text, seals, badges, ocean scenery, additional fish, or neon colors.

**Second round:** Preserve the shark, rounded plate, colors, character texture, and composition. Remove stray dots, colored fringes, and residual background outside the plate. Keep the corners and margins truly transparent, leaving only smooth antialiased boundaries.

## Other artwork

`Backdrop/` contains optional paper backgrounds exported from the app's Canvas renderer. Selecting one as the macOS system wallpaper is a manual preference change; quitting the app does not restore a previously selected image.

README images live in `docs/assets/`. Scene screenshots and the animated preview show the application's actual renderer; both README translations share those files.
