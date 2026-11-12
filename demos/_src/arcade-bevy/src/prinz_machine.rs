//! Prinz's chess program in the room: an operator's desk with a chessboard set into it.
//!
//! The game is src/prinz.rs, which also lists the sources on the 1951 program. The model is made by
//! blender/prinz.py. This file lays the pieces out from the game, slides them when they move, lights
//! the square lamps and the result lamps, paints the monitor tube, and works the next-problem button.

use bevy::{
    asset::RenderAssetUsages,
    gltf::GltfAssetLabel,
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat},
    world_serialization::WorldInstanceReady,
};

use crate::{
    pad::{self, Pad},
    prinz::{self, Phase, Piece, PrinzGame},
    player::{Focus, Machine, Player},
};

/// Against the left wall, facing into the room along +X.
const PRINZ_AT: Vec3 = Vec3::new(-3.4, 0.0, 4.6);
const PRINZ_YAW: f32 = std::f32::consts::FRAC_PI_2;

/// The seat, in the machine's own space. From here the board, the lamp rail and the monitor are in
/// view at the 68 degree field of view. blender/prinz.py uses the same numbers for its checks.
/// The pieces are drawn larger than the model's templates, so a phone can tell them apart.
const PIECE_SCALE: f32 = 1.3;
const SEAT_EYE: Vec3 = Vec3::new(0.0, 1.58, 0.86);
const SEAT_AIM: Vec3 = Vec3::new(0.0, 1.13, 0.02);
/// On a narrow screen the eye steps back until the board's near edge (z 0.43, 0.56 m wide with its
/// frame) fits. On an upright phone the board is then about nine tenths of the width.
const SEAT_HALF_WIDTH: f32 = 0.25;
const SEAT_FRONT: f32 = 0.43;
const BODY_CENTRE: Vec2 = Vec2::new(0.0, 0.04);
const BODY_HALF: Vec2 = Vec2::new(0.77, 0.45);

/// Squares are this far apart on the board, in its own frame. Rank 1 is toward the player (+Z).
const PITCH: f32 = 0.064;
/// How long a move takes, and how high a piece lifts on the way.
const SLIDE_TIME: f32 = 0.34;
const HOP: f32 = 0.022;
/// How far the next-problem button sinks.
const NEXT_TRAVEL: f32 = 0.018;
/// The monitor's picture, in pixels.
const TUBE_W: usize = 64;
const TUBE_H: usize = 48;

/// Where square `sq` is in the board's frame. a1 = 0 is near left as the player sees it.
fn square_at(sq: usize) -> Vec3 {
    let (f, r) = ((sq % 8) as f32, (sq / 8) as f32);
    Vec3::new((f - 3.5) * PITCH, 0.0, (3.5 - r) * PITCH)
}

/// The machine, on the root of the model.
#[derive(Component)]
pub struct Prinz {
    pub game: PrinzGame,
    /// The keyboard's square, and whether its lamp shows. It hides once a finger is used.
    cursor: usize,
    keyboard: bool,
    /// Seconds since switch-on, for blinking and the running lamps.
    clock: f32,
    /// The squares the picked-up piece may go to, worked out once a frame for the 64 lamps.
    dest: u64,
}

/// What the model gave, found when it loaded.
#[derive(Component)]
struct Kit {
    board: Option<Entity>,
    /// The tray's floor in the board's frame.
    tray: Vec3,
    /// Mesh and material of each piece, by colour (0 White, 1 Black) and kind (pawn to king).
    pieces: [[Option<(Handle<Mesh>, Handle<StandardMaterial>)>; 6]; 2],
    /// The pieces on the board, by square, and how many are in the tray.
    at: [Option<Entity>; 64],
    taken: usize,
    /// The game's board version the pieces were last laid out for.
    laid: Option<u32>,
}

impl Default for Kit {
    fn default() -> Self {
        Kit { board: None, tray: Vec3::ZERO, pieces: Default::default(), at: [None; 64], taken: 0, laid: None }
    }
}

