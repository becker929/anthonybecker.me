/*!
 * Buster Whack 3D — movement, aiming, fire and the first enemy.
 *
 * The 2D game moves the buster one square per hop: a crouch, an arc, a
 * landing squash, then the rest of the ration as cooldown, and the square
 * you count as standing on changes at the top of the arc. This prototype
 * keeps that model and asks the next questions on top of the first one
 * (what does the hop look like on a body with knees?): how does the buster
 * aim when the board is a floor rather than three lanes, what does a strafe
 * look like, and which camera the fight wants.
 *
 * So there are two sticks now, not one. The left one hops; the right one —
 * arrow keys, the mouse, or a second thumb — points the barrel. How the
 * barrel is allowed to point is the *aim mode*: four ways, eight ways, or
 * anywhere. Holding the *lock* keeps the barrel where it is (on the nearest
 * rotter when there is one) while the legs go wherever they like, which is
 * the strafe. And the camera is a mode of its own, cycled independently.
 *
 * Still not a game in "sandbox" mode — no clock, no score, no towers, a
 * board that just sits there being fired on forever. `?mode=advance` (or
 * `M`, or the MODE chip) turns it into the 2D original's endless road: the
 * fixed board becomes the *shape* of one arena rather than the whole world;
 * a world of segments (tower, arena, road) is appended along +x as each
 * arena is cleared; a countdown clock replaces free play; and towers
 * between runs of arenas hold a keeper to talk to and a task to chase.
 * Sandbox is the degenerate case of that same world — a single arena stuck
 * with `owner: "enemy"` and free-respawning rotters — so it keeps behaving
 * exactly as it always has and stays none the wiser that advance mode
 * exists.
 *
 * Three later passes on top of that first cut. The GUI: every mode/aim/cam
 * chip is now its own two-line control-and-readout, pinged and badged with
 * *how* it changed, because a phone has no room for a HUD row that just
 * describes buttons sitting six inches away. Aiming: a fourth mode, "lane"
 * (the default) — the barrel never leaves the lane, so every hop is a pure
 * strafe and the second stick does nothing, closer to the 2D game's own
 * three-lane aim than 4-dir/8-dir/free ever were. And juice, chasing the 2D
 * original's feel on top of the numbers it already reproduces: hit-stop
 * (frozen by holding `now()` itself rather than a flag, so every timer in
 * the game honours it for free), popups, chain flourishes, a damage punch,
 * deletion debris, a start card and a pause, and the arena-taken and wave
 * announcements. See the ---------- juice ---------- section.
 */

import * as THREE from "./three.module.min.js";

// ---------- board ----------

const COLS = 6;
const ROWS = 3;
const PCOLS = 3;              // the player's half, as in the game
const TILE = 1;               // world units per square
const GAP = 0.1;

// The character is modelled at roughly human proportions (1.75 units tall)
// and scaled down onto the board: a square is a panel you stand on, not a
// room you stand in, so the buster is a little over half a square tall.
const CHAR_SCALE = 0.36;

// ---------- the hop ----------
// The 2D game runs 30 / 80 / 55 ms with a 195 ms ration. The first cut of
// this prototype roughly doubled those (60 / 170 / 110) so the limbs had
// time to read; played against something that shoots back that felt like
// wading, so the phases are pulled in to a 230 ms ration — a third faster,
// still a beat slower than the 2D game — and the arc is lower to match. The
// ration is the sum, so a held direction chains hops with no dead frame.
const HOP_WINDUP_MS = 40;     // the crouch before leaving the ground
const HOP_AIR_MS = 115;       // the arc
const HOP_SETTLE_MS = 75;     // the landing squash and recovery
const HOP_TOTAL_MS = HOP_WINDUP_MS + HOP_AIR_MS + HOP_SETTLE_MS;
const HOP_COMMIT_MS = HOP_WINDUP_MS + HOP_AIR_MS / 2;   // the square changes here
const MOVE_MS = HOP_TOTAL_MS; // the step ration
const HOP_HEIGHT = 0.27;
const REFACE_MS = 420;        // after this long idle, turn back to face the enemy half
// The rest facing: towards the enemy half, turned a little towards the
// camera so the visor and the core light show instead of a flat profile.
// It is cosmetic — shots still go along the aim — and drops the moment the
// buster aims or fires.
const REST_YAW = -0.32;

// ---------- aiming ----------
// The aim is an angle in the board plane: 0 is +x (down the lane, at the
// enemy half), positive turns towards -z (the row above). Modes quantise
// it; "free" does not. "lane" doesn't even let it move — the barrel sits at
// 0 always, so every hop is a pure strafe, closer to the 2D original's own
// three-lane aim than the others; it's the default.
const AIM_MODES = ["lane", "4", "8", "free"];
const AIM_HOLD_MS = 1200;     // a flick of aim input counts as "still aiming" this long
const TURN_MS = 60;           // the body chases the aim with this time constant
const TWIST_MAX = 0.85;       // how far the legs may face away from the barrel in a strafe

// ---------- the buster ----------
const FIRE_COOLDOWN_MS = 140;
const CHARGE_MS = 520;        // hold FIRE this long and the release is the strong shot
const SHOT_SPEED = 9 / 1000;  // tiles per ms
const CHARGED_SPEED = 11 / 1000;
const RECOIL_MS = 130;

// ---------- rotters ----------
// The first enemy. A rotter is a squat rotor that sits on a panel of the
// enemy half and rots it — the rim goes from the half's red to a sick green
// under it, and heals when it leaves. It hops panel to panel the way the
// buster does, and now and then it winds up (the rotor whines, the eye
// brightens, the panel flashes) and throws a bolt at where you are standing.
const ROTTER_COUNT = 3;
const ROTTER_HP = 3;          // three shots, or one charged
const ROTTER_RADIUS = 0.34;   // hit circle, in tiles
const ROTTER_SPAWN_MS = 220;  // the 2D original's rise (was 420 in the first cut)
const ROTTER_SIT_MS = [1100, 2600];
const ROTTER_HOP_MS = 300;
const ROTTER_AIM_MS = 720;    // the telegraph
const ROTTER_DIE_MS = 180;    // the 2D original's sink (was 380 in the first cut)
const ROTTER_RESPAWN_MS = 1400;
const ROTTER_FIRE_EVERY = [2400, 4400];
const BOLT_SPEED = 4.2 / 1000;
const BOLT_RADIUS = 0.3;
const HURT_MS = 700;
const ROT_RATE = 1 / 1400;    // a panel rots fully in 1.4 s under a rotter
const ROT_DECAY = 1 / 3000;   // and heals in 3 s once it leaves

// ---------- advance / story mode ----------
// The 2D original's numbers, reproduced where they carry over and adapted
// where this prototype has only the one enemy. A world of segments replaces
// the fixed board; sandbox is that world's degenerate case, one arena that
// never clears (see the `mode` section, below the board helpers).
const MODES = ["sandbox", "advance"];
const ROAD_COLS = 3;
const TOWER_EVERY = 10;       // a tower is inserted before every 10th arena
const MAX_ALIVE = 6;          // rotters on the board at once, this arena's guard
const CLOCK_START = 30;       // seconds
const CLOCK_CAP = 45;
const HIT_TIME_PENALTY = 2.5; // seconds lost on a hit
const ADV_HURT_MS = 800;      // invulnerability after a hit, advance mode (sandbox keeps HURT_MS)
const WAKE_DELAY_MS = 650;    // entering a sleeping arena to its first wave
const WAVE_GAP_MS = 550;      // between a wave dying and the next
const AIM_UNLOCK_ARENA = 9;   // rotters don't enter the "aim"/bolt phase before this arena
const STEEL_FROM_ARENA = 5;   // three-shot "steel" rotters start appearing here
const STEEL_COMMON_ARENA = 20;// and get more common here
const STEEL_HP = 3;
const BASIC_HP = 1;
const PIP_SEC = 1.25;         // seconds per HUD clock pip

// ---------- camera ----------
// fixed    the framing the prototype was built with, leaning a little towards the buster
// follow   the same angle, but the buster stays centred
// orbit    around the board: Q/E turn, R/F tilt, the wheel zooms
// shoulder behind the buster, looking down the barrel — the aim moves the camera
// top      straight down, following loosely
const CAM_MODES = ["fixed", "follow", "orbit", "shoulder", "top"];

// Drag-as-stick: a finger has to leave this radius (CSS px) before the board
// reads a direction; a lift that never left it is a tap on a square.
const STICK_DEAD_PX = 26;

// ---------- juice ----------
// Chasing the 2D original's feel (see its src/core/fx.js and combat.js) on
// top of the numbers this prototype already reproduces. All of it is gated
// on `REDUCED_MOTION`, below.
const HITSTOP_MS = 70;          // a normal deletion
const HITSTOP_CHARGED_MS = 110; // a charged kill
const HITSTOP_CLEAR_MS = 140;   // a deletion that also clears the arena — wins over the others
const POPUP_MS = 700;
const POPUP_RISE = 0.5;
const CHAIN_STEPS = [5, 10, 20];
const PUNCH_MS = 250;
const PUNCH_DIST = 0.12;
const VIGNETTE_MS = 300;
const DEBRIS_MS = 600;
const DEBRIS_GRAVITY = 4.2;     // tiles / s^2
const TRACER_MS = 200;
const ARENA_STAGGER_MS = 60;    // between one column's retint/ripple and the next, on a clear
const ARENA_BANNER_MS = 1200;
const WAVE_CAPTION_MS = 1200;

/** `matchMedia("(prefers-reduced-motion: reduce)")` — no hit-stop, shake, punch or vignette when it's set. */
const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
let REDUCED_MOTION = reducedMotionQuery.matches;
reducedMotionQuery.addEventListener?.("change", (e) => { REDUCED_MOTION = e.matches; });

// ---------- palette (the game's) ----------

const PAL = {
  fog: 0x0e1420,
  tilePlayer: 0x18213a, tilePlayerRim: 0x4f8dff,
  tileEnemy: 0x2c1a26, tileEnemyRim: 0xff5470,
  tileRoad: 0x1c222f, tileRoadRim: 0x8a93ad,
  tileRot: 0x1b2a1c, tileRotRim: 0x7dff6a,
  armor: 0x4f8dff, armorDark: 0x2f5fc4, suit: 0x161c30, visor: 0xc9f6ff, barrel: 0xffd23f,
  ripple: 0x4f8dff, dust: 0x9fb0d0,
  shot: 0xffd23f, charged: 0xc9f6ff, bolt: 0xff5470,
  rotter: 0x5a1e2c, rotterDark: 0x2a1018, rotterBlade: 0xff5470, rotterEye: 0xffb3c0,
  rotterSteel: 0x3a3f47, rotterSteelDark: 0x22262b,
  keeperCloak: 0x141220, keeperVisor: 0xc9f6ff, keeperStaff: 0x3a3f4a, keeperOrb: 0xffd23f,
};

// ---------- easing ----------

/** Bump the camera shake envelope; a no-op under reduced motion. */
function shakeCam(amount) { if (!REDUCED_MOTION) cam.shake = Math.max(cam.shake, amount); }
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeInOutSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
/** Overshoots past 1 then returns: the landing's spring. */
const easeOutBack = (t) => { const c = 1.7; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
/** Shortest signed angle from a to b. */
const angleDelta = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// ---------- world <-> tile ----------

const tileX = (col) => (col - (COLS - 1) / 2) * TILE;
const tileZ = (row) => (row - (ROWS - 1) / 2) * TILE;
// onBoard / enemyHalf / offBoard used to be pure functions of a fixed 6x3
// board; advance mode needs them to answer against whatever of the world is
// built right now, so they moved down to the ---------- world ----------
// section, past the tile map they read.
/** The aim angle from (x, z) towards (tx, tz). */
const angleTo = (x, z, tx, tz) => Math.atan2(-(tz - z), tx - x);
/** Unit direction of an aim angle, in the board plane. */
const aimDir = (a, out) => out.set(Math.cos(a), 0, -Math.sin(a));

// ---------- clock ----------

// `?slow=4` runs the clock at a quarter speed: the same hop, stretched, for
// looking at the poses. Everything is timed off this one clock, so nothing
// else has to know.
const params = new URLSearchParams(location.search);
const SLOW = Math.max(1, Number(params.get("slow")) || 1);
const rawNow = () => performance.now() / SLOW;

// `now()` is `rawNow()` minus an offset that grows every time the sim is
// held still — a hit-stop, or a pause. Holding still is just "the offset
// grows to match the real time that passed"; every timer in the game reads
// `now()` and none of them has to know the sim ever stopped, which is the
// whole point of putting it here instead of threading a "frozen" flag
// through every phase's `t - t0`. The render loop is untouched either way —
// a frozen frame is rendered over and over, which for hit-stop is the
// effect, and for pause is enforced instead by `frame()` skipping every
// update call outright (see the ---------- loop ---------- section).
let hitstopOffset = 0;        // ms folded out of rawNow() so far
let hitstopEndsAtRaw = -Infinity;  // rawNow() at which the current freeze lets go
let hitstopHoldSim = 0;       // the sim time held during that freeze
let hitstopResolved = true;   // false while `hitstopOffset` still needs recomputing after a freeze ends
let paused = false;
let pausedSimTime = 0;        // the sim time held for as long as `paused`

function now() {
  if (paused) return pausedSimTime;
  const raw = rawNow();
  if (raw < hitstopEndsAtRaw) { hitstopResolved = false; return hitstopHoldSim; }
  if (!hitstopResolved) { hitstopOffset = hitstopEndsAtRaw - hitstopHoldSim; hitstopResolved = true; }
  return raw - hitstopOffset;
}
/** Freeze the sim clock for `ms` (stacking onto a freeze already running); a no-op under reduced motion. */
function triggerHitStop(ms) {
  if (REDUCED_MOTION) return;
  const raw = rawNow();
  if (raw < hitstopEndsAtRaw) { hitstopEndsAtRaw += ms; return; }
  hitstopHoldSim = now();
  hitstopEndsAtRaw = raw + ms;
  hitstopResolved = false;
}
/** Pause holds the sim clock exactly where it was; resuming folds the real time spent paused back out, so nothing downstream sees a gap. */
function setPaused(p) {
  if (p === paused) return;
  if (p) { pausedSimTime = now(); paused = true; }
  else { paused = false; hitstopEndsAtRaw = -Infinity; hitstopOffset = rawNow() - pausedSimTime; hitstopResolved = true; }
}

// ---------- textures drawn in code ----------
// No image files: a soft disc for glows, shadows and dust, and a gradient
// for the sky. Both are a few lines of Canvas 2D.

function softDisc(stops) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#090c13");
  grad.addColorStop(0.55, "#131b2c");
  grad.addColorStop(0.7, "#0f1522");
  grad.addColorStop(1, "#07090e");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const discTex = softDisc([[0, "rgba(255,255,255,1)"], [0.5, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]]);
const shadowTex = softDisc([[0, "rgba(0,0,0,1)"], [0.45, "rgba(0,0,0,0.55)"], [1, "rgba(0,0,0,0)"]]);

// ---------- scene ----------

const container = document.getElementById("stage");
const $ = (id) => document.getElementById(id);
const hud = {
  busted: $("hud-busted"), hits: $("hud-hits"),
  fire: $("btn-fire"), orbit: $("pad-orbit"),
  // advance / story mode
  level: $("hud-level"), pips: $("hud-pips"), chain: $("hud-chain"),
  talkHint: $("hud-talk-hint"), taskLine: $("hud-task-line"), talkBtn: $("btn-talk"),
  caption: $("hud-caption"), card: $("card"),
  advanceOnly: [$("hud-advance-stats")], sandboxOnly: [$("hud-sandbox-stats")],
  vignette: $("vignette"), arenaBanner: $("arena-banner"), arenaBannerText: $("arena-banner-text"),
};

// ---------- chips ----------
// The pad's MODE / AIM / CAM / LOCK buttons are two-line chips: a dim label
// and the live value, both readout and control at once. `announce()` is the
// one door every setter below walks through — a ~450ms scale/border ping so
// the eye finds the chip that changed, plus a `.via` badge (`key C`, `tap`,
// `shift`, `wheel`, `url`...) naming *how*, shown for ~900ms. It always
// pings; the badge only shows when a `via` is given.
const chips = {
  mode: { btn: $("btn-mode"), value: $("chip-mode"), via: $("via-mode") },
  aim: { btn: $("btn-aim"), value: $("chip-aim"), via: $("via-aim") },
  cam: { btn: $("btn-cam"), value: $("chip-cam"), via: $("via-cam") },
  lock: { btn: $("btn-lock"), value: $("chip-lock"), via: $("via-lock") },
};
function announce(id, value, via) {
  const c = chips[id];
  if (!c) return;
  c.value.textContent = value;
  if (via) {
    c.via.textContent = via;
    c.via.hidden = false;
    clearTimeout(c.viaTimer);
    c.viaTimer = setTimeout(() => { c.via.hidden = true; }, 900);
  }
  c.btn.classList.remove("ping");
  void c.btn.offsetWidth;   // restart the animation even on back-to-back changes
  c.btn.classList.add("ping");
  clearTimeout(c.pingTimer);
  c.pingTimer = setTimeout(() => c.btn.classList.remove("ping"), 460);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = skyTexture();
scene.fog = new THREE.Fog(PAL.fog, 9, 22);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
const CAM_POS = new THREE.Vector3(0, 3.3, 4.9);
const LOOK_AT = new THREE.Vector3(0, 0.05, 0.1);
const camPos = CAM_POS.clone();
const camTarget = LOOK_AT.clone();
camera.position.copy(camPos);
camera.lookAt(camTarget);

// Image-based lighting from a room built out of a few glowing panels: a big
// cool light overhead, the game's red off one side, its blue off the other.
// It is what makes the armour read as a surface instead of flat paint.
function makeEnvironment() {
  const room = new THREE.Scene();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const walls = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0c1018, side: THREE.BackSide }));
  walls.scale.setScalar(30);
  room.add(walls);
  const panel = (hex, intensity, pos, size) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity) }));
    m.position.set(...pos); m.scale.set(...size);
    room.add(m);
  };
  panel(0xdfe9ff, 9, [-3, 9, 5], [6, 0.2, 6]);      // key: a wide soft light above and behind the camera
  panel(0xff5470, 4, [10, 3, -6], [0.2, 4, 6]);     // rim: the enemy half's red
  panel(0x4f8dff, 3, [-10, 2, -4], [0.2, 4, 6]);    // fill: the player's blue
  panel(0x3a4a7a, 1.5, [0, -6, 0], [14, 0.2, 14]);  // a faint bounce from the floor
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  return tex;
}
scene.environment = makeEnvironment();
scene.environmentIntensity = 0.7;

