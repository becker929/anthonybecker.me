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

// Outer border bevel ring (frame_over metal, #8a8d93) must paint over the
// background plate near the canvas edge (mid-top edge, clear of the
// rounded corners).
{
  const [r, g, b] = await pixel("canvas-card-1", 375, 17);
  assertClose(r, 0x8a, 12, "border pixel red");
  assertClose(g, 0x8d, 12, "border pixel green");
  assertClose(b, 0x93, 12, "border pixel blue");
  console.log("ok - frame_over border drawn on top at (375,17)");
}

// Portrait center: masked portrait art must show through, not the
// background plate and not the opaque frame_over bezel (only its 10px ring
// overlaps the aperture edge, so the center is untouched).
{
  const [r, g, b, a] = await pixel("canvas-card-1", 375, 500);
  assertEqual(a, 255, "portrait center alpha");
  const isBackgroundPlate = r < 60 && g < 70 && b < 90;
  if (isBackgroundPlate) throw new Error("portrait center still shows background plate — portrait/mask layer not drawn over it");
  console.log("ok - portrait art visible through aperture mask at (375,500)");
}

// Gem layer draws on top of everything at its rect center.
{
  const [r, g, b, a] = await pixel("canvas-card-1", 640, 115);
  assertEqual(a, 255, "gem center alpha");
  if (g <= r && g <= b) throw new Error(`gem center (${r},${g},${b}) doesn't look like the green/teal gem placeholder`);
  console.log("ok - gem art drawn on top at (640,115)");
}

// Title text layer painted something (non-background) somewhere in its rect.
// Title is light text (#f1ede4) on the dark title bar.
{
  const found = await page.evaluate(() => {
    const ctx = document.getElementById("canvas-card-1").getContext("2d");
    const [x, y, w, h] = [62, 52, 480, 42];
    const data = ctx.getImageData(x, y, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200 && data[i + 3] > 200) return true;
    }
    return false;
  });
  if (!found) throw new Error("no title text pixels found in the title rect");
  console.log("ok - title text painted inside its rect");
}

// Both cards rendered without throwing, including card-2's long title/
// flavor text, which forces the shrink and wrap-shrink paths respectively —
// exercised here for integration, exact sizing already covered by
// fit-text.test.js. Flavor is dark text (#26221c) on the light flavor panel.
{
  const found = await page.evaluate(() => {
    const ctx = document.getElementById("canvas-card-2").getContext("2d");
    const [x, y, w, h] = [74, 876, 480, 110];
    const data = ctx.getImageData(x, y, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 60 && data[i + 1] < 60 && data[i + 2] < 60 && data[i + 3] > 200) return true;
    }
    return false;
  });
  if (!found) throw new Error("no flavor text pixels found for card-2's wrap-shrink path");
  console.log("ok - card-2 long flavor text wrapped/shrunk and painted");
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
