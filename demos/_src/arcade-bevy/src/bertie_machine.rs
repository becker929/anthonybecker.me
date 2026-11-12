//! Bertie the Brain in the room: the model's working parts, its lamps, keys and signs.
//!
//! The game itself is src/bertie.rs, which also lists the sources on the 1950 machine. The model is
//! made by blender/bertie.py. This file gives the model's named parts their behaviour, the way
//! src/cabinet.rs does for the first cabinet.
//!
//! Everything that still needs a hand in another file is marked `WIRE:`. BERTIE.md lists them all.

use bevy::{
    asset::RenderAssetUsages,
    gltf::GltfAssetLabel,
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat},
    world_serialization::WorldInstanceReady,
};

use crate::{
    bertie::{self, BertieGame, Mark},
    cabinet::Cabinet,
    font,
    pad::{self, Pad},
    player::{Focus, Player},
};

// WIRE: choose where Bertie stands. This is to the right of the first cabinet, back to the same wall.
const BERTIE_AT: Vec3 = Vec3::new(2.0, 0.0, 0.0);
const BERTIE_YAW: f32 = 0.0;

/// Where the player's eye goes when playing, and what it looks at, in the machine's own space. It
/// stands further back than at the first cabinet, so the keys and the whole board are in view.
const SEAT_EYE: Vec3 = Vec3::new(0.0, 1.52, 1.575);
const SEAT_AIM: Vec3 = Vec3::new(0.0, 1.49, 0.10);
/// The camera's vertical field of view (src/player.rs), the depth of the machine's face, and half the
/// width that must be in view from the seat.
const SEAT_FOV: f32 = 68.0 * std::f32::consts::PI / 180.0;
const SEAT_FRONT: f32 = 0.40;
const SEAT_HALF_WIDTH: f32 = 0.80;
/// The machine's footprint for walking into: its centre and half its size on the floor, in its own space.
const BODY_CENTRE: Vec2 = Vec2::new(0.0, 0.125);
const BODY_HALF: Vec2 = Vec2::new(0.83, 0.55);
/// As in src/player.rs.
const PLAYER_RADIUS: f32 = 0.3;

/// One notch of the dial, in radians. blender/bertie.py puts the five ticks round it at the same step.
const DIAL_STEP: f32 = 0.6;
/// How far a key sinks under a finger, in metres.
const KEY_TRAVEL: f32 = 0.014;
const RESET_TRAVEL: f32 = 0.020;

/// The game's `EV_` bits are passed to the page shifted up by this, past the first cabinet's sounds.
// WIRE: in src/pad.rs name these bits (SOUND_BERTIE_KEY = 1 << 11 and so on, in the order of the
// `EV_` constants in src/bertie.rs), and add their names to EVENTS in web/index.html.
const SOUND_SHIFT: u32 = 11;

/// The top row of digits, and the number pad. The digits read like a page: 1 is the top left square.
/// The number pad is laid out as the board is, so its 7 is the top left square.
const DIGITS: [KeyCode; 9] = [
    KeyCode::Digit1, KeyCode::Digit2, KeyCode::Digit3,
    KeyCode::Digit4, KeyCode::Digit5, KeyCode::Digit6,
    KeyCode::Digit7, KeyCode::Digit8, KeyCode::Digit9,
];
const NUMPAD: [KeyCode; 9] = [
    KeyCode::Numpad7, KeyCode::Numpad8, KeyCode::Numpad9,
    KeyCode::Numpad4, KeyCode::Numpad5, KeyCode::Numpad6,
    KeyCode::Numpad1, KeyCode::Numpad2, KeyCode::Numpad3,
];

/// The machine. It sits on the root of the model, with the game it is playing.
#[derive(Component)]
pub struct Bertie {
    pub game: BertieGame,
}

/// What a lamp shows.
#[derive(Clone, Copy, PartialEq)]
enum Shows {
    /// The X lamp of a square on the board.
    X(usize),
    /// The O lamp of a square on the board.
    O(usize),
    Player,
    Machine,
    Win,
    Lose,
    Draw,
}