scene.add(new THREE.HemisphereLight(0x9fbfff, 0x1a1420, 0.35));
const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
key.position.set(-3, 7, 4.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 2; key.shadow.camera.far = 18;
key.shadow.camera.left = -4.5; key.shadow.camera.right = 4.5;
key.shadow.camera.top = 3.5; key.shadow.camera.bottom = -3;
key.shadow.bias = -0.0008;
key.shadow.normalBias = 0.02;
key.shadow.radius = 3;
scene.add(key);
const rim = new THREE.DirectionalLight(0xff5470, 0.8);
rim.position.set(6, 2.5, -4);
scene.add(rim);
const fill = new THREE.DirectionalLight(0x4f8dff, 0.5);
fill.position.set(-6, 1.5, -3);
scene.add(fill);

// Ground: a dark plane that takes the shadow and fades into the fog, with a
// pool of light under the arena so it does not float in the void.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x0a0d14, roughness: 0.95, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.2;
ground.receiveShadow = true;
scene.add(ground);

// Tiles: a bevelled slab with a lit rim inset from its edge. Each remembers a
// dip so a landing can press it down and let it spring back, and a rot so a
// rotter can turn it green from under itself.
function tileSlabGeometry() {
  const s = (TILE - GAP) / 2, r = 0.07;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s); shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r); shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s); shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r); shape.quadraticCurveTo(-s, -s, -s + r, -s);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);      // extrude along +y
  g.translate(0, -0.08, 0);     // top face at y = 0.025 (the bevel)
  return g;
}
function tileRimGeometry() {
  const s = (TILE - GAP) / 2 - 0.09, w = 0.022;
  const outer = new THREE.Shape();
  outer.moveTo(-s, -s); outer.lineTo(s, -s); outer.lineTo(s, s); outer.lineTo(-s, s); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-s + w, -s + w); hole.lineTo(s - w, -s + w); hole.lineTo(s - w, s - w); hole.lineTo(-s + w, s - w); hole.closePath();
  outer.holes.push(hole);
  const g = new THREE.ShapeGeometry(outer);
  g.rotateX(-Math.PI / 2);
  return g;
}
const slabGeo = tileSlabGeometry();
const rimGeo = tileRimGeometry();
const ROT_SLAB = new THREE.Color(PAL.tileRot), ROT_RIM = new THREE.Color(PAL.tileRotRim);
const TILE_COLOR = {
  player: [PAL.tilePlayer, PAL.tilePlayerRim],
  enemy: [PAL.tileEnemy, PAL.tileEnemyRim],
  road: [PAL.tileRoad, PAL.tileRoadRim],
  tower: [PAL.tilePlayer, PAL.tilePlayerRim],
};

// ---------- world ----------
// Sandbox is a single fixed board; advance ("story") lays segments — arena,
// road, tower — end to end along +x and only ever appends. Both live in the
// same `tiles` map, keyed by world (col, row), so a tile lookup, a walk, a
// shot's flight and the camera all read one source of truth regardless of
// mode: sandbox just happens to build a world that never grows past its one
// arena. `COLS` (6) is the width every arena and tower segment shares; a
// road is `ROAD_COLS` (3) wide.
const tkey = (col, row) => col + "," + row;
const tiles = new Map();     // "col,row" -> tile record
let tileColMin = Infinity, tileColMax = -Infinity;

/** Place a tile of a given kind, or return the one already there. */
function buildTile(col, row, kind) {
  const k = tkey(col, row);
  const existing = tiles.get(k);
  if (existing) return existing;
  const [slabColor, rimColor] = TILE_COLOR[kind];
  const g = new THREE.Group();
  g.position.set(tileX(col), 0, tileZ(row));
  const slabMat = new THREE.MeshStandardMaterial({ color: slabColor, roughness: 0.42, metalness: 0.35 });
  const slab = new THREE.Mesh(slabGeo, slabMat);
  slab.receiveShadow = true;
  slab.castShadow = true;
  g.add(slab);
  const rimMat = new THREE.MeshBasicMaterial({ color: rimColor, transparent: true, opacity: 0.75 });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.position.y = 0.031;
  g.add(rimMesh);
  scene.add(g);
  const tl = {
    g, rimMat, slabMat, col, row, kind, isNpc: false, dip: 0, dipV: 0, glow: 0,
    rot: 0, rotHeld: false, baseSlab: slabMat.color.clone(), baseRim: rimMat.color.clone(),
    flash: 0, flashColor: new THREE.Color(PAL.bolt), dirty: false,
  };
  tiles.set(k, tl);
  if (col < tileColMin) tileColMin = col;
  if (col > tileColMax) tileColMax = col;
  return tl;
}
/** Recolour a tile to a new kind in place — how a cleared arena's enemy half becomes player ground. */
function retintTile(tl, kind) {
  tl.kind = kind;
  const [slabColor, rimColor] = TILE_COLOR[kind];
  tl.baseSlab.set(slabColor); tl.baseRim.set(rimColor);
  tl.slabMat.color.set(slabColor); tl.rimMat.color.set(rimColor);
}
function disposeTile(col, row) {
  const k = tkey(col, row);
  const tl = tiles.get(k);
  if (!tl) return;
  scene.remove(tl.g);
  tl.slabMat.dispose();
  tl.rimMat.dispose();
  tiles.delete(k);
}
const tileAt = (col, row) => tiles.get(tkey(col, row));

/** Every segment ever built, oldest first; the world only ever grows. */
const world = { segments: [], nextX: 0 };
/** The arena the player is walking towards or fighting — always the newest one built. */
function activeArena() {
  for (let i = world.segments.length - 1; i >= 0; i--) if (world.segments[i].kind === "arena") return world.segments[i];
  return null;
}
/** The world column an arena's fight starts at: 0 in sandbox (the whole board is the "arena"), the active arena's x0 in advance. */
function arenaBaseCol() { return mode === "sandbox" ? 0 : (activeArena()?.x0 ?? 0); }

function onBoard(col, row) { return tiles.has(tkey(col, row)); }
/** The enemy half of the arena currently in play — where rotters live, hop and rot the ground. */
function enemyHalf(col, row) { return onBoard(col, row) && col >= arenaBaseCol() + PCOLS && col < arenaBaseCol() + COLS; }
/**
 * A square the player may stand on. Sandbox never gates this — the 2D
 * original's ownership rule does not apply to the free-play board, so the
 * player has always been able to walk the whole 6x3 grid, red tiles
 * included. Advance mode enforces it: a contested arena's enemy half is
 * off limits, and so is the tower's NPC tile.
 */
function walkable(col, row) {
  const tl = tileAt(col, row);
  if (!tl) return false;
  if (mode === "sandbox") return true;
  if (tl.kind === "enemy" || tl.isNpc) return false;
  return true;
}
/** Past the built world's edge by more than a tile: where shots and bolts are spent, so nothing streams off into the sky. */
function offBoard(x, z) {
  if (Math.abs(z) > (ROWS * TILE) / 2 + 1.2) return true;
  if (tileColMin > tileColMax) return true;
  return x < tileX(tileColMin) - TILE / 2 - 1.2 || x > tileX(tileColMax) + TILE / 2 + 1.2;
}

/** Build one arena: the left PCOLS columns player ground, the rest the guard's, until cleared. */
function buildArenaSegment(x0, idx) {
  const seg = {
    kind: "arena", x0, cols: COLS, idx, owner: "enemy",
    pool: Math.min(20, 4 + Math.floor(idx * 0.16)),
    waveSize: Math.min(5, 2 + Math.floor(idx / 25)),
    dealt: 0, entered: false, wakeAt: null, nextWaveAt: null, waveAlive: 0,
  };
  for (let row = 0; row < ROWS; row++) {
    for (let col = x0; col < x0 + PCOLS; col++) buildTile(col, row, "player");
    for (let col = x0 + PCOLS; col < x0 + COLS; col++) buildTile(col, row, "enemy");
  }
  buildSegmentDecor(seg);
  world.segments.push(seg);
  return seg;
}
/** A road: always walkable, and half the time a single-lane "narrow" road (only row 1 exists, so onBoard already refuses the other rows). */
function buildRoadSegment(x0) {
  const narrow = Math.random() < 0.5;
  const seg = { kind: "road", x0, cols: ROAD_COLS, narrow };
  for (let row = 0; row < ROWS; row++) {
    if (narrow && row !== 1) continue;
    for (let col = x0; col < x0 + ROAD_COLS; col++) buildTile(col, row, "road");
  }
  buildSegmentDecor(seg);
  world.segments.push(seg);
  return seg;
}
/** A tower: the player's own ground, holding a keeper NPC on its middle tile (not standable). */
function buildTowerSegment(x0, ordinal) {
  const seg = { kind: "tower", x0, cols: COLS, ordinal, roostShown: ordinal === 0 };
  for (let row = 0; row < ROWS; row++) for (let col = x0; col < x0 + COLS; col++) buildTile(col, row, "tower");
  tileAt(x0 + PCOLS, 1).isNpc = true;
  buildSegmentDecor(seg);
  buildKeeper(seg);
  world.segments.push(seg);
  return seg;
}
/** The base slab and pool of light under one segment, and (arenas only) the divider between its halves. Disposed when the segment scrolls out of range. */
function buildSegmentDecor(seg) {
  const w = seg.cols * TILE + 0.3, d = ROWS * TILE + 0.3;
  const cx = (tileX(seg.x0) + tileX(seg.x0 + seg.cols - 1)) / 2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), new THREE.MeshStandardMaterial({ color: 0x0f1320, roughness: 0.6, metalness: 0.3 }));
  base.position.set(cx, -0.12, 0);
  base.receiveShadow = true;
  scene.add(base);
  const poolMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(seg.cols * TILE + 8, ROWS * TILE + 6),
    new THREE.MeshBasicMaterial({ map: discTex, color: 0x22304f, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  poolMesh.rotation.x = -Math.PI / 2;
  poolMesh.position.set(cx, -0.19, 0);
  scene.add(poolMesh);
  let divider = null;
  if (seg.kind === "arena") {
    divider = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, d - 0.1), new THREE.MeshBasicMaterial({ color: 0xc9f6ff, transparent: true, opacity: 0.9 }));
    divider.position.set((tileX(seg.x0 + PCOLS - 1) + tileX(seg.x0 + PCOLS)) / 2, -0.03, 0);
    scene.add(divider);
  }
  seg.decor = { base, poolMesh, divider };
}
function dropDivider(seg) {
  if (!seg.decor || !seg.decor.divider) return;
  scene.remove(seg.decor.divider);
  seg.decor.divider.geometry.dispose();
  seg.decor.divider.material.dispose();
  seg.decor.divider = null;
}
function disposeSegment(seg) {
  for (let row = 0; row < ROWS; row++) for (let col = seg.x0; col < seg.x0 + seg.cols; col++) disposeTile(col, row);
  if (seg.decor) {
    const { base, poolMesh, divider } = seg.decor;
    scene.remove(base); base.geometry.dispose(); base.material.dispose();
    scene.remove(poolMesh); poolMesh.geometry.dispose(); poolMesh.material.dispose();
    if (divider) { scene.remove(divider); divider.geometry.dispose(); divider.material.dispose(); }
  }
  if (seg.kind === "tower") disposeKeeper(seg);
  if (tileColMin === seg.x0 || tileColMax === seg.x0 + seg.cols - 1) {
    tileColMin = Infinity; tileColMax = -Infinity;
    for (const tl of tiles.values()) { if (tl.col < tileColMin) tileColMin = tl.col; if (tl.col > tileColMax) tileColMax = tl.col; }
  }
}
/** Drop segments more than ~14 columns behind the player: the scene stays bounded on an unbounded road. */
function trimBehindPlayer() {
  const cutoff = state.col - 14;
  while (world.segments.length > 1 && world.segments[0].x0 + world.segments[0].cols - 1 < cutoff) {
    disposeSegment(world.segments.shift());
  }
}

function disposeWorld() {
  for (const seg of [...world.segments]) disposeSegment(seg);
  world.segments.length = 0;
  world.nextX = 0;
  tileColMin = Infinity; tileColMax = -Infinity;
}

/** Sandbox: the original fixed 6x3 board, `owner` stuck on "enemy" forever — no flow, no clock, just the free-respawn loop below. */
function buildSandboxWorld() {
  disposeWorld();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < PCOLS; col++) buildTile(col, row, "player");
    for (let col = PCOLS; col < COLS; col++) buildTile(col, row, "enemy");
  }
}
/** A fresh story world: `[tower(x0=0), arena(idx 0)]`, exactly the 2D original's starting layout. */
function buildAdvanceWorld() {
  disposeWorld();
  const tower0 = buildTowerSegment(world.nextX, 0); world.nextX += tower0.cols;
  buildArenaSegment(world.nextX, 0);
  world.nextX += COLS;
}

