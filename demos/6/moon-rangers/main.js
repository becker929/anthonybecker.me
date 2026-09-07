/*!
 * Moon Rangers — a hoverbike prototype on the engine in ../../engine/.
 *
 * This is demo 5's buster taken off the board. Buster Whack's world is a
 * grid: columns, rows, one hop per ration, and a square you either are on
 * or are not. Take the columns and rows away and the question changes from
 * "which square" to "where, exactly, and how fast" — and the answer that
 * makes it a game rather than a free-fly is that the ranger only ever moves
 * one way. Forward is not a choice here. The bike drives itself down the
 * track at a speed that climbs the longer you keep it, and the only axis
 * you own is *across*: a continuous, camera-relative slide left and right
 * through whatever the surface has left lying in the way.
 *
 * So the fight is with the terrain rather than with anything that fights
 * back. The only obstacle is the boulder — big, immobile, and heavy enough
 * that hitting one costs you every metre per second you had earned. You can
 * go around it, or you can take it apart with the buster: four or five
 * shots, or one charge. Nothing on the moon shoots back, and nothing on the
 * moon is in a hurry; that is the whole of the ruleset, and it is meant to
 * be — the point of a prototype is the *feel* of the ride and the aim
 * hanging off it, and the enemies can come later.
 *
 * A few things the vacuum decides, not the art direction: there is no
 * atmosphere to scatter light, so the sun is a hard white key with almost
 * no fill and shadows that go to black, and the only reason the shadowed
 * side of anything reads at all is earthshine — the pale blue bounce off
 * the Earth sitting low in the sky, which is also the fill light. And dust
 * kicked up by the skirt does not hang: with nothing to suspend it, every
 * grain flies a clean ballistic arc and lands. Those are the two notes that
 * make it read as *the moon* rather than as a grey desert.
 *
 * WHAT IS IN THIS FILE, AND WHAT IS NOT. Everything here is Moon Rangers:
 * the ride and its one-way rule, the surface and how it is recycled under
 * a bike that never comes back, the boulders, the bike itself and the pose
 * of a rider on it, the aim modes, the crash, the HUD copy. The sim clock
 * and its hit-stop, the stage, the rigged humanoid, the effects, the camera
 * rig, two-stick input, the chips and the loop all come from
 * `../../engine/`, which was lifted out of demo 5 and is shared with it.
 */

import * as THREE from "../../engine/three.js";
import {
  Clock, watchReducedMotion, Stage, Effects, CameraRig, Input, Chips, Loop,
  buildCharacter, characterMaterials, applyPose, restPose, mesh, box, releasePadKeys, noiseTexture,
  clamp, clamp01, lerp, rand, randInt, approach, easeOutQuad, angleDelta, angleTo, aimDir,
} from "../../engine/index.js";

// ---------- the track ----------
// There is no grid. There is a corridor: a strip of surface `TRACK_HALF`
// wide either side of the line the bike is driving down, marked at the
// edges so it can be read at speed, and the ranger may be anywhere across
// it. Off the corridor is still surface — it just isn't the route, and the
// bike is held back onto it rather than allowed to wander off into terrain
// that was never seeded with anything to do.
const TRACK_HALF = 4.4;
const BIKE_RADIUS = 0.46;          // the hull's own collision circle, in world units
const HOVER_Y = 0.30;              // how high the skirt rides

// ---------- the ride ----------
// Forward is not a choice. `speed` only ever climbs (`SPEED_RAMP` per
// second of clean riding) or is knocked down by a crash — it is never
// negative, never zero, and there is no brake, which is the single rule
// that turns "a bike on a plain" into a game.
const SPEED_START = 6.5;           // world units per second
const SPEED_CRUISE = 15.5;         // the ceiling clean riding walks up to
const SPEED_RAMP = 0.85;           // units/s gained per second upright — a crash costs about ten seconds of it
const SPEED_CRASH = 4.0;           // what a boulder leaves you with
const SPEED_TAU = 320;             // ms; how fast the throttle chases its target
const STEER_MAX = 6.6;             // units per second across the track
const STEER_TAU = 130;             // ms; the slide's own inertia
const BANK_MAX = 0.42;             // radians the bike rolls into a slide
const BANK_TAU = 150;
const CRASH_HURT_MS = 950;         // invulnerable, and flinching, after a hit
const CRASH_KICK = 4.2;            // the sideways shove off the boulder
/** One world unit is two metres of surface — the distance readout's only claim. */
const METRES_PER_UNIT = 2;

// ---------- aiming ----------
// Two modes, not four: "ahead" pins the barrel down the track, which is
// where a rider doing sixteen units a second is looking anyway, and "free"
// lets the mouse, the arrow keys or a second thumb point it anywhere. The
// lock is the third way to aim and belongs to neither — it holds the barrel
// on the nearest boulder still ahead of you, and lets go when you pass it.
const AIM_MODES = ["ahead", "free"];
const AIM_HOLD_MS = 1200;          // a flick of aim input counts as "still aiming" this long
const TURN_MS = 70;                // the body chases the aim with this time constant
const TWIST_MAX = 0.95;            // how far the torso may turn off the bike's own line

// ---------- the buster ----------
// The same weapon as demo 5, retuned for a moving platform: a shot has to
// comfortably outrun the bike or a forward shot would never leave the
// muzzle, so it flies at better than twice cruise.
const FIRE_COOLDOWN_MS = 150;
const CHARGE_MS = 560;
const SHOT_SPEED = 34 / 1000;      // world units per ms
const CHARGED_SPEED = 42 / 1000;
const SHOT_DMG = 1, CHARGED_DMG = 6;
const SHOT_RADIUS = 0.1, CHARGED_RADIUS = 0.26;
const SHOT_RANGE = 42;             // units from the muzzle before it is spent
const RECOIL_MS = 130;

// ---------- boulders ----------
// The only obstacle. Seeded a row at a time ahead of the bike, always with
// one gap wide enough to take at speed, so the track is never a wall —
// every crash is a line you picked, not a line you were given.
const ROCK_MIN_R = 0.55, ROCK_MAX_R = 1.55;
const ROW_GAP = 7.2;               // units of track between one row of boulders and the next
const ROW_GAP_JITTER = 2.6;
const ROW_ROCKS = [1, 3];          // how many boulders a row may hold
const GAP_HALF = 1.5;              // the guaranteed hole through every row, half-width
const SPAWN_AHEAD = 88;            // seeded this far in front of the bike — past the fog, so nothing is ever seen to appear
const DESPAWN_BEHIND = 16;         // and dropped this far behind it
/** A boulder's hit points from its radius: three shots for a pebble, six for the big ones — or one charge for anything. */
const rockHp = (r) => 2 + Math.round(r * 2.6);

// ---------- the surface ----------
// Craters and scatter, recycled the same way the boulders are. None of it
// collides; it is there so the speed has something to be measured against.
const CRATER_EVERY = 9;            // units of track per crater, jittered
const SCATTER_EVERY = 2.4;         // and per pebble
const GROUND_TILE = 7;             // the noise texture's repeat, in world units

// ---------- camera ----------
const CAM_MODES = ["chase", "side", "orbit", "top"];
const STICK_DEAD_PX = 26;

// ---------- juice ----------
const HITSTOP_ROCK = 60;           // a boulder broken
const HITSTOP_CHARGED = 100;
const HITSTOP_CRASH = 110;
const MAX_HITSTOP = 150;
const POPUP_MS = 700;
const POPUP_RISE = 0.55;
const PUNCH_MS = 260;
const PUNCH_DIST = 0.16;
const DEBRIS_MS = 700;
const DEBRIS_GRAVITY = 1.62;       // the moon's, in units/s² — a sixth of demo 5's, and it shows
const TRACER_MS = 170;
const MILESTONE_M = 500;           // a caption every this many metres

