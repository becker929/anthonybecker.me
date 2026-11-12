//! The arcade cabinet: its model's working parts, the controls, and the HUD.

use bevy::{
    asset::RenderAssetUsages,
    gltf::GltfAssetLabel,
    world_serialization::WorldInstanceReady,
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat},
};

use crate::{
    crt::{self, CrtGame},
    font,
    pad::{self, Pad},
    player::{Focus, Player},
};

#[derive(Component)]
pub struct Cabinet;

/// The texture this cabinet's game paints into.
#[derive(Component)]
pub struct CrtScreen(pub Handle<Image>);

#[derive(Component)]
struct Knob {
    cabinet: Entity,
    charge: bool,
    /// Where the knob is drawn, and how fast it is turning. It springs after the game's value, so it
    /// lands on each notch with a little overshoot.
    turn: f32,
    speed: f32,
}

/// The knobs as the player's hands have left them. The game's values follow in notches.
#[derive(Component)]
struct Dials {
    elevation: f32,
    charge: f32,
}

/// How much green light the tube throws on the deck and the player. A hit makes it flare.
const TUBE_LIGHT: f32 = 380.0;

/// One notch of each knob. The controls are heavy switchgear, not fine instruments.
const ELEVATION_NOTCH: f32 = 2.5;
const CHARGE_NOTCH: f32 = 0.05;
#[derive(Component)]
struct FireButton {
    cabinet: Entity,
    press: f32,
    /// Where the model put it; pressing sinks it from here.
    rest: Vec3,
}
#[derive(Component)]
struct TubeLight(Entity);

/// How far the charge knob turns from empty to full, in radians.
const CHARGE_KNOB_SWEEP: f32 = 4.7;

/// True once the Blender model has loaded and its parts are wired up.
#[derive(Resource, Default)]
pub struct ModelReady(pub bool);

pub struct CabinetPlugin;
impl Plugin for CabinetPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<ModelReady>().add_systems(Startup, spawn_cabinet)
            .add_systems(Update, (interact, play, tick_games, report_sounds, animate_controls, publish_game_state, publish_touch_points).chain());
    }
}

fn marquee_image() -> Image {
    let (w, h) = (512usize, 128usize);
    let mut data = vec![0u8; w * h * 4];
    for (i, px) in data.chunks_exact_mut(4).enumerate() {
        let v = (i / w) as f32 / h as f32;
        let edge = i / w < 5 || i / w >= h - 5;
        let c = if edge { [20, 10, 4] } else { [255, (190.0 - 70.0 * (v - 0.4).abs()) as u8, (96.0 - 70.0 * v) as u8] };
        px.copy_from_slice(&[c[0], c[1], c[2], 255]);
    }
    font::draw_text(&mut data, w, "CATHODE-RAY TUBE", w / 2, 24, 4, [20, 10, 4]);
    font::draw_text(&mut data, w, "AMUSEMENT DEVICE 1947", w / 2, 80, 2, [20, 10, 4]);
    Image::new(
        Extent3d { width: w as u32, height: h as u32, depth_or_array_layers: 1 },
        TextureDimension::D2,
        data,
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::RENDER_WORLD,
    )
}

/// The cabinet and the room are one model, made in Blender (blender/build.py). This spawns it and
/// the game that runs on its tube. The model's named parts get their behaviour in `wire_model`.
fn spawn_cabinet(mut commands: Commands, assets: Res<AssetServer>, mut images: ResMut<Assets<Image>>) {
    let screen = images.add(Image::new_fill(
        Extent3d { width: crt::W as u32, height: crt::H as u32, depth_or_array_layers: 1 },
        TextureDimension::D2,
        &[0, 0, 0, 255],
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::MAIN_WORLD | RenderAssetUsages::RENDER_WORLD,
    ));
    let root = commands
        .spawn((
            Cabinet,
            CrtGame::new(0x1947),
            Dials { elevation: 47.5, charge: 0.5 },
            CrtScreen(screen),
            Transform::default(),
            WorldAssetRoot(assets.load(GltfAssetLabel::Scene(0).from_asset("arcade.glb"))),
        ))
        .observe(wire_model)
        .id();
    // The tube lights the player and the deck; a hit makes it flare.
    commands.spawn((
        TubeLight(root),
        PointLight { color: Color::srgb(0.35, 1.0, 0.55), intensity: TUBE_LIGHT, range: 1.7, ..default() },
        Transform::from_xyz(0.0, 1.42, 0.42),
        ChildOf(root),
    ));
}

