// Plays every 4x4x4 puzzle by tapping, the way a person would: tap the piece,
// tap its target, through glass floors and around other pieces, in Chromium
// (all 40) and WebKit (one per group). Also checks the numerals, the floor
// solo, the act menu, and the sounds: all decode, each event plays its render,
// and the Sound button silences them. Serve the R2 sounds locally at
// /audio/demos/four-by-four/.
//
//   static server on :8000   then   node e2e/4x4x4.mjs   (SHOTS=dir saves screenshots)
import { chromium, webkit } from "playwright";

const BASE = process.env.BASE || "http://localhost:8000";
const SHOTS = process.env.SHOTS;
let failed = false;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failed = true; };

for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`${BASE}/demos/13/4x4x4/`);
  await page.waitForFunction(() => window.__4x4x4 && Object.keys(window.__4x4x4.audio.buf).length >= 22, null, { timeout: 20000 }).catch(() => {});
  const nbuf = await page.evaluate(() => Object.keys(window.__4x4x4.audio.buf).length);
  check(nbuf >= 22, `${name}: sounds decoded (${nbuf})`);
  const total = await page.evaluate(() => window.__4x4x4.levels);
  check(total >= 24 && total <= 48, `${name}: ${total} puzzles`);
  const st = () => page.evaluate(() => window.__4x4x4.state());
  const idle = () => page.waitForFunction(() => !window.__4x4x4.state().busy, null, { timeout: 10000 });
  const tap = async (x, y, z) => { const [cx, cy] = await page.evaluate(([x, y, z]) => window.__4x4x4.screenOf(x, y, z), [x, y, z]); await page.mouse.click(cx, cy); };
  check((await st()).label === "I · i", `${name}: opens on I · i`);

  // Solve by tapping. A tap that the view sends somewhere else counts as a miss.
  const which = name === "chromium" ? [...Array(total).keys()] : [0, 4, 7, 10, 13, 17, 20, 24, 27, 30, 34, 37];
  let misses = 0, solvedN = 0, soloed = 0;
  for (const i of which) {
    await page.evaluate((i) => window.__4x4x4.load(i), i);
    await page.waitForTimeout(100);
    await idle();
    const left = (await st()).left;
    if (SHOTS && name === "chromium") await page.locator("#stage").screenshot({ path: `${SHOTS}/lvl-${String(i + 1).padStart(2, "0")}.png` });
    for (let k = 0; k < 12 && !(await st()).won; k++) {
      const m = await page.evaluate(() => window.__4x4x4.solution()?.[0]);
      if (!m) break;
      await tap(m[0], m[1], m[2]); await page.waitForTimeout(80);
      let s = await st();
      // Hidden behind another piece: do what a person would, show its floor alone.
      if (!s.sel || s.sel.join() !== m.slice(0, 3).join()) {
        soloed++;
        if (s.sel) { await tap(...s.sel); await page.waitForTimeout(60); }
        await page.click(`#floors button:nth-child(${m[2] + 1})`);
        await tap(m[0], m[1], m[2]); await page.waitForTimeout(80);
        s = await st();
        if (!s.sel || s.sel.join() !== m.slice(0, 3).join()) { misses++; console.log(`  miss: ${s.label} piece ${m.slice(0, 3)} got ${s.sel}`); break; }
      }
      await tap(m[3], m[4], m[5]); await page.waitForTimeout(60);
      await idle();
      if ((await st()).solo !== null) await page.click(`#floors button:nth-child(${m[2] + 1})`);
      if ((await st()).left !== left - 1 - k && !(await st()).won) { misses++; console.log(`  target miss: ${s.label} ${m}`); break; }
    }
    await page.waitForTimeout(950);
    const s = await st();
    if (s.won) solvedN++; else console.log(`  not solved: ${s.label} (${i + 1})`);
  }
  check(solvedN === which.length, `${name}: ${solvedN}/${which.length} puzzles solved by tapping (${misses} mis-taps, ${soloed} needed a floor shown alone)`);

  // Numerals, solo, menu.
  await page.evaluate(() => window.__4x4x4.load(13));
  await idle();
  check((await st()).label === "II · iv", `${name}: puzzle 14 reads II · iv`);
  await page.click("#floors button:nth-child(2)");
  check((await st()).solo === 1, `${name}: floor solo`);
  await page.click("#floors button:nth-child(2)");
  check((await st()).solo === null, `${name}: floor solo off`);
  await page.click("#levels");
  check(await page.$eval("#menu .big", (e) => e.textContent) === "II", `${name}: menu opens on act II`);
  check(await page.$$eval("#menu .row", (r) => r.length) === 3, `${name}: three group rows`);
  await page.click('#menu [data-flip="1"]');
  check(await page.$eval("#menu .big", (e) => e.textContent) === "III", `${name}: menu flips to III`);
  await page.click("#menu .row button");
  await idle();
  check((await st()).label === "III · i", `${name}: menu loads III · i`);

  await page.click("#undo"); await page.click("#hint"); await page.waitForTimeout(200);
  const played = await page.evaluate(() => window.__4x4x4.audio.n);
  const want = ["drop-1", "hint", "pick", "hop", "capture-1", "capture-2", "solved", "click", "fall-1"];
  if (name === "chromium") want.push("morph", "hop-knight");
  const missing = want.filter((k) => !played[k]);
  check(missing.length === 0, `${name}: sounds played on their events${missing.length ? ", missing " + missing : ""}`);
  await page.click("#sound");
  const before = JSON.stringify(await page.evaluate(() => window.__4x4x4.audio.n));
  await page.click("#hint"); await page.click("#next");
  await page.waitForTimeout(1500);
  check(JSON.stringify(await page.evaluate(() => window.__4x4x4.audio.n)) === before, `${name}: no sound with Sound off`);
  check(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
  await browser.close();
}
process.exit(failed ? 1 : 0);
