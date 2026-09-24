// End-to-end tests in a real browser against the local full stack (e2e/server.mjs).
//   node e2e/server.mjs &   then   node e2e/run.mjs
// Covers: the listening test (all pairs, stop, export), the role meter (examples,
// drop a file), and that the retired lab stays off.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:8790";
const results = [];
async function step(name, fn) {
  const t = Date.now();
  try { await fn(); results.push([name, "ok", Date.now() - t]); }
  catch (e) { results.push([name, "FAIL " + (e.message || e), Date.now() - t]); if (process.env.STOP_ON_FAIL) throw e; }
}

// a 1-second 50 Hz sine wav to upload
function wavBytes(seconds = 1, freq = 50, sr = 44100) {
  const n = seconds * sr, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / sr) * Math.exp(-i / (sr * 0.3)) * 30000), 44 + i * 2);
  return buf;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 1200 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/401/.test(m.text())) errors.push("console: " + m.text()); });

// ---------------- listening test ----------------
await step("listen: intro renders and pairs load", async () => {
  await page.goto(`${BASE}/research/sound-function/listen/`, { waitUntil: "networkidle" });
  assert.match(await page.textContent("body"), /Help us test sound by ear/);
  const pairs = await (await fetch(`${BASE}/research/sound-function/listen/pairs.json`)).json();
  assert.equal(pairs.length, 40);
});
await step("listen: answer all 40 pairs, each answer is stored", async () => {
  await page.getByRole("button", { name: /start/i }).click();
  const jobs = ["kick", "rumble", "hat", "clap", "hook", "space", "not sure"];
  for (let i = 0; i < 40; i++) {
    await page.waitForSelector(`text=Pair ${i + 1} of 40`, { timeout: 10000 });
    const radios = page.locator("#pair-section input[type=radio]:visible, section:visible input[type=radio]");
    const groups = {};
    for (const r of await page.locator("input[type=radio]:visible").all()) { const n = await r.getAttribute("name"); (groups[n] ||= []).push(r); }
    for (const [name, rs] of Object.entries(groups)) await rs[Math.floor(Math.random() * rs.length)].check();
    await page.getByRole("button", { name: /^next$/i }).click();
  }
  await page.waitForSelector("text=Thanks for listening", { timeout: 10000 });
  const exported = await (await fetch(`${BASE}/api/listen/export`)).json();
  assert.equal(exported.length, 40, `export has ${exported.length} records`);
  assert.equal(new Set(exported.map((r) => r.pair)).size, 40, "every pair answered once");
  assert.ok(exported.every((r) => ["a", "b"].includes(r.order?.[0]) || r.order), "order recorded");
  const bad = await fetch(`${BASE}/api/listen`, { method: "POST", body: "{}" }); assert.equal(bad.status, 400);
});
await step("listen: stop after two pairs still counts", async () => {
  await page.goto(`${BASE}/research/sound-function/listen/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /start/i }).click();
  for (let i = 0; i < 2; i++) {
    await page.waitForSelector(`text=Pair ${i + 1} of 40`);
    const groups = {};
    for (const r of await page.locator("input[type=radio]:visible").all()) { const n = await r.getAttribute("name"); (groups[n] ||= []).push(r); }
    for (const rs of Object.values(groups)) await rs[0].check();
    await page.getByRole("button", { name: /^next$/i }).click();
  }
  await page.getByRole("button", { name: /^stop$/i }).click();
  assert.match(await page.textContent("body"), /2/);
  const exported = await (await fetch(`${BASE}/api/listen/export`)).json();
  assert.equal(exported.length, 42);
});

// ---------------- role meter ----------------
await step("meter: every example sound gets a job", async () => {
  await page.goto(`${BASE}/research/sound-function/meter/`, { waitUntil: "networkidle" });
  const want = { Kick: "kick", Rumble: "rumble", Clap: "clap", Stab: "hook", Riser: "space", Pad: "space", Impact: "space" };
  for (const [btn, job] of Object.entries(want)) {
    await page.getByRole("button", { name: new RegExp(`^${btn}$`, "i") }).first().click();
    await page.waitForFunction(() => /This reads as a/.test(document.body.textContent), null, { timeout: 15000 });
    await page.waitForTimeout(400);
    const head = (await page.textContent("body")).replace(/\s+/g, " ").match(/This reads as a (\w+)/)?.[1];
    assert.equal(head, job, `${btn} -> ${head}`);
  }
});
await step("meter: a dropped wav file is analysed", async () => {
  const tmp = "/tmp/e2e-kick.wav"; fs.writeFileSync(tmp, wavBytes(1, 50));
  await page.setInputFiles("input[type=file]", tmp);
  await page.waitForFunction(() => /This reads as a/.test(document.body.textContent), null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const head = (await page.textContent("body")).replace(/\s+/g, " ").match(/This reads as a (\w+)/)?.[1];
  assert.ok(["kick", "rumble"].includes(head), `50 Hz decaying sine reads as ${head}`);
});

// ---------------- the lab is off ----------------
await step("lab: turned off, /lab/ is not found", async () => {
  const r = await fetch(`${BASE}/lab/`); assert.equal(r.status, 404);
});

await browser.close();
let failed = 0;
for (const [name, out, ms] of results) { console.log(`${out.startsWith("ok") ? "ok  " : "FAIL"} ${name} (${ms} ms)${out.startsWith("ok") ? "" : "  " + out}`); if (!out.startsWith("ok")) failed++; }
if (errors.length) console.log("browser errors:", errors);
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed || errors.length ? 1 : 0);
