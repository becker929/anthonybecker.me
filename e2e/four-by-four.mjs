// Plays Four by Four's first puzzle by tapping in Chromium and WebKit and
// checks its sounds: all decode, each event plays its render, and the Sound
// button silences them. Serve the R2 sounds locally at
// /audio/demos/four-by-four/ (the encode step's web-four-by-four folder).
//
//   static server on :8000   then   node e2e/four-by-four.mjs
import { chromium, webkit } from "playwright";

const BASE = process.env.BASE || "http://localhost:8000";
let failed = false;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failed = true; };

for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("4x4:level", "0"); } catch {} });
  await page.goto(`${BASE}/demos/11/four-by-four/`);
  await page.waitForFunction(() => window.__4x4 && Object.keys(window.__4x4.audio.buf).length === 18, null, { timeout: 20000 }).catch(() => {});
  check(await page.evaluate(() => Object.keys(window.__4x4.audio.buf).length) === 18, `${name}: all 18 sounds decoded`);
  const idle = () => page.waitForFunction(() => !window.__4x4.state().busy, null, { timeout: 10000 });
  const tap = async (x, y) => { const [cx, cy] = await page.evaluate(([x, y]) => window.__4x4.screenOf(x, y), [x, y]); await page.mouse.click(cx, cy); };
  await idle();
  for (let i = 0; i < 10 && !(await page.evaluate(() => window.__4x4.state().won)); i++) {
    const m = await page.evaluate(() => window.__4x4.solution()?.[0]);
    if (!m) break;
    await tap(m[0], m[1]); await page.waitForTimeout(150);
    await tap(m[2], m[3]); await page.waitForTimeout(100);
    await idle();
  }
  await page.waitForTimeout(600);
  check(await page.evaluate(() => window.__4x4.state().won), `${name}: puzzle 1 solved by tapping`);
  await page.click("#undo");
  await page.waitForTimeout(200);
  await page.click("#hint");   // after the play: a hint selects the piece, which the taps above would have toggled off
  await page.waitForTimeout(200);
  const played = await page.evaluate(() => window.__4x4.audio.n);
  const want = ["drop-1", "hint", "pick", "hop", "capture-1", "capture-2", "solved", "undo"];
  const missing = want.filter((k) => !played[k]);
  check(missing.length === 0, `${name}: sounds played on their events${missing.length ? ", missing " + missing : ""} ${JSON.stringify(played)}`);
  await page.click("#sound");
  const before = JSON.stringify(await page.evaluate(() => window.__4x4.audio.n));
  await page.click("#hint"); await page.click("#undo"); await page.click("#next");
  await page.waitForTimeout(1500);
  check(JSON.stringify(await page.evaluate(() => window.__4x4.audio.n)) === before, `${name}: no sound with Sound off`);
  check(await page.$eval("#sound", (b) => b.getAttribute("aria-pressed")) === "false", `${name}: Sound button shows off`);
  check(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
