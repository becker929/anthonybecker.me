# Whirlwind: the Bouncing Ball

The arcade's third machine: a homage to the Bouncing Ball program on MIT's Whirlwind I (1951), built as a walnut and steel display console with a round tube in a steel hood.
Game id `pad::GAME_WHIRLWIND`. Branch `claude/arcade-whirlwind`.

## What was built

| File | Job |
| --- | --- |
| `src/whirlwind.rs` | The game and the tube's picture. Plain Rust, no engine types, with its own tests. The sources are at its top. |
| `src/whirlwind_machine.rs` | The engine side: `WhirlwindPlugin`, the painted tube, knobs, plunger, lamps, sounds, touch points. |
| `blender/whirlwind.py` | Builds the model. `--preview out.png [--view seat or hero or phone]`, `--lines reference`. |
| `blender/whirlwind_textures.py` | Makes `blender/tex_whirlwind/parts.jpg`, the console's atlas. |
| `assets/whirlwind.glb` | The model: 1,042,748 bytes, 12,750 triangles, 40 nodes. |
| `assets/ART-whirlwind.md` | Which generated image each texture and target came from. |
| `reference/whirlwind_*` | Line art and depth of the greybox (seat, hero), and the target pictures. |

Edits to existing files, the smallest that wire it in: `src/main.rs` (two `mod` lines and the plugin), `build-web.sh` (copies `whirlwind.glb`), `src/shot.rs` (a `whirlwind` view from the seat).

## The real program, and what the homage keeps

