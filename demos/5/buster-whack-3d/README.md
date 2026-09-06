# Buster Whack 3D (demo 5)

A movement, aiming and camera prototype: the buster from demo 4 rebuilt as
a low-poly 3D humanoid on the same 3x6 tile board, hopping one square at a
time with the game's crouch / arc / land-squash phases, firing a buster that
aims in four ways, eight ways or anywhere, at rotters that fire back. That's
**sandbox**, the default — free play, no clock, no score, no towers, the
step, the strafe, the shot and the camera, and how the body sells each.
`?mode=advance` (or `M`) switches to **story / advance mode**, the 2D
original's endless-road ruleset built on the same rig: see below.

Files:

- `index.html` — the page; mounts `main.js` into a full-window canvas and
  carries the HUD readouts and the on-screen pad (mode chips, LOCK, FIRE).
- `main.js` — the whole prototype: board, rigged character, pose curves,
  aiming and the lock, the buster and its shots, the rotters and their
  bolts, the cameras, input (keys, mouse, tap-to-move, two sticks), render
  loop.
- `three.module.min.js` + `three.core.min.js` — Three.js r185
  (`three@0.185.1`, MIT), copied from the npm build unchanged so the demo
  ships with no runtime CDN, the way this site's demos do. Since r170 the
  module build is a thin wrapper that imports `./three.core.min.js`, so the
  two travel together. To update, install the new version and copy both
  files from `node_modules/three/build/` over these.

## Controls

Two sticks. The left one hops; the right one points the barrel.

| | keyboard / mouse | touch |
| --- | --- | --- |
| hop | `WASD` (held keys chain hops at the ration) | tap a square, or drag on the board as a stick |
| aim | arrow keys, or hover the mouse | a second finger anywhere, as a stick |
| fire | `Space` / `J` / right mouse button; hold to charge, release for the strong shot | the FIRE button; hold to charge |
| lock | hold `Shift`, or `L` to toggle | the LOCK button |
| aim mode | `1` four ways, `2` eight ways, `3` free; `Tab` cycles | the AIM button |
| camera | `C` cycles; `Q`/`E` turn, `R`/`F` tilt and the wheel zooms the orbit | the CAM button; ◄ ► in orbit |
| mode | `M` toggles sandbox / story | the MODE button |
| talk | `T`, beside a tower's keeper | the TALK button (appears when near one) |
| retry (game over) | `Enter` or `R` | the RETRY button on the card |

Movement is read relative to the camera — screen-up is the way the camera
looks — so under the orbit and shoulder cameras the thumb still means what
it says. `?aim=4|8|free`, `?cam=fixed|follow|orbit|shoulder|top` and
`?mode=sandbox|advance` set the starting modes; `?slow=N` runs the clock at
1/N for looking at the poses.

### Aiming, and the strafe

The aim is an angle in the board plane, and the mode is how finely it may
be set: **4-dir** snaps to the board's axes, **8-dir** adds the diagonals,
**free** takes the angle as given. Left alone, a hop turns the body to face
where it is going, as the 2D buster turns; at rest for a beat it turns back
to the enemy half. While something is pointing the barrel — a held arrow, a
second thumb, a mouse that moved in the last second — a hop leaves the
barrel where it is and only the legs go: that is the strafe, and the pose
sells it by turning the hips towards the step and the torso back by the
same amount, so the barrel stays on the aim. The **lock** is the strafe on
purpose: held, the barrel is kept on the nearest rotter (a ring marks it and
the sight turns red) whatever the legs do, or simply held still when there
is nothing to lock on. A faint sight runs from the barrel along the aim at
all times, brighter when the aim is live, because free aim has no lane to
read the shot from.

### The buster

A press fires a shot; holding charges, and a release after the charge time
fires the strong one — three times the damage, the whole rotter in one. The
recoil kicks the barrel arm and rocks the torso; the charge brings the left
hand across to brace the barrel and lights the muzzle. Shots and bolts are
spent a tile past the arena's edge so nothing streams off into the sky.

### Rotters

The first enemy. A rotter is a squat rotor — a cup, a dome, three blades
and one eye — that sits on a panel of the enemy half and **rots** it: the
rim goes from the half's red to a sick green under it, and heals in a few
seconds once it leaves. It hops panel to panel the way the buster does, and
now and then it winds up (the rotor whines, the eye brightens, the panel
flashes red) and throws a bolt at where the buster is standing *at that
moment* — so a hop begun after the throw dodges it. Three shots delete one,
or one charged shot; the board keeps three alive, a new one rising a beat
after a deletion. A hit on the buster flinches the body, lights the armour
red and shakes the camera, and the HUD counts both ways.

