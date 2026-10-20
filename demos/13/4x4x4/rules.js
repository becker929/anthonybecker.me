// Solo chess in a 4x4 tower of up to four floors. Every move is a capture,
// any piece may take any other, no piece may capture more than twice, and a
// puzzle is solved when one piece is left. Shared by the page, gen.mjs and the
// simulated players, so every level is judged by the rules you play by.
//
// A level is { p, f, rules, goal }: pieces "R000 B001" (type, x, y, z), floor
// count f, rules a subset of "leap" (every capture changes floor), "grav"
// (pieces fall down their column after each capture), "turn" (the capturer
// becomes what it took), and goal null or the [x, y, z] cell the last piece
// must stand on. With f = 1 and no rules this is exactly Four by Four.

export const N = 4;
export const MAX_CAPTURES = 2;

const perms = (a, b, c) => {
  const s = new Set();
  for (const [x, y, z] of [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]])
    for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) s.add([x * sx, y * sy, z * sz].join());
  return [...s].map((v) => v.split(",").map(Number));
};
export const O6 = perms(1, 0, 0);   // along one axis
export const F12 = perms(1, 1, 0);  // two axes change: face diagonals
export const T8 = perms(1, 1, 1);   // all three change: corner diagonals
export const N24 = perms(1, 2, 0);
const K26 = [...O6, ...F12, ...T8];
const PAWN = [[1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1]]; // forward is +y

export const MOVES = {
  R: { slide: true, dirs: O6 },
  B: { slide: true, dirs: F12 },
  U: { slide: true, dirs: T8 },
  Q: { slide: true, dirs: K26 },
  K: { slide: false, dirs: K26 },
  N: { slide: false, dirs: N24 },
  P: { slide: false, dirs: PAWN },
};

export function at(pos, x, y, z) {
  return pos.find((p) => p.x === x && p.y === y && p.z === z);
}

export function parse(s) {
  // "R000 N211" -> pieces with ids, captures starting at zero.
  return s.split(" ").map((w, i) => ({ t: w[0], x: +w[1], y: +w[2], z: +w[3], c: 0, i }));
}

export const key = (pos) => pos.map((p) => p.t + p.x + p.y + p.z + p.c).sort().join("");

// The rules of one level, bound once.
export function rulesFor(lv) {
  const f = lv.f || 1, rules = lv.rules || [], goal = lv.goal || null;
  const leap = rules.includes("leap"), grav = rules.includes("grav"), turn = rules.includes("turn");
  const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < N && y < N && z < f;

  // Cells this piece could capture on by its movement alone, ignoring Leap.
  function reach(pos, p) {
    if (p.c >= MAX_CAPTURES) return [];
    const out = [];
    const m = MOVES[p.t];
    for (const [dx, dy, dz] of m.dirs) {
      let x = p.x + dx, y = p.y + dy, z = p.z + dz;
      while (inside(x, y, z)) {
        if (at(pos, x, y, z)) { out.push([x, y, z]); break; }
        if (!m.slide) break;
        x += dx; y += dy; z += dz;
      }
    }
    return out;
  }
  function targets(pos, p) {
    const out = reach(pos, p);
    return leap ? out.filter((t) => t[2] !== p.z) : out;
  }
  // Under Leap, the takes your eye finds but the rule forbids (shown dimmed).
  function barred(pos, p) {
    return leap ? reach(pos, p).filter((t) => t[2] === p.z) : [];
  }
  function settle(pos) {
    const cols = new Map();
    for (const q of pos) { const k = q.x * N + q.y; if (!cols.has(k)) cols.set(k, []); cols.get(k).push(q); }
    for (const col of cols.values()) col.sort((a, b) => a.z - b.z).forEach((q, i) => { q.z = i; });
    return pos;
  }
  function move(pos, from, [x, y, z]) {
    const victim = at(pos, x, y, z);
    const next = pos.filter((q) => q !== victim)
      .map((q) => (q === from ? { ...q, x, y, z, c: q.c + 1, t: turn ? victim.t : q.t } : { ...q }));
    return grav ? settle(next) : next;
  }
  const done = (pos) => pos.length === 1 && (!goal || (pos[0].x === goal[0] && pos[0].y === goal[1] && pos[0].z === goal[2]));
  const settled = (pos) => pos.every((p) => p.z === 0 || at(pos, p.x, p.y, p.z - 1));

  // Every solution as a list of [fx, fy, fz, tx, ty, tz]; capped for speed.
  function solve(pos, cap = 1e9) {
    const sols = [];
    const dead = new Set();
    const walk = (cur, path) => {
      if (sols.length >= cap) return;
      if (cur.length === 1) { if (done(cur)) sols.push(path.slice()); return; }
      const k = key(cur);
      if (dead.has(k)) return;
      const before = sols.length;
      for (const p of cur) {
        for (const t of targets(cur, p)) {
          path.push([p.x, p.y, p.z, ...t]);
          walk(move(cur, p, t), path);
          path.pop();
          if (sols.length >= cap) return;
        }
      }
      if (sols.length === before) dead.add(k);
    };
    walk(pos, []);
    return sols;
  }
  return { f, leap, grav, turn, goal, inside, targets, barred, move, done, settled, solve };
}
