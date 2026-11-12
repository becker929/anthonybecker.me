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
    pad::Pad,
    room::{self, ROOM_MAX, ROOM_MIN},
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

/// A machine the player can step up to. On the machine's root entity; positions are in its own space.
#[derive(Component, Clone)]
pub struct Machine {
    /// Which game it is, as `pad::GAME_` numbers it.
    #[allow(dead_code)] // for the machines being added
    pub id: u32,
    /// Where the eye goes while playing, and what it looks at.
    pub seat_eye: Vec3,
    pub seat_aim: Vec3,
    /// Half the width that must stay in view, and how far forward the machine's face stands. On a
    /// narrow screen the seat steps back until that width fits.
    pub seat_half_width: f32,
    pub seat_front: f32,
    /// The footprint the player cannot walk into: its centre and half its size on the floor.
    pub body_centre: Vec2,
    pub body_half: Vec2,
}

impl Machine {
    /// The seat for a view of this aspect (width over height), in the machine's own space.
    pub fn eye_for(&self, aspect: f32) -> Vec3 {
        let half_width_per_metre = (FOV / 2.0).tan() * aspect;
        let mut eye = self.seat_eye;
        eye.z = eye.z.max(self.seat_front + self.seat_half_width / half_width_per_metre);
        eye
    }

    /// Whether a player standing at `at` (in the machine's space) is in front of it, close enough to play.
    pub fn in_reach(&self, at: Vec3) -> bool {
        let front = self.body_centre.y + self.body_half.y;
        at.x.abs() < self.body_half.x + 0.5 && at.z > front - 0.1 && at.z < front + 1.8
    }
}

/// The camera's vertical field of view.
pub const FOV: f32 = 68.0 * std::f32::consts::PI / 180.0;

/// The machine the player is standing at and playing, if any.
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

fn spawn_player(mut commands: Commands, mut images: ResMut<Assets<Image>>) {
    commands.spawn((
        Player { yaw: 0.0, pitch: -0.06 },
        Camera3d::default(),
        Hdr,
        Tonemapping::TonyMcMapface,
        // A light bloom: the tube and the light lines glow, but nothing smears.
        Bloom { intensity: 0.07, ..Bloom::NATURAL },
        // What polished things mirror: a baked picture of the room.
        room::environment(&mut images),
        Projection::from(PerspectiveProjection { fov: FOV, ..default() }),
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
    machines: Query<(&Transform, &Machine), Without<Player>>,
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

    // Keep out of each machine. The test runs in the machine's own space, so turned machines work.
    for (cab, machine) in &machines {
        let to_local = cab.compute_affine().inverse();
        let mut local = to_local.transform_point3(pos);
        let centre = machine.body_centre;
        let half = machine.body_half + BODY_RADIUS;
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
    player: Single<(&mut Player, &mut Transform, &Camera)>,
    machines: Query<(&Transform, &Machine), Without<Player>>,
) {
    let (mut player, mut tf, camera) = player.into_inner();
    let k = 1.0 - (-8.0 * time.delta_secs()).exp();
    if let Some((cab, machine)) = focus.0.and_then(|e| machines.get(e).ok()) {
        let aspect = camera.logical_viewport_size().map_or(16.0 / 9.0, |size| size.x / size.y.max(1.0));
        let eye = cab.transform_point(machine.eye_for(aspect));
        let aim = cab.transform_point(machine.seat_aim);
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