// ---------- palette ----------
// Regolith is a mid grey that goes almost white where the sun catches it
// and to nothing where it does not. Against that, the ranger is a white EVA
// suit with a gold visor and an orange livery, and the only cool colours in
// the scene are the bike's underglow and the Earth.
const PAL = {
  sky: 0x04050a, fog: 0x05060a,
  regolith: "#4a473f", regolithLight: "rgba(255,248,232,0.10)", regolithDark: "rgba(0,0,0,0.22)",
  rock: 0x6f6c65, rockDark: 0x4b4842, rockLit: 0x949086,
  crater: 0x3f3d37, craterRim: 0x726e66,
  hull: 0x3c4a5f, hullDark: 0x1d2532, trim: 0xff8a3d,
  glow: 0x59d8ff, thruster: 0xffb066,
  armor: 0xe8ecf2, armorDark: 0x9aa3b2, suit: 0x1a1f2b, visor: 0xffb347, barrel: 0xff8a3d,
  shot: 0xffd08a, charged: 0xbfe9ff,
  dust: 0xb9b3a6,
  earth: 0x5aa2ff, earthDark: 0x2b4f8f, ridge: 0x2a2b33,
  hurt: 0xff5a46,
};

// ---------- the engine, wired for this game ----------

const params = new URLSearchParams(location.search);
/** `?slow=4` runs the clock at a quarter speed: the same ride, stretched, for looking at the pose and the dust. */
const SLOW = Math.max(1, Number(params.get("slow")) || 1);

let REDUCED_MOTION = watchReducedMotion((on) => { REDUCED_MOTION = on; clock.reducedMotion = on; });
const clock = new Clock({ slow: SLOW, maxHitStop: MAX_HITSTOP, reducedMotion: REDUCED_MOTION });
const now = () => clock.now();

const container = document.getElementById("stage");
const $ = (id) => document.getElementById(id);

// Vacuum lighting: one hard white sun, no atmospheric fill worth the name,
// and a pale blue earthshine off to the side doing the only job a fill
// light does here. The environment room is nearly black for the same
// reason — there are no walls out there to bounce anything.
const stage = new Stage(container, {
  sky: [[0, "#020306"], [0.62, "#05070d"], [0.82, "#080a12"], [1, "#0b0d16"]],
  fog: { color: PAL.fog, near: 34, far: 82 },
  ground: null,          // the surface is built below, and follows the bike
  motes: null,           // no air: nothing hangs in it (the skirt's dust is ballistic, see kickDust)
  camera: { fov: 42, near: 0.1, far: 220 },
  env: {
    intensity: 0.35,
    wall: 0x03040a,
    panels: [
      [0xffffff, 14, [-14, 16, 10], [7, 0.2, 7]],     // the sun
      [0x5aa2ff, 2.2, [16, 7, -12], [0.2, 6, 8]],     // earthshine, the only fill there is
      [0x6f6a60, 1.1, [0, -6, 0], [40, 0.2, 40]],     // the regolith's own bounce, which is real and strong
    ],
  },
  lights: {
    hemi: [0x2a3550, 0x120f0c, 0.18],
    key: { color: 0xfff6ea, intensity: 3.4, position: [-9, 12, 7], shadowBox: { near: 2, far: 46, left: -16, right: 16, top: 14, bottom: -14 } },
    rim: { color: 0x5aa2ff, intensity: 0.45, position: [12, 4, -9] },
    fill: { color: 0x6a7186, intensity: 0.12, position: [4, 3, 9] },
  },
});
const { scene, renderer, camera } = stage;
const discTex = stage.discTex, shadowTex = stage.shadowTex;
/** This frame's length in ms, as every drift, spring and arc in the game reads it. Written once per frame by `updateFrame`. */
let frameDt = 16;

const fx = new Effects(scene, clock, discTex);
const ripple = (x, z, color, scaleTo, ms) => fx.ripple(x, z, color, scaleTo, ms);
const dust = (x, z, count, speed, opts) => fx.dust(x, z, count, speed, opts);
const popup = (x, z, text, opts) => fx.popup(x, z, text, { ms: POPUP_MS, rise: POPUP_RISE, ...opts });

const chips = new Chips(["aim", "cam", "lock"], $);
const announce = (id, value, via) => chips.announce(id, value, via);

const hud = {
  dist: $("hud-dist"), rocks: $("hud-rocks"), crashes: $("hud-crashes"),
  speedFill: $("hud-speed-fill"),
  fire: $("btn-fire"), orbit: $("pad-orbit"),
  caption: $("hud-caption"), vignette: $("vignette"),
};

/**
 * The chase camera: behind the bike and a little above it, looking down the
 * track past the rider's shoulder. It is the engine's `shoulder` framing in
 * spirit but pinned to the *track* rather than to the aim — a camera that
 * swung with a free aim at this speed would be unridable — and it drops
 * back and widens as the throttle climbs, which is most of why fifteen
 * units a second feels different from six.
 */
const chaseFrame = {
  rate: 170,
  fov: 58,
  tracks: true,
  place({ focus, rig }, want, wantT) {
    const back = lerp(4.6, 6.8, rig._speedU);
    const high = lerp(1.9, 2.5, rig._speedU);
    wantT.set(focus.x + 7.5, 0.75, focus.z * 0.55);
    want.set(focus.x - back, high, focus.z * 0.55);
  },
};

const rig3 = new CameraRig(camera, {
  frames: {
    chase: chaseFrame,
    // out past the widest thing that ever spawns, so nothing crosses the
    // lens, and leading the bike so the road ahead is what you watch
    side: { rate: 240, tracks: true, place({ focus }, want, wantT) { wantT.set(focus.x + 3.5, 0.8, 0); want.set(focus.x - 1.5, 4.4, 17); } },
    // the engine's own orbit turns around a fixed point; this one turns
    // around the bike, wherever on the track it happens to be
    orbit: {
      rate: 130, tracks: true,
      place({ focus, rig }, want, wantT) {
        wantT.set(focus.x, 0.5, focus.z);
        const cp = Math.cos(rig.pitch);
        want.set(Math.sin(rig.yaw) * cp * rig.dist, Math.sin(rig.pitch) * rig.dist, Math.cos(rig.yaw) * cp * rig.dist).add(wantT);
      },
    },
    // the engine's own `top` frames a board centred on the origin, which is
    // not what a track running out to a thousand units needs: this one just
    // sits over the bike, pushed a little forward so the road ahead gets
    // more of the screen than the road behind
    top: { rate: 260, tracks: true, place({ focus }, want, wantT) { wantT.set(focus.x + 6, 0, focus.z * 0.4); want.set(focus.x + 6, 22, focus.z * 0.4 + 0.9); } },
  },
  modes: CAM_MODES,
  mode: CAM_MODES.includes(params.get("cam")) ? params.get("cam") : "chase",
  lookAt: new THREE.Vector3(0, 0.5, 0),
  fitWidth: TRACK_HALF * 2 + 2,
  fovRange: [42, 95],
  punchMs: PUNCH_MS, punchDist: PUNCH_DIST,
  onModeChange: (m, via) => { hud.orbit.hidden = m !== "orbit"; announce("cam", m, via); },
});
rig3._speedU = 0;      // 0..1 throttle, read by the chase framing above
rig3.dist = 9.5;       // the orbit starts far enough out to see a whole row of boulders
stage.onResize = () => rig3.fitFov();
const cam = rig3;
function shakeCam(amount) { if (!REDUCED_MOTION) rig3.bump(amount); }
function triggerCamPunch(vx, vz) { if (!REDUCED_MOTION) rig3.punch(vx, vz, now()); }
function flashVignette() {
  if (REDUCED_MOTION) return;
  hud.vignette.classList.remove("flash");
  void hud.vignette.offsetWidth;
  hud.vignette.classList.add("flash");
}

