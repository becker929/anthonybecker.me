//! Nimrod in the room: the model's lamps, legends, buttons, switch and plungers.
//!
//! The game itself is src/nimrod.rs, which also lists the sources on the 1951 machine. The model is
//! made by blender/nimrod.py. NIMROD.md has the node table, the keys and the touch points.
//!
//! When nobody is at it, the machine plays both sides by itself, as the real one could for a crowd.
//! Stepping up stops that and deals a fresh position.

use std::collections::HashMap;

use bevy::{gltf::GltfAssetLabel, prelude::*, world_serialization::WorldInstanceReady};

use crate::{
    nimrod::{self, Legends, NimrodGame, HEAPS},
    pad::{self, Pad},
    player::{Focus, Machine, Player},
};

/// Where Nimrod stands: against the back wall, left of the tube cabinet, facing into the room.
const NIMROD_AT: Vec3 = Vec3::new(-2.3, 0.0, 0.0);
const NIMROD_YAW: f32 = 0.0;

/// The seat, in the machine's own space. blender/nimrod.py holds the same numbers and prints where
/// every part lands from here, in landscape and on an upright phone.
const SEAT_EYE: Vec3 = Vec3::new(0.0, 1.55, 1.55);
const SEAT_AIM: Vec3 = Vec3::new(0.0, 1.56, -0.05);
/// The desk's front edge, and half the width that must stay in view: the lamp rows and the buttons.
/// The side panels may fall outside it on an upright phone; the game can be played without them.
const SEAT_FRONT: f32 = 0.43;
const SEAT_HALF_WIDTH: f32 = 0.44;
/// The footprint, desk included: 1.7 m by 0.9 m round the origin.
const BODY_CENTRE: Vec2 = Vec2::new(0.0, 0.0);
const BODY_HALF: Vec2 = Vec2::new(0.85, 0.45);

/// How far the buttons and plungers sink, in metres.
const KEY_TRAVEL: f32 = 0.012;
const PLUNGER_TRAVEL: f32 = 0.020;
/// The game switch leans this far either way, in radians about its own Z. Left is the simple game.
const LEVER_THROW: f32 = 0.38;
/// A keyboard player's choice of heap waits this long for the second key.
const ARM_TIME: f32 = 4.0;

/// Touch points, in the order they are published: the 32 desk buttons row by row (row 0 is the top
/// heap, and in each row the zero button comes first), then these.
const TOUCH_COMP: usize = 32;
const TOUCH_LEVER: usize = 33;
const TOUCH_NEW: usize = 34;
const TOUCH_POINTS: usize = 35;

/// Lit lamps glow at these strengths over the colour each lamp's glass had in the model.
const WARM: LinearRgba = LinearRgba::rgb(1.0, 0.45, 0.12);
const WHITE: LinearRgba = LinearRgba::rgb(0.80, 0.86, 1.0);
const RED: LinearRgba = LinearRgba::rgb(1.0, 0.16, 0.06);

const DIGITS: [KeyCode; 8] = [
    KeyCode::Digit0, KeyCode::Digit1, KeyCode::Digit2, KeyCode::Digit3,
    KeyCode::Digit4, KeyCode::Digit5, KeyCode::Digit6, KeyCode::Digit7,
];
const NUMPAD: [KeyCode; 8] = [
    KeyCode::Numpad0, KeyCode::Numpad1, KeyCode::Numpad2, KeyCode::Numpad3,
    KeyCode::Numpad4, KeyCode::Numpad5, KeyCode::Numpad6, KeyCode::Numpad7,
];

/// The machine. It sits on the root of the model, with the game it is playing.
#[derive(Component)]
pub struct Nimrod {
    pub game: NimrodGame,
    /// The heap a keyboard player has chosen with 1 to 4, waiting for how many to leave, and the
    /// seconds it has left.
    armed: Option<(usize, f32)>,
}

/// What a lamp shows.
#[derive(Clone, Copy)]
enum Shows {
    Match(usize, u8),
    Changed(usize),
    Instruction(u8),
    Register(usize, u8),
    Select(usize),
    Odd(u8),
    Legend(fn(&Legends) -> bool),
    /// A desk button's cap, lit while the match above it is in.
    Key(usize, u8),
}

/// Anything on the machine that is lit or dark.
#[derive(Component)]
struct Lamp {
    machine: Entity,
    shows: Shows,
    on: Handle<StandardMaterial>,
    off: Handle<StandardMaterial>,
    lit: Option<bool>,
}

#[derive(Component)]
struct Key {
    machine: Entity,
    heap: usize,
    leave: u8,
    press: f32,
    rest: Vec3,
}

