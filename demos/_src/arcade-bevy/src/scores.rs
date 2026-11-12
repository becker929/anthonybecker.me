//! The high score board on the wall: a matrix of small lamps that spells out both games' tables.
//!
//! The tables themselves are kept by the web page's server (worker.js). The page hands them to the
//! game as text through src/pad.rs, and this paints them. A native build has no page, so its board
//! stays empty.

use bevy::{
    asset::RenderAssetUsages,
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat},
};

use crate::{font, pad, room::ROOM_MAX};

/// The board in lamps, and how many pixels of picture each lamp gets.
const LAMPS_W: usize = 208;
const LAMPS_H: usize = 104;
const LAMP_PX: usize = 3;
/// Its size on the wall in metres, and where its centre hangs: on the right-hand wall, facing in.
const BOARD_W: f32 = 2.6;
const BOARD_H: f32 = 1.3;
const BOARD_AT: Vec3 = Vec3::new(ROOM_MAX.x - 0.075, 1.78, 2.6);
/// How many entries of each table fit.
pub const ROWS: usize = 7;

const AMBER: [u8; 3] = [255, 150, 48];
const CREAM: [u8; 3] = [255, 214, 160];
const DIM: [u8; 3] = [150, 84, 26];
/// An unlit lamp still shows a little, so the board reads as lamps and not as a black sheet.
const UNLIT: [u8; 3] = [24, 14, 6];

const TITLES: [&str; 2] = ["TUBE 1947", "BERTIE 1950"];

#[derive(Resource)]
struct Board(Handle<Image>);

pub struct ScoresPlugin;
impl Plugin for ScoresPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, hang_board).add_systems(Update, repaint);
    }
}

fn hang_board(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut images: ResMut<Assets<Image>>,
) {
    let (w, h) = (LAMPS_W * LAMP_PX, LAMPS_H * LAMP_PX);
    let mut data = vec![0u8; w * h * 4];
    paint(&mut data, &[String::new(), String::new()]);
    let picture = images.add(Image::new(
        Extent3d { width: w as u32, height: h as u32, depth_or_array_layers: 1 },
        TextureDimension::D2,
        data,
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::MAIN_WORLD | RenderAssetUsages::RENDER_WORLD,
    ));
    // The board faces into the room from the right-hand wall.
    let facing = Quat::from_rotation_y(-std::f32::consts::FRAC_PI_2);
    commands.spawn((
        Mesh3d(meshes.add(Rectangle::new(BOARD_W, BOARD_H))),
        MeshMaterial3d(materials.add(StandardMaterial {
            base_color: Color::BLACK,
            emissive: LinearRgba::rgb(2.2, 2.2, 2.2),
            emissive_texture: Some(picture.clone()),
            perceptual_roughness: 0.6,
            reflectance: 0.1,
            ..default()
        })),
        Transform::from_translation(BOARD_AT).with_rotation(facing),
    ));
    // A dark steel frame round it, and a backing box so it stands off the wall a little.
    let steel = materials.add(StandardMaterial {
        base_color: Color::srgb(0.20, 0.20, 0.19),
        metallic: 0.8,
        perceptual_roughness: 0.4,
        ..default()
    });
    let rim = 0.065;
    let mut bar = |size: Vec3, offset: Vec3| {
        commands.spawn((
            Mesh3d(meshes.add(Cuboid::from_size(size))),
            MeshMaterial3d(steel.clone()),
            Transform::from_translation(BOARD_AT + offset),
        ));
    };
    // Sizes are (depth into the wall, height, length along the wall).
    bar(Vec3::new(0.07, rim, BOARD_W + rim * 2.0), Vec3::new(0.0, BOARD_H / 2.0 + rim / 2.0, 0.0));
    bar(Vec3::new(0.07, rim, BOARD_W + rim * 2.0), Vec3::new(0.0, -BOARD_H / 2.0 - rim / 2.0, 0.0));
    bar(Vec3::new(0.07, BOARD_H, rim), Vec3::new(0.0, 0.0, BOARD_W / 2.0 + rim / 2.0));
    bar(Vec3::new(0.07, BOARD_H, rim), Vec3::new(0.0, 0.0, -BOARD_W / 2.0 - rim / 2.0));
    bar(Vec3::new(0.02, BOARD_H, BOARD_W), Vec3::new(0.02, 0.0, 0.0));
    // The board's glow on the floor and on whoever stands reading it.
    commands.spawn((
        PointLight { color: Color::srgb(1.0, 0.62, 0.30), intensity: 14_000.0, range: 3.5, ..default() },
        // Close to the face, so the wall round the frame catches a little amber too.
        Transform::from_translation(BOARD_AT + Vec3::new(-0.35, 0.0, 0.0)),
    ));
    commands.insert_resource(Board(picture));
}

