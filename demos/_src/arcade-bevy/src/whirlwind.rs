//! The Bouncing Ball on MIT's Whirlwind I: a ball released at the top left of a round display tube
//! bounces along a floor, losing height, and the operator tunes the bounce so it drops through a gap.
//!
//! This is the logic and the tube's picture only, in plain Rust with no engine types, so it can be
//! tested on its own:
//!
//! ```text
//! rustc --edition 2024 --test src/whirlwind.rs -o /tmp/whirlwind_test && /tmp/whirlwind_test
//! ```
//!
//! What the homage keeps from the real program:
//!
//! - Whirlwind I (MIT, running from 1951) drew on round oscilloscope displays, point by point. The
//!   Bouncing Ball program solved the equations of a ball falling and bouncing, and plotted the ball
//!   as a dot at each step. The display tubes' long-persistence phosphor (P7: a blue-white flash
//!   and a slow yellow-green afterglow) left the path behind as a fading row of dots.
//! - The ball starts high on the left and bounces to the right, each bounce lower than the last.
//! - In its game form the floor has a hole, and the operator set the bounce with a knob before the
//!   ball was released, trying to make it fall through the hole.
//! - Charles W. Adams and John T. (Jack) Gilmore Jr. of the Whirlwind group are usually named for the
//!   program and the game (Gilmore by Norman Taylor's 1989 account). A February 1951 project report
//!   credits a student, Oliver Aberth, with the simulation. The sources disagree; the homage names all three.
//!
//! What it invents: two notched knobs (BOUNCE, the ball's springiness, and SPEED, its push to the
//! right), a plunger that releases the ball, holes that move and narrow, a run of five misses, and the
//! score kept in a 16-bit register of lamps (Whirlwind's word was 16 bits).
//!
//! Sources:
//! - https://retrocomputingforum.com/t/footage-of-bouncing-ball-on-whirlwind/2124 (stills from the
//!   film "Making Electrons Count", the hole in the floor, the 2 February 1951 report and Aberth)
//! - https://en.wikipedia.org/wiki/Whirlwind_I (the interactive bouncing-ball demonstration, 1953,
//!   that "evolved into a simple game")
//! - https://tcm.computerhistory.org/exhibits/WhirlwindFall1982.pdf (the Computer Museum's Whirlwind
//!   exhibit: the display consoles)
//!
//! Score: each ball through a hole scores ten times the hole's number (hole 1 is 10, hole 7 is 70),
//! doubled if it was the first ball tried at that hole. A run ends after five misses, or when the
//! player walks away, and its score is the sum, at most 5000.

use std::f32::consts::PI;

// ---------------------------------------------------------------- the field

/// The field runs from -1 to 1 each way, as Whirlwind's display coordinates did. The tube's glass is
/// the circle of this radius; nothing is drawn outside it.
pub const TUBE_R: f32 = 0.96;
pub const FLOOR_Y: f32 = -0.50;
/// The floor's ends, where it meets the round edge of the tube.
pub const FLOOR_X0: f32 = -0.80;
pub const FLOOR_X1: f32 = 0.80;
pub const START: (f32, f32) = (-0.74, 0.55);
pub const BALL_R: f32 = 0.026;
const GRAVITY: f32 = 2.4;
/// Each touch of the floor keeps this much of the ball's speed along it.
const SCUFF: f32 = 0.93;
/// A bounce slower than this upward is the ball's last: it comes to rest where it touched. Without
/// this a dying ball would skitter across any gap it reached.
const REST_SPEED: f32 = 0.70;
/// The simulation's fixed step. The live game and the tests take the same steps, so a setting that
/// drops through in a test drops through on the tube.
pub const DT: f32 = 1.0 / 480.0;
/// The program plotted the ball this often; the dots of the trail are this far apart in time.
const PLOT_EVERY: f32 = 1.0 / 36.0;
/// No flight lasts longer than this. A ball still moving then has missed.
const MAX_FLIGHT: f32 = 20.0;

// ---------------------------------------------------------------- the knobs

pub const NOTCHES: i32 = 9;
/// The ball's springiness at each notch of the BOUNCE knob: the share of its speed a bounce keeps.
pub fn bounce_at(notch: i32) -> f32 {
    0.50 + 0.05 * notch.clamp(0, NOTCHES - 1) as f32
}
/// The ball's push to the right at each notch of the SPEED knob, in field units a second.
pub fn speed_at(notch: i32) -> f32 {
    0.10 + 0.04 * notch.clamp(0, NOTCHES - 1) as f32
}

