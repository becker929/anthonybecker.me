/*!
 * The juice, minus any opinion about what it is a reaction to: ground
 * rings, puffs of dust, floating text, thrown debris and shot tracers.
 *
 * Everything here is spawn-and-forget — hand it a world position and it
 * lives out its own lifetime and disposes itself. Every lifetime is read
 * off the sim clock, so a hit-stop freezes the aftermath along with the
 * hit, which is most of why hit-stop reads as impact rather than as a
 * dropped frame.
 */
import * as THREE from "./three.js";
import { clamp01, lerp, rand, easeOutQuad, easeOutBack } from "./math.js";
import { textTexture, TEXT_CANVAS_W, TEXT_CANVAS_H } from "./textures.js";

const TEXT_ASPECT = TEXT_CANVAS_H / TEXT_CANVAS_W;

export class Effects {
  /** `discTex` is the shared soft disc (Stage makes one); `clock` supplies `now()`. */
  constructor(scene, clock, discTex) {
    this.scene = scene;
    this.clock = clock;
    this.discTex = discTex;

    this.ripples = [];
    this.rippleGeo = new THREE.RingGeometry(0.2, 0.25, 32);

    this.puffs = [];
    this.puffMat = new THREE.SpriteMaterial({ map: discTex, color: 0x9fb0d0, transparent: true, opacity: 0.5, depthWrite: false });

    this.popups = [];
    this.debris = [];
    this.debrisGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    this.tracers = [];
  }

  // ---------- ground rings ----------