/// Anything on the machine that is either lit or dark: the board's lamps, the keys and the signs.
#[derive(Component)]
struct Lamp {
    machine: Entity,
    shows: Shows,
    on: Handle<StandardMaterial>,
    off: Handle<StandardMaterial>,
    /// What was last drawn. None until the first frame, so every lamp is set once.
    lit: Option<bool>,
}

/// One of the nine keys.
#[derive(Component)]
struct Key {
    machine: Entity,
    cell: usize,
    press: f32,
    /// Where the model put it; pressing sinks it from here.
    rest: Vec3,
}

#[derive(Component)]
struct Dial {
    machine: Entity,
    turn: f32,
    speed: f32,
}

#[derive(Component)]
struct ResetButton {
    machine: Entity,
    press: f32,
    rest: Vec3,
}

/// The board's own light on the floor and the player. It grows as lamps come on.
#[derive(Component)]
struct BoardLight(Entity);


/// The materials the parts are repainted with, made once.
#[derive(Resource)]
struct Look {
    x: [Handle<StandardMaterial>; 2],
    o: [Handle<StandardMaterial>; 2],
    /// Lit and unlit, in the order Player, Machine, Win, Lose, Draw.
    signs: [[Handle<StandardMaterial>; 2]; 5],
}

/// Where the camera was last frame, as `take_seat` left it. Its eased path to the seat starts here.
#[derive(Resource, Default)]
struct Seat(Transform);

pub struct BertiePlugin;
impl Plugin for BertiePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<Seat>()
            .add_systems(Startup, (make_look, spawn_bertie).chain())
            .add_systems(Update, (play, tick_games, report_sounds, light_lamps, animate_controls, publish).chain())
            // WIRE: these two stand in for src/player.rs until it knows about a second machine. See each.
            .add_systems(PostUpdate, (keep_out, take_seat).chain().before(TransformSystems::Propagate));
    }
}

// ---------------------------------------------------------------- pictures

/// The glyphs the signs need that src/font.rs does not have.
// WIRE: these could move into src/font.rs; `letters` would then be `font::draw_text`.
fn extra_glyph(c: char) -> Option<[u8; 7]> {
    match c {
        'L' => Some([0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F]),
        'W' => Some([0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11]),
        'X' => Some([0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11]),
        _ => None,
    }
}

/// Draws `text` centred on `cx`, like `font::draw_text`, with the extra glyphs.
fn letters(buf: &mut [u8], w: usize, text: &str, cx: usize, y: usize, scale: usize, rgb: [u8; 3]) {
    let x0 = cx.saturating_sub(text.chars().count() * 6 * scale / 2);
    for (i, c) in text.chars().enumerate() {
        let left = x0 + i * 6 * scale;
        let Some(rows) = extra_glyph(c) else {
            font::draw_text(buf, w, c.encode_utf8(&mut [0; 4]), left + 3 * scale, y, scale, rgb);
            continue;
        };
        for (gy, row) in rows.iter().enumerate() {
            for gx in (0..5).filter(|gx| row & (0x10 >> gx) != 0) {
                for (sy, sx) in (0..scale).flat_map(|sy| (0..scale).map(move |sx| (sy, sx))) {
                    let (px, py) = (left + gx * scale + sx, y + gy * scale + sy);
                    let o = (py * w + px) * 4;
                    if px < w && o + 3 < buf.len() {
                        buf[o..o + 3].copy_from_slice(&rgb);
                    }
                }
            }
        }
    }
}

const INK: [u8; 3] = [20, 10, 4];
/// The machine's colour, as on its X lamps, and the player's, as on the O lamps.
const AMBER: [f32; 3] = [255.0, 150.0, 58.0];
const CREAM: [f32; 3] = [255.0, 196.0, 128.0];

