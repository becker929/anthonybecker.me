// Generates levels.json: `node demos/13/4x4x4/gen.mjs` (all groups, in
// parallel child processes) or `node gen.mjs <group>` (one, printed as JSON).
//
// Each group of 3-4 puzzles teaches or tests one idea. Its first puzzle is a
// fixed, hand-checked intro; the rest are random positions that the solver
// proves solvable, that need the group's idea (every solution uses it), and
// whose difficulty for the simulated players (sim.mjs) lands near the group's
// step on one effort curve. Effort targets rise by a constant factor per group,
// so the stairs are even; the curve was calibrated on Four by Four, where
// players stopped at puzzles 12, 15, 18 and 20.
import { writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rulesFor, parse, N, MOVES } from "./rules.js";
import { efforts, rng } from "./sim.mjs";

const bag = (s) => s.match(/[A-Z]\d/g).flatMap((w) => Array(+w[1]).fill(w[0]));

// Act (large numeral), floors, rules, bag, intro, then the effort targets of
// the generated puzzles (median moves-plus-undos of the reference player).
export const GROUPS = [
  { act: 1, name: "Upstairs", f: 2, rules: [], bag: "R3Q2K2B1", intro: "R000 B001 K031", n: [3, 5], eff: [3, 4, 6], need: "cross" },
  { act: 1, name: "Slants", f: 2, rules: [], bag: "B3N3R2Q1", intro: "N030 B210 B111", n: [4, 5], eff: [9, 12], need: "slantjump" },
  { act: 1, name: "Footsoldiers", f: 2, rules: [], bag: "P3N2B2R2Q1", intro: "P021 P111 P100", n: [5, 6], eff: [16, 21], need: "pawnup" },
  { act: 2, name: "Unicorn", f: 3, rules: [], bag: "U2R2B2N2P2Q1", intro: "U310 R221 B130", n: [4, 6], eff: [27, 33], need: "unicorn" },
  { act: 2, name: "Leap", f: 3, rules: ["leap"], bag: "R3B3N3P2Q1", intro: "Q110 Q221 B201", n: [5, 7], eff: [38, 44, 50] },
  { act: 2, name: "Spire", f: 3, rules: ["leap"], bag: "U3R2B2N2P2", n: [6, 8], eff: [55, 60, 66], need: "unicorn" },
  { act: 3, name: "Fall", f: 4, rules: ["grav"], bag: "P3N3B3R2U1", intro: "R020 B200 R201", n: [5, 8], eff: [70, 76, 82], need: "fall" },
  { act: 3, name: "Rubble", f: 4, rules: ["grav"], bag: "P3N3B2R2U2", n: [6, 9], eff: [90, 98, 106], need: "fall" },
  { act: 3, name: "Beacon", f: 4, rules: [], goal: true, bag: "R2B2N2U2Q2K1P2", intro: "R321 R212 Q121", introGoal: [2, 1, 2], n: [5, 8], eff: [118, 130] },
  { act: 4, name: "Turncoat", f: 4, rules: ["turn"], bag: "U2B2R2N2P2Q1", intro: "U001 B110 U220", n: [5, 8], eff: [145, 160, 175], need: "turn" },
  { act: 4, name: "Masquerade", f: 4, rules: ["turn", "grav"], bag: "P3N3B2R2U2", n: [6, 9], eff: [190, 210, 230], need: "turn" },
  { act: 4, name: "Last Light", f: 4, rules: ["leap", "turn"], goal: true, bag: "P3N3B2R2U2Q1", n: [6, 9], eff: [250], need: "turn" },
  { act: 4, name: "Last Light", f: 4, rules: ["grav"], goal: true, bag: "U4P2N2B2R2", n: [7, 9], eff: [275], need: "unicorn", join: true },
  { act: 4, name: "Last Light", f: 4, rules: ["grav", "turn"], goal: true, bag: "P3N3B2R2U2", n: [7, 9], eff: [300], need: "turn", join: true },
];

const SKILL = { look: 1, cap: 20000 };
const wordOf = (p) => p.t + p.x + p.y + p.z;

// Does this solution line use the group's idea?
function uses(need, R, pos0, line) {
  if (!need) return true;
  let pos = pos0;
  for (const [fx, fy, fz, tx, ty, tz] of line) {
    const p = pos.find((q) => q.x === fx && q.y === fy && q.z === fz);
    const v = pos.find((q) => q.x === tx && q.y === ty && q.z === tz);
    const next = R.move(pos, p, [tx, ty, tz]);
    const cross = tz !== fz;
    if (need === "cross" && cross) return true;
    if (need === "slantjump" && cross && (p.t === "N" || p.t === "B")) return true;
    if (need === "pawnup" && cross && p.t === "P") return true;
    if (need === "unicorn" && p.t === "U") return true;
    if (need === "turn" && v.t !== p.t) return true;
    if (need === "fall" && next.some((q) => (q.i === p.i ? q.z !== tz : q.z !== pos.find((r) => r.i === q.i).z))) return true;
    pos = next;
  }
  return false;
}

function trapOf(R, pos) {
  let firsts = 0, dead = 0;
  for (const p of pos) for (const t of R.targets(pos, p)) { firsts++; if (!R.solve(R.move(pos, p, t), 1).length) dead++; }
  return firsts ? dead / firsts : 0;
}

function randomPos(g, n, rnd) {
  const B = bag(g.bag);
  const words = [];
  const used = new Set();
  const height = new Array(N * N).fill(0);
  while (words.length < n) {
    const x = Math.floor(rnd() * N), y = Math.floor(rnd() * N);
    let z;
    if (g.rules.includes("grav")) { z = height[x * N + y]; if (z >= g.f) continue; } else z = Math.floor(rnd() * g.f);
    if (used.has(`${x}${y}${z}`)) continue;
    let t = B[Math.floor(rnd() * B.length)];
    if (t === "P" && y === N - 1) continue;
    used.add(`${x}${y}${z}`);
    height[x * N + y]++;
    words.push(t + x + y + z);
  }
  return words.join(" ");
}

