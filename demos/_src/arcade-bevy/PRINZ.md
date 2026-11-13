# Prinz's chess program

The arcade's fifth machine: a homage to the program Dietrich Prinz wrote for the Ferranti Mark 1 at Manchester, which first ran in November 1951. It solved mate-in-two problems and could not play a game. Here the machine sets the problem and the visitor solves it.

## What was built

| File | Job |
| --- | --- |
| `src/prinz.rs` | The game: a small chess engine, a mate-in-two search, fifteen problems, the rules and the score. Plain Rust, its own tests. Sources at its top. |
| `src/prinz_machine.rs` | The Bevy side: `PrinzPlugin`. Lays out copies of the pieces, slides them, lights the lamps, paints the monitor, works the button, publishes touch points and state. |
| `blender/prinz.py` | Builds the model. `--preview out.png [--view seat|hero|phone]`, `--lines <dir>`. Prints the node table with each part's pixels from the seat and from an upright phone. |
| `blender/prinz_textures.py` | Makes `blender/tex_prinz/` from the generated pictures, and draws the engraved plates. |
| `assets/prinz.glb` | The model, 1,131,808 bytes, 20,352 triangles without the piece templates. |
| `assets/ART-prinz.md` | Which generated image each texture came from. |
| `reference/prinz_*` | The line drawings and depth passes given to Gemini, and the two target pictures. |

Wired in: `mod prinz; mod prinz_machine;` and `prinz_machine::PrinzPlugin` in `src/main.rs`, `assets/prinz.glb` in `build-web.sh`, and a `prinz` view in `src/shot.rs`.

## The game

- Problem 1 is set when the room starts. White is at the visitor's side, to move, and mates in two.
- The visitor picks up a White piece (press its square) and puts it down (press a lit square). Pressing the piece again puts it back; pressing another White piece picks that one up. Anything else is refused.
- After the first move (the key) the THINKING lamp lights and the running lamps over the monitor chase for 3 seconds while the tube's rows churn. The real program took about fifteen minutes on its best known problem.
- The machine then does what Prinz's program did: it looks at every Black answer and every White mate. If some answer leaves no mate, the key was wrong: it plays that answer, REFUTED flashes, and after 2.6 s the pieces go back to the start. If every answer allows a mate, it plays the answer that leaves the fewest mates (ties broken at random), and WHITE TO PLAY lights again.
- The visitor's second move must mate. If it does, MATE flashes and stays lit, the problem's lamp in the row lights, and after 6 s (or at once with the button) the next problem is set. If it does not, REFUTED, and the problem resets.
- A key that leaves Black stalemated is refuted with no Black move.
- The heavy red button sets the next problem at any time. After the last problem the first comes round again.
- The visitor's pawns promote to queens. No problem needs another piece.

How to win: solve problems one after another without a wrong move.

### Score

The score is a run: each problem solved adds its points, 1 to 5 by difficulty (problems 1 to 3 are worth 1, 4 to 6 are 2, 7 to 9 are 3, 10 to 13 are 4, 14 and 15 are 5; a full round is 45). The run ends, and its score goes to the table, on a wrong key, a wrong mate, pressing the button on an unsolved problem, or walking away. A problem solved twice in one run counts once. Capped at 5000.

### The engine and the problems

Legal moves for every piece, check, checkmate and stalemate told apart, double pawn steps, promotion to any piece. Castling and en passant are left out. A test checks that no problem has a king and rook where castling could be claimed, and that no double step in any solution line (first moves, every answer, every mating move) leaves an en passant capture.

| # | Points | Key | By |
| --- | --- | --- | --- |
| 1 | 1 | Rh6 | Dietrich Prinz, 1951: the position his program is recorded as solving, `5Kbk/6pp/6P1/8/8/8/8/7R w` (Prinz, "Robot Chess", Research 6, 1952; via chessprogramming.org) |
| 2 to 13 | 1 to 4 | Qc7, Qg4, Kf6, Rg7, Rd4, Qh7, Qc7, Qb8, Kf1, Qb3, Bb3, Rd7 | Composed for this machine: found by a search over random positions with this file's engine, kept only if every piece is needed, then chosen and ordered by hand |
| 14 | 5 | Rh1 | Thomas Taverner, Dubuque Chess Journal, 1889, 1st prize |
| 15 | 5 | Rcc7 | Godfrey Heathcote, Hampstead and Highgate Express, 1905-06, 1st prize |

