// Juice Box: six things on two shelves, each opened by tapping, and a switch
// for every piece of juice laid over them. The rule the whole file keeps is
// that juice never changes an outcome. Every effect goes through one of the
// gates below (shake, hitstop, flash, ...), and each gate is a no-op when its
// switch is off. The objects make the same state changes and pay out the same
// treasure either way. Switching off Particles is the one case that changes
// how payment looks: coins that would have flown to the counter are added to
// it directly.

const W = 600, H = 640;
const FLOOR1 = 290, FLOOR2 = 560;
const HUD_COIN = { x: 34, y: 36 };

const JUICE = [
  ["shake", "Screen shake"],
  ["hitstop", "Hit stop"],
  ["flash", "Flash"],
  ["particles", "Particles"],
  ["squash", "Squash & stretch"],
  ["easing", "Easing"],
  ["anticipation", "Anticipation"],
  ["punch", "Camera punch"],
  ["shockwave", "Shockwaves"],
  ["text", "Floating text"],
  ["trails", "Trails"],
  ["split", "Color split"],
  ["slowmo", "Slow motion"],
  ["idle", "Idle & hover"],
];
const on = {};
const STORE = "juice-box:v1";

// ---------- small helpers

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const TAU = Math.PI * 2;

const EASE = {
  outBack: (t) => { const c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
  inBack: (t) => { const c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
  outCubic: (t) => 1 - (1 - t) ** 3,
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * TAU) / 3) + 1),
};
// With Easing off every tween is linear: same start, same end, same duration.
const ease = (name, t) => { t = clamp(t, 0, 1); return on.easing ? EASE[name](t) : t; };

// A damped spring on o.x toward target. Semi-implicit Euler, stable at the
// clamped 1/30 s step for the stiffnesses used here.
function spring(o, dt, k, c, target = 0) {
  o.v += (-(o.x - target) * k - o.v * c) * dt;
  o.x += o.v * dt;
}

// ---------- effect gates (camera-level juice)

const fx = { trauma: 0, freeze: 0, slow: 0, flash: 0, flashColor: "#fff", zoom: { x: 0, v: 0 }, split: 0, time: 0 };
const shake = (a) => { if (on.shake) fx.trauma = Math.min(1, fx.trauma + a); };
const hitstop = (s) => { if (on.hitstop) fx.freeze = Math.max(fx.freeze, s); };
const flash = (a, color = "#fff") => { if (on.flash) { fx.flash = Math.max(fx.flash, a); fx.flashColor = color; } };
const punch = (a) => { if (on.punch) fx.zoom.v += a; };
const split = (a) => { if (on.split) fx.split = Math.max(fx.split, a); };
const slowmo = (s) => { if (on.slowmo) fx.slow = Math.max(fx.slow, s); };

// ---------- treasure counter

const hud = { treasure: 0, shown: 0, pop: { x: 0, v: 0 }, pips: [] };
function collect(n) {
  hud.treasure += n;
  if (on.squash) hud.pop.v += 9;
}

// ---------- particles

const P = [];
function emit(p) {
  if (!on.particles) return null;
  p.age = 0;
  p.tr = [];
  P.push(p);
  return p;
}

function sparks(x, y, n, color = "#ffd84a", speed = 380) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), s = rnd(0.4, 1) * speed;
    emit({ kind: "spark", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 600, drag: 3, life: rnd(0.3, 0.6), size: rnd(2, 3.5), color });
  }
}
function dust(x, y, n, spread = 50) {
  for (let i = 0; i < n; i++) {
    emit({ kind: "dust", x: x + rnd(-spread, spread), y: y + rnd(-6, 2), vx: rnd(-90, 90), vy: rnd(-60, -10), g: 0, drag: 4, life: rnd(0.5, 0.9), size: rnd(8, 16) });
  }
}
function stars(x, y, n, color = "#fff3d6") {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, TAU), s = rnd(60, 200);
    emit({ kind: "star", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, g: 120, drag: 2.5, life: rnd(0.5, 0.9), size: rnd(5, 9), rot: rnd(0, TAU), vr: rnd(-6, 6), color });
  }
}
function ring(x, y, r, color = "#fff3d6", life = 0.45) {
  if (!on.shockwave) return;
  emit({ kind: "ring", x, y, vx: 0, vy: 0, g: 0, drag: 0, life, size: r, color });
}
// Coins arc out, bounce on the floor they came from, then home on the
// counter. Each one adds to the treasure when it lands there. Without
// particles the same sum is paid at once.
function coins(x, y, n, floor, spread = 1) {
  if (!on.particles) { collect(n); return; }
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + rnd(-0.7, 0.7) * spread;
    const s = rnd(300, 560);
    emit({ kind: "coin", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 1300, drag: 0.4, life: 99, size: 9, floor, bounce: 0.45, homeAt: rnd(0.75, 1.25), spin: rnd(0, TAU), trail: true, value: 1 });
  }
}
function confetti(x, y, n) {
  const cols = ["#ff4f7e", "#ffd84a", "#4fd6a4", "#5fb8ff", "#fff3d6", "#b88cff"];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + rnd(-1, 1), s = rnd(250, 650);
    emit({ kind: "confetti", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 380, drag: 2.2, life: rnd(1.6, 2.6), size: rnd(5, 8), rot: rnd(0, TAU), vr: rnd(-12, 12), seed: rnd(0, TAU), color: pick(cols) });
  }
}
function hearts(x, y, n) {
  for (let i = 0; i < n; i++) {
    emit({ kind: "heart", x: x + rnd(-20, 20), y, vx: rnd(-40, 40), vy: rnd(-140, -80), g: -20, drag: 1, life: rnd(1.2, 1.8), size: rnd(7, 11), seed: rnd(0, TAU), color: "#ff4f7e" });
  }
}

function updateParticles(dt) {
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.age += dt;
    if (p.kind === "coin") updateCoin(p, dt);
    else if (p.kind === "firefly") updateFirefly(p, dt);
    else if (p.kind === "gem") updateGem(p, dt);
    else {
      p.vy += p.g * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d;
      if (p.kind === "confetti") p.vx += Math.sin(p.age * 7 + p.seed) * 160 * dt;
      if (p.kind === "heart") p.x += Math.sin(p.age * 4 + p.seed) * 30 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += p.vr * dt;
      if (p.floor !== undefined && p.y > p.floor) {
        p.y = p.floor; p.vy *= -(p.bounce || 0.3); p.vx *= 0.6; p.vr = (p.vr || 0) * 0.5;
        if (Math.abs(p.vy) < 50) p.vy = 0;
      }
      if (p.kind === "rocket" && p.age > p.fuse) { burst(p); P.splice(i, 1); continue; }
    }
    if (p.trail && on.trails) { p.tr.push(p.x, p.y); if (p.tr.length > 20) p.tr.splice(0, 2); }
    else if (p.tr.length) p.tr.length = 0;
    if (p.age > p.life || p.dead) P.splice(i, 1);
  }
}

