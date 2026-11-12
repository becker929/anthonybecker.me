//! Arcade cabinets. `spawn_cabinet` builds one; add more calls to fill the room.

use bevy::{
    asset::RenderAssetUsages,
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat},
};

use crate::{
    crt::{self, CrtGame},
    font,
    pad::{self, Pad},
    player::{Focus, Player},
};

/// Where each cabinet stands: position on the floor and yaw in radians.
/// A cabinet faces +Z at yaw 0. Add entries here to add machines.
const CABINETS: &[(Vec3, f32)] = &[(Vec3::new(0.0, 0.0, 0.0), 0.0)];

#[derive(Component)]
pub struct Cabinet;

/// The texture this cabinet's game paints into.
#[derive(Component)]
pub struct CrtScreen(pub Handle<Image>);

#[derive(Component)]
struct Knob {
    cabinet: Entity,
    charge: bool,
}
#[derive(Component)]
struct FireButton {
    cabinet: Entity,
    press: f32,
}
#[derive(Component)]
struct TubeLight(Entity);
#[derive(Component)]
struct Hud;

/// How far the charge knob turns from empty to full, in radians.
const CHARGE_KNOB_SWEEP: f32 = 4.7;

pub struct CabinetPlugin;
impl Plugin for CabinetPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, (spawn_cabinets, spawn_hud))
            .add_systems(Update, (interact, play, tick_games, animate_controls, update_hud, publish_touch_points).chain());
    }
}

fn spawn_cabinets(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut images: ResMut<Assets<Image>>,
) {
    for (i, (pos, yaw)) in CABINETS.iter().enumerate() {
        let at = Transform::from_translation(*pos).with_rotation(Quat::from_rotation_y(*yaw));
        spawn_cabinet(&mut commands, &mut meshes, &mut materials, &mut images, at, 0x1947 + i as u32);
    }
}

fn marquee_image() -> Image {
    let (w, h) = (512usize, 128usize);
    let mut data = vec![0u8; w * h * 4];
    for (i, px) in data.chunks_exact_mut(4).enumerate() {
        let v = (i / w) as f32 / h as f32;
        let edge = i / w < 6 || i / w >= h - 6;
        let c = if edge { [26, 13, 5] } else { [255, (200.0 - 70.0 * (v - 0.4).abs()) as u8, (110.0 - 80.0 * v) as u8] };
        px.copy_from_slice(&[c[0], c[1], c[2], 255]);
    }
    font::draw_text(&mut data, w, "CATHODE-RAY TUBE", w / 2, 24, 4, [26, 13, 5]);
    font::draw_text(&mut data, w, "AMUSEMENT DEVICE 1947", w / 2, 80, 2, [26, 13, 5]);
    Image::new(
        Extent3d { width: w as u32, height: h as u32, depth_or_array_layers: 1 },
        TextureDimension::D2,
        data,
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::RENDER_WORLD,
    )
}