// ---------------------------------------------------------------- rules

/// Misses allowed in a run. The run ends on the last.
pub const MISSES: u32 = 5;
/// Seconds the result is shown before the next ball is ready.
const DROP_PAUSE: f32 = 1.4;
const MISS_PAUSE: f32 = 1.0;
const MAX_SCORE: u32 = 5000;

/// Things that happened since the owner last looked, for sounds and lamps. See `Whirlwind::events`.
pub const EV_RELEASE: u32 = 1;
pub const EV_BOUNCE: u32 = 2;
/// A ball went through the hole.
pub const EV_DROP: u32 = 4;
pub const EV_MISS: u32 = 8;
/// The last miss of a run.
pub const EV_OVER: u32 = 16;
/// A new hole was set up after a drop.
pub const EV_NEW_HOLE: u32 = 32;
/// The plunger was pressed when no ball could go.
pub const EV_REFUSED: u32 = 64;
pub const EV_RESET: u32 = 128;
/// A knob moved one notch.
pub const EV_NOTCH: u32 = 256;
/// A knob was turned against its stop.
pub const EV_STOP: u32 = 512;

/// The gap in the floor. Its centre may drift from side to side while the ball is in the air.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Hole {
    pub x: f32,
    pub half: f32,
    pub drift: f32,
    pub rate: f32,
}

impl Hole {
    /// The gap's centre `t` seconds after release.
    pub fn centre(&self, t: f32) -> f32 {
        self.x + self.drift * (self.rate * t).sin()
    }
    /// Whether a ball whose centre is at `x` falls through. It must clear the edges by a little more
    /// than half its radius, or it hits the rim and bounces.
    fn takes(&self, x: f32, t: f32) -> bool {
        (x - self.centre(t)).abs() <= self.half - BALL_R * 0.6
    }