// ---------- flow ----------
// Advance mode's pacing, reproducing the 2D original's numbers: no player
// health, a countdown clock that only drains while a guard is contested,
// refunded by clearing waves and arenas, spent by a hit. Score and chain
// ride on top of the same shots-and-rotters sandbox already has. None of
// this runs in sandbox mode — every entry point below is `mode === "advance"`
// gated, directly or through `run.over` / `activeArena()`.

function freshRun() {
  return {
    over: false, started: false,   // `started`: advance mode's sim (clock, waves, rotters) waits for the start card's FIRE
    timeLeft: CLOCK_START,
    score: 0, deletions: 0, chain: 0, bestChain: 0, shotsFired: 0, shotsHit: 0,
    hitThisArena: false, task: null, givenTask: false, talk: null,
  };
}
let run = freshRun();

const chainMultiplier = (chain) => (chain >= 20 ? 4 : chain >= 10 ? 3 : chain >= 5 ? 2 : 1);
/** Clearing and wave-clearing pay the clock back; never past the cap. */
function addTime(sec) { run.timeLeft = Math.min(CLOCK_CAP, run.timeLeft + sec); }

/** A third of a wave is "steel" (3 hp, a darker tint) from arena 5, half from arena 20; everything else is a one-shot basic virus. */
function rollRotterHp() {
  const idx = activeArena()?.idx ?? 0;
  const steelChance = idx >= STEEL_COMMON_ARENA ? 0.5 : idx >= STEEL_FROM_ARENA ? 1 / 3 : 0;
  const steel = Math.random() < steelChance;
  return { hp: steel ? STEEL_HP : BASIC_HP, steel };
}
/** Rotters don't enter the "aim"/bolt phase before arena 9 — sandbox's are always live. */
function rotterCanFire() { return mode === "sandbox" || (activeArena()?.idx ?? 0) >= AIM_UNLOCK_ARENA; }

const aliveInArena = () => rotters.filter((r) => r.phase !== "die").length;

/** Deal the next wave: as many as waveSize allows, capped by what's left in the pool and by MAX_ALIVE. */
function dealWave(a, t) {
  const n = Math.min(a.waveSize, a.pool - a.dealt, MAX_ALIVE);
  const waveNum = Math.floor(a.dealt / a.waveSize) + 1;
  const totalWaves = Math.ceil(a.pool / a.waveSize);
  for (let i = 0; i < n; i++) spawnRotter(t);
  a.dealt += n;
  a.waveAlive = n;
  showCaption(`WAVE ${waveNum} / ${totalWaves}`, WAVE_CAPTION_MS);
}

/** The pool is spent and the board is clear: flip the ground, pay the clock, and build onward. */
function clearArena(a, t) {
  a.owner = "player";
  // The retint and its ripple stagger column by column rather than firing at
  // once — the 2D original's own arena-taken pulse. Real-time `setTimeout`,
  // not the sim clock: it's a one-off flourish tied to columns already fixed
  // in world space, not a timer anything else reads.
  for (let col = a.x0 + PCOLS, i = 0; col < a.x0 + COLS; col++, i++) {
    const c = col;
    const doColumn = () => { for (let row = 0; row < ROWS; row++) { retintTile(tileAt(c, row), "player"); ripple(tileX(c), tileZ(row), PAL.tilePlayerRim, 1.6, 420); } };
    if (i === 0) doColumn(); else setTimeout(doColumn, i * ARENA_STAGGER_MS);
  }
  dropDivider(a);
  shakeCam(0.05);
  addTime(1.2);
  announceArenaTaken(a.idx, 1.2);
  if (run.task && !run.task.done) {
    if (run.task.id === "noHit" && !run.hitThisArena) completeTask();
    if (run.task.id === "chargedClear" && state.charge && t - state.charge.t0 >= CHARGE_MS) completeTask();
  }
  run.hitThisArena = false;
  const road = buildRoadSegment(world.nextX); world.nextX += road.cols;
  const nextIdx = a.idx + 1;
  if (nextIdx % TOWER_EVERY === 0) {
    const tower = buildTowerSegment(world.nextX, nextIdx / TOWER_EVERY);
    world.nextX += tower.cols;
  }
  const nextArena = buildArenaSegment(world.nextX, nextIdx);
  world.nextX += nextArena.cols;
  trimBehindPlayer();
}

/** The arena guard's state machine: sleeping → waking → wave after wave → cleared. */
function updateArenaFlow(t) {
  if (mode !== "advance" || run.over) return;
  const a = activeArena();
  if (!a || a.owner === "player") return;
  if (!a.entered) {
    if (state.col >= a.x0) { a.entered = true; a.wakeAt = t + WAKE_DELAY_MS; }
    return;
  }
  if (a.wakeAt != null) { if (t >= a.wakeAt) { dealWave(a, t); a.wakeAt = null; } return; }
  if (a.nextWaveAt != null) { if (t >= a.nextWaveAt) { dealWave(a, t); a.nextWaveAt = null; } return; }
  if (aliveInArena() > 0) return;
  if (a.dealt >= a.pool) { clearArena(a, t); return; }
  if (a.waveAlive > 0) { addTime(0.4 * a.waveAlive); a.waveAlive = 0; }
  a.nextWaveAt = t + WAVE_GAP_MS;
}

/** The pulse: drains only while the active arena is contested, at a rate that climbs with arena index. */
function updateClock() {
  if (mode !== "advance" || run.over) return;
  const a = activeArena();
  if (a && a.owner === "enemy" && a.entered) {
    run.timeLeft -= Math.min(1.45, 1 + a.idx * 0.02) * (frameDt / 1000);
    if (run.timeLeft <= 0) { run.timeLeft = 0; gameOver(); }
  }
}

function gameOver() {
  if (run.over) return;
  run.over = true;
  state.charge = null; state.path = null; state.queued = null;
  hud.fire.classList.remove("held", "ready");
  const acc = run.shotsFired > 0 ? Math.round((run.shotsHit / run.shotsFired) * 100) : 0;
  $("card-arena").textContent = String((activeArena()?.idx ?? 0) + 1);
  $("card-score").textContent = String(run.score);
  $("card-deletions").textContent = String(run.deletions);
  $("card-chain").textContent = String(run.bestChain);
  $("card-acc").textContent = `${acc}%`;
  showCard("over");
}
/** RETRY: rebuild the world from scratch, exactly the fresh-run layout, and wait on the start card again. */
function retry() {
  if (mode !== "advance") return;
  run = freshRun();
  buildAdvanceWorld();
  state.col = 1; state.row = 1; state.hop = null; state.path = null; state.queued = null;
  state.pos.set(tileX(1), 0, tileZ(1));
  camAnchorX = state.pos.x; camLookX = state.pos.x;
  hideCaption();
  showCard("start");
}

// ---------- cards ----------
// One overlay element, three bodies (`#card-over` / `#card-start` /
// `#card-pause`), only one shown at a time — `cardKind` says which, or
// `null` for none. Every card but "over" is dismissed by FIRE; "pause" also
// by P or Escape. Input handlers gate on `cardKind` (see ---------- input
// ---------- ) so nothing behind the card reacts while it's up.
let cardKind = null;
function showCard(kind) {
  cardKind = kind;
  hud.card.hidden = false;
  $("card-over").hidden = kind !== "over";
  $("card-start").hidden = kind !== "start";
  $("card-pause").hidden = kind !== "pause";
}
function hideCardAll() {
  cardKind = null;
  hud.card.hidden = true;
}
/** FIRE on the start card: let the sim (clock, waves, rotters) begin. */
function startRun() {
  if (cardKind !== "start") return;
  hideCardAll();
  run.started = true;
}
function pauseGame() {
  if (cardKind) return;   // a start/over/pause card already has the floor
  setPaused(true);
  showCard("pause");
}
function resumeGame() {
  setPaused(false);
  hideCardAll();
}

function completeTask() {
  if (!run.task || run.task.done) return;
  run.task.done = true;
  run.score += 500;
  addTime(5);
  showCaption("TASK COMPLETE +5s +500", 2500);
}

// ---------- story ----------
// Towers: a keeper standing on the middle tile, talked to from beside it,
// player-paced beat by beat. The first conversation of a run hands out one
// small bonus task and actually tracks it. The original's dialogue is not
// reproducible (its prose lives outside this repo) so these are new lines,
// written short and in the game's own voice.

const TASKS = [
  { id: "noHit", desc: "Take an arena without being hit." },
  { id: "chain8", desc: "Delete eight in a row without missing." },
  { id: "chargedClear", desc: "Clear an arena with one charged shot left in the chamber." },
];
const TOWER_BEATS = [
  ["The next ground is theirs. Take it and walk on.", "Every panel you don't take rots under them a little longer.", "Go. The tower keeps."],
  ["Another guard sleeps just past here. It wakes when you cross the line.", "Delete it clean and the ground remembers whose it is.", "Walk on."],
  ["The pool only gets deeper from here.", "Save a charge for the ones with the darker plating.", "Go take the ground."],
];

const keepers = [];   // { g, seg, seed } — one per tower segment
function buildKeeper(seg) {
  const g = new THREE.Group();
  g.position.set(tileX(seg.x0 + PCOLS), 0, tileZ(1));
  const cloakMat = new THREE.MeshStandardMaterial({ color: PAL.keeperCloak, roughness: 0.85, metalness: 0.1 });
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.34, 1.15, 12), cloakMat, 0, 0.58, 0));
  g.add(mesh(new THREE.SphereGeometry(0.16, 12, 10), cloakMat, 0, 1.14, 0));   // the hood
  const visorMat = new THREE.MeshStandardMaterial({ color: PAL.keeperVisor, emissive: PAL.keeperVisor, emissiveIntensity: 1.8, roughness: 0.2 });
  g.add(box(0.2, 0.03, 0.02, visorMat, 0, 1.03, 0.15));
  const staffMat = new THREE.MeshStandardMaterial({ color: PAL.keeperStaff, roughness: 0.5, metalness: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 8), staffMat, 0.3, 0.65, 0.12));
  const orbMat = new THREE.MeshStandardMaterial({ color: PAL.keeperOrb, emissive: PAL.keeperOrb, emissiveIntensity: 1.2 });
  g.add(ball(0.07, orbMat, 0.3, 1.32, 0.12, 10));
  scene.add(g);
  keepers.push({ g, seg, seed: Math.random() * 100 });
}
function disposeKeeper(seg) {
  const i = keepers.findIndex((k) => k.seg === seg);
  if (i < 0) return;
  const k = keepers[i];
  k.g.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry) o.geometry.dispose(); });
  scene.remove(k.g);
  keepers.splice(i, 1);
}
/** A slow idle sway — standing still, but not a statue. */
function updateKeepers(t) {
  for (const k of keepers) {
    k.g.rotation.y = 0.06 * Math.sin(t / 1400 + k.seed);
    k.g.position.y = 0.01 * Math.sin(t / 900 + k.seed);
  }
}

/** The tower the player is standing beside (orthogonally adjacent to its keeper's tile), if any. */
function nearbyTower() {
  for (const seg of world.segments) {
    if (seg.kind !== "tower") continue;
    const ncol = seg.x0 + PCOLS, nrow = 1;
    if ((state.col === ncol && Math.abs(state.row - nrow) === 1) || (Math.abs(state.col - ncol) === 1 && state.row === nrow)) return seg;
  }
  return null;
}
/** Stepping onto a tower for the first time: a one-shot "ROOST n" caption. */
function checkRoost() {
  for (const seg of world.segments) {
    if (seg.kind === "tower" && !seg.roostShown && state.col >= seg.x0 && state.col < seg.x0 + seg.cols) {
      seg.roostShown = true;
      showCaption(`ROOST ${seg.ordinal + 1}`, 1500);
    }
  }
}
/** TALK: press once beside the keeper to open, once per beat to advance, and once on the last beat to close. */
function pressTalk() {
  if (mode !== "advance") return;
  if (run.talk) { advanceTalk(); return; }
  const seg = nearbyTower();
  if (!seg) return;
  const beats = TOWER_BEATS[seg.ordinal % TOWER_BEATS.length];
  run.talk = { seg, beats, i: 0 };
  showCaption(beats[0]);
}
function advanceTalk() {
  const tk = run.talk;
  tk.i++;
  if (tk.i >= tk.beats.length) closeTalk();
  else showCaption(tk.beats[tk.i]);
}
function closeTalk() {
  run.talk = null;
  hideCaption();
  if (!run.givenTask) assignTask();
}
function assignTask() {
  run.givenTask = true;
  const pick = TASKS[Math.floor(Math.random() * TASKS.length)];
  run.task = { id: pick.id, desc: pick.desc, done: false };
  showCaption(`TASK: ${pick.desc}`, 3200);
}

/** hud.caption: a bottom-centre line, shared by TALK beats, ROOST and task callouts. `ms` auto-hides; omitted, it stays until replaced or hidden. */
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

/** The big centred "ARENA n TAKEN +bonus" banner a clear announces. */
let arenaBannerTimer = null;
function announceArenaTaken(idx, bonusSec) {
  hud.arenaBannerText.textContent = `ARENA ${idx + 1} TAKEN  +${bonusSec.toFixed(1)}s`;
  hud.arenaBanner.hidden = false;
  hud.arenaBanner.classList.remove("show");
  void hud.arenaBanner.offsetWidth;
  hud.arenaBanner.classList.add("show");
  clearTimeout(arenaBannerTimer);
  arenaBannerTimer = setTimeout(() => { hud.arenaBanner.hidden = true; }, ARENA_BANNER_MS);
}

// ---------- mode ----------

/** The clock's pip bar: built once per mode switch, 36 spans at the 45 s cap, `lit` toggled every frame. */
function buildPips() {
  hud.pips.innerHTML = "";
  const total = Math.round(CLOCK_CAP / PIP_SEC);
  for (let i = 0; i < total; i++) hud.pips.appendChild(document.createElement("span"));
}
/** LEVEL, the pips, the chain, and the task line — the advance-only second HUD row. */
function updateAdvanceHud() {
  const a = activeArena();
  hud.level.textContent = String((a?.idx ?? 0) + 1);
  hud.chain.textContent = String(run.chain);
  const lit = Math.max(0, Math.ceil(run.timeLeft / PIP_SEC));
  const pips = hud.pips.children;
  for (let i = 0; i < pips.length; i++) {
    pips[i].classList.toggle("lit", i < lit);
    pips[i].classList.toggle("low", i < lit && lit <= 8);
  }
  const showTask = run.task && !run.task.done;
  hud.taskLine.hidden = !showTask;
  if (showTask) hud.taskLine.textContent = `task: ${run.task.desc} \u00a0\u00b7\u00a0 `;
  const near = !run.talk && !!nearbyTower();
  hud.talkHint.hidden = !near;
  hud.talkBtn.hidden = !(near || run.talk);
}

/** (Re)build the world for whichever mode is live, and reset the run/camera to match. */
function applyMode() {
  hideCaption();
  hideCardAll();
  for (const el of hud.advanceOnly) el.hidden = mode !== "advance";
  for (const el of hud.sandboxOnly) el.hidden = mode === "advance";
  run = freshRun();
  if (mode === "advance") {
    buildPips();
    buildAdvanceWorld();
    showCard("start");   // the sim waits for FIRE — see startRun()
  } else {
    buildSandboxWorld();
  }
  state.col = 1; state.row = 1; state.hop = null; state.path = null; state.queued = null;
  state.pos.set(tileX(1), 0, tileZ(1));
  camPos.copy(CAM_POS);
  camTarget.copy(LOOK_AT);
  camAnchorX = state.pos.x; camLookX = state.pos.x;
}
function setMode(m, via) {
  if (!MODES.includes(m) || m === mode) return;
  mode = m;
  applyMode();
  announce("mode", m, via);
}
function toggleMode(via) { setMode(mode === "sandbox" ? "advance" : "sandbox", via); }