The two prize problems were read from Wikipedia's "Chess problem" article and proved sound by the tests here.

## The model

Overall box: x -0.766 to 0.766, y 0 to 1.812, z -0.406 to 0.483 (limit 1.6 by 2.4 by 0.9). 120 nodes, 21 materials. It stands at its own origin facing +Z.

An operator's desk in the manner of the Mark 1's console: a walnut desk with a sloped top (25 degrees) and an upright back panel of pale grey crackle enamel. The board is set into the slope. Behind it a brushed steel band carries the four result lamps and the next button. Left of the board a plate of toggles, right of it a baize tray for taken pieces. On the panel: the monitor tube in a steel bezel, eight running neons above it, the row of fifteen problem neons below it, a plate of neons and a plate of toggles either side (dressing), and the name plate at the top. Hairlines of warm light run down the side panels, along the desk's lip, round the board's near edge and along the rail.

| Node | min (x, y, z) | max (x, y, z) | Notes |
| --- | --- | --- | --- |
| `Prinz_Desk` | empty at (0, 1.030, 0.130) | | The desk's frame, tilted 0.44 rad about X. Parent of the four below. |
| `Prinz_Board` | empty at (0, 0.008, 0.050) in the desk | | The board's top face. Square `sq` is at ((f - 3.5) * 0.064, 0, (3.5 - r) * 0.064) in it, f = sq % 8, r = sq / 8. Up is +Y. |
| `Lamp_Sq_0` (a1) | -0.254, 0.908, 0.354 | -0.194, 0.935, 0.409 | A ring of lamp glass round each square, 4.6 mm wide. Child of the board, origin at the square's centre. |
| `Lamp_Sq_7` (h1) | 0.194, 0.908, 0.354 | 0.254, 0.935, 0.409 | |
| `Lamp_Sq_56` (a8) | -0.254, 1.098, -0.052 | -0.194, 1.126, 0.004 | |
| `Lamp_Sq_63` (h8) | 0.194, 1.098, -0.052 | 0.254, 1.126, 0.004 | |
| `Prinz_Tray` | empty at (0.470, 0.002, 0.080) in the desk | | The tray's floor. |
| `Lamp_White` | -0.274, 1.160, -0.174 | -0.226, 1.193, -0.125 | A domed glass jewel, r 24 mm. Its bezel is scenery. |
| `Lamp_Think` | -0.149, 1.160, -0.174 | -0.101, 1.193, -0.125 | Amber. |
| `Lamp_Mate` | -0.024, 1.160, -0.174 | 0.024, 1.193, -0.125 | Green. |
| `Lamp_Refuted` | 0.101, 1.160, -0.174 | 0.149, 1.193, -0.125 | Red. |
| `Button_Next` | 0.207, 1.152, -0.195 | 0.303, 1.247, -0.082 | A red mushroom, 96 mm across. Sinks along its own Y; its collar is scenery. |
| `Lamp_Problem_0..14` | -0.258, 1.309, -0.245 | 0.258, 1.322, -0.235 | Neons 36 mm apart on the panel. |
| `Lamp_Run_0..7` | -0.125, 1.634, -0.278 | 0.125, 1.647, -0.268 | Neons over the monitor. |
| `Monitor_Tube` | -0.110, 1.416, -0.270 | 0.110, 1.586, -0.243 | A gently domed face, UVs 0 to 1, v down from its top. |
| `Piece_W_K` .. `Piece_B_P` | under the desk | | Templates. Base 58 mm across. Heights: K 88, Q 70, N 70, B 66, R 50, P 48 mm. |

Every lamp and template has one primitive and one material. Scenery is one mesh per material: `Prinz_wood`, `_steel`, `_black`, `_bakelite`, `_enamel`, `_glow`, `_maple`, `_darksq`, `_felt`, `_parts`, `_neon`, `_neon_on`.

### The pieces

One template per kind and colour (12 nodes), each a single mesh in one of two materials, `Prinz_ivory` (boxwood) and `Prinz_ebony`, so every copy batches with its kind. The game hides the templates and spawns copies as children of `Prinz_Board`. Chosen for reading from above at about 50 degrees on a phone: broad heads, low bodies, a common turned foot. King: crown with a cross. Queen: flared crown ringed with eight balls. Rook: a broad tower with four merlons. Bishop: a mitre with a slanted fin for the cut and a ball. Knight: a cut-out horse's head with a mane, looking toward the a-file for White and the h-file for Black. Pawn: a ball on a collar. They are shorter than Staunton so a piece hides less of the square behind it, and wider so they fill most of a square.

