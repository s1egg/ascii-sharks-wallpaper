import { resolve } from "node:path";

const ffmpeg = process.env.FFMPEG_BIN ?? Bun.which("ffmpeg");
if (!ffmpeg) throw new Error("Install FFmpeg or set FFMPEG_BIN to a full FFmpeg executable.");
const assets = resolve(import.meta.dir, "../../../docs/assets");
const inputs = process.argv.slice(2);
const files = inputs.length ? inputs.map(file => resolve(file)) : [resolve(assets, "macos-desktop.mp4"), resolve(assets, "macos-desktop.gif")];
const width = 420;
const height = 110;
const frameSize = width * height;
let failed = false;

for (const file of files) {
  // Normalize both exports, then examine every frame around the fixed Dock.
  const result = Bun.spawnSync([
    ffmpeg, "-v", "error", "-i", file,
    "-vf", "scale=1600:1000:flags=neighbor,crop=420:110:590:885",
    "-pix_fmt", "gray", "-f", "rawvideo", "-",
  ], { maxBuffer: 64 * 1024 * 1024 });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  const frames = Math.floor(result.stdout.length / frameSize);
  if (frames < 2 || result.stdout.length % frameSize) throw new Error(`Invalid decoded frames: ${file}`);

  let maxChange = 0;
  let maxTerminalBrightness = 0;
  const badFrames: number[] = [];
  for (let frame = 0; frame < frames; frame++) {
    const offset = frame * frameSize;
    let terminalBrightness = 0;
    // Terminal's dark icon must be present even when fish swim behind the Dock.
    for (let y = 40; y < 70; y++) {
      for (let x = 260; x < 290; x++) terminalBrightness += result.stdout[offset + y * width + x];
    }
    terminalBrightness /= 900;
    maxTerminalBrightness = Math.max(maxTerminalBrightness, terminalBrightness);

    let change = 0;
    if (frame) {
      for (let pixel = 0; pixel < frameSize; pixel++) {
        change += Math.abs(result.stdout[offset + pixel] - result.stdout[offset - frameSize + pixel]);
      }
      change /= frameSize;
      maxChange = Math.max(maxChange, change);
    }
    if (terminalBrightness > 100 || change > 3) badFrames.push(frame);
  }
  const passed = badFrames.length === 0;
  console.log(JSON.stringify({ file, frames, passed, maxDockChange: +maxChange.toFixed(3), maxTerminalBrightness: +maxTerminalBrightness.toFixed(3), badFrames: badFrames.slice(0, 12), badFrameCount: badFrames.length }));
  failed ||= !passed;
}

if (failed) process.exit(1);
