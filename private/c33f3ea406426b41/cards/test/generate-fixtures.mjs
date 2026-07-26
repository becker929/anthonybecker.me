// Dev-only utility: (re)generates the placeholder PNG fixtures used by the
// renderer test harness. Not part of the served app; requires `playwright`
// resolvable from this directory (e.g. `npm install playwright` locally, or
// a global install on PATH/NODE_PATH). Run manually with
// `node generate-fixtures.mjs` whenever the fixture set needs to change.
//
// Gunmetal sci-fi frame (template v4): a title bar + a chamfered stats bar
// share a top zone with a circular gem socket; a big portrait window sits
// below at a fixed 3:4 ratio (matching PORTRAIT_ASPECT_RATIO in
// src/gemini.js — widening it would stretch every generated portrait); a
// thin divider separates the portrait from a light flavor-text panel with
// a chamfered tab in its bottom-right corner.
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "fixtures");

async function save(page, outFile) {
  const dataUrl = await page.evaluate(() => document.getElementById("c").toDataURL("image/png"));
  const base64 = dataUrl.split(",")[1];
  await writeFile(path.join(outDir, outFile), Buffer.from(base64, "base64"));
  console.log(`wrote ${outFile}`);
}

async function withCanvas(page, w, h, draw, extra) {
  await page.setContent(`<canvas id="c" width="${w}" height="${h}"></canvas>`);
  await page.evaluate(draw, [{ w, h }, extra, helpers]);
}

const browser = await chromium.launch();
const page = await browser.newPage();

// Shared helpers, redefined inside each page.evaluate below (no closures
// cross the Playwright boundary) — kept as a string of source so every
// draw callback can splice it in without duplicating logic by hand.
const helpers = `
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // Rounded rect with one corner cut on a diagonal (the "chamfer" look).
  // corner: "tr" (top-right) or "tl" (top-left).
  function chamferRectPath(ctx, x, y, w, h, r, cut, corner) {
    ctx.beginPath();
    if (corner === "tr") {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - cut, y);
      ctx.lineTo(x + w, y + cut);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
    } else {
      ctx.moveTo(x + cut, y);
      ctx.lineTo(x, y + cut);
      ctx.lineTo(x, y + h - r);
      ctx.arcTo(x, y + h, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x + w, y, r);
      ctx.arcTo(x + w, y, x, y, r);
      ctx.lineTo(x + cut, y);
    }
    ctx.closePath();
  }
`;

// frame_bg.png — full-canvas background plate: a rounded card body (flat
// gunmetal gradient "card stock"), transparent outside the rounded rect so
// the page's dark background reads as the card's silhouette.
await withCanvas(page, 750, 1050, ([{ w, h }, , helpers]) => {
  eval(helpers);
  const ctx = document.getElementById("c").getContext("2d");
  ctx.clearRect(0, 0, w, h);
  roundRectPath(ctx, 0, 0, w, h, 44);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#34363c");
  g.addColorStop(1, "#1a1b1f");
  ctx.fillStyle = g;
  ctx.fill();
});
await save(page, "frame_bg.png");

// frame_over.png — mostly transparent; paints every frame detail on top of
// the portrait (already drawn beneath this layer): the metal border ring,
// the title/stats bars, the gem socket ring (with a transparent hole so the
// gem layer shows through), the portrait's bevel ring, the divider, the
// flavor panel, and its bottom-right tab.
const RECTS = {
  border: { x: 16, y: 16, w: 718, h: 1018, r: 40 },
  title: { x: 40, y: 40, w: 520, h: 58, r: 10 },
  stats: { x: 40, y: 106, w: 430, h: 84, r: 10, cut: 26 },
  gem: { cx: 640, cy: 115, ringR: 68, holeR: 60 },
  portrait: { x: 145, y: 200, w: 460, h: 614 },
  portraitRing: { x: 139, y: 194, w: 472, h: 626, r: 18 },
  divider: { x: 40, y: 824, w: 670, h: 28, r: 6 },
  flavor: { x: 50, y: 862, w: 650, h: 136, r: 14 },
  tab: { x: 568, y: 928, w: 120, h: 58, r: 8, cut: 18 },
};

