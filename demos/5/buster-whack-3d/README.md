# Buster Whack 3D (demo 5)

A movement, aiming and camera prototype: the buster from demo 4 rebuilt as
a low-poly 3D humanoid on the same 3x6 tile board, hopping one square at a
time with the game's crouch / arc / land-squash phases, firing a buster that
aims down the lane, in four ways, eight ways or anywhere, at rotters that
fire back. That's **sandbox**, the default — free play, no clock, no score,
no towers, the step, the strafe, the shot and the camera, and how the body
sells each. `?mode=advance` (or `M`, or the MODE chip) switches to
**story / advance mode**, the 2D original's endless-road ruleset built on
the same rig, with its own start card, hit-stop and score popups, chain
flourishes, and an arena-taken announcement: see below.

The pad's MODE / AIM / CAM / LOCK chips are the control *and* the readout —
each is a two-line button, a dim label over the live value, that pings and
badges itself with *how* it changed (a key, a tap, the wheel) whatever
touched it. That, and the rest of the mobile-facing layout, is covered under
Controls.

Files:

- `index.html` — the page; mounts `main.js` into a full-window canvas and
  carries the HUD readouts and the on-screen pad (mode chips, LOCK, FIRE).
- `main.js` — the whole prototype: board, rigged character, pose curves,
  aiming and the lock, the buster and its shots, the rotters and their
  bolts, the cameras, input (keys, mouse, tap-to-move, two sticks), the
  chips' announce/ping wiring, advance mode's cards (start/pause/game
  over), the juice (hit-stop, popups, debris, tracers...), render loop.
- `three.module.min.js` + `three.core.min.js` — Three.js r185
  (`three@0.185.1`, MIT), copied from the npm build unchanged so the demo
  ships with no runtime CDN, the way this site's demos do. Since r170 the
  module build is a thin wrapper that imports `./three.core.min.js`, so the
  two travel together. To update, install the new version and copy both
  files from `node_modules/three/build/` over these.

## Controls

Two sticks. The left one hops; the right one points the barrel — except in
**lane** aim, the default, where there is no right stick: the barrel just
stays down the lane and every hop is a pure strafe.

| | keyboard / mouse | touch |
| --- | --- | --- |
| hop | `WASD` (held keys chain hops at the ration) | tap a square, or drag on the board as a stick |
| aim | arrow keys, or hover the mouse (ignored in lane mode) | a second finger anywhere, as a stick (ignored in lane mode) |
| fire | `Space` / `J` / right mouse button; hold to charge, release for the strong shot | the FIRE button; hold to charge |
| lock | hold `Shift`, or `L` to toggle | the LOCK chip |
| aim mode | `1` lane, `2` four ways, `3` eight ways, `4` free; `Tab` cycles | the AIM chip |
| camera | `C` cycles; `Q`/`E` turn, `R`/`F` tilt and the wheel zooms the orbit | the CAM chip; ◄ ► in orbit |
| mode | `M` toggles sandbox / story | the MODE chip |
| talk | `T`, beside a tower's keeper | the TALK chip (appears when near one) |
| pause | `P` or `Escape`; resume the same way, or with FIRE | — |
| start / resume (cards) | `Space` / `J` / `Enter` | the FIRE button |
| retry (game over) | `Enter` or `R` | the RETRY button on the card |

Movement is read relative to the camera — screen-up is the way the camera
looks — so under the orbit and shoulder cameras the thumb still means what
it says. `?aim=lane|4|8|free`, `?cam=fixed|follow|orbit|shoulder|top` and
`?mode=sandbox|advance` set the starting modes; `?slow=N` runs the clock at
1/N for looking at the poses.

### The chips

The MODE / AIM / CAM / LOCK buttons on the pad are chips, not plain
buttons: a dim label (`MODE`, `AIM`, ...) over the live value in bright
text, so the control doubles as its own readout and the top HUD doesn't
have to repeat it — the only things left up there are the run's own numbers
(busted/hit, or LEVEL + the clock pips + the chain) and, past 900px wide, a
phase/tile debug pair. Whatever changes a chip — a key, a tap, the on-screen
button, the wheel switching to orbit, even a starting `?aim=`/`?cam=` on the
URL — pings it (a brief scale/border flash) and drops a small badge
(`key C`, `tap`, `shift`, `wheel`, `url`) naming how, for about a second.

### Aiming, and the strafe

