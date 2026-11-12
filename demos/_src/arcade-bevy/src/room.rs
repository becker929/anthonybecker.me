//! The arcade room: floor, walls, ceiling and house lights.

use bevy::{
    asset::RenderAssetUsages,
    image::ImageSampler,
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
        app.insert_resource(GlobalAmbientLight { color: Color::srgb(0.6, 0.6, 1.0), brightness: 14.0, ..default() })
            .add_systems(Startup, spawn_room);
    }
}

fn spawn_room(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut images: ResMut<Assets<Image>>,
) {
    let size = ROOM_MAX - ROOM_MIN;
    let mid = (ROOM_MIN + ROOM_MAX) * 0.5;

    // Checkerboard floor: one texel per half-metre tile.
    let (tx, tz) = ((size.x * 2.0) as u32, (size.y * 2.0) as u32);
    let mut data = Vec::with_capacity((tx * tz * 4) as usize);
    for z in 0..tz {
        for x in 0..tx {
            data.extend_from_slice(if (x + z) % 2 == 0 { &[28, 24, 34, 255] } else { &[120, 106, 96, 255] });
        }
    }
    let mut checker = Image::new(
        Extent3d { width: tx, height: tz, depth_or_array_layers: 1 },
        TextureDimension::D2,
        data,
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::RENDER_WORLD,
    );
    checker.sampler = ImageSampler::nearest();
    commands.spawn((
        Mesh3d(meshes.add(Plane3d::new(Vec3::Y, size * 0.5))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color_texture: Some(images.add(checker)),
            perceptual_roughness: 0.35,
            ..default()
        })),
        Transform::from_xyz(mid.x, 0.0, mid.y),
    ));

    let wall = materials.add(StandardMaterial {
        base_color: Color::srgb(0.20, 0.12, 0.24),
        perceptual_roughness: 0.9,
        ..default()
    });
    let wood = materials.add(StandardMaterial {
        base_color: Color::srgb(0.10, 0.065, 0.05),
        perceptual_roughness: 0.6,
        ..default()
    });
    let t = 0.1; // wall thickness
    let mut slab = |size: Vec3, at: Vec3, mat: &Handle<StandardMaterial>| {
        commands.spawn((
            Mesh3d(meshes.add(Cuboid::from_size(size))),
            MeshMaterial3d(mat.clone()),
            Transform::from_translation(at),
        ));
    };
    let h = ROOM_HEIGHT;
    // Walls: back, front, left, right. Then the ceiling.
    slab(Vec3::new(size.x, h, t), Vec3::new(mid.x, h / 2.0, ROOM_MIN.y - t / 2.0), &wall);
    slab(Vec3::new(size.x, h, t), Vec3::new(mid.x, h / 2.0, ROOM_MAX.y + t / 2.0), &wall);
    slab(Vec3::new(t, h, size.y), Vec3::new(ROOM_MIN.x - t / 2.0, h / 2.0, mid.y), &wall);
    slab(Vec3::new(t, h, size.y), Vec3::new(ROOM_MAX.x + t / 2.0, h / 2.0, mid.y), &wall);
    slab(Vec3::new(size.x, t, size.y), Vec3::new(mid.x, h + t / 2.0, mid.y), &wall);
    // Wood wainscot along the lower wall.
    let (w, d) = (0.9, 0.03);
    slab(Vec3::new(size.x, w, d), Vec3::new(mid.x, w / 2.0, ROOM_MIN.y + d / 2.0), &wood);
    slab(Vec3::new(size.x, w, d), Vec3::new(mid.x, w / 2.0, ROOM_MAX.y - d / 2.0), &wood);
    slab(Vec3::new(d, w, size.y), Vec3::new(ROOM_MIN.x + d / 2.0, w / 2.0, mid.y), &wood);
    slab(Vec3::new(d, w, size.y), Vec3::new(ROOM_MAX.x - d / 2.0, w / 2.0, mid.y), &wood);

    // One dim, warm house light. The cabinets do most of the lighting.
    commands.spawn((
        PointLight {
            color: Color::srgb(1.0, 0.8, 0.62),
            intensity: 420_000.0,
            range: 14.0,
            shadow_maps_enabled: true,
            ..default()
        },
        Transform::from_xyz(1.2, ROOM_HEIGHT - 0.3, 3.4),
    ));
}
