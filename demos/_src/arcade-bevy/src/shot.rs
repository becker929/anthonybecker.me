//! Headless capture: `cargo run -- --shot out_dir` renders a few fixed views to PNG
//! without opening a window. Useful for golden-image tests and for checking lighting.

use std::{path::PathBuf, time::Duration};

use bevy::{
    app::ScheduleRunnerPlugin,
    camera::{RenderTarget, ShadowLodOrigin},
    prelude::*,
    render::{
        render_resource::TextureFormat,
        view::screenshot::{save_to_disk, Screenshot},
    },
    window::ExitCondition,
    winit::WinitPlugin,
};

use crate::{cabinet::ModelReady, crt::CrtGame, player::Player};

const SIZE: UVec2 = UVec2::new(1280, 720);
const FRAMES_PER_VIEW: u32 = 40;
/// Eye position and look-at target for each capture.
const VIEWS: &[(&str, Vec3, Vec3)] = &[
    ("wide", Vec3::new(2.6, 1.6, 5.2), Vec3::new(0.0, 1.2, 0.0)),
    ("approach", Vec3::new(-1.1, 1.6, 2.4), Vec3::new(0.0, 1.25, 0.0)),
    ("playing", Vec3::new(0.0, 1.52, 1.12), Vec3::new(0.0, 1.33, 0.16)),
    // The angle of the reference picture the look was built from.
    ("hero", Vec3::new(-0.24, 1.74, 0.98), Vec3::new(0.02, 1.27, 0.20)),
    // Close on the controls, and low across the floor for its reflections.
    ("controls", Vec3::new(0.0, 1.38, 0.86), Vec3::new(0.0, 1.02, 0.42)),
    ("floor", Vec3::new(1.6, 0.9, 3.4), Vec3::new(-0.4, 0.5, 0.0)),
    // Bertie from where its player stands, and the two machines together.
    ("bertie", Vec3::new(2.0, 1.52, 1.575), Vec3::new(2.0, 1.49, 0.10)),
    ("pair", Vec3::new(1.0, 1.7, 4.4), Vec3::new(1.0, 1.4, 0.0)),
];

#[derive(Resource)]
struct Shot {
    dir: PathBuf,
    target: Handle<Image>,
    frame: u32,
}

/// Returns the output directory if `--shot <dir>` was passed.
pub fn requested() -> Option<PathBuf> {
    let mut args = std::env::args().skip_while(|a| a != "--shot");
    args.next()?;
    Some(args.next().unwrap_or_else(|| "shots".into()).into())
}

pub fn add_headless(app: &mut App, dir: PathBuf) {
    std::fs::create_dir_all(&dir).expect("could not create the output directory");
    app.add_plugins(
        DefaultPlugins
            .set(crate::assets())
            .set(WindowPlugin { primary_window: None, exit_condition: ExitCondition::DontExit, ..default() })
            .disable::<WinitPlugin>(),
    )
    .add_plugins(ScheduleRunnerPlugin::run_loop(Duration::from_secs_f64(1.0 / 60.0)))
    .insert_resource(Shot { dir, target: Handle::default(), frame: 0 })
    .add_systems(PostStartup, retarget_camera)
    .add_systems(Update, capture);
}

fn retarget_camera(
    mut commands: Commands,
    mut images: ResMut<Assets<Image>>,
    mut shot: ResMut<Shot>,
    camera: Single<Entity, With<Player>>,
) {
    let image = Image::new_target_texture(SIZE.x, SIZE.y, TextureFormat::Rgba8Unorm, Some(TextureFormat::Rgba8UnormSrgb));
    shot.target = images.add(image);
    // Dropping `Player` stops the walking systems from moving the camera.
    commands.entity(*camera).remove::<Player>().insert((RenderTarget::Image(shot.target.clone().into()), ShadowLodOrigin));
}

fn capture(
    mut commands: Commands,
    mut shot: ResMut<Shot>,
    mut camera: Single<&mut Transform, With<Camera3d>>,
    mut games: Query<&mut CrtGame>,
    mut exit: MessageWriter<AppExit>,
    model: Res<ModelReady>,
    mut settle: Local<u32>,
) {
    // Nothing to photograph until the model has loaded and its textures have reached the GPU.
    if !model.0 {
        return;
    }
    *settle += 1;
    if *settle < 30 {
        return;
    }
    let view = (shot.frame / FRAMES_PER_VIEW) as usize;
    let phase = shot.frame % FRAMES_PER_VIEW;
    shot.frame += 1;
    let Some((name, eye, aim)) = VIEWS.get(view) else {
        if phase == 10 {
            exit.write(AppExit::Success);
        }
        return;
    };
    **camera = Transform::from_translation(*eye).looking_at(*aim, Vec3::Y);
    if phase == 0 {
        // Put a shell in the air so the tube has something to show.
        for mut game in &mut games {
            game.fire();
        }
    }
    if phase == FRAMES_PER_VIEW - 8 {
        let path = shot.dir.join(format!("{name}.png"));
        commands.spawn(Screenshot::image(shot.target.clone())).observe(save_to_disk(path));
    }
}
