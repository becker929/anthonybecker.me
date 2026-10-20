// Simulated players, v2. A player explores like a person with Undo:
// depth-first over the captures on the board (tapping shows them all), in
// random order, skipping moves their lookahead says are dead. The lookahead is
// imperfect: inside it, each capture is noticed with a chance that depends on
// how hard its line is to see (flat lines easiest, corner diagonals and 3D
// knight jumps hardest, anything changed by a fall or a type change harder).
// If every move is ruled out they try the pruned ones anyway. Effort = moves
// made plus undos. R = rulesFor(level).
import { key } from "./rules.js";

export const SEE = { flat: 1, up: 0.85, slant: 0.6, corner: 0.45, jump3: 0.4, changed: 0.55 };

function lineClass(p, t) {
  const dx = Math.sign(t[0] - p.x), dy = Math.sign(t[1] - p.y), dz = t[2] - p.z;
  if (dz === 0) return "flat";
  if (p.t === "N") return "jump3";
  const n = (dx !== 0) + (dy !== 0) + 1;
  return n === 1 ? "up" : n === 2 ? "slant" : "corner";
}

export function makeSim(R, base = 0.9) {
  const all = (pos) => { const o = []; for (const p of pos) for (const t of R.targets(pos, p)) o.push([p, t]); return o; };
  // Pieces whose type or column changed since the decision point are harder to track.
  function seen(p, t, root, rnd) {
    let q = base * SEE[lineClass(p, t)];
    const r0 = root.get(p.i);
    if (r0 && (r0.t !== p.t || r0.z !== p.z || r0.x !== p.x || r0.y !== p.y) ) q *= SEE.changed;
    return rnd() < q;
  }
  function deadWithin(pos, h, root, rnd) {
    if (pos.length === 1) return !R.done(pos);
    const ms = all(pos).filter(([p, t]) => seen(p, t, root, rnd));
    if (!ms.length) return true;
    if (h === 0) return false;
    return ms.every(([p, t]) => deadWithin(R.move(pos, p, t), h - 1, root, rnd));
  }
  function play(pos0, skill, rnd) {
    let effort = 0;
    const dead = new Set();
    const dfs = (pos) => {
      if (pos.length === 1) return R.done(pos);
      const ms = all(pos);
      for (let i = ms.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ms[i], ms[j]] = [ms[j], ms[i]]; }
      const root = new Map(pos.map((p) => [p.i, p]));
      const later = [];
      const tryMove = (m) => {
        const next = R.move(pos, m[0], m[1]);
        const k = key(next);
        if (dead.has(k)) return false;
        effort++;
        if (dfs(next)) return true;
        dead.add(k);
        effort++;
        return false;
      };
      for (const m of ms) {
        if (effort > skill.cap) return false;
        // The lookahead only runs on the position after this move, from the
        // mover's point of view: what do I see next?
        if (skill.look > 0) {
          const next = R.move(pos, m[0], m[1]);
          if (!dead.has(key(next)) && deadWithin(next, skill.look - 1, root, rnd)) { later.push(m); continue; }
        }
        if (tryMove(m)) return true;
      }
      for (const m of later) { if (effort > skill.cap) return false; if (tryMove(m)) return true; }
      return false;
    };
    return dfs(pos0) ? effort : Infinity;
  }
  return { play };
}
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Effort samples for one level.
export function efforts(lv, runs, skill, seed) {
  const R = lv.R;
  const S = makeSim(R);
  const r = rng(seed);
  const es = [];
  for (let k = 0; k < runs; k++) es.push(S.play(lv.pos, skill, r));
  return es.sort((a, b) => a - b);
}
