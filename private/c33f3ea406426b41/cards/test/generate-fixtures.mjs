// Dev-only utility: derives the card frame assets from the source artwork in
// fixtures/frame_source.png. Not part of the served app; requires `playwright`
// resolvable from this directory (e.g. `npm install playwright` locally, or a
// global install on PATH/NODE_PATH). Run manually with
// `node generate-fixtures.mjs` whenever the source art or its geometry
// changes, then copy the printed rects into fixtures/template.json.
//
// The frame is *photographed* art, not vector shapes we redraw: the source is
// a render of the card sitting on a dark backdrop. So the pipeline is
//   crop the card out of the backdrop -> rectify to the 750x1050 canvas
//   -> segment the sockets by flood fill -> emit masks.
// Every rect below is measured from the source rather than invented, so the
// masks land exactly on the painted bezels instead of near them.
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "fixtures");

// The card's outer edge within frame_source.png, measured off the luminance
// step between the backdrop (~35-44) and the card's lit rim / black border.
// The card sits square to the camera (<=1.5px of skew corner to corner), so a
// plain crop + rescale rectifies it; no perspective unwarp is needed.
const CARD_CROP = { x: 361, y: 37, w: 322, h: 453 };
const CANVAS = { w: 750, h: 1050 };
// Source corner arc runs 13px before the edge goes straight; scaled by
// 750/322 that is ~30px on the rectified canvas.
const CARD_RADIUS = 30;

// Flood-fill seeds and luminance bands for each socket, in rectified space.
// Bands are chosen to sit strictly between the socket fill and the bezel that
// encloses it, and each fill is boxed into an ROI so a leak fails loudly
// rather than silently swallowing the card.
const APERTURE = {
  seed: [375, 400],
  band: [42, 76],
  roi: [50, 125, 705, 678],
};

