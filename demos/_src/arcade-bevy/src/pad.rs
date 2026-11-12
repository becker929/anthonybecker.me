//! Touch input. The web page draws the stick and buttons and calls the exported functions
//! below; the game reads the result from the `Pad` resource. Native builds never fill it.

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering::Relaxed};

use bevy::prelude::*;

pub const USE: u32 = 1;
pub const FIRE: u32 = 2;
pub const RESTART: u32 = 4;

/// What the page should offer, as told to it by `pad_state`.
pub const STATE_IN_REACH: u32 = 1;
pub const STATE_PLAYING: u32 = 2;
pub const STATE_OVER: u32 = 4;

static ACTIVE: AtomicBool = AtomicBool::new(false);
static STICK_X: AtomicU32 = AtomicU32::new(0);
static STICK_Y: AtomicU32 = AtomicU32::new(0);
// Look movement arrives as whole pixels and is summed until the next frame takes it.
static LOOK_X: AtomicU32 = AtomicU32::new(0);
static LOOK_Y: AtomicU32 = AtomicU32::new(0);
static HELD: AtomicU32 = AtomicU32::new(0);
// Presses are kept until a frame has seen them, so a tap shorter than a frame still counts.
static TAPPED: AtomicU32 = AtomicU32::new(0);
static STATE: AtomicU32 = AtomicU32::new(0);

#[derive(Resource, Default)]
pub struct Pad {
    /// True once the page has seen a touch. The HUD then stops talking about keys.
    pub active: bool,
    /// Right and forward, each from -1 to 1.
    pub stick: Vec2,
    /// Finger movement since the last frame, in CSS pixels.
    pub look: Vec2,
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
    pad.held = HELD.load(Relaxed);
    pad.tapped = TAPPED.swap(0, Relaxed);
}

/// Called by the game each frame so the page can show the right buttons.
pub fn publish_state(state: u32) {
    STATE.store(state, Relaxed);
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

    #[wasm_bindgen]
    pub fn pad_state() -> u32 {
        STATE.load(Relaxed)
    }
}
