# Nimrod

The arcade's third machine: a homage to Nimrod, the Nim-playing computer Ferranti built for the Festival of Britain in 1951.
Steps 1 to 6 and 8 of PROCESS.md are done on branch `claude/arcade-nimrod`; step 7 (the sound files) is listed below for another pass.

## What was built

| File | Job |
| --- | --- |
| `src/nimrod.rs` | The game. Plain Rust with no Bevy types, 15 unit tests. The sources are at its top. |
| `src/nimrod_machine.rs` | The Bevy side: `NimrodPlugin`, lamps, legends, buttons, the switch, the plungers, touch points, sounds, scores. |
| `blender/nimrod.py` | Builds the model. Prints every part's bounding box and its size in the seat view, landscape and upright phone. |
| `blender/nimrod_atlas.py` | Where each picture sits in the parts atlas. Shared by the two scripts below. |
| `blender/nimrod_textures.py` | Makes `blender/tex_nimrod/*.jpg` from the generated pictures, and draws the legends and plates. |
| `assets/nimrod.glb` | The model, 1,132,188 bytes with its textures. |
| `assets/ART-nimrod.md` | Which generated image each texture came from. |
| `reference/nimrod_*` | Line art and depth of the greybox (seat and hero), and the two target pictures. |

Edits to existing files, the smallest that wire it in: `src/main.rs` (two `mod` lines and the plugin), `build-web.sh` (copies `nimrod.glb`), `src/shot.rs` (a `nimrod` view from the seat).

## The real machine, and what the homage keeps

Designed by John Bennett, built by Raymond Stuart-Williams, shown from May 1951 at the Exhibition of Science in South Kensington, then for three weeks from 6 October at the Berlin Industrial Show, where the economics minister Ludwig Erhard lost all three games. 480 valves, 6 kW of which 4 kW lit its lamps, about 12 by 9 by 5 feet.

- **Heaps as lamps.** Four heaps of up to seven "matches", each a row of lamps. The desk had a button under every lamp; pressing one puts out every lamp to its right. A zero button at the left of each row, under a white lamp, empties the row; the white lamps show which heap changed last. Kept exactly.
- **The face.** Three panels: the instructions lit one at a time on the left, the game display in the middle with its stage legends ("OPPONENT'S MOVE", "COMPUTER'S MOVE", "OPPONENT WINS", "COMPUTER WINS"), the registers on the right. Kept, with the registers simplified to each heap's count in binary, the chosen heap, and the parity of each binary column.
- **Its modes.** The simple game (taking the last match wins) and the reverse game (it loses), on a switch. A switch for who starts. COMP. MOVE asked for its move. It could step slowly so a demonstrator could explain each step, and it could play both sides. Kept: the game switch; COMP. MOVE hands it the start; it always steps visibly, about 0.22 s a step, 1 to 1.5 s a move; and it plays itself whenever nobody stands at it, silently.
- **What it was famous for.** Flashing lights that showed a computer thinking, and being very hard to beat. It played the binary strategy, column by column, as here.
- **Changed.** 1.7 m wide, 2.58 m tall, 0.9 m deep, with the desk built on, not 3.7 m with a separate desk. Walnut and steel to match the room, with grey hammered enamel panels for the "tremendous gray refrigerator". The valve window in the lower body, the name board and the plates are inventions.

## The game, and how a visitor wins

