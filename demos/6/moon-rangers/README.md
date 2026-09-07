# Moon Rangers (demo 6)

A hoverbike ride across the surface of the moon. The ranger is standing on
a hover sled doing up to fifteen units a second, and the only thing on the
surface is boulders: go around them, or take them apart with the buster.

It is demo 5's buster taken off the board. [Buster Whack
3D](../../5/buster-whack-3d/) is a grid — columns, rows, one hop per
ration, and a square you either are on or are not. Take the columns and
rows away and the question changes from *which square* to *where, exactly,
and how fast*, and the answer that makes that a game rather than a free-fly
is the one rule this prototype is built on:

> **The ranger only ever moves to the right.**

Forward is not a choice. There is no brake and no reverse: the throttle
climbs on its own the longer you keep it clean, and the only axis you own is
*across* — a continuous, camera-relative slide left and right through
whatever the surface has left in the way. `ride.x` therefore only ever
grows, which is an invariant the rest of the code is allowed to assume: the
world stream drops everything behind the bike outright, because nothing is
ever coming back for it.

So the fight is with the terrain rather than with anything that fights back.
Nothing on the moon shoots at you. That is deliberate — the point of a
prototype is the feel of the ride and of the aim hanging off it, and the
enemies can come later.

## Files

- `index.html` — the page; mounts `main.js` into a full-window canvas and
  carries the HUD and the pad (AIM / CAM / LOCK chips, FIRE).
- `main.js` — the game: the ride and its one-way rule, the surface and how
  it is recycled, the boulders, the bike, the pose of a rider on it, the
  aim modes, the crash, the HUD copy.

Everything else comes from [`../../engine/`](../../engine/), which was
pulled out of demo 5 and is shared between the two: the sim clock and its
hit-stop, the stage, the rigged humanoid, the effects, the camera rig,
two-stick input, the chips, and the loop with its `simulate()`. Three.js is
vendored once there.

## Controls

| | keyboard / mouse | touch |
| --- | --- | --- |
| steer across | `A`/`D` under the chase camera; `W`/`S` under the side one — see below | drag on the surface as a stick, or tap where you want to be |
| fire | `Space` / `J` / right mouse button; hold to charge | the FIRE button; hold to charge |
| aim | arrow keys, or hover the mouse (free aim only) | a second finger anywhere, as a stick |
| lock | hold `Shift`, or `L` to toggle | the LOCK chip |
| aim mode | `1` ahead, `2` free; `Tab` cycles | the AIM chip |
| camera | `C` cycles; `Q`/`E` turn, `R`/`F` tilt, the wheel zooms the orbit | the CAM chip; ◄ ► in orbit |
| pause | `P` or `Escape` | — |

Steering is read through the camera: a held key or a drag becomes a ground
vector and only its *across-track* component survives, its along-track
component thrown away. So the keys that steer are whichever ones point
across the screen — `A`/`D` under the chase camera, `W`/`S` under the side
and top ones — and a thumb on a phone means the same thing under all four.

Under the chase camera that also means `W` and `S` do **nothing**, which is
the one-way rule showing up in the controls rather than only in the code:
under that camera "forward" on the stick points exactly down the track, and
forward is not yours to ask for. `?cam=chase|side|orbit|top`, `?aim=ahead|free` and `?slow=N`
set the starting state.

## The parts

**The ride.** `speed` climbs by `SPEED_RAMP` for every second you stay
upright, up to a ceiling, and a boulder knocks it to almost nothing. That
is the whole economy: a crash costs about ten seconds of throttle, and
getting it back is the only thing you are ever really playing for.
Recovering it *is* the mechanic, so the ramp has to be fast enough to feel
like a comeback rather than a punishment — the first cut ran at a quarter of
this and a single crash effectively ended the ride.

**The buster.** The same weapon as demo 5, retuned for a moving platform: a
shot has to comfortably outrun the bike or a forward shot would never leave
the muzzle, so it flies at better than twice cruise. Four or five shots
break a boulder, or one charge; each hit knocks a visible chip off it, so
four shots read as four shots rather than as three misses and a kill.

**The boulders.** Irregular icosahedra — the base solid with every vertex
pushed in or out along its own normal and squashed on the vertical, so no
two are the same and none of them reads as a ball. They are seeded a row at
a time ahead of the bike, and a row picks its *gap* first and places
boulders around it, so the track is never a wall: every crash is a line you
chose, not a line you were given.

**The aim.** Two modes rather than demo 5's four. "Ahead" pins the barrel
down the track, which is where someone doing fifteen units a second is
looking anyway; "free" lets the mouse or a second thumb point it anywhere,
and it drifts back down the track when nothing is asking. The lock is the
third way to aim and belongs to neither: it holds the barrel on the nearest
boulder *still ahead of you* and lets go the moment you pass it.

**The pose.** No hop curve and no idle — the base is one crouch over the
bars whose depth is the throttle, so the ranger's stance is the speedometer.
On top of it are the engine's shooting modifiers, the same set demo 5 uses:
the barrel arm held level, the left hand bracing a charge, the recoil, the
flinch. The twist runs backwards from demo 5's strafe — there, the legs turn
and the torso holds the barrel steady; here the *body* turns to the aim and
the twist takes the legs back to the bike's own line, because the ranger's
boots are on the plate whatever the barrel is doing.

**The chase camera** drops back and widens as the throttle climbs, which is
most of why fifteen units a second feels different from six. All four
framings set the engine's `tracks` flag: easing towards a point that is
running away at fifteen units a second otherwise leaves a permanent lag, and
the camera settles a fixed distance behind wherever it was aiming.

## Two things the vacuum decides, not the art direction

There is **no atmosphere to scatter light**, so the sun is a hard white key
with almost no fill and shadows that go to black, and the only reason the
shadowed side of anything reads at all is *earthshine* — the pale blue
bounce off the Earth sitting low over the track, which is also the fill
light and is deliberately placed inside the chase camera's frame. It is also
why the stars are out in full daylight, and why the horizon is a knife-sharp
line rather than a haze.

And **dust does not hang**. With no air to suspend it, every grain the
skirt kicks up flies a clean ballistic arc and lands — which is why the
engine's `dust()` grew a `gravity` option for this demo, and why the moon's
1.62 m/s² is what the debris falls at too. Those two notes are most of what
makes it read as *the moon* rather than as a grey desert.