/// A lit panel with dark lettering, as on the first cabinet's marquee. Each line is its text, the
/// row of its top edge, and its scale.
fn sign_image(w: usize, h: usize, tint: [f32; 3], lines: &[(&str, usize, usize)]) -> Image {
    let mut data = vec![0u8; w * h * 4];
    for (i, px) in data.chunks_exact_mut(4).enumerate() {
        let (x, y) = (i % w, i / w);
        let edge = x < 3 || x >= w - 3 || y < 3 || y >= h - 3;
        // A little darker toward the foot, like a box lit from a lamp behind its middle.
        let shade = 1.0 - 0.25 * (y as f32 / h as f32 - 0.4).abs();
        let c = if edge { INK } else { [(tint[0] * shade) as u8, (tint[1] * shade) as u8, (tint[2] * shade) as u8] };
        px.copy_from_slice(&[c[0], c[1], c[2], 255]);
    }
    for &(text, y, scale) in lines {
        letters(&mut data, w, text, w / 2, y, scale, INK);
    }
    Image::new(
        Extent3d { width: w as u32, height: h as u32, depth_or_array_layers: 1 },
        TextureDimension::D2,
        data,
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::RENDER_WORLD,
    )
}

fn make_look(mut commands: Commands, mut materials: ResMut<Assets<StandardMaterial>>, mut images: ResMut<Assets<Image>>) {
    let mut glass = |glow: LinearRgba, body: Color| {
        materials.add(StandardMaterial { base_color: body, emissive: glow, perceptual_roughness: 0.25, ..default() })
    };
    // Unlit, the board's lamps are smoked glass that all but vanishes against the black field.
    let dark = glass(LinearRgba::BLACK, Color::srgb(0.05, 0.045, 0.04));
    let x = [glass(LinearRgba::rgb(6.0, 2.3, 0.35), Color::BLACK), dark.clone()];
    let o = [glass(LinearRgba::rgb(4.2, 3.5, 2.5), Color::BLACK), dark];
    // A sign is the same picture lit or unlit, so its words can just be read when it is dark.
    let mut panel = |image: Image, lit: f32, unlit: f32| {
        let picture = images.add(image);
        [lit, unlit].map(|level| {
            materials.add(StandardMaterial {
                base_color: Color::BLACK,
                emissive: LinearRgba::rgb(level, level, level),
                emissive_texture: Some(picture.clone()),
                ..default()
            })
        })
    };
    // The pictures match the panels' shapes in blender/bertie.py.
    let signs = [
        panel(sign_image(128, 192, CREAM, &[("HUMAN", 16, 2), ("BRAIN", 38, 2), ("O", 84, 12)]), 1.5, 0.024),
        panel(sign_image(128, 192, AMBER, &[("ELECTRONIC", 16, 2), ("BRAIN", 38, 2), ("X", 84, 12)]), 1.5, 0.035),
        panel(sign_image(120, 84, CREAM, &[("WIN", 24, 5)]), 2.2, 0.024),
        panel(sign_image(120, 84, AMBER, &[("WIN", 24, 5)]), 2.2, 0.035),
        panel(sign_image(240, 60, CREAM, &[("DRAW", 12, 5)]), 2.2, 0.024),
    ];
    commands.insert_resource(Look { x, o, signs });
}

// ---------------------------------------------------------------- the model

fn spawn_bertie(mut commands: Commands, assets: Res<AssetServer>) {
    let root = commands
        .spawn((
            Bertie { game: BertieGame::new(0x1950) },
            // WIRE: `Cabinet` is borrowed so that E, Escape and the PLAY button step up to Bertie through
            // src/cabinet.rs and src/player.rs as they stand. Once those know about a second kind of
            // machine, give Bertie whatever they then ask for and remove this.
            Cabinet,
            Transform::from_translation(BERTIE_AT).with_rotation(Quat::from_rotation_y(BERTIE_YAW)),
            // WIRE: build-web.sh must copy assets/bertie.glb into dist/assets/ beside arcade.glb.
            WorldAssetRoot(assets.load(GltfAssetLabel::Scene(0).from_asset("bertie.glb"))),
        ))
        .observe(wire_model)
        .id();
    commands.spawn((
        BoardLight(root),
        PointLight { color: Color::srgb(1.0, 0.72, 0.45), intensity: 0.0, range: 3.0, ..default() },
        Transform::from_xyz(0.0, 1.80, 0.55),
        ChildOf(root),
    ));
    // Bertie's light is not baked yet, and the room has no ambient light of its own, so one soft lamp
    // from above and in front stands in for the room's light on it. It leaves the baked scenery alone.
    commands.spawn((
        SpotLight {
            color: Color::srgb(1.0, 0.90, 0.80),
            intensity: 420_000.0,
            range: 7.0,
            radius: 0.6,
            inner_angle: 0.30,
            outer_angle: 0.80,
            affects_lightmapped_mesh_diffuse: false,
            ..default()
        },
        Transform::from_translation(BERTIE_AT + Vec3::new(-0.9, 3.0, 2.6))
            .looking_at(BERTIE_AT + Vec3::new(0.0, 1.5, 0.2), Vec3::Y),
    ));
}

