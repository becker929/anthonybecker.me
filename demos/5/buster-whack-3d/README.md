# Buster Whack 3D (demo 5)

A movement, aiming and camera prototype: the buster from demo 4 rebuilt as
a low-poly 3D humanoid on the same 3x6 tile board, hopping one square at a
time with the game's crouch / arc / land-squash phases, firing a buster that
aims down the lane, in four ways, eight ways or anywhere, at rotters that
fire back. That's **sandbox**, the default — free play, no clock, no score,
no towers, the step, the strafe, the shot and the camera, and how the body
sells each. `?mode=advance` (or `M`, or the MODE chip) switches to
**story / advance mode**, the 2D original's endless-road ruleset built on
the same rig — reproducing arenas 0-19 to the number: the mett/guard
roster, the six wave formations, hitscan shots and whiffs, the scoring and
clock economy, bombs, and a second tower with its own NPC and tasks. See
below.

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
| talk | `T`, beside a tower's keeper or tally | the TALK chip (appears when near one) |
| bomb | `B` | the BOMB chip (appears once one is stowed) |
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

`?mode=advance`, `M`, or the MODE chip. Reproduces the 2D original's story
mode for **arenas 0-19** to the number — the roster, the wave formations,
hitscan shots, scoring and the clock economy, bombs, and the tower before
arena 10 with its tasks — on top of the same rig and board shape. Arena 20
onward is where the 2D original introduces mechanics this prototype hasn't
built (runners, sentinels, retaliation), so the gates for those are wired
but never open in this span; the numbers below are what's actually live.

**The world.** The fixed 3x6 board becomes the *shape* of one arena rather
than the whole world. A run starts `[tower(6 cols), arena idx 0]` and only
ever appends, laid along +x: clearing an arena appends a **road** (3 cols,
50% of the time a single narrow lane down row 1), then — if the next arena's
index is a multiple of 10 — a **tower**, then the next arena. Segments more
than ~14 columns behind the player are dropped to keep the scene bounded.

**The roster.** Two enemy types cover 0-19, exactly the 2D original's own
unlock table for this span:
- **mett** — the rotter body, one hit, persistent. Rises in 220ms, sinks in
  180ms, and shuffles to a free tile of its own arena's guard-half every
  1.5s; it never enters the player's half and, before arena 30, never
  attacks.
- **guard** — a distinct steel look (a grey-blue tint, a heavier cup, no
  rotor blades — it never spins up, never winds anything). Only the
  formation's anchor slot may become one, from arena 10, at a 0.40 chance
  (0.48 from arena 16). It never moves and never attacks. A normal shot
  **plinks** it — sparks bounce back, a "GUARD" popup, a wobble, not a
  whiff, the chain untouched — only a charged shot deletes it, for 400
  points.

**Waves.** Each arena's `pool = min(20, 4 + idx*0.16)` viruses are dealt in
waves of `min(5, 2 + idx/25)`, at most 6 alive together. A wave is one of
six formations (spine, rank, stagger, pincer, wall, wedge), picked at
random and rotated 0-2 rows so the same shape reads differently each time;
its slots arrive staggered (420ms at the run's first wave, tightening to a
170ms floor), and a slot whose tile is taken — or the board full — simply
waits another 90ms rather than skipping the turn. One wave is live at a
time; the next comes 550ms after the last of the previous dies, until the
pool is spent and the arena's ground flips to the player's, column by
column (60ms apart).

