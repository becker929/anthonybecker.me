/*!
 * Square-to-square movement: the "one hop per ration" model.
 *
 * A hop is a crouch, an arc and a landing squash, and the square you count
 * as standing on changes at the *top of the arc*, not on take-off and not
 * on landing. The ration — the minimum time between one hop starting and
 * the next — is the sum of the three phases, so a held direction chains
 * hops with no dead frame, and an ask that arrives inside the ration is
 * queued rather than dropped.
 *
 * A hop is never diagonal. When both axes are asked for, the preferred one
 * goes first, but a blocked axis yields to the other: a stick pressed on a
 * diagonal into a wall should still move the half that was fine.
 *
 * The hopper knows nothing about what is on the board. `free(col, row)` is
 * the game's answer to "may I stand there", and every landmark of the hop
 * is a callback.
 */

export const DEFAULT_TIMING = { windup: 40, air: 115, settle: 75 };
export const timingTotal = (t) => t.windup + t.air + t.settle;
/** The square changes here: half way through the arc. */
export const timingCommit = (t) => t.windup + t.air / 2;

export class Hopper {
  constructor({
    col = 0, row = 0,
    timing = DEFAULT_TIMING,
    free = () => true,          // (col, row) => may the body stand there
    canTarget = null,           // (col, row) => may a walk be aimed at there at all
    onTarget = null,            // (col, row, accepted) — a walk was asked for; the game's feedback
    onBegin = null,             // (toCol, toRow, fromCol, fromRow, t) — a hop starts
    onLeave = null,             // (col, row) — the feet leave the ground
    onCommit = null,            // (col, row) — the square counted as stood on changes
    onLand = null,              // (col, row) — the feet come down
  } = {}) {
    this.timing = timing;
    this.total = timingTotal(timing);
    this.commitAt = timingCommit(timing);
    this.free = free;
    this.canTarget = canTarget;
    this.cb = { onBegin, onLeave, onCommit, onLand, onTarget };

    this.col = col; this.row = row;
    this.hop = null;            // { fromCol, fromRow, toCol, toRow, t0, committed, left, landed }
    this.path = null;           // { col, row } — a tap to walk towards
    this.queued = null;         // an ask that arrived inside the ration
    this.lastMoveAt = -1e9;
    this.lastIdleAt = 0;        // when the last hop finished
    this.lastFrom = null;       // [col, row] hopped from most recently — runPath's anti-backtrack pass
    this.phase = "idle";
  }

  ready(t) { return t - this.lastMoveAt >= this.total; }
  /** Counting a hop in the air as already on the square it is going to. */
  occupies(col, row) {
    return (this.col === col && this.row === row) || !!(this.hop && this.hop.toCol === col && this.hop.toRow === row);
  }

  /** Take a step by (dc, dr). `preferRow` puts the row axis first on a diagonal. */
  move(dc, dr, t, preferRow = false) {
    if (!(dc || dr)) return;
    this.path = null;
    if (!this.ready(t)) { this.queued = { kind: "by", dc, dr, preferRow }; return; }
    if (dc && dr) {
      const first = preferRow ? [0, dr] : [dc, 0];
      const second = preferRow ? [dc, 0] : [0, dr];
      const ok = (d) => this.free(this.col + Math.sign(d[0]), this.row + Math.sign(d[1]));
      [dc, dr] = ok(first) ? first : second;
    }
    const col = this.col + Math.sign(dc), row = this.row + Math.sign(dr);
    if (!this.free(col, row)) return;
    this.go(col, row, t);
  }

  /**
   * Walk towards a square: beside you it is one hop, further away a path.
   * `canTarget` refuses a destination outright (off the board, something
   * standing on it) — the refusal still goes to `onTarget`, because a tap
   * that does nothing and says nothing reads as a dropped input.
   */
  moveTo(col, row, t) {
    if (this.canTarget && !this.canTarget(col, row)) { this.cb.onTarget?.(col, row, false); return; }
    if (col === this.col && row === this.row) { this.path = null; return; }
    this.cb.onTarget?.(col, row, true);
    this.path = { col, row };
    // A fresh destination starts its own run of steps: runPath's
    // anti-backtrack pass must only refuse the tile *this* walk just left,
    // not whatever an earlier, unrelated walk happened to leave standing
    // there — otherwise the first step of a walk that legitimately doubles
    // back reads as a backtrack and the router picks the wrong way.
    this.lastFrom = null;
    this.runPath(t);
  }

