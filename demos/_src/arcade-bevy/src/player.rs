//! First-person walking, plus the eased camera move when a cabinet is in use.

use std::f32::consts::FRAC_PI_2;

use bevy::{
    camera::Hdr,
    core_pipeline::tonemapping::Tonemapping,
    input::mouse::AccumulatedMouseMotion,
    post_process::bloom::Bloom,
    prelude::*,
    window::{CursorGrabMode, CursorOptions},
};

use crate::{
    cabinet::Cabinet,
    pad::Pad,
    room::{ROOM_MAX, ROOM_MIN},
};

const EYE_HEIGHT: f32 = 1.6;
const BODY_RADIUS: f32 = 0.3;
const WALK_SPEED: f32 = 2.4;
const RUN_SPEED: f32 = 4.2;
const LOOK_SENSITIVITY: f32 = 0.0022;
/// Radians per CSS pixel of finger travel.
const TOUCH_LOOK_SENSITIVITY: f32 = 0.0055;

#[derive(Component)]
pub struct Player {
    pub yaw: f32,
    pub pitch: f32,
}

/// The cabinet the player is standing at and playing, if any.
#[derive(Resource, Default)]
pub struct Focus(pub Option<Entity>);

pub struct PlayerPlugin;
impl Plugin for PlayerPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<Focus>()
            .add_systems(Startup, spawn_player)
            .add_systems(Update, (grab_cursor, look, walk, place_camera).chain());
    }
}

fn spawn_player(mut commands: Commands) {
    commands.spawn((
        Player { yaw: 0.0, pitch: -0.06 },
        Camera3d::default(),
        Hdr,
        Tonemapping::TonyMcMapface,
        Bloom::NATURAL,
        Projection::from(PerspectiveProjection { fov: 68.0_f32.to_radians(), ..default() }),
        Transform::from_xyz(0.0, EYE_HEIGHT, 3.6),
    ));
}

fn grab_cursor(
    mut cursor: Single<&mut CursorOptions>,
    mouse: Res<ButtonInput<MouseButton>>,
    keys: Res<ButtonInput<KeyCode>>,
    focus: Res<Focus>,
) {
    if mouse.just_pressed(MouseButton::Left) {
        cursor.visible = false;
        cursor.grab_mode = CursorGrabMode::Locked;
    }
    // Escape first leaves a cabinet; pressed again it frees the mouse.
    if keys.just_pressed(KeyCode::Escape) && focus.0.is_none() {
        cursor.visible = true;
        cursor.grab_mode = CursorGrabMode::None;
    }
}

fn look(
    motion: Res<AccumulatedMouseMotion>,
    cursor: Single<&CursorOptions>,
    focus: Res<Focus>,
    pad: Res<Pad>,
    mut player: Single<&mut Player>,
) {
    if focus.0.is_some() {
        return;
    }
    // A finger drags the view directly; the mouse only looks while it is captured.
    let mut turn = pad.look * TOUCH_LOOK_SENSITIVITY;
    if cursor.grab_mode != CursorGrabMode::None {
        turn += motion.delta * LOOK_SENSITIVITY;
    }
    player.yaw -= turn.x;
    player.pitch = (player.pitch - turn.y).clamp(-FRAC_PI_2 + 0.05, FRAC_PI_2 - 0.05);
}

fn walk(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    focus: Res<Focus>,
    pad: Res<Pad>,
    player: Single<(&Player, &mut Transform)>,
    cabinets: Query<&Transform, (With<Cabinet>, Without<Player>)>,
) {
    if focus.0.is_some() {
        return;
    }
    let (player, mut tf) = player.into_inner();
    let mut wish = pad.stick;
    if keys.pressed(KeyCode::KeyW) || keys.pressed(KeyCode::ArrowUp) { wish.y += 1.0; }
    if keys.pressed(KeyCode::KeyS) || keys.pressed(KeyCode::ArrowDown) { wish.y -= 1.0; }
    if keys.pressed(KeyCode::KeyD) || keys.pressed(KeyCode::ArrowRight) { wish.x += 1.0; }
    if keys.pressed(KeyCode::KeyA) || keys.pressed(KeyCode::ArrowLeft) { wish.x -= 1.0; }
    let speed = if keys.pressed(KeyCode::ShiftLeft) { RUN_SPEED } else { WALK_SPEED };
    let facing = Quat::from_rotation_y(player.yaw);
    let wish = wish.clamp_length_max(1.0);
    let step = facing * Vec3::new(wish.x, 0.0, -wish.y) * speed * time.delta_secs();
    let mut pos = tf.translation + step;

    // Keep out of each cabinet. The test runs in the cabinet's own space, so rotated cabinets work.
    for cab in &cabinets {
        let to_local = cab.compute_affine().inverse();
        let mut local = to_local.transform_point3(pos);
        let centre = Vec2::new(0.0, 0.11);
        let half = Vec2::new(0.42, 0.49) + BODY_RADIUS;
        let d = Vec2::new(local.x, local.z) - centre;
        if d.x.abs() < half.x && d.y.abs() < half.y {
            // Push out along the shallowest axis.
            if half.x - d.x.abs() < half.y - d.y.abs() {
                local.x = centre.x + half.x * d.x.signum();
            } else {
                local.z = centre.y + half.y * d.y.signum();
            }
            pos = cab.transform_point(local);
        }
    }
    pos.x = pos.x.clamp(ROOM_MIN.x + BODY_RADIUS, ROOM_MAX.x - BODY_RADIUS);
    pos.z = pos.z.clamp(ROOM_MIN.y + BODY_RADIUS, ROOM_MAX.y - BODY_RADIUS);
    tf.translation = pos;
}

/// Free look when walking; an eased move to the cabinet's seat when playing.
fn place_camera(
    time: Res<Time>,
    focus: Res<Focus>,
    player: Single<(&mut Player, &mut Transform)>,
    cabinets: Query<&Transform, (With<Cabinet>, Without<Player>)>,
) {
    let (mut player, mut tf) = player.into_inner();
    let k = 1.0 - (-8.0 * time.delta_secs()).exp();
    if let Some(cab) = focus.0.and_then(|e| cabinets.get(e).ok()) {
        let eye = cab.transform_point(Vec3::new(0.0, 1.52, 1.12));
        let aim = cab.transform_point(Vec3::new(0.0, 1.33, 0.16));
        let want = Transform::from_translation(eye).looking_at(aim, Vec3::Y);
        tf.translation = tf.translation.lerp(want.translation, k);
        tf.rotation = tf.rotation.slerp(want.rotation, k);
        // Remember where we are looking, so leaving the cabinet does not snap the view.
        let (yaw, pitch, _) = tf.rotation.to_euler(EulerRot::YXZ);
        player.yaw = yaw;
        player.pitch = pitch;
    } else {
        tf.translation.y += (EYE_HEIGHT - tf.translation.y) * k;
        tf.rotation = Quat::from_euler(EulerRot::YXZ, player.yaw, player.pitch, 0.0);
    }
}