// Motes: a slow drift of dust in the light, so the air has depth.
const MOTES = 220;
const motePos = new Float32Array(MOTES * 3);
const moteSeed = new Float32Array(MOTES);
for (let i = 0; i < MOTES; i++) {
  motePos[i * 3] = (Math.random() - 0.5) * 12;
  motePos[i * 3 + 1] = Math.random() * 3.2 - 0.1;
  motePos[i * 3 + 2] = (Math.random() - 0.5) * 8;
  moteSeed[i] = Math.random() * 1000;
}
const moteGeo = new THREE.BufferGeometry();
moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
  map: discTex, color: 0x8fb0ff, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending,
}));
scene.add(motes);
function updateMotes(t) {
  const a = moteGeo.attributes.position.array;
  for (let i = 0; i < MOTES; i++) {
    const s = moteSeed[i];
    a[i * 3 + 1] += 0.00008 * frameDt * (0.6 + Math.sin(s) * 0.4);
    a[i * 3] += Math.sin(t / 2600 + s) * 0.0002 * frameDt;
    if (a[i * 3 + 1] > 3.2) a[i * 3 + 1] = -0.1;
  }
  moteGeo.attributes.position.needsUpdate = true;
}

// ---------- the character ----------
// Built from capsules, spheres and boxes, rigged as nested groups so a pose
// is a set of rotations. The model faces +x at rest: the barrel out to the
// right, towards the enemy half, the way the 2D buster stands.

const matArmor = new THREE.MeshStandardMaterial({ color: PAL.armor, roughness: 0.32, metalness: 0.45 });
const matArmorDark = new THREE.MeshStandardMaterial({ color: PAL.armorDark, roughness: 0.4, metalness: 0.5 });
const matSuit = new THREE.MeshStandardMaterial({ color: PAL.suit, roughness: 0.85, metalness: 0.1 });
const matVisor = new THREE.MeshStandardMaterial({ color: PAL.visor, emissive: PAL.visor, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2, side: THREE.DoubleSide });
const matCore = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: PAL.visor, emissiveIntensity: 2.2, roughness: 0.2 });
const matBarrel = new THREE.MeshStandardMaterial({ color: PAL.barrel, roughness: 0.3, metalness: 0.7 });
const matMuzzle = new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffb84a, emissiveIntensity: 1.4, roughness: 0.3 });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const ball = (r, mat, x, y, z, seg = 14) => mesh(new THREE.SphereGeometry(r, seg, seg), mat, x, y, z);

/** A limb segment hangs from its pivot: a capsule whose top sits at the joint. */
function segment(r, len, mat) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 4, 12), mat, 0, -len / 2, 0));
  return g;
}

function buildCharacter() {
  const root = new THREE.Group();          // at the tile centre, y = ground
  root.scale.setScalar(CHAR_SCALE);
  const squash = new THREE.Group();        // non-uniform scale for the landing
  root.add(squash);

  const HIP_Y = 0.9;
  const hips = new THREE.Group();
  hips.position.y = HIP_Y;
  squash.add(hips);
  hips.add(box(0.36, 0.2, 0.3, matSuit, 0, -0.02, 0));                 // pelvis
  hips.add(box(0.4, 0.07, 0.34, matArmorDark, 0, 0.06, 0));             // belt
  const buckle = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), matCore, 0.19, 0.06, 0);
  buckle.rotation.z = Math.PI / 2;
  hips.add(buckle);

  // torso hangs UP from the hips (pivot at the waist so a lean bends there)
  const torso = new THREE.Group();
  torso.position.y = 0.1;
  hips.add(torso);
  torso.add(box(0.34, 0.18, 0.26, matSuit, 0, 0.1, 0));                 // abdomen
  torso.add(box(0.46, 0.42, 0.36, matArmor, 0, 0.4, 0));               // chest plate
  torso.add(box(0.5, 0.1, 0.4, matArmorDark, 0, 0.58, 0));             // collar
  const core = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 6), matCore, 0.235, 0.44, 0);  // the core light, on the +x face
  core.rotation.z = Math.PI / 2;
  core.castShadow = false;
  torso.add(core);
  torso.add(box(0.14, 0.3, 0.3, matArmorDark, -0.26, 0.38, 0));        // backpack
  torso.add(box(0.06, 0.2, 0.08, matSuit, -0.34, 0.4, -0.1));          // vents
  torso.add(box(0.06, 0.2, 0.08, matSuit, -0.34, 0.4, 0.1));

  // neck and helmet: a dome, a wraparound visor over the front, a crest
  torso.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), matSuit, 0, 0.66, 0));
  const head = new THREE.Group();
  head.position.y = 0.7;
  torso.add(head);
  head.add(ball(0.22, matArmor, 0, 0.2, 0, 18));
  head.add(mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.16, 20, 1, true), matArmorDark, 0, 0.17, 0)); // helmet band
  // the visor: an open strip of a cylinder. Three's cylinder starts its
  // sweep at +z, so a strip centred on +x is rotated a quarter turn.
  const visor = mesh(new THREE.CylinderGeometry(0.234, 0.234, 0.085, 20, 1, true, -1.15, 2.3), matVisor, 0, 0.19, 0);
  visor.rotation.y = Math.PI / 2;
  visor.castShadow = false;
  head.add(visor);
  head.add(box(0.26, 0.06, 0.05, matArmorDark, -0.02, 0.41, 0));       // crest
  const podL = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 10), matArmorDark, 0, 0.19, -0.23);
  podL.rotation.x = Math.PI / 2;
  const podR = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 10), matArmorDark, 0, 0.19, 0.23);
  podR.rotation.x = Math.PI / 2;
  head.add(podL); head.add(podR);

  // arms: pauldron, upper arm, elbow, forearm; the right forearm is the buster
  const shoulderY = 0.6;
  function arm(side) {              // side: -1 (left, -z) or +1 (right, +z)
    const g = segment(0.075, 0.32, matArmor);
    g.position.set(0, shoulderY, side * 0.31);
    g.add(mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), matArmorDark, 0, 0.02, side * 0.02)); // pauldron
    g.add(ball(0.07, matSuit, 0, -0.32, 0));                             // elbow
    const fore = segment(0.065, 0.3, matSuit);
    fore.position.y = -0.32;
    g.add(fore);
    return { g, fore };
  }
  const L = arm(-1), R = arm(1);
  L.fore.add(box(0.12, 0.12, 0.13, matArmorDark, 0.01, -0.3, 0));       // left glove
  // the buster: a barrel over the right forearm, a dark muzzle ring and a lit bore
  R.fore.add(mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.4, 14), matBarrel, 0, -0.22, 0));
  R.fore.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 14), matArmorDark, 0, -0.4, 0));
  const bore = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), matMuzzle, 0, -0.425, 0);
  bore.castShadow = false;
  R.fore.add(bore);
  // an empty just past the bore: where shots leave and the flash sits
  const muzzle = new THREE.Object3D();
  muzzle.position.y = -0.5;
  R.fore.add(muzzle);
  torso.add(L.g); torso.add(R.g);

  // legs hang DOWN from the hips: thigh, knee, shin, boot
  function leg(side) {
    const g = segment(0.085, 0.42, matArmor);
    g.position.set(0, -0.06, side * 0.13);
    g.add(ball(0.08, matSuit, 0, -0.42, 0));                             // knee
    const shin = segment(0.07, 0.4, matSuit);
    shin.position.y = -0.42;
    shin.add(box(0.16, 0.18, 0.15, matArmorDark, 0.01, -0.3, 0));        // greave
    shin.add(box(0.28, 0.09, 0.16, matArmorDark, 0.06, -0.41, 0));       // boot, toes towards +x
    shin.add(box(0.3, 0.03, 0.17, matSuit, 0.06, -0.465, 0));            // sole
    g.add(shin);
    return { g, shin };
  }
  const legL = leg(-1), legR = leg(1);
  hips.add(legL.g); hips.add(legR.g);

  return {
    root, squash, hips, HIP_Y, torso, head, muzzle,
    armL: L.g, foreL: L.fore, armR: R.g, foreR: R.fore,
    legL: legL.g, shinL: legL.shin, legR: legR.g, shinR: legR.shin,
  };
}

const rig = buildCharacter();
scene.add(rig.root);

// A contact shadow under the buster: a soft blob that shrinks and fades as
// the hop gains height, so the arc reads even where the key light's shadow
// falls off the board.
const contact = new THREE.Mesh(
  new THREE.PlaneGeometry(0.62, 0.62),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.6, depthWrite: false }),
);
contact.rotation.x = -Math.PI / 2;
contact.position.y = 0.034;
scene.add(contact);

// The sight: a faint line from the barrel along the aim, so where a shot will
// go is visible before it is fired — free aim has no lane to read it from.
// It brightens under the lock and turns the lock's red on a target.
const sightGeo = new THREE.BufferGeometry();
sightGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
const sightMat = new THREE.LineBasicMaterial({ color: PAL.visor, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
const sight = new THREE.Line(sightGeo, sightMat);
sight.frustumCulled = false;
scene.add(sight);

// The lock ring: sits under the rotter the barrel is held on.
const lockRing = new THREE.Mesh(
  new THREE.RingGeometry(0.3, 0.34, 32),
  new THREE.MeshBasicMaterial({ color: PAL.bolt, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
);
lockRing.rotation.x = -Math.PI / 2;
lockRing.position.y = 0.04;
lockRing.visible = false;
scene.add(lockRing);

// Muzzle flash and the charge glow: two sprites that live on the muzzle.
const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, color: PAL.shot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
flash.scale.setScalar(0.001);
scene.add(flash);
const chargeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, color: PAL.charged, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
chargeGlow.scale.setScalar(0.001);
scene.add(chargeGlow);

// ---------- effects ----------

// Landing rings: a flat ring that grows and fades where the feet come down.
const ripples = [];
const rippleGeo = new THREE.RingGeometry(0.2, 0.25, 32);
function ripple(x, z, color, scaleTo = 1.6, ms = 380) {
  const m = new THREE.Mesh(rippleGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.036, z);
  scene.add(m);
  ripples.push({ m, t0: now(), ms, scaleTo });
}
function updateRipples(t) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    const u = clamp01((t - r.t0) / r.ms);
    const s = lerp(0.6, r.scaleTo, easeOutQuad(u));
    r.m.scale.set(s, s, s);
    r.m.material.opacity = 0.9 * (1 - u);
    if (u >= 1) { scene.remove(r.m); r.m.material.dispose(); ripples.splice(i, 1); }
  }
}

// Dust: a few soft puffs kicked out sideways on take-off and on landing. The
// same puffs, coloured and thrown harder, are sparks off a hit and the debris
// of a deletion.
const puffs = [];
const puffMat = new THREE.SpriteMaterial({ map: discTex, color: PAL.dust, transparent: true, opacity: 0.5, depthWrite: false });
function dust(x, z, count, speed, opts = {}) {
  const { color = PAL.dust, y = 0.05, rise = 0.12, size = [0.08, 0.26], ms = [320, 480], additive = false } = opts;
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(puffMat.clone());
    s.material.color.set(color);
    if (additive) s.material.blending = THREE.AdditiveBlending;
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.5 + Math.random() * 0.5);
    s.position.set(x, y, z);
    s.scale.setScalar(size[0]);
    scene.add(s);
    puffs.push({ s, vx: Math.cos(a) * v, vz: Math.sin(a) * v, rise, size, t0: now(), ms: rand(ms[0], ms[1]) });
  }
}
function updatePuffs(t) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i];
    const u = clamp01((t - p.t0) / p.ms);
    const k = frameDt / 1000;
    p.s.position.x += p.vx * k * (1 - u);
    p.s.position.z += p.vz * k * (1 - u);
    p.s.position.y += p.rise * k;
    p.s.scale.setScalar(lerp(p.size[0], p.size[1], easeOutQuad(u)));
    p.s.material.opacity = 0.5 * (1 - u);
    if (u >= 1) { scene.remove(p.s); p.s.material.dispose(); puffs.splice(i, 1); }
  }
}

/** Press a tile down and light its rim; it springs back on its own. */
function pressTile(col, row, amount) {
  const tl = tileAt(col, row);
  if (!tl) return;
  tl.dipV -= amount;
  tl.glow = 1;
}
/** Flash a tile's rim a colour: the rotter's telegraph. */
function flashTile(col, row, color) {
  const tl = tileAt(col, row);
  if (!tl) return;
  tl.flash = 1;
  tl.flashColor.set(color);
}
const _c = new THREE.Color();
function updateTiles() {
  const k = frameDt / 1000;
  for (const tl of tiles.values()) {
    // the rot: held at its level while a rotter sits, healing once it leaves
    if (!tl.rotHeld && tl.rot > 0) tl.rot = Math.max(0, tl.rot - frameDt * ROT_DECAY);
    tl.rotHeld = false;
    if (tl.flash > 0) tl.flash = Math.max(0, tl.flash - k * 3);
    if (tl.dip === 0 && tl.dipV === 0 && tl.glow === 0 && tl.rot === 0 && tl.flash === 0 && !tl.dirty) continue;
    // a stiff spring towards rest
    tl.dipV += (-tl.dip * 260 - tl.dipV * 18) * k;
    tl.dip += tl.dipV * k;
    if (Math.abs(tl.dip) < 0.0005 && Math.abs(tl.dipV) < 0.002) { tl.dip = 0; tl.dipV = 0; }
    tl.g.position.y = tl.dip;
    tl.glow = Math.max(0, tl.glow - k * 2.6);
    tl.slabMat.color.lerpColors(tl.baseSlab, ROT_SLAB, tl.rot);
    _c.lerpColors(tl.baseRim, ROT_RIM, tl.rot);
    tl.rimMat.color.lerpColors(_c, tl.flashColor, tl.flash);
    tl.rimMat.opacity = 0.75 + 0.25 * Math.max(tl.glow, tl.flash);
    // one more pass after the colours have faded, so they land exactly on base
    tl.dirty = tl.rot > 0 || tl.flash > 0;
  }
}

// ---------- popups ----------
// Floating score/status text — a world-space sprite, not DOM, so it sits
// exactly at the deletion and rides the camera like everything else. Each
// unique string gets one canvas texture, cached and reused: a fight spends
// most of its popups on the same handful of strings ("+100", "BUSTED", the
// chain multipliers), so there is no reason to redraw a canvas per one.
const popupTexCache = new Map();
const POPUP_CANVAS_W = 256, POPUP_CANVAS_H = 96;
function popupTexture(text, color) {
  const key = text + "|" + color;
  let tex = popupTexCache.get(key);
  if (tex) return tex;
  const c = document.createElement("canvas");
  c.width = POPUP_CANVAS_W; c.height = POPUP_CANVAS_H;
  const g = c.getContext("2d");
  g.font = "700 42px ui-monospace, Menlo, Consolas, monospace";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 8; g.strokeStyle = "rgba(7,9,14,0.9)";
  g.strokeText(text, c.width / 2, c.height / 2);
  g.fillStyle = color;
  g.fillText(text, c.width / 2, c.height / 2);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  popupTexCache.set(key, tex);
  return tex;
}
const popups = [];
const POPUP_ASPECT = POPUP_CANVAS_H / POPUP_CANVAS_W;
/** A floating text sprite at (x, z): rises (or, `fall`, sinks) and fades over `ms`, with a punchy scale-in. */
function popup(x, z, text, opts = {}) {
  const { color = "#c9f6ff", y0 = 0.5, rise = POPUP_RISE, ms = POPUP_MS, fall = false } = opts;
  const mat = new THREE.SpriteMaterial({ map: popupTexture(text, color), transparent: true, depthWrite: false, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.position.set(x, y0, z);
  s.scale.set(0.001, 0.001, 1);
  scene.add(s);
  popups.push({ s, x, z, y0, drift: fall ? -rise : rise, t0: now(), ms, targetW: 0.62 });
}
function updatePopups(t) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    const u = clamp01((t - p.t0) / p.ms);
    const growU = clamp01(u / 0.22);
    const w = p.targetW * (growU < 1 ? Math.max(0, easeOutBack(growU)) : 1);
    p.s.scale.set(w, w * POPUP_ASPECT, 1);
    p.s.position.set(p.x, p.y0 + p.drift * easeOutQuad(u), p.z);
    p.s.material.opacity = u < 0.65 ? 1 : 1 - (u - 0.65) / 0.35;
    if (u >= 1) { scene.remove(p.s); p.s.material.dispose(); popups.splice(i, 1); }
  }
}

