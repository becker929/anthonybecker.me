# The demo engine

A small 3D game engine with no game in it. It was not designed up front —
it was cut out of demo 5, [Buster Whack 3D](../5/buster-whack-3d/), when
demo 6, [Moon Rangers](../6/moon-rangers/), needed the same bones for a game
with none of the same rules. Building the second thing is what settled which
parts were engine and which were that first game's content; anything only
one demo has an opinion about stayed in the demo.

No build step, no bundler, no dependencies — plain ES modules the way the
rest of this site's demos work. Import the pieces you need directly, or the
lot through `index.js`:

```js
import { Clock, Stage, Effects, CameraRig, Input, Loop } from "../../engine/index.js";
```

Three.js comes from `three.js`, which re-exports the copy vendored in
`vendor/`. **Import Three through that one path everywhere** — engine
modules and demos alike — so every demo shares one copy on the wire and one
module instance, and `instanceof` holds across the engine/content seam.

## The modules

| | |
| --- | --- |
| `clock.js` | The sim clock, and the three ways of bending it: a slow-motion divisor, hit-stop, and pause. |
| `stage.js` | Renderer, scene, camera, lights, environment, ground, air. |
| `grid.js` | A board of tiles, keyed by (col, row) in a map so a world can grow in any direction. |
| `hopper.js` | Square-to-square movement: one hop per ration, and the path router over it. |
| `character.js` | The low-poly rigged humanoid, its idle and hop curves, and the shooting modifiers. |
| `effects.js` | Ground rings, dust, floating text, debris, tracers. |
| `camera.js` | The camera rig: framings, shake, a directional punch, and screen-to-ground. |
| `input.js` | Two sticks, however they are being held — keys, mouse, touch — and the FIRE hold-set. |
| `chips.js` | A pad button that is its own readout. |
| `loop.js` | The render loop, and the way a test drives the sim instead. |
| `textures.js` | Discs, gradients, tileable noise and world-space text, all drawn in code. |
| `math.js` | Scalars, easing and angles. The one module with no Three and no DOM in it. |

## Three things worth reading before you change anything

**Freezing lives in the clock, not in a flag.** `Clock.now()` is `rawNow()`
minus every millisecond the sim has been held still, so a hit-stop or a
pause is invisible to everything downstream: a hop's arc, an enemy's
telegraph, a countdown and a popup's fade all honour it for free. The
alternative — a `frozen` boolean threaded through every phase's `t - t0` —
is the same behaviour written out once per timer, and one of them will
always be missed.

**`Loop.simulate()` takes the clock over for good.** The first call hands
the sim to fixed virtual steps and real frames stop calling `update()` *and
stop rendering*. Three's own rAF loop keeps ticking regardless, so without
that the sim would advance twice — once for real and again through whatever
the test asked for. It also means a screenshot after a `simulate()` needs
another `simulate(..., render: true)`, not a `waitForTimeout`.

**Board angles.** Everywhere in the engine, an angle in the ground plane has
0 at +x and turns positive towards -z. `angleTo`, `aimDir` and every
"facing" value keep that convention; so does `boardVec`, which is how a
screen vector becomes a ground vector — screen-up is the way the camera
looks, flattened to the floor, which is what makes a thumb mean the same
thing under every camera.

## What is *not* here

Anything with an opinion about a game. There is no notion of an enemy, a
score, a health bar, a level, or a win. `TileGrid` paints tile kinds but has
no idea which are walkable; `Hopper` moves between squares but asks the game
whether a square is free; `Input` reports that a key went down but not what
it means; `CameraRig` ships five framings and takes whatever a demo wants to
add. Every one of those seams exists because demo 6 needed the other side of
it.

## Adding a third demo

Copy the wiring block at the top of either demo's `main.js` — they are the
same twenty lines with different numbers in them — and then write only the
rules. If you find yourself wanting to change an engine module to make your
game work, check first whether the thing you want is a *parameter* the
module should have been taking all along (most of them were), and whether
the change would alter demo 5's behaviour: that one is pinned by a
differential test that replays a scripted run against the pre-engine
version and requires every checkpoint to match to the digit.
