import { OceanEngine, type EngineOptions } from "./engine";
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
    };
    webkit?: { messageHandlers?: { wallpaper?: { postMessage: (body: unknown) => void } } };
  }
}

function report(event: string, message = "") {
  window.webkit?.messageHandlers?.wallpaper?.postMessage({ event, message });
}
window.addEventListener("error", (event) => report("error", event.message));
window.addEventListener("unhandledrejection", (event) => report("error", String(event.reason)));

let configuration: Configuration = { paused: false, frameRate: 30, speed: 1, pixelRatio: 1.5, scene: "classic", language: "en" };
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
    { kind: "mako", size: 0.77 }, { kind: "zebra", size: 0.7 },
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
    scene: value.scene && Object.hasOwn(scenes, value.scene) ? value.scene : configuration.scene,
    language: value.language && Object.hasOwn(descriptions, value.language) ? value.language : configuration.language,
  };
  document.documentElement.lang = configuration.language;
  canvas!.setAttribute("aria-label", descriptions[configuration.language]);
}
merge(window.initialWallpaperSettings ?? {});
let engine = new OceanEngine(canvas, scenes[configuration.scene], configuration);
window.wallpaper = {
  configure(value) {
    const previous = configuration;
    merge(value);
    if (previous.scene !== configuration.scene) {
      engine.destroy();
      engine = new OceanEngine(canvas, scenes[configuration.scene], configuration);
    } else if (previous.paused !== configuration.paused || previous.frameRate !== configuration.frameRate
      || previous.speed !== configuration.speed || previous.pixelRatio !== configuration.pixelRatio) {
      engine.configure(configuration);
    }
  },
  stats: () => ({ ...engine.stats(), scene: configuration.scene, language: configuration.language }),
};
window.addEventListener("pagehide", () => engine.destroy(), { once: true });
report("ready");