/// A copy of a piece on the board or in the tray.
#[derive(Component)]
struct PieceOf(Entity);

/// A piece on its way somewhere, in the board's frame.
#[derive(Component)]
struct Slide {
    from: Vec3,
    to: Vec3,
    t: f32,
    time: f32,
    hop: f32,
    /// What the piece becomes when it lands, if a pawn was promoted.
    becomes: Option<(Handle<Mesh>, Handle<StandardMaterial>)>,
}

#[derive(Clone, Copy, PartialEq)]
enum Shows {
    Square(usize),
    White,
    Think,
    Mate,
    Refuted,
    Problem(usize),
    Run(usize),
}

/// Anything the game lights. `off` is the material the model gave it.
#[derive(Component)]
struct Lamp {
    machine: Entity,
    shows: Shows,
    off: Handle<StandardMaterial>,
    /// What was last drawn, so a lamp is only repainted when it changes.
    drawn: Option<u8>,
}

#[derive(Component)]
struct NextButton {
    machine: Entity,
    press: f32,
    rest: Vec3,
}

#[derive(Component)]
struct Tube {
    image: Handle<Image>,
    /// The last picture's key, so it is only repainted when it would change.
    drawn: u64,
}

/// The lit looks, made once.
#[derive(Resource)]
struct Look {
    /// A square's ring: a legal move, the piece picked up, the keyboard's square.
    legal: Handle<StandardMaterial>,
    selected: Handle<StandardMaterial>,
    cursor: Handle<StandardMaterial>,
    white: Handle<StandardMaterial>,
    think: Handle<StandardMaterial>,
    mate: Handle<StandardMaterial>,
    refuted: Handle<StandardMaterial>,
    neon: Handle<StandardMaterial>,
    tube: Handle<StandardMaterial>,
    tube_image: Handle<Image>,
}

pub struct PrinzPlugin;
impl Plugin for PrinzPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, (make_look, spawn_prinz).chain()).add_systems(
            Update,
            (play, tick, lay_pieces, slide_pieces, light_lamps, paint_tube, animate_button, publish).chain(),
        );
    }
}

fn make_look(mut commands: Commands, mut materials: ResMut<Assets<StandardMaterial>>, mut images: ResMut<Assets<Image>>) {
    let mut lit = |tint: Color, glow: LinearRgba| {
        materials.add(StandardMaterial { base_color: tint, emissive: glow, perceptual_roughness: 0.2, ..default() })
    };
    let legal = lit(Color::BLACK, LinearRgba::rgb(7.0, 3.0, 0.65));
    let selected = lit(Color::BLACK, LinearRgba::rgb(12.0, 10.0, 7.2));
    let cursor = lit(Color::BLACK, LinearRgba::rgb(2.2, 5.2, 6.8));
    let white = lit(Color::srgb(0.9, 0.86, 0.78), LinearRgba::rgb(4.0, 3.4, 2.4));
    let think = lit(Color::srgb(0.6, 0.32, 0.08), LinearRgba::rgb(4.0, 1.7, 0.3));
    let mate = lit(Color::srgb(0.2, 0.5, 0.25), LinearRgba::rgb(0.9, 4.2, 1.2));
    let refuted = lit(Color::srgb(0.5, 0.06, 0.04), LinearRgba::rgb(4.5, 0.35, 0.15));
    let neon = lit(Color::srgb(0.8, 0.4, 0.14), LinearRgba::rgb(4.0, 1.3, 0.25));
    let tube_image = images.add(Image::new_fill(
        Extent3d { width: TUBE_W as u32, height: TUBE_H as u32, depth_or_array_layers: 1 },
        TextureDimension::D2,
        &[0, 0, 0, 255],
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::MAIN_WORLD | RenderAssetUsages::RENDER_WORLD,
    ));
    let tube = materials.add(StandardMaterial {
        base_color: Color::BLACK,
        emissive: LinearRgba::rgb(3.0, 3.0, 3.0),
        emissive_texture: Some(tube_image.clone()),
        perceptual_roughness: 0.06,
        reflectance: 0.3,
        ..default()
    });
    commands.insert_resource(Look { legal, selected, cursor, white, think, mate, refuted, neon, tube, tube_image });
}