## Seat, footprint, placement

- Seat: eye (0, 1.58, 0.86), aim (0, 1.13, 0.02). `seat_half_width` 0.25 at `seat_front` 0.43 (the board's near edge). On a 390 by 844 phone the eye steps back to z 1.232; the board is then 80% of the width and a square is 8.2% (far rank) to 11.0% (near rank) of it. The button is 11%, the result lamps 5.3%.
- In 1280 by 720 from the seat, the board spans x 450 to 830 and y 344 to 643. The running lamps are at y 32, the name plate is partly above the frame.
- Footprint: centre (0, 0.04), half size (0.77, 0.45).
- Placed at (-3.4, 0, 4.6) with yaw +90 degrees (`PRINZ_AT`, `PRINZ_YAW`): its back is at world x -3.81, 0.19 m off the left wall; it spans world z 3.83 to 5.37.
- A stand-in spot lamp, as on Bertie, from above the player's shoulder.

## Keyboard

Only while the player stands at the desk (E steps up, Escape leaves, as for the other machines).

| Key | Does |
| --- | --- |
| Arrow keys | Move the keyboard's square. Up is toward Black (rank 8), right toward the h-file. Its ring glows cool blue-white. It starts on e2 and hides once a finger is used. |
| Enter, numpad Enter, Space | Press the keyboard's square: pick up, put down. |
| N or R | The next-problem button. |

## Touch points, for `web/index.html`

Published every frame while the desk is in use and a touch has been seen, through `pad::publish_points`, in this order. All are taps; the page should call `pad_key(index)` for a tap on point `index`.

| Index | Label | Kind |
| --- | --- | --- |
| 0 to 63 | the squares, a1 b1 ... h1, a2 ... h8 (index = rank * 8 + file) | tap |
| 64 | next problem | tap |

The page's AGAIN button (RESTART) also sets the next problem. `pad_state` carries `STATE_OVER` while a solved problem is showing, and 0 otherwise; there is no `STATE_PRINZ` bit in `src/pad.rs`, so the page cannot yet tell this desk from the first cabinet by state alone.

## Sounds

Asked for by name with `pad::play`. None exist yet.

| Name | When | How it should sound |
| --- | --- | --- |
| `prinz-select` | a piece picked up or put back | a soft wooden tick and a little felt scuff |
| `prinz-place` | the visitor's piece set down | a solid boxwood clack on a varnished board |
| `prinz-capture` | a piece taken, either side | a clack, then the taken piece dropping onto baize, muffled |
| `prinz-refused` | a square that cannot be chosen | a short dull relay clunk, low |
| `prinz-think` | the machine starts its search | about 3 s of fast relay and uniselector chatter over a faint valve hum |
| `prinz-reply` | the machine moves a Black piece | a relay click, then a heavier wooden clack |
| `prinz-mate` | the visitor mated | the Mark 1's hooter: a short clean two-note hoot, about 0.6 s |
| `prinz-refuted` | a wrong move shown | a low buzzer burst, about 0.4 s |
| `prinz-reset` | the pieces go back | wooden pieces set out quickly, a short rattle, about 0.8 s |
| `prinz-next` | the next problem is set | a heavy latch clunk from the big button |
| `prinz-cursor` | the keyboard's square moves | a tiny stepping-switch tick |

## Commands run

```
rustc --edition 2024 --test src/prinz.rs -o /tmp/prinz_test && /tmp/prinz_test
CARGO_TARGET_DIR=~/_agent_scratch/arcade-check-target cargo check
~/_agent_scratch/ringbench/.bpy/bin/python blender/prinz.py
~/_agent_scratch/ringbench/.bpy/bin/python blender/prinz.py --preview /tmp/seat.png            # also --view phone, --view hero
~/_agent_scratch/ringbench/.bpy/bin/python blender/prinz.py --lines /tmp/prinz_ref             # about 2.5 minutes
~/_agent_scratch/ringbench/.bpy/bin/python blender/prinz_textures.py
cd ~/Desktop/zpkt/contrib/harness && uv run harness images batch jobs1.json --context "..." --batch arcade-prinz-1 --parallel 4
```

The problems were searched with a scratch crate outside the repo (`/private/tmp/claude-501/prinz-gen`) that includes `src/prinz.rs` by `#[path]`; about 2,500 sound positions came from 1.2 million random ones, nearly all easy. Hard ones were rare, which is why the last two are prize problems.

## Gemini

Wall: https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=arcade-prinz-1

Nine calls, eight images: four targets (seat A and B, hero A and B), and maple, enamel and baize.

- Targets: inputs were a style picture first (the owner's picture for A, Bertie's target for B) and the line drawing second, with Bertie's wording: "Use the first image only for materials, colour and light ... Use the second image, a line drawing, for the exact layout, proportions and camera: keep every part where the drawing puts it and add no parts." Then the desk described part by part, including which lamps are lit. Seat A (`20261112-224922-365557`) kept the layout exactly and is the target. Seat B kept it too, but set out a whole game of pieces.
- Both seats lit whole squares rather than rings, made the pieces tall Staunton, and put the result lamps on a steel band. The band was taken into the model; the rings and short pieces were kept for the phone.
- Textures: "Close-up photograph, straight on and evenly lit with no vignette, no shadows and no highlights, of a flat sheet of pale hard maple veneer about 30 cm across ..." worked first time, and the same opening worked for the grey crackle enamel. The same opening for green billiard baize failed with `IMAGE_RECITATION`. Asking for "the dark green felt lining inside a wooden tray of a 1950s chess cabinet", one object, worked (Bertie's lesson again).
- The plates were drawn, not generated.

## Verified

- `src/prinz.rs`: 12 tests pass (`test result: ok. 12 passed`). For every problem: White to move, Black not in check, no mate in one, exactly one key, the key in the stated notation, and after every Black answer a mate the visitor can enter. Also: castling and en passant cannot arise; points never fall; check, mate, stalemate, pins, promotion and blocked double steps; Prinz's position is solved by Rh6 alone; every problem solved through the game itself in order; the machine's answer always leaves the fewest mates (19 seeds); a wrong key is refuted, ends the run with its score and resets the board; a wrong mate is refuted; selection, reselection and refusals; moves reported for animation; skipping ends the run; a solved problem moves on by itself.
- `cargo check` passes with no warnings.
- The glb's JSON: `"texCoord":-1` appears 0 times, and every primitive with a textured material has `TEXCOORD_0`.
- The model by numbers: node names, parents, one primitive per lamp and template, bounding boxes, file size, and every part's pixels from the seat and from an upright phone. Two Cycles previews from the seat and one from an upright phone, looked at directly: the board, rail, button, tube and lamps are where the table says, and on the phone the whole board, the lamps and the button are in view.

## Not verified

- Nothing was run. No `cargo build` or `cargo run` was allowed, so the desk has never been seen in the game: the piece copies, their slides and hop, the tray, the lamp colours under the room's bloom, the monitor's picture and its orientation, the seat's handover, and the spot lamp's strength are all unseen.
- That Bevy's glTF loader keeps the template meshes' handles readable at `WorldInstanceReady` time, as `wire_model` assumes. Bertie's code relies on the same for materials.
- The model was exported without tangents to stay under 1.2 MB. Bevy generates them for materials with a normal map when they are missing (the walnut has one); that was not checked here.
- Touch, the page, and sounds: `web/index.html` does not know this desk yet.
- The hero targets were not looked at by me (image budget); seat A was.
- `reference/prinz_*_lines.png` are of the greybox before the pieces were enlarged and the rail band added.
- No light is baked.

## Still weak

- Unlit square rings read as a dark stringing line round every square. The target lit whole squares.
- The tall king (88 mm) hides part of the square behind it from the seat.
- The board's near rank ring is at the board's frame edge; the file letters are small at phone size.
- The dressing toggles and neons are simple and untextured.

## Changes after the owner played it (12 November 2026)

Anthony: "I think the chess game is broken or too hard btw. I couldn't solve the first puzzle." The game was not broken (the key Rh6 is accepted; the machine then plays its strongest defence, not the obvious capture, so the visitor needs a second, different mate), but Prinz's own position opens with a sacrifice and was a poor first puzzle.

- Prinz's position moved to fifth, after four warm-ups; it is worth 2 points now.
- Hints: if the visitor seems stuck, the square of the piece to move pulses (after a wrong try or 25 s), then its destination too (after two wrong tries or 50 s). Once Black has answered, a mate is hinted after 20 s, its square after 40 s. Tested in `a_stuck_visitor_is_shown_the_key_then_its_square`.
- The seat looks down on the board more steeply and the pieces are 1.5x the template size: a reviewer reading a render could then name every piece and square correctly (before, it could not tell bishop from pawn or king from queen).
