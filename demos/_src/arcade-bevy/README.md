# CRT Arcade

A walkable arcade room in Bevy 0.20. One cabinet runs the 1947 Cathode-Ray Tube Amusement Device.

The site does not serve this directory (`.assetsignore`). The web build is its own Cloudflare Worker at https://arcade.anthonybecker.me/.

## Web build and deploy

```
./build-web.sh
npx wrangler deploy
```

`build-web.sh` compiles to `wasm32-unknown-unknown` with the `web` profile, runs `wasm-bindgen` and `wasm-opt`, and fills `dist/`. The page is `web/index.html`.
`dist/` is not in git: the binary is about 22 MB, and every site build clones the whole history.
`wrangler.toml` here names the Worker and its hostname. The deploy needs a `wrangler login` on this machine.
The web build draws with WebGL2.
On a touch screen the page draws the controls: the left thumb walks, the right thumb looks, and PLAY, LEAVE and AGAIN appear when the game offers them. At the cabinet the page lays touch targets over the cabinet's own knobs and red button: a finger turns a knob by going round it, and a tap on the button fires. The page passes all of this to the game through the functions in `src/pad.rs`.
Cloudflare refuses any asset over 25 MiB. The script fails if the binary grows past that.

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
| At a cabinet | E to step up. A/D turn the elevation knob (D is clockwise, which lowers the beam), W/S set charge, Space fires. R restarts. E or Esc steps away. |

## Layout

| File | Job |
| --- | --- |
| `src/main.rs` | App setup. |
| `src/room.rs` | Floor, walls, house light, room bounds. |
| `src/player.rs` | First-person controller, collision, the camera move to a cabinet. |
| `src/cabinet.rs` | Cabinet geometry, interaction, knobs, HUD. |
| `src/crt.rs` | The game. It runs on the CPU and paints a texture each frame. |
| `src/pad.rs` | Touch input from the web page. |
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
