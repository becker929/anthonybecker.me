//! The 1947 game itself: an analog beam, a shell arc, paper targets on the glass.
//! It is simulated on the CPU and painted into a texture each frame.

use bevy::prelude::*;

/// The game plays on a field of 384 by 288 units. The tube's picture has `SCALE` pixels to the unit,
/// so its lines stay thin and sharp when the player leans in.
const SCALE: usize = 2;
const FIELD_W: f32 = 384.0;
pub const W: usize = 384 * SCALE;
pub const H: usize = 288 * SCALE;
const GREEN: [f32; 3] = [0.42, 1.0, 0.62];
const AMBER: [f32; 3] = [1.0, 0.66, 0.22];
const GUN: Vec2 = Vec2::new(26.0, 261.0);
const GRAVITY: f32 = 225.0;
const HIT_RADIUS: f32 = 24.0;
const BURST_TIME: f32 = 0.8;

/// Outline of a paper aeroplane overlay, nose pointing along +x.
const PLANE: [[f32; 2]; 16] = [
    [16.5, 0.0], [6.0, -2.6], [1.5, -16.5], [-3.8, -16.5], [-2.2, -2.6], [-12.0, -2.2],
    [-15.0, -7.5], [-18.0, -7.5], [-16.5, 0.0], [-18.0, 7.5], [-15.0, 7.5], [-12.0, 2.2],
    [-2.2, 2.6], [-3.8, 16.5], [1.5, 16.5], [6.0, 2.6],
];

struct Rng(u32);
impl Rng {
    fn next(&mut self) -> f32 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 17;
        self.0 ^= self.0 << 5;
        (self.0 >> 8) as f32 / (1u32 << 24) as f32
    }
}

struct Shell {
    pos: Vec2,
    vel: Vec2,
}
struct Target {
    pos: Vec2,
    rot: f32,
    alive: bool,
    /// Half the planes are drawn in amber, half in green.
    amber: bool,
}
struct Burst {
    pos: Vec2,
    age: f32,
}

#[derive(Component)]
pub struct CrtGame {
    /// Elevation in degrees, 15..=80.
    pub angle: f32,
    /// Charge, 0..=1.
    pub power: f32,
    pub shells: u32,
    pub hits: u32,
    pub wave: u32,
    pub over: bool,
    /// 1.0 right after a hit, decays to 0. Drives the glow of the tube.
    pub flash: f32,
    /// What has happened since the cabinet last looked, as `pad::SOUND_` bits.
    pub happened: u32,
    shell: Option<Shell>,
    targets: Vec<Target>,
    bursts: Vec<Burst>,
    phosphor: Vec<f32>,
    /// The shell's path. It fades far more slowly than the beam, so the whole arc stays drawn.
    trail: Vec<f32>,
    rng: Rng,
}

impl CrtGame {
    pub fn new(seed: u32) -> Self {
        let mut g = Self {
            angle: 48.0,
            power: 0.5,
            shells: 12,
            hits: 0,
            wave: 1,
            over: false,
            flash: 0.0,
            happened: 0,
            shell: None,
            targets: Vec::new(),
            bursts: Vec::new(),
            phosphor: vec![0.0; W * H],
            trail: vec![0.0; W * H],
            rng: Rng(seed.max(1)),
        };
        g.place_targets();
        g
    }

    pub fn reset(&mut self) {
        self.shells = 12;
        self.hits = 0;
        self.wave = 1;
        self.over = false;
        self.shell = None;
        self.bursts.clear();
        self.place_targets();
    }

    pub fn in_flight(&self) -> bool {
        self.shell.is_some()
    }

    fn place_targets(&mut self) {
        self.targets.clear();
        for _ in 0..500 {
            if self.targets.len() == 4 {
                break;
            }
            let pos = Vec2::new(120.0 + self.rng.next() * 225.0, 44.0 + self.rng.next() * 180.0);
            if self.targets.iter().all(|t| t.pos.distance(pos) > 84.0) {
                let rot = std::f32::consts::PI + (self.rng.next() - 0.5) * 0.9;
                let amber = self.targets.len() % 2 == 1;
                self.targets.push(Target { pos, rot, alive: true, amber });
            }
        }
    }

    fn muzzle_velocity(&self) -> Vec2 {
        let a = self.angle.to_radians();
        let v = 188.0 + self.power * 248.0;
        Vec2::new(a.cos() * v, -a.sin() * v)
    }

    pub fn fire(&mut self) -> bool {
        if self.shell.is_some() || self.over || self.shells == 0 {
            return false;
        }
        self.shell = Some(Shell { pos: GUN, vel: self.muzzle_velocity() });
        self.trail.fill(0.0);
        self.shells -= 1;
        true
    }

