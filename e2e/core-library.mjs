// Drives the Core Library drill in a real browser against the e2e stack:
// a test ticket stands in for the Bluesky sign-in, then the page downloads a
// real repository from its PDS, counts it, files it, and draws the core page.
//
//   npm run e2e:server &   then   node e2e/core-library.mjs [handle]
import { chromium, webkit } from "playwright";

const BASE = process.env.BASE || "http://localhost:8790";
// One account per browser: an account can only be drilled once a day.
const handles = process.argv.slice(2).length ? process.argv.slice(2) : ["johnvining.bsky.social", "yuxi.ml"];
const shots = process.env.SHOTS || "";

async function account(handle) {
  const did = (await (await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${handle}`)).json()).did;
  const doc = await (await fetch(`https://plc.directory/${did}`)).json();
  return { did, pds: doc.service.find((s) => s.id === "#atproto_pds").serviceEndpoint };
}

let failed = false;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failed = true; };

for (const [i, [name, engine]] of [["chromium", chromium], ["webkit", webkit]].entries()) {
  const handle = handles[i % handles.length];
  const { did, pds } = await account(handle);
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const ticket = await (await fetch(`${BASE}/__e2e/core-ticket?did=${did}&pds=${encodeURIComponent(pds)}&handle=${handle}`)).text();
  await page.goto(`${BASE}/demos/10/core-library/#drill=${ticket}`);
  await page.waitForURL(/\/c\/\d+$/, { timeout: 120000 }).catch(() => {});
  const url = page.url();
  check(/\/c\/\d+$/.test(url), `${name}: drill lands on a core page (${url})`);
  if (!/\/c\/\d+$/.test(url)) console.log(await page.textContent("#log").catch(() => ""));
  await page.waitForSelector("#notes li", { timeout: 20000 }).catch(() => {});
  const notes = await page.$$eval("#notes li", (els) => els.map((e) => e.textContent));
  check(notes.length >= 3, `${name}: field notes written (${notes.length})`);
  const drawn = await page.$eval("#core", (c) => c.width > 0 && c.height > 0).catch(() => false);
  check(drawn, `${name}: core canvas drawn`);
  const card = await fetch(`${url}/card.png`);
  check(card.ok && card.headers.get("content-type") === "image/png", `${name}: card.png served (${card.status})`);
  check(!errors.length, `${name}: no page errors ${errors.join(" | ")}`);
  if (shots) {
    await page.screenshot({ path: `${shots}/core-${name}.png`, fullPage: true });
    await page.goto(`${BASE}/demos/10/core-library/`);
    await page.waitForSelector("#shelf canvas", { timeout: 20000 }).catch(() => {});
    await page.screenshot({ path: `${shots}/index-${name}.png`, fullPage: true });
  }
  await browser.close();
}
process.exit(failed ? 1 : 0);
