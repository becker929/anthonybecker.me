//! The Whirlwind display console in the room: its tube, knobs, plunger and lamps.
//!
//! The game itself is src/whirlwind.rs, which also lists the sources on the real program and keeps
//! the score rule. The model is made by blender/whirlwind.py. This file gives the model's named parts
//! their behaviour, the way src/bertie_machine.rs does for Bertie. WHIRLWIND.md has the whole story.

use std::f32::consts::FRAC_PI_2;

use bevy::{
    asset::RenderAssetUsages,
    gltf::GltfAssetLabel,
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat},
    world_serialization::WorldInstanceReady,
};

use crate::{
    pad::{self, Pad},
    player::{Focus, Machine, Player},
    whirlwind::{self, Phase, Whirlwind},
};

/// Against the left wall, facing into the room along +X.
const AT: Vec3 = Vec3::new(-3.4, 0.0, 2.4);
const YAW: f32 = FRAC_PI_2;

/// Where the player's eye goes when playing, and what it looks at, in the machine's own space. From
/// here the lamps above the tube and the knobs on the desk are both in view (blender/whirlwind.py
/// prints each part's place in this view).
const SEAT_EYE: Vec3 = Vec3::new(0.0, 1.55, 1.15);
const SEAT_AIM: Vec3 = Vec3::new(0.0, 1.42, 0.15);
/// The desk's front edge, and half the width that must stay in view: the knobs' touch targets.
const SEAT_FRONT: f32 = 0.47;
const SEAT_HALF_WIDTH: f32 = 0.40;
const BODY_CENTRE: Vec2 = Vec2::new(0.0, 0.036);
const BODY_HALF: Vec2 = Vec2::new(0.71, 0.44);

/// One notch of a knob, in radians. blender/whirlwind.py draws the dial's nine ticks at this step.
const NOTCH_STEP: f32 = 0.30;
/// How far the plunger sinks, in metres.
const PLUNGER_TRAVEL: f32 = 0.022;
/// How far either side of a knob its less and more touch targets sit, in metres along the desk.
const TOUCH_SIDE: f32 = 0.115;
/// The idle machine shows off a ball this often while nobody plays.
const DEMO_EVERY: f32 = 3.5;
/// How bright the tube's picture is. A dot of 1.0 in the texture blooms a little.
const TUBE_GLOW: f32 = 9.0;
/// The tube's green light on the desk and the player.
const TUBE_LIGHT: f32 = 260.0;
/// Lit lamps: their glass glows this much in their own colour.
const LAMP_GLOW: f32 = 7.0;

/// The machine. It sits on the root of the model, with the game it is playing.
#[derive(Component)]
pub struct WhirlwindConsole {
    pub game: Whirlwind,
    screen: Handle<Image>,
    tube: Handle<StandardMaterial>,
    /// Seconds the machine has stood idle, for its demonstration.
    idle: f32,
}

#[derive(Clone, Copy, PartialEq)]
enum Shows {
    /// A bit of the score register.
    Score(u32),
    /// One of the balls left in the run.
    Ball(u32),
    /// One of the four lamps that step along with the bounces.
    Bounce(u32),
}

#[derive(Component)]
struct Lamp {
    machine: Entity,
    shows: Shows,
    on: Handle<StandardMaterial>,
    off: Handle<StandardMaterial>,
    lit: Option<bool>,
}

#[derive(Component)]
struct Knob {
    machine: Entity,
    speed_knob: bool,
    turn: f32,
    spin: f32,
}

#[derive(Component)]
struct Plunger {
    machine: Entity,
    press: f32,
    rest: Vec3,
}

#[derive(Component)]
struct TubeLight(Entity);

pub struct WhirlwindPlugin;
impl Plugin for WhirlwindPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, spawn)
            .add_systems(Update, (play, tick, report, light_lamps, animate_controls, publish).chain());
    }
}

// ---------------------------------------------------------------- the model

