# Bertie the Brain

The arcade's second machine: a homage to the noughts-and-crosses computer Josef Kates built for the 1950 Canadian National Exhibition.
This is a first version. It is not wired into the game yet. Everything here was added as new files; no existing file was changed.

## What was built

| File | Job |
| --- | --- |
| `src/bertie.rs` | The game. Plain Rust with no Bevy types, and its own unit tests. The sources on the real machine are listed at its top. |
| `src/bertie_machine.rs` | The Bevy side: `BertiePlugin`, the model's working parts, lamps, keys, signs, keyboard, HUD line. |
| `blender/bertie.py` | Builds the model. `<bpy venv>/bin/python blender/bertie.py`; add `--preview out.png` for a quick render. |
| `assets/bertie.glb` | The model. See "The model" below for its size and parts. |
| `blender/bertie_textures.py` | Makes Bertie's own textures from the generated pictures. |
| `assets/ART-bertie.md` | Which generated image each texture came from. |

What the homage keeps from the real machine: a tall upright board of nine squares, each with an X lamp and an O lamp; the machine plays X and the visitor O; a sign either side says whose turn it is ("ELECTRONIC BRAIN X", "HUMAN BRAIN O"), each with a "WIN" lamp; nine lit keys in a three by three grid on a raised deck; a difficulty that can be turned down so visitors win.
What it changes: it is 2.75 m tall, not 4, to stand clear of the 3.2 m ceiling. It is walnut and steel to match the first cabinet; the real one was metal. The dial is on the deck for the player; on the real one Kates set it. A "DRAW" lamp, the row of small bulbs and the reset button are inventions.

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

After the art pass (12 November 2026). It stands at its own origin facing +Z, in game coordinates (metres, Y up).
Overall box: x -0.828 to 0.828, y 0 to 2.750, z -0.420 to 0.671. 769,812 bytes with its textures inside, 8,254 triangles, 47 nodes.
Cell 0 is top left as the player sees it, then row by row. Left is -X.

| Node | min (x, y, z) | max (x, y, z) | Notes |
| --- | --- | --- | --- |
| `Lamp_X_0` | -0.333, 1.967, 0.106 | -0.167, 2.133, 0.118 | A flat glass cross. Origin at the square's centre. |
| `Lamp_X_4` | -0.083, 1.717, 0.106 | 0.083, 1.883, 0.118 | Squares are 0.25 m apart, centred on (0, 1.80). |
| `Lamp_X_8` | 0.167, 1.467, 0.106 | 0.333, 1.633, 0.118 | |
| `Lamp_O_0` | -0.345, 1.955, 0.127 | -0.155, 2.145, 0.153 | A ring of glass tube, 3 cm in front of the cross. |
| `Lamp_O_4` | -0.095, 1.705, 0.127 | 0.095, 1.895, 0.153 | |
| `Lamp_O_8` | 0.155, 1.455, 0.127 | 0.345, 1.645, 0.153 | |
| `Key_0` | -0.236, 1.212, 0.236 | -0.094, 1.325, 0.369 | Far left key. Caps are 0.142 m, 0.165 m apart, 0.034 m tall. |
| `Key_4` | -0.071, 1.112, 0.367 | 0.071, 1.225, 0.501 | |
| `Key_8` | 0.094, 1.012, 0.498 | 0.236, 1.125, 0.632 | Near right key. |
| `Sign_Machine` | -0.737, 1.765, 0.122 | -0.437, 2.215, 0.122 | Left of the board. Flat panel, UVs 0 to 1. 0.30 by 0.45 m, the same 2:3 as before. |
| `Sign_Lose` | -0.737, 1.480, 0.122 | -0.437, 1.690, 0.122 | The machine's "WIN" lamp, under its sign. 0.30 by 0.21 m. |
| `Sign_Player` | 0.437, 1.765, 0.122 | 0.737, 2.215, 0.122 | Right of the board. |
| `Sign_Win` | 0.437, 1.480, 0.122 | 0.737, 1.690, 0.122 | The player's "WIN" lamp. |
| `Sign_Draw` | -0.200, 2.245, 0.122 | 0.200, 2.345, 0.122 | Now over the board, between the two banks of bulbs. 4:1 as before. |
| `Marquee_Bertie` | -0.750, 2.403, 0.152 | 0.750, 2.657, 0.152 | The name board. 1.50 by 0.254 m, UVs 0 to 1. It now carries its own lit picture. |
| `Dial_Difficulty` | 0.444, 1.090, 0.375 | 0.596, 1.264, 0.573 | On the deck, right. Turns about its own Y. Its base ring is scenery. |
| `Button_Reset` | -0.594, 1.090, 0.387 | -0.446, 1.247, 0.557 | On the deck, left. Sinks along its own Y. Its collar is scenery. |

