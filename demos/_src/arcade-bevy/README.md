# CRT Arcade

A walkable arcade room in Bevy 0.20. One cabinet runs the 1947 Cathode-Ray Tube Amusement Device.

This directory is source only. `.assetsignore` keeps it out of the deployed site.
A web build has not been made yet. It needs the `wasm32-unknown-unknown` target and `wasm-bindgen`, and the game has no touch controls.

## Run

```
cargo run
```

Bevy 0.20.1 asks for Rust 1.97.1 or newer. Run `rustup update` if cargo complains.
The first build takes several minutes.

## Controls

| Where | Keys |
| --- | --- |
| Walking | WASD or arrows to walk, Shift to run, mouse to look. Click to capture the mouse, Esc to free it. |
| At a cabinet | E to step up. A/D set elevation, W/S set charge, Space fires. R restarts. E or Esc steps away. |

## Layout

| File | Job |
| --- | --- |
| `src/main.rs` | App setup. |
| `src/room.rs` | Floor, walls, house light, room bounds. |
| `src/player.rs` | First-person controller, collision, the camera move to a cabinet. |
| `src/cabinet.rs` | Cabinet geometry, interaction, knobs, HUD. |
| `src/crt.rs` | The game. It runs on the CPU and paints a texture each frame. |
| `src/font.rs` | A 5x7 bitmap font for the marquee. |
| `src/shot.rs` | Headless capture to PNG. |

## Adding cabinets

Add entries to `CABINETS` in `src/cabinet.rs`. Each entry is a floor position and a yaw.
Every cabinet owns its own `CrtGame` and screen texture, so they run independently.
To add a different game, give the cabinet a different game component and a system that paints its `CrtScreen` texture.

## Headless capture

```
cargo run -- --shot shots
```

This renders three fixed views to `shots/*.png` with no window. It needs a Vulkan driver; a software one such as lavapipe works.

## Notes

- Audio and gamepad features are off to keep the build light. Add `"audio"` or `"bevy_gilrs"` to the Bevy features in `Cargo.toml` to turn them on.
- On Linux without Wayland development files, remove `"wayland"` from the features.
