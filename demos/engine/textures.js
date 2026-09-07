/*!
 * Textures drawn in code. No image files anywhere in the engine: a soft
 * disc covers glows, shadows, dust and light pools; a vertical gradient
 * covers skies; a cached canvas covers world-space text.
 */
import * as THREE from "./three.js";

/** A radial gradient disc. `stops` is [[offset, cssColor], ...] from centre out. */
export function softDisc(stops, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A top-to-bottom gradient, 4px wide: a scene background. `stops` is [[offset, cssColor], ...]. */
export function verticalGradient(stops, height = 256) {
  const c = document.createElement("canvas");
  c.width = 4; c.height = height;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, height);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Tileable value noise, for a surface that has to read as *ground* rather
 * than as paint: layered random dots blurred against each other, wrapped so
 * the tile repeats seamlessly. Cheap, and it survives being stretched over
 * a plane the size of a landscape because the eye only ever reads it as
 * grain.
 */
export function noiseTexture({ size = 256, base = "#8f8c85", light = "rgba(255,255,255,0.16)", dark = "rgba(0,0,0,0.26)", specks = 2600, repeat = 1 } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < specks; i++) {
    const r = 0.4 + Math.random() * Math.random() * 3.4;   // biased small: mostly grain, a few larger patches
    const x = Math.random() * size, y = Math.random() * size;
    g.fillStyle = Math.random() < 0.5 ? light : dark;
    // drawn four times, offset by a tile, so a blob over the seam wraps
    for (const [dx, dy] of [[0, 0], [size, 0], [0, size], [size, size]]) {
      g.beginPath();
      g.arc(x - dx, y - dy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

/** The white-to-nothing disc every glow, spark and light pool in the engine is built from. */
export const GLOW_STOPS = [[0, "rgba(255,255,255,1)"], [0.5, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]];
/** The black-to-nothing disc a contact shadow is built from. */
export const SHADOW_STOPS = [[0, "rgba(0,0,0,1)"], [0.45, "rgba(0,0,0,0.55)"], [1, "rgba(0,0,0,0)"]];

/**
 * Text on a canvas, cached by string+colour. A fight spends most of its
 * popups on the same handful of strings ("+100", "BUSTED", a multiplier),
 * so there is no reason to redraw a canvas per one.
 */
export const TEXT_CANVAS_W = 256, TEXT_CANVAS_H = 96;
const textCache = new Map();
export function textTexture(text, color) {
  const key = text + "|" + color;
  let tex = textCache.get(key);
  if (tex) return tex;
  const c = document.createElement("canvas");
  c.width = TEXT_CANVAS_W; c.height = TEXT_CANVAS_H;
  const g = c.getContext("2d");
  g.font = "700 42px ui-monospace, Menlo, Consolas, monospace";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 8; g.strokeStyle = "rgba(7,9,14,0.9)";
  g.strokeText(text, c.width / 2, c.height / 2);
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textCache.set(key, tex);
  return tex;
}