### Cameras

- **fixed** — the framing the prototype was built with, leaning a little
  towards the buster.
- **follow** — the same angle, closer, with the buster kept near the centre.
- **orbit** — around the board; turn, tilt and zoom are yours.
- **shoulder** — behind the buster, looking where the barrel looks, so the
  aim swings the view.
- **top** — straight down, following loosely.

Every camera eases towards where it wants to be, and the field of view
widens until all six columns fit (the shoulder camera excepted — it is not
framing the board).

## Story / advance mode

`?mode=advance`, `M`, or the MODE chip. Reproduces the 2D original's
endless-road ruleset on top of the same rig, board shape and rotter —
adapted where the prototype has only that one enemy.

**The world.** The fixed 3x6 board becomes the *shape* of one arena rather
than the whole world. A run starts `[tower(6 cols), arena idx 0]` and only
ever appends, laid along +x: clearing an arena appends a **road** (3 cols,
50% of the time a single narrow lane down row 1), then — if the next arena's
index is a multiple of 10 — a **tower**, then the next arena. Segments more
than ~14 columns behind the player are dropped to keep the scene bounded.

**Arenas.** An arena's left half is always player ground; its right half is
the guard's — red, unwalkable — until cleared. `pool = min(20, 4 +
idx*0.16)` viruses, dealt in waves of `min(5, 2 + idx/25)`, at most 6 alive
together. Walking into an arena wakes it (first wave 650 ms later; each
next wave 550 ms after the last one dies); clearing the pool flips the
ground blue with a ripple, a flash and a small camera shake. The basic
virus is a one-shot kill; from arena 5 on, roughly a third of a wave (half,
from arena 20) is a darker "steel" rotter at 3 hp, or one charged shot.
Rotters only start firing bolts back from arena 9.

**The clock.** No player health — the resource is a countdown, `timeLeft`,
starting at 30 s and capped at 45 s. It only drains while the active arena
is contested (entered, still the guard's) at `min(1.45, 1 + idx*0.02)` per
second. Clearing a wave pays back 0.4 s per virus in it; clearing an arena
pays 1.2 s. A hit costs 2.5 s and 800 ms of invulnerability, breaks the
chain, and cancels a charge or an in-progress walk. Score is +100 per
deletion times a chain multiplier (×2/×3/×4 at chain 5/10/20); the clock
hitting zero freezes the sim and puts up a card — arena reached, score,
deletions, best chain, accuracy — with RETRY (`Enter`/`R`, or the button)
rebuilding the world from scratch.

**Towers.** Every tenth arena is preceded by one, holding a **keeper** — a
cloaked figure on a staff, standing still with a slow sway — on its middle
tile. Standing beside it shows a TALK prompt; each press (`T`, or the TALK
button) advances one beat of a short, player-paced conversation, closing on
the last one. The first conversation of a run also hands out a small bonus
task (e.g. "take an arena without being hit"), tracked for real: completing
it pays +5 s and 500 points. Stepping onto a tower's ground for the first
time shows a one-shot "ROOST n" caption. (The 2D original's own dialogue
lives outside this repo and isn't reproduced — these lines are new, written
short, in the same terse voice.)

Camera, aim and the buster all work exactly as in sandbox; `fixed` and
`follow` additionally ease their look-at towards the active arena's centre
while it's fought over (never sliding back down the road), and `orbit`
circles the player instead of a fixed point.

## How it is built

The character is built from primitives in code (capsules, spheres, boxes),
not loaded from a model file, so the rig (hips → torso → head / arms,
hips → legs) is plain `THREE.Group` nesting and every pose is a handful of
rotations and offsets in `pose()`. It is modelled at human proportions and
scaled onto the board with `CHAR_SCALE`, so a square reads as a panel you
stand on. Timings live at the top of `main.js` beside the ones the 2D game
uses, so the two can be compared; the hop is now a 230 ms ration, between
the 2D game's 195 and the first cut's 340.

Nothing is loaded from disk besides Three itself. The soft discs (contact
shadow, dust, sparks, motes, the pool of light under the arena) and the sky
gradient are drawn with Canvas 2D at start-up, and the image-based lighting
comes from a tiny room of glowing panels run through `PMREMGenerator`.
