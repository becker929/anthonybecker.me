// Films the footage a subject's videos are cut from: every shot in subject.json, once wide (1920x1080)
// and once tall (1080x1920), into <work>/footage/<key>-h and <key>-v as numbered JPEG frames at 30 fps.
//   node capture.mjs <work>            (reads <work>/subject.json)
//
// A shot is one of:
//   { key, url, seconds, wait?, setup?, during? }   a live page, recorded; `setup` runs before the
//      recording counts, `during` while it runs (both JavaScript, run in the page; `during` may await)
//   { key, image }                                    a still from disk (a render, a screenshot)
//   { key, video }                                    an existing clip from disk
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '/Users/anthonybecker/world2/tools/node_modules/playwright-core/index.mjs';

const WORK = resolve(process.argv[2]);
const subject = JSON.parse(await readFile(join(WORK, 'subject.json'), 'utf8'));
const SIZES = { h: { width: 1920, height: 1080 }, v: { width: 1080, height: 1920 } };
const ffmpeg = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: 'inherit' });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  // Pages may play sound; nothing here may come out of this Mac's speakers.
  args: ['--mute-audio', '--autoplay-policy=user-gesture-required', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'],
});

const only = process.argv.slice(3);
for (const shot of subject.shots) {
  if (only.length && !only.includes(shot.key)) continue;
  for (const [side, size] of Object.entries(SIZES)) {
    const dir = join(WORK, 'footage', `${shot.key}-${side}`);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    if (shot.image) {
      // A still: one frame, which the editor holds for as long as the shot lasts.
      ffmpeg('-i', shot.image, '-vf', `scale=${size.width}:${size.height}:force_original_aspect_ratio=increase,crop=${size.width}:${size.height}`, '-q:v', '3', join(dir, '0001.jpg'));
      continue;
    }
    if (shot.video) {
      ffmpeg('-i', shot.video, '-vf', `fps=30,scale=${size.width}:${size.height}:force_original_aspect_ratio=increase,crop=${size.width}:${size.height}`, '-q:v', '3', join(dir, '%04d.jpg'));
      continue;
    }
    // Frames come from Chrome's own screencast, each with the moment it was painted, and are laid on a
    // steady 30 fps clock afterwards. (Playwright's video recorder needs a separate encoder download.)
    const tmp = join(WORK, 'rec', `${shot.key}-${side}`);
    await rm(tmp, { recursive: true, force: true });
    await mkdir(tmp, { recursive: true });
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    // Pages of this site keep their sound off when this is set, and the browser is muted anyway.
    await context.addInitScript(() => { try { localStorage.setItem('arcade-sound', 'off'); } catch {} });
    const page = await context.newPage();
    await page.goto(shot.url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(shot.wait ?? 2500);
    // A page's own prompts and buttons are not part of the picture.
    const hide = shot.hide ?? subject.hide;
    if (hide) await page.addStyleTag({ content: `${hide} { display: none !important; }` });
    if (shot.setup) await page.evaluate(shot.setup);
    const cdp = await context.newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
      frames.push({ data, at: metadata.timestamp });
      await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
    const seconds = shot.seconds ?? 6;
    const t0 = Date.now();
    if (shot.during) await Promise.race([page.evaluate(`(async () => { ${shot.during} })()`).catch((e) => { if (!/closed/.test(e.message)) console.error(shot.key, e.message); }), page.waitForTimeout(seconds * 1000)]);
    const left = seconds * 1000 - (Date.now() - t0);
    if (left > 0) await page.waitForTimeout(left);
    await cdp.send('Page.stopScreencast').catch(() => {});
    await context.close();
    if (!frames.length) throw new Error(`${shot.key}-${side}: no frames`);
    // Each frame is held until the next one was painted.
    let list = '';
    for (const [i, fr] of frames.entries()) {
      const name = join(tmp, `${String(i).padStart(5, '0')}.jpg`);
      await writeFile(name, Buffer.from(fr.data, 'base64'));
      const next = frames[i + 1]?.at ?? fr.at + 1 / 30;
      list += `file '${name}'\nduration ${Math.max(0.001, next - fr.at).toFixed(4)}\n`;
    }
    list += `file '${join(tmp, `${String(frames.length - 1).padStart(5, '0')}.jpg`)}'\n`;
    await writeFile(join(tmp, 'list.txt'), list);
    ffmpeg('-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-t', String(seconds), '-vf', `fps=30,scale=${size.width}:${size.height}:force_original_aspect_ratio=increase,crop=${size.width}:${size.height}`, '-q:v', '3', join(dir, '%04d.jpg'));
    await rm(tmp, { recursive: true, force: true });
  }
  console.log('filmed', shot.key);
}
await browser.close();