fn spawn_prinz(mut commands: Commands, assets: Res<AssetServer>, look: Res<Look>) {
    commands
        .spawn((
            Prinz { game: PrinzGame::new(0x1951), cursor: 12, keyboard: false, clock: 0.0, dest: 0 },
            Kit::default(),
            Tube { image: look.tube_image.clone(), drawn: u64::MAX },
            Machine {
                id: pad::GAME_PRINZ,
                seat_eye: SEAT_EYE,
                seat_aim: SEAT_AIM,
                seat_half_width: SEAT_HALF_WIDTH,
                seat_front: SEAT_FRONT,
                body_centre: BODY_CENTRE,
                body_half: BODY_HALF,
            },
            Transform::from_translation(PRINZ_AT).with_rotation(Quat::from_rotation_y(PRINZ_YAW)),
            WorldAssetRoot(assets.load(GltfAssetLabel::Scene(0).from_asset("prinz.glb"))),
        ))
        .observe(wire_model);
    // The desk's light is not baked yet, and the room has no ambient light, so one soft lamp from
    // above and behind the player's shoulder stands in for the room's light on it, as on Bertie.
    let to_world = |p: Vec3| PRINZ_AT + Quat::from_rotation_y(PRINZ_YAW) * p;
    commands.spawn((
        SpotLight {
            color: Color::srgb(1.0, 0.90, 0.80),
            intensity: 380_000.0,
            range: 7.0,
            radius: 0.6,
            inner_angle: 0.30,
            outer_angle: 0.80,
            affects_lightmapped_mesh_diffuse: false,
            ..default()
        },
        Transform::from_translation(to_world(Vec3::new(0.7, 2.9, 2.0))).looking_at(to_world(Vec3::new(0.0, 1.05, 0.10)), Vec3::Y),
    ));
}

/// Runs once the model is in the world: finds its named parts and makes them work.
fn wire_model(
    ready: On<WorldInstanceReady>,
    mut commands: Commands,
    look: Res<Look>,
    mut kits: Query<&mut Kit>,
    children: Query<&Children>,
    named: Query<(&Name, &Transform)>,
    meshes: Query<(&Mesh3d, &MeshMaterial3d<StandardMaterial>)>,
) {
    let root = ready.entity;
    let Ok(mut kit) = kits.get_mut(root) else { return };
    // The first mesh drawn for a named node, with the material the model gave it.
    let drawn = |entity: Entity| -> Option<(Handle<Mesh>, Handle<StandardMaterial>)> {
        children.iter_descendants(entity).find_map(|e| meshes.get(e).ok().map(|(m, s)| (m.0.clone(), s.0.clone())))
    };
    let mut board_at = Vec3::ZERO;
    let mut tray_at = Vec3::ZERO;
    for entity in children.iter_descendants(root) {
        let Ok((name, at)) = named.get(entity) else { continue };
        let name = name.as_str();
        let numbered = |prefix: &str| name.strip_prefix(prefix).and_then(|n| n.parse::<usize>().ok());
        let shows = if let Some(sq) = numbered("Lamp_Sq_").filter(|&n| n < 64) {
            Some(Shows::Square(sq))
        } else if let Some(i) = numbered("Lamp_Problem_") {
            Some(Shows::Problem(i))
        } else if let Some(i) = numbered("Lamp_Run_") {
            Some(Shows::Run(i))
        } else {
            match name {
                "Lamp_White" => Some(Shows::White),
                "Lamp_Think" => Some(Shows::Think),
                "Lamp_Mate" => Some(Shows::Mate),
                "Lamp_Refuted" => Some(Shows::Refuted),
                _ => None,
            }
        };
        if let Some(shows) = shows {
            if let Some((_, off)) = drawn(entity) {
                commands.entity(entity).insert(Lamp { machine: root, shows, off, drawn: None });
            }
            continue;
        }
        if let Some(rest) = name.strip_prefix("Piece_") {
            // "W_K", "B_P" and so on. The template is hidden; the game lays out copies.
            let mut it = rest.split('_');
            let colour = match it.next() { Some("W") => Some(0), Some("B") => Some(1), _ => None };
            let kind = it.next().and_then(|k| "PNBRQK".find(k));
            if let (Some(c), Some(k), Some(parts)) = (colour, kind, drawn(entity)) {
                kit.pieces[c][k] = Some(parts);
            }
            commands.entity(entity).insert(Visibility::Hidden);
            continue;
        }
        match name {
            "Prinz_Board" => {
                kit.board = Some(entity);
                board_at = at.translation;
            }
            "Prinz_Tray" => tray_at = at.translation,
            "Button_Next" => drop(commands.entity(entity).insert(NextButton { machine: root, press: 0.0, rest: at.translation })),
            "Monitor_Tube" => {
                for mesh in children.iter_descendants(entity) {
                    if meshes.contains(mesh) {
                        commands.entity(mesh).insert(MeshMaterial3d(look.tube.clone()));
                    }
                }
            }
            _ => {}
        }
    }
    // The board and the tray hang off the same tilted desk, so one is the other moved along it.
    kit.tray = tray_at - board_at;
    kit.laid = None;
}