    /// Adds a soft dot of light to the phosphor. `c` and `r` are in field units.
    fn spot(&mut self, c: Vec2, r: f32, a: f32) {
        splat(&mut self.phosphor, c, r, a);
    }

    fn jitter(&mut self) -> Vec2 {
        Vec2::new(self.rng.next() - 0.5, self.rng.next() - 0.5) * 0.9
    }

    pub fn step(&mut self, dt: f32) {
        let dt = dt.min(0.05);
        let fade = (-dt * 4.2).exp();
        for p in &mut self.phosphor {
            *p *= fade;
        }
        let slow = (-dt * 0.3).exp();
        for p in &mut self.trail {
            *p *= slow;
        }

        if let Some(mut s) = self.shell.take() {
            const SUB: usize = 6;
            let h = dt / SUB as f32;
            let mut live = true;
            for _ in 0..SUB {
                s.vel.y += GRAVITY * h;
                s.pos += s.vel * h;
                let j = self.jitter();
                self.spot(s.pos + j, 3.2, 0.5);
                splat(&mut self.trail, s.pos, 1.5, 0.55);
                if let Some(t) = self.targets.iter_mut().find(|t| t.alive && t.pos.distance(s.pos) < HIT_RADIUS) {
                    t.alive = false;
                    self.hits += 1;
                    self.flash = 1.0;
                    self.happened |= crate::pad::SOUND_HIT;
                    self.bursts.push(Burst { pos: t.pos, age: 0.0 });
                    live = false;
                } else if s.pos.x > FIELD_W + 9.0 || s.pos.y > GUN.y + 10.0 {
                    if s.pos.x <= FIELD_W {
                        self.happened |= crate::pad::SOUND_GROUND;
                        self.bursts.push(Burst { pos: Vec2::new(s.pos.x, GUN.y + 6.0), age: 0.35 });
                    }
                    live = false;
                }
                if !live {
                    break;
                }
            }
            if live {
                self.shell = Some(s);
            } else if self.targets.iter().all(|t| !t.alive) {
                self.wave += 1;
                self.happened |= crate::pad::SOUND_WAVE;
                self.shells += 3;
                self.place_targets();
            } else if self.shells == 0 {
                self.over = true;
                self.happened |= crate::pad::SOUND_OVER;
            }
        } else if !self.over {
            // Idle beam: a short stub that shows the trajectory the knobs have set.
            let v = self.muzzle_velocity();
            for i in 0..=8 {
                let t = i as f32 * 0.014;
                let p = GUN + v * t + Vec2::new(0.0, 0.5 * GRAVITY * t * t);
                let j = self.jitter();
                self.spot(p + j, 3.2, 0.14);
            }
        }
        let j = self.jitter();
        self.spot(GUN + j, 5.0, 0.28);

        // A hit is shown the 1947 way: the beam defocuses into a blur.
        for i in 0..self.bursts.len() {
            self.bursts[i].age += dt;
            let k = self.bursts[i].age / BURST_TIME;
            if k < 1.0 {
                let p = self.bursts[i].pos + self.jitter() * 3.0;
                self.spot(p, 8.0 + 34.0 * k, 0.32 * (1.0 - k));
            }
        }
        self.bursts.retain(|b| b.age < BURST_TIME);
        self.flash = (self.flash - dt * 2.2).max(0.0);
    }