fn spawn(mut commands: Commands, assets: Res<AssetServer>, mut images: ResMut<Assets<Image>>, mut materials: ResMut<Assets<StandardMaterial>>) {
    let n = whirlwind::N as u32;
    let screen = images.add(Image::new_fill(
        Extent3d { width: n, height: n, depth_or_array_layers: 1 },
        TextureDimension::D2,
        &[0, 0, 0, 255],
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::MAIN_WORLD | RenderAssetUsages::RENDER_WORLD,
    ));
    let tube = materials.add(StandardMaterial {
        base_color: Color::BLACK,
        emissive: LinearRgba::rgb(TUBE_GLOW, TUBE_GLOW, TUBE_GLOW),
        emissive_texture: Some(screen.clone()),
        // Polished glass: it mirrors the room picture softly, as the first cabinet's tube does.
        perceptual_roughness: 0.05,
        reflectance: 0.3,
        ..default()
    });
    let root = commands
        .spawn((
            WhirlwindConsole { game: Whirlwind::new(0x1951), screen, tube, idle: 0.0 },
            Machine {
                id: pad::GAME_WHIRLWIND,
                seat_eye: SEAT_EYE,
                seat_aim: SEAT_AIM,
                seat_half_width: SEAT_HALF_WIDTH,
                seat_front: SEAT_FRONT,
                body_centre: BODY_CENTRE,
                body_half: BODY_HALF,
            },
            Transform::from_translation(AT).with_rotation(Quat::from_rotation_y(YAW)),
            WorldAssetRoot(assets.load(GltfAssetLabel::Scene(0).from_asset("whirlwind.glb"))),
        ))
        .observe(wire_model)
        .id();
    // The tube's own light, just behind the glass so the glass shows no hot spot from it.
    commands.spawn((
        TubeLight(root),
        PointLight { color: Color::srgb(0.55, 1.0, 0.45), intensity: TUBE_LIGHT, range: 1.6, radius: 0.15, ..default() },
        Transform::from_xyz(0.0, 1.42, 0.10),
        ChildOf(root),
    ));
    // The console's light is not baked yet, and the room has no ambient light, so one soft lamp from
    // above and in front stands in for the room's light on it, as Bertie's does.
    let place = Transform::from_translation(AT).with_rotation(Quat::from_rotation_y(YAW));
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
        Transform::from_translation(place.transform_point(Vec3::new(0.8, 3.0, 2.4)))
            .looking_at(place.transform_point(Vec3::new(0.0, 1.4, 0.2)), Vec3::Y),
    ));
}

/// Runs once the model is in the world: finds its named parts and makes them work.
fn wire_model(
    ready: On<WorldInstanceReady>,
    mut commands: Commands,
    mut materials: ResMut<Assets<StandardMaterial>>,
    machines: Query<&WhirlwindConsole>,
    children: Query<&Children>,
    named: Query<(&Name, &Transform)>,
    painted: Query<&MeshMaterial3d<StandardMaterial>>,
) {
    let root = ready.entity;
    let Ok(console) = machines.get(root) else { return };
    // Lit copies of each lamp colour, made once from the first lamp of that colour.
    let mut lit: Vec<(AssetId<StandardMaterial>, Handle<StandardMaterial>)> = Vec::new();
    for entity in children.iter_descendants(root) {
        let Ok((name, at)) = named.get(entity) else { continue };
        let name = name.as_str();
        let number = |prefix: &str| name.strip_prefix(prefix).and_then(|n| n.parse::<u32>().ok());
        let shows = if let Some(bit) = number("Lamp_Score_") {
            Some((Shows::Score(bit), LinearRgba::rgb(1.0, 0.62, 0.22)))
        } else if let Some(i) = number("Lamp_Ball_") {
            Some((Shows::Ball(i), LinearRgba::rgb(1.0, 0.12, 0.05)))
        } else if let Some(i) = number("Lamp_Bounce_") {
            Some((Shows::Bounce(i), LinearRgba::rgb(0.55, 1.0, 0.30)))
        } else {
            None
        };
        if let Some((shows, glow)) = shows {
            // The model's own material is the unlit look: coloured glass you can just see.
            let Some(off) = children.iter_descendants(entity).find_map(|m| painted.get(m).ok()).map(|m| m.0.clone()) else { continue };
            let on = match lit.iter().find(|(id, _)| *id == off.id()) {
                Some((_, on)) => on.clone(),
                None => {
                    let Some(mut made) = materials.get(&off).cloned() else { continue };
                    // The lens picture still shapes the light, so lit glass keeps its facets.
                    made.emissive = glow * LAMP_GLOW;
                    made.base_color = Color::BLACK;
                    let on = materials.add(made);
                    lit.push((off.id(), on.clone()));
                    on
                }
            };
            commands.entity(entity).insert(Lamp { machine: root, shows, on, off, lit: None });
            continue;
        }
        match name {
            "Tube_Screen" => {
                for mesh in children.iter_descendants(entity) {
                    commands.entity(mesh).insert(MeshMaterial3d(console.tube.clone()));
                }
            }
            "Knob_Bounce" | "Knob_Speed" => {
                commands.entity(entity).insert(Knob { machine: root, speed_knob: name == "Knob_Speed", turn: 0.0, spin: 0.0 });
            }
            "Plunger_Release" => {
                commands.entity(entity).insert(Plunger { machine: root, press: 0.0, rest: at.translation });
            }
            _ => {}
        }
    }
}

