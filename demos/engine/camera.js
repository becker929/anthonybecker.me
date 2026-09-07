/*!
 * The camera rig: a set of framings, eased towards rather than snapped to,
 * plus the two things that hit it (shake and a directional punch) and the
 * screen-to-ground maths input needs.
 *
 * Movement is read *relative to the camera* — screen-up is the way the
 * camera looks, flattened to the floor — so under an orbit or a shoulder
 * framing the thumb still means what it says. That is `boardVec()` and the
 * two helpers on it, and it is why they live with the camera rather than
 * with input.
 *
 * A *frame* is one framing: where the camera wants to be, what it wants to
 * look at, how fast it eases there, and optionally a lens of its own. The
 * five shipped ones cover a board game; a demo passes `frames` to add its
 * own (a chase camera behind a vehicle, say) or to replace one, and `modes`
 * to say which of them it offers and in what order the C key cycles.
 *
 * A frame on a world that scrolls sets `tracks: true`. Easing towards a
 * point that is running away at fifteen units a second leaves a permanent
 * lag — the camera settles a fixed distance behind wherever it was aiming,
 * which on a board is invisible and on a ride is the difference between a
 * framing and a stern chase. With `tracks`, the rig carries its current
 * position and target along by however far the focus moved *before* it
 * eases, so the easing only ever has the framing's own change to absorb and
 * the lag is zero however fast the world is going.
 *
 * The shipped frames take three x anchors so a game can say what each one
 * rides without the rig knowing why:
 *
 *   anchorX  the x `fixed` is pinned to (a board's centre; a road's arena)
 *   followX  the x `follow` centres on
 *   orbitX   the x `orbit` turns around
 */
import * as THREE from "./three.js";
import { clamp, clamp01, easeOutQuad, angleTo, aimDir } from "./math.js";

/**
 * The shipped framings. `place` writes the wanted position and target;
 * `rate` is the easing time constant in ms; `fov`, when set, opts the frame
 * out of the fitted lens and pins one of its own.
 */
export const STANDARD_FRAMES = {
  fixed: {
    // the built-with framing; the camera leans a little towards the player,
    // and the whole shot rides `anchorX` when there is one.
    rate: 400,
    place({ focus, anchorX, rig }, want, wantT) {
      const lean = (focus.x - anchorX) * 0.18;
      wantT.set(anchorX + lean, rig.lookAt.y, rig.lookAt.z);
      want.set(rig.home.x + anchorX + lean * 0.6, rig.home.y, rig.home.z);
    },
  },
  follow: {
    // the same angle, closer, keeping the player near the centre
    rate: 260,
    place({ focus, followX }, want, wantT) {
      wantT.set(followX, 0.2, focus.z * 0.6);
      want.set(followX, 2.9, focus.z * 0.6 + 4.1);
    },
  },
  orbit: {
    rate: 120,
    place({ orbitX, rig }, want, wantT) {
      wantT.set(orbitX, 0.1, 0);
      const cp = Math.cos(rig.pitch);
      want.set(Math.sin(rig.yaw) * cp * rig.dist, Math.sin(rig.pitch) * rig.dist, Math.cos(rig.yaw) * cp * rig.dist).add(wantT);
    },
  },
  shoulder: {
    // behind the player, looking where the barrel looks; the aim swings it.
    // Not framing the board, so it keeps a lens of its own.
    rate: 260, fov: 52,
    place({ focus, aim, rig }, want, wantT) {
      aimDir(aim, rig._v);
      wantT.set(focus.x + rig._v.x * 3.2, 0.15, focus.z + rig._v.z * 3.2);
      want.set(focus.x - rig._v.x * 3.0, 2.2, focus.z - rig._v.z * 3.0);
    },
  },
  top: {
    // straight down, following loosely; the small z offset keeps the up vector honest
    rate: 300,
    place({ focus }, want, wantT) {
      wantT.set(focus.x * 0.5, 0, focus.z * 0.5);
      want.set(focus.x * 0.5, 8.4, focus.z * 0.5 + 0.9);
    },
  },
};

export const STANDARD_MODES = Object.keys(STANDARD_FRAMES);