    /// Paints the tube into an RGBA8 buffer of `W * H` pixels.
    pub fn render(&self, out: &mut [u8]) {
        for (i, px) in out.chunks_exact_mut(4).enumerate() {
            let (x, y) = (i % W, i / W);
            let beam = self.phosphor[i].min(2.0);
            let line = self.trail[i].min(1.0);
            let hot = (beam - 0.8).max(0.0);
            // The tube is never quite black: a faint green field, darker toward the corners.
            let (u, v) = (x as f32 / W as f32 - 0.5, y as f32 / H as f32 - 0.5);
            // A little noise hides the steps an 8-bit picture would show in so dim a glow.
            let grain = ((x * 7919 + y * 104_729) % 251) as f32 / 251.0 - 0.5;
            let field = (0.016 * (1.0 - 2.2 * (u * u + v * v)).max(0.0) + grain * 0.004).max(0.0);
            let scan = if y % 2 == 0 { 1.0 } else { 0.82 };
            let g = (beam + line) * scan;
            // The glass itself is a smoky grey-green, not a pure green.
            // A faint band of sheen across the top of the glass, as if it caught the room.
            let sheen = 0.022 * (1.0 - ((v + 0.34 + u * 0.25) / 0.10).abs()).max(0.0);
            let rgb = [
                g * GREEN[0] + hot * 0.9 + field * 0.7 + sheen,
                g + field + sheen,
                g * GREEN[2] + hot * 0.7 + field * 0.85 + sheen * 1.1,
            ];
            for c in 0..3 {
                px[c] = (rgb[c].clamp(0.0, 1.0) * 255.0) as u8;
            }
            px[3] = 255;
        }
        // The planes are drawn as glowing outlines, green and amber.
        for t in self.targets.iter().filter(|t| t.alive) {
            let (s, c) = t.rot.sin_cos();
            let poly: Vec<Vec2> =
                PLANE.iter().map(|p| t.pos + Vec2::new(p[0] * c - p[1] * s, p[0] * s + p[1] * c) * 2.2).collect();
            let color = if t.amber { AMBER } else { GREEN };
            for i in 0..poly.len() {
                stroke(out, poly[i], poly[(i + 1) % poly.len()], color);
            }
        }
        // The shell is a bright amber point at the head of its arc.
        if let Some(shell) = &self.shell {
            glow_dot(out, shell.pos, 6.5, [1.0, 0.72, 0.30]);
        }
    }
}

/// Adds a soft dot to a brightness buffer. `c` and `r` are in field units.
fn splat(buf: &mut [f32], c: Vec2, r: f32, a: f32) {
    let (c, r) = (c * SCALE as f32, r * SCALE as f32);
    if c.x + r < 0.0 || c.y + r < 0.0 {
        return;
    }
    let (x0, x1) = ((c.x - r).floor().max(0.0) as usize, ((c.x + r).ceil() as isize).clamp(0, W as isize - 1) as usize);
    let (y0, y1) = ((c.y - r).floor().max(0.0) as usize, ((c.y + r).ceil() as isize).clamp(0, H as isize - 1) as usize);
    for y in y0..=y1 {
        for x in x0..=x1 {
            let d = Vec2::new(x as f32 + 0.5, y as f32 + 0.5).distance(c) / r;
            if d < 1.0 {
                buf[y * W + x] += a * (1.0 - d) * (1.0 - d);
            }
        }
    }
}

/// Adds light to the picture over a box of pixels. `f` gives the brightness at each pixel centre.
fn add_light(out: &mut [u8], lo: Vec2, hi: Vec2, color: [f32; 3], f: impl Fn(Vec2) -> f32) {
    let (x0, y0) = (lo.x.floor().max(0.0) as usize, lo.y.floor().max(0.0) as usize);
    let (x1, y1) = ((hi.x.ceil() as isize).clamp(0, W as isize - 1) as usize, (hi.y.ceil() as isize).clamp(0, H as isize - 1) as usize);
    for y in y0..=y1 {
        for x in x0..=x1 {
            let k = f(Vec2::new(x as f32 + 0.5, y as f32 + 0.5));
            if k > 0.004 {
                let o = (y * W + x) * 4;
                for c in 0..3 {
                    out[o + c] = (out[o + c] as f32 + k * color[c] * 255.0).min(255.0) as u8;
                }
            }
        }
    }
}

/// A thin bright line with a soft halo, from `a` to `b` in field units.
fn stroke(out: &mut [u8], a: Vec2, b: Vec2, color: [f32; 3]) {
    let (a, b) = (a * SCALE as f32, b * SCALE as f32);
    let pad = Vec2::splat(5.0);
    let ab = b - a;
    let len2 = ab.length_squared().max(1e-6);
    add_light(out, a.min(b) - pad, a.max(b) + pad, color, |p| {
        let t = ((p - a).dot(ab) / len2).clamp(0.0, 1.0);
        let d = p.distance(a + ab * t);
        // The joins of an outline are drawn by both lines that meet there, so keep the core modest.
        0.62 * (1.0 - (d - 0.6) / 1.1).clamp(0.0, 1.0) + 0.16 * (-d * d / 7.0).exp()
    });
}

/// A round glowing point at `c`, in field units.
fn glow_dot(out: &mut [u8], c: Vec2, r: f32, color: [f32; 3]) {
    let (c, r) = (c * SCALE as f32, r * SCALE as f32);
    add_light(out, c - Vec2::splat(r * 2.0), c + Vec2::splat(r * 2.0), color, |p| {
        let d = p.distance(c) / r;
        (1.0 - d * 0.9).clamp(0.0, 1.0) + 0.35 * (-d * d).exp()
    });
}