// ---------------------------------------------------------------- play

/// The touch points, in the order they are published.
const TOUCH_BOUNCE_LESS: u32 = 0;
const TOUCH_BOUNCE_MORE: u32 = 1;
const TOUCH_SPEED_LESS: u32 = 2;
const TOUCH_SPEED_MORE: u32 = 3;
const TOUCH_PLUNGER: u32 = 4;

/// The keyboard and the touch targets work the machine while the player stands at it.
fn play(
    keys: Res<ButtonInput<KeyCode>>,
    pad: Res<Pad>,
    focus: Res<Focus>,
    mut machines: Query<&mut WhirlwindConsole>,
    mut plungers: Query<&mut Plunger>,
) {
    let Some(machine) = focus.0 else { return };
    let Ok(mut console) = machines.get_mut(machine) else { return };
    let tapped = |i: u32| pad.taps.contains(&i);
    let step = |less: [KeyCode; 2], more: [KeyCode; 2], tap_less: u32, tap_more: u32| {
        (keys.any_just_pressed(more) || tapped(tap_more)) as i32 - (keys.any_just_pressed(less) || tapped(tap_less)) as i32
    };
    // Up and down set the bounce, left and right the speed: a knob and what it moves turn together.
    let bounce = step([KeyCode::KeyS, KeyCode::ArrowDown], [KeyCode::KeyW, KeyCode::ArrowUp], TOUCH_BOUNCE_LESS, TOUCH_BOUNCE_MORE);
    let speed = step([KeyCode::KeyA, KeyCode::ArrowLeft], [KeyCode::KeyD, KeyCode::ArrowRight], TOUCH_SPEED_LESS, TOUCH_SPEED_MORE);
    if bounce != 0 {
        console.game.turn_bounce(bounce);
    }
    if speed != 0 {
        console.game.turn_speed(speed);
    }
    let pushed = keys.just_pressed(KeyCode::Space) || tapped(TOUCH_PLUNGER) || pad.tapped(pad::FIRE);
    if pushed {
        console.game.plunge();
        // A tap has no hold, so the plunger is driven all the way down and comes back on its spring.
        for mut plunger in plungers.iter_mut().filter(|p| p.machine == machine) {
            plunger.press = 1.0;
        }
    }
    // The page's AGAIN button, or R, starts a new run once the last is over.
    if (keys.just_pressed(KeyCode::KeyR) || pad.tapped(pad::RESTART)) && console.game.over() {
        console.game.reset();
    }
}