/** A chain stepping up to ×2/×3/×4 (at 5/10/20): a ring burst around the buster and a yellow multiplier popup. */
function chainFlourish(mult) {
  if (!REDUCED_MOTION) ripple(state.pos.x, state.pos.z, PAL.shot, 2.4, 480);
  popup(state.pos.x, state.pos.z, `×${mult}`, { color: "#ffd23f", y0: 0.9, rise: 0.6, ms: 750 });
}
/** A hit breaking a live chain: the HUD counter flashes red and the lost chain falls away instead of rising. */
function chainLostFlourish() {
  popup(state.pos.x, state.pos.z, "CHAIN LOST", { color: PAL.bolt, y0: 0.9, rise: 0.4, ms: 700, fall: true });
  hud.chain.classList.remove("lost");
  void hud.chain.offsetWidth;
  hud.chain.classList.add("lost");
}

// ---------- debris ----------
// A deletion's aftermath: a handful of small dark chunks in the rotter's own
// colours, thrown up and out, bouncing once off the floor, fading over
// DEBRIS_MS. One shared box geometry; each chunk gets its own material only
// because each one needs its own fade and colour.
const debrisGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
const debris = [];
function spawnDebris(x, z, palette) {
  const n = 5 + Math.floor(Math.random() * 3);   // 5-7
  for (let i = 0; i < n; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: palette[Math.floor(Math.random() * palette.length)], transparent: true });
    const m = new THREE.Mesh(debrisGeo, mat);
    m.position.set(x, 0.15, z);
    m.rotation.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));
    scene.add(m);
    const a = rand(0, Math.PI * 2);
    const speed = rand(0.5, 1.3);
    debris.push({
      m, x, y: 0.15, z, vx: Math.cos(a) * speed, vz: Math.sin(a) * speed, vy: rand(1.2, 2.2),
      spinX: rand(-8, 8), spinY: rand(-8, 8), bounced: false, t0: now(), ms: DEBRIS_MS,
    });
  }
}
function updateDebris(t) {
  const dt = frameDt / 1000;
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    const u = clamp01((t - d.t0) / d.ms);
    d.vy -= DEBRIS_GRAVITY * dt;
    d.x += d.vx * dt; d.z += d.vz * dt; d.y += d.vy * dt;
    if (d.y <= 0.03) {
      d.y = 0.03;
      if (!d.bounced) { d.bounced = true; d.vy = Math.abs(d.vy) * 0.4; } else d.vy = Math.max(0, d.vy);
    }
    d.m.position.set(d.x, d.y, d.z);
    d.m.rotation.x += d.spinX * dt; d.m.rotation.y += d.spinY * dt;
    d.m.material.opacity = 1 - u;
    if (u >= 1) { scene.remove(d.m); d.m.material.dispose(); debris.splice(i, 1); }
  }
}

// ---------- tracers ----------
// The charged shot's own aftermath, on top of the flight it already has: a
// thin line along the whole path, fading fast — the ring on impact is just
// `ripple()` with a bigger scale (see updateShots).
const tracers = [];
function spawnTracer(x0, z0, x1, z1) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x0, 0.28, z0, x1, 0.28, z1]), 3));
  const mat = new THREE.LineBasicMaterial({ color: PAL.charged, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, t0: now(), ms: TRACER_MS });
}
function updateTracers(t) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    const u = clamp01((t - tr.t0) / tr.ms);
    tr.line.material.opacity = 0.9 * (1 - u);
    if (u >= 1) { scene.remove(tr.line); tr.line.geometry.dispose(); tr.line.material.dispose(); tracers.splice(i, 1); }
  }
}

// ---------- state ----------

const initialAim = AIM_MODES.includes(params.get("aim")) ? params.get("aim") : "lane";
const initialCam = CAM_MODES.includes(params.get("cam")) ? params.get("cam") : "fixed";
/** Which ruleset is live: the free-play board, or the 2D original's endless road. `setMode()` (bottom, mode control) rebuilds the world when this changes. */
let mode = MODES.includes(params.get("mode")) ? params.get("mode") : "sandbox";

const state = {
  col: 1, row: 1,             // the square counted as stood on
  pos: new THREE.Vector3(tileX(1), 0, tileZ(1)),   // where the body is, this frame
  hop: null,                  // { fromCol, fromRow, toCol, toRow, t0, committed, left, landed }
  lastMoveAt: -1e9,
  lastIdleAt: 0,              // when the last hop finished
  path: null,                 // { col, row } a tap to walk towards
  queued: null,               // a step asked for inside the ration
  // aiming
  aimMode: initialAim,        // "lane" | "4" | "8" | "free"
  aim: 0,                     // the angle shots leave at
  aimAt: -1e9,                // when the aim was last set on purpose (input, lock, fire)
  cosmetic: true,             // at rest and unaimed: show the REST_YAW three-quarter turn
  hoverAim: 0, hoverAt: -1e9, // the mouse's last aim, and when
  lockHold: false, lockToggle: false,   // Shift held; L / the button toggled
  lock: false,
  lockTarget: null,           // the rotter the barrel is held on
  facing: REST_YAW,           // yaw of the body, radians; 0 faces +x
  twist: 0,                   // legs turned off the barrel, in a strafe
  // the buster
  charge: null,               // { t0 } while FIRE is held
  lastFireAt: -1e9,
  fireAt: -1e9, fireCharged: false,
  hurtUntil: -1e9,
  busted: 0, hits: 0,
  phase: "idle",
};

const cam = { mode: initialCam, yaw: 0.55, pitch: 0.62, dist: 6.2, shake: 0 };
/**
 * Advance mode's look-at x: `camAnchorX` is a running max — the arena's
 * centre while it's contested, else the player's x — so the camera never
 * slides backward down the road; `camLookX` chases it with a 170 ms time
 * constant, independent of whichever camera mode's own easing is doing the
 * rest of the framing. Sandbox never touches either.
 */
let camAnchorX = 0, camLookX = 0;
function updateCamAnchor() {
  if (mode !== "advance") { camAnchorX = state.pos.x; camLookX = state.pos.x; return; }
  const a = activeArena();
  const contested = a && a.owner === "enemy" && a.entered;
  const want = contested ? (tileX(a.x0) + tileX(a.x0 + a.cols - 1)) / 2 : state.pos.x;
  camAnchorX = Math.max(camAnchorX, want);
  camLookX += (camAnchorX - camLookX) * (1 - Math.exp(-frameDt / 170));
}

const moveReady = (t) => t - state.lastMoveAt >= MOVE_MS;

// ---------- movement ----------

/** Nothing stands there: a square the player may stand on, and no rotter on it. */
const free = (col, row) => walkable(col, row) && !rotterAt(col, row);

/**
 * Take a step by (dc, dr). One axis at a time: a hop is never diagonal. When
 * both axes are asked for, the preferred one goes first, but if it is
 * blocked by the edge (or a rotter) the other still moves: the game's ring
 * presses both axes on a diagonal, and a wall should not cancel the half
 * that was fine.
 */
function move(dc, dr, t, preferRow = false) {
  if (!(dc || dr)) return;
  state.path = null;
  if (!moveReady(t)) { state.queued = { kind: "by", dc, dr, preferRow }; return; }
  if (dc && dr) {
    const first = preferRow ? [0, dr] : [dc, 0];
    const second = preferRow ? [dc, 0] : [0, dr];
    const ok = (d) => free(state.col + Math.sign(d[0]), state.row + Math.sign(d[1]));
    [dc, dr] = ok(first) ? first : second;
  }
  const col = state.col + Math.sign(dc), row = state.row + Math.sign(dr);
  if (!free(col, row)) return;
  go(col, row, t);
}

/** Walk to a square: beside you it is one hop; further away, a path. */
function moveTo(col, row, t) {
  if (!onBoard(col, row)) return;
  if (col === state.col && row === state.row) { state.path = null; return; }
  if (rotterAt(col, row)) { ripple(tileX(col), tileZ(row), PAL.bolt, 1.1, 260); return; }
  ripple(tileX(col), tileZ(row), PAL.ripple, 1.25, 320);
  tileAt(col, row).glow = 1;
  state.path = { col, row };
  runPath(t);
}

/**
 * The next step of the path, when the ration allows. Larger axis first; a
 * blocked axis yields to the other. Sandbox never needed more than that —
 * a blocked square there is only ever a rotter, which moves on — but a
 * tower's NPC tile is a permanent wall, so on a straight run (one axis
 * already at the target) a blocked step also tries sidestepping a row, then
 * a column, to walk around it rather than stalling against it forever.
 */
function runPath(t) {
  const p = state.path;
  if (!p) return;
  if (p.col === state.col && p.row === state.row) { state.path = null; return; }
  if (!moveReady(t)) return;
  const dc = p.col - state.col, dr = p.row - state.row;
  const byCol = [state.col + Math.sign(dc), state.row], byRow = [state.col, state.row + Math.sign(dr)];
  const order = Math.abs(dc) >= Math.abs(dr) ? [byCol, byRow] : [byRow, byCol];
  const detour = [[state.col, state.row + 1], [state.col, state.row - 1], [state.col + 1, state.row], [state.col - 1, state.row]];
  for (const [c, r] of [...order, ...detour]) {
    if ((c !== state.col || r !== state.row) && free(c, r)) { go(c, r, t); return; }
  }
}

/** Spend the ration on a hop to (col, row). */
function go(col, row, t) {
  state.lastMoveAt = t;
  // a hop still in the air when the next begins lands first: no square is skipped
  const prev = state.hop;
  if (prev && !prev.committed) { prev.committed = true; state.col = prev.toCol; state.row = prev.toRow; }
  if (col === state.col && row === state.row) { state.hop = null; return; }
  state.hop = { fromCol: state.col, fromRow: state.row, toCol: col, toRow: row, t0: t, committed: false, left: false, landed: false };
  // Unless the barrel is being held somewhere — by the lock, live aim input,
  // or lane mode holding it down the lane on principle — a hop turns the
  // body to face where it is going, as the 2D buster turns. Held, the legs
  // go and the barrel stays: the strafe. Lane mode is *always* the strafe.
  if (!state.lock && state.aimMode !== "lane" && !aimHeld(t)) setAim(angleTo(0, 0, col - state.col, row - state.row), t);
}

function updateHop(t) {
  const h = state.hop;
  if (!h) { state.phase = "idle"; return; }
  const dt = t - h.t0;
  if (!h.left && dt >= HOP_WINDUP_MS) {
    h.left = true;
    pressTile(h.fromCol, h.fromRow, 0.5);
    dust(tileX(h.fromCol), tileZ(h.fromRow), 3, 0.7);
  }
  if (!h.committed && dt >= HOP_COMMIT_MS) { h.committed = true; state.col = h.toCol; state.row = h.toRow; }
  if (!h.landed && dt >= HOP_WINDUP_MS + HOP_AIR_MS) {
    h.landed = true;
    ripple(tileX(h.toCol), tileZ(h.toRow), 0xffffff, 1.5, 300);
    pressTile(h.toCol, h.toRow, 0.9);
    dust(tileX(h.toCol), tileZ(h.toRow), 6, 1.1);
  }
  if (dt >= HOP_TOTAL_MS) { state.hop = null; state.phase = "idle"; state.lastIdleAt = t; return; }
  state.phase = dt < HOP_WINDUP_MS ? "windup" : dt < HOP_WINDUP_MS + HOP_AIR_MS ? "air" : "settle";
}

function flushQueued(t) {
  const q = state.queued;
  if (!q || !moveReady(t)) return;
  state.queued = null;
  if (q.kind === "to") moveTo(q.col, q.row, t);
  else move(q.dc, q.dr, t, q.preferRow);
}

// ---------- aiming ----------

/** The mode's grid: four ways, eight ways, or none. */
function quantise(a) {
  const q = state.aimMode === "4" ? Math.PI / 2 : state.aimMode === "8" ? Math.PI / 4 : 0;
  return q ? Math.round(a / q) * q : a;
}
/** Point the barrel. Quantised to the mode unless told not to (the lock aims true). */
function setAim(a, t, exact = false) {
  state.aim = exact ? a : quantise(a);
  state.aimAt = t;
  state.cosmetic = false;
}
/** Is anything pointing the barrel right now: an aim stick, arrow keys, or a recent mouse? */
function aimHeld(t) {
  return !!(aimStickVec() || heldAim() || t - state.hoverAt < AIM_HOLD_MS);
}

function setAimMode(m, via) {
  if (!AIM_MODES.includes(m)) return;
  state.aimMode = m;
  // lane snaps straight back down the lane; the others just re-quantise
  // whatever the aim already was.
  state.aim = m === "lane" ? 0 : quantise(state.aim);
  const label = m === "lane" ? "lane" : m === "free" ? "free" : m + "-dir";
  announce("aim", label, via);
}
function cycleAimMode(via) { setAimMode(AIM_MODES[(AIM_MODES.indexOf(state.aimMode) + 1) % AIM_MODES.length], via); }