/// Runs once the model is in the world: finds its named parts and makes them work.
fn wire_model(
    ready: On<WorldInstanceReady>,
    mut commands: Commands,
    look: Res<Look>,
    machines: Query<(), With<Bertie>>,
    children: Query<&Children>,
    named: Query<(&Name, &Transform)>,
) {
    let root = ready.entity;
    if !machines.contains(root) {
        return;
    }
    for entity in children.iter_descendants(root) {
        let Ok((name, at)) = named.get(entity) else { continue };
        let name = name.as_str();
        let lamp = |shows: Shows, pair: &[Handle<StandardMaterial>; 2]| Lamp {
            machine: root,
            shows,
            on: pair[0].clone(),
            off: pair[1].clone(),
            lit: None,
        };
        // "Lamp_X_4" and its like end in the number of their square.
        let cell = |prefix: &str| name.strip_prefix(prefix).and_then(|n| n.parse::<usize>().ok()).filter(|&n| n < 9);
        if let Some(cell) = cell("Lamp_X_") {
            commands.entity(entity).insert(lamp(Shows::X(cell), &look.x));
        } else if let Some(cell) = cell("Lamp_O_") {
            commands.entity(entity).insert(lamp(Shows::O(cell), &look.o));
        } else if let Some(cell) = cell("Key_") {
            // The caps keep the picture the model gives them. Only their travel is driven.
            commands.entity(entity).insert(Key { machine: root, cell, press: 0.0, rest: at.translation });
        } else {
            match name {
                "Sign_Player" => drop(commands.entity(entity).insert(lamp(Shows::Player, &look.signs[0]))),
                "Sign_Machine" => drop(commands.entity(entity).insert(lamp(Shows::Machine, &look.signs[1]))),
                "Sign_Win" => drop(commands.entity(entity).insert(lamp(Shows::Win, &look.signs[2]))),
                "Sign_Lose" => drop(commands.entity(entity).insert(lamp(Shows::Lose, &look.signs[3]))),
                "Sign_Draw" => drop(commands.entity(entity).insert(lamp(Shows::Draw, &look.signs[4]))),
                "Dial_Difficulty" => drop(commands.entity(entity).insert(Dial { machine: root, turn: 0.0, speed: 0.0 })),
                "Button_Reset" => {
                    commands.entity(entity).insert(ResetButton { machine: root, press: 0.0, rest: at.translation });
                }
                _ => {}
            }
        }
    }
}

// ---------------------------------------------------------------- play

/// Keys tapped on a touch screen this frame, as a bit for each square.
fn touch_presses(pad: &Pad) -> u16 {
    (pad.keys & 0x1FF) as u16
}

