//! The 1947 game itself: an analog beam, a shell arc, paper targets on the glass.
//! It is simulated on the CPU and painted into a texture each frame.

use bevy::prelude::*;

pub const W: usize = 384;
pub const H: usize = 288;
const GUN: Vec2 = Vec2::new(26.0, 261.0);
const GRAVITY: f32 = 225.0;
const HIT_RADIUS: f32 = 15.0;
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
    shell: Option<Shell>,
    targets: Vec<Target>,
    bursts: Vec<Burst>,
    phosphor: Vec<f32>,
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
            shell: None,
            targets: Vec::new(),
            bursts: Vec::new(),
            phosphor: vec![0.0; W * H],
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
            let pos = Vec2::new(128.0 + self.rng.next() * 225.0, 38.0 + self.rng.next() * 187.0);
            if self.targets.iter().all(|t| t.pos.distance(pos) > 60.0) {
                let rot = std::f32::consts::PI + (self.rng.next() - 0.5) * 0.9;
                self.targets.push(Target { pos, rot, alive: true });
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
        self.shells -= 1;
        true
    }

    /// Adds a soft dot of light to the phosphor.
    fn spot(&mut self, c: Vec2, r: f32, a: f32) {
        let (x0, x1) = ((c.x - r).floor().max(0.0) as usize, ((c.x + r).ceil() as isize).clamp(0, W as isize - 1) as usize);
        let (y0, y1) = ((c.y - r).floor().max(0.0) as usize, ((c.y + r).ceil() as isize).clamp(0, H as isize - 1) as usize);
        if c.x + r < 0.0 || c.y + r < 0.0 {
            return;
        }
        for y in y0..=y1 {
            for x in x0..=x1 {
                let d = Vec2::new(x as f32 + 0.5, y as f32 + 0.5).distance(c) / r;
                if d < 1.0 {
                    self.phosphor[y * W + x] += a * (1.0 - d) * (1.0 - d);
                }
            }
        }
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

        if let Some(mut s) = self.shell.take() {
            const SUB: usize = 6;
            let h = dt / SUB as f32;
            let mut live = true;
            for _ in 0..SUB {
                s.vel.y += GRAVITY * h;
                s.pos += s.vel * h;
                let j = self.jitter();
                self.spot(s.pos + j, 4.0, 0.5);
                if let Some(t) = self.targets.iter_mut().find(|t| t.alive && t.pos.distance(s.pos) < HIT_RADIUS) {
                    t.alive = false;
                    self.hits += 1;
                    self.flash = 1.0;
                    self.bursts.push(Burst { pos: t.pos, age: 0.0 });
                    live = false;
                } else if s.pos.x > W as f32 + 9.0 || s.pos.y > GUN.y + 10.0 {
                    if s.pos.x <= W as f32 {
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
                self.shells += 3;
                self.place_targets();
            } else if self.shells == 0 {
                self.over = true;
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
            let v = self.phosphor[i].min(2.0);
            let hot = (v - 0.8).max(0.0);
            let rgb = [v * 0.30 + hot * 0.9, v, v * 0.50 + hot * 0.7];
            for c in 0..3 {
                px[c] = (rgb[c].clamp(0.0, 1.0) * 255.0) as u8;
            }
            px[3] = 255;
        }
        // Paper overlays sit on the glass, so they cover the beam.
        for t in self.targets.iter().filter(|t| t.alive) {
            let (s, c) = t.rot.sin_cos();
            let poly: Vec<Vec2> =
                PLANE.iter().map(|p| t.pos + Vec2::new(p[0] * c - p[1] * s, p[0] * s + p[1] * c)).collect();
            let (x0, y0) = ((t.pos.x - 20.0).max(0.0) as usize, (t.pos.y - 20.0).max(0.0) as usize);
            let (x1, y1) = (((t.pos.x + 20.0) as usize).min(W - 1), ((t.pos.y + 20.0) as usize).min(H - 1));
            for y in y0..=y1 {
                for x in x0..=x1 {
                    if inside(&poly, Vec2::new(x as f32 + 0.5, y as f32 + 0.5)) {
                        let o = (y * W + x) * 4;
                        out[o..o + 3].copy_from_slice(&[34, 30, 22]);
                    }
                }
            }
        }
    }
}

/// Even-odd point-in-polygon test.
fn inside(poly: &[Vec2], p: Vec2) -> bool {
    let mut hit = false;
    let mut j = poly.len() - 1;
    for i in 0..poly.len() {
        let (a, b) = (poly[i], poly[j]);
        if (a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x {
            hit = !hit;
        }
        j = i;
    }
    hit
}