/// The parts of a piece, from the game's piece code.
fn parts(kit: &Kit, piece: Piece) -> Option<(Handle<Mesh>, Handle<StandardMaterial>)> {
    let kind = prinz::kind(piece) as usize;
    if kind == 0 || kind > 6 {
        return None;
    }
    kit.pieces[prinz::is_black(piece) as usize][kind - 1].clone()
}

/// Where the `n`th taken piece stands, in the board's frame: three across the tray, rows down it.
fn tray_slot(kit: &Kit, n: usize) -> Vec3 {
    let (col, row) = ((n % 3) as f32, (n / 3 % 6) as f32);
    kit.tray + Vec3::new((col - 1.0) * 0.072, 0.0, -0.18 + row * 0.072)
}

// ---------------------------------------------------------------- play

/// Arrow keys move the keyboard's square (up is toward Black), Enter or Space presses it, N or R
/// presses the next-problem button. A finger presses squares and the button directly.
fn play(keys: Res<ButtonInput<KeyCode>>, pad: Res<Pad>, focus: Res<Focus>, mut machines: Query<&mut Prinz>, mut buttons: Query<&mut NextButton>) {
    let Some(machine) = focus.0 else { return };
    let Ok(mut prinz) = machines.get_mut(machine) else { return };
    let step = [(KeyCode::ArrowUp, 8i32), (KeyCode::ArrowDown, -8), (KeyCode::ArrowRight, 1), (KeyCode::ArrowLeft, -1)];
    for (key, d) in step {
        if keys.just_pressed(key) {
            let c = prinz.cursor as i32;
            let (f, r) = (c % 8 + d.signum() * (d.abs() == 1) as i32, c / 8 + d.signum() * (d.abs() == 8) as i32);
            if (0..8).contains(&f) && (0..8).contains(&r) {
                prinz.cursor = (r * 8 + f) as usize;
                pad::play("prinz-cursor");
            }
            prinz.keyboard = true;
        }
    }
    if keys.just_pressed(KeyCode::Enter) || keys.just_pressed(KeyCode::NumpadEnter) || keys.just_pressed(KeyCode::Space) {
        prinz.keyboard = true;
        let sq = prinz.cursor;
        prinz.game.press(sq);
    }
    for &tap in &pad.taps {
        prinz.keyboard = false;
        if tap < 64 {
            prinz.game.press(tap as usize);
        }
    }
    let next = keys.just_pressed(KeyCode::KeyN)
        || keys.just_pressed(KeyCode::KeyR)
        || pad.taps.contains(&64)
        || pad.tapped(pad::RESTART);
    if next {
        prinz.game.next();
        for mut button in buttons.iter_mut().filter(|b| b.machine == machine) {
            button.press = 1.0;
        }
    }
}

