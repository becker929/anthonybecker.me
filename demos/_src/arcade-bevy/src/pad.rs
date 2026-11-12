//! Touch input. The web page draws the stick and buttons and calls the exported functions
//! below; the game reads the result from the `Pad` resource. Native builds never fill it.

use std::sync::{
    atomic::{AtomicBool, AtomicU32, Ordering::Relaxed},
    Mutex,
};

use bevy::prelude::*;

pub const USE: u32 = 1;
pub const FIRE: u32 = 2;
pub const RESTART: u32 = 4;

/// Sounds the game asks the page to play, as bits. The page owns the audio (it plays recorded files);
/// the game only says what happened. See `sound` and `pad_sounds`.
pub const SOUND_NOTCH: u32 = 1;
pub const SOUND_FIRE: u32 = 2;
pub const SOUND_DUD: u32 = 4;
pub const SOUND_HIT: u32 = 8;
pub const SOUND_GROUND: u32 = 16;
pub const SOUND_WAVE: u32 = 32;
pub const SOUND_OVER: u32 = 64;
pub const SOUND_STEP_UP: u32 = 128;
pub const SOUND_STEP_AWAY: u32 = 256;
pub const SOUND_RESTART: u32 = 512;
pub const SOUND_BUTTON_UP: u32 = 1024;

/// The games, as the high score table numbers them.
pub const GAME_TUBE: u32 = 0;
pub const GAME_BERTIE: u32 = 1;
#[allow(dead_code)] // for the machines being added
pub const GAME_NIMROD: u32 = 2;
#[allow(dead_code)] // for the machines being added
pub const GAME_WHIRLWIND: u32 = 3;
#[allow(dead_code)] // for the machines being added
pub const GAME_PRINZ: u32 = 4;
/// How many games keep a table.
pub const GAMES: usize = 5;

/// What the page should offer, as told to it by `pad_state`.
pub const STATE_IN_REACH: u32 = 1;
pub const STATE_PLAYING: u32 = 2;
pub const STATE_OVER: u32 = 4;
/// A shell is in the air.
pub const STATE_FLIGHT: u32 = 8;
/// The machine being played is Bertie, not the tube cabinet. The page then offers Bertie's keys.
pub const STATE_BERTIE: u32 = 16;
/// The machine being played names its own touch targets (`publish_labels`), and the page lays one
/// tap target over each published point.
pub const STATE_TARGETS: u32 = 32;

static ACTIVE: AtomicBool = AtomicBool::new(false);
static STICK_X: AtomicU32 = AtomicU32::new(0);
static STICK_Y: AtomicU32 = AtomicU32::new(0);
// Look movement arrives as whole pixels and is summed until the next frame takes it.
static LOOK_X: AtomicU32 = AtomicU32::new(0);
static LOOK_Y: AtomicU32 = AtomicU32::new(0);
// How far a finger has turned each knob since the last frame, in thousandths of a radian, clockwise.
static KNOB_ELEVATION: AtomicU32 = AtomicU32::new(0);
static KNOB_CHARGE: AtomicU32 = AtomicU32::new(0);
// Where the focused cabinet's two knobs and button are on screen, for the page to put its touch targets on.
static POINTS: Mutex<Vec<f32>> = Mutex::new(Vec::new());
// Bertie's keys tapped on a touch screen since the last frame: a bit per square, and bit 9 for its dial.
static KEYS: AtomicU32 = AtomicU32::new(0);
// State bits other machines add to what the first cabinet reports.
static MORE_STATE: AtomicU32 = AtomicU32::new(0);
static HELD: AtomicU32 = AtomicU32::new(0);
// Presses are kept until a frame has seen them, so a tap shorter than a frame still counts.
static TAPPED: AtomicU32 = AtomicU32::new(0);
static STATE: AtomicU32 = AtomicU32::new(0);
static SOUNDS: AtomicU32 = AtomicU32::new(0);
// Finished games' scores, waiting for the page to take them to the table: (game, score).
static SCORES: Mutex<Vec<(u32, u32)>> = Mutex::new(Vec::new());
// The tables as the page last fetched them, one text per game, and a count of how often they changed.
static TABLES: Mutex<[String; GAMES]> = Mutex::new([const { String::new() }; GAMES]);
// Sounds asked for by name since the page last looked.
#[allow(dead_code)] // for the machines being added
static NAMED: Mutex<Vec<String>> = Mutex::new(Vec::new());
// Controls tapped on a touch screen since the last frame, by the index of their published point.
static TAPS: Mutex<Vec<u32>> = Mutex::new(Vec::new());
// The labels of the focused machine's touch targets, one per published point.
static LABELS: Mutex<Vec<String>> = Mutex::new(Vec::new());
// The focused machine's keyboard prompt: `keys|what` pairs separated by `;`.
static HINT: Mutex<String> = Mutex::new(String::new());
static TABLES_CHANGED: AtomicU32 = AtomicU32::new(0);
// How loud the tube's hum should be for where the player stands, 0 to 1, as f32 bits.
static HUM: AtomicU32 = AtomicU32::new(0);

