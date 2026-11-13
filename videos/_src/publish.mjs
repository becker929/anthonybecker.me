// Puts a subject's videos in R2 and adds them to the library's index, which anthonybecker.me/videos/
// reads. Run from anywhere; wrangler must be signed in on this Mac.
//   node publish.mjs <work>
//
// R2 bucket anthonybecker-audio, under audio/video/library/ (served at /audio/video/library/...):
//   <slug>/<style>.mp4, <slug>/<style>.jpg, <slug>/subject.json, and index.json for the whole library.
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const WORK = resolve(process.argv[2]);
const SITE = `${process.env.HOME}/_agent_scratch/site`;
const BUCKET = 'anthonybecker-audio/audio/video/library';
const subject = JSON.parse(await readFile(join(WORK, 'subject.json'), 'utf8'));
const { made } = JSON.parse(await readFile(join(WORK, 'made.json'), 'utf8'));

function put(key, file, type) {
  execFileSync('npx', ['--yes', 'wrangler', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--content-type', type,
    '--cache-control', key.endsWith('index.json') ? 'no-cache' : 'public, max-age=31536000, immutable', '--remote'], { cwd: SITE, stdio: ['ignore', 'ignore', 'inherit'] });
}
// Files are named by their content, so a remade video never collides with a cached old one.
const hashOf = async (file) => createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 10);

const entry = { slug: subject.slug, title: subject.title, when: subject.when, pitch: subject.pitch, repo: subject.repo, prs: subject.prs || [], url: subject.url, made: new Date().toISOString(), styles: {} };
for (const [style, m] of Object.entries(made)) {
  const v = `${subject.slug}/${style}-${await hashOf(m.mp4)}.mp4`, p = `${subject.slug}/${style}-${await hashOf(m.poster)}.jpg`;
  put(v, m.mp4, 'video/mp4');
  put(p, m.poster, 'image/jpeg');
  entry.styles[style] = { video: `/audio/video/library/${v}`, poster: `/audio/video/library/${p}`, seconds: m.seconds, w: m.w, h: m.h, ...(m.fingerprint ? { fingerprint: m.fingerprint, grammar: m.grammar } : {}) };
  console.log('uploaded', style);
}
put(`${subject.slug}/subject.json`, join(WORK, 'subject.json'), 'application/json');

// The index: fetched fresh, the entry replaced or added, written back.
let index = { videos: [] };
try { index = await (await fetch('https://anthonybecker.me/audio/video/library/index.json', { cache: 'no-store' })).json(); } catch {}
index.skipped = index.skipped || [];
index.videos = [entry, ...(index.videos || []).filter((x) => x.slug !== entry.slug)].sort((a, b) => (b.made || '').localeCompare(a.made || ''));
index.updated = new Date().toISOString();
const tmp = join(WORK, 'index.json');
await writeFile(tmp, JSON.stringify(index, null, 1));
put('index.json', tmp, 'application/json');
console.log(`published ${entry.slug}: https://anthonybecker.me/videos/#${entry.slug}`);
