// Dev-only utility: (re)generates the placeholder PNG fixtures used by the
// renderer test harness. Not part of the served app; requires `playwright`
// resolvable from this directory (e.g. `npm install playwright` locally, or
// a global install on PATH/NODE_PATH). Run manually with
// `node generate-fixtures.mjs` whenever the fixture set needs to change.
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

async function withCanvas(page, w, h, draw) {
  await page.setContent(`<canvas id="c" width="${w}" height="${h}"></canvas>`);
  await page.evaluate(draw, { w, h });
}

const browser = await chromium.launch();
const page = await browser.newPage();

// frame_bg.png — full-canvas background plate (flat gradient "card stock").
await withCanvas(page, 750, 1050, ({ w, h }) => {
  const ctx = document.getElementById("c").getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#2a3a52");
  g.addColorStop(1, "#16202f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
});
await save(page, "frame_bg.png");

// frame_over.png — mostly transparent; opaque outer border ring + a bezel
// ring overlapping the portrait aperture (the "frame shadows/edges" a mask
// alone can't give), rest transparent so gem/text/portrait aperture show.
await withCanvas(page, 750, 1050, ({ w, h }) => {
  const ctx = document.getElementById("c").getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#caa24a";
  const border = 18;
  ctx.fillRect(0, 0, w, border);
  ctx.fillRect(0, h - border, w, border);
  ctx.fillRect(0, 0, border, h);
  ctx.fillRect(w - border, 0, border, h);
  const [px, py, pw, ph] = [45, 60, 660, 880];
  const bez = 10;
  ctx.strokeStyle = "#caa24a";
  ctx.lineWidth = bez * 2;
  ctx.strokeRect(px, py, pw, ph);
});
await save(page, "frame_over.png");

// aperture.png — mask shape for the portrait: opaque rounded-rect on a
// transparent field, exercised via destination-in clipping.
await withCanvas(page, 660, 880, ({ w, h }) => {
  const ctx = document.getElementById("c").getContext("2d");
  ctx.clearRect(0, 0, w, h);
  const r = 28;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
  ctx.fill();
});
await save(page, "aperture.png");

// portrait_placeholder.png — stands in for generated art; distinct diagonal
// gradient makes mis-scaling/mis-positioning visually and pixel-obvious.
await withCanvas(page, 660, 880, ({ w, h }) => {
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

// gem_placeholder.png — circular gem icon, transparent background.
await withCanvas(page, 120, 120, ({ w, h }) => {
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
