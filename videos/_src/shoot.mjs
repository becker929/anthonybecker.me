// Renders every frame of a film's edit (edl.json in the work folder) to <work>/out/NNNN.jpg.
//   node shoot.mjs <work> <style>              all frames, into <work>/<style>/out
//   node shoot.mjs <work> <style> 0 40 95      just those (for a contact sheet)
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { chromium } from '/Users/anthonybecker/world2/tools/node_modules/playwright-core/index.mjs';

const HERE = import.meta.dirname;
const WORK = resolve(process.argv[2]);
const STYLE = process.argv[3];
const edl = JSON.parse(await readFile(join(WORK, STYLE, 'edl.json'), 'utf8'));
const OUT = join(WORK, STYLE, 'out');
await mkdir(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
// The editor's own files come from here; the edit and its footage from the work folder.
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname).slice(1);
  if (p === 'favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = p === 'edit.html' || p === 'edit.js' ? join(HERE, p) : p === 'edl.json' ? join(WORK, STYLE, p) : join(WORK, p);
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  // Never make a sound on this Mac.
  args: ['--mute-audio', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'],
});
const page = await (await browser.newContext({ viewport: { width: edl.w, height: edl.h }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`http://localhost:${server.address().port}/edit.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const list = process.argv.length > 4 ? process.argv.slice(4).map(Number) : [...Array(edl.frames).keys()];
const t0 = Date.now();
for (const n of list) {
  await page.evaluate((n) => window.render(n), n);
  await page.screenshot({ path: join(OUT, `${String(n).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
}
console.log(`${list.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await browser.close();
server.close();
