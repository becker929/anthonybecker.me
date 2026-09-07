/*!
 * Input: two sticks, however they are being held.
 *
 * The left stick moves; the right one aims. On a keyboard that is WASD and
 * the arrow keys; on a mouse it is WASD and where the pointer hovers, with
 * the right button as FIRE; on touch the first finger on the canvas is the
 * left stick (a tap on the ground is "go there", a drag past the dead zone
 * is a held direction) and a second finger anywhere is the right one.
 *
 * Everything here is mechanism. What a step *means*, whether a square is
 * walkable, what FIRE does — none of that is known here. The game passes
 * handlers; anything it wants to intercept first (a card over the board
 * swallowing every key but FIRE) it does by returning true from
 * `onKeyDown` / `onPointerDown`, which stops this module's own bookkeeping
 * for that event.
 *
 * FIRE is held by a *set* of sources, not a boolean: the key, the on-screen
 * button and the right mouse button can all be down at once, and the shot
 * only releases when the last of them lets go. Every source also has a
 * window-level release wired up, because a pointerup outside the element,
 * a tab hidden mid-hold, or a capture that never took will each otherwise
 * leave the buster jammed for the rest of the run.
 */
import * as THREE from "./three.js";

export const WASD = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
export const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
export const FIRE_KEYS = new Set(["Space", "KeyJ", "Enter"]);

/** Nothing is gained by holding past a charge, so a hold this long is taken as a release that never arrived. */
const MAX_FIRE_HOLD_MS = 3000;

const isTyping = (e) => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

export class Input {
  constructor({
    canvas,
    rig,                       // a CameraRig: screen vectors are read through it
    now,                       // () => sim time
    deadPx = 26,
    moveKeys = WASD,
    aimKeys = ARROWS,
    fireKeys = FIRE_KEYS,
    // handlers, all optional
    onKeyDown = null,          // (e) => true to swallow the event entirely
    onKey = null,              // (code, e) — anything not move/aim/fire
    onKeyUp = null,
    onMove = null,             // (dc, dr, preferRow) — a fresh press
    onTap = null,              // (clientX, clientY, groundPoint|null)
    onFireDown = null,         // (hold)
    onFireUp = null,           // (hold)
    onHover = null,            // (angle, groundPoint) — a bare mouse over the ground
    onPointerDown = null,      // (e) => true to swallow
    onWheel = null,            // (deltaY, e)
  } = {}) {
    Object.assign(this, { canvas, rig, now, deadPx, moveKeys, aimKeys, fireKeys });
    this.handlers = { onKeyDown, onKey, onKeyUp, onMove, onTap, onFireDown, onFireUp, onHover, onPointerDown, onWheel };

    this.held = new Set();          // move key codes, in press order
    this.heldAimKeys = new Set();
    this.fireHolds = new Set();
    this.pointers = new Map();      // id -> { role: "move" | "aim" | "fire", x0, y0, vec }
    this._point = new THREE.Vector3();

    this._bindKeys();
    this._bindPointers();
  }

  // ---------- FIRE, held by a set of sources ----------

  pressFire(hold = null) {
    if (hold) this.fireHolds.add(hold);
    this.handlers.onFireDown?.(hold);
  }
  /** Let go of one source. The game's own release decides whether that was the last one. */
  dropFire(hold) {
    if (!this.fireHolds.delete(hold)) return;
    this.handlers.onFireUp?.(hold);
  }
  releaseAllFire() {
    this.fireHolds.clear();
    this.handlers.onFireUp?.(null);
  }
  /** True while any source still holds FIRE — the game asks before actually releasing a charge. */
  get firing() { return this.fireHolds.size > 0; }
  /** A hold this old never got its release; the game may let it go. */
  staleHold(hold, t0, t) { return hold && (!this.fireHolds.has(hold) || t - t0 > MAX_FIRE_HOLD_MS); }

  // ---------- keys ----------