#[derive(Clone, Copy, PartialEq)]
enum Which {
    CompMove,
    NewGame,
}

#[derive(Component)]
struct Plunger {
    machine: Entity,
    which: Which,
    press: f32,
    rest: Vec3,
}

#[derive(Component)]
struct Lever {
    machine: Entity,
    angle: f32,
    speed: f32,
    rest: Quat,
}

/// The panels' own light on the desk and the player. It grows as lamps come on.
#[derive(Component)]
struct PanelLight(Entity);

pub struct NimrodPlugin;
impl Plugin for NimrodPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, spawn_nimrod).add_systems(
            Update,
            (attend, play, tick_games, report, light_lamps, animate_controls, publish).chain(),
        );
    }
}

// ---------------------------------------------------------------- the model

fn spawn_nimrod(mut commands: Commands, assets: Res<AssetServer>) {
    let root = commands
        .spawn((
            Nimrod { game: NimrodGame::new(0x1951), armed: None },
            Machine {
                id: pad::GAME_NIMROD,
                seat_eye: SEAT_EYE,
                seat_aim: SEAT_AIM,
                seat_half_width: SEAT_HALF_WIDTH,
                seat_front: SEAT_FRONT,
                body_centre: BODY_CENTRE,
                body_half: BODY_HALF,
            },
            Transform::from_translation(NIMROD_AT).with_rotation(Quat::from_rotation_y(NIMROD_YAW)),
            WorldAssetRoot(assets.load(GltfAssetLabel::Scene(0).from_asset("nimrod.glb"))),
        ))
        .observe(wire_model)
        .id();
    commands.spawn((
        PanelLight(root),
        PointLight { color: Color::srgb(1.0, 0.70, 0.42), intensity: 0.0, range: 2.6, ..default() },
        Transform::from_xyz(0.0, 1.80, 0.45),
        ChildOf(root),
    ));
    // Nimrod's light is not baked, so one soft lamp from above and in front stands in for the room's
    // light on it, as Bertie's does. It comes from the room's side, away from the corner.
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
        Transform::from_translation(NIMROD_AT + Vec3::new(0.9, 3.0, 2.6))
            .looking_at(NIMROD_AT + Vec3::new(0.0, 1.5, 0.1), Vec3::Y),
    ));
}

/// The colour and strength a lamp glows at when lit, by what it shows.
fn glow(shows: Shows) -> LinearRgba {
    match shows {
        Shows::Changed(_) => WHITE * 5.0,
        Shows::Select(_) | Shows::Odd(_) => RED * 5.0,
        Shows::Legend(_) => WARM * 3.0,
        Shows::Key(..) => WARM * 1.6,
        _ => WARM * 5.0,
    }
}

/// The numbers at the end of a name: "Lamp_Match_2_5" with prefix "Lamp_Match_" gives [2, 5].
fn numbers(name: &str, prefix: &str) -> Option<Vec<usize>> {
    name.strip_prefix(prefix)?.split('_').map(|n| n.parse().ok()).collect()
}

fn legend(name: &str) -> Option<fn(&Legends) -> bool> {
    Some(match name {
        "Legend_OpponentsMove" => |l: &Legends| l.opponents_move,
        "Legend_ComputersMove" => |l: &Legends| l.computers_move,
        "Legend_OpponentWins" => |l: &Legends| l.opponent_wins,
        "Legend_ComputerWins" => |l: &Legends| l.computer_wins,
        _ => return None,
    })
}

/// What a named part of the model shows, if it is a lamp.
fn shows(name: &str) -> Option<Shows> {
    let pair = |prefix| numbers(name, prefix).filter(|n| n.len() == 2);
    let one = |prefix| numbers(name, prefix).filter(|n| n.len() == 1).map(|n| n[0]);
    if let Some(n) = pair("Lamp_Match_") {
        return Some(Shows::Match(n[0], n[1] as u8));
    }
    if let Some(n) = pair("Lamp_Reg_") {
        return Some(Shows::Register(n[0], n[1] as u8));
    }
    if let Some(n) = pair("Key_").filter(|n| n[1] >= 1) {
        return Some(Shows::Key(n[0], n[1] as u8));
    }
    if let Some(h) = one("Lamp_Changed_") {
        return Some(Shows::Changed(h));
    }
    if let Some(i) = one("Lamp_Instr_") {
        return Some(Shows::Instruction(i as u8));
    }
    if let Some(h) = one("Lamp_Select_") {
        return Some(Shows::Select(h));
    }
    if let Some(b) = one("Lamp_Odd_") {
        return Some(Shows::Odd(b as u8));
    }
    legend(name).map(Shows::Legend)
}

