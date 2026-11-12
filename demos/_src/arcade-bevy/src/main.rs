//! A walkable arcade room with the 1947 Cathode-Ray Tube Amusement Device.

mod cabinet;
mod crt;
mod font;
mod player;
mod room;
mod shot;

use bevy::prelude::*;

fn main() {
    let mut app = App::new();
    app.insert_resource(ClearColor(Color::BLACK));
    if let Some(dir) = shot::requested() {
        shot::add_headless(&mut app, dir);
    } else {
        app.add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window { title: "Cathode-Ray Tube Amusement Device".into(), ..default() }),
            ..default()
        }));
    }
    app.add_plugins((room::RoomPlugin, player::PlayerPlugin, cabinet::CabinetPlugin)).run();
}