/// Builds one cabinet. Its origin is on the floor and its screen faces local +Z.
pub fn spawn_cabinet(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    images: &mut Assets<Image>,
    at: Transform,
    seed: u32,
) -> Entity {
    let screen = images.add(Image::new_fill(
        Extent3d { width: crt::W as u32, height: crt::H as u32, depth_or_array_layers: 1 },
        TextureDimension::D2,
        &[0, 0, 0, 255],
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::MAIN_WORLD | RenderAssetUsages::RENDER_WORLD,
    ));
    let marquee = images.add(marquee_image());

    let mut flat = |r: f32, g: f32, b: f32, rough: f32, metal: f32| {
        materials.add(StandardMaterial {
            base_color: Color::srgb(r, g, b),
            perceptual_roughness: rough,
            metallic: metal,
            ..default()
        })
    };
    let body = flat(0.035, 0.05, 0.10, 0.55, 0.0);
    let black = flat(0.01, 0.01, 0.012, 0.4, 0.0);
    let panel = flat(0.09, 0.09, 0.10, 0.35, 0.2);
    let brass = flat(0.72, 0.55, 0.28, 0.3, 0.9);
    let amber = flat(0.85, 0.42, 0.06, 0.5, 0.0);
    let teal = flat(0.08, 0.5, 0.42, 0.5, 0.0);
    let red = materials.add(StandardMaterial {
        base_color: Color::srgb(0.75, 0.06, 0.04),
        emissive: LinearRgba::rgb(0.5, 0.02, 0.01),
        perceptual_roughness: 0.3,
        ..default()
    });
    let tube = materials.add(StandardMaterial {
        base_color: Color::BLACK,
        emissive: LinearRgba::rgb(200.0, 200.0, 200.0),
        emissive_texture: Some(screen.clone()),
        perceptual_roughness: 0.08,
        ..default()
    });
    let sign = materials.add(StandardMaterial {
        base_color: Color::BLACK,
        emissive: LinearRgba::rgb(9.0, 9.0, 9.0),
        emissive_texture: Some(marquee),
        ..default()
    });
    let slot = materials.add(StandardMaterial {
        base_color: Color::BLACK,
        emissive: LinearRgba::rgb(30.0, 8.0, 1.0),
        ..default()
    });

    let root = commands.spawn((Cabinet, CrtGame::new(seed), CrtScreen(screen), at, Visibility::default())).id();

    let mut bx = |size: Vec3, pos: Vec3, mat: &Handle<StandardMaterial>| {
        (Mesh3d(meshes.add(Cuboid::from_size(size))), MeshMaterial3d(mat.clone()), Transform::from_translation(pos))
    };
    // Body: base, then the upper box built around the screen recess.
    let parts = vec![
        bx(Vec3::new(0.84, 1.00, 0.76), Vec3::new(0.0, 0.50, 0.0), &body),
        bx(Vec3::new(0.84, 0.90, 0.54), Vec3::new(0.0, 1.45, -0.11), &body),
        bx(Vec3::new(0.06, 0.90, 0.06), Vec3::new(-0.39, 1.45, 0.19), &body),
        bx(Vec3::new(0.06, 0.90, 0.06), Vec3::new(0.39, 1.45, 0.19), &body),
        bx(Vec3::new(0.72, 0.205, 0.06), Vec3::new(0.0, 1.7975, 0.19), &body),
        bx(Vec3::new(0.72, 0.145, 0.06), Vec3::new(0.0, 1.0725, 0.19), &body),
        // Marquee housing.
        bx(Vec3::new(0.84, 0.20, 0.64), Vec3::new(0.0, 1.99, -0.04), &black),
    ];
    for p in parts {
        commands.spawn((p, ChildOf(root)));
    }
    // Side art: two diagonal stripes per side.
    for side in [-1.0f32, 1.0] {
        for (y, mat) in [(1.12, &amber), (0.88, &teal)] {
            commands.spawn((
                Mesh3d(meshes.add(Cuboid::new(0.006, 0.09, 0.66))),
                MeshMaterial3d(mat.clone()),
                Transform::from_xyz(side * 0.421, y, 0.0).with_rotation(Quat::from_rotation_x(0.6)),
                ChildOf(root),
            ));
        }
    }

    let mut quad = |size: Vec2, pos: Vec3, mat: Handle<StandardMaterial>| {
        (Mesh3d(meshes.add(Rectangle::from_size(size))), MeshMaterial3d(mat), Transform::from_translation(pos))
    };
    let quads = vec![
        quad(Vec2::new(0.72, 0.55), Vec3::new(0.0, 1.42, 0.1605), black.clone()), // bezel
        quad(Vec2::new(0.68, 0.51), Vec3::new(0.0, 1.42, 0.1615), tube),          // the tube face
        quad(Vec2::new(0.80, 0.17), Vec3::new(0.0, 1.99, 0.2805), sign),          // marquee
        quad(Vec2::new(0.26, 0.38), Vec3::new(0.0, 0.47, 0.3805), black.clone()), // coin door
        quad(Vec2::new(0.024, 0.07), Vec3::new(0.0, 0.52, 0.381), slot),
    ];
    for q in quads {
        commands.spawn((q, ChildOf(root)));
    }

    // Control panel, tilted toward the player. Knobs and button are its children.
    let deck = commands
        .spawn((
            Mesh3d(meshes.add(Cuboid::new(0.84, 0.07, 0.40))),
            MeshMaterial3d(panel),
            Transform::from_xyz(0.0, 1.0, 0.40).with_rotation(Quat::from_rotation_x(0.30)),
            ChildOf(root),
        ))
        .id();
    let knob_mesh = meshes.add(Cylinder::new(0.05, 0.06));
    let pointer_mesh = meshes.add(Cuboid::new(0.012, 0.006, 0.045));
    for (x, charge) in [(-0.22, false), (0.22, true)] {
        commands.spawn((
            Knob { cabinet: root, charge },
            Mesh3d(knob_mesh.clone()),
            MeshMaterial3d(brass.clone()),
            Transform::from_xyz(x, 0.065, 0.0),
            ChildOf(deck),
            children![(
                Mesh3d(pointer_mesh.clone()),
                MeshMaterial3d(black.clone()),
                Transform::from_xyz(0.0, 0.031, -0.026),
            )],
        ));
    }
    commands.spawn((
        FireButton { cabinet: root, press: 0.0 },
        Mesh3d(meshes.add(Cylinder::new(0.04, 0.04))),
        MeshMaterial3d(red),
        Transform::from_xyz(0.0, 0.05, 0.03),
        ChildOf(deck),
    ));

    // The tube and the marquee light the player and the floor.
    commands.spawn((
        TubeLight(root),
        PointLight { color: Color::srgb(0.3, 1.0, 0.5), intensity: 9_000.0, range: 5.0, ..default() },
        Transform::from_xyz(0.0, 1.42, 0.45),
        ChildOf(root),
    ));
    commands.spawn((
        PointLight { color: Color::srgb(1.0, 0.62, 0.22), intensity: 14_000.0, range: 5.0, ..default() },
        Transform::from_xyz(0.0, 1.99, 0.5),
        ChildOf(root),
    ));
    root
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
        }
    } else if use_it {
        focus.0 = cabinet_in_reach(&player, &cabinets);
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
    mut games: Query<&mut CrtGame>,
) {
    let Some(mut game) = focus.0.and_then(|e| games.get_mut(e).ok()) else { return };
    let dt = time.delta_secs();
    let axis = |neg: [KeyCode; 2], pos: [KeyCode; 2]| {
        (keys.any_pressed(pos) as i32 - keys.any_pressed(neg) as i32) as f32
    };
    // The elevation knob's pointer lies along the beam, so turning it clockwise (D, or a finger) swings the beam
    // clockwise too: down toward the horizon. A finger turns the knobs by the angle it travels.
    let turn = axis([KeyCode::KeyA, KeyCode::ArrowLeft], [KeyCode::KeyD, KeyCode::ArrowRight]);
    let charge = axis([KeyCode::KeyS, KeyCode::ArrowDown], [KeyCode::KeyW, KeyCode::ArrowUp]);
    game.angle = (game.angle - turn * 28.0 * dt - pad.knobs.x.to_degrees()).clamp(15.0, 80.0);
    game.power = (game.power + charge * 0.45 * dt + pad.knobs.y / CHARGE_KNOB_SWEEP).clamp(0.0, 1.0);
    if keys.just_pressed(KeyCode::Space) || pad.tapped(pad::FIRE) {
        game.fire();
    }
    if (keys.just_pressed(KeyCode::KeyR) || pad.tapped(pad::RESTART)) && game.over {
        game.reset();
    }
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
    mut knobs: Query<(&Knob, &mut Transform), Without<FireButton>>,
    mut buttons: Query<(&mut FireButton, &mut Transform)>,
    mut lights: Query<(&TubeLight, &mut PointLight)>,
) {
    for (knob, mut tf) in &mut knobs {
        let Ok(game) = games.get(knob.cabinet) else { continue };
        // Seen from the player, a negative turn about Y is clockwise. At rest the pointer aims up the panel.
        let turn = if knob.charge {
            (0.5 - game.power) * CHARGE_KNOB_SWEEP
        } else {
            // Up the panel is a beam at 90 degrees, so the pointer always lies along the beam.
            (game.angle - 90.0).to_radians()
        };
        tf.rotation = Quat::from_rotation_y(turn);
    }
    for (mut button, mut tf) in &mut buttons {
        let held = focus.0 == Some(button.cabinet) && (keys.pressed(KeyCode::Space) || pad.held(pad::FIRE));
        button.press = if held { 1.0 } else { (button.press - time.delta_secs() * 6.0).max(0.0) };
        tf.translation.y = 0.05 - 0.014 * button.press;
    }
    for (light, mut point) in &mut lights {
        let Ok(game) = games.get(light.0) else { continue };
        let flight = if game.in_flight() { 0.4 } else { 0.0 };
        point.intensity = 9_000.0 * (1.0 + flight + 3.0 * game.flash);
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

fn spawn_hud(mut commands: Commands) {
    commands.spawn((
        Hud,
        Text::new(""),
        Node { position_type: PositionType::Absolute, left: px(16), bottom: px(14), ..default() },
    ));
    // Crosshair.
    commands.spawn((
        Node {
            position_type: PositionType::Absolute,
            left: percent(50),
            top: percent(50),
            width: px(4),
            height: px(4),
            ..default()
        },
        BackgroundColor(Color::srgba(1.0, 0.9, 0.7, 0.6)),
    ));
}

fn update_hud(
    focus: Res<Focus>,
    pad: Res<Pad>,
    player: Single<&Transform, With<Player>>,
    cabinets: Query<(Entity, &Transform), With<Cabinet>>,
    games: Query<&CrtGame>,
    hud: Single<(&mut Text, &mut Node), With<Hud>>,
) {
    let (mut hud, mut node) = hud.into_inner();
    // The thumbs and the page's buttons own the bottom of a touch screen, so the score moves up, below the page's LEAVE button.
    if pad.active && node.bottom != Val::Auto {
        node.bottom = Val::Auto;
        node.top = px(104);
    }
    let playing = focus.0.and_then(|e| games.get(e).ok());
    let in_reach = playing.is_none() && cabinet_in_reach(&player, &cabinets).is_some();
    pad::publish_state(
        if in_reach { pad::STATE_IN_REACH } else { 0 }
            | if playing.is_some() { pad::STATE_PLAYING } else { 0 }
            | if playing.is_some_and(|g| g.over) { pad::STATE_OVER } else { 0 },
    );
    // With touch the page's own buttons say what to do, so the HUD only keeps score.
    let line = if pad.active {
        match playing {
            Some(game) if game.over => {
                format!("SHELLS {}   HITS {}   WAVE {}\nOut of shells.", game.shells, game.hits, game.wave)
            }
            Some(game) => format!(
                "SHELLS {}   HITS {}   WAVE {}\nelevation {:.0}   charge {:.0}%",
                game.shells,
                game.hits,
                game.wave,
                game.angle,
                game.power * 100.0
            ),
            None => String::new(),
        }
    } else if let Some(game) = playing {
        let status = format!("SHELLS {}   HITS {}   WAVE {}", game.shells, game.hits, game.wave);
        if game.over {
            format!("{status}\nOut of shells.  R play again   E step away")
        } else {
            format!(
                "{status}\nA/D elevation {:.0}   W/S charge {:.0}%   SPACE fire   E step away",
                game.angle,
                game.power * 100.0
            )
        }
    } else if in_reach {
        "E  play".to_string()
    } else {
        "WASD walk   SHIFT run   mouse look   click to capture the mouse".to_string()
    };
    if hud.0 != line {
        hud.0 = line;
    }
}