The other lamps and keys follow the same grid. `blender/bertie.py` prints the full table every time it runs, with each part's place in the seat view.
The keys, dial and button are children of `Bertie_Deck`, an empty at (0, 1.15, 0.42) tilted 0.65 rad. The console is steeper and closer under the board than the first cabinet's deck.
Every lamp, key and sign has exactly one material and one primitive. The dial and button have several and are only moved.
Scenery is one mesh per material: `Bertie_wood`, `Bertie_steel`, `Bertie_black`, `Bertie_bakelite`, `Bertie_glow`, `Bertie_pip`, `Bertie_glass`, `Bertie_parts`, `Bertie_bulb`, `Bertie_bulb_on`, `Bertie_bulb_red`.

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

## The art pass (12 November 2026)

Steps 2 (fixes), 3, 4 and 5 of PROCESS.md. Wall: https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=arcade-bertie-1

### Step 2: greybox faults fixed

1. Keys. Caps went from 0.078 m to 0.142 m, on a 0.165 m pitch, with a black well round each. The console is now steep (0.65 rad) and close under the board, so the keys face the player. From the proposed seat a cap is 62 to 83 px wide at 1280 by 720: 4.8% to 6.5% of the width, and the pitch is 5.6% to 7.4%. The far row is the small one. They were about 3%.
2. Lamps. The X is a flat glass cross lying on the pane; the O is a round tube ring standing 3 cm in front. Behind both is a frosted pane with a dark bulb, which is scenery and always seen. As exported, the X and O have pale frosted glass materials with a faint glow. The game still replaces them with its own near-black material; see "Code changes asked for".
3. Height. 2.75 m, 0.45 m under the ceiling.
4. Signs. The side signs are 0.30 m wide, not 0.20, and the seat is nearer, so a sign is 112 px wide in the seat view; it was about 55. That doubles the captions without touching the pictures. The two sides have the same frame and backing. Their colour and brightness are the game's; see below.
5. Labels. A "NEW GAME" plate under the plunger, a "DIFFICULTY" plate under the dial, and the numbers 1 to 5 on small steel tags round the dial, at the game's notch angles (0.6 rad apart, 1 on the left). All are in the atlas.
6. Seat. Proposed: eye (0, 1.52, 1.575), aim (0, 1.49, 0.10), 68 degrees. The deck's front lip is about 40 to 60 px above the bottom of the frame, the draw sign is 42 px below the top, and the marquee is out of view above. `SEAT_EYE` and `SEAT_AIM` at the top of `blender/bertie.py` hold the same numbers, and its table prints each part's pixels from that seat.

The layout moved to make this work: the board is centred on y 1.80 (it was 2.08) with squares 0.25 m apart, the draw sign went above the board, and the bulbs became two banks beside it.

### Step 3: wireframe

```
~/_agent_scratch/ringbench/.bpy/bin/python blender/bertie.py --lines reference
```

Writes `reference/bertie_seat_lines.png` and `_depth.png` (1024 by 576, the seat) and `reference/bertie_hero_lines.png` and `_depth.png` (768 by 1024, from (-1.75, 1.62, 3.1) toward (0, 1.38, 0.10)). Near is white. Freestyle finds no strokes in this headless build, so the lines are drawn where a depth pass jumps or a normal pass turns, as `blender/lines.py` on the look branch does. It takes about 100 s. The committed drawings are of the greybox as it was given to Gemini; trims were thinned afterwards.

### Step 4: Gemini

All through the wrapper, batch `arcade-bertie-1`. Nine calls made seven images.

```
cd ~/Desktop/zpkt/contrib/harness
uv run harness images batch jobs.json --context "..." --batch arcade-bertie-1 --parallel 4
```

Target pictures: inputs were the owner's picture of the first cabinet, then the line drawing. The prompt that worked, for the seat (the hero differs only in its first sentence and in naming the marquee and grille):

