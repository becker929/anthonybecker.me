# CRT Arcade

A walkable arcade room in Bevy 0.20. `PROCESS.md` is how a machine gets into it. One cabinet runs the 1947 Cathode-Ray Tube Amusement Device.
The cabinet and the room are a model built in Blender; the game loads it and brings its named parts to life.

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
On a touch screen the page draws the controls: the left thumb walks, the right thumb looks, and PLAY, LEAVE and AGAIN appear when the game offers them. At the cabinet each half of the screen is one knob: a thumb sliding on the left turns elevation, on the right charge. Up is always more; sideways follows the knob, so right is clockwise. The slide's length is what counts, so a straight line, a diagonal and a thumb's arc all turn it smoothly. The cabinet's red button takes taps. On screens with more than two device pixels per CSS pixel the page lays the canvas out smaller and scales it up, so the game draws at two. The page passes all of this to the game through the functions in `src/pad.rs`.
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
| `src/room.rs` | Room bounds and lights. |
| `src/player.rs` | First-person controller, collision, the camera move to a cabinet. |
| `src/cabinet.rs` | Loads the model, wires its parts, interaction, knobs, HUD. |
| `blender/build.py` | Builds the model, `assets/arcade.glb`. |
| `src/crt.rs` | The game. It runs on the CPU and paints a texture each frame. |
| `src/pad.rs` | Touch input from the web page. |
| `src/font.rs` | A 5x7 bitmap font for the marquee. |
| `src/shot.rs` | Headless capture to PNG. |

## The model

`blender/build.py` builds the cabinet and the room and writes `assets/arcade.glb`. Run it with Blender's Python module (`bpy`), not the app:

```
<bpy venv>/bin/python blender/build.py
```

The script is written in the game's coordinates: metres, Y up, the cabinet at the origin facing +Z.
The wood and the concrete are procedural textures baked to images. Everything else is flat materials.
The game finds these parts by name and gives them behaviour in `src/cabinet.rs`: `Screen`, `Marquee`, `Knob_Elevation`, `Knob_Charge`, `Button_Fire`. Scenery is joined into one mesh per material.
The game has no reflections, so the look leans on painted light: the warm wash by the walls (`src/room.rs`) and the sheen on the tube (`src/crt.rs`).

## Controls that clunk

The game puts no words on the screen. The score is marks on the tube: a tick per shell left, a pip per wave cleared. The page shows key prompts and touch buttons.
The knobs move in notches (2.5 degrees of elevation, 5% of charge). The drawn knob springs to each notch and overshoots a little. The fire button drops fast and returns slowly.
The game reports what happened as bits (`SOUND_` in `src/pad.rs`): a notch, a shot, a hit and so on. The web page plays a recorded file for each, from `sounds/sounds.json`, and buzzes a phone that can vibrate. The files are built by `sound/make.py` from recorded samples (see `sound/README.md`) into `sound/out/`, which is not in git; `build-web.sh` ships them. With no sound files the page stays silent.

## Headless capture

```
cargo run -- --shot shots
```

This renders four fixed views to `shots/*.png` with no window. It needs a Vulkan driver; a software one such as lavapipe works.

## Notes

- Audio and gamepad features are off to keep the build light. Add `"audio"` or `"bevy_gilrs"` to the Bevy features in `Cargo.toml` to turn them on.
- On Linux without Wayland development files, remove `"wayland"` from the features.