/** The nearest live rotter, for the lock to hold on. */
function nearestRotter() {
  let best = null, bd = Infinity;
  for (const r of rotters) {
    if (r.phase === "die" || r.phase === "spawn") continue;
    const d = Math.hypot(r.x - state.pos.x, r.z - state.pos.z);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
/** Who/what asked for the last lock change, for the chip's `.via` badge — set by the input handlers, read the moment `updateLock` sees the transition. */
let lockVia = null;
function updateLock(t) {
  const want = state.lockHold || state.lockToggle;
  if (want && !state.lock) { state.lock = true; state.lockTarget = nearestRotter(); state.aimAt = t; state.cosmetic = false; announce("lock", state.lockTarget ? "target" : "held", lockVia); }
  if (!want && state.lock) { state.lock = false; state.lockTarget = null; announce("lock", "off", lockVia); }
  if (state.lock && (!state.lockTarget || state.lockTarget.phase === "die" || !rotters.includes(state.lockTarget))) state.lockTarget = nearestRotter();
  chips.lock.value.textContent = state.lock ? (state.lockTarget ? "target" : "held") : "off";
  chips.lock.btn.classList.toggle("on", state.lock);
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

/**
 * Where the barrel points this frame, by priority: the lock on its target,
 * then live input (an aim stick, the arrow keys, a recent mouse), then — at
 * rest, with nothing asked for a while — back to the enemy half with the
 * cosmetic three-quarter turn.
 */
function updateAim(t) {
  updateLock(t);
  if (state.lock) {
    const r = state.lockTarget;
    if (r) setAim(angleTo(state.pos.x, state.pos.z, r.x, r.z), t, true);
    return;
  }
  if (state.aimMode === "lane") {
    // Pure strafing: the barrel stays down the lane. Hover, the arrow keys
    // and the aim stick are all ignored (checked below, in aimHeld/go) —
    // the only thing that can move the aim off 0 is the lock, above. The
    // rest-time cosmetic turn still applies — and, since nothing else ever
    // flips `cosmetic` back off in this mode (there's no aim change to do
    // it), a hop or a recent shot has to clear it explicitly here.
    state.aim = 0;
    state.cosmetic = !state.hop && t - state.lastIdleAt > REFACE_MS && t - state.aimAt > AIM_HOLD_MS && !state.charge;
    return;
  }
  const sv = aimStickVec();
  const kv = heldAim();
  if (sv) setAim(angleOfScreen(sv[0], sv[1]), t);
  else if (kv) setAim(angleOfScreen(kv[0], kv[1]), t);
  else if (t - state.hoverAt < AIM_HOLD_MS) setAim(state.hoverAim, t);
  else if (!state.hop && t - state.lastIdleAt > REFACE_MS && t - state.aimAt > AIM_HOLD_MS && !state.charge) {
    state.aim = 0;
    state.cosmetic = true;
  }
}

// ---------- the buster ----------

const muzzle = new THREE.Vector3();
const shots = [];
const shotGeo = new THREE.SphereGeometry(0.06, 10, 8);
const chargedGeo = new THREE.SphereGeometry(0.15, 14, 12);
const matShot = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const matCharged = new THREE.MeshBasicMaterial({ color: 0xeafcff });
const shotGlowMat = new THREE.SpriteMaterial({ map: discTex, color: PAL.shot, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
const chargedGlowMat = new THREE.SpriteMaterial({ map: discTex, color: PAL.charged, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });

function fire(t, charged) {
  aimDir(state.aim, _v);
  const m = new THREE.Mesh(charged ? chargedGeo : shotGeo, charged ? matCharged : matShot);
  m.position.copy(muzzle);
  const glow = new THREE.Sprite(charged ? chargedGlowMat : shotGlowMat);
  glow.scale.setScalar(charged ? 0.7 : 0.28);
  m.add(glow);
  scene.add(m);
  const speed = charged ? CHARGED_SPEED : SHOT_SPEED;
  shots.push({ m, vx: _v.x * speed, vz: _v.z * speed, charged, dmg: charged ? ROTTER_HP : 1, x0: muzzle.x, z0: muzzle.z, hit: false });
  if (mode === "advance" && !run.over) run.shotsFired++;
  state.lastFireAt = t;
  state.fireAt = t;
  state.fireCharged = charged;
  state.aimAt = t;
  state.cosmetic = false;
  flash.material.color.set(charged ? PAL.charged : PAL.shot);
  if (charged) {
    shakeCam(0.05);
    dust(muzzle.x, muzzle.z, 5, 1.4, { color: PAL.charged, y: muzzle.y, rise: 0, size: [0.06, 0.2], ms: [140, 220], additive: true });
  }
}
function pressFire(t) {
  // FIRE is also how the start and pause cards let go — a single choke
  // point covers the keyboard, the FIRE button and right-click/touch alike.
  if (cardKind === "over") return;
  if (cardKind === "start") { startRun(); return; }
  if (cardKind === "pause") { resumeGame(); return; }
  if (state.charge) return;
  if (t - state.lastFireAt >= FIRE_COOLDOWN_MS) fire(t, false);
  state.charge = { t0: t };
  hud.fire.classList.add("held");
}
function releaseFire(t) {
  const c = state.charge;
  if (!c) return;
  state.charge = null;
  hud.fire.classList.remove("held", "ready");
  if (t - c.t0 >= CHARGE_MS) fire(t, true);
}

function updateShots(t) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.m.position.x += s.vx * frameDt;
    s.m.position.z += s.vz * frameDt;
    let spent = offBoard(s.m.position.x, s.m.position.z);
    if (!spent) {
      for (const r of rotters) {
        if (r.phase === "die") continue;
        if (Math.hypot(r.x - s.m.position.x, r.z - s.m.position.z) <= ROTTER_RADIUS + (s.charged ? 0.15 : 0.06)) {
          hitRotter(r, s, t);
          spent = true;
          s.hit = true;
          break;
        }
      }
    }
    if (spent) {
      // The charged shot's aftermath: a tracer along the whole path, fading
      // fast, and — only on an actual hit, not a miss run off the board — a
      // bigger ring where it landed.
      if (s.charged) {
        spawnTracer(s.x0, s.z0, s.m.position.x, s.m.position.z);
        if (s.hit) ripple(s.m.position.x, s.m.position.z, PAL.charged, 2.6, 300);
      }
      scene.remove(s.m); shots.splice(i, 1);
    }
  }
  // the flash and the charge glow ride the muzzle
  const fu = clamp01((t - state.fireAt) / 70);
  flash.position.copy(muzzle);
  flash.scale.setScalar(fu < 1 ? lerp(state.fireCharged ? 0.9 : 0.45, 0.05, fu) : 0.001);
  flash.material.opacity = fu < 1 ? 1 - fu : 0;
  chargeGlow.position.copy(muzzle);
  if (state.charge) {
    const cu = clamp01((t - state.charge.t0) / CHARGE_MS);
    const ready = cu >= 1;
    const pulse = ready ? 0.85 + 0.15 * Math.sin(t / 40) : 1;
    chargeGlow.scale.setScalar(lerp(0.05, 0.5, easeOutQuad(cu)) * pulse);
    chargeGlow.material.opacity = 0.25 + 0.7 * cu;
    matMuzzle.emissiveIntensity = 1.4 + 3 * cu;
    hud.fire.classList.toggle("ready", ready);
  } else {
    chargeGlow.scale.setScalar(0.001);
    chargeGlow.material.opacity = 0;
    matMuzzle.emissiveIntensity = 1.4;
  }
}

// ---------- rotters ----------

const rotters = [];
let nextSpawnAt = 600;
const bolts = [];
const boltGeo = new THREE.SphereGeometry(0.09, 10, 8);
const matBolt = new THREE.MeshBasicMaterial({ color: 0xffc0cc });
const boltGlowMat = new THREE.SpriteMaterial({ map: discTex, color: PAL.bolt, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });

/** The rotter on (col, row), counting one mid-hop as already on the square it is going to. */
function rotterAt(col, row) {
  for (const r of rotters) {
    if (r.phase === "die") continue;
    if (r.col === col && r.row === row) return r;
    if (r.hop && r.hop.toCol === col && r.hop.toRow === row) return r;
  }
  return null;
}
/** Anything on (col, row): the buster (or where it is hopping to), or a rotter. */
const occupied = (col, row) => (state.col === col && state.row === row) || (state.hop && state.hop.toCol === col && state.hop.toRow === row) || !!rotterAt(col, row);

function buildRotter() {
  const g = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({ color: PAL.rotter, roughness: 0.45, metalness: 0.55, emissive: 0x000000 });
  const matDark = new THREE.MeshStandardMaterial({ color: PAL.rotterDark, roughness: 0.6, metalness: 0.4, emissive: 0x000000 });
  const matBlade = new THREE.MeshStandardMaterial({ color: PAL.rotterBlade, roughness: 0.35, metalness: 0.6, emissive: PAL.rotterBlade, emissiveIntensity: 0.25 });
  const matEye = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: PAL.rotterEye, emissiveIntensity: 1.2, roughness: 0.2 });
  const body = new THREE.Group();
  g.add(body);
  body.add(mesh(new THREE.CylinderGeometry(0.3, 0.14, 0.2, 8), matBody, 0, 0.12, 0));      // the squat cup
  body.add(mesh(new THREE.SphereGeometry(0.19, 14, 10), matDark, 0, 0.27, 0));            // the dome
  body.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 8), matBlade, 0, 0.5, 0));             // the spike
  const eye = mesh(new THREE.SphereGeometry(0.07, 12, 10), matEye, -0.16, 0.27, 0);       // the eye looks down the lane at the player's half
  eye.castShadow = false;
  body.add(eye);
  const rotor = new THREE.Group();
  rotor.position.y = 0.34;
  body.add(rotor);
  for (let i = 0; i < 3; i++) {
    const blade = box(0.62, 0.035, 0.09, matBlade, 0, 0, 0);
    blade.rotation.y = (i * Math.PI * 2) / 3;
    blade.rotation.x = 0.18;
    rotor.add(blade);
  }
  return { g, body, rotor, matBody, matDark, matEye, matBlade };
}

function freeEnemyTile() {
  const x0 = arenaBaseCol();
  const opts = [];
  for (let row = 0; row < ROWS; row++) for (let col = x0 + PCOLS; col < x0 + COLS; col++) {
    if (!occupied(col, row)) opts.push([col, row]);
  }
  return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
}
/** A free tile of the enemy half beside (col, row), for a rotter's hop. */
function freeNeighbour(col, row) {
  const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => [col + dc, row + dr]).filter(([c, r]) => enemyHalf(c, r) && !occupied(c, r));
  return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
}

function spawnRotter(t) {
  const at = freeEnemyTile();
  if (!at) return;
  const r = buildRotter();
  const { hp, steel } = mode === "advance" ? rollRotterHp() : { hp: ROTTER_HP, steel: false };
  if (steel) { r.matBody.color.set(PAL.rotterSteel); r.matDark.color.set(PAL.rotterSteelDark); }
  Object.assign(r, {
    col: at[0], row: at[1], x: tileX(at[0]), z: tileZ(at[1]),
    hp, steel, phase: "spawn", t0: t, dur: ROTTER_SPAWN_MS, hop: null, knock: null,
    spin: 0.006, flashUntil: -1e9, nextFireAt: t + rand(ROTTER_FIRE_EVERY[0], ROTTER_FIRE_EVERY[1]) + 800, seed: Math.random() * 100,
  });
  r.g.position.set(r.x, 0, r.z);
  scene.add(r.g);
  rotters.push(r);
  ripple(r.x, r.z, PAL.bolt, 1.4, 420);
}

function hitRotter(r, shot, t) {
  r.hp -= shot.dmg;
  r.flashUntil = t + 90;
  if (mode === "advance" && !run.over) run.shotsHit++;
  dust(shot.m.position.x, shot.m.position.z, shot.charged ? 8 : 4, shot.charged ? 2.2 : 1.4, { color: shot.charged ? PAL.charged : PAL.shot, y: shot.m.position.y, rise: 0.3, size: [0.05, 0.16], ms: [160, 260], additive: true });
  if (r.hp <= 0) {
    r.phase = "die"; r.t0 = t; r.dur = ROTTER_DIE_MS;
    r.hop = null;
    state.busted++;
    hud.busted.textContent = String(state.busted);
    dust(r.x, r.z, 14, 2.6, { color: PAL.bolt, y: 0.25, rise: 0.6, size: [0.08, 0.3], ms: [300, 520], additive: true });
    ripple(r.x, r.z, PAL.bolt, 2.2, 420);
    pressTile(r.col, r.row, 0.6);
    shakeCam(shot.charged ? 0.07 : 0.035);
    spawnDebris(r.x, r.z, r.steel ? [PAL.rotterSteel, PAL.rotterSteelDark, PAL.rotterBlade] : [PAL.rotter, PAL.rotterDark, PAL.rotterBlade]);
    if (state.lockTarget === r) state.lockTarget = null;
    nextSpawnAt = Math.max(nextSpawnAt, t + ROTTER_RESPAWN_MS);
    const a = activeArena();
    const clearing = mode === "advance" && a && a.dealt >= a.pool && aliveInArena() === 0;
    triggerHitStop(clearing ? HITSTOP_CLEAR_MS : shot.charged ? HITSTOP_CHARGED_MS : HITSTOP_MS);
    if (mode === "advance" && !run.over) {
      run.deletions++;
      run.chain++;
      run.bestChain = Math.max(run.bestChain, run.chain);
      const mult = chainMultiplier(run.chain);
      run.score += 100 * mult;
      popup(r.x, r.z, mult > 1 ? `+${100 * mult} ×${mult}` : `+${100 * mult}`, { color: "#c9f6ff" });
      if (CHAIN_STEPS.includes(run.chain)) chainFlourish(mult);
      if (run.task && run.task.id === "chain8" && !run.task.done && run.chain >= 8) completeTask();
    } else {
      popup(r.x, r.z, "BUSTED", { color: "#c9f6ff" });
    }
  } else {
    // a shove: the body lurches away from the shot and springs back
    r.knock = { vx: Math.sign(shot.vx) * 0.09, vz: Math.sign(shot.vz) * 0.09, t0: t };
  }
}

function fireBolt(r, t) {
  const m = new THREE.Mesh(boltGeo, matBolt);
  const glow = new THREE.Sprite(boltGlowMat);
  glow.scale.setScalar(0.42);
  m.add(glow);
  const y = 0.3;
  m.position.set(r.x, y, r.z);
  scene.add(m);
  // aimed at where the buster stands *now*: a hop begun after this dodges it
  const dx = state.pos.x - r.x, dz = state.pos.z - r.z;
  const len = Math.hypot(dx, dz) || 1;
  bolts.push({ m, vx: (dx / len) * BOLT_SPEED, vz: (dz / len) * BOLT_SPEED });
  dust(r.x, r.z, 4, 1.2, { color: PAL.bolt, y, rise: 0, size: [0.06, 0.18], ms: [120, 200], additive: true });
}

function updateBolts(t) {
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.m.position.x += b.vx * frameDt;
    b.m.position.z += b.vz * frameDt;
    let spent = offBoard(b.m.position.x, b.m.position.z);
    if (!spent && t >= state.hurtUntil && Math.hypot(b.m.position.x - state.pos.x, b.m.position.z - state.pos.z) <= BOLT_RADIUS) {
      takeHit(t, b.vx, b.vz);
      spent = true;
    }
    if (spent) { scene.remove(b.m); bolts.splice(i, 1); }
  }
}

/** `bvx`/`bvz`: the bolt's own travel direction, for the camera punch — omitted (the synthetic `debugHit()` test hook) it just punches along the lane. */
function takeHit(t, bvx = 1, bvz = 0) {
  state.hurtUntil = t + (mode === "advance" ? ADV_HURT_MS : HURT_MS);
  state.hits++;
  hud.hits.textContent = String(state.hits);
  shakeCam(0.09);
  triggerCamPunch(bvx, bvz);
  flashVignette();
  dust(state.pos.x, state.pos.z, 10, 2, { color: PAL.bolt, y: 0.35, rise: 0.4, size: [0.06, 0.22], ms: [200, 380], additive: true });
  ripple(state.pos.x, state.pos.z, PAL.bolt, 1.8, 360);
  if (mode === "advance" && !run.over) {
    // a hit costs the clock, not health: it breaks the chain and cancels
    // whatever the player was mid-way through, same as the 2D original.
    if (run.chain > 0) chainLostFlourish();
    run.hitThisArena = true;
    run.chain = 0;
    state.charge = null;
    hud.fire.classList.remove("held", "ready");
    state.path = null;
    state.queued = null;
    run.timeLeft = Math.max(0, run.timeLeft - HIT_TIME_PENALTY);
    if (run.timeLeft <= 0) gameOver();
  }
}