  /** A flat ring that grows and fades where feet, a shot or a spawn came down. */
  ripple(x, z, color, scaleTo = 1.6, ms = 380, y = 0.036) {
    const m = new THREE.Mesh(this.rippleGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    this.scene.add(m);
    this.ripples.push({ m, t0: this.clock.now(), ms, scaleTo });
  }

  // ---------- dust and sparks ----------

  /**
   * A few soft puffs thrown out sideways. The same call, coloured and
   * thrown harder with `additive`, is sparks off a hit or the smoke off a
   * muzzle — one primitive, three jobs.
   *
   * `rise` is the drift of something an atmosphere is holding up. Pass a
   * `gravity` instead and the puff is ballistic: it leaves at `rise`, falls
   * at that rate and settles on the floor, which is what dust does where
   * there is no air to suspend it.
   */
  dust(x, z, count, speed, opts = {}) {
    const { color = 0x9fb0d0, y = 0.05, rise = 0.12, size = [0.08, 0.26], ms = [320, 480], additive = false, gravity = 0 } = opts;
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(this.puffMat.clone());
      s.material.color.set(color);
      if (additive) s.material.blending = THREE.AdditiveBlending;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.5 + Math.random() * 0.5);
      s.position.set(x, y, z);
      s.scale.setScalar(size[0]);
      this.scene.add(s);
      this.puffs.push({ s, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: rise, y0: y, rise, gravity, size, t0: this.clock.now(), ms: rand(ms[0], ms[1]) });
    }
  }

  // ---------- floating text ----------

  /**
   * Text at (x, z) that rises (or, `fall`, sinks) and fades. A world-space
   * sprite, not DOM, so it sits exactly where the thing happened and rides
   * the camera like everything else.
   */
  popup(x, z, text, opts = {}) {
    const { color = "#c9f6ff", y0 = 0.5, rise = 0.5, ms = 650, fall = false, width = 0.62 } = opts;
    const mat = new THREE.SpriteMaterial({ map: textTexture(text, color), transparent: true, depthWrite: false, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.position.set(x, y0, z);
    s.scale.set(0.001, 0.001, 1);
    this.scene.add(s);
    this.popups.push({ s, x, z, y0, drift: fall ? -rise : rise, t0: this.clock.now(), ms, targetW: width });
  }

  // ---------- debris ----------

  /**
   * A handful of small chunks in `palette`'s colours, thrown up and out,
   * bouncing once off the floor. One shared geometry; each chunk gets its
   * own material only because each needs its own fade and colour.
   */
  debrisBurst(x, z, palette, opts = {}) {
    const { count = [5, 7], y = 0.15, ms = 600, speed = [0.5, 1.3], up = [1.2, 2.2], gravity = 4.2, scale = 1 } = opts;
    const n = count[0] + Math.floor(Math.random() * (count[1] - count[0] + 1));
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: palette[Math.floor(Math.random() * palette.length)], transparent: true });
      const m = new THREE.Mesh(this.debrisGeo, mat);
      m.position.set(x, y, z);
      m.scale.setScalar(scale);
      m.rotation.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));
      this.scene.add(m);
      const a = rand(0, Math.PI * 2);
      const sp = rand(speed[0], speed[1]);
      this.debris.push({
        m, x, y, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: rand(up[0], up[1]),
        spinX: rand(-8, 8), spinY: rand(-8, 8), bounced: false, gravity, t0: this.clock.now(), ms,
      });
    }
  }

  // ---------- tracers ----------

  /** A thin line along a shot's whole path, fading fast. */
  tracer(x0, z0, x1, z1, color = 0xc9f6ff, ms = 200, y = 0.28) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x0, y, z0, x1, y, z1]), 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, t0: this.clock.now(), ms });
  }

  // ---------- per frame ----------

  update(t, frameDt) {
    const scene = this.scene;

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      const u = clamp01((t - r.t0) / r.ms);
      const s = lerp(0.6, r.scaleTo, easeOutQuad(u));
      r.m.scale.set(s, s, s);
      r.m.material.opacity = 0.9 * (1 - u);
      if (u >= 1) { scene.remove(r.m); r.m.material.dispose(); this.ripples.splice(i, 1); }
    }

    const k = frameDt / 1000;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      const u = clamp01((t - p.t0) / p.ms);
      p.s.position.x += p.vx * k * (1 - u);
      p.s.position.z += p.vz * k * (1 - u);
      if (p.gravity) {
        p.vy -= p.gravity * k;
        p.s.position.y = Math.max(0.02, p.s.position.y + p.vy * k);
      } else {
        p.s.position.y += p.rise * k;
      }
      p.s.scale.setScalar(lerp(p.size[0], p.size[1], easeOutQuad(u)));
      p.s.material.opacity = 0.5 * (1 - u);
      if (u >= 1) { scene.remove(p.s); p.s.material.dispose(); this.puffs.splice(i, 1); }
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      const u = clamp01((t - p.t0) / p.ms);
      const growU = clamp01(u / 0.22);
      const w = p.targetW * (growU < 1 ? Math.max(0, easeOutBack(growU)) : 1);
      p.s.scale.set(w, w * TEXT_ASPECT, 1);
      p.s.position.set(p.x, p.y0 + p.drift * easeOutQuad(u), p.z);
      p.s.material.opacity = u < 0.65 ? 1 : 1 - (u - 0.65) / 0.35;
      if (u >= 1) { scene.remove(p.s); p.s.material.dispose(); this.popups.splice(i, 1); }
    }

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      const u = clamp01((t - d.t0) / d.ms);
      d.vy -= d.gravity * k;
      d.x += d.vx * k; d.z += d.vz * k; d.y += d.vy * k;
      if (d.y <= 0.03) {
        d.y = 0.03;
        if (!d.bounced) { d.bounced = true; d.vy = Math.abs(d.vy) * 0.4; } else d.vy = Math.max(0, d.vy);
      }
      d.m.position.set(d.x, d.y, d.z);
      d.m.rotation.x += d.spinX * k; d.m.rotation.y += d.spinY * k;
      d.m.material.opacity = 1 - u;
      if (u >= 1) { scene.remove(d.m); d.m.material.dispose(); this.debris.splice(i, 1); }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      const u = clamp01((t - tr.t0) / tr.ms);
      tr.line.material.opacity = 0.9 * (1 - u);
      if (u >= 1) { scene.remove(tr.line); tr.line.geometry.dispose(); tr.line.material.dispose(); this.tracers.splice(i, 1); }
    }
  }
}