  /**
   * The next step of the path, when the ration allows. Larger axis first; a
   * blocked axis yields to the other. A single obstacle never needs more
   * than that plus one sidestep — but two obstacles placed to pinch a
   * straight line from both diagonal sides can trap a greedy router in a
   * two-tile ping-pong, so the tile just left is skipped on a first pass
   * and only allowed on a second if truly nothing else is free.
   */
  runPath(t) {
    const p = this.path;
    if (!p) return;
    if (p.col === this.col && p.row === this.row) { this.path = null; return; }
    if (!this.ready(t)) return;
    const dc = p.col - this.col, dr = p.row - this.row;
    const byCol = [this.col + Math.sign(dc), this.row], byRow = [this.col, this.row + Math.sign(dr)];
    const order = Math.abs(dc) >= Math.abs(dr) ? [byCol, byRow] : [byRow, byCol];
    const detour = [[this.col, this.row + 1], [this.col, this.row - 1], [this.col + 1, this.row], [this.col - 1, this.row]];
    const candidates = [...order, ...detour];
    const back = this.lastFrom;
    const isBack = (c, r) => back && c === back[0] && r === back[1];
    for (const [c, r] of candidates) {
      if ((c !== this.col || r !== this.row) && !isBack(c, r) && this.free(c, r)) { this.go(c, r, t); return; }
    }
    for (const [c, r] of candidates) {
      if ((c !== this.col || r !== this.row) && this.free(c, r)) { this.go(c, r, t); return; }
    }
  }

  /** Spend the ration on a hop to (col, row). */
  go(col, row, t) {
    this.lastMoveAt = t;
    // a hop still in the air when the next begins lands first: no square is skipped
    const prev = this.hop;
    if (prev && !prev.committed) {
      prev.committed = true;
      this.col = prev.toCol; this.row = prev.toRow;
      this.cb.onCommit?.(this.col, this.row);
    }
    if (col === this.col && row === this.row) { this.hop = null; return; }
    this.lastFrom = [this.col, this.row];
    const fromCol = this.col, fromRow = this.row;
    this.hop = { fromCol, fromRow, toCol: col, toRow: row, t0: t, committed: false, left: false, landed: false };
    this.cb.onBegin?.(col, row, fromCol, fromRow, t);
  }

  update(t) {
    const h = this.hop;
    if (!h) { this.phase = "idle"; return; }
    const dt = t - h.t0;
    const { windup, air } = this.timing;
    if (!h.left && dt >= windup) { h.left = true; this.cb.onLeave?.(h.fromCol, h.fromRow); }
    if (!h.committed && dt >= this.commitAt) {
      h.committed = true;
      this.col = h.toCol; this.row = h.toRow;
      this.cb.onCommit?.(this.col, this.row);
    }
    if (!h.landed && dt >= windup + air) { h.landed = true; this.cb.onLand?.(h.toCol, h.toRow); }
    if (dt >= this.total) { this.hop = null; this.phase = "idle"; this.lastIdleAt = t; return; }
    this.phase = dt < windup ? "windup" : dt < windup + air ? "air" : "settle";
  }

  flushQueued(t) {
    const q = this.queued;
    if (!q || !this.ready(t)) return;
    this.queued = null;
    if (q.kind === "to") this.moveTo(q.col, q.row, t);
    else this.move(q.dc, q.dr, t, q.preferRow);
  }
  /** Ask again for a held direction; the ration paces it. */
  poll(dc, dr, t, preferRow = false) {
    if (!(dc || dr) || !this.ready(t)) return;
    this.move(dc, dr, t, preferRow);
  }
}