/// Runs once the model is in the world: finds its named parts and makes them work. Each lamp keeps
/// the material the model gave it as its unlit look, and a copy that glows as its lit look.
fn wire_model(
    ready: On<WorldInstanceReady>,
    mut commands: Commands,
    machines: Query<(), With<Nimrod>>,
    children: Query<&Children>,
    named: Query<(&Name, &Transform)>,
    painted: Query<&MeshMaterial3d<StandardMaterial>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut lit_copies: Local<HashMap<(AssetId<StandardMaterial>, [u32; 3]), Handle<StandardMaterial>>>,
) {
    let root = ready.entity;
    if !machines.contains(root) {
        return;
    }
    for entity in children.iter_descendants(root) {
        let Ok((name, at)) = named.get(entity) else { continue };
        let name = name.as_str();
        if let Some(what) = shows(name) {
            let Some(off) = children.iter_descendants(entity).find_map(|e| painted.get(e).ok()).map(|m| m.0.clone()) else {
                continue;
            };
            let glow = glow(what);
            let key = (off.id(), [glow.red, glow.green, glow.blue].map(f32::to_bits));
            let on = lit_copies
                .entry(key)
                .or_insert_with(|| {
                    let mut lit = materials.get(&off).cloned().unwrap_or_default();
                    lit.emissive = glow;
                    materials.add(lit)
                })
                .clone();
            commands.entity(entity).insert(Lamp { machine: root, shows: what, on, off, lit: None });
        }
        if let Some(n) = numbers(name, "Key_").filter(|n| n.len() == 2 && n[0] < HEAPS && n[1] < 8) {
            commands.entity(entity).insert(Key { machine: root, heap: n[0], leave: n[1] as u8, press: 0.0, rest: at.translation });
        }
        let plunger = |which| Plunger { machine: root, which, press: 0.0, rest: at.translation };
        match name {
            "Button_CompMove" => drop(commands.entity(entity).insert(plunger(Which::CompMove))),
            "Button_NewGame" => drop(commands.entity(entity).insert(plunger(Which::NewGame))),
            "Lever_Game" => {
                commands.entity(entity).insert(Lever { machine: root, angle: LEVER_THROW, speed: 0.0, rest: at.rotation });
            }
            _ => {}
        }
    }
}

// ---------------------------------------------------------------- play

/// Nobody at the machine: it plays itself. Somebody steps up: it stops and deals for them. Walking
/// away ends a run of wins.
fn attend(focus: Res<Focus>, mut machines: Query<(Entity, &mut Nimrod)>) {
    for (machine, mut nimrod) in &mut machines {
        let here = focus.0 == Some(machine);
        if here == nimrod.game.play_self() {
            nimrod.game.set_play_self(!here);
            nimrod.armed = None;
        }
    }
}

/// The keyboard and touch work the machine while the player stands at it.
fn play(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    pad: Res<Pad>,
    focus: Res<Focus>,
    mut machines: Query<&mut Nimrod>,
    mut caps: Query<&mut Key>,
    mut plungers: Query<&mut Plunger>,
    mut levers: Query<&mut Lever>,
) {
    let Some(machine) = focus.0 else { return };
    let Ok(mut nimrod) = machines.get_mut(machine) else { return };
    let mut pressed: Vec<(usize, u8)> = Vec::new();
    let (mut comp, mut lever, mut new) = (false, false, false);
    for &tap in &pad.taps {
        match tap as usize {
            i if i < TOUCH_COMP => pressed.push((i / 8, (i % 8) as u8)),
            TOUCH_COMP => comp = true,
            TOUCH_LEVER => lever = true,
            TOUCH_NEW => new = true,
            _ => {}
        }
    }
    // The keyboard: 1 to 4 chooses a heap, then 0 to 7 is the button under that lamp.
    if let Some((_, left)) = &mut nimrod.armed {
        *left -= time.delta_secs();
        if *left <= 0.0 {
            nimrod.armed = None;
        }
    }
    let digit = (0..8).find(|&d| keys.just_pressed(DIGITS[d]) || keys.just_pressed(NUMPAD[d]));
    match (nimrod.armed, digit) {
        (Some((heap, _)), Some(d)) => {
            pressed.push((heap, d as u8));
            nimrod.armed = None;
        }
        (None, Some(d)) if (1..=HEAPS).contains(&d) => nimrod.armed = Some((d - 1, ARM_TIME)),
        _ => {}
    }
    if keys.just_pressed(KeyCode::Backspace) {
        nimrod.armed = None;
    }
    comp |= keys.just_pressed(KeyCode::Space) || keys.just_pressed(KeyCode::Enter);
    lever |= keys.just_pressed(KeyCode::KeyG);
    new |= keys.just_pressed(KeyCode::KeyR) || keys.just_pressed(KeyCode::KeyN) || pad.tapped(pad::RESTART);

    for (heap, leave) in pressed {
        // The game says by its events whether the press took, and the sounds follow from those.
        nimrod.game.press(heap, leave);
        for mut cap in caps.iter_mut().filter(|c| c.machine == machine && c.heap == heap && c.leave == leave) {
            cap.press = 1.0;
        }
    }
    if comp {
        nimrod.game.computer_move();
    }
    if new {
        nimrod.game.deal();
        nimrod.armed = None;
    }
    for mut plunger in plungers.iter_mut().filter(|p| p.machine == machine) {
        if (plunger.which == Which::CompMove && comp) || (plunger.which == Which::NewGame && new) {
            plunger.press = 1.0;
        }
    }
    if lever {
        let reverse = nimrod.game.reverse();
        let moved = nimrod.game.set_reverse(!reverse);
        // A switch that will not go over still gives a little under the hand.
        if !moved {
            for mut l in levers.iter_mut().filter(|l| l.machine == machine) {
                l.speed += if reverse { 2.5 } else { -2.5 };
            }
        }
    }
}