function updateRotters(t) {
  if (mode === "sandbox" && rotters.filter((r) => r.phase !== "die").length < ROTTER_COUNT && t >= nextSpawnAt) {
    spawnRotter(t);
    nextSpawnAt = t + ROTTER_RESPAWN_MS * 0.6;
  }
  for (let i = rotters.length - 1; i >= 0; i--) {
    const r = rotters[i];
    const dt = t - r.t0;
    let scale = 1, y = 0, spin = r.spin, eye = 1.2;
    switch (r.phase) {
      case "spawn": {
        const u = clamp01(dt / r.dur);
        scale = lerp(0.2, 1, easeOutBack(u));
        y = lerp(-0.35, 0, easeOutQuad(u));
        if (u >= 1) { r.phase = "sit"; r.t0 = t; r.dur = rand(ROTTER_SIT_MS[0], ROTTER_SIT_MS[1]); }
        break;
      }
      case "sit": {
        y = 0.02 * Math.sin(t / 260 + r.seed);
        const tl = tileAt(r.col, r.row);
        tl.rot = Math.min(1, tl.rot + frameDt * ROT_RATE);
        tl.rotHeld = true;
        if (dt >= r.dur) {
          if (t >= r.nextFireAt && rotterCanFire(r)) { r.phase = "aim"; r.t0 = t; r.dur = ROTTER_AIM_MS; }
          else {
            const to = freeNeighbour(r.col, r.row);
            if (to) { r.phase = "hop"; r.t0 = t; r.dur = ROTTER_HOP_MS; r.hop = { fromCol: r.col, fromRow: r.row, toCol: to[0], toRow: to[1], committed: false }; }
            else { r.t0 = t; r.dur = rand(400, 900); }
          }
        }
        break;
      }
      case "hop": {
        const u = clamp01(dt / r.dur);
        const e = easeInOutSine(u);
        const h = r.hop;
        r.x = lerp(tileX(h.fromCol), tileX(h.toCol), e);
        r.z = lerp(tileZ(h.fromRow), tileZ(h.toRow), e);
        y = 0.32 * 4 * u * (1 - u);
        if (!h.committed && u >= 0.5) { h.committed = true; r.col = h.toCol; r.row = h.toRow; }
        if (u >= 1) {
          r.hop = null; r.phase = "sit"; r.t0 = t; r.dur = rand(ROTTER_SIT_MS[0], ROTTER_SIT_MS[1]);
          pressTile(r.col, r.row, 0.6);
          dust(r.x, r.z, 4, 0.9);
        }
        break;
      }
      case "aim": {
        // the telegraph: the rotor whines up, the eye brightens, the panel flashes
        const u = clamp01(dt / r.dur);
        spin = lerp(r.spin, 0.03, u);
        eye = 1.2 + 3 * u;
        y = 0.03 * Math.sin(t / 30) * u;
        if (u > 0.3) flashTile(r.col, r.row, PAL.bolt);
        if (u >= 1) {
          fireBolt(r, t);
          r.nextFireAt = t + rand(ROTTER_FIRE_EVERY[0], ROTTER_FIRE_EVERY[1]);
          r.phase = "sit"; r.t0 = t; r.dur = rand(600, 1200);
        }
        break;
      }
      case "die": {
        const u = clamp01(dt / r.dur);
        scale = lerp(1, 0.05, easeOutQuad(u));
        spin = 0.06;
        y = -0.3 * u;
        if (u >= 1) { scene.remove(r.g); rotters.splice(i, 1); continue; }
        break;
      }
    }
    // the knock from a shot that did not finish it
    let kx = 0, kz = 0;
    if (r.knock) {
      const ku = clamp01((t - r.knock.t0) / 220);
      const k = Math.sin(Math.PI * ku);
      kx = r.knock.vx * k; kz = r.knock.vz * k;
      if (ku >= 1) r.knock = null;
    }
    r.rotor.rotation.y += spin * frameDt;
    r.g.position.set(r.x + kx, y, r.z + kz);
    r.g.scale.setScalar(scale);
    r.body.rotation.z = kz * 2; r.body.rotation.x = -kx * 2;
    r.matEye.emissiveIntensity = eye;
    const hit = t < r.flashUntil;
    r.matBody.emissive.set(hit ? 0xffffff : 0x000000);
    r.matDark.emissive.set(hit ? 0xffffff : 0x000000);
    r.matBody.emissiveIntensity = r.matDark.emissiveIntensity = hit ? 0.8 : 0;
  }
  // the lock ring follows its rotter
  const lt = state.lock && state.lockTarget;
  lockRing.visible = !!lt;
  if (lt) {
    lockRing.position.x = lt.x; lockRing.position.z = lt.z;
    const s = 1 + 0.08 * Math.sin(t / 120);
    lockRing.scale.set(s, s, s);
  }
}

// ---------- pose ----------
// Every phase is a set of joint angles and offsets; between phases the
// pose is continuous because each phase's curve starts where the last ended.

function pose(t) {
  const r = rig;
  const h = state.hop;

  // defaults: standing
  let hipDrop = 0, lean = 0, knee = 0.08, thigh = 0, armSwing = 0, elbow = -0.25, headPitch = 0, headYaw = 0;
  let sx = 1, sy = 1;
  let legSplit = 0;   // opposite thigh angles in the air, for a running shape
  let sway = 0;       // hips shifting side to side at rest

  const breath = Math.sin(t / 380);   // ~2.4 s cycle

  if (!h) {
    // idle: breath, a slow look around, weight shifting foot to foot
    hipDrop = 0.012 * (1 - breath) * 0.5;
    lean = 0.03 + 0.02 * breath;
    armSwing = 0.05 * Math.sin(t / 620);
    elbow = -0.35 + 0.05 * breath;
    headYaw = 0.25 * Math.sin(t / 1400);
    headPitch = 0.05 * Math.sin(t / 900);
    knee = 0.1 + 0.02 * breath;
    sway = 0.03 * Math.sin(t / 1900);
  } else {
    const dt = t - h.t0;
    if (dt < HOP_WINDUP_MS) {
      // crouch: hips sink, knees fold, torso leans in, arms pull back
      const u = easeOutQuad(clamp01(dt / HOP_WINDUP_MS));
      hipDrop = 0.22 * u; knee = 0.08 + 1.1 * u; thigh = 0.5 * u;
      lean = 0.3 * u; armSwing = -0.7 * u; elbow = -0.3 - 0.5 * u; headPitch = 0.2 * u;
      sy = 1 - 0.04 * u; sx = 1 + 0.03 * u;
    } else if (dt < HOP_WINDUP_MS + HOP_AIR_MS) {
      // the arc: legs tuck then reach, arms come up and forward
      const u = clamp01((dt - HOP_WINDUP_MS) / HOP_AIR_MS);
      const up = Math.sin(Math.PI * u);           // 0 → 1 → 0
      hipDrop = -0.02 * up;
      knee = 1.2 * up + 0.2 * (1 - u); thigh = lerp(0.5, -0.35, u) + 0.4 * up;
      legSplit = 0.55 * up;
      lean = lerp(0.3, -0.05, u); armSwing = lerp(-0.7, 0.9, easeOutQuad(u)); elbow = -0.9 + 0.3 * u;
      headPitch = lerp(0.2, -0.15, u);
      sy = 1 + 0.06 * up; sx = 1 - 0.04 * up;    // a stretch at the top
    } else {
      // landing: a squash that springs back, knees absorb then straighten, arms fall
      const u = clamp01((dt - HOP_WINDUP_MS - HOP_AIR_MS) / HOP_SETTLE_MS);
      const spring = 1 - easeOutBack(u);          // 1 → 0 with a small dip past 0
      hipDrop = 0.18 * spring; knee = 0.08 + 1.0 * spring; thigh = 0.45 * spring;
      lean = 0.22 * spring; armSwing = lerp(0.9, 0, easeOutQuad(u)) - 0.3 * spring; elbow = -0.25 - 0.4 * spring;
      headPitch = 0.15 * spring;
      sy = 1 - 0.12 * spring; sx = 1 + 0.08 * spring;
    }
  }

  // Aiming holds the barrel arm level whatever the legs are doing: in the air
  // the arms would swing, but a shooter's do not. Blend the swing out while
  // the barrel is held (lock, live aim, a charge) or has just fired.
  const holding = state.lock || !!state.charge || t - state.aimAt < AIM_HOLD_MS;
  const armHold = holding ? 0.85 : 0;
  const armRSwing = lerp(armSwing, 0.05, armHold);
  // the charge: the left hand comes across to brace the barrel
  const chargeU = state.charge ? clamp01((t - state.charge.t0) / CHARGE_MS) : 0;
  // the recoil: the barrel arm kicks up and the torso rocks back
  const ru = clamp01((t - state.fireAt) / RECOIL_MS);
  const kick = ru < 1 ? (1 - ru) * (state.fireCharged ? 0.55 : 0.28) : 0;
  // a hit: a flinch — the whole body cringes for the first part of the hurt
  const hu = clamp01((t - (state.hurtUntil - HURT_MS)) / HURT_MS);
  const flinch = hu < 1 ? (1 - hu) * (1 - hu) : 0;

  // Signs: the torso and head point up, so a forward lean (towards +x) is a
  // negative z rotation. Limbs hang down from their pivots, so for them
  // forward is positive. A knee folds the shin back, so it is negative again.
  r.hips.position.y = r.HIP_Y - hipDrop - 0.08 * flinch;
  r.hips.position.z = sway;
  r.hips.rotation.x = sway * 1.5;
  r.squash.scale.set(sx, sy, sx);
  r.torso.rotation.z = -lean + kick * 0.25 + 0.2 * flinch;
  r.torso.rotation.x = -sway * 1.5;
  r.head.rotation.z = -headPitch * 0.6 + 0.25 * flinch;
  r.head.rotation.y = holding ? headYaw * 0.2 : headYaw;

  // The strafe: the legs turn towards where the hop is going, the torso turns
  // back by the same amount so the barrel stays on the aim. At rest the
  // legs come back under the barrel.
  const moveYaw = h ? angleTo(0, 0, h.toCol - h.fromCol, h.toRow - h.fromRow) : null;
  const wantTwist = moveYaw === null ? 0 : clamp(angleDelta(state.facing, moveYaw), -TWIST_MAX, TWIST_MAX);
  state.twist += (wantTwist - state.twist) * Math.min(1, frameDt / 60);
  r.hips.rotation.y = state.twist;
  r.torso.rotation.y = -state.twist;

  // legs: thigh forward is positive; the knee folds the shin back
  r.legL.rotation.z = thigh + legSplit;
  r.legR.rotation.z = thigh - legSplit;
  r.shinL.rotation.z = -knee;
  r.shinR.rotation.z = -knee;

  // arms: swing forward is positive; the elbow bends the forearm forward. The
  // barrel arm is carried raised so the gun points along +x, at the enemy half.
  r.armL.rotation.z = lerp(armSwing, 0.9, chargeU * 0.8) - 0.4 * flinch;
  r.armL.rotation.y = lerp(0, 0.7, chargeU);
  r.armR.rotation.z = armRSwing + 0.25 + kick * 0.6;
  r.foreL.rotation.z = -lerp(elbow, -1.1, chargeU);
  r.foreR.rotation.z = -lerp(elbow, -0.25, armHold) + 1.0 - kick * 0.4;

  // a hit lights the armour red for the flinch
  matArmor.emissive.set(PAL.bolt);
  matArmor.emissiveIntensity = 0.9 * flinch;
  matArmorDark.emissive.set(PAL.bolt);
  matArmorDark.emissiveIntensity = 0.6 * flinch;
}

// ---------- placement ----------

function place(t) {
  const h = state.hop;
  let x, z, y = 0;
  if (h) {
    const dt = t - h.t0;
    const u = clamp01((dt - HOP_WINDUP_MS) / HOP_AIR_MS);
    const e = easeInOutSine(u);
    x = lerp(tileX(h.fromCol), tileX(h.toCol), e);
    z = lerp(tileZ(h.fromRow), tileZ(h.toRow), e);
    y = HOP_HEIGHT * 4 * u * (1 - u);
  } else {
    x = tileX(state.col); z = tileZ(state.row);
  }
  state.pos.set(x, y, z);
  // standing on a tile that is still springing back, ride it
  const dip = h ? 0 : tileAt(state.col, state.row).dip;
  rig.root.position.set(x, y + dip, z);

  // the contact shadow tracks the ground point, thinning with height
  contact.position.x = x; contact.position.z = z;
  const hf = clamp01(y / HOP_HEIGHT);
  contact.scale.setScalar(1 - 0.35 * hf);
  contact.material.opacity = 0.6 * (1 - 0.6 * hf);

  // facing: the body chases the aim — a quick turn, but never a snap. The
  // cosmetic three-quarter turn only at rest, unaimed.
  const facingTarget = state.aim + (state.cosmetic ? REST_YAW : 0);
  const d = angleDelta(state.facing, facingTarget);
  state.facing += d * Math.min(1, frameDt / TURN_MS);
  rig.root.rotation.y = state.facing;
}

/** The muzzle in world space, for shots and the sight. Read after the pose is set. */
function updateMuzzle(t) {
  rig.root.updateMatrixWorld(true);
  rig.muzzle.getWorldPosition(muzzle);
  const sp = sightGeo.attributes.position.array;
  aimDir(state.aim, _v);
  const reach = state.lock && state.lockTarget ? Math.hypot(state.lockTarget.x - muzzle.x, state.lockTarget.z - muzzle.z) : 3.2;
  sp[0] = muzzle.x; sp[1] = muzzle.y; sp[2] = muzzle.z;
  sp[3] = muzzle.x + _v.x * reach; sp[4] = muzzle.y; sp[5] = muzzle.z + _v.z * reach;
  sightGeo.attributes.position.needsUpdate = true;
  sightMat.color.set(state.lock ? PAL.bolt : PAL.visor);
  sightMat.opacity = state.lock ? 0.75 : state.aimMode === "free" || t - state.aimAt < AIM_HOLD_MS ? 0.42 : 0.16;
}

// ---------- camera ----------

const _want = new THREE.Vector3(), _wantT = new THREE.Vector3();

// The damage punch: on a hit the camera kicks away from the bolt's own
// travel direction and eases back over PUNCH_MS. A vector plus a start
// time, same shape as `cam.shake`, so one hit landing mid-recovery from
// another just restarts the ease rather than fighting it.
let camPunch = { x: 0, z: 0, t0: -1e9 };
function triggerCamPunch(bvx, bvz) {
  if (REDUCED_MOTION) return;
  const len = Math.hypot(bvx, bvz) || 1;
  camPunch = { x: -(bvx / len) * PUNCH_DIST, z: -(bvz / len) * PUNCH_DIST, t0: now() };
}
/** The `#vignette` overlay: a red wash that flashes in and fades over VIGNETTE_MS. */
function flashVignette() {
  if (REDUCED_MOTION) return;
  hud.vignette.classList.remove("flash");
  void hud.vignette.offsetWidth;
  hud.vignette.classList.add("flash");
}

function setCamMode(m, via) {
  if (!CAM_MODES.includes(m)) return;
  cam.mode = m;
  hud.orbit.hidden = m !== "orbit";
  announce("cam", m, via);
}
function cycleCamMode(via) { setCamMode(CAM_MODES[(CAM_MODES.indexOf(cam.mode) + 1) % CAM_MODES.length], via); }

