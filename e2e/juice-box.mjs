// Taps everything on the Juice Box shelves in Chromium and WebKit, with juice
// on and then off, and checks that the payouts match, every sound decodes and
// plays on its event (and none with Sound off), and nothing throws. Serve the
// R2 sounds locally at /audio/demos/juice-box/ (the encode step's web folder).
//
//   npm run preview &   then   node e2e/juice-box.mjs
import { chromium, webkit } from "playwright";

const BASE = process.env.BASE || "http://localhost:8000";
const shots = process.env.SHOTS || "";
let failed = false;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failed = true; };

async function tapAll(page) {
  const box = await page.$eval("#view", (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const at = (x, y) => page.mouse.click(box.x + (x / 600) * box.w, box.y + (y / 640) * box.h);
  for (let i = 0; i < 3; i++) { await at(100, 260); await page.waitForTimeout(120); }
  await at(300, 240); await page.waitForTimeout(150);
  await at(500, 240); await page.waitForTimeout(150);
  for (let i = 0; i < 3; i++) { await at(100, 510); await page.waitForTimeout(250); }
  for (let i = 0; i < 3; i++) { await at(300, 510); await page.waitForTimeout(150); }
  await at(500, 500);
  return at;
}

for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${BASE}/demos/12/juice-box/`);
  await page.click("#all-on");
  await page.waitForFunction(() => Object.keys(window.__juice.audio.buf).length === 34, null, { timeout: 20000 }).catch(() => {});
  const decoded = await page.evaluate(() => {
    const b = window.__juice.audio.buf;
    // leading silence: AAC priming that the decoder did not strip would show here
    const lead = Object.values(b).map((x) => { const d = x.getChannelData(0); let i = 0; while (i < d.length && Math.abs(d[i]) < 1e-3) i++; return i / x.sampleRate * 1000; });
    return { n: Object.keys(b).length, maxLeadMs: Math.max(...lead, 0) };
  });
  check(decoded.n === 34 && decoded.maxLeadMs < 5, `${name}: all 34 sounds decoded (${decoded.n}), longest lead-in ${decoded.maxLeadMs.toFixed(1)} ms`);
  await tapAll(page);
  await page.waitForTimeout(700);
  if (shots) await page.locator("#stage").screenshot({ path: `${shots}/${name}-mid.png` });
  const openedMid = await page.evaluate(() => window.__juice.things.filter((t) => t.state === "open").map((t) => t.name));
  check(openedMid.length === 5, `${name}: five boxes open with juice (${openedMid})`);
  await page.waitForTimeout(3500);
  if (shots) await page.locator("#stage").screenshot({ path: `${shots}/${name}-finale.png` });
  const on = await page.evaluate(() => window.__juice.hud.treasure);
  // Fireflies are not caught here, so: button 3 + chest 20 + gift 25 + crate 15 + egg 15 + finale 50.
  check(on === 128, `${name}: treasure with juice on is 128 (${on})`);
  await page.waitForTimeout(2500);
  const before = await page.evaluate(() => JSON.stringify(window.__juice.audio.played));
  await page.click("#all-off");
  // Slow motion and hit stop stretch game time, so wait for every box to close again rather than a fixed time,
  // and for the fireflies to go: a tap on one catches it (+3) instead of opening the box under it.
  await page.waitForFunction(() => window.__juice.things.every((t) => t.state === "closed" && t.appear === 1) && !window.__juice.P.some((p) => ["coin", "gem", "firefly"].includes(p.kind)), null, { timeout: 30000 });
  await page.evaluate(() => { window.__juice.hud.treasure = 0; });
  await tapAll(page);
  await page.waitForTimeout(2500);
  const off = await page.evaluate(() => window.__juice.hud.treasure);
  check(off === 128, `${name}: treasure with juice off is the same (${off})`);
  if (off !== 128) console.log(await page.evaluate(() => JSON.stringify(window.__juice.things.map((t) => [t.name, t.state, t.hp, t.taps, t.count, +t.t.toFixed(2), t.appear]))));
  {
    const played = await page.evaluate(() => window.__juice.audio.played);
    const want = ["button-1", "button-3", "chest-rattle", "chest-open", "gift-charge", "gift-pop", "crate-hit-1", "crate-hit-2", "crate-smash", "egg-tap-1", "egg-tap-3", "egg-rumble", "egg-hatch", "jar-jiggle", "jar-pop", "coin-1", "gem", "finale", "firework", "respawn"];
    const missing = want.filter((k) => !played[k]);
    check(missing.length === 0, `${name}: sounds played on their events${missing.length ? ", missing " + missing : ""}`);
    check(JSON.stringify(played) === before, `${name}: no sound played while Sound was off`);
  }
    check(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
  await page.click("#all-on");
  await browser.close();
}
process.exit(failed ? 1 : 0);