export class CameraRig {
  constructor(camera, {
    frames = null,                               // extra or replacement framings, merged over the shipped ones
    modes = STANDARD_MODES,
    mode = modes[0],
    home = new THREE.Vector3(0, 3.3, 4.9),      // where `fixed` sits, before its anchor
    lookAt = new THREE.Vector3(0, 0.05, 0.1),   // and what it looks at
    fitWidth = 6,                                // world units that must stay in frame
    fovRange = [30, 95],
    punchMs = 250,
    punchDist = 0.12,
    onModeChange = null,
  } = {}) {
    this.camera = camera;
    this.frames = frames ? { ...STANDARD_FRAMES, ...frames } : STANDARD_FRAMES;
    this.modes = modes;
    this.mode = modes.includes(mode) ? mode : modes[0];
    this.home = home.clone();
    this.lookAt = lookAt.clone();
    this.fitWidth = fitWidth;
    this.fovRange = fovRange;
    this.punchMs = punchMs;
    this.punchDist = punchDist;
    this.onModeChange = onModeChange;

    this.pos = home.clone();
    this.target = lookAt.clone();
    camera.position.copy(this.pos);
    camera.lookAt(this.target);

    this.yaw = 0.55; this.pitch = 0.62; this.dist = 6.2;
    this.shake = 0;
    this._punch = { x: 0, z: 0, t0: -1e9 };

    this._want = new THREE.Vector3();
    this._wantT = new THREE.Vector3();
    this._prevFocus = new THREE.Vector3();
    this._focusDelta = new THREE.Vector3();
    this._hasPrevFocus = false;
    this._v = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  // ---------- modes ----------

  setMode(m, via) {
    if (!this.modes.includes(m)) return;
    this.mode = m;
    this.onModeChange?.(m, via);
  }
  cycle(via) { this.setMode(this.modes[(this.modes.indexOf(this.mode) + 1) % this.modes.length], via); }
  /** Turn or tilt the orbit; any of these switches to it. */
  orbitBy(dyaw, dpitch, via) {
    if (this.mode !== "orbit") this.setMode("orbit", via);
    this.yaw += dyaw;
    this.pitch = clamp(this.pitch + dpitch, 0.15, 1.45);
  }
  /** The wheel: zoom the orbit, switching to it. */
  zoom(deltaY, via, range = [3.4, 11]) {
    if (this.mode !== "orbit") this.setMode("orbit", via);
    this.dist = clamp(this.dist * Math.exp(deltaY * 0.0012), range[0], range[1]);
  }

  // ---------- what hits it ----------

  /** Bump the shake envelope. Callers gate this on reduced motion. */
  bump(amount) { this.shake = Math.max(this.shake, amount); }
  /**
   * The damage punch: kick away from a hit's own travel direction and ease
   * back. A vector plus a start time, same shape as the shake, so a second
   * hit mid-recovery restarts the ease rather than fighting it.
   */
  punch(vx, vz, now) {
    const len = Math.hypot(vx, vz) || 1;
    this._punch = { x: -(vx / len) * this.punchDist, z: -(vz / len) * this.punchDist, t0: now };
  }

  // ---------- per frame ----------

  update({ focus, aim = 0, frameDt, now, anchorX = 0, followX = focus.x, orbitX = 0 }) {
    const frame = this.frames[this.mode] ?? this.frames[this.modes[0]];
    // A framing on a scrolling world moves with it first, then eases (see
    // `tracks`, in this file's header). Without this the easing is spent
    // chasing the world instead of the framing, and never catches up.
    if (frame.tracks) {
      if (this._hasPrevFocus) {
        this._focusDelta.subVectors(focus, this._prevFocus);
        this.pos.add(this._focusDelta);
        this.target.add(this._focusDelta);
      }
      this._prevFocus.copy(focus);
      this._hasPrevFocus = true;
    } else this._hasPrevFocus = false;
    frame.place({ focus, aim, anchorX, followX, orbitX, rig: this }, this._want, this._wantT);
    const k = Math.min(1, frameDt / (frame.rate ?? 300));
    this.pos.lerp(this._want, k);
    this.target.lerp(this._wantT, k);
    this.camera.position.copy(this.pos);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.pow(0.001, frameDt / 320);
    } else this.shake = 0;
    const pu = clamp01((now - this._punch.t0) / this.punchMs);
    if (pu < 1) {
      const decay = 1 - easeOutQuad(pu);
      this.camera.position.x += this._punch.x * decay;
      this.camera.position.z += this._punch.z * decay;
    }
    this.camera.lookAt(this.target);
    this.fitFov();
  }

  /**
   * Widen the lens until `fitWidth` fits: the horizontal half-angle needed
   * at the camera's distance, turned into the vertical fov the aspect
   * implies. Landscape never needs more than the fov it was framed at. A
   * frame that is not framing the board declares a `fov` and keeps it.
   */
  fitFov() {
    const camera = this.camera;
    const frame = this.frames[this.mode] ?? this.frames[this.modes[0]];
    let fov;
    if (frame.fov != null) fov = frame.fov;
    else {
      const dist = this.pos.distanceTo(this.target);
      const halfW = this.fitWidth / 2 + 0.5;
      const vfov = 2 * Math.atan(halfW / dist / camera.aspect) * (180 / Math.PI);
      fov = Math.max(this.fovRange[0], Math.min(this.fovRange[1], vfov));
    }
    if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  // ---------- screen to ground ----------

  /** A screen vector as a ground vector: screen-up is the way the camera looks. */
  boardVec(sx, sy, out) {
    this._fwd.subVectors(this.target, this.pos); this._fwd.y = 0;
    if (this._fwd.lengthSq() < 1e-6) this._fwd.set(0, 0, -1); else this._fwd.normalize();
    this._right.set(-this._fwd.z, 0, this._fwd.x);
    return out.set(this._right.x * sx - this._fwd.x * sy, 0, this._right.z * sx - this._fwd.z * sy);
  }
  /** A screen vector as an angle in the ground plane. */
  angleOfScreen(sx, sy) { this.boardVec(sx, sy, this._v); return angleTo(0, 0, this._v.x, this._v.z); }
  /** A screen vector as a step: the dominant ground axis, or both when both are asked for. */
  stepOfScreen(sx, sy, both) {
    this.boardVec(sx, sy, this._v);
    const ax = Math.abs(this._v.x), az = Math.abs(this._v.z);
    if (both) return [ax > 0.3 ? Math.sign(this._v.x) : 0, az > 0.3 ? Math.sign(this._v.z) : 0];
    return ax >= az ? [Math.sign(this._v.x), 0] : [0, Math.sign(this._v.z)];
  }
  /** Where a screen point lands on the ground plane, or null behind the horizon. */
  screenToGround(canvas, clientX, clientY, out) {
    const rect = canvas.getBoundingClientRect();
    this._ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    return this._ray.ray.intersectPlane(this._plane, out);
  }
}