// One group: candidates, filtered, rated by simulation, matched to targets.
function genGroup(gi) {
  const g = GROUPS[gi];
  const rnd = rng(1009 + gi * 7919);
  const lvBase = { f: g.f, rules: g.rules };
  const pool = [];
  const t0 = Date.now();
  const seen = new Set();
  // Spread the search over the allowed piece counts; stop at a time budget.
  for (let tries = 0; tries < 400000 && pool.length < 260 && Date.now() - t0 < 240000; tries++) {
    const n = g.n[0] + (tries % (g.n[1] - g.n[0] + 1));
    const p = randomPos(g, n, rnd);
    if (seen.has(p)) continue;
    seen.add(p);
    const pos = parse(p);
    let lv = { ...lvBase, goal: null };
    let R = rulesFor(lv);
    let sols = R.solve(pos, 400);
    if (!sols.length || sols.length >= 400) continue;
    if (g.goal) {
      // The light goes where few lines end.
      const ends = new Map();
      for (const s of sols) { let q = pos; for (const [fx, fy, fz, tx, ty, tz] of s) q = R.move(q, q.find((r) => r.x === fx && r.y === fy && r.z === fz), [tx, ty, tz]); const k = `${q[0].x}${q[0].y}${q[0].z}`; ends.set(k, (ends.get(k) || 0) + 1); }
      if (ends.size < 2) continue;
      const [k] = [...ends].sort((a, b) => a[1] - b[1])[0];
      lv = { ...lvBase, goal: [+k[0], +k[1], +k[2]] };
      R = rulesFor(lv);
      sols = R.solve(pos);
    }
    if (!sols.every((s) => uses(g.need, R, pos, s))) continue;
    // Every solution should leave the floor it started on at least once.
    if (g.f > 1 && !sols.every((s) => s.some((m) => m[2] !== m[5]))) continue;
    if (g.rules.includes("turn") && rulesFor({ ...lv, rules: lv.rules.filter((r) => r !== "turn") }).solve(pos, 1).length) continue;
    const quick = efforts({ R, pos }, 24, SKILL, tries);
    const med = quick[12];
    if (!isFinite(med)) continue;
    pool.push({ p, lv, sols: sols.length, med });
  }
  // Match each target with the closest unused candidate (log scale), then
  // re-measure the winners with more runs.
  const picks = [];
  for (const target of g.eff) {
    const cands = pool.filter((c) => !picks.includes(c)).sort((a, b) => Math.abs(Math.log(a.med / target)) - Math.abs(Math.log(b.med / target)));
    const best = cands.slice(0, 5).map((c) => {
      const R = rulesFor(c.lv);
      const es = efforts({ R, pos: parse(c.p) }, 200, SKILL, 5);
      return { ...c, med: es[100], es };
    }).sort((a, b) => Math.abs(Math.log(a.med / target)) - Math.abs(Math.log(b.med / target)))[0];
    if (best) picks.push(best);
  }
  picks.sort((a, b) => a.med - b.med);
  const out = [];
  if (g.intro) {
    const lv = { f: g.f, rules: g.rules, goal: g.introGoal || null };
    const R = rulesFor(lv);
    const es = efforts({ R, pos: parse(g.intro) }, 200, SKILL, 5);
    out.push({ p: g.intro, ...lv, sols: R.solve(parse(g.intro)).length, trap: +trapOf(R, parse(g.intro)).toFixed(2), eff: es[100], es, intro: true });
  }
  for (const c of picks) {
    const R = rulesFor(c.lv);
    out.push({ p: c.p, f: c.lv.f, rules: c.lv.rules, goal: c.lv.goal, sols: c.sols, trap: +trapOf(R, parse(c.p)).toFixed(2), eff: c.med, es: c.es });
  }
  return { gi, pool: pool.length, secs: Math.round((Date.now() - t0) / 1000), levels: out };
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] === self) {
  if (process.argv[2] != null) {
    console.log(JSON.stringify(genGroup(+process.argv[2])));
  } else {
    const results = await Promise.all(GROUPS.map((_, gi) => new Promise((ok) => {
      let s = "";
      const c = spawn(process.execPath, [self, String(gi)]);
      c.stdout.on("data", (d) => (s += d));
      c.stderr.on("data", (d) => process.stderr.write(d));
      c.on("close", () => ok(JSON.parse(s)));
    })));
    const levels = [];
    for (const r of results) {
      const g = GROUPS[r.gi];
      console.error(`${g.name.padEnd(13)} pool ${r.pool} in ${r.secs}s:`, r.levels.map((l) => `${l.p.split(" ").length}p eff ${l.eff}`).join(", "));
      const prev = levels.at(-1)?.group ?? -1;
      const group = g.join ? prev : prev + 1;
      for (const l of r.levels) levels.push({ ...l, act: g.act, group, name: g.name });
    }
    // The page gets the levels; the effort samples go beside them for checking
    // the curve (sim-efforts.json, not served).
    writeFileSync(new URL("./levels.json", import.meta.url), JSON.stringify(levels.map(({ es, ...l }) => l), null, 1) + "\n");
    writeFileSync(process.env.EFFORTS || "/tmp/4x4x4-efforts.json", JSON.stringify(levels.map((l) => l.es.map((e) => (isFinite(e) ? e : -1)))));
    console.error(levels.length, "levels");
  }
}
