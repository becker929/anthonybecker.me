// Lists the work that has no videos yet: merged pull requests in Anthony's repositories, minus those the
// library's index already covers. Prints JSON for the video job to read.
//   node subjects.mjs [since YYYY-MM-DD]
//
// The job groups related pull requests into one subject; this only finds candidates.
const since = process.argv[2] || '2026-11-12';
import { execFileSync } from 'node:child_process';

const prs = JSON.parse(execFileSync('gh', ['search', 'prs', '--owner', 'becker929', '--merged', '--merged-at', `>=${since}`,
  '--json', 'repository,number,title,url,closedAt,body', '--limit', '200'], { encoding: 'utf8' }));
let index = { videos: [] };
try { index = await (await fetch('https://anthonybecker.me/audio/video/library/index.json', { cache: 'no-store' })).json(); } catch {}
const covered = new Set([...(index.videos || []).flatMap((v) => v.prs || []), ...(index.skipped || []).map((s) => s.pr)]);
// The recent hype films' fingerprints, so a new hype film can steer away from their choices.
const recent = (index.videos || []).slice(0, 8).map((v) => v.styles?.hype?.fingerprint).filter(Boolean);
const open = prs.filter((p) => !covered.has(p.url)).map((p) => ({ repo: p.repository.nameWithOwner, number: p.number, title: p.title, url: p.url, merged: p.closedAt, body: (p.body || '').slice(0, 1200) }));
console.log(JSON.stringify({ since, uncovered: open.sort((a, b) => a.merged.localeCompare(b.merged)), library: (index.videos || []).length, recent }, null, 1));
