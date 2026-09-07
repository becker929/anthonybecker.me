/*!
 * The sim clock: one number every timer in a game reads, and three ways of
 * bending it — a slow-motion divisor, hit-stop, and pause.
 *
 * The whole point of putting freezing *here* rather than threading a
 * "frozen" flag through every phase's `t - t0` is that nothing downstream
 * has to know. Holding still is just "the offset grows to match the real
 * time that passed", so a hop's arc, an enemy's telegraph, a countdown and
 * a popup's fade all honour a hit-stop for free.
 */

const DEFAULT_MAX_HITSTOP = 150;

export class Clock {
  /**
   * `slow`: run at 1/N speed — the same motion, stretched, for looking at
   * poses. `maxHitStop`: never freeze longer than this at once, however
   * many freezes stack.
   */
  constructor({ slow = 1, maxHitStop = DEFAULT_MAX_HITSTOP, reducedMotion = false } = {}) {
    this.slow = Math.max(1, slow);
    this.maxHitStop = maxHitStop;
    this.reducedMotion = reducedMotion;

    // Once a test hands the sim over to `takeOver()`, `rawNow()` reads the
    // virtual clock it drives instead of the wall clock, for good — not
    // just while a `simulate()` call is on the stack. A bare hook call
    // between two `simulate()` calls still timestamps itself off `now()`,
    // and every timestamp already sitting in game state was stamped off the
    // same clock, so this one flag has to gate both or the two domains
    // disagree and everything timed off a `t - t0` reads a nonsense delta.
    this.simDriven = false;
    this.simVirtualRaw = 0;

    this._hitstopOffset = 0;         // ms folded out of rawNow() so far
    this._hitstopEndsAtRaw = -Infinity;
    this._hitstopHoldSim = 0;        // the sim time held during that freeze
    this._hitstopResolved = true;    // false while the offset still needs recomputing
    this._paused = false;
    this._pausedSimTime = 0;
  }

  rawNow() { return this.simDriven ? this.simVirtualRaw : performance.now() / this.slow; }

  /** The sim time: `rawNow()` minus every millisecond the sim has been held still. */
  now() {
    if (this._paused) return this._pausedSimTime;
    const raw = this.rawNow();
    if (raw < this._hitstopEndsAtRaw) { this._hitstopResolved = false; return this._hitstopHoldSim; }
    if (!this._hitstopResolved) { this._hitstopOffset = this._hitstopEndsAtRaw - this._hitstopHoldSim; this._hitstopResolved = true; }
    return raw - this._hitstopOffset;
  }

  /** Freeze for `ms`, stacking onto a freeze already running and capped at `maxHitStop`. A no-op under reduced motion. */
  hitStop(ms) {
    if (this.reducedMotion) return;
    const raw = this.rawNow();
    if (raw < this._hitstopEndsAtRaw) { this._hitstopEndsAtRaw = Math.min(this._hitstopEndsAtRaw + ms, raw + this.maxHitStop); return; }
    this._hitstopHoldSim = this.now();
    this._hitstopEndsAtRaw = raw + Math.min(ms, this.maxHitStop);
    this._hitstopResolved = false;
  }

  get paused() { return this._paused; }
  /** Pause holds the sim exactly where it was; resuming folds the real time spent paused back out, so nothing downstream sees a gap. */
  setPaused(p) {
    if (p === this._paused) return;
    if (p) { this._pausedSimTime = this.now(); this._paused = true; }
    else {
      this._paused = false;
      this._hitstopEndsAtRaw = -Infinity;
      this._hitstopOffset = this.rawNow() - this._pausedSimTime;
      this._hitstopResolved = true;
    }
  }

  /** Hand the clock to `advance()`, seeding the virtual time from where the wall clock had got to. Idempotent. */
  takeOver() {
    if (this.simDriven) return;
    this.simDriven = true;
    this.simVirtualRaw = performance.now() / this.slow;
  }
  advance(ms) { this.simVirtualRaw += ms; }
}

/**
 * `matchMedia("(prefers-reduced-motion: reduce)")`, kept live. Pass the
 * result to a `Clock` and read it before every shake, punch or flash: under
 * it there is no hit-stop, no camera shake and no full-screen wash.
 */
export function watchReducedMotion(onChange) {
  const q = matchMedia("(prefers-reduced-motion: reduce)");
  if (onChange) q.addEventListener?.("change", (e) => onChange(e.matches));
  return q.matches;
}
