// Integration test for renderer.js, run in a real browser (canvas text/
// image compositing has no meaningful Node equivalent). Spins up a plain
// static file server over the cards/ directory, loads renderer.test.html,
// and asserts on the resulting canvas pixels. Requires `playwright`
// resolvable from this directory — see generate-fixtures.mjs.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ttf": "font/ttf" };

function serveStatic(root) {
  return createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const filePath = path.join(root, urlPath);
      if (!filePath.startsWith(root)) throw new Error("path escape");
      const body = await readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertClose(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg}: expected ~${expected} (±${tolerance}), got ${actual}`);
  }
}

const server = serveStatic(root);
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (err) => console.error("page error:", err));

await page.goto(`http://localhost:${port}/renderer.test.html`);
await page.waitForFunction(() => window.__renderDone === true);

const errors = await page.evaluate(() => window.__renderErrors);
if (errors.length) throw new Error(`Renderer threw:\n${errors.join("\n")}`);
console.log("ok - both cards rendered with no errors");

async function pixel(canvasId, x, y) {
  return page.evaluate(
    ({ canvasId, x, y }) => {
      const ctx = document.getElementById(canvasId).getContext("2d");
      return Array.from(ctx.getImageData(x, y, 1, 1).data);
    },
    { canvasId, x, y },
  );
}

// The card silhouette is rounded, so the extreme corner is transparent while
// the frame art is opaque just inside it. Catches the frame_bg corner mask
// being dropped or the art being drawn at the wrong offset.
{
  const [, , , cornerAlpha] = await pixel("canvas-card-1", 2, 2);
  assertEqual(cornerAlpha, 0, "rounded-corner alpha outside the card");
  const [, , , bodyAlpha] = await pixel("canvas-card-1", 375, 6);
  assertEqual(bodyAlpha, 255, "card body alpha along the top edge");
  console.log("ok - frame_bg carries the rounded card silhouette");
}

// Portrait center: masked portrait art must show through, not the frame's
// own empty slate aperture fill. The placeholder is a warm orange gradient,
// so a red-dominant pixel proves the art landed.
{
  const [r, g, b, a] = await pixel("canvas-card-1", 375, 400);
  assertEqual(a, 255, "portrait center alpha");
  if (!(r > g && g > b)) {
    throw new Error(`portrait center (${r},${g},${b}) doesn't look like the warm placeholder — aperture may be empty`);
  }
  console.log("ok - portrait art visible through aperture mask at (375,400)");
}

// Just outside the aperture the painted bezel must still be intact — i.e.
// the portrait is clipped by the mask rather than overrunning its socket.
{
  const [r, g, b] = await pixel("canvas-card-1", 375, 150);
  if (r > g && g > b && r - b > 40) {
    throw new Error(`pixel above the aperture (${r},${g},${b}) shows portrait art — mask is leaking past the bezel`);
  }
  console.log("ok - portrait is clipped to the aperture, bezel intact");
}

// Gem layer draws on top of everything at its rect center.
{
  const [r, g, b, a] = await pixel("canvas-card-1", 648, 102);
  assertEqual(a, 255, "gem center alpha");
  if (g <= r && g <= b) throw new Error(`gem center (${r},${g},${b}) doesn't look like the green/teal gem placeholder`);
  console.log("ok - gem art drawn on top at (648,102)");
}

// Cover-fit must preserve aspect for BOTH the 4:3 art generation now
// produces (card-1) and the legacy 3:4 art older cards carry (card-2). Each
// placeholder paints a circle, so measuring its width and height inside the
// aperture catches any stretch: a distorted draw turns it into an ellipse.
{
  // Measured on the portrait-only canvases: the only opaque pixels there are
  // the masked art, so the marker circle (solid #101010, the darkest thing
  // the placeholder paints) has nothing to be confused with.
  const measure = async (canvasId) =>
    page.evaluate((id) => {
      const ctx = document.getElementById(id).getContext("2d");
      const { data } = ctx.getImageData(0, 0, 750, 1050);
      let minX = 750, minY = 1050, maxX = -1, maxY = -1;
      for (let y = 0; y < 1050; y++) {
        for (let x = 0; x < 750; x++) {
          const i = (y * 750 + x) * 4;
          if (data[i + 3] < 250) continue;
          if (data[i] > 60 || data[i + 1] > 60 || data[i + 2] > 60) continue;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      return { width: maxX - minX + 1, height: maxY - minY + 1 };
    }, canvasId);

  for (const [canvasId, label] of [
    ["canvas-card-1-portrait", "4:3 art"],
    ["canvas-card-2-portrait", "legacy 3:4 art"],
  ]) {
    const { width, height } = await measure(canvasId);
    if (width < 8 || height < 8) {
      throw new Error(`${label}: could not find the placeholder's circle in the aperture (w=${width}, h=${height})`);
    }
    // A circle drawn without distortion spans the same number of pixels
    // across as it does down; a stretch shows up as a ratio away from 1.
    assertClose(width / height, 1, 0.08, `${label}: placeholder circle aspect (stretched, not cover-fit)`);
    console.log(`ok - ${label} cover-fits into the aperture without distortion`);
  }
}

// Title text layer painted something somewhere in its rect. Title is light
// text (#e8e4d8) on the dark title bar.
{
  const found = await page.evaluate(() => {
    const ctx = document.getElementById("canvas-card-1").getContext("2d");
    const [x, y, w, h] = [79, 57, 499, 70];
    const data = ctx.getImageData(x, y, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 190 && data[i + 1] > 190 && data[i + 2] > 180) return true;
    }
    return false;
  });
  if (!found) throw new Error("no title text pixels found in the title rect");
  console.log("ok - title text painted inside its rect");
}

// Stats sit in the dark tab at the flavor panel's bottom-right corner —
// light text again, and card-2 carries three stats so the block wraps.
{
  const found = await page.evaluate(() => {
    const ctx = document.getElementById("canvas-card-2").getContext("2d");
    const [x, y, w, h] = [518, 890, 159, 85];
    const data = ctx.getImageData(x, y, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 190 && data[i + 1] > 190 && data[i + 2] > 180) return true;
    }
    return false;
  });
  if (!found) throw new Error("no stats text pixels found in the stats tab");
  console.log("ok - stats text painted inside the tab");
}

// Both cards rendered without throwing, including card-2's long title/
// flavor text, which forces the shrink and wrap-shrink paths respectively —
// exercised here for integration, exact sizing already covered by
// fit-text.test.js. Flavor is dark text (#23201b) on the light flavor panel.
{
  const found = await page.evaluate(() => {
    const ctx = document.getElementById("canvas-card-2").getContext("2d");
    const [x, y, w, h] = [85, 712, 578, 158];
    const data = ctx.getImageData(x, y, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 70 && data[i + 1] < 70 && data[i + 2] < 70) return true;
    }
    return false;
  });
  if (!found) throw new Error("no flavor text pixels found for card-2's wrap-shrink path");
  console.log("ok - card-2 long flavor text wrapped/shrunk and painted");
}

// Flavor text must not spill into the stats tab: the tab is the darkest
// thing in the panel, so dark flavor glyphs overlapping it would be
// unreadable. The rect is sized to stop above it — assert that holds.
{
  const overlaps = await page.evaluate(() => {
    const [fx, fy, fw, fh] = [85, 712, 578, 158];
    const [tx, ty] = [506, 880];
    return fx + fw > tx && fy + fh > ty;
  });
  if (overlaps) throw new Error("flavor text rect overlaps the stats tab");
  console.log("ok - flavor text rect clears the stats tab");
}

// Determinism: same template+card+assets rendered twice in this process
// must produce byte-identical canvas output (§2).
{
  const [d1, d2] = await Promise.all([
    page.evaluate(() => document.getElementById("canvas-card-1").toDataURL()),
    page.evaluate(() => document.getElementById("canvas-card-1-rerender").toDataURL()),
  ]);
  if (d1 !== d2) throw new Error("re-rendering the same template+card+assets produced different output");
  console.log("ok - re-render is byte-identical (determinism)");
}

await browser.close();
server.close();
console.log("\nAll renderer integration checks passed.");