/// The keyboard works the machine while the player stands at it.
fn play(
    keys: Res<ButtonInput<KeyCode>>,
    pad: Res<Pad>,
    focus: Res<Focus>,
    mut machines: Query<&mut Bertie>,
    mut caps: Query<&mut Key>,
) {
    let Some(machine) = focus.0 else { return };
    let Ok(mut bertie) = machines.get_mut(machine) else { return };
    let mut pressed = touch_presses(&pad);
    for cell in 0..9 {
        if keys.just_pressed(DIGITS[cell]) || keys.just_pressed(NUMPAD[cell]) {
            pressed |= 1 << cell;
        }
    }
    for cell in (0..9).filter(|cell| pressed & (1 << cell) != 0) {
        // The game says by its events whether the key took, and the sounds follow from those.
        bertie.game.press(cell);
        // The cap goes down under the finger whether or not the square could be taken.
        for mut cap in caps.iter_mut().filter(|cap| cap.machine == machine && cap.cell == cell) {
            cap.press = 1.0;
        }
    }
    // The page's AGAIN button sends RESTART. It will not show until the page is told Bertie's game is over.
    if keys.just_pressed(KeyCode::KeyR) || pad.tapped(pad::RESTART) {
        bertie.game.reset();
    }
    let mut notches = keys.just_pressed(KeyCode::BracketRight) as i32 - keys.just_pressed(KeyCode::BracketLeft) as i32;
    // A tap on the dial clicks it one notch harder, and from the hardest back round to the easiest.
    if pad.keys & (1 << 9) != 0 {
        notches = if bertie.game.level() + 1 >= bertie::LEVELS { -(bertie::LEVELS as i32) } else { 1 };
    }
    if notches != 0 {
        bertie.game.turn_dial(notches);
    }
}

/// Every machine keeps running, so one left in the middle of its move still makes it.
fn tick_games(time: Res<Time>, mut machines: Query<&mut Bertie>) {
    for mut bertie in &mut machines {
        bertie.game.step(time.delta_secs());
    }
}

/// Passes on what the game says happened.
fn report_sounds(focus: Res<Focus>, mut machines: Query<(Entity, &mut Bertie)>) {
    for (machine, mut bertie) in &mut machines {
        // Walking away from the machine ends a run of wins, as losing or drawing does.
        if focus.0 != Some(machine) {
            bertie.game.end_streak();
        }
        if let Some(score) = bertie.game.take_ended() {
            pad::score(pad::GAME_BERTIE, score);
        }
        if bertie.game.events != 0 {
            pad::sound(bertie.game.events << SOUND_SHIFT);
            bertie.game.events = 0;
        }
    }
}

/// Sets every lamp, key and sign from the game. A lamp is repainted only when it changes.
fn light_lamps(
    machines: Query<&Bertie>,
    mut lamps: Query<(Entity, &mut Lamp, &mut Visibility)>,
    children: Query<&Children>,
    mut painted: Query<&mut MeshMaterial3d<StandardMaterial>>,
    mut lights: Query<(&BoardLight, &mut PointLight)>,
) {
    for (entity, mut lamp, mut visibility) in &mut lamps {
        let Ok(bertie) = machines.get(lamp.machine) else { continue };
        let game = &bertie.game;
        let signs = game.signs();
        let (lit, hidden) = match lamp.shows {
            // The X and O lamps of a square overlap. Once a square is taken, the other shape is put
            // away, so nothing dark crosses the lit one.
            // An unlit shape is put away too: an idle square shows only the model's frosted pane and
            // dark bulb, not a ring laid over a cross.
            Shows::X(cell) => (game.lamp(cell) == Mark::X, game.lamp(cell) != Mark::X),
            Shows::O(cell) => (game.lamp(cell) == Mark::O, game.lamp(cell) != Mark::O),
            Shows::Player => (signs.player, false),
            Shows::Machine => (signs.machine, false),
            Shows::Win => (signs.win, false),
            Shows::Lose => (signs.lose, false),
            Shows::Draw => (signs.draw, false),
        };
        let want = if hidden { Visibility::Hidden } else { Visibility::Inherited };
        if *visibility != want {
            *visibility = want;
        }
        if lamp.lit != Some(lit) {
            lamp.lit = Some(lit);
            let material = if lit { &lamp.on } else { &lamp.off };
            for mesh in children.iter_descendants(entity) {
                if let Ok(mut paint) = painted.get_mut(mesh) {
                    paint.0 = material.clone();
                }
            }
        }
    }
    for (light, mut point) in &mut lights {
        let Ok(bertie) = machines.get(light.0) else { continue };
        let lit = (0..9).filter(|&cell| bertie.game.lamp(cell) != Mark::Empty).count();
        point.intensity = 500.0 + 260.0 * lit as f32;
    }
}