function updateCamera() {
  updateCamAnchor();
  const p = state.pos;
  // fixed and follow track the anchor's x in advance mode (the arena's
  // centre while it's fought over, the player's x otherwise); orbit is
  // explicitly the player's own x, not the eased anchor.
  const cx = mode === "advance" ? camLookX : p.x;
  let rate = 400;
  switch (cam.mode) {
    case "fixed": {
      // the framing the prototype was built with; the camera leans a little
      // towards the buster. In advance mode the whole framing rides the
      // anchor down the road, and the lean is the buster's offset from it.
      const base = mode === "advance" ? cx : 0;
      const lean = (p.x - base) * 0.18;
      _wantT.set(base + lean, LOOK_AT.y, LOOK_AT.z);
      _want.set(CAM_POS.x + base + lean * 0.6, CAM_POS.y, CAM_POS.z);
      break;
    }
    case "follow": {
      // the same angle, closer, keeping the buster near the centre
      _wantT.set(cx, 0.2, p.z * 0.6);
      _want.set(cx, 2.9, p.z * 0.6 + 4.1);
      rate = 260;
      break;
    }
    case "orbit": {
      _wantT.set(mode === "advance" ? p.x : 0, 0.1, 0);
      const cp = Math.cos(cam.pitch);
      _want.set(Math.sin(cam.yaw) * cp * cam.dist, Math.sin(cam.pitch) * cam.dist, Math.cos(cam.yaw) * cp * cam.dist).add(_wantT);
      rate = 120;
      break;
    }
    case "shoulder": {
      // behind the buster, looking where the barrel looks; the aim swings it
      aimDir(state.aim, _v);
      _wantT.set(p.x + _v.x * 3.2, 0.15, p.z + _v.z * 3.2);
      _want.set(p.x - _v.x * 3.0, 2.2, p.z - _v.z * 3.0);
      rate = 260;
      break;
    }
    case "top": {
      // straight down, following loosely; the small z offset keeps the up vector honest
      _wantT.set(p.x * 0.5, 0, p.z * 0.5);
      _want.set(p.x * 0.5, 8.4, p.z * 0.5 + 0.9);
      rate = 300;
      break;
    }
  }
  const k = Math.min(1, frameDt / rate);
  camPos.lerp(_want, k);
  camTarget.lerp(_wantT, k);
  camera.position.copy(camPos);
  if (cam.shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * cam.shake;
    camera.position.y += (Math.random() - 0.5) * cam.shake;
    cam.shake *= Math.pow(0.001, frameDt / 320);
  } else cam.shake = 0;
  const pu = clamp01((now() - camPunch.t0) / PUNCH_MS);
  if (pu < 1) {
    const decay = 1 - easeOutQuad(pu);
    camera.position.x += camPunch.x * decay;
    camera.position.z += camPunch.z * decay;
  }
  camera.lookAt(camTarget);
  fitFov();
}

/**
 * Widen the view until all six columns fit: the horizontal half-angle the
 * board needs at the camera's distance, turned into the vertical fov the
 * aspect implies. Landscape never needs more than the 30 it was framed at.
 * The shoulder camera is not framing the board, so it keeps a lens of its own.
 */
function fitFov() {
  let fov;
  if (cam.mode === "shoulder") fov = 52;
  else {
    const dist = camPos.distanceTo(camTarget);
    const halfW = (COLS * TILE) / 2 + 0.5;
    const vfov = 2 * Math.atan(halfW / dist / camera.aspect) * (180 / Math.PI);
    fov = Math.max(30, Math.min(95, vfov));
  }
  if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

/**
 * Screen to board. Input is read relative to the camera: screen-up is the
 * way the camera looks (flattened to the floor), screen-right is its right.
 * For the fixed framing that is exactly the board's own axes; under the
 * orbit and shoulder cameras it is what the thumb expects.
 */
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3();
function boardVec(sx, sy, out) {
  _fwd.subVectors(camTarget, camPos); _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1); else _fwd.normalize();
  _right.set(-_fwd.z, 0, _fwd.x);
  return out.set(_right.x * sx - _fwd.x * sy, 0, _right.z * sx - _fwd.z * sy);
}
/** A screen vector as an aim angle. */
function angleOfScreen(sx, sy) { boardVec(sx, sy, _w); return angleTo(0, 0, _w.x, _w.z); }
/** A screen vector as a step: the dominant board axis, or both when both are asked for. */
function stepOfScreen(sx, sy, both) {
  boardVec(sx, sy, _w);
  const ax = Math.abs(_w.x), az = Math.abs(_w.z);
  if (both) return [ax > 0.3 ? Math.sign(_w.x) : 0, az > 0.3 ? Math.sign(_w.z) : 0];
  return ax >= az ? [Math.sign(_w.x), 0] : [0, Math.sign(_w.z)];
}

// ---------- input ----------

const MOVE_KEYS = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
const AIM_KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
const FIRE_KEYS = new Set(["Space", "KeyJ", "Enter"]);
const held = new Set();       // move codes, in press order
const heldAimKeys = new Set();

function isTyping(e) { return e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName); }

window.addEventListener("keydown", (e) => {
  if (isTyping(e)) return;
  // the game-over card freezes input to just RETRY — R is the orbit tilt
  // everywhere else, but here it means what Enter means.
  if (cardKind === "over") {
    if (e.code === "Enter" || e.code === "KeyR") { e.preventDefault(); retry(); }
    return;
  }
  // the start and pause cards: FIRE lets go of either; P/Escape also
  // resumes a pause. Everything else — movement, aim, the cameras — is
  // inert while a card has the floor.
  if (cardKind) {
    if (FIRE_KEYS.has(e.code)) { e.preventDefault(); pressFire(now()); }
    else if ((e.code === "KeyP" || e.code === "Escape") && cardKind === "pause") { e.preventDefault(); resumeGame(); }
    return;
  }
  const t = now();
  if (MOVE_KEYS[e.code]) {
    e.preventDefault();
    if (!held.has(e.code)) {
      held.add(e.code);
      // a fresh press steps now (or queues inside the ration); a repeat is handled by the hold
      const hd = heldDir();
      if (hd) move(hd[0], hd[1], t, hd[2]);
    }
    return;
  }
  if (AIM_KEYS[e.code]) { e.preventDefault(); heldAimKeys.add(e.code); return; }
  if (FIRE_KEYS.has(e.code)) { e.preventDefault(); if (!e.repeat) pressFire(t); return; }
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") { state.lockHold = true; lockVia = "shift"; return; }
  if (e.repeat) return;
  switch (e.code) {
    case "KeyL": state.lockToggle = !state.lockToggle; lockVia = "key L"; break;
    case "Digit1": setAimMode("lane", "key 1"); break;
    case "Digit2": setAimMode("4", "key 2"); break;
    case "Digit3": setAimMode("8", "key 3"); break;
    case "Digit4": setAimMode("free", "key 4"); break;
    case "Tab": e.preventDefault(); cycleAimMode("key Tab"); break;
    case "KeyC": cycleCamMode("key C"); break;
    case "KeyQ": orbitBy(-0.35, 0, "key Q"); break;
    case "KeyE": orbitBy(0.35, 0, "key E"); break;
    case "KeyR": orbitBy(0, 0.15, "key R"); break;
    case "KeyF": orbitBy(0, -0.15, "key F"); break;
    case "KeyM": toggleMode("key M"); break;
    case "KeyT": pressTalk(); break;
    case "KeyP": pauseGame(); break;
    case "Escape": pauseGame(); break;
  }
});
window.addEventListener("keyup", (e) => {
  held.delete(e.code);
  heldAimKeys.delete(e.code);
  if (FIRE_KEYS.has(e.code)) releaseFire(now());
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") { state.lockHold = false; lockVia = "shift"; }
});
window.addEventListener("blur", () => { held.clear(); heldAimKeys.clear(); state.lockHold = false; releaseFire(now()); });

/** Turn or tilt the orbit camera; any of these switches to it. */
function orbitBy(dyaw, dpitch, via) {
  if (cam.mode !== "orbit") setCamMode("orbit", via);
  cam.yaw += dyaw;
  cam.pitch = clamp(cam.pitch + dpitch, 0.15, 1.45);
}

/**
 * Everything held on the movement keys, summed on the screen and turned
 * into one ask per board axis, plus whether the most recent press was on
 * the screen's vertical so that axis goes first.
 */
function heldDir() {
  if (!held.size) return null;
  let sx = 0, sy = 0, lastRow = false;
  for (const code of held) { const d = MOVE_KEYS[code]; sx += d[0]; sy += d[1]; lastRow = d[1] !== 0; }
  if (!sx && !sy) return null;
  const [dc, dr] = stepOfScreen(sx, sy, true);
  return dc || dr ? [dc, dr, lastRow] : null;
}
/** The arrow keys, summed, as a screen vector; null when none is held. */
function heldAim() {
  if (!heldAimKeys.size) return null;
  let sx = 0, sy = 0;
  for (const code of heldAimKeys) { const d = AIM_KEYS[code]; sx += d[0]; sy += d[1]; }
  return sx || sy ? [sx, sy] : null;
}

// Pointers. The first finger on the board is the left stick: a tap on a
// square is "go there", a drag past the dead zone is held in one of four
// directions until it comes back or lifts. A second finger, wherever it
// lands, is the right stick and aims. A mouse aims by hovering, and its
// right button is FIRE. The wheel zooms the orbit.
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointers = new Map();   // id -> { role: "move" | "aim" | "fire", x0, y0, vec }
const canvas = renderer.domElement;

function boardPoint(clientX, clientY, out) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(boardPlane, out);
}
function squareAt(clientX, clientY) {
  // intersect the board plane, then snap: taps just off a tile's edge still count
  if (!boardPoint(clientX, clientY, _v)) return null;
  const col = Math.round(_v.x / TILE + (COLS - 1) / 2);
  const row = Math.round(_v.z / TILE + (ROWS - 1) / 2);
  return onBoard(col, row) ? { col, row } : null;
}
const roleHeld = (role) => { for (const p of pointers.values()) if (p.role === role) return p; return null; };
function aimStickVec() { const p = roleHeld("aim"); return p ? p.vec : null; }

canvas.style.touchAction = "none";
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  const t = now();
  if (e.pointerType === "mouse" && e.button === 2) {
    pointers.set(e.pointerId, { role: "fire" });
    pressFire(t);
    return;
  }
  if (cardKind) return;   // a card has the floor: no move/aim stick underneath it
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const role = roleHeld("move") ? (roleHeld("aim") ? null : "aim") : "move";
  if (!role) return;
  pointers.set(e.pointerId, { role, x0: e.clientX, y0: e.clientY, vec: null });
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) {
    // a bare mouse aims by where it hovers over the board
    if (e.pointerType === "mouse" && boardPoint(e.clientX, e.clientY, _v)) {
      state.hoverAim = angleTo(state.pos.x, state.pos.z, _v.x, _v.z);
      state.hoverAt = now();
    }
    return;
  }
  if (p.role === "fire") return;
  const dx = e.clientX - p.x0, dy = e.clientY - p.y0;
  p.vec = Math.hypot(dx, dy) < STICK_DEAD_PX ? null : [dx, dy];
});
function pointerEnd(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  const t = now();
  if (p.role === "fire") { releaseFire(t); return; }
  if (p.role !== "move") return;
  const wasTap = !p.vec && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < STICK_DEAD_PX;
  if (wasTap && e.type === "pointerup") {
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (!moveReady(t)) state.queued = { kind: "to", col: sq.col, row: sq.row };
    else moveTo(sq.col, sq.row, t);
  }
}
canvas.addEventListener("pointerup", pointerEnd);
canvas.addEventListener("pointercancel", pointerEnd);
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (cam.mode !== "orbit") setCamMode("orbit", "wheel");
  cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0012), 3.4, 11);
}, { passive: false });

/** A held direction (keys or the left stick) re-asks every frame; the ration paces it. */
function pollHold(t) {
  const mp = roleHeld("move");
  const d = (mp && mp.vec && stepOfScreen(mp.vec[0], mp.vec[1], false)) || heldDir();
  if (!d) return;
  if (!moveReady(t)) return;
  move(d[0], d[1], t, !!d[2]);
}

// The on-screen pad: FIRE holds like the key; the rest are taps. Every chip
// (and the orbit nudges) is inert while a card is up — RETRY is the one
// exception, since it's the only button the game-over card shows at all.
const bind = (id, fn) => $(id).addEventListener("click", (e) => { if (cardKind && !CARD_BUTTONS.has(id)) return; fn(e); });
// The cards cover the pad, so each carries its own way out: a phone has no
// Space bar, and a card with no button on it is a run that cannot start.
const CARD_BUTTONS = new Set(["btn-retry", "btn-start", "btn-resume"]);
bind("btn-start", startRun);
bind("btn-resume", resumeGame);
bind("btn-aim", () => cycleAimMode("tap"));
bind("btn-cam", () => cycleCamMode("tap"));
bind("btn-lock", () => { state.lockToggle = !state.lockToggle; lockVia = "tap"; });
bind("btn-orbit-l", () => orbitBy(-0.35, 0, "tap"));
bind("btn-orbit-r", () => orbitBy(0.35, 0, "tap"));
bind("btn-mode", () => toggleMode("tap"));
bind("btn-talk", pressTalk);
bind("btn-retry", retry);
hud.fire.addEventListener("pointerdown", (e) => { e.preventDefault(); hud.fire.setPointerCapture(e.pointerId); pressFire(now()); });
hud.fire.addEventListener("pointerup", () => releaseFire(now()));
hud.fire.addEventListener("pointercancel", () => releaseFire(now()));
hud.fire.addEventListener("contextmenu", (e) => e.preventDefault());
// a focused button must not eat Space or Enter as a click — those are FIRE
for (const el of document.querySelectorAll(".pad button")) el.addEventListener("keydown", (e) => { if (e.code === "Space" || e.code === "Enter") e.preventDefault(); });

// ---------- loop ----------

let last = now();
let frameDt = 16;

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fitFov();
}
window.addEventListener("resize", resize);
setAimMode(state.aimMode, params.has("aim") ? "url" : null);
setCamMode(cam.mode, params.has("cam") ? "url" : null);
applyMode();
announce("mode", mode, params.has("mode") ? "url" : null);
resize();

function frame() {
  const t = now();
  frameDt = Math.min(50, t - last);
  last = t;

  // Pause freezes literally everything — no update call runs, so nothing
  // (a tile's spring, a popup's fade, the camera's shake) so much as
  // ticks — the render loop still repaints the same frame.
  if (paused) { renderer.render(scene, camera); return; }

  // Game over, and the start card waiting on its first FIRE, freeze the sim
  // itself — movement, rotters, shots, the arena's clock and waves — but
  // not the effects still playing out (a tile's spring, a ripple's fade,
  // the camera's ease and shake, the keeper's sway).
  const frozen = mode === "advance" && (run.over || !run.started);
  if (!frozen) {
    flushQueued(t);
    runPath(t);
    pollHold(t);
    updateHop(t);
    updateRotters(t);
    updateAim(t);
    updateShots(t);
    updateBolts(t);
    if (mode === "advance") {
      updateArenaFlow(t);
      updateClock();
      checkRoost();
      updateAdvanceHud();
    }
  }
  updateTiles();
  place(t);
  pose(t);
  updateMuzzle(t);
  updateRipples(t);
  updatePuffs(t);
  updatePopups(t);
  updateDebris(t);
  updateTracers(t);
  updateMotes(t);
  if (mode === "advance") updateKeepers(t);
  updateCamera();


  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// A small hook for tests and for poking at it from the console. `mode` and
// `run` are getters — both are rebound (not mutated) on every mode switch
// and RETRY, so a snapshot taken once would go stale.
window.__bw3d = {
  state, cam, rotters, shots, bolts, rig, camera, renderer, world,
  get mode() { return mode; },
  get run() { return run; },
  move: (dc, dr) => move(dc, dr, now()), moveTo: (c, r) => moveTo(c, r, now()),
  fire: (charged = false) => fire(now(), charged), pressFire: () => pressFire(now()), releaseFire: () => releaseFire(now()),
  setAim: (a) => setAim(a, now()), setAimMode, setCamMode, orbitBy,
  lock: (on) => { state.lockToggle = on; },
  setMode, retry, pressTalk,
  forceGameOver: () => { run.timeLeft = 0; gameOver(); },
  debugHit: () => takeHit(now()),   // synthetic hit, for testing the 2.5 s / chain-break path without waiting on a bolt
  get paused() { return paused; },
  get cardKind() { return cardKind; },
  pauseGame, resumeGame, startRun,
  now, reducedMotion: () => REDUCED_MOTION,
};