#[derive(Resource, Default)]
pub struct Pad {
    /// True once the page has seen a touch. The HUD then stops talking about keys.
    pub active: bool,
    /// Right and forward, each from -1 to 1.
    pub stick: Vec2,
    /// Finger movement since the last frame, in CSS pixels.
    pub look: Vec2,
    /// Clockwise turns of the elevation and charge knobs since the last frame, in radians.
    pub knobs: Vec2,
    /// Controls tapped since the last frame, a bit each, by the index of their published point (the
    /// first 32 only; `taps` has them all).
    pub keys: u32,
    /// Every control tapped since the last frame, by the index of its published point.
    pub taps: Vec<u32>,
    pub held: u32,
    pub tapped: u32,
}

impl Pad {
    pub fn tapped(&self, button: u32) -> bool {
        self.tapped & button != 0
    }
    pub fn held(&self, button: u32) -> bool {
        self.held & button != 0
    }
}

pub struct PadPlugin;
impl Plugin for PadPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<Pad>().add_systems(PreUpdate, read_pad);
    }
}

fn read_pad(mut pad: ResMut<Pad>) {
    pad.active = ACTIVE.load(Relaxed);
    pad.stick = Vec2::new(f32::from_bits(STICK_X.load(Relaxed)), f32::from_bits(STICK_Y.load(Relaxed))).clamp_length_max(1.0);
    pad.look = Vec2::new(LOOK_X.swap(0, Relaxed) as i32 as f32, LOOK_Y.swap(0, Relaxed) as i32 as f32);
    pad.knobs = Vec2::new(KNOB_ELEVATION.swap(0, Relaxed) as i32 as f32, KNOB_CHARGE.swap(0, Relaxed) as i32 as f32) / 1000.0;
    MORE_STATE.store(0, Relaxed);
    pad.keys = KEYS.swap(0, Relaxed);
    pad.taps = std::mem::take(&mut *TAPS.lock().unwrap());
    pad.held = HELD.load(Relaxed);
    pad.tapped = TAPPED.swap(0, Relaxed);
}

/// Called by the game each frame so the page can show the right buttons.
pub fn publish_state(state: u32) {
    STATE.store(state, Relaxed);
}

/// State bits from the focused machine, added to the first cabinet's. They are cleared at the start of
/// every frame, so a machine adds them each frame it is focused, and passing 0 does nothing.
pub fn publish_more_state(bits: u32) {
    MORE_STATE.fetch_or(bits, Relaxed);
}

/// Hands a finished game's score to the page, which keeps the high score table.
pub fn score(game: u32, score: u32) {
    if score > 0 {
        SCORES.lock().unwrap().push((game, score));
    }
}

/// The high score tables, one text per game: a line per entry, the name, a tab, the score. The number
/// goes up whenever the page sends new ones, so the wall display knows to repaint.
pub fn tables() -> ([String; GAMES], u32) {
    (TABLES.lock().unwrap().clone(), TABLES_CHANGED.load(Relaxed))
}

/// Names the focused machine's touch targets, one label per published point, and tells the page to
/// lay a target over each. Call it every frame the machine is focused, with its points.
pub fn publish_labels(labels: &[&str]) {
    let mut held = LABELS.lock().unwrap();
    if held.len() != labels.len() || held.iter().zip(labels).any(|(a, b)| a != b) {
        *held = labels.iter().map(|l| l.to_string()).collect();
    }
    MORE_STATE.fetch_or(STATE_TARGETS, Relaxed);
}

/// The focused machine's keyboard prompt for the page: `keys|what` pairs separated by `;`, such as
/// `"W S|bounce;Space|release"`. Call it with `publish_labels`, every frame the machine is focused.
pub fn publish_hint(hint: &str) {
    let mut held = HINT.lock().unwrap();
    if *held != hint {
        *held = hint.to_string();
    }
}

/// Asks the page to play the sound of this name once (a file named in sounds/sounds.json).
#[allow(dead_code)] // for the machines being added
pub fn play(name: &str) {
    NAMED.lock().unwrap().push(name.to_string());
}

/// Replaces one game's table. The page does this through `pad_table`; the headless capture does it
/// to have something on the board.
pub fn set_table(game: u32, rows: String) {
    if let Some(table) = TABLES.lock().unwrap().get_mut(game as usize) {
        *table = rows;
        TABLES_CHANGED.fetch_add(1, Relaxed);
    }
}