  _bindKeys() {
    window.addEventListener("keydown", (e) => {
      if (isTyping(e)) return;
      if (this.handlers.onKeyDown?.(e)) return;
      if (this.moveKeys[e.code]) {
        e.preventDefault();
        if (!this.held.has(e.code)) {
          this.held.add(e.code);
          // a fresh press steps now (or queues inside the ration); a repeat is left to the hold poll
          const hd = this.heldDir();
          if (hd) this.handlers.onMove?.(hd[0], hd[1], hd[2]);
        }
        return;
      }
      if (this.aimKeys[e.code]) { e.preventDefault(); this.heldAimKeys.add(e.code); return; }
      if (this.fireKeys.has(e.code)) { e.preventDefault(); if (!e.repeat) this.pressFire("key"); return; }
      this.handlers.onKey?.(e.code, e);
    });

    window.addEventListener("keyup", (e) => {
      this.held.delete(e.code);
      this.heldAimKeys.delete(e.code);
      if (this.fireKeys.has(e.code)) this.dropFire("key");
      this.handlers.onKeyUp?.(e.code, e);
    });

    window.addEventListener("blur", () => {
      this.held.clear(); this.heldAimKeys.clear();
      this.releaseAllFire();
      this.handlers.onKeyUp?.(null, null);
    });
    // A tab hidden mid-hold never delivers the pointerup or keyup; let go of FIRE.
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.releaseAllFire(); });
    // A release anywhere frees the on-screen button and the right mouse
    // button — the element's own pointerup never arrives when capture did
    // not take.
    window.addEventListener("pointerup", () => { this.dropFire("btn"); this.dropFire("rmb"); });
    window.addEventListener("pointercancel", () => { this.dropFire("btn"); this.dropFire("rmb"); });
  }

  /**
   * Everything held on the movement keys, summed on the screen and turned
   * into one ask per ground axis, plus whether the most recent press was on
   * the screen's vertical so that axis goes first.
   */
  heldDir() {
    if (!this.held.size) return null;
    let sx = 0, sy = 0, lastRow = false;
    for (const code of this.held) { const d = this.moveKeys[code]; sx += d[0]; sy += d[1]; lastRow = d[1] !== 0; }
    if (!sx && !sy) return null;
    const [dc, dr] = this.rig.stepOfScreen(sx, sy, true);
    return dc || dr ? [dc, dr, lastRow] : null;
  }
  /** The move keys as a raw screen vector — for continuous movement, which does not want a quantised step. */
  heldMoveVec() {
    if (!this.held.size) return null;
    let sx = 0, sy = 0;
    for (const code of this.held) { const d = this.moveKeys[code]; sx += d[0]; sy += d[1]; }
    return sx || sy ? [sx, sy] : null;
  }
  /** The aim keys, summed, as a screen vector; null when none is held. */
  heldAim() {
    if (!this.heldAimKeys.size) return null;
    let sx = 0, sy = 0;
    for (const code of this.heldAimKeys) { const d = this.aimKeys[code]; sx += d[0]; sy += d[1]; }
    return sx || sy ? [sx, sy] : null;
  }

  // ---------- pointers ----------

  _roleHeld(role) { for (const p of this.pointers.values()) if (p.role === role) return p; return null; }
  /** The right stick's screen vector, or null. */
  aimStickVec() { const p = this._roleHeld("aim"); return p ? p.vec : null; }
  /** The left stick's screen vector, or null. */
  moveStickVec() { const p = this._roleHeld("move"); return p ? p.vec : null; }

  _bindPointers() {
    const canvas = this.canvas;
    canvas.style.touchAction = "none";
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button === 2) {
        this.pointers.set(e.pointerId, { role: "fire" });
        this.pressFire("rmb");
        return;
      }
      if (this.handlers.onPointerDown?.(e)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const role = this._roleHeld("move") ? (this._roleHeld("aim") ? null : "aim") : "move";
      if (!role) return;
      this.pointers.set(e.pointerId, { role, x0: e.clientX, y0: e.clientY, vec: null });
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) {
        // a bare mouse aims by where it hovers over the ground
        if (e.pointerType === "mouse" && this.rig.screenToGround(canvas, e.clientX, e.clientY, this._point)) {
          this.handlers.onHover?.(this._point);
        }
        return;
      }
      if (p.role === "fire") return;
      const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
      p.vec = Math.hypot(dx, dy) < this.deadPx ? null : [dx, dy];
    });

    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (p.role === "fire") { this.dropFire("rmb"); return; }
      if (p.role !== "move") return;
      const wasTap = !p.vec && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < this.deadPx;
      if (wasTap && e.type === "pointerup") {
        const hit = this.rig.screenToGround(canvas, e.clientX, e.clientY, this._point) ? this._point : null;
        this.handlers.onTap?.(e.clientX, e.clientY, hit);
      }
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.handlers.onWheel?.(e.deltaY, e);
    }, { passive: false });
  }

  /**
   * Wire the on-screen FIRE button. The shot goes first and the capture
   * second, inside a try: on some browsers setPointerCapture throws for a
   * touch pointer, and taking the shot after it meant the button never
   * fired there at all.
   */
  bindFireButton(btn) {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.pressFire("btn");
      try { btn.setPointerCapture(e.pointerId); } catch { /* capture is a nicety; the window-level release covers us */ }
    });
    btn.addEventListener("pointerup", () => this.dropFire("btn"));
    btn.addEventListener("pointercancel", () => this.dropFire("btn"));
    btn.addEventListener("lostpointercapture", () => this.dropFire("btn"));
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}

/**
 * A focused pad button must not eat Space or Enter as a click — those are
 * FIRE. Call once, after the pad exists.
 */
export function releasePadKeys(selector = ".pad button") {
  for (const el of document.querySelectorAll(selector)) {
    el.addEventListener("keydown", (e) => { if (e.code === "Space" || e.code === "Enter") e.preventDefault(); });
  }
}