/// Runs once the model is in the world: finds its named parts and makes them work.
fn wire_model(
    ready: On<WorldInstanceReady>,
    mut commands: Commands,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut images: ResMut<Assets<Image>>,
    mut model: ResMut<ModelReady>,
    screens: Query<&CrtScreen>,
    children: Query<&Children>,
    named: Query<(&Name, &Transform)>,
) {
    let root = ready.entity;
    let Ok(screen) = screens.get(root) else { return };
    let tube = materials.add(StandardMaterial {
        base_color: Color::BLACK,
        emissive: LinearRgba::rgb(26.0, 26.0, 26.0),
        emissive_texture: Some(screen.0.clone()),
        // Lamps would show in the glass as stray coloured dots, so it takes no highlights. Its sheen is
        // painted into the picture instead (src/crt.rs).
        perceptual_roughness: 0.5,
        reflectance: 0.0,
        ..default()
    });
    let sign = materials.add(StandardMaterial {
        base_color: Color::BLACK,
        emissive: LinearRgba::rgb(1.3, 1.3, 1.3),
        emissive_texture: Some(images.add(marquee_image())),
        ..default()
    });
    for entity in children.iter_descendants(root) {
        let Ok((name, at)) = named.get(entity) else { continue };
        // A named part is a node; the meshes drawn for it are its children.
        let repaint = |commands: &mut Commands, mat: &Handle<StandardMaterial>| {
            for mesh in children.iter_descendants(entity) {
                commands.entity(mesh).insert(MeshMaterial3d(mat.clone()));
            }
        };
        match name.as_str() {
            "Screen" => repaint(&mut commands, &tube),
            "Marquee" => repaint(&mut commands, &sign),
            "Knob_Elevation" => drop(commands.entity(entity).insert(Knob { cabinet: root, charge: false, turn: 0.0, speed: 0.0 })),
            "Knob_Charge" => drop(commands.entity(entity).insert(Knob { cabinet: root, charge: true, turn: 0.0, speed: 0.0 })),
            "Button_Fire" => {
                commands.entity(entity).insert(FireButton { cabinet: root, press: 0.0, rest: at.translation });
            }
            _ => {}
        }
    }
    model.0 = true;
}

/// E steps up to the cabinet in front of you; E or Escape steps away.
fn interact(
    keys: Res<ButtonInput<KeyCode>>,
    pad: Res<Pad>,
    mut focus: ResMut<Focus>,
    player: Single<&Transform, With<Player>>,
    cabinets: Query<(Entity, &Transform), With<Cabinet>>,
) {
    let use_it = keys.just_pressed(KeyCode::KeyE) || pad.tapped(pad::USE);
    if focus.0.is_some() {
        if use_it || keys.just_pressed(KeyCode::Escape) {
            focus.0 = None;
            pad::sound(pad::SOUND_STEP_AWAY);
        }
    } else if use_it {
        focus.0 = cabinet_in_reach(&player, &cabinets);
        if focus.0.is_some() {
            pad::sound(pad::SOUND_STEP_UP);
        }
    }
}

fn cabinet_in_reach(player: &Transform, cabinets: &Query<(Entity, &Transform), With<Cabinet>>) -> Option<Entity> {
    cabinets.iter().find_map(|(e, cab)| {
        let local = cab.compute_affine().inverse().transform_point3(player.translation);
        let to_cab = (cab.translation - player.translation).with_y(0.0).normalize_or_zero();
        let facing = player.forward().as_vec3().with_y(0.0).normalize_or_zero().dot(to_cab) > 0.5;
        (local.x.abs() < 0.9 && local.z > 0.4 && local.z < 2.2 && facing).then_some(e)
    })
}

