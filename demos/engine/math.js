/*!
 * Scalars, easing and angles. No Three, no DOM, no state — the one engine
 * module a test can import on its own.
 *
 * Board angles, everywhere in the engine and in both demos, are measured in
 * the ground plane: 0 is +x, and positive turns towards -z (the row above).
 * That is the convention `angleTo`, `aimDir` and every "facing" value keep.
 */

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeInOutSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
/** Overshoots past 1 then returns: a landing's spring. */
export const easeOutBack = (t) => { const c = 1.7; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

/** Shortest signed angle from a to b. */
export const angleDelta = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
/** The angle from (x, z) towards (tx, tz). */
export const angleTo = (x, z, tx, tz) => Math.atan2(-(tz - z), tx - x);
/** Unit direction of an angle, written into `out` (a THREE.Vector3-shaped thing). */
export const aimDir = (a, out) => out.set(Math.cos(a), 0, -Math.sin(a));

/**
 * A frame-rate-independent approach: the fraction of the way from here to
 * there to move this frame, for a `tau`-millisecond time constant. Prefer
 * this over a bare `k = dt / tau` wherever a frame can be long — the bare
 * form overshoots past 1 and rings.
 */
export const approach = (dt, tau) => 1 - Math.exp(-dt / tau);

/**
 * A cheap deterministic hash in [0, 1) — for procedural placement that has
 * to come out the same on every run (a test replaying a seed, a terrain
 * chunk rebuilt after it scrolled away and back).
 */
export function hash01(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