/// Every machine keeps running, so one left in the middle of its move still makes it.
fn tick_games(time: Res<Time>, mut machines: Query<&mut Nimrod>) {
    for mut nimrod in &mut machines {
        nimrod.game.step(time.delta_secs());
    }
}

/// The sound for each of the game's events. NIMROD.md says how each should sound.
const SOUNDS: [(u32, &str); 9] = [
    (nimrod::EV_PRESS, "nimrod-press"),
    (nimrod::EV_REFUSED, "nimrod-refused"),
    (nimrod::EV_STEP, "nimrod-step"),
    (nimrod::EV_MOVE, "nimrod-move"),
    (nimrod::EV_WIN, "nimrod-win"),
    (nimrod::EV_LOSE, "nimrod-lose"),
    (nimrod::EV_DEAL, "nimrod-deal"),
    (nimrod::EV_SWITCH, "nimrod-switch"),
    (nimrod::EV_COMP, "nimrod-comp"),
];

/// Passes on scores and sounds. The machine playing itself is heard only by whoever stands at it.
fn report(focus: Res<Focus>, mut machines: Query<(Entity, &mut Nimrod)>) {
    for (machine, mut nimrod) in &mut machines {
        if let Some(score) = nimrod.game.take_ended() {
            pad::score(pad::GAME_NIMROD, score);
        }
        let events = std::mem::take(&mut nimrod.game.events);
        if focus.0 == Some(machine) {
            for (bit, name) in SOUNDS {
                if events & bit != 0 {
                    pad::play(name);
                }
            }
        }
    }
}

fn is_lit(nimrod: &Nimrod, shows: Shows, clock: f32) -> bool {
    let game = &nimrod.game;
    match shows {
        Shows::Match(heap, n) => game.lamp(heap, n),
        Shows::Key(heap, n) => game.lamp(heap, n),
        // A keyboard player's chosen row shows by its white lamp flashing quickly.
        Shows::Changed(heap) if nimrod.armed.is_some_and(|(h, _)| h == heap) => (clock * 6.0).fract() < 0.5,
        Shows::Changed(heap) => game.changed_lamp(heap),
        Shows::Instruction(i) => game.instruction() == Some(i),
        Shows::Register(heap, bit) => game.register(heap) & bit != 0,
        Shows::Select(heap) => game.selected() == Some(heap),
        Shows::Odd(bit) => game.parity() & bit != 0,
        Shows::Legend(which) => which(&game.legends()),
    }
}

/// Sets every lamp from the game. A lamp is repainted only when it changes.
fn light_lamps(
    time: Res<Time>,
    machines: Query<&Nimrod>,
    mut lamps: Query<(Entity, &mut Lamp)>,
    children: Query<&Children>,
    mut painted: Query<&mut MeshMaterial3d<StandardMaterial>>,
    mut lights: Query<(&PanelLight, &mut PointLight)>,
) {
    let clock = time.elapsed_secs();
    let mut count: HashMap<Entity, u32> = HashMap::new();
    for (entity, mut lamp) in &mut lamps {
        let Ok(nimrod) = machines.get(lamp.machine) else { continue };
        let lit = is_lit(nimrod, lamp.shows, clock);
        *count.entry(lamp.machine).or_default() += lit as u32;
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
        point.intensity = 300.0 + 18.0 * count.get(&light.0).copied().unwrap_or(0) as f32;
    }
}

