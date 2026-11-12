# Bertie the Brain

The arcade's second machine: a homage to the noughts-and-crosses computer Josef Kates built for the 1950 Canadian National Exhibition.
This is a first version. It is not wired into the game yet. Everything here was added as new files; no existing file was changed.

## What was built

| File | Job |
| --- | --- |
| `src/bertie.rs` | The game. Plain Rust with no Bevy types, and its own unit tests. The sources on the real machine are listed at its top. |
| `src/bertie_machine.rs` | The Bevy side: `BertiePlugin`, the model's working parts, lamps, keys, signs, keyboard, HUD line. |
| `blender/bertie.py` | Builds the model. `<bpy venv>/bin/python blender/bertie.py`; add `--preview out.png` for a quick render. |
| `assets/bertie.glb` | The model. 227,480 bytes, 7,288 triangles, 43 nodes, 12 materials, one 1024 px walnut texture. |

What the homage keeps from the real machine: a tall upright board of nine squares, each with an X lamp and an O lamp; the machine plays X and the visitor O; a sign either side says whose turn it is ("ELECTRONIC BRAIN X", "HUMAN BRAIN O"), each with a "WIN" lamp; nine lit keys in a three by three grid on a raised deck; a difficulty that can be turned down so visitors win.
What it changes: it is 3.0 m tall, not 4, to fit under the 3.2 m ceiling. It is walnut and steel to match the first cabinet; the real one was metal. The dial is on the deck for the player; on the real one Kates set it. A "DRAW" lamp, the row of small bulbs and the reset button are inventions.

## The game (`src/bertie.rs`)

- `BertieGame::new(seed)`, `press(cell) -> bool`, `step(dt)`, `reset()`, `start(player_opens)`.
- `mark(cell)` is what a square holds. `lamp(cell)` is which lamp is lit now: the same, except that the winning three flash.
- `key_lit(cell)`, `signs() -> Signs { player, machine, win, lose, draw }`, `winning_line()`, `phase()`, `over()`.
- `level()`, `set_level(0..=4)`, `turn_dial(notches)`. Level 4 plays perfectly. Below it the machine sometimes plays any free square: 85%, 55%, 30% and 12% of its moves at levels 0 to 3. It starts at level 2.
- `events` is a bitfield the owner reads and clears: `EV_KEY` 1, `EV_LAMP` 2, `EV_WIN` 4, `EV_LOSE` 8, `EV_DRAW` 16, `EV_RESET` 32, `EV_REFUSED` 64, `EV_DIAL` 128.
- `wins`, `losses`, `draws` count games since switch-on.
- The machine pauses 0.7 s before its lamp comes on. The real one answered at once.
- The player opens the first game. Each `reset()` hands the opening to the other side.

## The model (`assets/bertie.glb`)

It stands at its own origin facing +Z, in game coordinates (metres, Y up). Overall box: x -0.806 to 0.806, y 0 to 2.992, z -0.425 to 0.669.
Cell 0 is top left as the player sees it, then row by row. Left is -X.