function updateCoin(p, dt) {
  p.spin += dt * 9;
  if (p.age < p.homeAt) {
    p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.y > p.floor) { p.y = p.floor; p.vy *= -p.bounce; p.vx *= 0.7; }
    return;
  }
  // Homing: speed grows the longer it flies, so the last stretch snaps in.
  const dx = HUD_COIN.x - p.x, dy = HUD_COIN.y - p.y, d = Math.hypot(dx, dy);
  const t = p.age - p.homeAt;
  const speed = 300 + t * 2400;
  const k = Math.min(1, dt * 9);
  p.vx += ((dx / d) * speed - p.vx) * k;
  p.vy += ((dy / d) * speed - p.vy) * k;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (d < 16) {
    p.dead = true;
    collect(p.value);
    sparks(HUD_COIN.x, HUD_COIN.y, 2, "#ffd84a", 160);
  }
}

function updateGem(p, dt) {
  p.spin += dt * 4;
  const dx = HUD_COIN.x - p.x, dy = HUD_COIN.y - p.y, d = Math.hypot(dx, dy);
  const speed = 200 + p.age * 1800;
  const k = Math.min(1, dt * 6);
  p.vx += ((dx / d) * speed - p.vx) * k;
  p.vy += ((dy / d) * speed - p.vy) * k;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (d < 18) {
    p.dead = true;
    collect(p.value);
    sparks(HUD_COIN.x, HUD_COIN.y, 10, "#5fb8ff", 260);
    ring(HUD_COIN.x, HUD_COIN.y, 40, "#5fb8ff", 0.35);
    shake(0.15);
  }
}

// Fireflies steer by a slowly turning heading and keep inside the stage.
function updateFirefly(p, dt) {
  p.heading += Math.sin(fx.time * 1.3 + p.seed) * 2.2 * dt + rnd(-1, 1) * dt;
  const sp = p.age < 0.6 ? 220 - p.age * 200 : 70;
  const tx = Math.cos(p.heading) * sp, ty = Math.sin(p.heading) * sp - 15;
  p.vx += (tx - p.vx) * Math.min(1, dt * 3);
  p.vy += (ty - p.vy) * Math.min(1, dt * 3);
  if (p.x < 30) p.vx += 300 * dt; if (p.x > W - 30) p.vx -= 300 * dt;
  if (p.y < 90) p.vy += 300 * dt; if (p.y > H - 40) p.vy -= 300 * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
}

function burst(p) {
  sparks(p.x, p.y, 40, p.color, 420);
  stars(p.x, p.y, 5, p.color);
  ring(p.x, p.y, 70, p.color, 0.5);
  flash(0.25, p.color);
  shake(0.2);
}

function drawParticles(c) {
  for (const p of P) {
    const life = 1 - p.age / p.life;
    if (p.tr.length >= 4) {
      c.strokeStyle = p.kind === "firefly" ? "#d8ff7a" : p.kind === "gem" ? "#5fb8ff" : p.color || "#ffd84a";
      c.lineCap = "round";
      for (let j = 2; j < p.tr.length; j += 2) {
        const a = j / p.tr.length;
        c.globalAlpha = a * 0.5;
        c.lineWidth = (p.kind === "coin" ? 6 : 4) * a;
        c.beginPath(); c.moveTo(p.tr[j - 2], p.tr[j - 1]); c.lineTo(p.tr[j], p.tr[j + 1]); c.stroke();
      }
      c.globalAlpha = 1;
    }
    switch (p.kind) {
      case "spark":
      case "rocketspark": {
        c.globalAlpha = clamp(life * 1.5, 0, 1);
        c.strokeStyle = p.color; c.lineWidth = p.size; c.lineCap = "round";
        const k = on.trails ? 0.035 : 0.004;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * k, p.y - p.vy * k); c.stroke();
        break;
      }
      case "rocket":
        c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, 3.5, 0, TAU); c.fill();
        break;
      case "dust": {
        const r = p.size * (1 + (1 - life) * 1.6);
        c.globalAlpha = life * 0.45; c.fillStyle = "#e8d8c0";
        c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
        break;
      }
      case "star":
        c.globalAlpha = clamp(life * 2, 0, 1); c.fillStyle = p.color;
        starPath(c, p.x, p.y, p.size * (0.4 + life * 0.6), p.rot); c.fill();
        break;
      case "ring": {
        const t = 1 - life;
        const r = p.size * (on.easing ? EASE.outCubic(t) : t);
        c.globalAlpha = life; c.strokeStyle = p.color; c.lineWidth = 2 + life * 8;
        c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke();
        break;
      }
      case "coin": coinShape(c, p.x, p.y, p.size, p.spin); break;
      case "gem": gemShape(c, p.x, p.y, 14, p.spin); break;
      case "confetti":
        c.globalAlpha = clamp(life * 3, 0, 1);
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.cos(p.age * 9 + p.seed));
        c.fillStyle = p.color; c.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
        c.restore();
        break;
      case "chip":
      case "plank":
        c.globalAlpha = clamp(life * 3, 0, 1);
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillStyle = p.color; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c.fillStyle = "#0003"; c.fillRect(-p.w / 2, p.h / 4, p.w, p.h / 4);
        c.restore();
        break;
      case "heart":
        c.globalAlpha = clamp(life * 2, 0, 1); c.fillStyle = p.color;
        heartPath(c, p.x, p.y, p.size); c.fill();
        break;
      case "firefly": {
        const pulse = 0.6 + 0.4 * Math.sin(fx.time * 6 + p.seed);
        c.globalAlpha = clamp((p.life - p.age) * 1.5, 0, 1);
        glow(c, p.x, p.y, 16 + pulse * 10, "rgba(216,255,122,0.55)");
        c.fillStyle = "#f6ffd0"; c.beginPath(); c.arc(p.x, p.y, 3, 0, TAU); c.fill();
        break;
      }
    }
    c.globalAlpha = 1;
  }
}

// ---------- floating text