- Whirlwind drew on round oscilloscope tubes, point by point. The Bouncing Ball program solved the equations of a falling, bouncing ball and plotted it as a dot each step. The tubes' long-persistence phosphor (P7) flashes blue-white and fades through a slow yellow-green afterglow, so the path lingers as a row of fading dots.
- The ball starts high on the left and bounces to the right, each bounce lower. In its game form the floor has a hole and the operator sets the bounce with a knob before release, trying to drop the ball through it.
- Credit is disputed. Charles W. Adams and John T. (Jack) Gilmore Jr. are usually named; Norman Taylor's 1989 account says Gilmore made it a game; the 2 February 1951 project report credits the student Oliver Aberth with the simulation. The module doc names all three.
- Sources: https://retrocomputingforum.com/t/footage-of-bouncing-ball-on-whirlwind/2124, https://en.wikipedia.org/wiki/Whirlwind_I, https://tcm.computerhistory.org/exhibits/WhirlwindFall1982.pdf
- Invented: two knobs (BOUNCE and SPEED), the plunger, holes that move and narrow, five misses to a run, the score in a 16-bit lamp register (Whirlwind's word was 16 bits), the walnut. I could not find a reliable description of exactly which controls the real game used, beyond "a knob" for the bounce.

## The game (`src/whirlwind.rs`)

- The field runs -1 to 1 each way, the tube's glass is the circle of radius 0.96, the floor is at y = -0.50 from x -0.80 to 0.80, the ball starts at (-0.74, 0.55).
- BOUNCE has nine notches: the share of speed a bounce keeps, 0.50 to 0.90. SPEED has nine: the push to the right, 0.10 to 0.42 field units a second. Each floor touch also keeps 93% of the speed along. A bounce slower than 0.70 upward is the last: the ball comes to rest there.
- The ball drops through when its centre crosses the floor inside the gap with 0.6 of its radius to spare. It misses by running off the right end, or by coming to rest.
- Fixed steps of 1/480 s, so the live game and the tests take exactly the same path. `fly(bounce, speed, hole)` and `solutions(hole)` are the same steps.
- Holes: hole n has half-width 0.085 - 0.0035 (n - 1), at least 0.05. From hole 6 the gap slides to and fro during the flight, 0.035 (n - 5) either way, at most 0.20, at 1.3 rad/s. Each new hole is placed at random, at least 0.15 from the last, where between 1 and 20 of the 81 settings drop through (holes 1 to 3 want at least 4, holes 4 to 7 at least 2).
- A run ends after five misses. The plunger (or the page's AGAIN, or R) then starts a new run.
- Phases: `Ready` (the ball waits, pulsing, at the top left), `Flight`, `Result` (1.4 s after a drop, 1.0 s after a miss), `Over`.
- Idle demonstration: while nobody plays and no run is going, the console releases a ball with random settings every 3.5 s. It never counts and makes no sound.
- Walking away mid-run ends the run and scores it, as Bertie's streak does.

### How a visitor wins

Read the last ball's dotted path, which lingers on the tube, and turn the knobs a notch or two: more BOUNCE carries the ball further in longer, more numerous hops; more SPEED stretches every hop. Each hole has a handful of settings that work.

### Score

Each ball through a hole scores ten times the hole's number (hole 1 is 10, hole 7 is 70), doubled if it was the first ball tried at that hole. The run's score is the sum, at most 5000, sent with `pad::score(pad::GAME_WHIRLWIND, n)` when the run ends (five misses, or walking away). A run with no drops sends nothing.

### The tube's picture

512 px square, painted each frame into the `Tube_Screen` material's emissive texture (multiplier 9). Two phosphor layers: a blue-white flash fading in 0.05 s and a yellow-green afterglow fading in 1.6 s. The ball is plotted 36 times a second, so its path is a row of separate dots. The floor is a row of dots refreshed every frame with the gap left out, two short posts mark the gap's edges, and a drop lights a short column under the gap. Outside the circle is black; unlit phosphor is a faint grey-green so the face reads as glass. No words, no numbers.

## The model (`assets/whirlwind.glb`)

Game coordinates, the machine at its origin facing +Z. Overall box x -0.708 to 0.708, y 0 to 2.260, z -0.400 to 0.472: 1.416 wide, 2.260 tall, 0.872 deep (limit 1.5, 2.4, 0.9).

| Node | min (x, y, z) | max (x, y, z) | Notes |
| --- | --- | --- | --- |
| `Tube_Screen` | -0.230, 1.200, 0.130 | 0.230, 1.660, 0.146 | A shallow dome, 0.46 m across. UVs 0..1 over its square; the tube circle is radius 0.48 of it. |
| `Knob_Bounce` | -0.320, 0.958, 0.155 | -0.160, 1.089, 0.359 | Child of `Whirlwind_Deck`. Turns about its own Y; clockwise (negative) is more. |
| `Knob_Speed` | 0.160, 0.958, 0.155 | 0.320, 1.089, 0.359 | The same, on the right. |
| `Plunger_Release` | -0.060, 0.961, 0.201 | 0.060, 1.075, 0.340 | Child of the deck. Sinks along its own Y, 22 mm. |
| `Lamp_Score_0` | 0.443, 1.993, 0.106 | 0.487, 2.037, 0.126 | Bit 0, far right. Bits step 0.062 m to the left. |
| `Lamp_Score_15` | -0.487, 1.993, 0.106 | -0.443, 2.037, 0.126 | Bit 15, far left. Amber. |
| `Lamp_Ball_0` | -0.487, 1.903, 0.106 | -0.443, 1.947, 0.126 | Balls left, 0 to 4 left to right, 0.062 m apart. Red. |
| `Lamp_Ball_4` | -0.239, 1.903, 0.106 | -0.195, 1.947, 0.126 | |
| `Lamp_Bounce_0` | 0.257, 1.903, 0.106 | 0.301, 1.947, 0.126 | Bounce chaser, 0 to 3 left to right. Green. |
| `Lamp_Bounce_3` | 0.443, 1.903, 0.106 | 0.487, 1.947, 0.126 | |
| `Whirlwind_Deck` | empty at (0, 0.965, 0.29) | | Tilted 0.32 rad about X; the desk slopes down toward the player. |

`blender/whirlwind.py` prints the full table every run, with each part's pixels in the landscape seat view and its width on an upright phone.

- Every lamp has one material and one primitive. As exported they are the unlit look (dim coloured glass with the jewel picture). The game makes one lit copy per colour (emissive at 7 times the colour, base black) and swaps.
- Scenery is one mesh per material: `Whirlwind_wood`, `_steel`, `_black`, `_bakelite`, `_glow`, `_pip`, `_parts`, `_dialplate`, `_cream`, `_bulb`, `_bulb_on`, plus the knobs' and plunger's own parts.
- The knobs: a steel skirt, a fluted black drum, an opal cap, a low black pointer bar with a lit amber line that reaches over a black dial plate with nine ticks (0.30 rad apart, the ends and middle long). The plunger is a fat amber mushroom in a stepped steel collar. Plates BOUNCE, RELEASE, SPEED under them.
- Above the tube: 16 dressing toggle switches, then the lamp register (16 amber, then 5 red, 6 steady bulbs of which 2 lit, 4 green) in a black panel in a bevelled steel frame, and a WHIRLWIND I plate. Warm hairlines along the side panels' edges, the desk's edges, above the register and under the switches.
- Walnut and steel are the room's shared textures at the room's scale (walnut 0.70 m a repeat, grain upright on sides and pedestal, across the desk; steel 0.25 m, brushed along each strip, turned on round parts).
- Light is live: one stand-in spot like Bertie's, from above and in front, and a green point light behind the tube glass (brighter while a ball flies). Nothing is baked; no second UV set.

### Seat and footprint

- Seat: eye (0, 1.55, 1.15), aim (0, 1.42, 0.15) in the machine's space. `seat_front` 0.47, `seat_half_width` 0.40 (the knobs' outer touch targets). On an upright phone (390 by 844) the eye steps back to z = 1.75.
- From the landscape seat (1280 by 720): lamps' top row at y 20 to 47 px, tube 240 px wide, knobs 92 px (7.2%), plunger 68 px (5.3%), plates at the bottom edge. The WHIRLWIND I plate is cut off at the top.
- Upright phone: knobs 17.0% of the width, plunger 12.7%, tube 45%. The touch targets either side of a knob are 0.115 m from its centre, about 11% of the width apart.
- Footprint: `body_centre` (0, 0.036), `body_half` (0.71, 0.44).
- Placement: (-3.4, 0, 2.4), yaw +90 degrees, so it faces +X from the left wall. Its back is at x = -3.80, clear of the wall's walnut slats (to about x = -3.93).

## Keyboard (while standing at it)

| Key | Does |
| --- | --- |
| W, Up / S, Down | BOUNCE one notch more / less |
| D, Right / A, Left | SPEED one notch more / less |
| Space | The plunger: release the ball; after the last miss, a new run |
| R | New run, once the run is over (the page's AGAIN sends the same) |
| E, Escape | Step up and step away (src/cabinet.rs, for every machine) |

## Touch

Published with `pad::publish_points` every frame while focused and `pad.active`, in this order. Taps arrive in `pad.taps` by index (the page calls `pad_key(i)`).

| Index | Label | Kind |
| --- | --- | --- |
| 0 | BOUNCE less | tap, left of the BOUNCE knob |
| 1 | BOUNCE more | tap, right of the BOUNCE knob |
| 2 | SPEED less | tap, left of the SPEED knob |
| 3 | SPEED more | tap, right of the SPEED knob |
| 4 | RELEASE | tap, on the plunger |

A tap on a knob's target steps it one notch. `pad::FIRE` from the page also works the plunger.

### What the page needs

- A way to know Whirlwind is the machine being played. There is no `STATE_WHIRLWIND` in `src/pad.rs`, and I did not add one (existing file). Proposed: `pub const STATE_WHIRLWIND: u32 = 32;` in `src/pad.rs`, ORed into the bits in `publish` in `src/whirlwind_machine.rs`; the page then draws the five targets above over the published points, and a quiet line for keys: "W S bounce · A D speed · space release".
- `STATE_OVER` is published when the run is over, so AGAIN shows. Bertie's `publish` still clears the bits whenever Bertie is not focused (left alone, as asked).

## Sounds (`pad::play`)

Each should be foley or old equipment, not synthesised, and is not built yet.

| Name | When | How it should sound |
| --- | --- | --- |
| `whirlwind-notch` | a knob moves a notch | a heavy rotary switch detent: a short dry clack with a little ring of steel |
| `whirlwind-stop` | a knob is turned against its end | a duller thud of the detent against its stop, no ring |
| `whirlwind-release` | the ball is released | the plunger slammed home: a deep sprung thunk, then a relay pulling in |
| `whirlwind-bounce` | each bounce of a played ball | one quiet dry relay tick; several takes with small pitch changes, since it repeats 2 to 11 times a ball |
| `whirlwind-drop` | the ball goes through | a quick run of relays chattering, then a mellow ping of a struck steel rod |
| `whirlwind-miss` | a ball misses | a short low buzz of a register clearing |
| `whirlwind-over` | the fifth miss | relays dropping out one after another over a fading transformer hum |
| `whirlwind-hole` | a new hole is set up | a stepping switch ratcheting four or five steps |
| `whirlwind-refused` | the plunger while a ball is out | a dead plunger thump with a small rattle |
| `whirlwind-reset` | a new run starts | a heavy toggle snap and relays settling |

## Commands run

```
cd ~/_agent_scratch/whirlwind/demos/_src/arcade-bevy
rustc --edition 2024 --test src/whirlwind.rs -o /private/tmp/claude-501/whirlwind-test/td && /private/tmp/claude-501/whirlwind-test/td
rustc --edition 2024 --test -O src/whirlwind.rs -o /private/tmp/claude-501/whirlwind-test/t && /private/tmp/claude-501/whirlwind-test/t --ignored --nocapture   # the tuning grid
~/_agent_scratch/ringbench/.bpy/bin/python blender/whirlwind_textures.py
~/_agent_scratch/ringbench/.bpy/bin/python blender/whirlwind.py
~/_agent_scratch/ringbench/.bpy/bin/python blender/whirlwind.py --lines reference          # about 80 s
~/_agent_scratch/ringbench/.bpy/bin/python blender/whirlwind.py --preview /tmp/seat.png    # about 9 s, add --view hero
cd ~/Desktop/zpkt/contrib/harness && uv run harness images batch jobs1.json --context "Arcade machine 3, Whirlwind bouncing ball console: target pictures matched to the greybox line art, and a lamp lens texture" --batch arcade-whirlwind-1 --parallel 4
CARGO_TARGET_DIR=~/_agent_scratch/arcade-check-target cargo check
```

## Gemini (batch `arcade-whirlwind-1`, 4 calls, 4 images)

Wall: https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=arcade-whirlwind-1

Inputs for the targets: the owner's picture, `reference/bertie_target_seat.jpg`, then the line drawing. The prompt that worked (seat; the hero differs only in its first sentence):

> Photograph from where the player stands, looking straight at an early computer display console in a small dark arcade room: the lamp panel at the top, the round display tube in its hood in the middle, the sloped desk with two knobs and a plunger below. Use the first two images only for materials, colour and light: dark walnut veneer with fine straight grain and a satin sheen, brushed steel edging with hairline lines of warm light set into it, milky domed controls on steel collars, navy wall panels, a polished concrete floor with warm cove light at the foot of the walls, soft filmic light, shallow depth of field. Use the third image, a line drawing, for the exact layout, proportions and camera: keep every part where the drawing puts it and add no parts. The machine is a 1951 MIT Whirlwind computer display console, built as a walnut and steel cabinet. Its round 16-inch cathode-ray tube sits deep in a brushed-steel hood that stands out further at the top like a visor, matt black inside. The tube face is dark green-grey glass showing a sparse oscilloscope trace of small separate glowing dots: a dotted path of a ball bouncing from the top left across the face in shrinking arcs, and a dotted floor line near the bottom with one gap in it. The freshest dots are blue-white; older dots fade to a dim yellow-green afterglow. Above the tube: a row of sixteen small steel toggle switches on a steel strip, then a black panel in a steel bezel with two rows of small domed glass jewel lamps in steel bezels. [...] On the sloped walnut desk: two heavy black fluted rotary knobs with steel skirts, each standing on a round black dial plate with nine white tick marks, with a cream pointer bar lying low across its top; between them a fat amber mushroom plunger in a stepped steel collar; a small engraved steel plate under each control. Close attention to the surfaces [...]. No people, no keyboard, no typewriter, no words on the tube, no modern LEDs, no extra text or logos.

The full prompts are on the wall.

- Seat B (`20261112-224442-4fa3e1`, the same with "The light is low and warm, the tube's dots are the brightest thing in the picture." added) is the target. It kept the layout, but turned the round visor hood into a deep square steel box that flares toward the player.
- Seat A (`20261112-224449-a31f19`) kept the round hood but added a second switch strip under the lamps.
- Hero A (`20261112-224445-5c54db`) changed the proportions most: a bigger tube, the same square box hood, a plain lower body. Two pictures out of three chose the box hood, so the model now has one, and the tube grew from 0.38 m to 0.46 m.
- The lamp lens (`20261112-224434-6dd00d`, 1:1, 1K, no inputs) worked first time: "Close-up photograph, straight on, of one small domed glass jewel lens from a 1950s panel pilot lamp, clear pale glass with fine radial facets like a cut jewel, unlit, filling almost the whole picture, centred, on plain black, even soft light, no room reflections, no text."
- No prompt failed. Textures for walnut and steel were reused, not generated.

## Matched to the target, and not

- Matched: the layout (lamp register, switch strip, box hood round a big round tube, desk with two knobs and an amber plunger, plates under each), the warm hairlines on the side panels, the jewel lamps in steel bezels, the dial plates with ticks, the green-grey glass face with a dotted trace.
- Not: the target's knobs carry a tall black bar handle; mine is a low bar so it reads as a pointer. The target's hood is lighter steel inside; mine is black inside. No baked light, so no soft contact shadows. The lamp panel is a little smaller than the target's.

## Verified

- Game: `rustc --edition 2024 --test src/whirlwind.rs`, then the binary: `test result: ok. 10 passed; 0 failed; 1 ignored`. They cover: for six seeds and sixteen holes each, every hole has a setting that drops through and at most 20 of 81 do, every listed answer drops, and a setting three notches off an answer misses; the first hole is forgiving; with no hole in reach soft slow balls stop and hard fast ones run off; the live game with uneven frames lands exactly where `fly` says; holes narrow and start to drift; five misses end the run and its score is taken once; walking away scores the run; the plunger is refused in flight; the demonstration never counts; knobs stop at their ends; the tube is round and the trail still glows a second later.
- `CARGO_TARGET_DIR=~/_agent_scratch/arcade-check-target cargo check`: finished with no warnings or errors.
- Model: node names, parents (`Whirlwind_Deck` carries the knobs and plunger, tilted 0.32 rad about X), bounding boxes, triangle counts, size limits, and seat and phone pixels checked by numbers, in Blender and from the exported file. Cycles previews from the seat (three) and the hero view (one) looked right and were compared with the targets.

## Not verified

- Nothing was run in the game. No `cargo build`, `cargo run` or `--shot` (the brief forbids building). So these are unseen: the tube's brightness and bloom at emissive 9, the lamps' lit and unlit looks, the knobs' turn direction against their ticks in Bevy (worked out from the glTF axes, not seen), the plunger travel, the seat view, and the demonstration.
- The web build, touch, the page and sounds.
- Speed: the tube is a 512 px picture painted every frame, plus two 512 px phosphor layers faded every frame, on the CPU, always (the demonstration runs while nobody plays). That is a little more work than the first cabinet's tube. Not measured on a phone.
- Placing a new hole runs up to 60 candidate holes times 81 flights; usually the first candidate passes. Not timed in wasm.
- The model is 1.04 MB, a little over the "about 1 MB" asked.