| Node | min (x, y, z) | max (x, y, z) | Notes |
| --- | --- | --- | --- |
| `Lamp_X_0` | -0.398, 2.282, 0.104 | -0.202, 2.478, 0.132 | Two crossed tubes. Origin at the square's centre. |
| `Lamp_X_4` | -0.098, 1.982, 0.104 | 0.098, 2.178, 0.132 | Squares are 0.30 m apart, centred on (0, 2.08). |
| `Lamp_X_8` | 0.202, 1.682, 0.104 | 0.398, 1.878, 0.132 | |
| `Lamp_O_0` | -0.402, 2.278, 0.124 | -0.198, 2.482, 0.148 | A ring of tube, 18 mm in front of the X. |
| `Lamp_O_4` | -0.102, 1.978, 0.124 | 0.102, 2.182, 0.148 | |
| `Lamp_O_8` | 0.198, 1.678, 0.124 | 0.402, 1.882, 0.148 | |
| `Key_0` | -0.134, 1.046, 0.281 | -0.056, 1.088, 0.362 | Far left key. Keys are 0.095 m apart. |
| `Key_4` | -0.039, 1.018, 0.372 | 0.039, 1.060, 0.452 | |
| `Key_8` | 0.056, 0.990, 0.463 | 0.134, 1.032, 0.543 | Near right key. |
| `Sign_Machine` | -0.725, 2.150, 0.120 | -0.525, 2.450, 0.120 | Left of the board. Flat panel, UVs 0 to 1. |
| `Sign_Lose` | -0.725, 1.870, 0.120 | -0.525, 2.010, 0.120 | The machine's "WIN" lamp, under its sign. |
| `Sign_Player` | 0.525, 2.150, 0.120 | 0.725, 2.450, 0.120 | Right of the board. |
| `Sign_Win` | 0.525, 1.870, 0.120 | 0.725, 2.010, 0.120 | The player's "WIN" lamp. |
| `Sign_Draw` | -0.200, 1.450, 0.120 | 0.200, 1.550, 0.120 | Under the board. |
| `Marquee_Bertie` | -0.710, 2.680, 0.152 | 0.710, 2.920, 0.152 | The name board. The game paints it. |
| `Dial_Difficulty` | 0.390, 1.000, 0.287 | 0.550, 1.145, 0.510 | On the deck, right. Turns about its own Y. |
| `Button_Reset` | -0.530, 1.006, 0.350 | -0.410, 1.103, 0.484 | On the deck, left. Sinks along its own Y. |

The other lamps and keys follow the same grid. `blender/bertie.py` prints the full table every time it runs.
The keys, dial and button are children of `Bertie_Deck`, an empty at (0, 1.00, 0.40) tilted 0.30 rad, the same as the first cabinet's deck.
Every lamp, key and sign has exactly one material, so repainting all of a node's meshes is safe. The dial and button have three and are only moved.
Scenery is `Bertie_wood`, `Bertie_steel`, `Bertie_black`, `Bertie_glow`, `Bertie_pip`, `Bertie_bulb`, `Bertie_bulb_on`.

## Keyboard

Only while the player stands at Bertie.

| Key | Does |
| --- | --- |
| 1 to 9 | Press a key. They read like a page: 1 is top left, 9 is bottom right. |
| Numpad 1 to 9 | Press a key. Laid out as the board is: numpad 7 is top left, numpad 3 is bottom right. |
| R | New game, at any time. |
| [ and ] | Dial one notch easier or harder. |
| E, Escape | Step up and step away, through the first cabinet's code. |

## Wiring it in

Every place in `src/bertie_machine.rs` that needs a hand is marked `// WIRE:`. With only step 1 and step 2 done it should already play from the keyboard.

1. `src/main.rs`: add `mod bertie;` and `mod bertie_machine;`, and add `bertie_machine::BertiePlugin` to the `add_plugins` tuple after `cabinet::CabinetPlugin`. Without `mod bertie_machine` in use, `cargo check` will warn that `over` or others are unused.
2. `build-web.sh`: after the line that copies `arcade.glb`, add `cp assets/bertie.glb dist/assets/`.
3. Placement: `BERTIE_AT` and `BERTIE_YAW` at the top of `src/bertie_machine.rs`. It is at (2.0, 0, 0) facing +Z for now, to the right of the first cabinet. It needs 1.62 m of wall and about 2.1 m in front for the seat.
4. Focus and stepping up. Bertie's root carries `cabinet::Cabinet`, borrowed so that `interact` in `src/cabinet.rs` and `Focus` work as they stand. Two stand-in systems in `PostUpdate` then correct what `src/player.rs` gets wrong for a wider, taller machine:
   - `keep_out` repeats `walk`'s push-out with Bertie's footprint (centre z 0.12, half size 0.81 by 0.55).
   - `take_seat` overrides `place_camera` with Bertie's seat: eye (0, 1.62, 2.05), aim (0, 1.86, 0.10) in the machine's space. From there the keys and the whole board are in view at the 68 degree field of view.

   The proper fix is a per-machine seat and footprint in `src/player.rs` (a component on the root, say). Then delete `keep_out`, `take_seat`, `Seat`, and the borrowed `Cabinet`.