/// Every machine keeps running, so one left thinking still answers.
fn tick(time: Res<Time>, focus: Res<Focus>, mut machines: Query<(Entity, &mut Prinz)>) {
    for (machine, mut prinz) in &mut machines {
        prinz.clock += time.delta_secs();
        prinz.game.step(time.delta_secs());
        prinz.dest = prinz.game.destinations();
        // Walking away ends a run, as a wrong move does.
        if focus.0 != Some(machine) {
            prinz.game.end_run();
        }
        if let Some(score) = prinz.game.take_ended() {
            pad::score(pad::GAME_PRINZ, score);
        }
        let ev = std::mem::take(&mut prinz.game.events);
        // One sound per kind of event, in the order they happen.
        for (bit, name) in [
            (prinz::EV_NEXT, "prinz-next"),
            (prinz::EV_SELECT, "prinz-select"),
            (prinz::EV_REFUSED, "prinz-refused"),
            (prinz::EV_MOVE, "prinz-place"),
            (prinz::EV_CAPTURE, "prinz-capture"),
            (prinz::EV_THINK, "prinz-think"),
            (prinz::EV_REPLY, "prinz-reply"),
            (prinz::EV_MATE, "prinz-mate"),
            (prinz::EV_REFUTED, "prinz-refuted"),
        ] {
            if ev & bit != 0 {
                pad::play(name);
            }
        }
        // A reset that comes with a new problem already has its sound.
        if ev & prinz::EV_RESET != 0 && ev & prinz::EV_NEXT == 0 {
            pad::play("prinz-reset");
        }
    }
}

/// Keeps the pieces on the board in step with the game: a fresh layout when the board is set out
/// again, otherwise a slide for each move made.
fn lay_pieces(mut commands: Commands, mut machines: Query<(Entity, &mut Prinz, &mut Kit)>, copies: Query<(Entity, &PieceOf)>) {
    for (machine, mut prinz, mut kit) in &mut machines {
        let Some(board) = kit.board else { continue };
        let version = prinz.game.version();
        if kit.laid != Some(version) {
            prinz.game.take_moves();
            for (e, of) in &copies {
                if of.0 == machine {
                    commands.entity(e).despawn();
                }
            }
            kit.at = [None; 64];
            kit.taken = 0;
            for sq in 0..64 {
                let Some((mesh, mat)) = parts(&kit, prinz.game.piece(sq)) else { continue };
                let to = square_at(sq);
                // The pieces drop onto the board one after another, from the near rank back.
                let e = commands
                    .spawn((
                        PieceOf(machine),
                        Mesh3d(mesh),
                        MeshMaterial3d(mat),
                        Transform::from_translation(to + Vec3::Y * 0.06).with_scale(Vec3::splat(PIECE_SCALE)),
                        Slide { from: to + Vec3::Y * 0.06, to, t: -(sq as f32) * 0.004, time: 0.22, hop: 0.0, becomes: None },
                        ChildOf(board),
                    ))
                    .id();
                kit.at[sq] = Some(e);
            }
            kit.laid = Some(version);
            continue;
        }
        for m in prinz.game.take_moves() {
            let (from, to) = (m.from as usize, m.to as usize);
            if let Some(victim) = kit.at[to].take() {
                let slot = tray_slot(&kit, kit.taken);
                kit.taken += 1;
                commands.entity(victim).insert(Slide { from: square_at(to), to: slot, t: -0.12, time: 0.5, hop: 0.07, becomes: None });
            }
            if let Some(mover) = kit.at[from].take() {
                let becomes = if m.promo != prinz::EMPTY { parts(&kit, m.promo) } else { None };
                commands.entity(mover).insert(Slide { from: square_at(from), to: square_at(to), t: 0.0, time: SLIDE_TIME, hop: HOP, becomes });
                kit.at[to] = Some(mover);
            }
        }
    }
}