/// Every console keeps running and painting its tube; an idle one shows off a ball now and then.
fn tick(time: Res<Time>, focus: Res<Focus>, mut images: ResMut<Assets<Image>>, mut machines: Query<(Entity, &mut WhirlwindConsole)>) {
    let dt = time.delta_secs();
    for (entity, mut console) in &mut machines {
        let console = &mut *console;
        if focus.0 != Some(entity) && console.game.phase == Phase::Ready && !console.game.in_run() {
            console.idle += dt;
            if console.idle > DEMO_EVERY {
                console.idle = 0.0;
                console.game.demonstrate();
            }
        } else {
            console.idle = 0.0;
        }
        console.game.step(dt);
        if let Some(mut image) = images.get_mut(&console.screen) {
            if let Some(data) = image.data.as_mut() {
                console.game.render(data);
            }
        }
    }
}

/// Passes on what the game says happened, as named sounds, and hands finished runs to the table.
fn report(focus: Res<Focus>, mut machines: Query<(Entity, &mut WhirlwindConsole)>) {
    const SOUNDS: [(u32, &str); 10] = [
        (whirlwind::EV_RELEASE, "whirlwind-release"),
        (whirlwind::EV_BOUNCE, "whirlwind-bounce"),
        (whirlwind::EV_DROP, "whirlwind-drop"),
        (whirlwind::EV_MISS, "whirlwind-miss"),
        (whirlwind::EV_OVER, "whirlwind-over"),
        (whirlwind::EV_NEW_HOLE, "whirlwind-hole"),
        (whirlwind::EV_REFUSED, "whirlwind-refused"),
        (whirlwind::EV_RESET, "whirlwind-reset"),
        (whirlwind::EV_NOTCH, "whirlwind-notch"),
        (whirlwind::EV_STOP, "whirlwind-stop"),
    ];
    for (entity, mut console) in &mut machines {
        // Walking away ends the run and scores it, as running out of balls does.
        if focus.0 != Some(entity) && console.game.in_run() {
            console.game.end_run();
        }
        if let Some(score) = console.game.take_ended() {
            pad::score(pad::GAME_WHIRLWIND, score);
        }
        let events = std::mem::take(&mut console.game.events);
        for (bit, name) in SOUNDS {
            if events & bit != 0 {
                pad::play(name);
            }
        }
    }
}

/// Sets every lamp from the game. A lamp is repainted only when it changes.
fn light_lamps(
    time: Res<Time>,
    machines: Query<&WhirlwindConsole>,
    mut lamps: Query<(Entity, &mut Lamp)>,
    children: Query<&Children>,
    mut painted: Query<&mut MeshMaterial3d<StandardMaterial>>,
    mut lights: Query<(&TubeLight, &mut PointLight)>,
) {
    let blink = (time.elapsed_secs() * 6.0) as u32 % 2 == 0;
    for (entity, mut lamp) in &mut lamps {
        let Ok(console) = machines.get(lamp.machine) else { continue };
        let game = &console.game;
        let lit = match lamp.shows {
            Shows::Score(bit) => game.score >> bit & 1 == 1,
            Shows::Ball(i) => !game.over() && i < whirlwind::MISSES - game.misses,
            Shows::Bounce(i) => match game.phase {
                // A drop: all four flash together.
                Phase::Result { landing: whirlwind::Landing::Drop, demo: false, .. } => blink,
                // In the air and just after: one lamp steps along at each bounce.
                Phase::Flight { .. } | Phase::Result { .. } => game.bounces > 0 && (game.bounces - 1) % 4 == i,
                _ => false,
            },
        };
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
        let Ok(console) = machines.get(light.0) else { continue };
        let flight = if console.game.ball.is_some() { 1.0 } else { 0.0 };
        point.intensity = TUBE_LIGHT * (1.0 + flight);
    }
}

