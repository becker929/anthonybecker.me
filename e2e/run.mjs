// End-to-end tests in a real browser against the local full stack (e2e/server.mjs).
//   node e2e/server.mjs &   then   node e2e/run.mjs
// Covers: the listening test (all pairs, stop, export), the role meter (examples,
// drop a file), and the lab (login, upload, list, the runner's API, the report view, delete).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:8790";
const PASSWORD = process.env.DEMO_PASSWORD || "e2e-password";
const TOKEN = process.env.LAB_TOKEN || "e2e-token";
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

// ---------------- the lab ----------------
let itemId;
await step("lab: login page, wrong then right password", async () => {
  await page.goto(`${BASE}/lab/`, { waitUntil: "networkidle" });
  assert.match(await page.textContent("body"), /Same password as the studio/);
  await page.fill("input[name=password]", "wrong"); await page.click("button[type=submit]");
  await page.waitForSelector("text=That is not it");
  await page.fill("input[name=password]", PASSWORD); await page.click("button[type=submit]");
  await page.waitForSelector("text=Upload a track, a sample, or the stems", { timeout: 10000 });
});
await step("lab: upload a track and see it pending", async () => {
  fs.writeFileSync("/tmp/e2e-demo 01.wav", wavBytes(2, 50));
  await page.selectOption("select[name=kind]", "track");
  await page.fill("input[name=title]", "e2e demo");
  await page.fill("input[name=notes]", "made by the e2e run");
  await page.setInputFiles("input[name=files]", "/tmp/e2e-demo 01.wav");
  await page.click("#go");
  await page.waitForSelector("text=Uploaded. The runner will pick it up.", { timeout: 20000 });
  const li = page.locator("#item-list li[data-id]").first();
  assert.match(await li.textContent(), /e2e demo/); assert.match(await li.textContent(), /pending/);
  itemId = await li.getAttribute("data-id");
});
await step("lab: multitrack takes several files; a track refuses two", async () => {
  fs.writeFileSync("/tmp/e2e-kick.wav", wavBytes(2, 50)); fs.writeFileSync("/tmp/e2e-hat.wav", wavBytes(2, 8000));
  await page.selectOption("select[name=kind]", "track");
  await page.setInputFiles("input[name=files]", ["/tmp/e2e-kick.wav", "/tmp/e2e-hat.wav"]);
  await page.click("#go");
  await page.waitForSelector("text=Only a multitrack item takes several files");
  await page.selectOption("select[name=kind]", "multitrack");
  await page.fill("input[name=title]", "e2e stems");
  await page.click("#go");
  await page.waitForSelector("text=Uploaded. The runner will pick it up.", { timeout: 20000 });
  const items = await (await fetch(`${BASE}/lab/api/items`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  const mt = items.items.find((i) => i.title === "e2e stems");
  assert.equal(mt.files.length, 2);
});
await step("lab: the runner's api sees pending items, downloads, and posts a report", async () => {
  const h = { Authorization: `Bearer ${TOKEN}` };
  const pending = (await (await fetch(`${BASE}/lab/api/items?status=pending`, { headers: h })).json()).items;
  assert.ok(pending.some((i) => i.id === itemId));
  const file = await fetch(`${BASE}/lab/api/items/${itemId}/files/${encodeURIComponent("e2e-demo 01.wav")}`, { headers: h });
  assert.equal(file.status, 200); assert.equal((await file.arrayBuffer()).byteLength, wavBytes(2, 50).length);
  await fetch(`${BASE}/lab/api/items/${itemId}`, { method: "PATCH", headers: h, body: JSON.stringify({ status: "running" }) });
  const report = { headline: "148 bpm, pump 9 dB on the bass, kick lands near 52 Hz", rows: [{ label: "tempo", value: 148, unit: "bpm", ref: 142.6, note: "corpus median" }],
    sections: [{ title: "Where the attacks land in the bar", grid: Array.from({ length: 6 }, (_, r) => Array.from({ length: 16 }, (_, k) => (r === 0 && k % 4 === 0 ? 1 : 0.1))) }, { title: "Stem levels", rows: [{ label: "drums", value: 0, unit: "dB" }, { label: "bass", value: -7.7, unit: "dB" }] }] };
  const put = await fetch(`${BASE}/lab/api/items/${itemId}/results`, { method: "PUT", headers: h, body: JSON.stringify(report) });
  assert.equal(put.status, 200);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7350e1e0000000049454e44ae426082", "hex");
  const art = await fetch(`${BASE}/lab/api/items/${itemId}/artifacts/grid.png`, { method: "PUT", headers: { ...h, "Content-Type": "image/png", "Content-Length": String(png.length) }, body: png });
  assert.equal(art.status, 200);
});
await step("lab: the report renders in the browser", async () => {
  await page.click("#refresh"); await page.waitForTimeout(300);
  await page.click(`#item-list li[data-id="${itemId}"]`);
  await page.waitForSelector("text=148 bpm, pump 9 dB on the bass", { timeout: 10000 });
  const body = await page.textContent("#detail");
  assert.match(body, /done/); assert.match(body, /corpus median/); assert.match(body, /Stem levels/);
  assert.equal(await page.locator("canvas.grid").count(), 1);
  assert.equal(await page.locator("#detail audio").count(), 1);
  await page.screenshot({ path: "/tmp/e2e-lab-report.png", fullPage: true });
});
await step("lab: run again and delete", async () => {
  await page.click("#requeue"); await page.waitForTimeout(300);
  assert.match(await page.textContent("#detail-meta"), /pending/);
  page.once("dialog", (d) => d.accept());
  await page.click("#delete"); await page.waitForTimeout(500);
  const items = await (await fetch(`${BASE}/lab/api/items`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  assert.ok(!items.items.some((i) => i.id === itemId));
});
await step("lab: signed-out browser gets the login page, not the app", async () => {
  const fresh = await browser.newPage();
  await fresh.goto(`${BASE}/lab/`); assert.match(await fresh.textContent("body"), /Same password/);
  const api = await fetch(`${BASE}/lab/api/items`); assert.equal(api.status, 401);
  const priv = await fetch(`${BASE}/private/lab/lab.js`); assert.equal(priv.status, 404);
  await fresh.close();
});

await browser.close();
let failed = 0;
for (const [name, out, ms] of results) { console.log(`${out.startsWith("ok") ? "ok  " : "FAIL"} ${name} (${ms} ms)${out.startsWith("ok") ? "" : "  " + out}`); if (!out.startsWith("ok")) failed++; }
if (errors.length) console.log("browser errors:", errors);
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed || errors.length ? 1 : 0);