fn animate_controls(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    pad: Res<Pad>,
    focus: Res<Focus>,
    machines: Query<&Bertie>,
    mut caps: Query<(&mut Key, &mut Transform), (Without<Dial>, Without<ResetButton>)>,
    mut dials: Query<(&mut Dial, &mut Transform), Without<ResetButton>>,
    mut buttons: Query<(&mut ResetButton, &mut Transform)>,
) {
    let dt = time.delta_secs().min(0.05);
    for (mut cap, mut tf) in &mut caps {
        // Down at once, back up on its spring.
        cap.press = (cap.press - dt * 6.0).max(0.0);
        tf.translation = cap.rest - Vec3::Y * KEY_TRAVEL * cap.press;
    }
    for (mut dial, mut tf) in &mut dials {
        let Ok(bertie) = machines.get(dial.machine) else { continue };
        // Seen from the player, a negative turn about Y is clockwise, and clockwise is harder. The
        // middle notch points straight up the deck.
        let middle = (bertie::LEVELS - 1) as f32 / 2.0;
        let want = (middle - bertie.game.level() as f32) * DIAL_STEP;
        // The same stiff spring as the first cabinet's knobs: it jumps to the notch and settles.
        // Stepped in slices of a few milliseconds: a whole slow frame at once makes a spring this stiff
        // gain energy until the dial shakes itself out of sight.
        let mut left = dt.min(0.05);
        while left > 0.0 {
            let h = left.min(0.004);
            left -= h;
            let pull = (want - dial.turn) * 1400.0 - dial.speed * 34.0;
            dial.speed += pull * h;
            dial.turn += dial.speed * h;
        }
        if !dial.turn.is_finite() || !dial.speed.is_finite() {
            dial.turn = want;
            dial.speed = 0.0;
        }
        tf.rotation = Quat::from_rotation_y(dial.turn);
    }
    for (mut button, mut tf) in &mut buttons {
        let held = focus.0 == Some(button.machine) && (keys.pressed(KeyCode::KeyR) || pad.held(pad::RESTART));
        button.press = if held { (button.press + dt * 22.0).min(1.0) } else { (button.press - dt * 4.0).max(0.0) };
        tf.translation = button.rest - Vec3::Y * RESET_TRAVEL * button.press;
    }
}

/// Where the focused machine's controls are on screen, in the window's logical pixels, as (x, y) pairs:
/// the nine keys, the dial, the reset button, then the nine squares of the board, which a finger may
/// press instead of a key. A part that is out of view is at -1000.
fn touch_points(
    machine: Entity,
    camera: &Camera,
    view: &GlobalTransform,
    caps: &Query<(&Key, &GlobalTransform)>,
    dials: &Query<(&Dial, &GlobalTransform)>,
    buttons: &Query<(&ResetButton, &GlobalTransform)>,
    lamps: &Query<(&Lamp, &GlobalTransform)>,
) -> [f32; 40] {
    let mut points = [-1000.0; 40];
    let mut put = |slot: usize, at: &GlobalTransform| {
        if let Ok(p) = camera.world_to_viewport(view, at.translation()) {
            points[slot * 2] = p.x;
            points[slot * 2 + 1] = p.y;
        }
    };
    for (cap, at) in caps.iter().filter(|(cap, _)| cap.machine == machine) {
        put(cap.cell, at);
    }
    for (_, at) in dials.iter().filter(|(dial, _)| dial.machine == machine) {
        put(9, at);
    }
    for (_, at) in buttons.iter().filter(|(button, _)| button.machine == machine) {
        put(10, at);
    }
    for (lamp, at) in lamps.iter().filter(|(lamp, _)| lamp.machine == machine) {
        if let Shows::X(cell) = lamp.shows {
            put(11 + cell, at);
        }
    }
    points
}

// ---------------------------------------------------------------- the player at the machine