// ---------- the sky ----------
// No atmosphere means the stars are out in full daylight — which is the
// single most useful thing about setting a ride here, because a black sky
// full of stars gives the speed something to be measured against overhead
// as well as underfoot. The field is a point cloud on a big sphere, parented
// to nothing and simply moved with the bike so it never runs out.

const STARS = 1400;
function buildStars() {
  const pos = new Float32Array(STARS * 3);
  const col = new Float32Array(STARS * 3);
  const c = new THREE.Color();
  for (let i = 0; i < STARS; i++) {
    // upper hemisphere only, and never near the horizon, where the ground is
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(rand(0.06, 1));
    const r = 150;
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    pos[i * 3 + 1] = Math.cos(ph) * r;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    c.setHSL(rand(0.55, 0.68), rand(0, 0.35), rand(0.55, 1));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    map: discTex, size: 1.5, sizeAttenuation: true, vertexColors: true,
    transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  scene.add(pts);
  return pts;
}
const stars = buildStars();

/** Earth, low over the track and slightly gibbous — the fill light's own source, made visible. */
function buildEarth() {
  const g = new THREE.Group();
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 32, 24),
    new THREE.MeshBasicMaterial({ color: PAL.earth, fog: false }),
  );
  // the terminator: a dark cap turned away from the sun, so it reads as a
  // lit body rather than a blue dot
  const night = new THREE.Mesh(
    new THREE.SphereGeometry(3.42, 32, 24, 0, Math.PI * 2, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x060a16, fog: false, side: THREE.FrontSide, transparent: true, opacity: 0.92 }),
  );
  night.rotation.z = 1.15;
  night.scale.set(1, 1, 0.52);
  g.add(globe); g.add(night);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, color: PAL.earth, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.setScalar(13);
  g.add(halo);
  g.position.set(150, 30, -62);
  scene.add(g);
  return g;
}
const earth = buildEarth();

/**
 * The horizon: a ring of low peaks a long way out, drawn as one flat
 * silhouette with no lighting and no fog, and moved with the bike so it
 * never gets any closer. It is parallax at infinity — the thing that makes
 * a ride read as covering ground rather than as a treadmill, because the
 * ground rushing past has nothing to be measured against on its own.
 *
 * The moon's horizon really is close and really is knife-sharp (no air to
 * soften it), so this is a hard edge against the stars rather than a haze.
 */
function buildRidge() {
  const R = 165, teeth = 300;
  // A random walk, not independent draws: neighbouring heights are related,
  // which is the difference between a range and a comb. The walk is closed
  // by easing the last stretch back to where it started, so the ring has no
  // seam to find.
  const hs = new Float32Array(teeth + 1);
  hs[0] = 7;
  for (let i = 1; i <= teeth; i++) hs[i] = clamp(hs[i - 1] + rand(-3.2, 3.2), 0.8, 26);
  for (let i = 0; i <= teeth; i++) {
    const w = i / teeth;
    if (w > 0.9) hs[i] = lerp(hs[i], hs[0], (w - 0.9) / 0.1);
  }
  const pos = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2, a1 = ((i + 1) / teeth) * Math.PI * 2;
    const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R;
    const x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
    const h0 = hs[i], h1 = hs[i + 1];
    pos.push(x0, -2, z0, x1, -2, z1, x1, h1, z1);
    pos.push(x0, -2, z0, x1, h1, z1, x0, h0, z0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: PAL.ridge, side: THREE.DoubleSide, fog: false }));
  scene.add(m);
  return m;
}
const ridge = buildRidge();

// ---------- the surface ----------
// One big plane of regolith that is *moved* under the bike rather than
// extended: the noise texture is offset by exactly as much as the plane
// moves, so the grain stays nailed to the world while the geometry never
// runs out. Everything with a shape — craters, scatter, the edge markers —
// is seeded a row at a time ahead and dropped behind, which is the same
// recycling the boulders use.