The aim is an angle in the board plane, and the mode is how finely it may
be set: **lane** (the default) pins it to 0 — straight down the lane at the
enemy half — and ignores the arrow keys, the mouse and the aim stick
entirely, so every hop is a strafe; **4-dir** snaps to the board's axes,
**8-dir** adds the diagonals, **free** takes the angle as given. Left alone
in 4/8/free, a hop turns the body to face where it is going, as the 2D
buster turns; at rest for a beat it turns back to the enemy half (lane mode
keeps that same rest-time turn). While something is pointing the barrel —
a held arrow, a second thumb, a mouse that moved in the last second, or
lane mode holding it down the lane on principle — a hop leaves the barrel
where it is and only the legs go: that is the strafe, and the pose sells it
by turning the hips towards the step and the torso back by the same amount,
so the barrel stays on the aim. The **lock** is the strafe on purpose, and
works the same in every aim mode including lane: held, the barrel is kept
on the nearest rotter (a ring marks it and the sight turns red) whatever
the legs do, or simply held still when there is nothing to lock on. A faint
sight runs from the barrel along the aim at all times, brighter when the
aim is live, because free aim (and lane) has no lane markings of its own to
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
seconds once it leaves. It rises in 220ms and sinks in 180ms on a kill —
the 2D original's own numbers. It hops panel to panel the way the buster
does, and now and then it winds up (the rotor whines, the eye brightens,
the panel flashes red) and throws a bolt at where the buster is standing
*at that moment* — so a hop begun after the throw dodges it. Three shots
delete one, or one charged shot; the board keeps three alive, a new one
rising a beat after a deletion. A deletion freezes the sim for a beat
(hit-stop — longer for a charged kill, longer still if it also clears the
arena), throws a handful of dark debris, and pops the score (or `BUSTED`,
in sandbox) up from where it died. A hit on the buster flinches the body,
lights the armour red, shakes the camera, punches it back along the bolt's
own path and flashes a red vignette; the HUD counts both ways. All of that
juice is skipped under `prefers-reduced-motion: reduce`.

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
together; a small "WAVE k / n" caption announces each one dealt. Walking
into an arena wakes it (first wave 650 ms later; each next wave 550 ms
after the last one dies); clearing the pool flips the ground blue column by
column (60 ms apart, not all at once), pays the clock, and puts up a large
"ARENA n TAKEN +1.2s" banner for a beat. The basic virus is a one-shot
kill; from arena 5 on, roughly a third of a wave (half, from arena 20) is a
darker "steel" rotter at 3 hp, or one charged shot. Rotters only start
firing bolts back from arena 9.

**Starting, and pausing.** Entering advance mode (the URL, `M`, or the MODE
chip) puts up a start card — the controls, and "press FIRE to start" — and
the sim (the clock, the waves, the rotters) waits there until FIRE; RETRY
shows the same card rather than resuming immediately. `P` or `Escape`
pauses either mode at any time, freezing literally everything (the sim
clock itself stops, so no effect keeps playing underneath); FIRE, `P` or
`Escape` resume it.

**The clock.** No player health — the resource is a countdown, `timeLeft`,
starting at 30 s and capped at 45 s. It only drains while the active arena
is contested (entered, still the guard's) at `min(1.45, 1 + idx*0.02)` per
second. Clearing a wave pays back 0.4 s per virus in it; clearing an arena
pays 1.2 s. A hit costs 2.5 s and 800 ms of invulnerability, breaks the
chain (a falling "CHAIN LOST" popup and a red flash on the HUD counter),
and cancels a charge or an in-progress walk. Score is +100 per deletion
times a chain multiplier (×2/×3/×4 at chain 5/10/20, each step marked with
a ring burst and a yellow popup) — every deletion pops its own score (or
the multiplied total) up from where it died; the clock hitting zero freezes
the sim and puts up a card — arena reached, score, deletions, best chain,
accuracy — with RETRY (`Enter`/`R`, or the button) rebuilding the world
from scratch and putting the start card back up.

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

Hit-stop and pause both work the same way, underneath: `now()` — the one
clock everything in the game reads — is `performance.now()` minus an offset
that grows every time the sim is held still, so freezing it is just "the
offset grows to match the real time that passed". No phase, timer or `t -
t0` anywhere else has to know the sim ever stopped; the render loop is
untouched for a hit-stop (the frozen frame is the point — camera shake is
the one thing still driven off real per-frame time, so it visibly continues
through one) and, for a pause, `frame()` simply skips every update call
outright. Score popups are cached canvas-texture sprites (one texture per
unique string, reused across every "+100" or "BUSTED"), billboarded by
Three for free; debris is one shared tiny box geometry with a
`MeshBasicMaterial` per chunk, thrown with a little hand-rolled gravity and
one bounce.
