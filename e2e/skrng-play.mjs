// End-to-end test of /skrng Play batch in a real browser: the run carries on
// into older batches, and the buttons a car or lock screen sends (Media
// Session actions, which Bluetooth AVRCP buttons arrive as) drive it.
//   node e2e/server.mjs &   then   node e2e/skrng-play.mjs
//
// Audio is replaced by short tones and navigator.mediaSession by a recorder,
// so this checks the page's own logic. Whether a given car sends the
// buttons still needs a drive.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:8790";
const results = [];
async function step(name, fn) {
  const t = Date.now();
  try { await fn(); results.push([name, "ok", Date.now() - t]); }
  catch (e) { results.push([name, "FAIL " + (e.message || e), Date.now() - t]); if (process.env.STOP_ON_FAIL) throw e; }
}

function wavBytes(seconds = 0.8, freq = 220, sr = 22050) {
  const n = Math.round(seconds * sr), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / sr) * 8000), 44 + i * 2);
  return buf;
}

// Installed before the page's scripts: records action handlers, metadata,
// playback state and position updates.
function mediaSessionRecorder() {
  const rec = { handlers: {}, meta: [], states: [], positions: 0 };
  window.__ms = rec;
  window.MediaMetadata = class { constructor(o) { Object.assign(this, o); } };
  const ms = {
    setActionHandler(action, fn) { rec.handlers[action] = fn; },
    setPositionState() { rec.positions += 1; },
    set metadata(m) { rec.meta.push({ title: m.title, artist: m.artist }); },
    get metadata() { return rec.meta[rec.meta.length - 1] || null; },
    set playbackState(s) { rec.states.push(s); },
    get playbackState() { return rec.states[rec.states.length - 1] || "none"; },
  };
  Object.defineProperty(navigator, "mediaSession", { value: ms, configurable: true });
}

const browser = await chromium.launch({ channel: process.env.CHANNEL || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.route("**/audio/skrng/**", (route) => route.fulfill({ status: 200, contentType: "audio/wav", body: wavBytes() }));
await ctx.addInitScript(mediaSessionRecorder);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const last = () => page.evaluate(() => window.__ms.meta[window.__ms.meta.length - 1] || {});
const call = (action) => page.evaluate((a) => window.__ms.handlers[a](), action);
const paused = () => page.evaluate(() => document.getElementById("seq").paused);

const manifest = await (await fetch(`${BASE}/skrng/manifest.json`)).json();
const batches = await (await fetch(`${BASE}/skrng/batches.json`)).json();
const nums = [...new Set(manifest.map((r) => (Number.isFinite(r.batch) ? r.batch : 1)))].sort((a, b) => b - a);
// A short batch, so the run reaches the next older one quickly.
const from = Number(process.env.FROM || 4.4);
const older = nums[nums.indexOf(from) + 1];

await step("the car's buttons are claimed on load, as track buttons", async () => {
  await page.goto(`${BASE}/skrng/?batch=${from}`, { waitUntil: "networkidle" });
  const h = await page.evaluate(() => Object.fromEntries(Object.entries(window.__ms.handlers).map(([k, v]) => [k, v === null ? null : typeof v])));
  for (const a of ["play", "pause", "nexttrack", "previoustrack", "stop"]) assert.equal(h[a], "function", a);
  assert.equal(h.seekforward, null);
  assert.equal(h.seekbackward, null);
});

await step("play from the car starts the batch, at its intro when it has one", async () => {
  await call("play");
  await page.waitForFunction(() => window.__ms.meta.length > 0);
  const m = (await page.evaluate(() => window.__ms.meta))[0];
  const intro = (batches.find((b) => b.n === from) || {}).announce;
  assert.equal(m.title, intro ? `Batch ${from}` : "Track 1");
  assert.equal(m.artist, `skrng · batch ${from}`);
  assert.equal(await page.locator("#play-batch").innerText(), "Stop");
});

await step("pause and play from the car keep the run", async () => {
  await page.waitForFunction(() => window.__ms.meta.some((m) => m.title === "Track 2"), null, { timeout: 15000 });
  await call("pause");
  assert.equal(await paused(), true);
  assert.equal(await page.locator("#play-batch").innerText(), "Stop");
  await call("play");
  await page.waitForFunction(() => !document.getElementById("seq").paused);
});

await step("next and previous move by track", async () => {
  const before = Number((await last()).title.replace(/\D/g, "")) || 1;
  await call("nexttrack");
  assert.equal((await last()).title, `Track ${before + 1}`);
  await call("previoustrack");
  assert.equal((await last()).title, `Track ${before}`);
});

await step("the run carries on into the next older batch", async () => {
  await page.waitForFunction((b) => window.__ms.meta.some((m) => m.artist === `skrng · batch ${b}`), older, { timeout: 60000 });
  assert.match(await page.locator("#t-title").innerText(), new RegExp(`Batch ${older}`));
  assert.ok(await page.evaluate(() => window.__ms.positions > 0), "position state was set");
});

await step("stop from the page ends the run", async () => {
  await page.locator("#play-batch").click();
  assert.equal(await paused(), true);
  assert.equal(await page.locator("#play-batch").innerText(), "Play batch");
});

await step("no page errors", async () => assert.deepEqual(errors, []));

await browser.close();
for (const [name, res, ms] of results) console.log(`${res === "ok" ? "ok  " : "FAIL"} ${name} (${ms} ms)${res === "ok" ? "" : "\n     " + res}`);
process.exit(results.every(([, r]) => r === "ok") ? 0 : 1);
