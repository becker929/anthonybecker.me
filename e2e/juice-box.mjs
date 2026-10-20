// Taps everything on the Juice Box shelves in Chromium and WebKit, with juice
// on and then off, and checks that the payouts match and nothing throws.
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
  await page.click("#all-off");
  await page.evaluate(() => { window.__juice.hud.treasure = 0; });
  await tapAll(page);
  await page.waitForTimeout(2500);
  const off = await page.evaluate(() => window.__juice.hud.treasure);
  check(off === 128, `${name}: treasure with juice off is the same (${off})`);
  check(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
  await page.click("#all-on");
  await browser.close();
}
process.exit(failed ? 1 : 0);
