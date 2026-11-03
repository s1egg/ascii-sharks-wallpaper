import { OceanEngine, type EngineOptions, type PointerInput } from "./engine";
import type { SharkSpec } from "./world";

type Scene = "classic" | "mixed" | "solo";
type Language = "en" | "zh-Hans";
type Configuration = EngineOptions & { scene: Scene; language: Language };

declare global {
  interface Window {
    initialWallpaperSettings?: Partial<Configuration>;
    wallpaper: {
      configure: (value: Partial<Configuration>) => void;
      stats: () => ReturnType<OceanEngine["stats"]> & { scene: Scene; language: Language };
      pointer: (input: PointerInput) => void;
    };
    webkit?: { messageHandlers?: { wallpaper?: { postMessage: (body: unknown) => void } } };
  }
}

function report(event: string, message = "") {
  window.webkit?.messageHandlers?.wallpaper?.postMessage({ event, message });
}
window.addEventListener("error", (event) => report("error", event.message));
window.addEventListener("unhandledrejection", (event) => report("error", String(event.reason)));

let configuration: Configuration = { paused: false, frameRate: 30, speed: 1, pixelRatio: 1.5, interaction: true, scene: "classic", language: "en" };
const canvas = document.querySelector<HTMLCanvasElement>("canvas");
if (!canvas) throw new Error("Wallpaper canvas is missing");
const descriptions: Record<Language, string> = {
  en: "Animated ASCII sharks and schools of fish drifting through warm paper and pale celadon water.",
  "zh-Hans": "水墨 ASCII 鲨群动态壁纸：暖灰宣纸与淡青水色间，浓淡字符构成的鲨鱼和鱼群缓缓游动。",
};
const scenes: Record<Scene, SharkSpec[] | undefined> = {
  classic: undefined,
  mixed: [
    { kind: "hammerhead", size: 1 }, { kind: "tiger", size: 0.84 },
    { kind: "mako", size: 0.77 }, { kind: "thresher", size: 0.7 },
  ],
  solo: [{ kind: "classic", size: 1 }],
};

function bounded(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function merge(value: Partial<Configuration>) {
  configuration = {
    paused: typeof value.paused === "boolean" ? value.paused : configuration.paused,
    frameRate: bounded(value.frameRate, configuration.frameRate, 10, 60),
    speed: bounded(value.speed, configuration.speed, 0.25, 2),
    pixelRatio: bounded(value.pixelRatio, configuration.pixelRatio, 1, 2),
    interaction: typeof value.interaction === "boolean" ? value.interaction : configuration.interaction,
    scene: value.scene && Object.hasOwn(scenes, value.scene) ? value.scene : configuration.scene,
    language: value.language && Object.hasOwn(descriptions, value.language) ? value.language : configuration.language,
  };
  document.documentElement.lang = configuration.language;
  canvas!.setAttribute("aria-label", descriptions[configuration.language]);
}
merge(window.initialWallpaperSettings ?? {});
// Share a browser scene preview without changing the native saved preference.
if (!window.webkit?.messageHandlers?.wallpaper) {
  const scene = new URLSearchParams(location.search).get("scene");
  if (scene && Object.hasOwn(scenes, scene)) merge({ scene: scene as Scene });
}
const nativePointer = window.webkit?.messageHandlers?.wallpaper
  ? (id: number) => report("pointer", String(id)) : undefined;
let engine = new OceanEngine(canvas, scenes[configuration.scene], configuration, nativePointer);
window.wallpaper = {
  pointer: (input) => engine.pointer(input),
  configure(value) {
    const previous = configuration;
    merge(value);
    if (previous.scene !== configuration.scene) {
      engine.destroy();
      engine = new OceanEngine(canvas, scenes[configuration.scene], configuration, nativePointer);
    } else if (previous.paused !== configuration.paused || previous.frameRate !== configuration.frameRate
      || previous.speed !== configuration.speed || previous.pixelRatio !== configuration.pixelRatio
      || previous.interaction !== configuration.interaction) {
      engine.configure(configuration);
    }
  },
  stats: () => ({ ...engine.stats(), scene: configuration.scene, language: configuration.language }),
};
// Browser previews use the same input path as native screen-coordinate samples.
if (!nativePointer) {
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const rect = canvas.getBoundingClientRect();
    engine.pointer({ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, active: true });
  });
  const leave = () => engine.pointer({ x: 0, y: 0, active: false });
  canvas.addEventListener("pointerleave", leave);
  window.addEventListener("blur", leave);
}
window.addEventListener("pagehide", () => engine.destroy(), { once: true });
report("ready");