/// Keeps the player out of the machine's body.
// WIRE: `walk` in src/player.rs pushes the player out of every `Cabinet`, but with the first cabinet's
// size, and Bertie is twice as wide. Give each machine its own footprint there and remove this.
fn keep_out(
    focus: Res<Focus>,
    machines: Query<&Transform, (With<Bertie>, Without<Player>)>,
    mut player: Single<&mut Transform, With<Player>>,
) {
    if focus.0.is_some() {
        return;
    }
    for machine in &machines {
        let mut local = machine.compute_affine().inverse().transform_point3(player.translation);
        let half = BODY_HALF + PLAYER_RADIUS;
        let d = Vec2::new(local.x, local.z) - BODY_CENTRE;
        if d.x.abs() < half.x && d.y.abs() < half.y {
            // Push out along the shallowest axis.
            if half.x - d.x.abs() < half.y - d.y.abs() {
                local.x = BODY_CENTRE.x + half.x * d.x.signum();
            } else {
                local.z = BODY_CENTRE.y + half.y * d.y.signum();
            }
            player.translation = machine.transform_point(local);
        }
    }
}

/// Moves the camera to Bertie's seat while the player is at it.
// WIRE: `place_camera` in src/player.rs moves to the first cabinet's seat for any focused `Cabinet`,
// which is too close to see Bertie's board. This runs after it and overrides it. Give each machine
// its own eye and aim in src/player.rs (SEAT_EYE and SEAT_AIM here) and remove this.
fn take_seat(
    time: Res<Time>,
    focus: Res<Focus>,
    mut seat: ResMut<Seat>,
    machines: Query<&Transform, (With<Bertie>, Without<Player>)>,
    player: Single<(&mut Player, &mut Transform, &Camera)>,
) {
    let (mut player, mut tf, camera) = player.into_inner();
    let Some(machine) = focus.0.and_then(|e| machines.get(e).ok()) else {
        seat.0 = *tf;
        return;
    };
    // On an upright phone the view is narrow, so the seat steps back until the whole width of the
    // machine is in it: the plunger, the dial and the signs at the sides.
    let aspect = camera.logical_viewport_size().map_or(16.0 / 9.0, |size| size.x / size.y.max(1.0));
    let half_width_per_metre = (SEAT_FOV / 2.0).tan() * aspect;
    let mut eye = SEAT_EYE;
    eye.z = eye.z.max(SEAT_FRONT + SEAT_HALF_WIDTH / half_width_per_metre);
    let want = Transform::from_translation(machine.transform_point(eye))
        .looking_at(machine.transform_point(SEAT_AIM), Vec3::Y);
    // `place_camera` has already moved the camera toward the wrong seat this frame, so the path is
    // kept here and written over it. It starts from where the camera was when the player stepped up.
    let k = 1.0 - (-8.0 * time.delta_secs()).exp();
    let now = Transform {
        translation: seat.0.translation.lerp(want.translation, k),
        rotation: seat.0.rotation.slerp(want.rotation, k),
        scale: Vec3::ONE,
    };
    seat.0 = now;
    *tf = now;
    // Remember where we are looking, so leaving the machine does not snap the view.
    let (yaw, pitch, _) = now.rotation.to_euler(EulerRot::YXZ);
    player.yaw = yaw;
    player.pitch = pitch;
}

// ---------------------------------------------------------------- the page

/// Tells the page that Bertie is the machine being played, whether its game is over, and where its
/// keys are on screen, so fingers can press them. The page draws the prompts; nothing is written here.
fn publish(
    focus: Res<Focus>,
    pad: Res<Pad>,
    machines: Query<&Bertie>,
    camera: Single<(&Camera, &GlobalTransform), With<Player>>,
    caps: Query<(&Key, &GlobalTransform)>,
    dials: Query<(&Dial, &GlobalTransform)>,
    buttons: Query<(&ResetButton, &GlobalTransform)>,
    lamps: Query<(&Lamp, &GlobalTransform)>,
) {
    let Some((machine, bertie)) = focus.0.and_then(|e| machines.get(e).ok().map(|b| (e, b))) else {
        pad::publish_more_state(0);
        return;
    };
    pad::publish_more_state(pad::STATE_BERTIE | if bertie.game.over().is_some() { pad::STATE_OVER } else { 0 });
    if pad.active {
        let (camera, view) = *camera;
        pad::publish_points(&touch_points(machine, camera, view, &caps, &dials, &buttons, &lamps));
    }
}
