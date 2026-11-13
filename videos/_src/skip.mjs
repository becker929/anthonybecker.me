// Marks pull requests as needing no videos (too small, not about a website), so the job stops offering
// them. They are kept in the library index under `skipped`, with a reason.
//   node skip.mjs "<reason>" <pr url> [<pr url> ...]
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const [reason, ...urls] = process.argv.slice(2);
if (!reason || !urls.length) { console.error('usage: node skip.mjs "<reason>" <pr url>...'); process.exit(1); }
let index = { videos: [] };
try { index = await (await fetch('https://anthonybecker.me/audio/video/library/index.json', { cache: 'no-store' })).json(); } catch {}
index.skipped = [...(index.skipped || []).filter((s) => !urls.includes(s.pr)), ...urls.map((pr) => ({ pr, reason, at: new Date().toISOString() }))];
const tmp = join(tmpdir(), `video-index-${process.pid}.json`);
await writeFile(tmp, JSON.stringify(index, null, 1));
execFileSync('npx', ['--yes', 'wrangler', 'r2', 'object', 'put', 'anthonybecker-audio/audio/video/library/index.json', '--file', tmp,
  '--content-type', 'application/json', '--cache-control', 'no-cache', '--remote'], { cwd: `${process.env.HOME}/_agent_scratch/site`, stdio: ['ignore', 'ignore', 'inherit'] });
console.log(`skipped ${urls.length}`);