fn play(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    pad: Res<Pad>,
    focus: Res<Focus>,
    mut games: Query<(&mut CrtGame, &mut Dials)>,
) {
    let Some((mut game, mut dials)) = focus.0.and_then(|e| games.get_mut(e).ok()) else { return };
    let dt = time.delta_secs();
    let axis = |neg: [KeyCode; 2], pos: [KeyCode; 2]| {
        (keys.any_pressed(pos) as i32 - keys.any_pressed(neg) as i32) as f32
    };
    // The elevation knob's pointer lies along the beam, so turning it clockwise (D, or a finger) swings the beam
    // clockwise too: down toward the horizon. A finger turns the knobs by the angle it travels.
    let turn = axis([KeyCode::KeyA, KeyCode::ArrowLeft], [KeyCode::KeyD, KeyCode::ArrowRight]);
    let charge = axis([KeyCode::KeyS, KeyCode::ArrowDown], [KeyCode::KeyW, KeyCode::ArrowUp]);
    dials.elevation = (dials.elevation - turn * 28.0 * dt - pad.knobs.x.to_degrees()).clamp(15.0, 80.0);
    dials.charge = (dials.charge + charge * 0.45 * dt + pad.knobs.y / CHARGE_KNOB_SWEEP).clamp(0.0, 1.0);
    // The game only ever sees whole notches. Each one it moves through is heard and felt.
    let angle = (dials.elevation / ELEVATION_NOTCH).round() * ELEVATION_NOTCH;
    let power = (dials.charge / CHARGE_NOTCH).round() * CHARGE_NOTCH;
    if angle != game.angle || (power - game.power).abs() > CHARGE_NOTCH * 0.5 {
        game.angle = angle;
        game.power = power;
        pad::sound(pad::SOUND_NOTCH);
    }
    if keys.just_pressed(KeyCode::Space) || pad.tapped(pad::FIRE) {
        pad::sound(if game.fire() { pad::SOUND_FIRE } else { pad::SOUND_DUD });
    }
    if keys.just_released(KeyCode::Space) {
        pad::sound(pad::SOUND_BUTTON_UP);
    }
    if (keys.just_pressed(KeyCode::KeyR) || pad.tapped(pad::RESTART)) && game.over {
        game.reset();
        pad::sound(pad::SOUND_RESTART);
    }
}

/// Passes on what the game says happened, and how loud the tube hums from where the player stands.
fn report_sounds(mut games: Query<(&mut CrtGame, &Transform)>, player: Single<&Transform, (With<Player>, Without<CrtGame>)>) {
    let mut hum: f32 = 0.0;
    for (mut game, at) in &mut games {
        if game.happened != 0 {
            pad::sound(game.happened);
            game.happened = 0;
        }
        let tube = at.translation + Vec3::new(0.0, 1.42, 0.13);
        hum = hum.max(1.0 / (1.0 + player.translation.distance_squared(tube) * 0.9));
    }
    pad::publish_hum(hum);
}

/// Every cabinet keeps running, so idle machines still glow.
fn tick_games(time: Res<Time>, mut images: ResMut<Assets<Image>>, mut games: Query<(&mut CrtGame, &CrtScreen)>) {
    for (mut game, screen) in &mut games {
        game.step(time.delta_secs());
        if let Some(mut image) = images.get_mut(&screen.0) {
            if let Some(data) = image.data.as_mut() {
                game.render(data);
            }
        }
    }
}