- A position is dealt: four heaps, each 1 to 3 matches at first, up to 7 as a run of wins grows (`3 + games won in the run`, at most 7).
- Nobody has moved yet. The visitor chooses who starts: press a heap button to start, or press COMP. MOVE to give the machine the start.
- After that the machine answers every move by itself. The game switch is locked from the first move to the end.
- **The machine is perfect.** From a winning position it never loses (tested over every line of play, both games). From a losing one it takes one match off the first heap, as Nimrod did, and waits for a mistake.
- **A careful visitor wins every game.** Exactly one of "I start" and "it starts" is a winning position for whoever plays perfectly, and the visitor gets to pick. Read the heaps in binary (the right-hand panel shows each heap's 4, 2 and 1). If the columns are all even, press COMP. MOVE; otherwise start, and always leave every column even. In the reverse game, play the same until at most one heap has more than one match, then leave an odd number of single matches. One slip and Nimrod wins. The test `a_careful_visitor_wins_every_game_by_choosing_who_starts` plays 300 games this way and wins all of them; `a_careless_visitor_loses_most_games` loses over 200 of 300.
- After its move the parity lamps hold what it found in the position the visitor handed it: all dark means the visitor had left a safe position.

**Score:** the matches in each starting position won, doubled in the reverse game, added up over games won in a row. A loss, dealing a new game half way through one, or walking away ends the run and reports it, capped at 5000. A fresh deal before anyone has moved costs nothing.

## The model (`assets/nimrod.glb`)

Overall box: x -0.848 to 0.848, y 0 to 2.580, z -0.450 to 0.449. 1,132,188 bytes, 10,628 triangles, 107 nodes, 106 meshes, 18 materials, 8 images.
Machine space: origin on the floor at the middle of the footprint, facing +Z. Left is -X. Heap 0 is the top row.

| Node | min (x, y, z) | max (x, y, z) | Notes |
| --- | --- | --- | --- |
| `Lamp_Match_0_1` | -0.244, 2.036, -0.044 | -0.196, 2.084, -0.027 | Domed glass lens; origin at its foot. Columns 0.088 m apart, `x = (n - 3.5) * 0.088`. |
| `Lamp_Match_0_7` | 0.284, 2.036, -0.044 | 0.332, 2.084, -0.027 | Rows at y 2.06, 1.94, 1.82, 1.70. |
| `Lamp_Match_3_7` | 0.284, 1.676, -0.044 | 0.332, 1.724, -0.027 | |
| `Lamp_Changed_0` | -0.332, 2.036, -0.044 | -0.284, 2.084, -0.027 | White lamp, column 0, behind a thin steel rule. |
| `Lamp_Changed_3` | -0.332, 1.676, -0.044 | -0.284, 1.724, -0.027 | |
| `Lamp_Instr_0` | -0.748, 2.062, -0.044 | -0.712, 2.098, -0.027 | Left panel, 0.08 m apart down to `Lamp_Instr_7` at y 1.52. Each beside an engraved line. |
| `Lamp_Reg_0_4` | 0.515, 2.040, -0.044 | 0.555, 2.080, -0.027 | Registers: columns 4, 2, 1 at x 0.535, 0.605, 0.675, on the heap rows. |
| `Lamp_Reg_3_1` | 0.655, 1.680, -0.044 | 0.695, 1.720, -0.027 | |
| `Lamp_Select_0..3` | 0.736, row - 0.014, -0.044 | 0.764, row + 0.014, -0.027 | Red, right of each register row. |
| `Lamp_Odd_4`, `_2`, `_1` | x as the registers, 1.545 | 1.585 | Red, under the register columns, beside an "ODD" plate. |
| `Legend_OpponentsMove` | -0.335, 1.515, -0.042 | -0.015, 1.595, -0.042 | Flat pane, 0.32 by 0.08 m, words from the atlas. |
| `Legend_ComputersMove` | 0.015, 1.515, -0.042 | 0.335, 1.595, -0.042 | |
| `Legend_OpponentWins` | -0.335, 1.415, -0.042 | -0.015, 1.495, -0.042 | |
| `Legend_ComputerWins` | 0.015, 1.415, -0.042 | 0.335, 1.495, -0.042 | |
| `Key_0_0` | -0.341, 1.080, 0.099 | -0.275, 1.135, 0.170 | Zero button, black. Caps 0.066 m across, 0.026 m tall, in the lamps' columns. |
| `Key_0_7` | 0.275, 1.080, 0.099 | 0.341, 1.135, 0.170 | |
| `Key_3_0` | -0.341, 0.958, 0.323 | -0.275, 1.013, 0.394 | Nearest row. |
| `Key_3_7` | 0.275, 0.958, 0.323 | 0.341, 1.013, 0.394 | |
| `Lever_Game` | -0.280, 1.138, 0.034 | -0.200, 1.249, 0.113 | Exported upright. Swings about its own Z: +0.38 rad (left) simple, -0.38 (right) reverse. |
| `Button_NewGame` | -0.017, 1.122, 0.011 | 0.057, 1.199, 0.099 | Black mushroom. Sinks along its own Y. |
| `Button_CompMove` | 0.196, 1.119, 0.006 | 0.284, 1.211, 0.110 | Fat amber mushroom. Sinks along its own Y. |
| `Marquee_Nimrod` | -0.700, 2.290, 0.002 | 0.700, 2.480, 0.002 | Lit name board, its own texture. Scenery the game leaves alone. |

The keys, lever and plungers are children of `Nimrod_Deck`, an empty at (0, 1.05, 0.20) tilted 0.5 rad. Every lamp, legend and key has one material and one primitive.
Scenery is one mesh per material: `Nimrod_wood`, `_steel`, `_enamel`, `_black`, `_glow`, `_parts`, `_marquee` (the board), `_valve`.
Lamps are exported unlit (smoky tinted glass over the lens picture, emissive 0.04). The game makes a lit copy of each lamp's own material with emissive `colour * strength`, keeping the emissive texture: matches, instructions and registers warm (1.0, 0.45, 0.12) x 5, white lamps (0.80, 0.86, 1.0) x 5, select and odd red (1.0, 0.16, 0.06) x 5, legends warm x 3, key caps warm x 1.6.

`blender/nimrod.py` prints the full table each run, with each part's pixels from the seat in landscape (1280 x 720) and on an upright phone (390 x 844).

## Seat, footprint, placement

- At (-2.3, 0, 0), yaw 0, against the back wall left of the tube cabinet. Left edge x -3.15, right edge -1.45 (the tube cabinet's left edge is -0.42). Back at z -0.45, 0.15 m off the wall.
- Seat: eye (0, 1.55, 1.55), aim (0, 1.56, -0.05). `seat_front` 0.43 (the desk's lip), `seat_half_width` 0.44, so an upright phone steps back to z 1.84.
- Footprint: centre (0, 0), half size (0.85, 0.45).
- Upright phone (390 x 844): every control is at least 6.2% of the width (far row keys); near row keys 7.2%, lever 7.8%, NEW GAME 6.7%, COMP. MOVE 7.9%. The four lamp rows, the white lamps, the legends and the desk are in view. The side panels (instructions and registers) fall partly outside an upright phone's view. The game is playable without them, but a visitor who wants the binary help needs landscape.
- Landscape (1280 x 720): the whole machine from the name board to the desk's lip is in view.

## Keyboard

Only while the player stands at Nimrod.

| Key | Does |
| --- | --- |
| 1 to 4, then 0 to 7 | Choose a heap (its white lamp flashes quickly), then press the button that leaves that many. "3 then 2" leaves two in the third heap. The choice lapses after 4 s; Backspace drops it. Numpad works the same. |
| Space or Enter | COMP. MOVE: give the machine the first move. |
| G | Throw the game switch (simple, reverse). Only before the first move or after the end. |
| R or N | New game: a fresh deal. Half way through a game this gives it up and ends the run. |
| E, Escape | Step up and step away (src/cabinet.rs). |

## Touch points, in order

`publish_points` sends 35 points while Nimrod is focused and `pad.active`. All are taps; the game reads them from `pad.taps`.

| Index | Label | Kind |
| --- | --- | --- |
| 0 to 31 | `heap * 8 + n`: the desk button in heap row `heap` (0 top), column `n` (0 is the zero button, 1 to 7 under the matches). Short label: the number it leaves, "0" to "7" | tap |
| 32 | COMP. MOVE | tap |
| 33 | GAME (the switch: simple or reverse) | tap |
| 34 | NEW GAME | tap |

The page's AGAIN button (`pad::RESTART`) deals a new game too.

Labels for `pad::publish_labels` (not on this branch, so not called; add it in `publish` beside `publish_points`), in index order: `"0"`, `"1"` ... `"7"` for each of the four rows (32 labels), then `"COMP. MOVE"`, `"GAME"`, `"NEW GAME"`.

### What `web/index.html` needs (not edited here)

- A state bit for Nimrod, like `STATE_BERTIE`, so the page knows to offer Nimrod's targets and key prompts. There is no `STATE_NIMROD` in `src/pad.rs`; `publish` sends only `STATE_OVER` (or 0). Suggested: add `pad::STATE_NIMROD` and OR it into the value `publish` sends.
- 35 small tap targets over the points above, sent through `game.pad_key(index)`. The 32 desk buttons sit 0.088 m apart, about 25 to 28 px on an upright phone, so the page's 58 px `.key` targets would overlap; they need to be about 26 px, or the page needs a two-step pick (tap a row, then a button).
- Prompts: `1 – 4 then 0 – 7` press a button, `SPACE` computer starts, `G` game, `R` new game, `E` leave.
- Bertie's `publish` writes `publish_more_state(0)` whenever Bertie is not focused, which can overwrite Nimrod's `STATE_OVER` in the same frame (the brief says this is fixed at merge).

## Sounds (`pad::play`)

Played only while the visitor stands at Nimrod; the machine playing itself is silent.

| Name | When | How it should sound |
| --- | --- | --- |
| `nimrod-press` | A desk button took | A heavy bakelite button bottoming out, then a quick ripple of relay clicks as the lamps to its right go out. |
| `nimrod-refused` | A press out of turn, on a dark lamp's button, COMP. MOVE after the start, or the locked switch | A dull thunk with no relay after it, a button that hits its stop and does nothing. |
| `nimrod-step` | Each step of the machine's work (6 to 8 a move, 0.22 s apart) | One small, crisp relay click with a faint tick of a lamp filament; quiet, as it repeats. |
| `nimrod-move` | The machine's move puts lamps out | A bank of relays dropping together, a clack with a short mechanical tail. |
| `nimrod-win` | The visitor wins | A bright cascade of relays settling, then a low warm hum swell of the lamps; pleased but old. |
| `nimrod-lose` | The machine wins | Two heavy relay clunks and a falling transformer hum, final. |
| `nimrod-deal` | A new position is dealt (and on stepping up) | A rattle of relays as rows of lamps come on, ending in a soft hum. |
| `nimrod-switch` | The game switch is thrown | A big lever toggle snapping over centre: a hard clack with a spring ring. |
| `nimrod-comp` | COMP. MOVE is pressed and taken | A deep plunger press with a soft rubber stop, then the first relay click. |

## Commands run

```
cd ~/_agent_scratch/nimrod/demos/_src/arcade-bevy
rustc --edition 2024 --test src/nimrod.rs -o /private/tmp/claude-501/nimrod-test/t0 && /private/tmp/claude-501/nimrod-test/t0
~/_agent_scratch/ringbench/.bpy/bin/python blender/nimrod.py                                  # greybox, then the model
~/_agent_scratch/ringbench/.bpy/bin/python blender/nimrod.py --preview <out.png> [--view hero]  # Cycles, 48 samples, about 9 s
~/_agent_scratch/ringbench/.bpy/bin/python blender/nimrod.py --lines reference                # about 200 s
cd ~/Desktop/zpkt/contrib/harness && uv run harness images batch jobs1.json --context "Arcade machine 3, Nimrod (1951 Nim computer): target pictures from the greybox line art, then its own textures (enamel, lamp lens, button cap, name board)" --batch arcade-nimrod-1 --parallel 4
~/_agent_scratch/ringbench/.bpy/bin/python blender/nimrod_textures.py
CARGO_TARGET_DIR=~/_agent_scratch/arcade-check-target cargo check
```

The jobs file was in the scratchpad; its prompts are below.

## Gemini (batch `arcade-nimrod-1`, 7 calls, 7 images)

Wall: https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=arcade-nimrod-1

Target pictures. Inputs: the owner's picture, `reference/bertie_target_seat.jpg`, then the line drawing. The prompt that worked (seat A, `20261112-225006-2c90d7`, the target):

> Photograph from where the player stands, looking straight at an early electronic game machine in a small dark arcade room: the lamp panels above, the desk and its buttons below. Use the first two images only for materials, colour and light: dark walnut veneer with fine straight grain and a satin sheen, brushed steel edging with hairline lines of warm light set into it, milky glass lamps and domed controls on steel collars, navy wall panels, a polished concrete floor with warm cove light at the foot of the walls, soft filmic light, shallow depth of field. Use the third image, a line drawing, for the exact layout, proportions and camera: keep every part where the drawing puts it and add no parts. The machine is NIMROD, the 1951 Ferranti Nim-playing computer from the Festival of Britain, rebuilt as a tall walnut and steel monolith. Its face has three panels of grey hammered enamel, each in a bevelled brushed-steel frame. The middle panel is the game display: four rows of round domed glass lamps, eight in each row, each lamp in a small turned steel bezel; the first lamp of each row is a cool white lamp set apart by a thin steel rule, the other seven are warm amber lamps. Rows read 3, 5, 2 and 6 lamps lit from the left, the rest unlit: smoky dark glass, faintly visible, not black. One white lamp is lit. Under the rows are four small dark glass legend panes in thin steel frames, one glowing amber, three dark. The left panel has a column of eight small lamps, each beside an engraved steel label strip; one lamp is lit. The right panel has a small grid of amber lamps, three columns by four rows, a few lit, with small red lamps beside and below it. Above is a long dark name board in a steel frame, unlit. In front is a sloping walnut desk with a steel edge: a black field on a steel plate holding four rows of eight round push buttons of milky cream lucite in steel collars, the leftmost button of each row black; buttons under lit lamps glow softly from inside. Behind the buttons stand a chunky black bakelite lever switch, a small black mushroom button and a fat amber mushroom plunger on stepped steel collars, each with a small engraved plate. No people, no screen, no joystick, no coin slot, no modern LEDs, no extra text or logos.

- Seat A kept the layout closely. It added a row of glowing tube lamps above the panels, put the four legends in one row, and set the buttons on bare steel. The model follows it on the steel plate and the lamp look (deep orange lit, dark smoky brown unlit); it keeps its own 2 by 2 legends and lit name board, and not the tube row.
- Seat B was the same prompt plus "Close attention to the surfaces: the enamel has a fine hammered texture that catches the light, steel edges are bevelled and catch thin highlights, the lamps are real glass domes with a bulb filament glow behind the lit ones." It drew a three-quarter view instead, with a "NIMROD" plate. Failed as a seat target: the extra sentence about surfaces may have pulled it toward a showroom shot.
- Hero A (`20261112-225007-753d6f`, 3:4, the hero line drawing, the same prompt with "Three-quarter photograph from the left ... with a window low in its body showing two rows of glowing valves") kept the layout and drew the valve window although the greybox's window was then hidden inside the lower body (a modelling fault, fixed after). It is the target for the lower body.

Textures, no inputs, 1:1 unless said; all worked first time:

- Enamel: the shared opening ("Seamless tileable material texture, flat orthographic top-down scan, ...") then "Mid grey hammertone enamel paint on steel, as on 1950s laboratory instrument cabinets, about 40 cm across: a fine even pattern of shallow round hammer dimples a few millimetres across, with slightly lighter rims and a faint metallic flake, uniform tone across the whole sheet, satin finish." Seam ratios (1.0 is seamless) 0.88 and 1.05 as made, 0.67 and 0.54 after wrapping.
- Lamp lens: "Close-up photograph, straight on, of one round domed glass indicator lamp lens from a 1951 computer panel, unlit. The lens fills the whole picture edge to edge. Pale warm smoky glass moulded with fine concentric rings and a faint diamond pattern, a small dark bulb with a coiled filament just visible behind the glass in the middle. Evenly lit, no reflections of a room, no bezel, no background visible." Asking for a photograph of one object, as BERTIE.md advises, worked.
- Button cap: "One round push-button cap seen exactly from above, orthographic, filling almost the whole frame, on a plain pure black background. Thick milky cream-white lucite with a very slightly domed top, soft light inside it, faint swirls in the plastic, a thin polished edge. Evenly lit, no shadows, no text, no numbers."
- Name board (21:9): "Flat, straight-on orthographic texture of a backlit amber glass sign panel from a 1951 exhibition machine, evenly lit from behind, filling the whole frame edge to edge, no frame, no border, no perspective. One single line of dark brown-black wide-spaced condensed sign-writer block capitals reads exactly: NIMROD. The letters are small, about one fifth of the image height, centred, with plain warm amber glass above and below ..." The letters came out right, a little taller than asked (312 of 1344 px); the 7.4:1 band still fits round them.

## Verified

- Game: `rustc --edition 2024 --test src/nimrod.rs`: 15 passed. They cover: the strategy finds a winning move exactly when one exists, for every position up to 7,7,7,7 in both games, checked against a full search; the real game state machine never loses from a winning position (memoised search over every visitor line, six positions, both games); a careful visitor wins 300 of 300 by choosing who starts; a careless one loses over 200 of 300; simple and reverse endings; the instruction lamps' order for a normal move, a safe position and the reverse game's end; buttons only put out lamps to their right; the switch only moves between games; the score rule (start total, doubled in reverse, ends on a loss, a mid-game deal, or walking away, capped at 5000); deals grow with the run; playing itself scores nothing and stepping up deals afresh; the last row flashes at the end.
- Bevy side: `CARGO_TARGET_DIR=~/_agent_scratch/arcade-check-target cargo check` passes with no warnings.
- Model: every primitive has a UV map and the glb's JSON has `"texCoord":-1` 0 times (the lever's steel had none at first; `mesh_object` now adds one). Node names, bounding boxes, triangle counts, the 1.7 by 2.6 by 0.9 m limit, file size, and every control's width on an upright phone, by numbers. Three Cycles previews (seat twice, hero once) compared with the targets by eye, and lit against unlit lamps measured in the render: a lit match lamp 239, 200, 172 against an unlit one 127, 103, 85; a lit key 231, 205, 183 against an unlit 176, 159, 140 before the unlit keys were darkened further.

## Not verified

- Nothing was run in the game. No `cargo build`, no `--shot`, no web build, as the brief says. Unseen: the lit copies of the lamp materials under Bevy's tonemapping and bloom, the panel light and stand-in spot, the seat view itself, the lever's swing direction (worked out from the export's axes, not seen), and the keyboard and touch input.
- The lever's direction: +Z rotation should lean it left toward the SIMPLE plate. If it leans right, flip the sign of `LEVER_THROW` in `src/nimrod_machine.rs`.
- Touch: the page has no targets for Nimrod yet (see above). The 32 desk buttons are 6.2% to 7.2% of an upright phone's width, which meets the brief, but each is only 25 to 28 px across, which is small for a thumb.
- No baked light: like Bertie, one live spot stands in. Edges of boxes are sharp; only the frames and turned parts are bevelled.
- The model is 1.13 MB, a little over the "about 1 MB" asked. Most of it is the 64 turned lamp bezels and 32 key collars.
- No sound files exist yet.