const groundTex = noiseTexture({ size: 512, base: PAL.regolith, light: PAL.regolithLight, dark: PAL.regolithDark, specks: 22000, repeat: 1 });
const GROUND_SIZE = 260;
groundTex.repeat.set(GROUND_SIZE / GROUND_TILE, GROUND_SIZE / GROUND_TILE);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
  new THREE.MeshStandardMaterial({ map: groundTex, color: 0xffffff, roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/** The corridor's edges: a pair of dim strips the eye can read the track's width off at speed. */
function buildTrackEdges() {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_SIZE, 0.09),
      new THREE.MeshBasicMaterial({ color: PAL.trim, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.012, side * TRACK_HALF);
    g.add(m);
  }
  scene.add(g);
  return g;
}
const trackEdges = buildTrackEdges();

const craterGeo = new THREE.RingGeometry(0.55, 1, 24);
const craterFloorGeo = new THREE.CircleGeometry(0.62, 20);
const matCraterRim = new THREE.MeshStandardMaterial({ color: PAL.craterRim, roughness: 1, metalness: 0, side: THREE.DoubleSide });
const matCraterFloor = new THREE.MeshStandardMaterial({ color: PAL.crater, roughness: 1, metalness: 0 });
const scatterGeo = new THREE.IcosahedronGeometry(1, 0);
const matScatter = new THREE.MeshStandardMaterial({ color: PAL.rock, roughness: 0.95, metalness: 0 });
const matScatterDark = new THREE.MeshStandardMaterial({ color: PAL.rockDark, roughness: 0.95, metalness: 0 });

/** Everything scenic, in one list, so one pass recycles it: `{ g, x }`. */
const props = [];
let nextCraterX = 0, nextScatterX = 0;

function addCrater(x) {
  const g = new THREE.Group();
  const s = rand(0.9, 3.4);
  const rim = new THREE.Mesh(craterGeo, matCraterRim);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.014;
  const floor = new THREE.Mesh(craterFloorGeo, matCraterFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.008;
  g.add(rim); g.add(floor);
  g.scale.set(s, 1, s);
  // craters go anywhere but the middle of the track, where they would read
  // as an obstacle the bike then sails straight over
  const z = (Math.random() < 0.5 ? -1 : 1) * rand(TRACK_HALF * 0.55, TRACK_HALF * 3.4);
  g.position.set(x, 0, z);
  g.rotation.y = rand(0, Math.PI);
  scene.add(g);
  props.push({ g, x });
}

function addScatter(x) {
  const r = rand(0.05, 0.17);
  const m = new THREE.Mesh(scatterGeo, Math.random() < 0.45 ? matScatterDark : matScatter);
  m.scale.set(r * rand(0.8, 1.3), r * rand(0.5, 0.9), r * rand(0.8, 1.3));
  m.position.set(x, r * 0.35, rand(-TRACK_HALF * 3.2, TRACK_HALF * 3.2));
  m.rotation.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  props.push({ g: m, x });
}

function disposeProp(p) {
  scene.remove(p.g);
  // geometries and materials here are all shared; only the groups go
}

// ---------- boulders ----------
// An irregular icosahedron: the base solid with every vertex pushed in or
// out along its own normal, so no two are the same shape and none of them
// reads as a ball. Each one gets its own geometry (they are all different)
// but shares one of two materials.

const matRock = new THREE.MeshStandardMaterial({ color: PAL.rock, roughness: 0.97, metalness: 0, emissive: 0x000000 });
const matRockDark = new THREE.MeshStandardMaterial({ color: PAL.rockDark, roughness: 0.97, metalness: 0, emissive: 0x000000 });

function boulderGeometry(r) {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(rand(0.74, 1.2));
    pos.setXYZ(i, v.x, v.y * rand(0.55, 0.85), v.z);   // squat: a boulder sitting, not a rock floating
  }
  geo.computeVertexNormals();
  return geo;
}

const rocks = [];
function spawnRock(x, z, r) {
  const geo = boulderGeometry(r);
  const mat = (Math.random() < 0.4 ? matRockDark : matRock).clone();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.rotation.set(rand(-0.2, 0.2), rand(0, 6.3), rand(-0.2, 0.2));
  m.position.set(x, r * 0.42, z);
  scene.add(m);
  const rock = { m, geo, mat, x, z, r, hp: rockHp(r), hp0: rockHp(r), flashUntil: -1e9, dead: false };
  rocks.push(rock);
  return rock;
}
function disposeRock(rock) {
  scene.remove(rock.m);
  rock.geo.dispose();
  rock.mat.dispose();
}

/**
 * Seed one row of boulders. A gap is chosen first and the boulders are
 * placed around it, so however the row comes out there is always a line
 * through it — the track is never a wall, and a crash is always a line the
 * rider picked rather than one they were handed.
 */
let nextRowX = 22;      // a clear run-in to get moving, then rows all the way out to the horizon
function seedRow(x) {
  const gapZ = rand(-TRACK_HALF + GAP_HALF, TRACK_HALF - GAP_HALF);
  const n = randInt(ROW_ROCKS[0], ROW_ROCKS[1]);
  for (let i = 0; i < n; i++) {
    let z = 0, tries = 0;
    do { z = rand(-TRACK_HALF - 0.6, TRACK_HALF + 0.6); tries++; }
    while (Math.abs(z - gapZ) < GAP_HALF + ROCK_MAX_R && tries < 24);
    if (Math.abs(z - gapZ) < GAP_HALF) continue;     // the gap wins ties
    const r = rand(ROCK_MIN_R, ROCK_MAX_R);
    // never right on top of one already placed in this row
    if (rocks.some((o) => Math.abs(o.x - x) < 2 && Math.abs(o.z - z) < o.r + r + 0.3)) continue;
    spawnRock(x + rand(-1.2, 1.2), z, r);
  }
}

/** Seed whatever the bike is about to reach, and drop whatever it has left well behind. */
function updateWorldStream() {
  const ahead = ride.x + SPAWN_AHEAD;
  while (nextRowX < ahead) {
    seedRow(nextRowX);
    nextRowX += ROW_GAP + rand(-ROW_GAP_JITTER, ROW_GAP_JITTER);
  }
  while (nextCraterX < ahead) { addCrater(nextCraterX); nextCraterX += CRATER_EVERY * rand(0.5, 1.6); }
  while (nextScatterX < ahead) { addScatter(nextScatterX); nextScatterX += SCATTER_EVERY * rand(0.4, 1.8); }

  const behind = ride.x - DESPAWN_BEHIND;
  for (let i = rocks.length - 1; i >= 0; i--) if (rocks[i].x < behind) { disposeRock(rocks[i]); rocks.splice(i, 1); }
  for (let i = props.length - 1; i >= 0; i--) if (props[i].x < behind) { disposeProp(props[i]); props.splice(i, 1); }

  // The surface, the sky, the edge markers, the Earth and — the one that
  // is easy to forget — the sun's shadow frustum all ride along with the
  // bike. A directional light's shadow only covers a fixed box around its
  // target, so leaving the target at the origin means the shadows quietly
  // stop a few seconds into the ride.
  stage.key.position.set(ride.x - 9, 12, 7);
  stage.key.target.position.set(ride.x + 2, 0, 0);
  stage.key.target.updateMatrixWorld();
  ground.position.x = ride.x;
  groundTex.offset.x = ride.x / GROUND_TILE;
  trackEdges.position.x = ride.x;
  stars.position.x = ride.x;
  ridge.position.x = ride.x;
  earth.position.x = ride.x + 150;
}

// ---------- the bike ----------
// A hover sled: a wedge of hull, two nacelles, a footplate the ranger
// stands on, a bar to hold, and a skirt of light underneath doing the job
// the wheels would. `craft` carries the whole thing down the track; `bank`
// is the roll a slide puts it into, and the ranger rides inside it.

const matHull = new THREE.MeshStandardMaterial({ color: PAL.hull, roughness: 0.42, metalness: 0.6 });
const matHullDark = new THREE.MeshStandardMaterial({ color: PAL.hullDark, roughness: 0.55, metalness: 0.5 });
const matTrim = new THREE.MeshStandardMaterial({ color: PAL.trim, roughness: 0.4, metalness: 0.3, emissive: PAL.trim, emissiveIntensity: 0.35 });
const matGlow = new THREE.MeshStandardMaterial({ color: PAL.glow, emissive: PAL.glow, emissiveIntensity: 2.4, roughness: 0.3 });

function buildBike() {
  const g = new THREE.Group();

  // The hull: a long deck with a prow. The prow's cone is rotated at the
  // *geometry* level rather than on the mesh — a cone points +y, and
  // chaining two Euler rotations on the object to get it pointing +x and
  // sitting on one of its four flats is exactly the kind of thing that
  // comes out subtly wrong and stays wrong.
  g.add(box(1.95, 0.17, 0.6, matHull, 0.02, 0.17, 0));
  g.add(box(0.9, 0.1, 0.5, matHullDark, 0.5, 0.26, 0));           // the forward deck
  const prowGeo = new THREE.ConeGeometry(0.3, 0.66, 4);
  prowGeo.rotateY(Math.PI / 4);      // a flat on the bottom, not an edge
  prowGeo.rotateZ(-Math.PI / 2);     // pointing +x, down the track
  const prow = mesh(prowGeo, matHull, 1.24, 0.19, 0);
  g.add(prow);

  // Livery: a spine down the deck and a stripe along each flank. Thin
  // lines, not plates — a broad orange patch on the deck reads from
  // overhead as a lump sitting on the bike rather than as its markings.
  g.add(box(1.5, 0.02, 0.07, matTrim, 0.24, 0.27, 0));            // the spine
  g.add(box(1.55, 0.045, 0.05, matTrim, 0.05, 0.2, 0.305));       // a stripe down each flank
  g.add(box(1.55, 0.045, 0.05, matTrim, 0.05, 0.2, -0.305));

  // nacelles either side, with a lit intake facing forward and a fin aft
  for (const side of [-1, 1]) {
    const n = mesh(new THREE.CapsuleGeometry(0.17, 0.95, 4, 10), matHullDark, 0.06, 0.19, side * 0.44);
    n.rotation.z = Math.PI / 2;
    g.add(n);
    const intake = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), matGlow, 0.6, 0.19, side * 0.44);
    intake.rotation.z = Math.PI / 2;
    intake.castShadow = false;
    g.add(intake);
    const fin = box(0.36, 0.3, 0.05, matHullDark, -0.78, 0.34, side * 0.44);
    fin.rotation.x = side * 0.25;
    g.add(fin);
    // running lights at the prow, which is most of what makes the front
    // read as the front from behind
    const lamp = mesh(new THREE.SphereGeometry(0.05, 8, 6), matGlow, 1.06, 0.28, side * 0.2);
    lamp.castShadow = false;
    g.add(lamp);
  }

  // the footplate, and the bar the ranger holds
  g.add(box(0.78, 0.06, 0.7, matHullDark, -0.26, 0.29, 0));
  const bar = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.72, 8), matHullDark, 0.4, 0.7, 0);
  bar.rotation.x = Math.PI / 2;
  g.add(bar);
  for (const side of [-1, 1]) {
    // the grips are the orange, not the whole bar: the eye finds the hands
    const grip = mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.17, 8), matTrim, 0.4, 0.7, side * 0.28);
    grip.rotation.x = Math.PI / 2;
    g.add(grip);
    const stem = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.5, 6), matHullDark, 0.45, 0.48, side * 0.28);
    stem.rotation.z = 0.4;
    g.add(stem);
  }

  // the skirt: a soft disc of light under the hull, which is the whole
  // reason it reads as hovering rather than as parked
  const skirt = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, color: PAL.glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  skirt.scale.set(2.7, 1.6, 1);
  skirt.position.set(0.02, 0.03, 0);
  g.add(skirt);
  // two thrusters at the tail
  const jets = [];
  for (const side of [-1, 1]) {
    const j = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, color: PAL.thruster, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    j.scale.setScalar(0.36);
    j.position.set(-0.98, 0.19, side * 0.28);
    g.add(j);
    jets.push(j);
  }
  return { g, skirt, jets };
}

