// Generates levels.json: `node demos/11/four-by-four/gen.mjs`.
// Random positions, solved exhaustively; a level is kept only if it has a
// solution, and harder slots prefer positions with few solving lines and
// many tempting first moves that lead nowhere.
import { writeFileSync } from "node:fs";
import { N, solve, parse, targets, move } from "./rules.js";

let seed = 41;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const BAG = "PPPNNNBBBRRRQQK".split("");

function randomPos(n) {
  const cells = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) cells.push([x, y]);
  const words = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = cells.splice(Math.floor(rnd() * cells.length), 1)[0];
    let t = pick(BAG);
    if (t === "P" && y === N - 1) t = pick("NBR");
    words.push(t + x + y);
  }
  return words.join(" ");
}

function rate(s) {
  const pos = parse(s);
  const sols = solve(pos, 5000).length;
  if (!sols) return null;
  let firsts = 0, deadFirsts = 0;
  for (const p of pos) for (const t of targets(pos, p)) {
    firsts++;
    if (!solve(move(pos, p, t), 1).length) deadFirsts++;
  }
  if (firsts < 2) return null;
  return { s, sols, trap: deadFirsts / firsts };
}

// [pieces, how many levels]
const PLAN = [[3, 3], [4, 4], [5, 5], [6, 5], [7, 5], [8, 5], [9, 3]];
const levels = [];
const seen = new Set();
for (const [n, count] of PLAN) {
  const pool = [];
  for (let tries = 0; pool.length < 200 && tries < 20000; tries++) {
    const s = randomPos(n);
    if (seen.has(s)) continue;
    const r = rate(s);
    if (r) pool.push(r);
  }
  // Harder = fewer solutions and more trap first moves.
  pool.sort((a, b) => (a.sols - b.sols) || (b.trap - a.trap));
  const tough = pool.slice(0, Math.max(count * 4, 20));
  for (let i = 0; i < count; i++) {
    // Within a tier, ease in: take from the gentler end first.
    const r = tough[Math.floor(((count - 1 - i) / count) * tough.length * 0.75)];
    if (!r || seen.has(r.s)) continue;
    seen.add(r.s);
    levels.push({ p: r.s, sols: r.sols, trap: +r.trap.toFixed(2) });
  }
}
writeFileSync(new URL("./levels.json", import.meta.url), JSON.stringify(levels, null, 1) + "\n");
console.log(levels.length, "levels");
for (const l of levels) console.log(l.p.padEnd(32), l.sols, l.trap);
