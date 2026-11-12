# Look notes: texture and lighting pass 2 (12 November 2026)

What was done to the arcade's look, step by step, with the commands. Written so the next machine
can follow the same path.

## The short version

- The game cannot work out bounce light, soft shadows or reflections (WebGL2). Blender's Cycles
  works them out once and the game carries the results: two lightmaps, two occlusion maps and one
  cube picture of the room.
- Materials are tiling textures made from Gemini pictures.
- A whole bake and export takes about 2 minutes. A game capture takes about 10 seconds.

## 1. Line art for Gemini

```
~/_agent_scratch/ringbench/.bpy/bin/python blender/lines.py            # writes reference/*_lines.png, *_depth.png
```

- Views match `src/shot.rs` (hero, playing, wide, controls), so art lines up with game captures.
- Freestyle found no strokes in the headless `bpy` module ("strokes set empty"). The script renders
  a depth pass and a normal pass with Cycles on the CPU and draws a line wherever either jumps.
- Time: about 45 seconds for four views.
- Pillow had to be added to the bpy venv: `uv pip install --python ~/_agent_scratch/ringbench/.bpy/bin/python pillow`.

## 2. Gemini art

Wall: https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=arcade-look-2

One batch of 8 jobs, 7 pictures kept (about 20 seconds each, 4 in parallel):

```
cd ~/Desktop/zpkt/contrib/harness
uv run harness images batch jobs1.json --context "Arcade look pass 2: concept targets and tileable material textures for the CRT cabinet and room" --batch arcade-look-2 --parallel 4
```