await withCanvas(page, 750, 1050, ([{ w, h }, rects, helpers]) => {
  eval(helpers);
  const ctx = document.getElementById("c").getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const METAL = "#8a8d93";
  const DARK = "#141517";

  // Outer border bevel ring.
  roundRectPath(ctx, rects.border.x, rects.border.y, rects.border.w, rects.border.h, rects.border.r);
  ctx.strokeStyle = METAL;
  ctx.lineWidth = 14;
  ctx.stroke();

  // Title bar.
  roundRectPath(ctx, rects.title.x, rects.title.y, rects.title.w, rects.title.h, rects.title.r);
  ctx.fillStyle = DARK;
  ctx.fill();

  // Stats bar, chamfered top-right corner.
  chamferRectPath(ctx, rects.stats.x, rects.stats.y, rects.stats.w, rects.stats.h, rects.stats.r, rects.stats.cut, "tr");
  ctx.fillStyle = DARK;
  ctx.fill();

  // Gem socket: dark ring with a transparent hole for the gem layer.
  ctx.beginPath();
  ctx.arc(rects.gem.cx, rects.gem.cy, rects.gem.ringR, 0, Math.PI * 2);
  ctx.fillStyle = DARK;
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(rects.gem.cx, rects.gem.cy, rects.gem.holeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(rects.gem.cx, rects.gem.cy, rects.gem.ringR, 0, Math.PI * 2);
  ctx.strokeStyle = METAL;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Portrait bevel ring (frames the aperture; the aperture itself is
  // transparent here so the masked portrait art underneath shows through).
  roundRectPath(ctx, rects.portraitRing.x, rects.portraitRing.y, rects.portraitRing.w, rects.portraitRing.h, rects.portraitRing.r);
  ctx.strokeStyle = METAL;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  roundRectPath(ctx, rects.portrait.x, rects.portrait.y, rects.portrait.w, rects.portrait.h, 16);
  ctx.fill();
  ctx.restore();

  // Divider bar between the portrait and the flavor panel.
  roundRectPath(ctx, rects.divider.x, rects.divider.y, rects.divider.w, rects.divider.h, rects.divider.r);
  ctx.fillStyle = DARK;
  ctx.fill();

  // Flavor panel (light parchment).
  roundRectPath(ctx, rects.flavor.x, rects.flavor.y, rects.flavor.w, rects.flavor.h, rects.flavor.r);
  ctx.fillStyle = "#c7c3ba";
  ctx.fill();
  ctx.strokeStyle = "#8f8b82";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chamfered tab in the flavor panel's bottom-right corner.
  chamferRectPath(ctx, rects.tab.x, rects.tab.y, rects.tab.w, rects.tab.h, rects.tab.r, rects.tab.cut, "tl");
  ctx.fillStyle = DARK;
  ctx.fill();
}, RECTS);
await save(page, "frame_over.png");

// aperture.png — mask shape for the portrait: opaque rounded-rect on a
// transparent field, exercised via destination-in clipping. Sized to match
// the portrait rect above (460x614, i.e. 3:4).
await withCanvas(page, 460, 614, ([{ w, h }, , helpers]) => {
  eval(helpers);
  const ctx = document.getElementById("c").getContext("2d");
  ctx.clearRect(0, 0, w, h);
  roundRectPath(ctx, 0, 0, w, h, 16);
  ctx.fillStyle = "#fff";
  ctx.fill();
});
await save(page, "aperture.png");

// portrait_placeholder.png — stands in for generated art; distinct diagonal
// gradient makes mis-scaling/mis-positioning visually and pixel-obvious.
// Kept at the same 3:4 ratio real portraits are generated at.
await withCanvas(page, 460, 614, ([{ w, h }]) => {
  const ctx = document.getElementById("c").getContext("2d");
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#e05a4e");
  g.addColorStop(1, "#f4b93f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, w, h / 3);
});
await save(page, "portrait_placeholder.png");

// gem_placeholder.png — circular gem icon, transparent background. Sized to
// match the gem rect's hole (120x120) above.
await withCanvas(page, 120, 120, ([{ w, h }]) => {
  const ctx = document.getElementById("c").getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 4, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  g.addColorStop(0, "#7CF5D0");
  g.addColorStop(1, "#0F8F72");
  ctx.fillStyle = g;
  ctx.fill();
});
await save(page, "gem_placeholder.png");

await browser.close();