/// Moves each sliding piece along: eased, with a small hop, and set down exactly.
fn slide_pieces(time: Res<Time>, mut commands: Commands, mut pieces: Query<(Entity, &mut Slide, &mut Transform)>) {
    let dt = time.delta_secs().min(0.05);
    for (e, mut slide, mut tf) in &mut pieces {
        slide.t += dt / slide.time;
        let t = slide.t.clamp(0.0, 1.0);
        let k = t * t * (3.0 - 2.0 * t);
        tf.translation = slide.from.lerp(slide.to, k) + Vec3::Y * slide.hop * (std::f32::consts::PI * t).sin();
        if slide.t >= 1.0 {
            tf.translation = slide.to;
            let mut piece = commands.entity(e);
            if let Some((mesh, mat)) = slide.becomes.take() {
                piece.insert((Mesh3d(mesh), MeshMaterial3d(mat)));
            }
            piece.remove::<Slide>();
        }
    }
}

/// What each lamp should show now: 0 is unlit, the rest pick a lit look.
fn lamp_state(prinz: &Prinz, shows: Shows) -> u8 {
    let game = &prinz.game;
    let lamps = game.lamps();
    let blink = |rate: f32| (prinz.clock * rate).fract() < 0.5;
    match shows {
        Shows::Square(sq) => {
            if game.selected() == Some(sq as u8) {
                2
            } else if prinz.keyboard && prinz.cursor == sq && game.visitor_to_move() {
                3
            } else if prinz.dest & (1 << sq) != 0 {
                1
            } else {
                0
            }
        }
        Shows::White => lamps.white as u8,
        Shows::Think => lamps.thinking as u8,
        // The result lamps flash at first, then stay lit.
        Shows::Mate => (lamps.mate && (blink(3.0) || matches!(game.phase(), Phase::Solved(t) if t > 1.5))) as u8,
        Shows::Refuted => (lamps.refuted && blink(3.0)) as u8,
        Shows::Problem(i) => {
            let solved = game.solved() & (1 << i) != 0;
            (solved || (i == game.problem() && blink(0.8))) as u8
        }
        // While it thinks, one lamp runs along the row and others flicker, like the store being searched.
        Shows::Run(i) => {
            if !lamps.thinking {
                return 0;
            }
            let step = (prinz.clock * 14.0) as usize;
            (step % 8 == i || (step.wrapping_mul(2654435761) >> (i * 3)) & 7 == 0) as u8
        }
    }
}

fn light_lamps(
    look: Res<Look>,
    machines: Query<&Prinz>,
    mut lamps: Query<(Entity, &mut Lamp)>,
    children: Query<&Children>,
    mut painted: Query<&mut MeshMaterial3d<StandardMaterial>>,
) {
    for (entity, mut lamp) in &mut lamps {
        let Ok(prinz) = machines.get(lamp.machine) else { continue };
        let state = lamp_state(prinz, lamp.shows);
        if lamp.drawn == Some(state) {
            continue;
        }
        lamp.drawn = Some(state);
        let material = match (state, lamp.shows) {
            (0, _) => &lamp.off,
            (1, Shows::Square(_)) => &look.legal,
            (2, _) => &look.selected,
            (3, _) => &look.cursor,
            (_, Shows::White) => &look.white,
            (_, Shows::Think) => &look.think,
            (_, Shows::Mate) => &look.mate,
            (_, Shows::Refuted) => &look.refuted,
            _ => &look.neon,
        };
        for mesh in children.iter_descendants(entity) {
            if let Ok(mut paint) = painted.get_mut(mesh) {
                paint.0 = material.clone();
            }
        }
    }
}

