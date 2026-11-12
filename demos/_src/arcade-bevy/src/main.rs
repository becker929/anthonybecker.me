//! A walkable arcade room with the 1947 Cathode-Ray Tube Amusement Device.

mod bertie;
mod bertie_machine;
mod cabinet;
mod crt;
mod font;
mod nimrod;
mod nimrod_machine;
mod pad;
mod player;
mod room;
mod scores;
#[cfg(not(target_arch = "wasm32"))]
mod shot;

use bevy::prelude::*;

fn main() {
    let mut app = App::new();
    app.insert_resource(ClearColor(Color::BLACK));
    #[cfg(not(target_arch = "wasm32"))]
    let shot_dir = shot::requested();
    #[cfg(target_arch = "wasm32")]
    let shot_dir: Option<std::path::PathBuf> = None;
    if let Some(dir) = shot_dir {
        #[cfg(not(target_arch = "wasm32"))]
        shot::add_headless(&mut app, dir);
        #[cfg(target_arch = "wasm32")]
        let _ = dir;
    } else {
        app.add_plugins(DefaultPlugins.set(assets()).set(WindowPlugin {
            primary_window: Some(Window {
                title: "Cathode-Ray Tube Amusement Device".into(),
                // On the web the game draws into the page's canvas and fills it.
                canvas: Some("#game".into()),
                fit_canvas_to_parent: true,
                prevent_default_event_handling: true,
                ..default()
            }),
            ..default()
        }));
    }
    app.add_plugins((pad::PadPlugin, room::RoomPlugin, player::PlayerPlugin, cabinet::CabinetPlugin, bertie_machine::BertiePlugin, nimrod_machine::NimrodPlugin, scores::ScoresPlugin)).run();
}

/// The model is fetched as a plain file. There are no `.meta` files beside it to ask for.
pub fn assets() -> bevy::asset::AssetPlugin {
    bevy::asset::AssetPlugin { meta_check: bevy::asset::AssetMetaCheck::Never, ..default() }
}
