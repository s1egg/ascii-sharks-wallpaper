# README desktop demo

A ten-second, cursor-free Remotion composition for the repository's English and Simplified Chinese READMEs. The ocean uses the application's actual `World` and `AsciiRenderer`; the menu bar and small Dock are illustrative desktop chrome, not a screen recording. The composition contains no promotional text, so both README languages can share the same media.

The simulation advances at a fixed 60 Hz, with seeded randomness and a 30 FPS output. Each canvas owns its own random state and replays on backward seeks. A 24-frame opacity crossfade joins the end to the opening motion. There is no wall-clock animation or pointer capture.

## Render on macOS

From this directory:

```sh
bun install --frozen-lockfile
bun run prepare-assets
bun run render
bun run gif
bun run still
```

If you prefer an installed Chromium browser to Remotion's managed browser, append `--browser-executable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` to the render or still command.

The preparation script extracts Finder, Safari, Notes, and Terminal icons from this Mac. Generated icons stay in the ignored `public/` directory. They are used only as desktop context in the rendered media. The wallpaper app is not shown in the Dock, matching its menu-bar-only behavior.

The video is written to `docs/assets/macos-desktop.mp4`, the source GIF to `output/readme/remotion-desktop-source.gif`, and the still preview to `output/readme/remotion-desktop.png`. Both exports use PNG source frames and disable shared-memory capture: the tested installed Chrome produced tiled, corrupted opening frames through that fast capture path. The GIF does not re-encode the H.264 video. Optimize it for the README with Gifsicle:

```sh
gifsicle -O3 --colors=96 --color-method=diversity \
  ../../output/readme/remotion-desktop-source.gif \
  -o ../../docs/assets/macos-desktop.gif
```

Remotion and React are development dependencies of this isolated media package. They do not participate in the macOS app build, installation, or runtime.

## Verify every exported frame

With a full FFmpeg executable installed (or its path in `FFMPEG_BIN`), run:

```sh
bun run check
```

The regression check decodes every MP4 and GIF frame. It detects disappearing Dock icons and abrupt brightness changes in the fixed Dock region. A live `backdrop-filter` on the transformed Dock caused whole-layer dropouts in headless Chrome, in both video and GIF exports. The composition uses translucent paint for this element instead. Remotion's bundled FFmpeg has a restricted set of formats, so the check needs a full FFmpeg build with the rawvideo muxer.
