# Third-Party Notices

This application is based on [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks).

- Pinned upstream revision: `a0074c16a106f0abc665fe9712ca445f8f98ad8e` (2026-10-24).
- `Web/src/renderer.ts`, `world.ts`, `math.ts`, and `species.ts` are derived from upstream source. Shark shape parameters were extracted into `shapes.ts`.
- The local ink-wash ASCII adaptation retains the character grid and spine sampling while changing grayscale shading, silhouettes, fish schools, and cruising behavior. `motion.ts` adds stable heads and shoulders with a tail-driven propulsion wave.
- `Web/src/engine.ts` rewrites the upstream animation loop to support pause, frame-rate limits, swim speed, and render-scale control.
- Font loading uses local macOS Menlo / Monaco instead of accessing Google Fonts.
- The native macOS container, localization resources, menu, and build scripts were added by this project.
- Qi Baishi's aquatic paintings informed the treatment of tonal variation, soft edges, and open space. The app does not include those paintings or the user's reference screenshots.

The original upstream license follows.

```text
MIT License

Copyright (c) 2026 drewdi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