fn animate_controls(
    time: Res<Time>,
    machines: Query<&Nimrod>,
    mut caps: Query<(&mut Key, &mut Transform), (Without<Plunger>, Without<Lever>)>,
    mut plungers: Query<(&mut Plunger, &mut Transform), Without<Lever>>,
    mut levers: Query<(&mut Lever, &mut Transform)>,
) {
    let dt = time.delta_secs().min(0.05);
    for (mut cap, mut tf) in &mut caps {
        // Down at once, back up on its spring.
        cap.press = (cap.press - dt * 6.0).max(0.0);
        tf.translation = cap.rest - Vec3::Y * KEY_TRAVEL * cap.press;
    }
    for (mut plunger, mut tf) in &mut plungers {
        plunger.press = (plunger.press - dt * 3.5).max(0.0);
        tf.translation = plunger.rest - Vec3::Y * PLUNGER_TRAVEL * plunger.press;
    }
    for (mut lever, mut tf) in &mut levers {
        let Ok(nimrod) = machines.get(lever.machine) else { continue };
        let want = if nimrod.game.reverse() { -LEVER_THROW } else { LEVER_THROW };
        // A stiff spring into the notch, stepped in slices of a few milliseconds: stepped once per
        // slow frame, a spring this stiff gains energy and shakes itself apart.
        let mut left = dt;
        while left > 0.0 {
            let h = left.min(0.004);
            left -= h;
            let pull = (want - lever.angle) * 1100.0 - lever.speed * 30.0;
            lever.speed += pull * h;
            lever.angle += lever.speed * h;
        }
        if !lever.angle.is_finite() || !lever.speed.is_finite() {
            lever.angle = want;
            lever.speed = 0.0;
        }
        tf.rotation = lever.rest * Quat::from_rotation_z(lever.angle);
    }
}

// ---------------------------------------------------------------- the page

/// Where the focused machine's controls are on screen, in the window's logical pixels, as (x, y)
/// pairs in the order of the `TOUCH_` constants. A part out of view is at -1000.
fn touch_points(
    machine: Entity,
    camera: &Camera,
    view: &GlobalTransform,
    caps: &Query<(&Key, &GlobalTransform)>,
    plungers: &Query<(&Plunger, &GlobalTransform)>,
    levers: &Query<(&Lever, &GlobalTransform)>,
) -> [f32; TOUCH_POINTS * 2] {
    let mut points = [-1000.0; TOUCH_POINTS * 2];
    let mut put = |slot: usize, at: Vec3| {
        if let Ok(p) = camera.world_to_viewport(view, at) {
            points[slot * 2] = p.x;
            points[slot * 2 + 1] = p.y;
        }
    };
    for (cap, at) in caps.iter().filter(|(c, _)| c.machine == machine) {
        // The top of the cap, which is what a finger aims at.
        put(cap.heap * 8 + cap.leave as usize, at.transform_point(Vec3::Y * 0.026));
    }
    for (plunger, at) in plungers.iter().filter(|(p, _)| p.machine == machine) {
        let slot = if plunger.which == Which::CompMove { TOUCH_COMP } else { TOUCH_NEW };
        put(slot, at.transform_point(Vec3::Y * 0.05));
    }
    for (_, at) in levers.iter().filter(|(l, _)| l.machine == machine) {
        put(TOUCH_LEVER, at.transform_point(Vec3::Y * 0.08));
    }
    points
}

/// Tells the page whether Nimrod's game is over, and where its controls are on screen. The page
/// draws the prompts; nothing is written here.
fn publish(
    focus: Res<Focus>,
    pad: Res<Pad>,
    machines: Query<&Nimrod>,
    camera: Single<(&Camera, &GlobalTransform), With<Player>>,
    caps: Query<(&Key, &GlobalTransform)>,
    plungers: Query<(&Plunger, &GlobalTransform)>,
    levers: Query<(&Lever, &GlobalTransform)>,
) {
    let Some((machine, nimrod)) = focus.0.and_then(|e| machines.get(e).ok().map(|n| (e, n))) else {
        // Another machine's state is its own to publish.
        if focus.0.is_none() {
            pad::publish_more_state(0);
        }
        return;
    };
    pad::publish_more_state(if nimrod.game.over().is_some() { pad::STATE_OVER } else { 0 });
    if pad.active {
        let (camera, view) = *camera;
        pad::publish_points(&touch_points(machine, camera, view, &caps, &plungers, &levers));
    }
}
