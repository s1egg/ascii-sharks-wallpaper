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

## Personalities and occasional moments

Use behavior, not badges or new colors, to make animals recognizable. Hammerheads favor a stable horizontal patrol with broad returns at the edges. Makos make a smooth three-second burst only when the projected path has room, with roughly 34–58 simulation seconds between opportunities. Burst and hunting speed boosts must not stack. Threshers cruise slightly slower, turn more gradually, and carry a longer, slower tail rhythm. Boundary steering and anatomy take priority. The Mixed scene contains hammerhead, tiger, mako, and thresher residents.

Occasional moments use the existing simulation clock and animation loop. At 1×, the first opportunity comes after 55–85 seconds; each completed moment is followed by 90–150 seconds of quiet. Alternate a small school crossing and a rare distant visitor. Delay new moments during active pointer play, curiosity, or a mako burst. A school crossing guides an existing group of at most seven fish through the open center without spawning more fish or teleporting them. It releases the group after crossing or at a seventy-second limit.

At most one temporary visitor swims behind the residents, choosing an absent species where possible. It enters and leaves beyond the edges, with pale ink and a gentle presence envelope. Visitors do not hunt, startle the foreground fish, accept pointer curiosity, or produce cached wakes. Keep resident count and identity intact. Resize preserves the visitor's proportions and adjusts its remaining route; pause, hiding, and Reduce Motion stop moment progress along with the simulation. No banners, sounds, scorekeeping, or extra timers.

## Gentle pointer interaction

Movement parts nearby fish with a velocity-sensitive field reaching up to 240 CSS pixels. Empty-water movement and entering a display must not cause a splash. Emit water marks only where a moving pointer passes within 28 CSS pixels of a live small fish; test the swept path between samples so fast crossings still register. These are contact marks, not a cursor trail. At most five broken character water marks (90 glyphs total) coexist and fade within 2.2 real seconds. Use the existing glyph atlas and enough ink to make the response visible on warm paper.

Small fish are sparse supporting strokes, not a patterned background. The initial population scales with area from 24 to 64 animals (54 at 1440 × 900). Groups contain at most seven fish with about twice the former spacing, weaker cohesion, and no milling into bait balls. Persistent school identities keep nearby groups from merging by species; returning fish form new small groups. Seed loose, irregular ribbons around open water, with a consistent depth within each group. Keep their resting ink below the sharks; proximity to the pointer adds local emphasis instead of darkening every fish. Boundary anticipation may tighten a shark's turning radius smoothly to retain the composition near corners.

After about 0.6 real seconds of stillness, one nearby shark in a suitable heading may approach and pass alongside the pointer. The animal notices promptly, turns more readily, and briefly accelerates up to roughly 1.7 times its cruise speed while closing the gap, easing down beside the pointer. Preserve articulation, boundary steering, and bounded turn rates. A visit lasts at most twelve seconds plus a short release; a parked cursor never triggers repeated circling. Movement or departure releases the attraction smoothly. Hover timing is independent of swim speed.

Gentle Mouse Interaction is enabled by default and can be disabled in the native menu. Sample screen coordinates only when the existing render loop requests them, at most ten times per second per display, with one outstanding request. Do not add a native polling timer, event tap, click handler, or permission requirement. Keep window click-through and keyboard behavior intact. Normalize each screen's coordinates, exclude the menu bar and Dock areas, and clear interaction on pause, resize, hiding, reduced motion, scene replacement, or disabling the feature. Browser previews use the same normalized input path.

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