/// The monitor shows the board as the Mark 1's store tubes showed bits: a dot for an empty square and
/// a dash for a piece, eight rows of eight. While the machine thinks the rows churn.
fn paint_tube(mut images: ResMut<Assets<Image>>, mut machines: Query<(&Prinz, &mut Tube)>) {
    for (prinz, mut tube) in &mut machines {
        let game = &prinz.game;
        let thinking = game.lamps().thinking;
        let frame = if thinking { (prinz.clock * 12.0) as u64 } else { 0 };
        let occupied = (0..64).fold(0u64, |bits, sq| bits | ((game.piece(sq) != prinz::EMPTY) as u64) << sq);
        let key = occupied ^ frame.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ (game.lamps().mate as u64) << 63;
        if key == tube.drawn {
            continue;
        }
        tube.drawn = key;
        let Some(mut image) = images.get_mut(&tube.image) else { continue };
        let Some(data) = image.data.as_mut() else { continue };
        data.fill(0);
        for px in data.chunks_exact_mut(4) {
            px[3] = 255;
        }
        let bright = if game.lamps().mate { 255 } else { 190 };
        for row in 0..8 {
            // Rank 8 at the top, as the board is seen.
            let rank = 7 - row;
            let mut bits = (occupied >> (rank * 8)) as u8;
            if thinking {
                bits ^= (frame.wrapping_add(row as u64).wrapping_mul(0x2545_F491_4F6C_DD1D) >> 40) as u8;
            }
            let y = 5 + row * 5;
            for col in 0..8 {
                let x0 = 5 + col * 7;
                let len = if bits & (1 << col) != 0 { 4 } else { 1 };
                for x in x0..x0 + len {
                    let o = (y * TUBE_W + x) * 4;
                    data[o..o + 3].copy_from_slice(&[bright / 4, bright, bright / 2]);
                }
            }
        }
    }
}

fn animate_button(time: Res<Time>, keys: Res<ButtonInput<KeyCode>>, focus: Res<Focus>, mut buttons: Query<(&mut NextButton, &mut Transform)>) {
    let dt = time.delta_secs().min(0.05);
    for (mut button, mut tf) in &mut buttons {
        let held = focus.0 == Some(button.machine) && (keys.pressed(KeyCode::KeyN) || keys.pressed(KeyCode::KeyR));
        // Down fast, back up slowly on its spring.
        button.press = if held { 1.0 } else { (button.press - dt * 3.5).max(0.0) };
        tf.translation = button.rest - Vec3::Y * NEXT_TRAVEL * button.press;
    }
}

// ---------------------------------------------------------------- the page

/// Tells the page whether a problem has just been solved (its AGAIN button then sets the next one),
/// and where the 64 squares and the next button are on screen, in that order, so fingers can press
/// them. A part out of view is at -1000.
fn publish(
    focus: Res<Focus>,
    pad: Res<Pad>,
    machines: Query<&Prinz>,
    camera: Single<(&Camera, &GlobalTransform), With<Player>>,
    lamps: Query<(&Lamp, &GlobalTransform)>,
    buttons: Query<(&NextButton, &GlobalTransform)>,
) {
    let Some((machine, prinz)) = focus.0.and_then(|e| machines.get(e).ok().map(|p| (e, p))) else {
        // Another machine may be in use; it publishes its own state.
        if focus.0.is_none() {
            pad::publish_more_state(0);
        }
        return;
    };
    let solved = matches!(prinz.game.phase(), Phase::Solved(_));
    pad::publish_more_state(if solved { pad::STATE_OVER } else { 0 });
    // The squares need no words; the button does.
    let mut labels = [""; 65];
    labels[64] = "NEXT";
    pad::publish_labels(&labels);
    pad::publish_hint("Arrows|move;Enter|pick a piece, then a square;N|next problem;E|leave");
    if !pad.active {
        return;
    }
    let (camera, view) = *camera;
    let mut points = [-1000.0f32; 65 * 2];
    let mut put = |slot: usize, at: &GlobalTransform| {
        if let Ok(p) = camera.world_to_viewport(view, at.translation()) {
            points[slot * 2] = p.x;
            points[slot * 2 + 1] = p.y;
        }
    };
    for (lamp, at) in &lamps {
        if let (true, Shows::Square(sq)) = (lamp.machine == machine, lamp.shows) {
            put(sq, at);
        }
    }
    for (button, at) in &buttons {
        if button.machine == machine {
            put(64, at);
        }
    }
    pad::publish_points(&points);
}