> Photograph from where the player stands, looking straight at an early electronic game machine in a small dark arcade room: the lamp board above, the console and its keys below. Use the first image only for materials, colour and light: dark walnut veneer with fine straight grain and a satin sheen, brushed steel edging with hairline lines of warm light set into it, milky domed controls on steel collars, navy wall panels, a polished concrete floor with warm cove light at the foot of the walls, soft filmic light, shallow depth of field. Use the second image, a line drawing, for the exact layout, proportions and camera: keep every part where the drawing puts it and add no parts. The machine is a 1950 exhibition tic-tac-toe computer, a tall walnut and steel monolith. Its board is a three by three grid of square recessed lamp housings in a deep brushed-steel frame with steel bars between the squares. Behind each square is frosted glass with a dark bulb; on it lie a flat glass cross (X) and, in front, a fat glass ring (O). Two squares show only a cross glowing amber, two show only a ring glowing warm white, and the rest are unlit: frosted glass, faintly visible, not black. Left and right of the grid are backlit sign panels in steel frames, one amber and lit, one dark. In front is a steep walnut console with a steel edge: nine large square keys of milky lucite in a three by three block on a steel plate, with black gaps between them, softly lit from inside; on the left a fat round mushroom plunger button in dim red on a steel collar with a small engraved plate under it; on the right a chunky fluted black bakelite dial with a cream pointer bar, five small engraved numbers round it and a small engraved plate under it. Above the board is a row of small indicator bulbs, a few lit, either side of a small dark sign. No people, no joystick, no screen, no coin slot, no modern LEDs, no extra text or logos.

- Seat B (`20261112-205926-76ce92`, with "Close attention to the surfaces..." added) kept the layout exactly and is the target. Seat A is close behind.
- Hero A (`20261112-205920-e1fe51`) is the target for the marquee, the lower body and the trim. Both heroes enlarged the board and dropped the side signs. Saying which two lit signs flank the grid was not enough from that angle.
- Naming the two inputs' jobs ("first image only for materials", "second image for layout") is what held the shape. Telling it what the unlit squares look like stopped it lighting all nine.

Textures:

- Marquee face, 21:9, worked first time: "Flat, straight-on orthographic texture of a backlit amber glass sign panel ... One single line of dark brown-black condensed sign-writer block capitals reads exactly: BERTIE THE BRAIN ... the letters are small, about one fifth of the image height, with plain amber glass above and below". The lettering came out right. Asking for small letters left room to cut the 5.9:1 band the board needs.
- Key cap, 1:1, worked first time: "One large square push-button key cap ... seen exactly from above, orthographic, filling almost the whole frame, on a plain pure black background. Thick milky cream-white lucite ..."
- Lamp glass failed twice with `IMAGE_RECITATION` and no image. The failed prompt began "Seamless tiling texture, top-down orthographic, evenly lit with no vignette and no shadows: pale frosted pressed glass from a 1950 lamp housing". Asking for a photograph of one thing worked: "Close-up photograph, straight on, of a pane of frosted glass in front of an unlit lamp in a 1950 exhibition machine. The pane fills the whole picture ..." It drew the dark bulb behind the glass unasked, which is what the squares needed.
- The label plates were not generated. `bertie_textures.py` draws them, so the words are exact.

```
~/_agent_scratch/ringbench/.bpy/bin/python blender/bertie_textures.py
```

### Step 5: Blender

```
~/_agent_scratch/ringbench/.bpy/bin/python blender/bertie.py
~/_agent_scratch/ringbench/.bpy/bin/python blender/bertie.py --preview /tmp/seat.png
~/_agent_scratch/ringbench/.bpy/bin/python blender/bertie.py --preview /tmp/hero.png --view hero
~/_agent_scratch/ringbench/.bpy/bin/python blender/bertie.py --room-steel
```