**Shots are hitscan.** Firing casts a ray from the muzzle along the aim (in
**lane**, the default, that's always straight down the player's row) and
the first live enemy the ray crosses, strictly ahead, takes the hit
instantly — a bright tracer runs to the impact (or the board's edge) and
fades in 130ms, with its own muzzle flash (95ms normal, 140ms charged) and
impact spark (140ms). There's no pierce and no projectile mesh. A shot that
crosses nothing is a **whiff**: it breaks the chain (past 2, with the
falling "CHAIN LOST" popup) — a guard's plink is neither a whiff nor a
deletion. The charge hold is 700ms in advance mode (sandbox keeps 520ms).

**Scoring & the clock.** No player health — the resource is a countdown,
`timeLeft`, starting at 30s and capped at 45s, draining only while the
active arena is contested at `min(1.45, 1 + idx*0.02)` per second. A
deletion pays 100 (normal) / 300 (charged) / 400 (guard) points times a
chain multiplier (×2/×3/×4 at chain 5/10/20) plus time — 0.48s / 1.0s /
1.2s respectively, the 2D original's own per-kill pulse at this mode's 0.4
scale. A **perfect wave** (no whiff, no hit, the whole wave through) pops
its own "WAVE CLEAR" — 60 points per virus (times the chain multiplier) and
0.4 × (0.55s + 0.3s per virus). Clearing an arena pays a flat 1.2s. A hit
costs 2.5s and 800ms of invulnerability, breaking the chain and cancelling
a charge or an in-progress walk. The clock hitting zero freezes the sim and
puts up a card — a rank (S/A/B/C/D, from accuracy and best chain), arena
reached, score, deletions, best chain, accuracy — with RETRY rebuilding the
world from scratch.

**Boundaries, not banners.** Nothing announces an arena or a wave over the
board: the HUD's own level number pops (scale 1.3→1, 680ms) the instant the
player steps into the new arena — its value having already moved on the
moment the last one cleared. While an arena is contested the player is
boxed into its own three columns (no stepping back into ground already
behind); once cleared, the whole arena opens up.

**Bombs.** A small dark sphere with a lit fuse sits on a road tile —
guaranteed on the very first one, then roughly one road in three. Walking
onto it stows it (the HUD's BOMB chip, or key `B`, once one is held); using
it blasts the active arena's guard-half in a 3x3 centred on its middle,
deleting everything there — guards included — at normal-kill scoring
outside the shot economy (no chain change, no effect on accuracy).

**The tower before arena 10.** Every tenth arena is preceded by a tower.
The first one holds just its **keeper** — a cloaked figure on a staff,
standing still with a slow sway. From the second tower on, a second and
smaller NPC, **tally**, stands a tile over and just counts the run (it can
quote arenas taken, deletions, best chain). Standing beside either shows a
TALK prompt; each press (`T`, or the TALK button) opens that NPC's next
unfinished topic or advances it one beat, closing on the last one. Every
TALK also runs the **task exchange**, once per distinct NPC visited in a
row: it pays the active task if its target is met, hands the next undone
one if there isn't an active task, or does nothing. The tasks (in the order
they're handed out) are: take an arena clean (+3s), let three runners pass
(+4s — runners don't exist yet, so this one waits), break four guards
(+2000 pts), delete eight in a row without missing (+4s), clear three
perfect waves (+1 bomb), take six with a charge (+5s), break two open
sentinels (needs arena 50, also waits), and take five arenas (+6s) — task
rewards are paid in full, not scaled by the road's 0.4. (The 2D original's
own dialogue lives outside this repo and isn't reproduced — these lines are
new, written short, in the same terse voice.)

**Starting, and pausing.** Entering advance mode (the URL, `M`, or the MODE
chip) puts up a start card — the controls, and "press FIRE to start" — and
the sim (the clock, the waves, the rotters) waits there until FIRE; RETRY
shows the same card rather than resuming immediately. `P` or `Escape`
pauses either mode at any time, freezing literally everything (the sim
clock itself stops, so no effect keeps playing underneath); FIRE, `P` or
`Escape` resume it.

Camera, aim and the buster all work exactly as in sandbox; `fixed` and
`follow` additionally ease their look-at towards the active arena's centre
while it's fought over (never sliding back down the road), and `orbit`
circles the player instead of a fixed point.

**Sandbox is untouched.** Its rotters keep their own 3-hp state machine
(random sit/hop, the aim/bolt telegraph once it unlocks), its shots stay
real projectiles, and its counters (busted/hit) are exactly as before —
none of the above runs there.

### Driving it faster than real time

`window.__bw3d.simulate(ms, step = 16)` advances the sim in fixed virtual
steps with no rendering — `now()` (and everything built on it: hit-stop,
pause) reads that virtual clock for as long as it runs, so a script can
play through twenty arenas in milliseconds of wall time instead of minutes.
The rest of the console hook (`activeArena()`, `walkable()`, `world`,
`run`, `rotters`, `pressFire`/`releaseFire`/`moveTo`/`move`/`fire`,
`talk()`, `bomb()`) is enough to drive a whole run from outside; see
`story-playthrough.mjs` in this demo's test harness for a full arena
0-through-19 bot built on it.

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