fn animate_controls(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    pad: Res<Pad>,
    focus: Res<Focus>,
    games: Query<&CrtGame>,
    mut knobs: Query<(&mut Knob, &mut Transform), Without<FireButton>>,
    mut buttons: Query<(&mut FireButton, &mut Transform)>,
    mut lights: Query<(&TubeLight, &mut PointLight)>,
) {
    let dt = time.delta_secs().min(0.05);
    for (mut knob, mut tf) in &mut knobs {
        let Ok(game) = games.get(knob.cabinet) else { continue };
        // Seen from the player, a negative turn about Y is clockwise. At rest the pointer aims up the panel.
        let want = if knob.charge {
            (0.5 - game.power) * CHARGE_KNOB_SWEEP
        } else {
            // Up the panel is a beam at 90 degrees, so the pointer always lies along the beam.
            (game.angle - 90.0).to_radians()
        };
        // A stiff, under-damped spring: the knob jumps to the notch, overshoots a touch and settles.
        // A spring this stiff cannot be stepped a whole frame at a time: on a slow frame it gains energy
        // every step, shakes harder and harder, and ends as a number that is not a number, which makes
        // the knob vanish. So it is stepped in slices of a few milliseconds.
        let mut left = dt;
        while left > 0.0 {
            let h = left.min(0.004);
            left -= h;
            let pull = (want - knob.turn) * 1400.0 - knob.speed * 34.0;
            knob.speed += pull * h;
            knob.turn += knob.speed * h;
        }
        // Should it ever go wrong anyway, put the knob where it belongs.
        if !knob.turn.is_finite() || !knob.speed.is_finite() || (knob.turn - want).abs() > 6.0 {
            knob.turn = want;
            knob.speed = 0.0;
        }
        tf.rotation = Quat::from_rotation_y(knob.turn);
    }
    for (mut button, mut tf) in &mut buttons {
        let held = focus.0 == Some(button.cabinet) && (keys.pressed(KeyCode::Space) || pad.held(pad::FIRE));
        // It drops fast under the hand and comes back slowly, like a sprung plunger.
        button.press = if held { (button.press + dt * 22.0).min(1.0) } else { (button.press - dt * 4.0).max(0.0) };
        tf.translation = button.rest - Vec3::Y * 0.016 * button.press;
    }
    for (light, mut point) in &mut lights {
        let Ok(game) = games.get(light.0) else { continue };
        let flight = if game.in_flight() { 0.4 } else { 0.0 };
        point.intensity = TUBE_LIGHT * (1.0 + flight + 3.0 * game.flash);
    }
}

/// Tells the page where the focused cabinet's knobs and button are on screen, so fingers can work them directly.
fn publish_touch_points(
    focus: Res<Focus>,
    pad: Res<Pad>,
    camera: Single<(&Camera, &GlobalTransform), With<Player>>,
    knobs: Query<(&Knob, &GlobalTransform)>,
    buttons: Query<(&FireButton, &GlobalTransform)>,
) {
    let (Some(cabinet), true) = (focus.0, pad.active) else { return };
    let (camera, view) = *camera;
    let mut points = [-1000.0; 6];
    let mut put = |slot: usize, at: &GlobalTransform| {
        if let Ok(p) = camera.world_to_viewport(view, at.translation()) {
            points[slot * 2] = p.x;
            points[slot * 2 + 1] = p.y;
        }
    };
    for (knob, at) in &knobs {
        if knob.cabinet == cabinet {
            put(knob.charge as usize, at);
        }
    }
    for (button, at) in &buttons {
        if button.cabinet == cabinet {
            put(2, at);
        }
    }
    pad::publish_points(points);
}

/// Tells the page what the player can do now. The page draws the prompts and buttons; the game
/// itself puts no words on the screen. The score is on the tube (src/crt.rs).
fn publish_game_state(
    focus: Res<Focus>,
    player: Single<&Transform, With<Player>>,
    cabinets: Query<(Entity, &Transform), With<Cabinet>>,
    games: Query<&CrtGame>,
) {
    let playing = focus.0.and_then(|e| games.get(e).ok());
    let flying = games.iter().any(|g| g.in_flight());
    let in_reach = playing.is_none() && cabinet_in_reach(&player, &cabinets).is_some();
    pad::publish_state(
        if in_reach { pad::STATE_IN_REACH } else { 0 }
            | if playing.is_some() { pad::STATE_PLAYING } else { 0 }
            | if playing.is_some_and(|g| g.over) { pad::STATE_OVER } else { 0 }
            | if flying { pad::STATE_FLIGHT } else { 0 },
    );
}