async function loadSourceDataUrl() {
  const bytes = await readFile(path.join(outDir, "frame_source.png"));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

async function savePng(page, canvasId, outFile) {
  const dataUrl = await page.evaluate(
    (id) => document.getElementById(id).toDataURL("image/png"),
    canvasId,
  );
  await writeFile(path.join(outDir, outFile), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`wrote ${outFile}`);
}

// Pixel helpers injected into the page (no closure crosses the Playwright
// boundary, so these travel as source text).
const HELPERS = `
// Separable Lanczos-3 resample. The source card is only 322x453, so it is
// upscaled ~2.3x to reach the 750x1050 canvas; canvas drawImage would do that
// bilinearly and visibly soften the bezel edges, which are the whole point of
// this frame. Lanczos keeps them crisp.
function lanczos3(src, sw, sh, dw, dh) {
  const A = 3;
  const kernel = (t) => {
    if (t === 0) return 1;
    const x = Math.abs(t);
    if (x >= A) return 0;
    const px = Math.PI * x;
    return (A * Math.sin(px) * Math.sin(px / A)) / (px * px);
  };
  const pass = (input, iw, ih, ow) => {
    const out = new Float32Array(ow * ih * 4);
    const scale = ow / iw;
    const support = scale < 1 ? A / scale : A;
    for (let ox = 0; ox < ow; ox++) {
      const center = (ox + 0.5) / scale - 0.5;
      const start = Math.ceil(center - support);
      const end = Math.floor(center + support);
      const weights = [];
      let wsum = 0;
      for (let ix = start; ix <= end; ix++) {
        const w = kernel(scale < 1 ? (ix - center) * scale : ix - center);
        if (w === 0) continue;
        weights.push([Math.min(iw - 1, Math.max(0, ix)), w]);
        wsum += w;
      }
      for (let y = 0; y < ih; y++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (const [ix, w] of weights) {
          const i = (y * iw + ix) * 4;
          r += input[i] * w; g += input[i + 1] * w; b += input[i + 2] * w; a += input[i + 3] * w;
        }
        const o = (y * ow + ox) * 4;
        out[o] = r / wsum; out[o + 1] = g / wsum; out[o + 2] = b / wsum; out[o + 3] = a / wsum;
      }
    }
    return out;
  };
  // Horizontal pass, then the same routine on the transposed buffer.
  const transpose = (buf, w, h) => {
    const out = new Float32Array(buf.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, o = (x * h + y) * 4;
        out[o] = buf[i]; out[o + 1] = buf[i + 1]; out[o + 2] = buf[i + 2]; out[o + 3] = buf[i + 3];
      }
    }
    return out;
  };
  const horiz = pass(src, sw, sh, dw);
  const vert = pass(transpose(horiz, dw, sh), sh, dw, dh);
  const final = transpose(vert, dh, dw);
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.min(255, Math.max(0, final[i])));
  return new ImageData(out, dw, dh);
}

function luma(data, i) { return (data[i] + data[i + 1] + data[i + 2]) / 3; }

// 4-connected flood fill over a luminance band, boxed into an ROI. Returns
// { mask, bbox, leaked } — leaked is true when the fill reached the ROI wall,
// which means the band let it escape the socket and the result is garbage.
function floodBand(img, seed, band, roi) {
  const { width: W, height: H, data } = img;
  const [sx, sy] = seed, [lo, hi] = band, [rx0, ry0, rx1, ry1] = roi;
  const mask = new Uint8Array(W * H);
  const stack = [sy * W + sx];
  mask[stack[0]] = 1;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p - x) / W;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < rx0 || nx > rx1 || ny < ry0 || ny > ry1) continue;
      const q = ny * W + nx;
      if (mask[q]) continue;
      const l = luma(data, q * 4);
      if (l > lo && l < hi) { mask[q] = 1; stack.push(q); }
    }
  }
  const leaked = minX <= rx0 || maxX >= rx1 || minY <= ry0 || maxY >= ry1;
  return { mask, bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }, leaked };
}

// Box-blur a binary mask and re-threshold it. The flood fill traces a band in
// noisy painted art, so its raw boundary is ragged at the pixel level; left
// alone that raggedness shows up as a speckled fringe where the art meets the
// bezel. Three box passes approximate a Gaussian, and re-thresholding at 0.5
// snaps the result back to a clean, smooth silhouette.
function smoothMask(mask, W, H, radius, passes) {
  let cur = Float32Array.from(mask);
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0, n = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          sum += cur[y * W + nx]; n++;
        }
        tmp[y * W + x] = sum / n;
      }
    }
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0, n = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= H) continue;
          sum += tmp[ny * W + x]; n++;
        }
        out[y * W + x] = sum / n;
      }
    }
    cur = out;
  }
  const result = new Uint8Array(W * H);
  for (let i = 0; i < result.length; i++) result[i] = cur[i] >= 0.5 ? 1 : 0;
  return result;
}

function maskBBox(mask, W, H) {
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// Chamfer distance transform: distance from each set pixel to the nearest
// unset pixel. Drives both the mask's feathered edge and the inner shadow.
function distanceInside(mask, W, H) {
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? INF : 0;
  const relax = (i, j, cost) => { if (d[j] + cost < d[i]) d[i] = d[j] + cost; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!mask[i]) continue;
    if (x > 0) relax(i, i - 1, 1);
    if (y > 0) relax(i, i - W, 1);
    if (x > 0 && y > 0) relax(i, i - W - 1, Math.SQRT2);
    if (x < W - 1 && y > 0) relax(i, i - W + 1, Math.SQRT2);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (!mask[i]) continue;
    if (x < W - 1) relax(i, i + 1, 1);
    if (y < H - 1) relax(i, i + W, 1);
    if (x < W - 1 && y < H - 1) relax(i, i + W + 1, Math.SQRT2);
    if (x > 0 && y < H - 1) relax(i, i + W - 1, Math.SQRT2);
  }
  return d;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<body></body>");
await page.addScriptTag({ content: HELPERS });

const sourceDataUrl = await loadSourceDataUrl();

// Rectify the card, round its corners, and segment the portrait aperture.
const measured = await page.evaluate(
  async ({ src, crop, canvas, radius, aperture }) => {
    const img = new Image();
    img.src = src;
    await img.decode();

    // Pull just the card out of the backdrop at source resolution.
    const cut = document.createElement("canvas");
    cut.width = crop.w; cut.height = crop.h;
    const cutCtx = cut.getContext("2d", { willReadFrequently: true });
    cutCtx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    const cutData = cutCtx.getImageData(0, 0, crop.w, crop.h);

    const rect = lanczos3(cutData.data, crop.w, crop.h, canvas.w, canvas.h);

    // frame_bg.png: the rectified card, corners cut to the card silhouette so
    // the page background reads through them.
    const bg = document.createElement("canvas");
    bg.id = "bg"; bg.width = canvas.w; bg.height = canvas.h;
    document.body.appendChild(bg);
    const bgCtx = bg.getContext("2d");
    bgCtx.putImageData(rect, 0, 0);
    bgCtx.globalCompositeOperation = "destination-in";
    roundRectPath(bgCtx, 0, 0, canvas.w, canvas.h, radius);
    bgCtx.fillStyle = "#fff";
    bgCtx.fill();

    // Segment the portrait aperture straight out of the art, then clean up the
    // pixel-level raggedness the band inevitably leaves behind.
    const raw = floodBand(rect, aperture.seed, aperture.band, aperture.roi);
    if (raw.leaked) throw new Error("aperture flood fill escaped its ROI — check the luminance band");
    const mask = smoothMask(raw.mask, canvas.w, canvas.h, 2, 3);
    const bbox = maskBBox(mask, canvas.w, canvas.h);

    const dist = distanceInside(mask, canvas.w, canvas.h);

    // The art is tucked INSET px inside the segmented edge so it finishes
    // underneath the painted bezel lip rather than butting up against it —
    // that hides the last of the segmentation noise instead of showcasing it.
    const INSET = 2.0, FEATHER = 1.5;
    const edge = (i) => Math.max(0, Math.min(1, (dist[i] - INSET) / FEATHER));

    // aperture.png: the cleaned shape, cropped to its bbox, softly feathered.
    const ap = document.createElement("canvas");
    ap.id = "aperture"; ap.width = bbox.w; ap.height = bbox.h;
    document.body.appendChild(ap);
    const apCtx = ap.getContext("2d");
    const apData = apCtx.createImageData(bbox.w, bbox.h);
    for (let y = 0; y < bbox.h; y++) {
      for (let x = 0; x < bbox.w; x++) {
        const s = (y + bbox.y) * canvas.w + (x + bbox.x);
        const o = (y * bbox.w + x) * 4;
        apData.data[o] = apData.data[o + 1] = apData.data[o + 2] = 255;
        apData.data[o + 3] = Math.round(edge(s) * 255);
      }
    }
    apCtx.putImageData(apData, 0, 0);

    // frame_over.png: everything that must sit *on top* of the portrait. The
    // bezels already live in frame_bg and the aperture stops just short of
    // them, so all that is left is a soft inner shadow ramping in from the
    // same edge, which seats the art into the socket instead of letting it
    // float flat. Kept gentle — a hard band here reads as a rendering bug.
    const over = document.createElement("canvas");
    over.id = "over"; over.width = canvas.w; over.height = canvas.h;
    document.body.appendChild(over);
    const overCtx = over.getContext("2d");
    const overData = overCtx.createImageData(canvas.w, canvas.h);
    const SHADOW_W = 20, SHADOW_A = 0.3;
    for (let i = 0; i < canvas.w * canvas.h; i++) {
      if (!mask[i]) continue;
      const inside = Math.max(0, dist[i] - INSET);
      const t = Math.max(0, 1 - inside / SHADOW_W);
      const o = i * 4;
      overData.data[o] = overData.data[o + 1] = overData.data[o + 2] = 0;
      // Multiplied by the aperture's own edge alpha so the shadow fades out
      // exactly where the art does, never overhanging it as a dark rim.
      overData.data[o + 3] = Math.round(t * t * SHADOW_A * edge(i) * 255);
    }
    overCtx.putImageData(overData, 0, 0);

    return { aperture: bbox };
  },
  { src: sourceDataUrl, crop: CARD_CROP, canvas: CANVAS, radius: CARD_RADIUS, aperture: APERTURE },
);

await savePng(page, "bg", "frame_bg.png");
await savePng(page, "aperture", "aperture.png");
await savePng(page, "over", "frame_over.png");

// Placeholder art. The portrait placeholder is generated at 4:3 — the ratio
// src/gemini.js now requests — and the legacy one at the old 3:4, so the
// renderer's cover-fit is exercised against both in renderer.test.html.
// Each paints a solid near-black circle of a known radius: a circle only
// stays a circle when the aspect is preserved, so render.spec.mjs can measure
// its bounding box and catch a stretch. Nothing else is drawn in that colour,
// which is what makes it measurable.
async function writePlaceholder({ w, h, id, label, from, to, outFile }) {
  await page.evaluate(({ w, h, id, label, from, to }) => {
    const c = document.createElement("canvas");
    c.id = id; c.width = w; c.height = h;
    document.body.appendChild(c);
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#101010";
    ctx.lineWidth = Math.round(Math.min(w, h) * 0.03);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#101010";
    ctx.font = `${Math.round(Math.min(w, h) * 0.09)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, w / 2, h / 2);
  }, { w, h, id, label, from, to });
  await savePng(page, id, outFile);
}

await writePlaceholder({
  w: 800, h: 600, id: "portrait", label: "4:3",
  from: "#e05a4e", to: "#f4b93f", outFile: "portrait_placeholder.png",
});
await writePlaceholder({
  w: 600, h: 800, id: "legacy", label: "3:4",
  from: "#4e7de0", to: "#3fd8f4", outFile: "portrait_legacy_placeholder.png",
});

// Gem placeholder: square, sized to the socket bore measured off the art.
await page.evaluate(({ size, id }) => {
  const c = document.createElement("canvas");
  c.id = id; c.width = size; c.height = size;
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(size * 0.38, size * 0.34, size * 0.05, size / 2, size / 2, size / 2);
  g.addColorStop(0, "#8CFFDE");
  g.addColorStop(1, "#0E9E7C");
  ctx.fillStyle = g;
  ctx.fill();
}, { size: 192, id: "gem" });
await savePng(page, "gem", "gem_placeholder.png");

console.log("\nMeasured geometry (rectified 750x1050 space) — keep template.json in sync:");
console.log(`  portrait aperture rect: [${measured.aperture.x}, ${measured.aperture.y}, ${measured.aperture.w}, ${measured.aperture.h}]`);

await browser.close();
