# How a machine gets into the arcade

This is the process for adding a machine to the room, or redoing one. We run it many times, so each run should leave this file more exact than it found it. The log at the end records each run and what the owner said about it.

The order matters. Each step gives the next one something real to work from.

1. Game
2. Cabinet greybox
3. Wireframe for Gemini
4. Gemini art that matches the room
5. Blender design: texture and light
6. Physical controls
7. Sound
8. Wire it into the room
9. Review
10. Ship

## 1. Game

Write the game as plain logic first, with no drawing and no engine types it does not need.

- One file, `src/<machine>.rs`. State, input methods, `step(dt)`, and queries for whatever the display shows.
- The game reports what happened as bits in a `happened` field (a shot, a hit, a win). Sound and vibration hang off these later. See `SOUND_` in `src/pad.rs`.
- Unit tests for the rules. A machine that plays against the visitor needs a test that its best level never loses and its easiest level can be beaten.
- Keep it true to the original machine. Read about it first and name the sources in the module's doc comment.

## 2. Cabinet greybox

Build the cabinet's shape in Blender from a script, before any art.

- One script per model: `blender/<name>.py` writes `assets/<name>.glb`. Run it with Blender's Python module, not the app: `~/_agent_scratch/ringbench/.bpy/bin/python blender/<name>.py`. `import bpy` must come before `import bmesh`.
- Write it in the game's coordinates: metres, Y up, the machine at its own origin facing +Z. The helpers in `blender/build.py` convert.
- Give every part the game will move or light its own named node (`Knob_Elevation`, `Button_Fire`, `Lamp_X_0`). Join the rest into one mesh per material.
- Put the controls where a standing visitor's hands are: a deck near y = 1.0, z = 0.4. The seat camera for the first cabinet is at (0, 1.52, 1.12) looking at (0, 1.33, 0.16).
- Check the result by numbers: node names, bounding boxes, file size.

## 3. Wireframe for Gemini

Gemini keeps a shape best when it is given the shape as a drawing.

- Render line art and a depth pass of the greybox from the views you want art of: a hero three-quarter view, the playing view, a wide room view. `reference/` holds the first cabinet's (`*_lines.png`, `*_depth.png`; near is white).
- Match the aspect ratio you will ask Gemini for.

## 4. Gemini art that matches the room

Two kinds of image come from Gemini: pictures of the target, and the textures themselves.

- Every image goes through the wrapper. Never call the API directly.
  ```
  cd ~/Desktop/zpkt/contrib/harness
  uv run harness images gen "<prompt>" --context "<why, one sentence>" --batch <batch> --input <style ref> --input <lines.png>
  ```
  The wrapper keeps each image with its prompt and settings and shows them on the wall: `https://anthonys-mac-mini.tail771736.ts.net/studio/images/?batch=<batch>`. Rules: `~/Desktop/zpkt/contrib/docs/images.md`.
- **Target pictures.** Inputs: the room's current art as the style reference (the owner's picture of the first cabinet, or a current render) and the line art. Ask for the same layout, proportions and camera as the drawing. These pin down materials and light before any modelling.
- **Textures.** Ask for seamless, evenly lit, square material swatches: the wood, the metal, the floor, the wall. Check that they tile by comparing opposite edges, and fix the seams before use.
- Originals stay on the Mac. A derived asset may be committed if it is small (1024 px or less, about 300 KB or less). List each in `assets/ART.md` with the id of the image it came from.

## 5. Blender design: texture and light

This is where most of the look is won or lost. The owner's standing note: focus on texture and lighting.

- Apply the textures with real scale and deliberate grain direction.
- The game runs on WebGL2 on phones. It has no reflections, no bounce light and no soft shadows of its own. Whatever the picture needs of those is baked in Blender with Cycles and shipped as data.
- The method for the bake, its commands and its timings are in `LOOK_NOTES.md`. Follow that file and keep it current.
- Budget: everything the page fetches at start, apart from the game binary, stays under about 4 MB.

## 6. Physical controls

A visitor works the machine's own controls. Nothing floats over the picture.

- Each control is a named node in the model. The game turns or sinks that node.
- Controls are heavy. Knobs move in notches and spring onto each one with a little overshoot. Buttons drop fast and return slowly.
- A knob and the thing it moves turn the same way. The first cabinet's elevation pointer lies along the beam.
- On touch screens the page lays its targets over the machine's own controls, at positions the game reports each frame (`pad_points`). A slide turns a knob by the distance travelled, on any path.
- The game puts no words on the screen. The score is part of the machine: marks on the tube, lamps on a panel. The page shows one quiet line of key prompts for keyboard players and buttons for touch.

## 7. Sound

The page plays recorded files. The game only says what happened.

- Each `SOUND_` bit names an event. `web/index.html` maps the bits to names and plays `sounds/<file>` from `sounds/sounds.json`. Takes named `x-1`, `x-2` are played in turn. `hum` loops, louder the nearer the visitor stands.
- Sounds are built from recorded foley and old-equipment textures (static, amp hum, radio crackle, switches, latches), not synthesised.
- How the files are made is not settled yet. See the log.

## 8. Wire it into the room

- A plugin in `src/main.rs`. The machine spawns its model and wires the named nodes when the model is ready (see `wire_model` in `src/cabinet.rs`).
- Stepping up, leaving and the seat camera go through `Focus` in `src/player.rs`.
- The machine reports its state bits to the page (`pad_state`) so the page can offer the right buttons and prompts.
- `build-web.sh` copies the model into `dist/assets/`.

## 9. Review

- `cargo run -- --shot <dir>` renders fixed views with no window. Add a view per machine.
- Images are rationed: at most 6 read into one thread, each 800 px wide or less. Check by numbers first. Hand visual comparison to a subagent with its own budget and ask for a written report against the target picture.
- Touch is tested in headless WebKit with an iPhone profile and scripted pointer events. The page's `window.__knob` hook reports what a slide sent to the game.
- The owner judges. Show small steps often. A model's opinion of a picture is not his.

## 10. Ship

```
./build-web.sh
npx wrangler deploy
```

Then a pull request to `main` with the source. Built output and audio never go in git.

## Log

### Run 1: Cathode-Ray Tube Amusement Device, first Blender pass (12 November 2026)

- Did: steps 2, 5 (procedural textures, runtime lights only), 6, part of 7 (events and player, no files), 9, 10. Skipped 3 and 4.
- Owner: "That HUD is ass and the planes look too big. TBH the wood and control knobs don't look good either. It's a step in the right direction but I want it to be much better, focus on texture and lighting."
- Changed because of it: the text HUD is gone (score on the tube, prompts on the page); planes are smaller; steps 3 and 4 are now required; step 5 bakes its light.

### Run 2: the same cabinet, texture and light (in progress)

### Run 3: Bertie the Brain (in progress)