/// Paints the board again whenever the page sends new tables.
fn repaint(board: Res<Board>, mut images: ResMut<Assets<Image>>, mut seen: Local<u32>) {
    let (tables, changed) = pad::tables();
    if changed == *seen {
        return;
    }
    if let Some(mut image) = images.get_mut(&board.0) {
        if let Some(data) = image.data.as_mut() {
            paint(data, &tables);
            *seen = changed;
        }
    }
}

/// Lights one lamp. Each is a small bright square with a dark edge, so the lamps stay separate.
fn lamp(data: &mut [u8], x: usize, y: usize, rgb: [u8; 3]) {
    if x >= LAMPS_W || y >= LAMPS_H {
        return;
    }
    let w = LAMPS_W * LAMP_PX;
    for (dy, dx) in [(0, 0), (0, 1), (1, 0), (1, 1)] {
        let o = ((y * LAMP_PX + dy) * w + x * LAMP_PX + dx) * 4;
        data[o..o + 3].copy_from_slice(&rgb);
        data[o + 3] = 255;
    }
}

/// Writes `text` in lamps with its left edge at `x`. Letters the font lacks are left dark.
fn write(data: &mut [u8], text: &str, x: usize, y: usize, rgb: [u8; 3]) {
    for (i, c) in text.chars().enumerate() {
        for (gy, row) in font::glyph(c.to_ascii_uppercase()).iter().enumerate() {
            for gx in (0..5).filter(|gx| row & (0x10 >> gx) != 0) {
                lamp(data, x + i * 6 + gx, y + gy, rgb);
            }
        }
    }
}

fn write_centred(data: &mut [u8], text: &str, cx: usize, y: usize, rgb: [u8; 3]) {
    write(data, text, cx.saturating_sub(text.chars().count() * 3), y, rgb);
}

/// Paints the whole board from the two tables. Each table is a line per entry: name, a tab, score.
fn paint(data: &mut [u8], tables: &[String]) {
    for px in data.chunks_exact_mut(4) {
        px.copy_from_slice(&[0, 0, 0, 255]);
    }
    for y in 0..LAMPS_H {
        for x in 0..LAMPS_W {
            lamp(data, x, y, UNLIT);
        }
    }
    write_centred(data, "HIGH SCORES", LAMPS_W / 2, 6, CREAM);
    for (side, table) in tables.iter().take(2).enumerate() {
        // Each column is sixteen letters wide: place, name, score.
        let x0 = 6 + side * 104;
        write_centred(data, TITLES[side], x0 + 48, 19, CREAM);
        for x in x0..x0 + 96 {
            lamp(data, x, 28, DIM);
        }
        let mut rows = table.lines().filter_map(|line| line.split_once('\t')).take(ROWS).peekable();
        if rows.peek().is_none() {
            write_centred(data, "NO SCORES YET", x0 + 48, 34, DIM);
        }
        for (place, (name, score)) in rows.enumerate() {
            // Rows spread down the whole board, so its foot is not left empty.
            let y = 33 + place * 9;
            let rgb = if place == 0 { CREAM } else { AMBER };
            write(data, &(place + 1).to_string(), x0, y, DIM);
            write(data, &name.chars().take(8).collect::<String>(), x0 + 12, y, rgb);
            // Scores line up on their last digit.
            let score: String = score.chars().filter(char::is_ascii_digit).take(5).collect();
            write(data, &score, x0 + 96 - score.len() * 6, y, rgb);
        }
    }
}
