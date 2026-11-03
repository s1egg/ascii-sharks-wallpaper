import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const destination = resolve(root, "public/icons");
mkdirSync(destination, { recursive: true });

// Extract local macOS icons for the illustrative desktop; do not commit them.
const icons = {
  finder: "/System/Library/CoreServices/Finder.app/Contents/Resources/Finder.icns",
  safari: "/Applications/Safari.app/Contents/Resources/AppIcon.icns",
  notes: "/System/Applications/Notes.app/Contents/Resources/AppIcon.icns",
  terminal: "/System/Applications/Utilities/Terminal.app/Contents/Resources/Terminal.icns",
};

for (const [name, source] of Object.entries(icons)) {
  const result = Bun.spawnSync([
    "/usr/bin/sips", "-s", "format", "png", "-z", "128", "128",
    source, "--out", resolve(destination, `${name}.png`),
  ]);
  if (result.exitCode !== 0) throw new Error(`Could not extract ${name}: ${result.stderr}`);
}
console.log("Prepared desktop icons from this Mac.");