Concepts (16:9, 2K, inputs: the owner's picture, then the line art). The shared opening:

> Photoreal product render in exactly the style, materials and lighting of the first reference
> image: dark walnut veneer with visible fine grain and a satin sheen, brushed stainless steel edge
> banding with hairline warm light lines set into it, a recessed curved green-phosphor CRT behind
> thick glass with soft room reflections, navy lacquered wall panels, polished concrete floor with
> blurred reflections and warm cove light at the foot of the walls, soft filmic lighting, shallow
> depth of field.

and the shared ending:

> Keep the exact layout, proportions and camera angle of the second reference image, which is a
> line drawing of the 3D model: do not add, remove or move parts. The CRT shows one glowing green
> arc and four small aeroplane outlines. No people, no text, no logos, no joysticks.

- `concept-controls` worked best. Its middle: "Three heavy, chunky, clunky industrial switchgear
  controls, each clearly a well-made physical object: left and right are large rotary selector
  knobs with a thick knurled brushed-steel skirt on a stepped steel base plate with engraved tick
  marks, a milky glass dome on top, and a bold raised pointer bar that shows exactly where the knob
  points; the centre is a fat mushroom plunger push button, warm amber milky dome, in a deep steel
  collar." The knob design in `blender/build.py` is taken from it.
- `concept-hero` kept the layout but drew plain controls. `concept-wide` set the room's light levels.

Textures (1:1, 2K, no inputs). The shared opening:

> Seamless tileable material texture, flat orthographic top-down scan, fills the whole square frame
> edge to edge, perfectly even shadowless lighting, no vignette, no highlights, no reflections, no
> perspective, no borders, no objects, no text. The left edge matches the right edge and the top
> matches the bottom.

- Walnut: "Dark American black walnut veneer sheet, about 80 cm across, straight fine grain running
  vertically with slight natural waver, fine pores visible, rich dark chocolate brown with subtle
  lighter streaks, quarter-sawn, no knots, no cathedral arches, uniform tone across the whole
  sheet, satin oiled finish." Good first time.
- Brushed steel, polished concrete: good first time. Stating the real size helps the scale.
- Navy lacquer: came with a vignette. Flattening fixed it. A flat colour would have done.
- Black bakelite crackle: the call made no image (see the wall's errors file). Not retried; the
  model uses a flat black.
- "Seamless" in the prompt does not make it seamless. Measured wrap step against inside step:
  walnut 2.1 and 1.4, steel 2.0 and 4.2, navy 3.5 and 3.1 (1.0 is seamless).

```
~/_agent_scratch/ringbench/.bpy/bin/python blender/textures.py         # writes blender/tex/*.jpg
```

- Flattens broad light and dark, wraps the edges by offset-and-blend, resizes, sets contrast.
- Makes a roughness map from the tones for each, and a normal map for walnut.
- `assets/ART.md` lists each file and the picture it came from.

## 3. Blender design (`blender/build.py`)

- UVs are in metres. One repeat: walnut 0.70 m, steel 0.25 m, concrete 2 m, navy 1 m.
- Walnut grain runs across on fronts and the deck, upright on sides. Steel is brushed along each strip.
- Controls: a fixed dial plate with 25 ticks on a rubber ring; a low knurled drum with an opal cap;
  a chamfered pointer bar with a nose over the dial and a lit amber line. A fat amber plunger in a
  stepped collar. Node names, origins and axes are unchanged.
- Polished steel went black on the controls seen from the seat, because it mirrored the dark
  ceiling. The controls are now a matt "satin" metal, which gathers light from a wide angle.
- The floor is one face with no underside, because the game mirrors the model beneath it.

## 4. Lighting

```
~/_agent_scratch/ringbench/.bpy/bin/python blender/build.py --bake     # bake, then export; about 2 minutes
~/_agent_scratch/ringbench/.bpy/bin/python blender/build.py            # export only, from the kept bake; seconds
```

What `--bake` does:

1. Builds the scene. Every scenery face gets its own rectangle in its group's 1024 px lightmap
   (second UV set). The scale is searched so everything just fits: 163 px per metre on the cabinet,
   70 on the room. Faces buried inside boxes, lamps and the controls' metal share one spare texel.
2. Adds bake-only lamps: a 1 m key panel up and left of the player, a thin lit slot in the ceiling
   over the cabinet, two weak cool fills. Turns the drawn lamps up (coves 12 times, light lines 25).
3. Bakes diffuse light without colour (1536 samples, Metal GPU) to `blender/bake/lm_*.jpg`. A pixel
   of 1.0 is 6.0 units of light (`LM_WHITE`, also in `src/cabinet.rs`).
4. Bakes ambient occlusion (0.4 m) to `blender/bake/ao_*.jpg`.
5. Renders six cube faces from in front of the cabinet with the cabinet hidden, blurs them for each
   roughness, and writes `assets/env.bin` (128 px faces with all sizes, then an 8 px soft cube).
6. Rebuilds the scene clean and exports `assets/arcade.glb`. The four baked maps ride in the model
   on small hidden parts named `LM_<group>` and `AO_<group>`, so the web build still ships one file.

In the game:

- `src/cabinet.rs` `wire_model` gives each scenery mesh a `bevy::pbr::Lightmap` and an occlusion
  texture on the second UV set. `bevy_pbr` 0.20.1 binds one lightmap per draw without bindless
  textures, so this path exists on WebGL2.
- `src/room.rs` builds the cube from `env.bin` (compiled in) as the camera's `EnvironmentMapLight`.
  The shader has a WebGL2 path for it.
- The model is spawned a second time, flipped under a 76% opaque floor. That is the floor's reflection.
- Live lamps: the tube's green lamp, now just behind the glass; one spot at the key's position that
  adds only sheen to baked scenery and shapes the unbaked controls. No ambient light.
- `SHEEN` in `src/cabinet.rs` lowers reflectance on big matt parts.

What went wrong on the way, in order:

- First bake far too bright (coves at 70 times): every wall mirrored the coves and looked like brass.
- With one room picture for all reflections, corners and far walls get false light and the blacks
  go grey (5% luma 32 against the target's 7). Two fixes together brought it to 16: the occlusion
  map, and low reflectance on walls, ceiling and the tube's hood.
- The spare texel must be white in the occlusion map, or parts without a place go black.
- Panel lamps as glowing meshes lit the ceiling behind them. Each now has a black card behind it,
  and the ceiling takes no baked light.
- A big square lamp overhead shows in the tube glass as grey fog. A thin strip shows as a line.

## 5. Checks

```
cargo run -- --shot <dir>      # wide, approach, playing, hero, controls, floor
```

- Six rounds of captures. Image budget: 6 montages read by the main agent, 4 reviews by subagents
  with 4 images each, the rest by numbers (region means, percentiles).
- Hero view, 5% luma: before 13, now 16, target 7. Deck grain contrast (high-pass std): before 0.6, target 4.8.
- Last independent review: about 75% of the way to the target (was 65%); the cabinet alone 80 to 85%.

## Not verified

- **The web build.** Nothing here was run in a browser. The risk is the count of textures in one
  shader on WebGL2 (often 16): this pass adds a lightmap and two cube maps to each draw. Bevy's own
  warning for too many view textures did not fire natively.
- Phones, frame rate, and load time. Fetched at start: `arcade.glb` 1.9 MB. `env.bin` adds 0.5 MB to the wasm.

## Reuse for the next machine

- `blender/lines.py`, `blender/textures.py` and the bake half of `blender/build.py` are not about
  this cabinet. Name scenery `<Group>_<material>`, add the group to `GROUPS`, and it is baked.
- The texture prompt opening, with the real size of the sheet stated.
- Give Gemini the owner's picture first and the line art second, and ask for one view per picture.
- Put something bright and thin overhead for metal and glass to mirror.
- Budget: 7 pictures were enough for one machine and a room.