/** `craft` carries the bike and the ranger down the track; `bank` is the roll a slide puts them both into. */
const craft = new THREE.Group();
const bank = new THREE.Group();
craft.add(bank);
scene.add(craft);
const bike = buildBike();
bank.add(bike.g);

const charMats = characterMaterials(PAL);
const { armor: matArmor, armorDark: matArmorDark, muzzle: matMuzzle } = charMats;
const rig = buildCharacter(charMats, { scale: 0.34 });
rig.root.position.set(-0.12, 0.30, 0);     // stood on the footplate
bank.add(rig.root);

// The bike's own contact shadow, under the skirt: the key light's shadow is
// there too, but at this angle it falls long and the pool under the hull is
// what actually sells the hover height.
const contact = new THREE.Mesh(
  new THREE.PlaneGeometry(2.6, 1.5),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.5, depthWrite: false }),
);
contact.rotation.x = -Math.PI / 2;
contact.position.y = 0.02;
scene.add(contact);

// The sight: a faint line from the barrel along the aim, so where a shot
// will go is readable before it is fired. It brightens under the lock.
const sightGeo = new THREE.BufferGeometry();
sightGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
const sightMat = new THREE.LineBasicMaterial({ color: PAL.shot, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
const sight = new THREE.Line(sightGeo, sightMat);
sight.frustumCulled = false;
scene.add(sight);

/** The lock ring: sits around the boulder the barrel is held on. */
const lockRing = new THREE.Mesh(
  new THREE.RingGeometry(0.86, 0.96, 32),
  new THREE.MeshBasicMaterial({ color: PAL.trim, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
);
lockRing.rotation.x = -Math.PI / 2;
lockRing.position.y = 0.05;
lockRing.visible = false;
scene.add(lockRing);

const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, color: PAL.shot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
flash.scale.setScalar(0.001);
scene.add(flash);
const chargeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, color: PAL.charged, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
chargeGlow.scale.setScalar(0.001);
scene.add(chargeGlow);

// ---------- the ride ----------

const initialAim = AIM_MODES.includes(params.get("aim")) ? params.get("aim") : "ahead";

const ride = {
  x: 0,                      // distance down the track — this only ever grows
  z: 0,                      // across it
  speed: SPEED_START,        // world units per second, never <= 0
  target: SPEED_START,
  steer: 0,                  // lateral velocity, units/s
  bank: 0,                   // the roll, radians
  bob: 0,
  hurtUntil: -1e9,
  crashes: 0, busted: 0,
  milestone: 0,
};

const state = {
  aimMode: initialAim,
  aim: 0,                    // the angle shots leave at; 0 is straight down the track
  aimAt: -1e9,
  hoverAim: 0, hoverAt: -1e9,
  lockHold: false, lockToggle: false,
  lock: false, lockTarget: null,
  facing: 0,                 // the torso's yaw off the bike's own line
  twist: 0,
  charge: null,
  lastFireAt: -1e9,
  fireAt: -1e9, fireCharged: false,
};

/** How far up the throttle's range the bike is, 0..1 — the chase camera and the HUD bar both read it. */
const speedU = () => clamp01((ride.speed - SPEED_START) / (SPEED_CRUISE - SPEED_START));

/**
 * The one-way rule, in one function. The throttle's target climbs while the
 * ride is clean and is knocked down by a crash; the speed itself chases it,
 * and is clamped so it can never reach zero and never reverse. `ride.x`
 * therefore only ever grows, which every other system here is allowed to
 * assume — the world stream drops everything behind the bike outright,
 * because nothing is ever coming back for it.
 */
function updateThrottle(t, dt) {
  ride.target = Math.min(SPEED_CRUISE, ride.target + SPEED_RAMP * dt);
  ride.speed += (ride.target - ride.speed) * approach(frameDt, SPEED_TAU);
  ride.speed = clamp(ride.speed, 1.2, SPEED_CRUISE * 1.2);
  ride.x += ride.speed * dt;
  rig3._speedU = speedU();
}

/** Steering: a camera-relative slide across the track, eased, and held inside the corridor. */
function updateSteer(want, dt) {
  const targetV = clamp(want, -1, 1) * STEER_MAX;
  ride.steer += (targetV - ride.steer) * approach(frameDt, STEER_TAU);
  ride.z += ride.steer * dt;
  // the corridor's edge is a wall the slide dies against rather than a
  // bounce — a bounce at this speed reads as a bug, not a boundary
  const edge = TRACK_HALF + 0.35;
  if (ride.z > edge) { ride.z = edge; ride.steer = Math.min(0, ride.steer); }
  if (ride.z < -edge) { ride.z = -edge; ride.steer = Math.max(0, ride.steer); }
  const wantBank = clamp(-ride.steer / STEER_MAX, -1, 1) * BANK_MAX;
  ride.bank += (wantBank - ride.bank) * approach(frameDt, BANK_TAU);
}

/**
 * The skirt's dust. On the moon there is no air to suspend it, so every
 * grain leaves on a clean ballistic arc and lands — which is why this
 * throws a *low, fast, wide* spray with almost no rise rather than the soft
 * hanging puff the same call makes in demo 5.
 */
let nextDustAt = 0;
function kickDust(t) {
  if (t < nextDustAt) return;
  nextDustAt = t + lerp(90, 42, speedU());
  fx.dust(craft.position.x - 0.9, craft.position.z, 2, 1.1 + speedU() * 1.4, {
    color: PAL.dust, y: 0.12, rise: 0.5, gravity: DEBRIS_GRAVITY, size: [0.05, 0.3], ms: [220, 420],
  });
}

/** A boulder taken at speed: the throttle is gone, the bike is shoved off the line, and the ranger flinches. */
function crash(rock, t) {
  if (t < ride.hurtUntil) return;
  ride.hurtUntil = t + CRASH_HURT_MS;
  ride.crashes++;
  hud.crashes.textContent = String(ride.crashes);
  ride.target = SPEED_CRASH;
  ride.speed = SPEED_CRASH;
  const away = Math.sign(ride.z - rock.z) || (Math.random() < 0.5 ? -1 : 1);
  ride.steer = away * CRASH_KICK;
  // and put the bike back outside the boulder it just ended up inside: an
  // overlap left standing reads as the collision not having happened
  const clear = rock.r * 0.82 + BIKE_RADIUS + 0.05;
  if (Math.abs(ride.z - rock.z) < clear) ride.z = clamp(rock.z + away * clear, -TRACK_HALF - 0.35, TRACK_HALF + 0.35);
  state.charge = null;
  hud.fire.classList.remove("held", "ready");
  clock.hitStop(HITSTOP_CRASH);
  shakeCam(0.14);
  triggerCamPunch(1, ride.z - rock.z);
  flashVignette();
  fx.dust(craft.position.x, craft.position.z, 14, 2.4, { color: PAL.dust, y: 0.3, rise: 1.2, gravity: DEBRIS_GRAVITY, size: [0.08, 0.34], ms: [260, 520] });
  fx.debrisBurst(rock.x, rock.z, [PAL.rock, PAL.rockDark, PAL.rockLit], { ms: DEBRIS_MS, gravity: DEBRIS_GRAVITY, count: [4, 6] });
  ripple(craft.position.x, craft.position.z, PAL.hurt, 2.6, 420);
  popup(craft.position.x, craft.position.z, "CRASH", { color: "#ff5a46", y0: 1.5 });
  showCaption("Boulder. Speed's gone — build it back.", 1800);
}

/** Every boulder against the bike's own circle. Nothing else on the surface collides. */
function checkCollisions(t) {
  if (t < ride.hurtUntil) return;
  for (const rock of rocks) {
    if (rock.dead) continue;
    const dx = rock.x - craft.position.x, dz = rock.z - ride.z;
    // a boulder's footprint is a little tighter than its silhouette: the
    // top of an irregular rock overhangs a base you can actually pass
    const reach = rock.r * 0.82 + BIKE_RADIUS;
    if (dx * dx + dz * dz <= reach * reach) { crash(rock, t); return; }
  }
}

// ---------- aiming ----------

function setAim(a, t) {
  state.aim = a;
  state.aimAt = t;
}
const aimHeld = (t) => !!(input.aimStickVec() || input.heldAim() || t - state.hoverAt < AIM_HOLD_MS);

function setAimMode(m, via) {
  if (!AIM_MODES.includes(m)) return;
  state.aimMode = m;
  if (m === "ahead") state.aim = 0;
  announce("aim", m, via);
}
const cycleAimMode = (via) => setAimMode(AIM_MODES[(AIM_MODES.indexOf(state.aimMode) + 1) % AIM_MODES.length], via);

/** The nearest boulder still ahead of the bike — a lock behind you is a lock on something you have already passed. */
function nearestRock() {
  let best = null, bd = Infinity;
  for (const rock of rocks) {
    if (rock.dead || rock.x < craft.position.x + 0.5) continue;
    const d = Math.hypot(rock.x - craft.position.x, rock.z - ride.z);
    if (d < bd) { bd = d; best = rock; }
  }
  return best;
}
let lockVia = null;
function updateLock(t) {
  const want = state.lockHold || state.lockToggle;
  if (want && !state.lock) { state.lock = true; state.lockTarget = nearestRock(); state.aimAt = t; announce("lock", state.lockTarget ? "target" : "held", lockVia); }
  if (!want && state.lock) { state.lock = false; state.lockTarget = null; announce("lock", "off", lockVia); }
  // a target that has been passed, or broken, is dropped for the next one
  if (state.lock && (!state.lockTarget || state.lockTarget.dead || state.lockTarget.x < craft.position.x + 0.5)) state.lockTarget = nearestRock();
  chips.set("lock", state.lock ? (state.lockTarget ? "target" : "held") : "off");
  chips.toggle("lock", state.lock);
}

const _v = new THREE.Vector3();

function updateAim(t) {
  updateLock(t);
  if (state.lock && state.lockTarget) {
    const r = state.lockTarget;
    setAim(angleTo(craft.position.x, ride.z, r.x, r.z), t);
  } else if (state.aimMode === "ahead") {
    state.aim = 0;
  } else {
    const sv = input.aimStickVec();
    const kv = input.heldAim();
    if (sv) setAim(rig3.angleOfScreen(sv[0], sv[1]), t);
    else if (kv) setAim(rig3.angleOfScreen(kv[0], kv[1]), t);
    else if (t - state.hoverAt < AIM_HOLD_MS) setAim(state.hoverAim, t);
    else if (t - state.aimAt > AIM_HOLD_MS) state.aim += angleDelta(state.aim, 0) * approach(frameDt, 400);   // drifts back down the track
  }
  // the barrel may lead the bike, but the ranger is still standing on it:
  // the torso turns, the boots do not
  const wantFacing = clamp(angleDelta(0, state.aim), -TWIST_MAX, TWIST_MAX);
  state.facing += (wantFacing - state.facing) * Math.min(1, frameDt / TURN_MS);

  lockRing.visible = !!(state.lock && state.lockTarget);
  if (lockRing.visible) {
    const r = state.lockTarget;
    lockRing.position.set(r.x, 0.05, r.z);
    const s = (r.r + 0.15) * (1 + 0.05 * Math.sin(t / 120));
    lockRing.scale.set(s, s, s);
  }
}

// ---------- the buster ----------

const muzzle = new THREE.Vector3();
const shots = [];
const shotGeo = new THREE.SphereGeometry(0.08, 10, 8);
const chargedGeo = new THREE.SphereGeometry(0.19, 14, 12);
const matShot = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const matCharged = new THREE.MeshBasicMaterial({ color: 0xeafcff });
const shotGlowMat = new THREE.SpriteMaterial({ map: discTex, color: PAL.shot, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
const chargedGlowMat = new THREE.SpriteMaterial({ map: discTex, color: PAL.charged, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });

function fire(t, charged) {
  aimDir(state.aim, _v);
  const m = new THREE.Mesh(charged ? chargedGeo : shotGeo, charged ? matCharged : matShot);
  m.position.copy(muzzle);
  const glow = new THREE.Sprite(charged ? chargedGlowMat : shotGlowMat);
  glow.scale.setScalar(charged ? 0.85 : 0.34);
  m.add(glow);
  scene.add(m);
  const speed = charged ? CHARGED_SPEED : SHOT_SPEED;
  shots.push({
    m, vx: _v.x * speed, vz: _v.z * speed, charged,
    dmg: charged ? CHARGED_DMG : SHOT_DMG, x0: muzzle.x, z0: muzzle.z, hit: false,
  });
  state.lastFireAt = t;
  state.fireAt = t;
  state.fireCharged = charged;
  flash.material.color.set(charged ? PAL.charged : PAL.shot);
  if (charged) {
    shakeCam(0.05);
    fx.dust(muzzle.x, muzzle.z, 5, 1.4, { color: PAL.charged, y: muzzle.y, rise: 0, size: [0.06, 0.22], ms: [140, 220], additive: true });
  }
}

function pressFire(t, hold = null) {
  if (state.charge) return;
  if (t - state.lastFireAt >= FIRE_COOLDOWN_MS) fire(t, false);
  state.charge = { t0: t, hold };
  hud.fire.classList.add("held");
}
function releaseFire(t, hold = null) {
  if (hold) input.fireHolds.delete(hold);
  if (input.firing) return;        // another input is still holding FIRE down
  const c = state.charge;
  if (!c) return;
  state.charge = null;
  hud.fire.classList.remove("held", "ready");
  if (t - c.t0 >= CHARGE_MS) fire(t, true);
}

/** A shot into a boulder: a chunk comes off, and if that was the last of it the whole thing goes. */
function hitRock(rock, shot, t) {
  rock.hp -= shot.dmg;
  rock.flashUntil = t + 90;
  fx.dust(shot.m.position.x, shot.m.position.z, shot.charged ? 8 : 4, shot.charged ? 2.2 : 1.4, {
    color: shot.charged ? PAL.charged : PAL.shot, y: shot.m.position.y, rise: 0.15, size: [0.05, 0.18], ms: [160, 280], additive: true,
  });
  if (rock.hp > 0) {
    // a chip: the boulder loses a little of itself, visibly, so four shots
    // read as four shots rather than as three misses and a kill
    fx.debrisBurst(shot.m.position.x, shot.m.position.z, [PAL.rock, PAL.rockDark], { ms: DEBRIS_MS, gravity: DEBRIS_GRAVITY, count: [2, 4], scale: 0.8 });
    rock.m.scale.multiplyScalar(0.94);
    return;
  }
  rock.dead = true;
  ride.busted++;
  hud.rocks.textContent = String(ride.busted);
  fx.debrisBurst(rock.x, rock.z, [PAL.rock, PAL.rockDark, PAL.rockLit], {
    ms: DEBRIS_MS, gravity: DEBRIS_GRAVITY, count: [8, 13], speed: [0.9, 2.4], up: [2.2, 3.8], scale: 1 + rock.r,
  });
  fx.dust(rock.x, rock.z, 12, 2.2, { color: PAL.dust, y: rock.r * 0.5, rise: 1.6, gravity: DEBRIS_GRAVITY, size: [0.1, 0.4], ms: [280, 520] });
  ripple(rock.x, rock.z, PAL.rockLit, 1.6 + rock.r * 1.6, 460);
  clock.hitStop(shot.charged ? HITSTOP_CHARGED : HITSTOP_ROCK);
  shakeCam(shot.charged ? 0.08 : 0.04);
  popup(rock.x, rock.z, shot.charged ? "SHATTERED" : "BROKEN", { color: "#e8ecf2", y0: rock.r + 0.5 });
  if (state.lockTarget === rock) state.lockTarget = null;
  const i = rocks.indexOf(rock);
  if (i >= 0) { disposeRock(rock); rocks.splice(i, 1); }
}

function updateShots(t) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.m.position.x += s.vx * frameDt;
    s.m.position.z += s.vz * frameDt;
    const flown = Math.hypot(s.m.position.x - s.x0, s.m.position.z - s.z0);
    let spent = flown > SHOT_RANGE || s.m.position.x < ride.x - DESPAWN_BEHIND;
    if (!spent) {
      for (const rock of rocks) {
        if (rock.dead) continue;
        const reach = rock.r * 0.9 + (s.charged ? CHARGED_RADIUS : SHOT_RADIUS);
        const dx = rock.x - s.m.position.x, dz = rock.z - s.m.position.z;
        if (dx * dx + dz * dz <= reach * reach) { hitRock(rock, s, t); spent = true; s.hit = true; break; }
      }
    }
    if (spent) {
      if (s.charged) {
        fx.tracer(s.x0, s.z0, s.m.position.x, s.m.position.z, PAL.charged, TRACER_MS, 0.55);
        if (s.hit) ripple(s.m.position.x, s.m.position.z, PAL.charged, 2.6, 300);
      }
      scene.remove(s.m);
      shots.splice(i, 1);
    }
  }
  // the flash and the charge glow ride the muzzle
  const fu = clamp01((t - state.fireAt) / 80);
  flash.position.copy(muzzle);
  flash.scale.setScalar(fu < 1 ? lerp(state.fireCharged ? 1 : 0.5, 0.05, fu) : 0.001);
  flash.material.opacity = fu < 1 ? 1 - fu : 0;
  chargeGlow.position.copy(muzzle);
  if (state.charge) {
    const cu = clamp01((t - state.charge.t0) / CHARGE_MS);
    const ready = cu >= 1;
    const pulse = ready ? 0.85 + 0.15 * Math.sin(t / 40) : 1;
    chargeGlow.scale.setScalar(lerp(0.05, 0.55, easeOutQuad(cu)) * pulse);
    chargeGlow.material.opacity = 0.25 + 0.7 * cu;
    matMuzzle.emissiveIntensity = 1.4 + 3 * cu;
    hud.fire.classList.toggle("ready", ready);
  } else {
    chargeGlow.scale.setScalar(0.001);
    chargeGlow.material.opacity = 0;
    matMuzzle.emissiveIntensity = 1.4;
  }
}

/** Boulders only flash when they are hit; everything else about one is set when it is built. */
function updateRocks(t) {
  for (const rock of rocks) {
    const hit = t < rock.flashUntil;
    rock.mat.emissive.set(hit ? 0xffffff : 0x000000);
    rock.mat.emissiveIntensity = hit ? 0.9 : 0;
  }
}

// ---------- pose ----------
// The ranger is not walking, so there is no hop curve and no idle: the base
// is one crouch over the bars whose depth is the throttle. Everything on top
// of it — the barrel arm held level, the charge bracing, the recoil, the
// flinch of a crash — is the engine's, and is the same set demo 5 uses.

function ridePose(t) {
  const p = restPose();
  const u = speedU();
  // faster is lower and further forward: the crouch is the speedometer
  p.hipDrop = lerp(0.16, 0.34, u);
  p.lean = lerp(0.30, 0.58, u);
  p.knee = lerp(0.72, 1.02, u);
  p.thigh = lerp(0.52, 0.78, u);
  p.armSwing = lerp(0.48, 0.66, u);     // both arms forward, onto the bar
  p.elbow = lerp(-0.72, -0.95, u);
  p.headPitch = lerp(-0.06, -0.20, u);  // eyes up, down the track
  // the bike's own float, and a shudder that comes in with the speed
  p.sway = 0.012 * Math.sin(t / 520) + 0.004 * u * Math.sin(t / 47);
  return p;
}

function pose(t) {
  const base = ridePose(t);
  const holding = state.lock || !!state.charge || t - state.aimAt < AIM_HOLD_MS;
  const chargeU = state.charge ? clamp01((t - state.charge.t0) / CHARGE_MS) : 0;
  const ru = clamp01((t - state.fireAt) / RECOIL_MS);
  const kick = ru < 1 ? (1 - ru) * (state.fireCharged ? 0.55 : 0.28) : 0;
  const hu = clamp01((t - (ride.hurtUntil - CRASH_HURT_MS)) / CRASH_HURT_MS);
  const flinch = hu < 1 ? (1 - hu) * (1 - hu) : 0;

  // The whole body turns to the aim, and the twist takes the *legs* back to
  // the bike's own line — the ranger's boots are on the plate, whatever the
  // barrel is doing. (`applyPose` offsets the hips by the twist and the
  // torso by its negative, so this is exactly the strafe read backwards.)
  rig.root.rotation.y = state.facing;
  state.twist = -state.facing;

  applyPose(rig, base, { holding: holding ? 0.9 : 0, chargeU, kick, flinch, twist: state.twist, hurtColor: PAL.hurt });
}

// ---------- placement ----------

function place(t) {
  ride.bob = 0.018 * Math.sin(t / 430) + 0.008 * Math.sin(t / 170);
  craft.position.set(ride.x, HOVER_Y + ride.bob, ride.z);
  // a slide yaws the nose a little into the turn as well as rolling it
  craft.rotation.y = clamp(-ride.steer / STEER_MAX, -1, 1) * 0.16;
  bank.rotation.x = ride.bank;

  contact.position.set(ride.x, 0.02, ride.z);
  contact.material.opacity = 0.5 - 0.12 * speedU();

  bike.skirt.material.opacity = 0.42 + 0.22 * Math.abs(Math.sin(t / 260)) + 0.12 * speedU();
  for (const j of bike.jets) {
    j.material.opacity = 0.5 + 0.4 * speedU() + 0.1 * Math.sin(t / 60);
    j.scale.setScalar(lerp(0.28, 0.5, speedU()) * (1 + 0.08 * Math.sin(t / 55)));
  }
}

/** The muzzle in world space, for shots and the sight. Read after the pose is set. */
function updateMuzzle(t) {
  craft.updateMatrixWorld(true);
  rig.muzzle.getWorldPosition(muzzle);
  const sp = sightGeo.attributes.position.array;
  aimDir(state.aim, _v);
  const reach = state.lock && state.lockTarget
    ? Math.hypot(state.lockTarget.x - muzzle.x, state.lockTarget.z - muzzle.z)
    : 7;
  sp[0] = muzzle.x; sp[1] = muzzle.y; sp[2] = muzzle.z;
  sp[3] = muzzle.x + _v.x * reach; sp[4] = muzzle.y; sp[5] = muzzle.z + _v.z * reach;
  sightGeo.attributes.position.needsUpdate = true;
  sightMat.color.set(state.lock ? PAL.trim : PAL.shot);
  sightMat.opacity = state.lock ? 0.7 : state.aimMode === "free" || t - state.aimAt < AIM_HOLD_MS ? 0.4 : 0.14;
}

// ---------- the HUD ----------

let captionTimer = null;
function showCaption(text, ms) {
  hud.caption.textContent = text;
  hud.caption.hidden = false;
  if (captionTimer) clearTimeout(captionTimer);
  captionTimer = ms ? setTimeout(hideCaption, ms) : null;
}
function hideCaption() {
  if (captionTimer) clearTimeout(captionTimer);
  captionTimer = null;
  hud.caption.hidden = true;
  hud.caption.textContent = "";
}

let shownMetres = -1;
function updateHud() {
  const m = Math.round(ride.x * METRES_PER_UNIT);
  if (m !== shownMetres) { shownMetres = m; hud.dist.textContent = String(m); }
  hud.speedFill.style.width = `${Math.round(speedU() * 100)}%`;
  if (m >= (ride.milestone + 1) * MILESTONE_M) {
    ride.milestone = Math.floor(m / MILESTONE_M);
    hud.dist.classList.remove("tick");
    void hud.dist.offsetWidth;
    hud.dist.classList.add("tick");
    showCaption(`${ride.milestone * MILESTONE_M} m · ${ride.busted} broken · ${ride.crashes} down`, 1600);
  }
}

// ---------- input ----------
// The engine owns the two sticks and the FIRE hold-set. What is different
// here is that the left stick has only one axis to give: steering is the
// ground vector's *across-track* component, and its along-track component
// is thrown away, because forward is not a choice.

const input = new Input({
  canvas: renderer.domElement,
  rig: rig3,
  now,
  deadPx: STICK_DEAD_PX,

  onKey(code, e) {
    if (code === "ShiftLeft" || code === "ShiftRight") { state.lockHold = true; lockVia = "shift"; return; }
    if (e.repeat) return;
    switch (code) {
      case "KeyL": state.lockToggle = !state.lockToggle; lockVia = "key L"; break;
      case "Digit1": setAimMode("ahead", "key 1"); break;
      case "Digit2": setAimMode("free", "key 2"); break;
      case "Tab": e.preventDefault(); cycleAimMode("key Tab"); break;
      case "KeyC": rig3.cycle("key C"); break;
      case "KeyQ": rig3.orbitBy(-0.35, 0, "key Q"); break;
      case "KeyE": rig3.orbitBy(0.35, 0, "key E"); break;
      case "KeyR": rig3.orbitBy(0, 0.15, "key R"); break;
      case "KeyF": rig3.orbitBy(0, -0.15, "key F"); break;
      case "KeyP": case "Escape": clock.setPaused(!clock.paused); break;
    }
  },
  onKeyUp(code) {
    if (code === null || code === "ShiftLeft" || code === "ShiftRight") { state.lockHold = false; lockVia = "shift"; }
  },

  // A discrete "step" means nothing on a continuous slide: the held keys
  // are read every frame by `steerInput()` instead, so a fresh press has
  // nothing of its own to do.
  onMove() {},

  /** A tap on the surface is "be over there": it steers towards that point's line across the track. */
  onTap(clientX, clientY, ground) {
    if (!ground) return;
    tapTargetZ = clamp(ground.z, -TRACK_HALF, TRACK_HALF);
    tapUntil = now() + 2200;
  },

  onFireDown(hold) { pressFire(now(), hold); },
  onFireUp(hold) { releaseFire(now(), hold); },
  onHover(point) {
    state.hoverAim = angleTo(craft.position.x, ride.z, point.x, point.z);
    state.hoverAt = now();
  },
  onWheel(deltaY) { rig3.zoom(deltaY, "wheel", [5, 22]); },
});

let tapTargetZ = null, tapUntil = -1e9;

/**
 * Steering, from whatever is being held: the left stick, WASD, or a tap's
 * standing order. Every one of them is turned into a ground vector through
 * the camera first, and only the component *across* the track survives.
 *
 * Which keys that leaves you is the camera's business, not this function's,
 * and it comes out right every time: under the chase camera screen-across
 * is left and right, so `A`/`D` and a horizontal drag steer and `W`/`S` do
 * nothing at all — which is the one-way rule stated in the controls rather
 * than only in the code, since under that camera "forward" on the stick
 * points exactly down the track, and forward is not yours to ask for. Turn
 * the camera side-on and it is `W`/`S` that steer, for the same reason.
 */
const _steer = new THREE.Vector3();
function steerInput(t) {
  const stick = input.moveStickVec() || input.heldMoveVec();
  if (stick) {
    tapTargetZ = null;
    rig3.boardVec(stick[0], stick[1], _steer);
    const len = Math.hypot(_steer.x, _steer.z) || 1;
    return clamp(_steer.z / len, -1, 1);
  }
  if (tapTargetZ !== null && t < tapUntil) {
    const d = tapTargetZ - ride.z;
    if (Math.abs(d) < 0.12) { tapTargetZ = null; return 0; }
    return clamp(d / 1.5, -1, 1);
  }
  return 0;
}

const bind = (id, fn) => $(id).addEventListener("click", fn);
bind("btn-aim", () => cycleAimMode("tap"));
bind("btn-cam", () => rig3.cycle("tap"));
bind("btn-lock", () => { state.lockToggle = !state.lockToggle; lockVia = "tap"; });
bind("btn-orbit-l", () => rig3.orbitBy(-0.35, 0, "tap"));
bind("btn-orbit-r", () => rig3.orbitBy(0.35, 0, "tap"));
input.bindFireButton(hud.fire);
releasePadKeys();

// ---------- loop ----------

function updateCamera() {
  rig3.update({
    focus: craft.position,
    aim: state.aim,
    frameDt,
    now: now(),
    anchorX: craft.position.x,
    followX: craft.position.x,
    orbitX: craft.position.x,
  });
}

function updateFrame(t, dtMs) {
  frameDt = dtMs;
  const dt = dtMs / 1000;
  // a charge whose hold vanished (a lost pointerup, a swallowed keyup) is
  // released here rather than jamming the buster for the rest of the ride
  if (state.charge && state.charge.hold && input.staleHold(state.charge.hold, state.charge.t0, t)) {
    releaseFire(t, state.charge.hold);
  }
  updateThrottle(t, dt);
  updateSteer(steerInput(t), dt);
  updateWorldStream();
  place(t);
  checkCollisions(t);
  updateAim(t);
  updateShots(t);
  updateRocks(t);
  kickDust(t);
  pose(t);
  updateMuzzle(t);
  updateHud();
  fx.update(t, frameDt);
  updateCamera();
}

const loop = new Loop({ clock, stage, update: updateFrame });

setAimMode(state.aimMode, params.has("aim") ? "url" : null);
rig3.setMode(rig3.mode, params.has("cam") ? "url" : null);
announce("lock", "off");
updateWorldStream();
stage.resize();
loop.start();
showCaption("Ride. Steer across the track — the throttle is not yours. Break what you can't go around.", 4200);

// A small hook for tests and for poking at it from the console.
window.__moon = {
  ride, state, rocks, shots, rig, craft, camera, renderer, cam,
  get speed() { return ride.speed; },
  get speedU() { return speedU(); },
  steer: (v) => { tapTargetZ = null; ride.steer = clamp(v, -1, 1) * STEER_MAX; },
  steerTo: (z) => { tapTargetZ = clamp(z, -TRACK_HALF, TRACK_HALF); tapUntil = now() + 1e9; },
  fire: (charged = false) => fire(now(), charged),
  pressFire: () => pressFire(now()), releaseFire: () => releaseFire(now()),
  setAim: (a) => setAim(a, now()), setAimMode, setCamMode: (m, via) => rig3.setMode(m, via),
  lock: (on) => { state.lockToggle = on; },
  nearestRock,
  crashNow: () => { const r = nearestRock(); if (r) crash(r, now()); },
  get paused() { return clock.paused; },
  setPaused: (p) => clock.setPaused(p),
  simulate: (ms, step = 16, render = true) => loop.simulate(ms, step, render),
  renderOnce: () => loop.renderOnce(),
  now, reducedMotion: () => REDUCED_MOTION,
};