const T = [];
function say(x, y, str, color = "#fff3d6", size = 26, life = 0.9) {
  if (!on.text) return;
  T.push({ x, y, str, color, size, age: 0, life, rot: rnd(-0.12, 0.12) });
}
function drawText(c, dt) {
  for (let i = T.length - 1; i >= 0; i--) {
    const t = T[i];
    t.age += dt;
    if (t.age > t.life) { T.splice(i, 1); continue; }
    const k = t.age / t.life;
    const s = on.easing ? EASE.outBack(clamp(t.age / 0.18, 0, 1)) : 1;
    const rise = (on.easing ? EASE.outCubic(k) : k) * 46;
    c.save();
    c.translate(t.x, t.y - rise);
    c.rotate(on.easing ? t.rot : 0);
    c.scale(s, s);
    c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    c.font = `900 ${t.size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle";
    c.lineJoin = "round"; c.lineWidth = 6; c.strokeStyle = "#1a1530";
    c.strokeText(t.str, 0, 0);
    c.fillStyle = t.color; c.fillText(t.str, 0, 0);
    c.restore();
  }
}

// ---------- shapes

function starPath(c, x, y, r, rot) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4, rr = i % 2 ? r * 0.35 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}
function heartPath(c, x, y, s) {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4);
  c.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
}
function coinShape(c, x, y, r, spin) {
  const w = Math.abs(Math.cos(spin)) * r + 1.5;
  c.fillStyle = "#b8790f"; c.beginPath(); c.ellipse(x, y + 1.5, w, r, 0, 0, TAU); c.fill();
  c.fillStyle = "#ffd84a"; c.beginPath(); c.ellipse(x, y, w, r, 0, 0, TAU); c.fill();
  c.fillStyle = "#fff6c0"; c.beginPath(); c.ellipse(x - w * 0.3, y - r * 0.3, w * 0.25, r * 0.3, 0, 0, TAU); c.fill();
}
function gemShape(c, x, y, r, spin) {
  const w = (0.55 + 0.45 * Math.abs(Math.cos(spin))) * r;
  c.fillStyle = "#2f7fd6";
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + w, y - r * 0.2); c.lineTo(x, y + r); c.lineTo(x - w, y - r * 0.2); c.closePath(); c.fill();
  c.fillStyle = "#8fd3ff";
  c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + w * 0.5, y - r * 0.2); c.lineTo(x, y + r * 0.4); c.lineTo(x - w * 0.5, y - r * 0.2); c.closePath(); c.fill();
}
function glow(c, x, y, r, color) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
  const op = c.globalCompositeOperation;
  c.globalCompositeOperation = "lighter";
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.globalCompositeOperation = op;
}
// A free-flying piece of an object (a lid, a shell cap) that tumbles off.
function body(x, y, vx, vy, vr, draw, floor) {
  if (!on.particles) return;
  emit({ kind: "body", x, y, vx, vy, g: 1500, drag: 0.2, life: 1.6, rot: 0, vr, draw, floor, bounce: 0.35 });
}

// ---------- the things on the shelves

// Every thing draws itself at its base (0,0), y going up negative. Its
// transform carries the shared juice: squash (vertical spring, horizontal
// compensates), wobble (rotation spring), hover lift, idle breathing, and the
// pop in and out when it resets.
class Thing {
  constructor(name, label, cx, floor, w, h) {
    Object.assign(this, { name, label, cx, floor, w, h });
    this.sq = { x: 0, v: 0 }; this.rot = { x: 0, v: 0 }; this.hov = { x: 0, v: 0 };
    this.flashT = 0; this.phase = rnd(0, TAU); this.hover = false;
    this.appear = 1; this.appearT = -1; this.leaveT = -1;
    this.reset();
  }
  reset() { this.state = "closed"; this.t = 0; }
  hit(x, y) { return Math.abs(x - this.cx) < this.w / 2 + 12 && y < this.floor + 12 && y > this.floor - this.h - 24; }
  squash(a) { if (on.squash) this.sq.v += a; }
  wobble(a) { if (on.squash) this.rot.v += a; }
  whiten(s) { if (on.flash) this.flashT = s; }
  col(c) { return this.flashT > 0 ? "#fff" : c; }
  get top() { return this.floor - this.h; }
  tap() {}
  opened() {
    this.state = "open"; this.t = 0;
    opened.add(this.name);
  }
  update(dt) {
    spring(this.sq, dt, 340, 13);
    spring(this.rot, dt, 240, 9);
    spring(this.hov, dt, 300, 18, this.hover && on.idle ? 1 : 0);
    this.t += dt;
    this.flashT -= dt;
    if (this.state === "open" && this.t > this.stay && this.leaveT < 0) this.leaveT = 0;
    if (this.leaveT >= 0) {
      this.leaveT += dt;
      this.appear = 1 - ease("inBack", this.leaveT / 0.3);
      if (this.leaveT >= 0.3) {
        this.leaveT = -1; this.reset(); this.appearT = 0;
        dust(this.cx, this.floor, 6, this.w / 2);
        if (!on.easing) { this.appear = 1; this.appearT = -1; }
      }
    } else if (this.appearT >= 0) {
      this.appearT += dt;
      this.appear = ease("outBack", this.appearT / 0.4);
      if (this.appearT >= 0.4) { this.appearT = -1; this.appear = 1; }
    }
  }
  draw(c) {
    const idle = on.idle ? Math.sin(fx.time * 2.2 + this.phase) * 0.018 : 0;
    const sy = (1 + this.sq.x + idle) * (1 + this.hov.x * 0.06);
    const sx = (1 - this.sq.x * 0.7 - idle * 0.5) * (1 + this.hov.x * 0.06);
    const a = Math.max(0, this.appear);
    // Shadow stays on the shelf and shrinks as the thing lifts.
    c.fillStyle = "#0005";
    c.beginPath(); c.ellipse(this.cx, this.floor + 2, (this.w / 2) * a * sx, 7 * a, 0, 0, TAU); c.fill();
    c.save();
    c.translate(this.cx, this.floor - this.hov.x * 4);
    c.rotate(this.rot.x);
    c.scale(sx * a, sy * a);
    this.shape(c);
    c.restore();
  }
}

class Button extends Thing {
  constructor(cx, floor) { super("button", "Big Button", cx, floor, 120, 70); this.press = { x: 0, v: 0 }; this.combo = 0; this.last = -9; this.count = 0; this.lin = 0; }
  update(dt) {
    super.update(dt);
    if (on.easing) spring(this.press, dt, 500, 14);
    else { this.press.x = Math.max(0, this.press.x - dt * 8); this.press.v = 0; }
  }
  tap() {
    this.press.x = 1; this.press.v = 0;
    this.combo = fx.time - this.last < 0.6 ? this.combo + 1 : 1;
    this.last = fx.time;
    this.count++;
    this.squash(-5);
    const y = this.floor - 40;
    ring(this.cx, y, 70 + this.combo * 4, "#ff4f7e", 0.35);
    sparks(this.cx, y, 6 + Math.min(this.combo, 12), "#ff8fae", 300);
    shake(0.12 + Math.min(this.combo, 10) * 0.02);
    punch(-1.2);
    coins(this.cx, y - 10, 1, this.floor);
    if (this.combo > 1) say(this.cx + rnd(-20, 20), y - 50, `x${this.combo}`, this.combo >= 10 ? "#ffd84a" : "#fff3d6", Math.min(20 + this.combo * 2, 48), 0.6);
    if (this.combo % 10 === 0) {
      hitstop(0.09); flash(0.5, "#ff4f7e"); split(1); shake(0.5); punch(-5);
      ring(this.cx, y, 200, "#ffd84a", 0.6); coins(this.cx, y - 10, 10, this.floor, 1.6);
      say(this.cx, y - 100, "COMBO!", "#ffd84a", 40, 1.1);
    }
  }
  shape(c) {
    const p = this.press.x;
    c.fillStyle = "#2a1d55"; c.beginPath(); c.roundRect(-56, -26, 112, 26, 8); c.fill();
    c.fillStyle = "#3b2a6b"; c.beginPath(); c.roundRect(-50, -32, 100, 12, 6); c.fill();
    const dh = 28 * (1 - 0.75 * p);
    c.fillStyle = this.col("#b81f4a"); c.beginPath(); c.ellipse(0, -32, 40, 9, 0, 0, TAU); c.fill();
    c.fillStyle = this.col("#ff4f7e");
    c.beginPath(); c.ellipse(0, -32, 40, Math.max(dh, 2), 0, Math.PI, TAU); c.fill();
    c.fillStyle = "#ffb3c8";
    c.beginPath(); c.ellipse(-14, -32 - dh * 0.6, 10, Math.max(dh * 0.18, 1), -0.3, 0, TAU); c.fill();
  }
}

class Chest extends Thing {
  constructor(cx, floor) { super("chest", "Chest", cx, floor, 130, 100); this.stay = 4; }
  reset() { super.reset(); this.lid = 0; }
  tap() {
    if (this.state !== "closed") return;
    if (on.anticipation) { this.state = "rattle"; this.t = 0; } else this.open();
  }
  open() {
    this.opened();
    const y = this.floor - 62;
    shake(0.35); punch(-3); flash(0.25, "#ffd84a");
    ring(this.cx, y, 120, "#ffd84a");
    sparks(this.cx, y, 18, "#ffd84a", 420);
    stars(this.cx, y - 20, 6);
    this.squash(4);
    this.paid = 0;
    say(this.cx, y - 80, "TREASURE!", "#ffd84a", 30, 1.1);
  }
  update(dt) {
    super.update(dt);
    if (this.state === "rattle") {
      // Wind-up: the lid lifts a crack, the box hops and buzzes harder.
      const k = this.t / 0.45;
      this.rot.x = Math.sin(this.t * 60) * 0.06 * k;
      this.lid = 0.08 * Math.abs(Math.sin(this.t * 30)) * k;
      if (Math.random() < dt * 20) sparks(this.cx + rnd(-50, 50), this.floor - 62, 1, "#ffd84a", 120);
      if (this.t > 0.45) { this.rot.x = 0; this.open(); }
    }
    if (this.state === "open") {
      this.lid = ease("outBack", this.t / 0.35);
      // Coins come out in a stream rather than all at once.
      const due = Math.min(20, Math.floor(this.t / 0.03));
      if (this.paid < due) { coins(this.cx, this.floor - 66, due - this.paid, this.floor, 0.8); this.paid = due; }
    }
  }
  shape(c) {
    const open = this.state === "open";
    if (open) {
      c.save();
      c.translate(0, -66); c.rotate(fx.time * 0.6);
      c.globalAlpha = 0.25 * Math.min(1, this.t * 3);
      c.fillStyle = "#ffd84a";
      for (let i = 0; i < 10; i++) {
        c.rotate(TAU / 10);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(-10, -150); c.lineTo(10, -150); c.closePath(); c.fill();
      }
      c.restore();
      glow(c, 0, -66, 70, "rgba(255,216,74,0.6)");
    }
    c.fillStyle = this.col("#8a4b2a"); c.beginPath(); c.roundRect(-60, -64, 120, 64, 6); c.fill();
    c.fillStyle = this.col("#6d3a20"); c.fillRect(-60, -10, 120, 10);
    c.fillStyle = this.col("#f2b632"); c.fillRect(-48, -64, 12, 64); c.fillRect(36, -64, 12, 64);
    // The lid hinges at the back: its visible height is cos of its angle, so
    // it shrinks to the rim as it opens and shows its dark inside past
    // vertical. With Easing the out-back overshoot slams it past open.
    const ly = Math.cos(this.lid * 1.95);
    const h = 40 * Math.abs(ly);
    c.fillStyle = this.col(ly >= 0 ? "#9c5732" : "#3a1f12");
    c.beginPath(); c.roundRect(-62, -64 - h, 124, h, [Math.min(18, h), Math.min(18, h), 2, 2]); c.fill();
    if (ly >= 0) {
      c.fillStyle = this.col("#f2b632"); c.fillRect(-48, -64 - h, 12, h); c.fillRect(36, -64 - h, 12, h);
      c.fillStyle = this.col("#ffd84a"); c.beginPath(); c.roundRect(-9, -64 - 6, 18, 18, 4); c.fill();
      c.fillStyle = "#3a1f12"; c.fillRect(-2, -60, 4, 7);
    } else if (open) {
      c.fillStyle = "#ffd84a"; c.beginPath(); c.ellipse(0, -64, 50, 6, 0, 0, TAU); c.fill();
    }
  }
}

class Gift extends Thing {
  constructor(cx, floor) { super("gift", "Gift", cx, floor, 110, 100); this.stay = 3.5; }
  reset() { super.reset(); this.gem = 0; this.sent = false; }
  tap() {
    if (this.state !== "closed") return;
    if (on.anticipation) { this.state = "charge"; this.t = 0; } else this.open();
  }
  open() {
    this.opened();
    const y = this.floor - 88;
    this.squash(9);
    shake(0.4); punch(-3.5); flash(0.3);
    ring(this.cx, y, 140, "#ff4f7e");
    confetti(this.cx, y, 70);
    body(this.cx, y, rnd(-120, 120), -900, rnd(-14, 14), (c) => this.lidShape(c), this.floor);
    say(this.cx, y - 70, "SURPRISE!", "#ff4f7e", 30, 1.1);
  }
  update(dt) {
    super.update(dt);
    if (this.state === "charge") {
      // Squats down and trembles, then springs.
      const k = this.t / 0.4;
      this.sq.x = -0.18 * ease("outCubic", k); this.sq.v = 0;
      this.rot.x = Math.sin(this.t * 70) * 0.03 * k;
      if (this.t > 0.4) { this.rot.x = 0; this.open(); }
    }
    if (this.state === "open") {
      this.gem = ease("outBack", this.t / 0.5);
      if (this.t > 1.2 && !this.sent) {
        this.sent = true;
        const g = emit({ kind: "gem", x: this.cx, y: this.floor - 70 - 80 * this.gem, vx: 0, vy: -200, g: 0, drag: 0, life: 99, spin: fx.time * 4, trail: true, value: 25 });
        if (!g) collect(25);
        say(this.cx, this.floor - 170, "+25", "#8fd3ff", 26);
      }
    }
  }
  lidShape(c) {
    c.fillStyle = "#33a3ab"; c.beginPath(); c.roundRect(-52, -10, 104, 20, 4); c.fill();
    c.fillStyle = "#ff4f7e"; c.fillRect(-8, -10, 16, 20);
    c.beginPath(); c.ellipse(-14, -16, 14, 8, -0.5, 0, TAU); c.ellipse(14, -16, 14, 8, 0.5, 0, TAU); c.fill();
  }
  shape(c) {
    const open = this.state === "open";
    if (open && !this.sent) {
      const gy = -70 - 80 * this.gem;
      glow(c, 0, gy, 40, "rgba(95,184,255,0.55)");
      gemShape(c, 0, gy, 16, fx.time * 4);
      if (on.idle && Math.random() < 0.3) stars(this.cx + rnd(-18, 18), this.floor + gy + rnd(-18, 18), 1, "#8fd3ff");
    }
    c.fillStyle = this.col("#3fc1c9"); c.beginPath(); c.roundRect(-45, -72, 90, 72, 4); c.fill();
    c.fillStyle = this.col("#2c9aa1"); c.fillRect(-45, -72, 90, 8);
    c.fillStyle = this.col("#ff4f7e"); c.fillRect(-7, -72, 14, 72);
    if (!open) {
      c.save(); c.translate(0, -80);
      if (this.flashT > 0) c.filter = "brightness(3)";
      this.lidShape(c);
      c.restore();
    }
  }
}

class Crate extends Thing {
  constructor(cx, floor) { super("crate", "Crate", cx, floor, 110, 108); this.stay = 3; this.cracks = makeCracks(); }
  reset() { super.reset(); this.hp = 3; }
  tap(x) {
    if (this.state !== "closed") return;
    this.hp--;
    const side = x < this.cx ? 1 : -1;
    const y = this.floor - 54;
    if (this.hp > 0) {
      hitstop(0.06); this.whiten(0.07); shake(0.25); punch(-1.5);
      this.squash(-4); this.wobble(side * 3);
      for (let i = 0; i < 6; i++) emit({ kind: "chip", x: x, y: y + rnd(-30, 30), vx: -side * rnd(80, 260), vy: rnd(-420, -150), g: 1400, drag: 0.5, life: 1.1, rot: rnd(0, TAU), vr: rnd(-15, 15), w: rnd(5, 10), h: rnd(3, 6), color: "#c98a4b", floor: this.floor, bounce: 0.4 });
      dust(x, y, 3, 10);
      say(x, y - 50, this.hp === 2 ? "CRACK" : "CRACK!", "#fff3d6", 24, 0.6);
    } else this.smash(side);
  }
  smash(side) {
    this.opened();
    const y = this.floor - 54;
    hitstop(0.13); slowmo(0.45); shake(0.75); punch(-6); flash(0.55); split(1.2);
    ring(this.cx, y, 170, "#fff3d6", 0.5);
    for (let i = 0; i < 9; i++) {
      const horiz = i % 3 !== 0;
      emit({ kind: "plank", x: this.cx + rnd(-40, 40), y: y + rnd(-45, 45), vx: rnd(-320, 320) - side * 80, vy: rnd(-700, -250), g: 1500, drag: 0.3, life: 1.8, rot: horiz ? 0 : Math.PI / 2, vr: rnd(-10, 10), w: rnd(40, 70), h: 12, color: pick(["#c98a4b", "#b57838", "#d89a5a"]), floor: this.floor, bounce: 0.35 });
    }
    dust(this.cx, this.floor - 10, 14, 55);
    sparks(this.cx, y, 14, "#fff3d6", 500);
    coins(this.cx, this.floor - 20, 15, this.floor, 1.4);
    say(this.cx, y - 60, "SMASH!", "#ffd84a", 40, 1);
  }
  shape(c) {
    if (this.state === "open") {
      c.fillStyle = "#3a1f12"; c.beginPath(); c.ellipse(0, -4, 46, 6, 0, 0, TAU); c.fill();
      return;
    }
    c.fillStyle = this.col("#c98a4b"); c.fillRect(-54, -108, 108, 108);
    c.strokeStyle = this.col("#7a4a22"); c.lineWidth = 3;
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-54, -108 + i * 27); c.lineTo(54, -108 + i * 27); c.stroke(); }
    c.fillStyle = this.col("#9a6230");
    c.fillRect(-54, -108, 12, 108); c.fillRect(42, -108, 12, 108);
    c.save(); c.beginPath(); c.rect(-42, -108, 84, 108); c.clip();
    c.lineWidth = 12; c.strokeStyle = this.col("#9a6230");
    c.beginPath(); c.moveTo(-48, -6); c.lineTo(48, -102); c.stroke();
    c.restore();
    c.strokeStyle = "#2a1408"; c.lineWidth = 2.5; c.lineJoin = "round";
    for (let i = 0; i < 3 - this.hp; i++) {
      for (const line of this.cracks[i]) {
        c.beginPath(); line.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      }
    }
  }
}
function makeCracks() {
  const out = [];
  for (let i = 0; i < 2; i++) {
    const cx = rnd(-25, 25), cy = rnd(-80, -30), lines = [];
    for (let j = 0; j < 4; j++) {
      let x = cx, y = cy, a = rnd(0, TAU);
      const line = [[x, y]];
      for (let k = 0; k < 4; k++) { a += rnd(-0.6, 0.6); x += Math.cos(a) * 10; y += Math.sin(a) * 10; line.push([clamp(x, -52, 52), clamp(y, -106, -2)]); }
      lines.push(line);
    }
    out.push(lines);
  }
  return out;
}

class Egg extends Thing {
  constructor(cx, floor) { super("egg", "Egg", cx, floor, 90, 104); this.stay = 4; this.specks = Array.from({ length: 9 }, () => [rnd(-24, 24), rnd(-85, -20), rnd(2, 4)]); }
  reset() { super.reset(); this.taps = 0; this.chick = 0; this.blink = 0; }
  tap() {
    if (this.state !== "closed") return;
    this.taps++;
    this.wobble(pick([-1, 1]) * 4);
    this.squash(-2);
    stars(this.cx, this.floor - 60, 2);
    shake(0.08);
    if (this.taps < 3) say(this.cx + rnd(-30, 30), this.floor - 110, pick(["tap", "tok", "knock"]), "#fff3d6", 20, 0.6);
    else if (on.anticipation) { this.state = "rumble"; this.t = 0; }
    else this.hatch();
  }
  hatch() {
    this.opened();
    const y = this.floor - 70;
    if (on.squash) { this.sq.x = -0.15; this.sq.v = 0; } this.squash(10);
    shake(0.3); punch(-3); flash(0.2, "#fff3d6");
    ring(this.cx, y, 110, "#ffd84a");
    hearts(this.cx, y - 20, 6);
    stars(this.cx, y, 8, "#ffd84a");
    body(this.cx, y - 20, rnd(-150, 150), -700, rnd(-12, 12), (c) => {
      c.fillStyle = "#f6ead2"; c.beginPath(); c.ellipse(0, 0, 30, 22, 0, Math.PI, TAU); c.lineTo(30, 4); c.lineTo(-30, 4); c.fill();
    }, this.floor);
    collect(15);
    say(this.cx, y - 70, "+15", "#ffd84a", 28);
    say(this.cx, y - 100, "HELLO", "#fff3d6", 24, 1.2);
  }
  update(dt) {
    super.update(dt);
    if (this.state === "rumble") {
      const k = this.t / 0.6;
      this.rot.x = Math.sin(this.t * 55) * 0.12 * k;
      if (this.t > 0.6) { this.rot.x = 0; this.hatch(); }
    }
    if (this.state === "open") {
      this.chick = ease("outBack", this.t / 0.35);
      this.blink = (fx.time % 2.4) < 0.12 ? 1 : 0;
    }
  }
  shape(c) {
    c.fillStyle = "#7a4a22"; c.beginPath(); c.ellipse(0, -8, 48, 13, 0, 0, TAU); c.fill();
    c.strokeStyle = "#a8743a"; c.lineWidth = 2;
    for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(-44 + i * 13, -2); c.lineTo(-36 + i * 13, -16); c.stroke(); }
    if (this.state === "open") {
      const cy = -58 + 40 * (1 - this.chick);
      c.fillStyle = "#ffd84a"; c.beginPath(); c.arc(0, cy, 26, 0, TAU); c.fill();
      c.fillStyle = "#1a1530";
      if (this.blink && on.idle) { c.fillRect(-12, cy - 6, 8, 2.5); c.fillRect(4, cy - 6, 8, 2.5); }
      else { c.beginPath(); c.arc(-8, cy - 5, 3.5, 0, TAU); c.arc(8, cy - 5, 3.5, 0, TAU); c.fill(); }
      c.fillStyle = "#ff8a3d"; c.beginPath(); c.moveTo(-6, cy + 2); c.lineTo(6, cy + 2); c.lineTo(0, cy + 9); c.fill();
      c.fillStyle = "#ff9fb8"; c.globalAlpha = 0.6;
      c.beginPath(); c.arc(-16, cy + 4, 4, 0, TAU); c.arc(16, cy + 4, 4, 0, TAU); c.fill(); c.globalAlpha = 1;
      // Bottom half of the shell, zigzag rim.
      c.fillStyle = "#f6ead2";
      c.beginPath(); c.moveTo(-34, -50);
      for (let i = 0; i <= 8; i++) c.lineTo(-34 + i * 8.5, i % 2 ? -58 : -48);
      c.ellipse(0, -50, 34, 40, 0, 0, Math.PI); c.fill();
      return;
    }
    c.fillStyle = this.col("#f6ead2"); c.beginPath(); c.ellipse(0, -52, 34, 46, 0, 0, TAU); c.fill();
    c.fillStyle = "#d9c49a";
    for (const [x, y, r] of this.specks) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.fillStyle = "#fff"; c.globalAlpha = 0.5; c.beginPath(); c.ellipse(-12, -72, 7, 12, -0.4, 0, TAU); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = "#5a3a1a"; c.lineWidth = 2;
    if (this.taps >= 1) { c.beginPath(); c.moveTo(-4, -96); c.lineTo(2, -84); c.lineTo(-6, -76); c.lineTo(4, -66); c.stroke(); }
    if (this.taps >= 2) { c.beginPath(); c.moveTo(4, -66); c.lineTo(18, -62); c.lineTo(26, -70); c.moveTo(-6, -76); c.lineTo(-20, -70); c.lineTo(-30, -74); c.stroke(); }
    if (this.taps >= 3) { c.beginPath(); c.moveTo(26, -70); c.lineTo(33, -60); c.moveTo(-30, -74); c.lineTo(-33, -62); c.stroke(); }
  }
}

class Jar extends Thing {
  constructor(cx, floor) { super("jar", "Firefly Jar", cx, floor, 90, 112); this.stay = 3; this.flies = Array.from({ length: 10 }, () => [rnd(0, TAU), rnd(0.6, 1.4), rnd(0, TAU)]); }
  reset() { super.reset(); this.jiggle = 0; }
  tap() {
    if (this.state !== "closed") return;
    if (on.anticipation) { this.state = "jiggle"; this.t = 0; } else this.open();
  }
  flyPos(f) {
    const [a, s, b] = f;
    return [Math.sin(fx.time * s + a) * 24, -50 + Math.sin(fx.time * s * 1.3 + b) * 32];
  }
  open() {
    this.opened();
    const y = this.floor - 110;
    shake(0.2); this.squash(5);
    ring(this.cx, y, 70, "#d8ff7a", 0.35);
    say(this.cx, y - 40, "POP", "#d8ff7a", 26, 0.7);
    body(this.cx, y, rnd(-100, 100), -800, rnd(-16, 16), (c) => this.lidShape(c), this.floor);
    for (const f of this.flies) {
      const [x, fy] = this.flyPos(f);
      emit({ kind: "firefly", x: this.cx + x, y: this.floor + fy, vx: rnd(-120, 120), vy: rnd(-320, -180), g: 0, drag: 0, life: rnd(6, 9), heading: rnd(-Math.PI * 0.9, -Math.PI * 0.1), seed: rnd(0, TAU), trail: true });
    }
  }
  update(dt) {
    super.update(dt);
    if (this.state === "jiggle") {
      this.jiggle = Math.sin(this.t * 50) * 4 * (this.t / 0.35);
      if (this.t > 0.35) { this.jiggle = 0; this.open(); }
    }
  }
  lidShape(c) {
    c.fillStyle = "#b0b8c8"; c.beginPath(); c.roundRect(-32, -7, 64, 14, 4); c.fill();
    c.fillStyle = "#8a93a6"; c.fillRect(-32, 2, 64, 3);
  }
  shape(c) {
    const closed = this.state !== "open";
    if (closed) {
      for (const f of this.flies) {
        const [x, y] = this.flyPos(f);
        glow(c, x, y, 14, "rgba(216,255,122,0.5)");
        c.fillStyle = "#f6ffd0"; c.beginPath(); c.arc(x, y, 2.5, 0, TAU); c.fill();
      }
    }
    c.fillStyle = "rgba(180,220,255,0.14)"; c.strokeStyle = this.col("rgba(210,235,255,0.7)"); c.lineWidth = 3;
    c.beginPath(); c.roundRect(-40, -100, 80, 100, [10, 10, 18, 18]); c.fill(); c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.45)"; c.lineWidth = 4; c.lineCap = "round";
    c.beginPath(); c.moveTo(-26, -84); c.lineTo(-26, -30); c.stroke();
    if (closed) { c.save(); c.translate(this.jiggle, -104 - Math.abs(this.jiggle)); c.rotate(this.jiggle * 0.03); this.lidShape(c); c.restore(); }
  }
}

const things = [
  new Button(100, FLOOR1), new Chest(300, FLOOR1), new Gift(500, FLOOR1),
  new Crate(100, FLOOR2), new Egg(300, FLOOR2), new Jar(500, FLOOR2),
];
const boxes = ["chest", "gift", "crate", "egg", "jar"];
const opened = new Set();
let finaleAt = -1;

function finale() {
  slowmo(1.4); shake(0.5); flash(0.35, "#ffd84a"); punch(-4); split(0.8);
  say(W / 2, 200, "ALL OPEN!", "#ffd84a", 54, 2);
  collect(50);
  say(W / 2, 250, "+50", "#ffd84a", 30, 1.6);
  const cols = ["#ff4f7e", "#ffd84a", "#4fd6a4", "#5fb8ff", "#b88cff"];
  for (let i = 0; i < 6; i++) {
    emit({ kind: "rocket", x: rnd(80, W - 80), y: H, vx: rnd(-60, 60), vy: rnd(-760, -620), g: 500, drag: 0.3, life: 9, fuse: 0.75 + i * 0.12, color: cols[i % cols.length], trail: true });
  }
}

// ---------- input

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
let tapped = false;
function toLocal(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
}
canvas.addEventListener("pointerdown", (e) => {
  const [x, y] = toLocal(e);
  tapped = true;
  // Free fireflies come first: they fly over the shelves.
  for (const p of P) {
    if (p.kind === "firefly" && !p.dead && Math.hypot(p.x - x, p.y - y) < 26) {
      p.dead = true;
      collect(3);
      stars(p.x, p.y, 5, "#d8ff7a");
      ring(p.x, p.y, 36, "#d8ff7a", 0.3);
      say(p.x, p.y - 20, "+3", "#d8ff7a", 22, 0.6);
      return;
    }
  }
  const t = things.find((t) => t.appear > 0.5 && t.hit(x, y));
  if (t) t.tap(x, y);
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") return;
  const [x, y] = toLocal(e);
  let any = false;
  for (const t of things) { t.hover = t.hit(x, y); any ||= t.hover; }
  canvas.style.cursor = any ? "pointer" : "default";
});
canvas.addEventListener("pointerleave", () => { for (const t of things) t.hover = false; });

// ---------- switches

function loadSwitches() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE)); } catch {}
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const [k] of JUICE) on[k] = saved && k in saved ? !!saved[k] : !(calm && ["shake", "flash", "punch", "split"].includes(k));
}
function saveSwitches() { try { localStorage.setItem(STORE, JSON.stringify(on)); } catch {} }
const panel = document.getElementById("juice");
const tick = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 6.2 2.3 2.3 4.7-5"/></svg>';
function renderSwitches() {
  for (const b of panel.children) b.setAttribute("aria-pressed", on[b.dataset.k]);
}
loadSwitches();
for (const [k, label] of JUICE) {
  const b = document.createElement("button");
  b.dataset.k = k;
  b.innerHTML = `<span class="box">${tick}</span>${label}`;
  b.addEventListener("click", () => { on[k] = !on[k]; renderSwitches(); saveSwitches(); });
  panel.append(b);
}
renderSwitches();
const setAll = (v) => { for (const [k] of JUICE) on[k] = v; renderSwitches(); saveSwitches(); };
document.getElementById("all-on").addEventListener("click", () => setAll(true));
document.getElementById("all-off").addEventListener("click", () => setAll(false));

// ---------- render

let scale = 1, buf = null, bctx = null, red = null, cyan = null;
function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  scale = canvas.width / W;
  const mk = () => { const c = document.createElement("canvas"); c.width = canvas.width; c.height = canvas.height; return c; };
  buf = mk(); bctx = buf.getContext("2d");
  red = mk(); cyan = mk();
}
new ResizeObserver(resize).observe(canvas);
resize();

// Noise for shake: a few incommensurate sines per axis, so the camera
// wanders rather than buzzing at one frequency.
const wander = (t, s) => Math.sin(t * 37.1 + s) * 0.5 + Math.sin(t * 61.7 + s * 2.3) * 0.3 + Math.sin(t * 89.3 + s * 4.1) * 0.2;

function drawScene(c, simDt, realDt) {
  c.setTransform(scale, 0, 0, scale, 0, 0);
  const sh = fx.trauma * fx.trauma;
  const ox = sh * 20 * wander(fx.time, 1), oy = sh * 20 * wander(fx.time, 7), or = sh * 0.05 * wander(fx.time, 13);
  const z = 1 + fx.zoom.x * 0.01;
  c.translate(W / 2, H / 2); c.scale(z, z); c.rotate(or); c.translate(-W / 2 + ox, -H / 2 + oy);

  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#221a44"); g.addColorStop(1, "#15112a");
  c.fillStyle = g; c.fillRect(-60, -60, W + 120, H + 120);
  c.fillStyle = "#ffffff08";
  for (let y = 90; y < H; y += 30) for (let x = (y / 30) % 2 ? 15 : 30; x < W; x += 30) c.fillRect(x, y, 2, 2);

  for (const f of [FLOOR1, FLOOR2]) {
    c.fillStyle = "#0004"; c.fillRect(20, f + 14, W - 40, 10);
    c.fillStyle = "#3b2a6b"; c.fillRect(16, f, W - 32, 16);
    c.fillStyle = "#5a46a0"; c.fillRect(16, f, W - 32, 3);
  }
  c.font = "700 12px ui-rounded, system-ui, sans-serif";
  c.textAlign = "center"; c.textBaseline = "middle";
  for (const t of things) {
    c.fillStyle = "#b6aed3";
    let s = t.label;
    if (t.name === "crate" && t.state === "closed") s += ` · ${t.hp} hit${t.hp === 1 ? "" : "s"}`;
    if (t.name === "egg" && t.state === "closed") s += ` · ${3 - t.taps} tap${3 - t.taps === 1 ? "" : "s"}`;
    if (t.name === "button" && t.count) s += ` · ${t.count}`;
    c.fillText(s, t.cx, t.floor + 9);
  }

  for (const t of things) t.draw(c);
  for (const p of P) if (p.kind === "body") {
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = clamp((p.life - p.age) * 3, 0, 1); p.draw(c); c.restore();
  }
  c.globalAlpha = 1;
  drawParticles(c);
  drawText(c, simDt);

  // HUD sits outside the camera so it reads steady under shake.
  c.setTransform(scale, 0, 0, scale, 0, 0);
  const pop = 1 + hud.pop.x * 0.03;
  c.save(); c.translate(HUD_COIN.x, HUD_COIN.y); c.scale(pop, pop);
  coinShape(c, 0, 0, 13, on.idle ? fx.time * 2 : 0);
  c.restore();
  c.save(); c.translate(56, HUD_COIN.y); c.scale(pop, pop);
  c.font = "900 26px ui-rounded, system-ui, sans-serif"; c.textAlign = "left"; c.textBaseline = "middle";
  c.lineWidth = 5; c.strokeStyle = "#1a1530"; c.lineJoin = "round";
  c.strokeText(String(Math.round(hud.shown)), 0, 1); c.fillStyle = "#fff3d6"; c.fillText(String(Math.round(hud.shown)), 0, 1);
  c.restore();
  boxes.forEach((name, i) => {
    const pip = hud.pips[i] || (hud.pips[i] = { x: 0, v: 0, was: false });
    const is = opened.has(name);
    if (is && !pip.was && on.squash) pip.v += 14;
    pip.was = is;
    spring(pip, realDt, 300, 12);
    const x = W - 30 - (boxes.length - 1 - i) * 24, r = 8 * (1 + pip.x * 0.06);
    c.fillStyle = is ? "#4fd6a4" : "#3b2a6b";
    c.beginPath(); c.arc(x, HUD_COIN.y, r, 0, TAU); c.fill();
  });

  if (!tapped) {
    c.globalAlpha = 0.6 + 0.4 * Math.sin(fx.time * 3);
    c.font = "700 15px ui-rounded, system-ui, sans-serif"; c.textAlign = "center"; c.fillStyle = "#fff3d6";
    c.fillText("Tap anything on the shelves", W / 2, H - 22);
    c.globalAlpha = 1;
  }
  if (fx.flash > 0.01) { c.globalAlpha = fx.flash * 0.55; c.fillStyle = fx.flashColor; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
}

// Color split: the frame drawn once, then pulled apart into a red copy and a
// cyan copy that are added back together, offset sideways.
function channel(dst, src, color) {
  const c = dst.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "copy"; c.drawImage(src, 0, 0);
  c.globalCompositeOperation = "multiply"; c.fillStyle = color; c.fillRect(0, 0, dst.width, dst.height);
  c.globalCompositeOperation = "source-over";
}

let last = performance.now();
function frame(now) {
  const realDt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  // Hit stop freezes the simulation for real time; slow motion scales it.
  let simDt = realDt;
  if (fx.freeze > 0) { fx.freeze -= realDt; simDt = 0; }
  else if (fx.slow > 0) { fx.slow -= realDt; simDt = realDt * (fx.slow > 0.2 ? 0.25 : 0.25 + (0.2 - fx.slow) * 3.75); }
  fx.time += simDt;
  fx.trauma = Math.max(0, fx.trauma - realDt * 1.6);
  fx.flash = Math.max(0, fx.flash - realDt * 5);
  fx.split = Math.max(0, fx.split - realDt * 2.5);
  spring(fx.zoom, realDt, 420, 16);
  spring(hud.pop, realDt, 400, 14);
  hud.shown = on.easing ? hud.shown + (hud.treasure - hud.shown) * Math.min(1, realDt * 8) : hud.treasure;
  if (Math.abs(hud.treasure - hud.shown) < 0.5) hud.shown = hud.treasure;

  for (const t of things) t.update(simDt);
  updateParticles(simDt);
  if (opened.size === boxes.length && finaleAt < 0) finaleAt = fx.time + 0.7;
  if (finaleAt >= 0 && fx.time >= finaleAt) { finaleAt = -1; opened.clear(); finale(); }

  if (fx.split > 0.01) {
    drawScene(bctx, simDt, realDt);
    channel(red, buf, "#ff0000");
    channel(cyan, buf, "#00ffff");
    const d = fx.split * 7 * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "copy"; ctx.drawImage(red, -d, 0);
    ctx.globalCompositeOperation = "lighter"; ctx.drawImage(cyan, d, 0);
    ctx.globalCompositeOperation = "source-over";
  } else drawScene(ctx, simDt, realDt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For the e2e check and the card render.
window.__juice = { things, on, hud, P, opened };