/// Asks the page to play these sounds (any of the `SOUND_` bits). Each plays once.
pub fn sound(bits: u32) {
    SOUNDS.fetch_or(bits, Relaxed);
}

/// Tells the page how loud the tube's hum is from where the player stands, 0 to 1.
pub fn publish_hum(level: f32) {
    HUM.store(level.to_bits(), Relaxed);
}

/// Screen positions, in CSS pixels, of the focused machine's controls, as x, y pairs. The first cabinet
/// sends its two knobs and its button; Bertie sends nine keys, its dial and its reset button.
pub fn publish_points(points: &[f32]) {
    *POINTS.lock().unwrap() = points.to_vec();
}

#[cfg(target_arch = "wasm32")]
mod web {
    use wasm_bindgen::prelude::*;

    use super::*;

    #[wasm_bindgen]
    pub fn pad_stick(x: f32, y: f32) {
        ACTIVE.store(true, Relaxed);
        STICK_X.store(x.to_bits(), Relaxed);
        STICK_Y.store(y.to_bits(), Relaxed);
    }

    #[wasm_bindgen]
    pub fn pad_look(dx: i32, dy: i32) {
        ACTIVE.store(true, Relaxed);
        LOOK_X.store((LOOK_X.load(Relaxed) as i32).wrapping_add(dx) as u32, Relaxed);
        LOOK_Y.store((LOOK_Y.load(Relaxed) as i32).wrapping_add(dy) as u32, Relaxed);
    }

    #[wasm_bindgen]
    pub fn pad_button(button: u32, down: bool) {
        if down {
            ACTIVE.store(true, Relaxed);
            HELD.fetch_or(button, Relaxed);
            TAPPED.fetch_or(button, Relaxed);
        } else {
            HELD.fetch_and(!button, Relaxed);
        }
    }

    /// `knob` 0 is elevation, 1 is charge. `millirad` is clockwise as the player sees it.
    #[wasm_bindgen]
    pub fn pad_knob(knob: u32, millirad: i32) {
        ACTIVE.store(true, Relaxed);
        let acc = if knob == 0 { &KNOB_ELEVATION } else { &KNOB_CHARGE };
        acc.store((acc.load(Relaxed) as i32).wrapping_add(millirad) as u32, Relaxed);
    }

    /// A tap on one of Bertie's keys: 0 to 8 for the squares, 9 for the dial.
    #[wasm_bindgen]
    pub fn pad_key(key: u32) {
        ACTIVE.store(true, Relaxed);
        if key < 32 {
            KEYS.fetch_or(1 << key, Relaxed);
        }
        TAPS.lock().unwrap().push(key);
    }

    #[wasm_bindgen]
    pub fn pad_points() -> Vec<f32> {
        POINTS.lock().unwrap().clone()
    }

    /// The sounds asked for since the last call. Calling it clears them.
    #[wasm_bindgen]
    pub fn pad_sounds() -> u32 {
        SOUNDS.swap(0, Relaxed)
    }

    /// Sounds asked for by name since the last call, one per line. Calling it clears them.
    #[wasm_bindgen]
    pub fn pad_named_sounds() -> String {
        std::mem::take(&mut *NAMED.lock().unwrap()).join("\n")
    }

    /// The focused machine's keyboard prompt.
    #[wasm_bindgen]
    pub fn pad_hint() -> String {
        HINT.lock().unwrap().clone()
    }

    /// The focused machine's target labels, one per line.
    #[wasm_bindgen]
    pub fn pad_labels() -> String {
        LABELS.lock().unwrap().join("\n")
    }

    #[wasm_bindgen]
    pub fn pad_hum() -> f32 {
        f32::from_bits(HUM.load(Relaxed))
    }

    /// The next finished score, as game * 1,000,000 + score, or -1 if there is none.
    #[wasm_bindgen]
    pub fn pad_score() -> i32 {
        let mut scores = SCORES.lock().unwrap();
        if scores.is_empty() { -1 } else { let (game, score) = scores.remove(0); (game * 1_000_000 + score.min(999_999)) as i32 }
    }

    /// Reports a score as if a game had just ended. The page's tests use it to reach the name prompt.
    #[wasm_bindgen]
    pub fn pad_report_score(game: u32, score: u32) {
        super::score(game, score);
    }

    /// The page sends a game's table for the wall display: a line per entry, name, tab, score.
    #[wasm_bindgen]
    pub fn pad_table(game: u32, rows: String) {
        super::set_table(game, rows);
    }

    #[wasm_bindgen]
    pub fn pad_state() -> u32 {
        STATE.load(Relaxed) | MORE_STATE.load(Relaxed)
    }
}
