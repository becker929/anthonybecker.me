// Solo chess on a 4x4 board. Every move is a capture, any piece may take
// any other, and no piece may capture more than twice. A puzzle is solved
// when one piece is left. Shared by the page and by gen.mjs, so the levels
// the generator proved solvable are judged by the same rules you play by.

export const N = 4;
export const MAX_CAPTURES = 2;
export const TYPES = ["P", "N", "B", "R", "Q", "K"];

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ORTHO = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const DIAG = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

// A position is an array of { t, x, y, c } (type, file, rank, captures made).
export function at(pos, x, y) {
  return pos.find((p) => p.x === x && p.y === y);
}

// Squares a piece could capture on; pawns take diagonally up the board (+y).
export function targets(pos, p) {
  if (p.c >= MAX_CAPTURES) return [];
  const out = [];
  const hit = (x, y) => { if (inside(x, y) && at(pos, x, y)) out.push([x, y]); };
  const slide = (dirs) => {
    for (const [dx, dy] of dirs) {
      let x = p.x + dx, y = p.y + dy;
      while (inside(x, y)) {
        if (at(pos, x, y)) { out.push([x, y]); break; }
        x += dx; y += dy;
      }
    }
  };
  switch (p.t) {
    case "P": hit(p.x - 1, p.y + 1); hit(p.x + 1, p.y + 1); break;
    case "N": for (const [dx, dy] of KNIGHT) hit(p.x + dx, p.y + dy); break;
    case "K": for (const [dx, dy] of KING) hit(p.x + dx, p.y + dy); break;
    case "B": slide(DIAG); break;
    case "R": slide(ORTHO); break;
    case "Q": slide(DIAG.concat(ORTHO)); break;
  }
  return out;
}

export function move(pos, from, [x, y]) {
  return pos
    .filter((p) => !(p.x === x && p.y === y))
    .map((p) => (p === from ? { ...p, x, y, c: p.c + 1 } : p));
}

const key = (pos) => pos.map((p) => p.t + p.x + p.y + p.c).sort().join("");

// Every solution as a list of [fromX, fromY, toX, toY]; capped for speed.
export function solve(pos, cap = 1e9) {
  const sols = [];
  const dead = new Set();
  const walk = (cur, path) => {
    if (sols.length >= cap) return;
    if (cur.length === 1) { sols.push(path.slice()); return; }
    const k = key(cur);
    if (dead.has(k)) return;
    const before = sols.length;
    for (const p of cur) {
      for (const t of targets(cur, p)) {
        path.push([p.x, p.y, t[0], t[1]]);
        walk(move(cur, p, t), path);
        path.pop();
      }
    }
    if (sols.length === before) dead.add(k);
  };
  walk(pos, []);
  return sols;
}

export function parse(s) {
  // "R00 N21 P13" -> pieces; captures start at zero.
  return s.split(" ").map((w) => ({ t: w[0], x: +w[1], y: +w[2], c: 0 }));
}