fn animate_controls(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    focus: Res<Focus>,
    machines: Query<&WhirlwindConsole>,
    mut knobs: Query<(&mut Knob, &mut Transform), Without<Plunger>>,
    mut plungers: Query<(&mut Plunger, &mut Transform)>,
) {
    let dt = time.delta_secs().min(0.05);
    for (mut knob, mut tf) in &mut knobs {
        let Ok(console) = machines.get(knob.machine) else { continue };
        let notch = if knob.speed_knob { console.game.speed } else { console.game.bounce };
        // Seen from the player, a negative turn about Y is clockwise, and clockwise is more. The
        // middle notch points straight up the desk.
        let want = -((notch - whirlwind::NOTCHES / 2) as f32) * NOTCH_STEP;
        // A stiff spring that jumps to the notch and settles, stepped in slices of at most 4 ms: a whole
        // slow frame at once makes a spring this stiff gain energy until it shakes itself away.
        let mut left = dt;
        while left > 0.0 {
            let h = left.min(0.004);
            left -= h;
            let pull = (want - knob.turn) * 1400.0 - knob.spin * 34.0;
            knob.spin += pull * h;
            knob.turn += knob.spin * h;
        }
        if !knob.turn.is_finite() || !knob.spin.is_finite() || (knob.turn - want).abs() > 6.0 {
            knob.turn = want;
            knob.spin = 0.0;
        }
        tf.rotation = Quat::from_rotation_y(knob.turn);
    }
    for (mut plunger, mut tf) in &mut plungers {
        let held = focus.0 == Some(plunger.machine) && keys.pressed(KeyCode::Space);
        // It drops fast under the hand and comes back slowly, like a sprung plunger.
        plunger.press = if held { (plunger.press + dt * 22.0).min(1.0) } else { (plunger.press - dt * 4.0).max(0.0) };
        tf.translation = plunger.rest - Vec3::Y * PLUNGER_TRAVEL * plunger.press;
    }
}

// ---------------------------------------------------------------- the page

/// Where the focused console's controls are on screen, in the window's logical pixels, as (x, y)
/// pairs: BOUNCE less and more, SPEED less and more, then the plunger. A knob's less target is on its
/// left and its more target on its right, so a tap steps it one notch the way a turn would. A point
/// out of view is at -1000.
fn touch_points(
    machine: Entity,
    root: &GlobalTransform,
    camera: &Camera,
    view: &GlobalTransform,
    knobs: &Query<(&Knob, &GlobalTransform)>,
    plungers: &Query<(&Plunger, &GlobalTransform)>,
) -> [f32; 10] {
    let mut points = [-1000.0; 10];
    let mut put = |slot: usize, at: Vec3| {
        if let Ok(p) = camera.world_to_viewport(view, at) {
            points[slot * 2] = p.x;
            points[slot * 2 + 1] = p.y;
        }
    };
    let across = root.right().as_vec3() * TOUCH_SIDE;
    for (knob, at) in knobs.iter().filter(|(knob, _)| knob.machine == machine) {
        let first = if knob.speed_knob { TOUCH_SPEED_LESS } else { TOUCH_BOUNCE_LESS } as usize;
        put(first, at.translation() - across);
        put(first + 1, at.translation() + across);
    }
    for (_, at) in plungers.iter().filter(|(p, _)| p.machine == machine) {
        put(TOUCH_PLUNGER as usize, at.translation());
    }
    points
}

/// Tells the page whether this console's run is over, and where its controls are on screen. When no
/// machine is focused it clears its state bits; when another is, it leaves them to that machine.
fn publish(
    focus: Res<Focus>,
    pad: Res<Pad>,
    machines: Query<(&WhirlwindConsole, &GlobalTransform)>,
    camera: Single<(&Camera, &GlobalTransform), With<Player>>,
    knobs: Query<(&Knob, &GlobalTransform)>,
    plungers: Query<(&Plunger, &GlobalTransform)>,
) {
    let Some(machine) = focus.0 else { return };
    let Ok((console, root)) = machines.get(machine) else { return };
    pad::publish_more_state(if console.game.over() { pad::STATE_OVER } else { 0 });
    if pad.active {
        let (camera, view) = *camera;
        pad::publish_points(&touch_points(machine, root, camera, view, &knobs, &plungers));
        pad::publish_labels(&["LESS", "MORE", "LESS", "MORE", "RELEASE"]);
    }
}