- Walnut: the room's shared texture at the first cabinet's scale, one repeat in 0.70 m, with its roughness and grain relief maps. Grain stands on the side panels and the lower front and runs across the fascia and the deck, as in the owner's picture. Each piece starts at a different place in the picture.
- Steel: the room's brushed steel, one repeat in 0.25 m, brushed along every strip and round every turned part. Trims are thin: 30 mm round the board, 10 mm round the signs, 12 mm edging on the side panels.
- Frames are mitred with a sloped inner face, so the board and signs sit in bezels that catch light.
- Hairlines of warm light run down the side panels' edging, along both sides and the front of the deck, round the keypad and round the board.
- Keys are 34 mm tall caps with cut corners and a chamfer, each in a black well between steel webs. The dial is a fluted black knob with a cream pointer bar that reaches the numbers and a lit line on its spine. The plunger is a deep red mushroom on a stepped steel collar.
- The preview (Cycles, 48 samples, about 11 s) is for checking the model only. Its lights are a guess at the room's.

Lighting is left to the game at runtime. The look branch has baked lightmaps for the first cabinet and the room in its code, but no LOOK_NOTES.md when this was done, and its bake needs the room's scene. Bertie has no second UV set and no lightmap. Its steel is 0.8 metal so it does not go black without the look branch's reflection cube; `--room-steel` builds it as full metal with the shared roughness map, to match the first cabinet once the cube is merged.

### Code changes asked for

None of these is needed to load the model. Node names, parents and axes are unchanged.

1. Seat: `SEAT_EYE = (0.0, 1.52, 1.575)`, `SEAT_AIM = (0.0, 1.49, 0.10)`. The view in `src/shot.rs` moves the same way.
2. Footprint: `BODY_CENTRE = (0.0, 0.125)`, `BODY_HALF = (0.83, 0.55)`.
3. Unlit lamps: the game paints unlit X and O lamps `srgb(0.05, 0.045, 0.04)`, which hides the fix. Use the material each lamp came with as its unlit look, and a copy of it with a strong `emissive` as its lit look (keep its `emissive_texture`, so lit glass keeps its grain). The same for the keys, so the cap picture shows.
4. Marquee: drop the `"Marquee_Bertie"` branch in `wire_model`, so the model's own lit name board shows.
5. Travel: `KEY_TRAVEL = 0.014`, `RESET_TRAVEL = 0.020`. The caps stand 22 mm above their wells and the plunger 20 mm above its collar.
6. Warmth: `CREAM` to about (255, 196, 128). Unlit signs at one brightness whatever their tint: 0.035 for amber and 0.024 for that cream, which have the same luminance. Lit keys at about `rgb(1.3, 1.0, 0.68)` rather than (2.6, 2.2, 1.7).
7. The dial's ticks are at radius 0.118 m and its numbers at 0.156 m, at `(level - 2) * 0.6` rad clockwise from up the deck, as `DIAL_STEP` has it.

### Checked, and not

- By numbers: every named node present, one primitive each for lamps, keys and signs, the deck's eleven children, bounding boxes, each part's pixels from the seat, file and texture sizes, tangents on the wood.
- By eye: Cycles previews of the seat and the hero view, compared with the target pictures by a reviewing agent twice and looked at directly twice.
- Not checked: anything in the game. No cargo build was run. Unseen: the model under the game's lights and bloom, the normal map and the `KHR_materials_emissive_strength` values in Bevy, the proposed seat on a phone, and the label plates' legibility at phone size (a plate is about 80 px wide in the 1280 px seat view).

### Still weak

- Unlit squares show a ring over a cross in every square. They are pale glass now, not black, but the target picture's unlit squares are plain panes.
- The walnut is the shared texture. A reviewer found it redder, finer and flatter than the target's broad figure. Changing it is the look branch's call.
- No baked light: no contact shadows under the keys, in the bezels or under the console.
- Edges are sharp. Nothing is rounded except the turned parts.
- The far row of keys is 4.8% to 5.1% of the view's width, under the 6% asked.

### For the next machine

- `blender/bertie.py --lines` and `--preview` work for any model built the same way: copy `camera`, `flat`, `lines`, `preview` and `seat_pixels`.
- Print each part's seat-view pixels in the build's table. It settled the layout before any picture was made.
- Give Gemini the style picture first and the drawing second, and say which is for what.
- Ask for a photograph of one object, not a "seamless texture", when a texture prompt is refused.
- Draw words yourself. Generate the blank material.
- One atlas for a machine's small parts (`ATLAS` in both scripts), tinted per material by the base colour factor.
- `add_bevel_frame` for any bezel, `wood_uv` with a grain direction per piece, `steel_uv` along the longest edge.
- Keep collars and base rings as scenery, so only the moving part moves.