5. HUD and page state. `update_hud` in `src/cabinet.rs` does not know Bertie, so while Bertie is played it shows "E  play" and publishes `STATE_IN_REACH` only. Bertie's own HUD line sits above it (`BertieHud`, 64 px from the bottom). Fold it into `update_hud`, and publish `STATE_PLAYING`, and `STATE_OVER` when `game.over().is_some()`, so the page shows LEAVE and AGAIN. `play` already resets on `pad::RESTART`.
6. Touch. `touch_presses` returns 0 for now. `src/pad.rs` needs a way to carry nine key taps (a `keys: u16` on `Pad`, filled by a `pad_key(cell)` export, would do) and a dial control. `touch_points` returns the screen positions of the nine keys, the dial and the reset button, but nothing calls it: `pad::publish_points` holds three points only. `web/index.html` then needs nine tap targets over those points.
7. Sounds. `report_sounds` calls `pad::sound(events << 11)`, so the bits follow the first cabinet's eleven. In `src/pad.rs` add:

   ```rust
   pub const SOUND_BERTIE_KEY: u32 = 1 << 11;
   pub const SOUND_BERTIE_LAMP: u32 = 1 << 12;
   pub const SOUND_BERTIE_WIN: u32 = 1 << 13;
   pub const SOUND_BERTIE_LOSE: u32 = 1 << 14;
   pub const SOUND_BERTIE_DRAW: u32 = 1 << 15;
   pub const SOUND_BERTIE_RESET: u32 = 1 << 16;
   pub const SOUND_BERTIE_REFUSED: u32 = 1 << 17;
   pub const SOUND_BERTIE_DIAL: u32 = 1 << 18;
   ```

   In `web/index.html` append to `EVENTS`, in this order: `'bertie-key', 'bertie-lamp', 'bertie-win', 'bertie-lose', 'bertie-draw', 'bertie-reset', 'bertie-refused', 'bertie-dial'`, and add the files to `sounds/sounds.json`. Until then the page ignores the new bits. The dial could reuse `notch` and a refused key `dud`.
8. Optional. `src/font.rs` lacks L, W and X, so `extra_glyph` in `src/bertie_machine.rs` carries them. `src/shot.rs` has no view of Bertie; one from (2.0, 1.62, 2.05) toward (2.0, 1.86, 0.10) is the seat. In shot mode the camera has no `Player`, so `keep_out` and `take_seat` do not run, like the first cabinet's HUD.

## Verified

- Game: `rustc --edition 2024 --test src/bertie.rs` then run it: 12 tests pass. They cover: perfect play never loses over every line of play and every best reply, whoever opens; the same through the real state machine for 39 seeds; a careful player wins more than half of 200 games at level 0 and never loses; each notch is harder than the last; win and draw detection and all eight lines; illegal presses change nothing; reset, the flashing line, and the dial's stops.
- Bevy side: `cargo check` passes with no warnings in a scratch crate outside the repo (`/private/tmp/claude-501/bertie-scratch`) that includes every file in `src/` by `#[path]` and adds `BertiePlugin` to the app, against the lock file's Bevy 0.20.1.
- Model: node names, parents, bounding boxes and triangle counts checked by numbers, in Blender and again by reading the exported file. One Cycles preview render looked right: the board, signs, keypad, dial and button are where the table says.

## Not verified

- The game has never been run with Bertie in it. Nothing was built beyond `cargo check`, to save disk. So these are unseen: that the lamps repaint and hide as intended, the lamp and sign brightness under the room's bloom, that the sign pictures are the right way up and fit, the seat view, the camera's handover between `place_camera` and `take_seat`, and the board light's strength.
- The web build, touch, and sounds.
- How it looks beside the first cabinet. The walnut is the same recipe, baked again, so the room now loads two copies of that texture.
