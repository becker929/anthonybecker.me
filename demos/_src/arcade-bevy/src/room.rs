//! The arcade room. Its walls, floor and light coves are part of the Blender model that
//! src/cabinet.rs loads; this file keeps the walkable bounds and lights the place.

use bevy::{
    asset::RenderAssetUsages,
    camera::Exposure,
    image::{ImageFilterMode, ImageSampler, ImageSamplerDescriptor},
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat, TextureViewDescriptor, TextureViewDimension},
};

/// Walkable bounds of the room on the floor plane.
pub const ROOM_MIN: Vec2 = Vec2::new(-4.0, -0.6);
pub const ROOM_MAX: Vec2 = Vec2::new(4.0, 6.4);
pub const ROOM_HEIGHT: f32 = 3.2;

pub struct RoomPlugin;
impl Plugin for RoomPlugin {
    fn build(&self, app: &mut App) {
        // The room's light is baked into the model's lightmaps (blender/build.py), so there is no
        // ambient light and there are no room lamps here. The only live lamp is the tube's.
        app.insert_resource(GlobalAmbientLight { brightness: 0.0, ..default() });
    }
}

/// A picture of the room as a cube, taken in Blender from in front of the cabinet
/// (blender/build.py, `render_env`). Steel, glass and varnish mirror it, since the game cannot work
/// out reflections itself. It is built into the program, so it is there before the first frame.
static ENV: &[u8] = include_bytes!("../assets/env.bin");
/// Face size of the mirror cube and of the soft cube that lights the moving controls.
const ENV_SIZE: u32 = 64;
const DIFFUSE_SIZE: u32 = 8;
/// A pixel of 1.0 in the cube is this bright. blender/build.py has the same number (ENV_WHITE).
const ENV_WHITE: f32 = 8.0;

fn cube(bytes: &[u8], size: u32, levels: u32) -> Image {
    let mut image = Image::new_uninit(
        Extent3d { width: size, height: size, depth_or_array_layers: 6 },
        TextureDimension::D2,
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::RENDER_WORLD,
    );
    // The file holds each face with all its sizes, largest first: rougher surfaces read smaller, blurrier ones.
    image.texture_descriptor.mip_level_count = levels;
    image.data = Some(bytes.to_vec());
    image.texture_view_descriptor = Some(TextureViewDescriptor { dimension: Some(TextureViewDimension::Cube), ..default() });
    image.sampler = ImageSampler::Descriptor(ImageSamplerDescriptor {
        mag_filter: ImageFilterMode::Linear,
        min_filter: ImageFilterMode::Linear,
        mipmap_filter: ImageFilterMode::Linear,
        ..default()
    });
    image
}

/// The room's reflection and soft light, for the camera to carry.
pub fn environment(images: &mut Assets<Image>) -> EnvironmentMapLight {
    let levels = ENV_SIZE.ilog2() + 1;
    let mirror_len = (0..levels).map(|l| (ENV_SIZE >> l).pow(2) * 4).sum::<u32>() as usize * 6;
    let soft_len = (DIFFUSE_SIZE * DIFFUSE_SIZE * 4 * 6) as usize;
    assert_eq!(ENV.len(), mirror_len + soft_len, "assets/env.bin does not match the sizes in src/room.rs");
    EnvironmentMapLight {
        specular_map: images.add(cube(&ENV[..mirror_len], ENV_SIZE, levels)),
        diffuse_map: images.add(cube(&ENV[mirror_len..], DIFFUSE_SIZE, 1)),
        intensity: ENV_WHITE / Exposure::default().exposure(),
        ..default()
    }
}
