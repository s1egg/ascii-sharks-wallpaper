import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BLEND_FRAMES, DURATION, HEIGHT, OceanFrames, WIDTH } from "./ocean";
import "../../../Web/wallpaper.css";

function Ocean({ frame, opacity = 1 }: { frame: number; opacity?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ocean = useRef<OceanFrames | null>(null);
  useLayoutEffect(() => {
    if (!canvas.current) return;
    if (!ocean.current || frame < ocean.current.frame) {
      ocean.current = new OceanFrames(canvas.current);
    }
    ocean.current.draw(frame);
  }, [frame]);
  return <canvas ref={canvas} width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0, opacity }} />;
}

const StatusIcons = () => <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
  <svg width="23" height="20" viewBox="0 0 28 24" fill="none" aria-label="Wallpaper menu">
    <path d="M20 8c-4-5-11-4-15 3 4 7 11 8 15 3l6 4V4l-6 4Z" fill="currentColor" />
    <circle cx="9" cy="10" r="1" fill="#eee9df" />
  </svg>
  <svg width="20" height="18" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-label="Wi-Fi">
    <path d="M2 5a16 16 0 0 1 20 0M5.5 9a10.5 10.5 0 0 1 13 0M9 13a5 5 0 0 1 6 0" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
  <svg width="28" height="17" viewBox="0 0 30 18" fill="none" stroke="currentColor" strokeWidth="1.2" aria-label="Battery">
    <rect x="1" y="2" width="25" height="14" rx="3" /><rect x="3.5" y="4.5" width="20" height="9" rx="1" fill="currentColor" stroke="none" /><path d="M28 6v6" strokeWidth="2" />
  </svg>
  <span style={{ fontVariantNumeric: "tabular-nums" }}>Tue 9:41</span>
</div>;

const MenuBar = () => <div style={{
  position: "absolute", top: 0, left: 0, right: 0, height: 34,
  background: "rgba(247,244,236,0.62)", backdropFilter: "blur(18px)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "0 24px", color: "#30332f", fontSize: 15, letterSpacing: -0.12,
}}>
  <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
    <span style={{ fontSize: 23, lineHeight: 1 }}></span>
    <strong style={{ fontWeight: 650 }}>Finder</strong>
    {["File", "Edit", "View", "Go", "Window", "Help"].map(label => <span key={label}>{label}</span>)}
  </div>
  <StatusIcons />
</div>;

function Trash() {
  return <svg width="49" height="60" viewBox="0 0 49 60" fill="none" aria-label="Trash">
    <defs><linearGradient id="bin" x1="8" y1="16" x2="43" y2="54" gradientUnits="userSpaceOnUse"><stop stopColor="#f8faf8" /><stop offset="1" stopColor="#b9c2c0" /></linearGradient></defs>
    <path d="M9 13h32l-4 40c-.2 3-25 3-25 0L9 13Z" fill="url(#bin)" stroke="#9aa4a0" />
    <ellipse cx="25" cy="13" rx="17" ry="5" fill="#ccd2cd" stroke="#8f9994" />
    <ellipse cx="25" cy="13" rx="13" ry="2.5" fill="#727e77" />
    {[17,24,31].map(x => <path key={x} d={`M${x} 22v25`} stroke="#a8b2ac" strokeWidth="1.5" opacity="0.7" />)}
  </svg>;
}

// A live backdrop-filter can drop this entire layer in headless Chrome captures.
// Translucent paint keeps the desktop appearance without the unstable filter.
const Dock = () => <div style={{
  position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
  display: "flex", alignItems: "center", gap: 12, padding: "10px 15px 13px",
  borderRadius: 23, background: "rgba(239,239,230,0.64)",
  border: "1px solid rgba(255,255,255,0.78)",
  boxShadow: "0 8px 28px rgba(53,64,55,0.12), inset 0 0 0 1px rgba(120,130,116,0.08)",
}}>
  {["finder", "safari", "notes", "terminal"].map(name => <div key={name} style={{ position: "relative", width: 61, height: 61 }}>
    <Img src={staticFile(`icons/${name}.png`)} style={{ width: 61, height: 61 }} />
    {name === "finder" ? <span style={{ position: "absolute", bottom: -7, left: 29, width: 3, height: 3, borderRadius: "50%", background: "#556052" }} /> : null}
  </div>)}
  <span style={{ height: 49, width: 1, background: "rgba(90,104,89,0.24)", margin: "0 2px" }} />
  <div style={{ width: 57, height: 61, display: "flex", alignItems: "center", justifyContent: "center" }}><Trash /></div>
</div>;

export const Desktop = () => {
  const frame = useCurrentFrame();
  const blendStart = DURATION - BLEND_FRAMES;
  const blend = interpolate(frame, [blendStart, DURATION - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#eee9df", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", cursor: "none" }}>
    <Ocean frame={frame + BLEND_FRAMES} />
    {/* Crossfade the final 0.8 seconds into the preceding opening frames. */}
    <Ocean frame={Math.max(0, frame - blendStart)} opacity={blend} />
    <MenuBar />
    <Dock />
  </AbsoluteFill>;
};