    /// The hole of number `n` (1 is the first), placed by `pick`, a number from 0 to 1.
    fn numbered(n: u32, pick: f32) -> Hole {
        let n = n.max(1) as f32;
        Hole {
            x: -0.25 + pick * 0.97,
            half: (0.085 - 0.0035 * (n - 1.0)).max(0.05),
            // From the sixth hole on, the gap slides to and fro, a little further each time.
            drift: (0.035 * (n - 5.0)).clamp(0.0, 0.20),
            rate: 1.3,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Motion {
    Air,
    /// Through the gap and falling under the floor.
    Falling,
}

/// How a flight ended.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Landing {
    Drop,
    /// Ran off the right end of the floor.
    Overshot,
    /// Came to rest on the floor.
    Stopped,
}

/// The ball in flight.
#[derive(Clone, Copy, Debug)]
pub struct Ball {
    pub x: f32,
    pub y: f32,
    vx: f32,
    vy: f32,
    bounce: f32,
    motion: Motion,
    /// Seconds since release.
    pub t: f32,
}

impl Ball {
    pub fn new(bounce_notch: i32, speed_notch: i32) -> Ball {
        Ball { x: START.0, y: START.1, vx: speed_at(speed_notch), vy: 0.0, bounce: bounce_at(bounce_notch), motion: Motion::Air, t: 0.0 }
    }

    /// One fixed step. Returns whether it bounced, and how the flight ended if it did.
    fn step(&mut self, hole: &Hole) -> (bool, Option<Landing>) {
        self.t += DT;
        let mut bounced = false;
        match self.motion {
            Motion::Air => {
                self.vy -= GRAVITY * DT;
                self.x += self.vx * DT;
                self.y += self.vy * DT;
                if self.y <= FLOOR_Y {
                    if self.x < FLOOR_X1 && hole.takes(self.x, self.t) {
                        self.motion = Motion::Falling;
                    } else {
                        self.y = FLOOR_Y;
                        self.vy = -self.vy * self.bounce;
                        self.vx *= SCUFF;
                        bounced = true;
                        if self.vy < REST_SPEED {
                            return (true, Some(Landing::Stopped));
                        }
                    }
                }
            }
            Motion::Falling => {
                self.vy -= GRAVITY * DT;
                self.x += self.vx * DT;
                self.y += self.vy * DT;
                if self.y < FLOOR_Y - 0.28 {
                    return (bounced, Some(Landing::Drop));
                }
            }
        }
        if self.motion != Motion::Falling && self.x > FLOOR_X1 {
            return (bounced, Some(Landing::Overshot));
        }
        if self.t > MAX_FLIGHT {
            return (bounced, Some(Landing::Stopped));
        }
        (bounced, None)
    }
}

/// Where a ball with these settings ends up at this hole. The same steps the live game takes.
pub fn fly(bounce_notch: i32, speed_notch: i32, hole: &Hole) -> Landing {
    let mut ball = Ball::new(bounce_notch, speed_notch);
    loop {
        if let (_, Some(landing)) = ball.step(hole) {
            return landing;
        }
    }
}

/// Every setting that drops through this hole, as (bounce, speed) notches.
pub fn solutions(hole: &Hole) -> Vec<(i32, i32)> {
    let mut out = Vec::new();
    for b in 0..NOTCHES {
        for s in 0..NOTCHES {
            if fly(b, s, hole) == Landing::Drop {
                out.push((b, s));
            }
        }
    }
    out
}

struct Rng(u32);
impl Rng {
    fn next(&mut self) -> f32 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 17;
        self.0 ^= self.0 << 5;
        (self.0 >> 8) as f32 / (1u32 << 24) as f32
    }
}

/// No hole may be passed by more than this many of the 81 settings, so the knobs always matter.
const MOST_ANSWERS: usize = 20;

/// Places hole `n`: somewhere at least one setting drops through, away from where the last hole was.
/// Early holes want several answers, so the first few are forgiving.
fn place_hole(n: u32, last: Option<f32>, rng: &mut Rng) -> Hole {
    let want = match n {
        0..=3 => 4,
        4..=7 => 2,
        _ => 1,
    };
    let mut best: Option<(usize, Hole)> = None;
    for _ in 0..60 {
        let hole = Hole::numbered(n, rng.next());
        if last.is_some_and(|x| (x - hole.x).abs() < 0.15) {
            continue;
        }
        let count = solutions(&hole).len();
        if (want..=MOST_ANSWERS).contains(&count) {
            return hole;
        }
        if count > 0 && count <= MOST_ANSWERS && best.is_none_or(|(c, _)| count > c) {
            best = Some((count, hole));
        }
    }
    if let Some((_, hole)) = best {
        return hole;
    }
    // Search the floor in order. A hole of some width somewhere always has an answer.
    for i in 0..=40 {
        let hole = Hole::numbered(n, i as f32 / 40.0);
        if !solutions(&hole).is_empty() {
            return hole;
        }
    }
    Hole::numbered(n, 0.5)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Phase {
    /// The ball waits at the top left for the plunger.
    Ready,
    /// A ball is in the air. `demo` is true for the machine's own idle demonstration, which never counts.
    Flight { demo: bool },
    /// The last ball's result is shown for a moment.
    Result { landing: Landing, left: f32, demo: bool },
    /// Out of misses. The plunger starts a new run.
    Over,
}

/// Light on the tube, as two layers: the phosphor's quick blue-white flash and its slow yellow-green
/// afterglow. `N` pixels square.
pub const N: usize = 512;
/// The flash fades in about a twentieth of a second, the afterglow over a few seconds.
const FLASH_TIME: f32 = 0.05;
const GLOW_TIME: f32 = 1.6;
const FLASH: [f32; 3] = [0.70, 0.82, 1.0];
const GLOW: [f32; 3] = [0.78, 1.0, 0.36];
const PHOSPHOR: [f32; 3] = [0.034, 0.042, 0.036];

pub struct Whirlwind {
    pub bounce: i32,
    pub speed: i32,
    pub phase: Phase,
    pub hole: Hole,
    /// The hole's number in this run, from 1.
    pub hole_no: u32,
    /// Balls tried at this hole.
    tries: u32,
    pub misses: u32,
    pub score: u32,
    /// Holes passed in this run.
    pub drops: u32,
    pub ball: Option<Ball>,
    /// Bounces of the ball in flight. A lamp chaser on the console steps with them.
    pub bounces: u32,
    /// What has happened since the owner last looked, as `EV_` bits. The owner clears it.
    pub events: u32,
    ended: Option<u32>,
    /// Sim time not yet stepped, and time to the next plotted dot.
    spare: f32,
    plot_in: f32,
    flash: Vec<f32>,
    glow: Vec<f32>,
    /// Seconds since switch-on, for small flickers.
    clock: f32,
    rng: Rng,
}

impl Whirlwind {
    pub fn new(seed: u32) -> Self {
        let mut rng = Rng(seed.max(1));
        let hole = place_hole(1, None, &mut rng);
        Whirlwind {
            bounce: 4,
            speed: 4,
            phase: Phase::Ready,
            hole,
            hole_no: 1,
            tries: 0,
            misses: 0,
            score: 0,
            drops: 0,
            ball: None,
            bounces: 0,
            events: 0,
            ended: None,
            spare: 0.0,
            plot_in: 0.0,
            flash: vec![0.0; N * N],
            glow: vec![0.0; N * N],
            clock: 0.0,
            rng,
        }
    }

    /// Whether a run has begun: a ball has been played for real since the last reset.
    pub fn in_run(&self) -> bool {
        self.drops > 0 || self.misses > 0 || matches!(self.phase, Phase::Flight { demo: false } | Phase::Result { demo: false, .. })
    }

    pub fn over(&self) -> bool {
        self.phase == Phase::Over
    }

    /// Turns the BOUNCE knob by whole notches, stopping at either end. It may be turned at any time;
    /// the ball reads it when it is released.
    pub fn turn_bounce(&mut self, notches: i32) {
        let want = self.bounce + notches;
        self.bounce = want.clamp(0, NOTCHES - 1);
        self.events |= if self.bounce == want { EV_NOTCH } else { EV_STOP };
    }

    pub fn turn_speed(&mut self, notches: i32) {
        let want = self.speed + notches;
        self.speed = want.clamp(0, NOTCHES - 1);
        self.events |= if self.speed == want { EV_NOTCH } else { EV_STOP };
    }

    /// The plunger. Releases the ball when it is waiting; starts a new run when the last is over.
    /// Returns whether it did anything.
    pub fn plunge(&mut self) -> bool {
        match self.phase {
            Phase::Ready => {
                self.launch(false);
                true
            }
            Phase::Over => {
                self.reset();
                true
            }
            _ => {
                self.events |= EV_REFUSED;
                false
            }
        }
    }

    /// The machine shows itself off while nobody plays: a ball with any setting, which never counts.
    pub fn demonstrate(&mut self) {
        if self.phase == Phase::Ready && !self.in_run() {
            let (b, s) = ((self.rng.next() * NOTCHES as f32) as i32, (self.rng.next() * NOTCHES as f32) as i32);
            let keep = (self.bounce, self.speed);
            (self.bounce, self.speed) = (b, s);
            self.launch(true);
            (self.bounce, self.speed) = keep;
        }
    }

    fn launch(&mut self, demo: bool) {
        self.ball = Some(Ball::new(self.bounce, self.speed));
        self.bounces = 0;
        self.spare = 0.0;
        self.plot_in = 0.0;
        self.phase = Phase::Flight { demo };
        if !demo {
            self.tries += 1;
            self.events |= EV_RELEASE;
        }
    }

    /// A new run from hole 1. A run in progress is scored first.
    pub fn reset(&mut self) {
        self.end_run();
        self.misses = 0;
        self.score = 0;
        self.drops = 0;
        self.tries = 0;
        self.hole_no = 1;
        self.hole = place_hole(1, Some(self.hole.x), &mut self.rng);
        self.ball = None;
        self.phase = Phase::Ready;
        self.events |= EV_RESET;
    }

    /// Ends the run now, as walking away does. Its score waits in `take_ended`.
    pub fn end_run(&mut self) {
        // A run that ran out of misses was scored when it ended.
        if self.phase == Phase::Over {
            return;
        }
        if self.score > 0 && self.ended.is_none() {
            self.ended = Some(self.score);
        }
        if self.in_run() {
            self.score = 0;
            self.misses = 0;
            self.drops = 0;
            self.tries = 0;
            self.hole_no = 1;
            self.hole = place_hole(1, Some(self.hole.x), &mut self.rng);
            self.ball = None;
            self.phase = Phase::Ready;
        }
    }

    /// The score of a run that has ended, once.
    pub fn take_ended(&mut self) -> Option<u32> {
        self.ended.take()
    }

    pub fn step(&mut self, dt: f32) {
        let dt = dt.clamp(0.0, 0.1);
        self.clock += dt;
        let flash = (-dt / FLASH_TIME).exp();
        let glow = (-dt / GLOW_TIME).exp();
        for p in &mut self.flash {
            *p *= flash;
        }
        for p in &mut self.glow {
            *p *= glow;
        }
        match self.phase {
            Phase::Flight { demo } => self.fly_on(dt, demo),
            Phase::Result { landing, left, demo } => {
                let left = left - dt;
                if left > 0.0 {
                    self.phase = Phase::Result { landing, left, demo };
                } else if demo {
                    self.phase = Phase::Ready;
                } else if landing == Landing::Drop {
                    self.hole_no += 1;
                    self.tries = 0;
                    self.hole = place_hole(self.hole_no, Some(self.hole.x), &mut self.rng);
                    self.events |= EV_NEW_HOLE;
                    self.phase = Phase::Ready;
                } else if self.misses >= MISSES {
                    self.phase = Phase::Over;
                    self.events |= EV_OVER;
                    if self.score > 0 {
                        self.ended = Some(self.score);
                    }
                } else {
                    self.phase = Phase::Ready;
                }
            }
            Phase::Ready | Phase::Over => {}
        }
    }

    fn fly_on(&mut self, dt: f32, demo: bool) {
        let Some(mut ball) = self.ball else { return };
        self.spare += dt;
        let mut landed = None;
        while self.spare >= DT {
            self.spare -= DT;
            let (bounced, landing) = ball.step(&self.hole);
            if bounced {
                self.bounces += 1;
                if !demo {
                    self.events |= EV_BOUNCE;
                }
            }
            self.plot_in -= DT;
            if self.plot_in <= 0.0 {
                self.plot_in += PLOT_EVERY;
                self.plot(ball.x, ball.y);
            }
            if landing.is_some() {
                landed = landing;
                break;
            }
        }
        self.ball = Some(ball);
        let Some(landing) = landed else { return };
        self.ball = None;
        if !demo {
            if landing == Landing::Drop {
                let points = 10 * self.hole_no * if self.tries == 1 { 2 } else { 1 };
                self.score = (self.score + points).min(MAX_SCORE);
                self.drops += 1;
                self.events |= EV_DROP;
            } else {
                self.misses += 1;
                self.events |= EV_MISS;
            }
        }
        let left = if landing == Landing::Drop { DROP_PAUSE } else { MISS_PAUSE };
        self.phase = Phase::Result { landing, left, demo };
    }

    /// Puts a dot of light on the phosphor where the program plotted the ball.
    fn plot(&mut self, x: f32, y: f32) {
        splat(&mut self.flash, x, y, 1.6, 1.2);
        splat(&mut self.glow, x, y, 1.9, 0.75);
    }

    /// The hole's centre as drawn now.
    pub fn hole_centre(&self) -> f32 {
        let t = match self.ball {
            Some(ball) => ball.t,
            None => 0.0,
        };
        self.hole.centre(t)
    }

    /// Paints the tube's face into an RGBA8 buffer of `N * N` pixels. Outside the glass is black.
    pub fn render(&self, out: &mut [u8]) {
        let c = (N as f32 - 1.0) / 2.0;
        let r_px = TUBE_R * N as f32 / 2.0;
        for (i, px) in out.chunks_exact_mut(4).enumerate() {
            let (x, y) = ((i % N) as f32 - c, (i / N) as f32 - c);
            let d = (x * x + y * y).sqrt() / r_px;
            if d > 1.0 {
                px.copy_from_slice(&[0, 0, 0, 255]);
                continue;
            }
            let (f, g) = (self.flash[i].min(2.0), self.glow[i].min(1.5));
            // The curved glass is a touch dimmer toward its rim. Unlit phosphor is a faint grey-green,
            // so the face reads as glass, not as a hole.
            let rim = 1.0 - 0.25 * d * d * d * d;
            for k in 0..3 {
                px[k] = (((f * FLASH[k] + g * GLOW[k] + PHOSPHOR[k]) * rim).clamp(0.0, 1.0) * 255.0) as u8;
            }
            px[3] = 255;
        }
        // The floor, refreshed every frame as a row of dots, with the gap left out.
        let over = self.phase == Phase::Over;
        let level = if over { 0.22 } else { 0.55 };
        let gap = self.hole_centre();
        let mut x = FLOOR_X0;
        while x <= FLOOR_X1 + 1e-4 {
            if (x - gap).abs() > self.hole.half {
                dot(out, x, FLOOR_Y - BALL_R, 1.5, level, GLOW);
            }
            x += 0.025;
        }
        // Two short posts mark the gap's edges.
        for side in [-1.0, 1.0] {
            let ex = gap + side * self.hole.half;
            for k in 1..=2 {
                dot(out, ex, FLOOR_Y - BALL_R - 0.025 * k as f32, 1.4, level * 0.8, GLOW);
            }
        }
        // A drop lights the gap from below for a moment.
        if let Phase::Result { landing: Landing::Drop, left, demo: false } = self.phase {
            let k = (left / DROP_PAUSE).clamp(0.0, 1.0);
            for j in 0..4 {
                dot(out, gap, FLOOR_Y - 0.08 - 0.06 * j as f32, 2.0 + j as f32, 0.6 * k, FLASH);
            }
        }
        // The ball: bright where it is, waiting at the top left when ready.
        match (self.phase, self.ball) {
            (_, Some(ball)) => dot(out, ball.x, ball.y, 2.6, 1.0, FLASH),
            (Phase::Ready, None) => {
                let beat = 0.75 + 0.25 * (self.clock * 2.0 * PI * 1.2).sin();
                dot(out, START.0, START.1, 2.6, beat, FLASH);
            }
            _ => {}
        }
    }
}

/// The pixel for a field position.
fn to_px(x: f32, y: f32) -> (f32, f32) {
    ((x + 1.0) / 2.0 * N as f32, (1.0 - y) / 2.0 * N as f32)
}

/// Adds a soft dot of light to a layer. `r` is in pixels.
fn splat(buf: &mut [f32], x: f32, y: f32, r: f32, a: f32) {
    let (cx, cy) = to_px(x, y);
    let (x0, x1) = ((cx - r).floor().max(0.0) as usize, ((cx + r).ceil().max(0.0) as usize).min(N - 1));
    let (y0, y1) = ((cy - r).floor().max(0.0) as usize, ((cy + r).ceil().max(0.0) as usize).min(N - 1));
    for py in y0..=y1 {
        for px in x0..=x1 {
            let d = ((px as f32 + 0.5 - cx).powi(2) + (py as f32 + 0.5 - cy).powi(2)).sqrt() / r;
            if d < 1.0 {
                buf[py * N + px] += a * (1.0 - d * d);
            }
        }
    }
}

/// Adds a soft dot straight to the picture, for things refreshed every frame.
fn dot(out: &mut [u8], x: f32, y: f32, r: f32, a: f32, color: [f32; 3]) {
    let (cx, cy) = to_px(x, y);
    let reach = r * 2.0;
    let (x0, x1) = ((cx - reach).floor().max(0.0) as usize, ((cx + reach).ceil().max(0.0) as usize).min(N - 1));
    let (y0, y1) = ((cy - reach).floor().max(0.0) as usize, ((cy + reach).ceil().max(0.0) as usize).min(N - 1));
    for py in y0..=y1 {
        for px in x0..=x1 {
            let d = ((px as f32 + 0.5 - cx).powi(2) + (py as f32 + 0.5 - cy).powi(2)).sqrt() / r;
            let k = a * ((1.0 - d).clamp(0.0, 1.0) + 0.3 * (-d * d).exp());
            if k > 0.004 {
                let o = (py * N + px) * 4;
                for c in 0..3 {
                    out[o + c] = (out[o + c] as f32 + k * color[c] * 255.0).min(255.0) as u8;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Plays the game's own steps until the flight ends, as a frame loop would.
    fn finish_flight(g: &mut Whirlwind) {
        for _ in 0..100_000 {
            if !matches!(g.phase, Phase::Flight { .. }) {
                return;
            }
            g.step(1.0 / 60.0);
        }
        panic!("the flight never ended");
    }

    fn settle(g: &mut Whirlwind) {
        for _ in 0..1000 {
            if !matches!(g.phase, Phase::Result { .. } | Phase::Flight { .. }) {
                return;
            }
            g.step(1.0 / 60.0);
        }
    }

    #[test]
    fn every_hole_of_many_runs_has_an_answer_and_wrong_settings_miss() {
        for seed in 1..=6u32 {
            let mut rng = Rng(seed * 7919);
            let mut last = None;
            for n in 1..=16 {
                let hole = place_hole(n, last, &mut rng);
                last = Some(hole.x);
                let good = solutions(&hole);
                assert!(!good.is_empty(), "seed {seed} hole {n} {hole:?} has no answer");
                // Most settings miss: the hole is a real target.
                assert!(good.len() <= MOST_ANSWERS, "seed {seed} hole {n}: {} answers is too many", good.len());
                for (b, s) in &good {
                    assert_eq!(fly(*b, *s, &hole), Landing::Drop);
                }
                // Some neighbour of an answer misses, so the knobs matter notch by notch.
                let (b, s) = good[0];
                let near = [(b + 3, s), (b - 3, s), (b, s + 3), (b, s - 3)];
                assert!(near.iter().any(|&(b, s)| (0..NOTCHES).contains(&b) && (0..NOTCHES).contains(&s) && fly(b, s, &hole) != Landing::Drop));
            }
        }
    }

    #[test]
    fn early_holes_are_forgiving() {
        let mut rng = Rng(42);
        let hole = place_hole(1, None, &mut rng);
        assert!(solutions(&hole).len() >= 4);
    }

    #[test]
    fn a_ball_with_no_hole_in_reach_misses_both_ways() {
        // A hole far off the floor: soft, slow balls stop; hard, fast ones run off the end.
        let hole = Hole { x: 5.0, half: 0.1, drift: 0.0, rate: 0.0 };
        assert_eq!(fly(0, 0, &hole), Landing::Stopped);
        assert_eq!(fly(NOTCHES - 1, NOTCHES - 1, &hole), Landing::Overshot);
    }

    #[test]
    fn the_live_game_flies_as_the_test_does() {
        let mut g = Whirlwind::new(3);
        let (b, s) = solutions(&g.hole)[0];
        g.bounce = b;
        g.speed = s;
        assert!(g.plunge());
        // Uneven frames, as a phone gives.
        let mut i = 0;
        while matches!(g.phase, Phase::Flight { .. }) {
            g.step([0.016, 0.033, 0.011, 0.05][i % 4]);
            i += 1;
        }
        assert!(matches!(g.phase, Phase::Result { landing: Landing::Drop, .. }));
        assert_eq!(g.score, 20, "first ball at hole 1 scores double");
        assert!(g.events & EV_DROP != 0 && g.events & EV_BOUNCE != 0);
        settle(&mut g);
        assert_eq!(g.hole_no, 2);
        assert!(g.events & EV_NEW_HOLE != 0);
    }

    #[test]
    fn holes_narrow_and_start_to_move() {
        let h1 = Hole::numbered(1, 0.5);
        let h6 = Hole::numbered(6, 0.5);
        let h12 = Hole::numbered(12, 0.5);
        assert!(h6.half < h1.half && h12.half < h6.half);
        assert_eq!(h1.drift, 0.0);
        assert!(h12.drift > h6.drift && h6.drift > 0.0);
    }

    #[test]
    fn five_misses_end_the_run_and_the_score_is_taken_once() {
        let mut g = Whirlwind::new(11);
        // One drop first, on a second try, for 10 points.
        let good = solutions(&g.hole);
        let bad = (0..NOTCHES).flat_map(|b| (0..NOTCHES).map(move |s| (b, s))).find(|&(b, s)| fly(b, s, &g.hole) != Landing::Drop).unwrap();
        (g.bounce, g.speed) = bad;
        g.plunge();
        finish_flight(&mut g);
        settle(&mut g);
        assert_eq!(g.misses, 1);
        (g.bounce, g.speed) = good[0];
        g.plunge();
        finish_flight(&mut g);
        settle(&mut g);
        assert_eq!(g.score, 10);
        // Now miss until the run is over.
        let mut guard = 0;
        while g.phase != Phase::Over {
            let bad = (0..NOTCHES).flat_map(|b| (0..NOTCHES).map(move |s| (b, s))).find(|&(b, s)| fly(b, s, &g.hole) != Landing::Drop).unwrap();
            (g.bounce, g.speed) = bad;
            assert!(g.plunge());
            finish_flight(&mut g);
            settle(&mut g);
            guard += 1;
            assert!(guard < 10);
        }
        assert_eq!(g.misses, MISSES);
        assert!(g.events & EV_OVER != 0);
        assert_eq!(g.take_ended(), Some(10));
        assert_eq!(g.take_ended(), None);
        // The plunger starts again.
        assert!(g.plunge());
        assert_eq!((g.phase, g.misses, g.score, g.hole_no), (Phase::Ready, 0, 0, 1));
        assert_eq!(g.take_ended(), None);
    }

    #[test]
    fn walking_away_scores_the_run() {
        let mut g = Whirlwind::new(5);
        (g.bounce, g.speed) = solutions(&g.hole)[0];
        g.plunge();
        finish_flight(&mut g);
        settle(&mut g);
        assert_eq!(g.score, 20);
        g.end_run();
        assert_eq!(g.take_ended(), Some(20));
        assert!(!g.in_run());
        assert_eq!(g.hole_no, 1);
    }

    #[test]
    fn the_plunger_is_refused_in_flight_and_the_demo_never_counts() {
        let mut g = Whirlwind::new(9);
        g.demonstrate();
        assert!(matches!(g.phase, Phase::Flight { demo: true }));
        assert!(!g.plunge());
        assert!(g.events & EV_REFUSED != 0);
        finish_flight(&mut g);
        settle(&mut g);
        assert_eq!((g.misses, g.score, g.phase), (0, 0, Phase::Ready));
        assert!(!g.in_run());
    }

    #[test]
    fn knobs_stop_at_their_ends() {
        let mut g = Whirlwind::new(1);
        g.turn_bounce(20);
        assert_eq!(g.bounce, NOTCHES - 1);
        assert!(g.events & EV_STOP != 0);
        g.events = 0;
        g.turn_speed(-1);
        assert_eq!(g.speed, 3);
        assert_eq!(g.events, EV_NOTCH);
    }

    #[test]
    fn the_tube_is_round_and_the_trail_lingers() {
        let mut g = Whirlwind::new(2);
        g.plunge();
        for _ in 0..60 {
            g.step(1.0 / 60.0);
        }
        let mut out = vec![0u8; N * N * 4];
        g.render(&mut out);
        // Corners are outside the glass.
        assert_eq!(&out[0..3], &[0, 0, 0]);
        // The start point, left a second ago, still glows in the afterglow's colour.
        let (px, py) = to_px(START.0 + 0.01, START.1 - 0.01);
        let near = (py as usize - 3..py as usize + 4).flat_map(|y| (px as usize - 3..px as usize + 4).map(move |x| (y, x)));
        let lit = near.map(|(y, x)| out[(y * N + x) * 4 + 1]).max().unwrap();
        assert!(lit > 40, "the trail has faded too soon: {lit}");
    }

    #[test]
    #[ignore]
    fn print_landing_grid() {
        // Where each setting comes to rest or leaves, with no hole: for tuning the knobs' ranges.
        let hole = Hole { x: 5.0, half: 0.1, drift: 0.0, rate: 0.0 };
        for b in 0..NOTCHES {
            let row: Vec<String> = (0..NOTCHES)
                .map(|s| {
                    let mut ball = Ball::new(b, s);
                    let mut bounces = 0;
                    loop {
                        let (hit, end) = ball.step(&hole);
                        bounces += hit as u32;
                        if let Some(end) = end {
                            return if end == Landing::Overshot { format!("  >>{bounces:>2}") } else { format!("{:+.2}{bounces:>2}", ball.x) };
                        }
                    }
                })
                .collect();
            println!("e={:.2} {}", bounce_at(b), row.join(" "));
        }
        let mut rng = Rng(77);
        let mut last = None;
        for n in 1..=16 {
            let hole = place_hole(n, last, &mut rng);
            last = Some(hole.x);
            println!("hole {n:>2} x {:+.2} half {:.3} drift {:.2}: {} answers", hole.x, hole.half, hole.drift, solutions(&hole).len());
        }
    }
}
