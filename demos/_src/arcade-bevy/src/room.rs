//! The arcade room. Its walls, floor and light coves are part of the Blender model that
//! src/cabinet.rs loads; this file keeps the walkable bounds and lights the place.

use bevy::{
    asset::RenderAssetUsages,
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat},
};

/// Walkable bounds of the room on the floor plane.
pub const ROOM_MIN: Vec2 = Vec2::new(-4.0, -0.6);
pub const ROOM_MAX: Vec2 = Vec2::new(4.0, 6.4);
pub const ROOM_HEIGHT: f32 = 3.2;

pub struct RoomPlugin;
impl Plugin for RoomPlugin {
    fn build(&self, app: &mut App) {
        // A cool, even fill, so the navy walls and the concrete read as themselves in the dark.
        app.insert_resource(GlobalAmbientLight { color: Color::srgb(0.62, 0.72, 1.0), brightness: 70.0, ..default() })
            .add_systems(Startup, spawn_lights);
    }
}

/// A strip of warm light that is brightest at one long edge and gone by the other.
fn wash_image() -> Image {
    let (w, h) = (4usize, 64usize);
    let mut data = Vec::with_capacity(w * h * 4);
    for y in 0..h {
        let t = 1.0 - y as f32 / (h - 1) as f32; // 1 at the wall
        let a = (t * t * t * 62.0) as u8;
        for _ in 0..w {
            data.extend_from_slice(&[255, 206, 158, a]);
        }
    }
    Image::new(
        Extent3d { width: w as u32, height: h as u32, depth_or_array_layers: 1 },
        TextureDimension::D2,
        data,
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::RENDER_WORLD,
    )
}

fn spawn_lights(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut images: ResMut<Assets<Image>>,
) {
    // The coves at the foot of each wall wash the floor with warm light. Real lamps that low would
    // each leave a hot round spot, so the wash is painted: a soft strip lying on the floor by each wall.
    let wash = materials.add(StandardMaterial {
        base_color_texture: Some(images.add(wash_image())),
        unlit: true,
        alpha_mode: AlphaMode::Blend,
        ..default()
    });
    let (lo, hi) = (ROOM_MIN, ROOM_MAX);
    let (size, mid) = (hi - lo, (lo + hi) * 0.5);
    let reach = 0.8;
    // Each strip is a quad lying flat, turned so the bright edge of the picture meets its wall.
    let mut strip = |length: f32, at: Vec3, yaw: f32| {
        commands.spawn((
            Mesh3d(meshes.add(Rectangle::new(length, reach))),
            MeshMaterial3d(wash.clone()),
            Transform::from_translation(at)
                .with_rotation(Quat::from_rotation_y(yaw) * Quat::from_rotation_x(-std::f32::consts::FRAC_PI_2)),
        ));
    };
    let y = 0.004;
    let half = reach / 2.0 + 0.04;
    strip(size.x, Vec3::new(mid.x, y, lo.y + half), 0.0);
    strip(size.x, Vec3::new(mid.x, y, hi.y - half), std::f32::consts::PI);
    strip(size.y, Vec3::new(lo.x + half, y, mid.y), std::f32::consts::FRAC_PI_2);
    strip(size.y, Vec3::new(hi.x - half, y, mid.y), -std::f32::consts::FRAC_PI_2);

    // A few wide, weak lamps overhead keep the walls and floor from going flat. They are cool, so the
    // concrete stays grey and the warmth is left to the coves and the cabinet.
    for (x, z) in [(-2.6, 1.4), (2.6, 1.4), (-2.6, 4.6), (2.6, 4.6)] {
        commands.spawn((
            PointLight { color: Color::srgb(0.80, 0.86, 1.0), intensity: 16_000.0, range: 7.0, radius: 0.4, ..default() },
            Transform::from_xyz(x, 2.3, z),
        ));
    }
    // One soft lamp overhead picks the cabinet out and gives it a shadow on the floor.
    commands.spawn((
        SpotLight {
            color: Color::srgb(1.0, 0.88, 0.76),
            intensity: 240_000.0,
            range: 9.0,
            inner_angle: 0.12,
            outer_angle: 0.62,
            shadow_maps_enabled: true,
            ..default()
        },
        Transform::from_xyz(0.5, ROOM_HEIGHT - 0.15, 2.6).looking_at(Vec3::new(0.0, 0.9, 0.3), Vec3::Y),
    ));
}
