# Ink-Wash ASCII Sharks

## Visual intent

Look down through the water at sharks below the surface. Preserve the character-based identity of stackedlol/ascii-sharks, taking inspiration from the tonal variation, soft boundaries, and open space in Qi Baishi's aquatic paintings. The scene is a quiet desktop background; controls belong in the menu bar.

The intended result is ASCII with the restraint of Chinese ink painting. Do not reintroduce solid fish bodies, continuously shaded vector sharks, or image-textured animals. Avoid decorative calligraphy and seals as shortcuts to an Eastern aesthetic.

## Palette and characters

- Warm paper: `#eee9df`, shared by the native window, webpage, and canvas. Avoid pure screen white and yellowed antique-paper filters.
- Main ink: `#3e4943`, a gray with a hint of moss. Use opacity and character density to distinguish stronger and diluted ink.
- Pale celadon: `#a8b8ac`, gathered lightly toward the lower right. A little clay `#b8a58c` sits near the upper left; paper white `#faf6ed` opens the area above center. Keep the warm and cool washes asymmetric, with generous quiet space.
- Web colors come from the `--water-*` variables in `Web/wallpaper.css`. Match the native startup background to the paper color.
- Use `. , : ; i t x % S X 8 # @` for tonal density; fin edges stay lighter and backs carry more ink.
- Characters remain upright, monospaced, and legible. Avoid black grids, colored flicker, and opaque square tiles.
- Nearby sharks carry more ink. Distant sharks fade but retain recognizable silhouettes. Keep the water mostly open, with only cached paper fibers and sparse character wakes.
- Preserve each species' shape and markings; do not distinguish species through bright colors.

## Motion

The snout stays steady, the shoulders deform slightly, and wave amplitude increases toward the tail. Both the steering spine and the painted spine preserve segment lengths so swimming never stretches the body. Pectoral fins tilt gently into turns and open slightly during glides.

Each shark moves independently through a roughly half-minute stroke-and-glide cycle. Tail effort changes smoothly; forward speed follows more slowly to convey inertia. Small fast species and long-tailed species retain distinct rhythms. Avoid timed stops, synchronized groups, and whole-body breathing scales.

Default cruising is approximately half the original upstream pace; hunting adds only a mild acceleration. Anticipate turns and constrain out-of-bounds positions so the solo scene does not remain empty. Start from an irregular, spacious composition and let schools pass through naturally.

Character selection does not follow a random clock. Ink levels have hysteresis, and glyph transitions crossfade over 180 ms. Continuous edge coverage and short opacity smoothing soften silhouettes; ink fades out slightly more slowly than it appears. Wakes spread gently along the tail direction, diminish during gliding, disappear within 6.5 seconds, and never exceed 64 characters. Cache the paper and glyphs. Keep the existing Canvas renderer, fixed simulation step, and single animation loop without adding animation dependencies.

Respect pause, hidden state, Reduce Motion, Low Power Mode, and thermal policies. The 15 / 30 / 60 FPS settings limit scheduling; they do not alter simulation speed.

## Native menu and language

Use standard AppKit menus, system typography, checkmarks, separators, and SF Symbols. Let macOS provide appearance, keyboard navigation, hover, and accessibility behavior.

Group controls by purpose: current status; playback and visibility; scene, frame rate, and speed; displays and language; recovery and app information; quit. Describe the effective state, including system suspension, reduced motion, and power-saving limits. Disable playback controls when animation cannot run, and explain the reason in the item tooltip.

English is the default, including upgrades with existing preferences but no stored language. Offer English and Simplified Chinese using their native names. A language change takes effect without restarting and preserves the scene, simulation time, playback preference, display coverage, speed, and frame-rate preference. Rebuild menus before tracking starts, rather than mutating an open menu.

Keep source-code comments and internal documentation in English. Maintain translated user-facing strings separately. See [localization maintenance](docs/LOCALIZATION.md).

## References

- Original implementation: [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks).
- User-provided screenshots of white and pale-gray ASCII sharks.
- Qi Baishi's fish-and-shrimp painting: [Christie's artwork page](https://www.christies.com/en/lot/lot-5715668).
- Beijing Fine Art Academy exhibition on Qi Baishi's aquatic subjects: [exhibition page](https://www.bjaa.com.cn/exhibit.html?clg=163&exhibit=122&hcs=11).

The paintings are aesthetic references, not bundled assets.
