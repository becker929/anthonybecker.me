/*!
 * Buster Whack 3D — the game, on the engine in ../../engine/.
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
 * WHAT IS IN THIS FILE, AND WHAT IS NOT. Everything here is Buster Whack:
 * the board's shape and ownership rules, rotters and their bolts, the
 * arena/road/tower world, the keepers and their tasks, bombs, the scoring
 * and clock economy, the aim modes and the lock, the cards and the HUD copy.
 * Everything that would be just as true of a different game — the sim clock
 * and its hit-stop, the stage, the tile grid, the rigged humanoid and its
 * pose curves, the effects, the camera rig, two-stick input, the chips, the
 * hop model, the loop and its `simulate()` — was lifted out into
 * `../../engine/` and is shared with demo 6. That split is the whole reason
 * this file is half the size it was; the engine's own README says where the
 * seam is and why it fell there.
 */

import * as THREE from "../../engine/three.js";
import {
  Clock, watchReducedMotion, Stage, TileGrid, Effects, CameraRig, Input, Chips, Hopper, Loop,
  buildCharacter, characterMaterials, applyPose, idlePose, hopPose, hopHeightAt, hopEaseAt, easeTwist,
  mesh, box, ball, releasePadKeys,
  clamp01, lerp, rand, easeOutQuad, easeInOutSine, easeOutBack, angleDelta, angleTo, aimDir,
} from "../../engine/index.js";

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
const RETALIATE_ARENA = 30;   // no enemy fires a bolt anywhere before this arena
const ADV_CHARGE_MS = 700;    // advance mode's charge hold (sandbox keeps CHARGE_MS, 520)
const PIP_SEC = 1.25;         // seconds per HUD clock pip

// ---------- the roster (arenas 0-19: mett and, from arena 10, guard) ----------
// Two enemy types cover the whole 0-19 span of the 2D original's story
// unlock table: the persistent one-hit "mett" that shuffles its own arena's
// ground, and the immovable "guard" that anchors a formation from arena 10.
// Retaliation (anything firing back) is a real, later unlock — the gate
// below is arena 30, so the code path exists without ever firing here.
const MET_HOP_MS = 1500;        // a mett shuffles to a free tile of its arena this often
const GUARD_FROM_ARENA = 10;    // the formation's anchor slot may become a guard from here
const GUARD_CHANCE_BASE = 0.40;
const GUARD_CHANCE_PER = 0.08;  // per unlock "stage" (8 arenas) past the first
const GUARD_CHANCE_MAX = 0.80;
/** The anchor's chance of being a guard once unlocked: 0.40 at idx 10-15, 0.48 at 16-19, ... */
function guardChance(idx) {
  const stage = Math.min(8, Math.floor(idx / 8));
  return Math.min(GUARD_CHANCE_MAX, GUARD_CHANCE_BASE + Math.max(0, stage - 1) * GUARD_CHANCE_PER);
}
/** Rotters don't enter the "aim"/bolt phase before arena 30 — sandbox's are always live. */
function rotterCanFire() { return mode === "sandbox" || (activeArena()?.idx ?? 0) >= RETALIATE_ARENA; }

// The six formations a wave is drawn from, authored against one arena's own
// columns (3-5, its enemy half) and rotated 0-2 rows at spawn so the same
// shape reads differently each time. `anchor` is the slot that may become a
// guard once GUARD_FROM_ARENA is reached.
const FORMATIONS = [
  { name: "spine",   anchor: 0, slots: [[4, 1], [4, 0], [4, 2], [3, 1], [5, 1]] },
  { name: "rank",    anchor: 2, slots: [[5, 1], [4, 1], [3, 1], [5, 0], [5, 2]] },
  { name: "stagger", anchor: 4, slots: [[3, 0], [4, 1], [5, 2], [5, 0], [3, 2]] },
  { name: "pincer",  anchor: 2, slots: [[3, 0], [3, 2], [4, 1], [5, 0], [5, 2]] },
  { name: "wall",    anchor: 1, slots: [[5, 0], [5, 1], [5, 2], [4, 0], [4, 2]] },
  { name: "wedge",   anchor: 0, slots: [[5, 1], [4, 0], [4, 2], [3, 1], [3, 0]] },
];

// ---------- scoring & the clock economy ----------
// Points are never scaled; every time reward that comes from combat is —
// story is "advancing", so the road pays out at ROAD_PULSE of what a static
// fight would. Task rewards are the one exception (see TASKS_LIST, below).
const PTS_NORMAL = 100, PTS_CHARGED = 300, PTS_GUARD = 400;
const BONUS_NORMAL_S = 1.2, BONUS_CHARGED_S = 2.5, BONUS_GUARD_S = 3.0;
const ROAD_PULSE = 0.4;
const ARENA_CLEAR_BONUS_S = 3.0;
const WAVE_CLEAR_PTS_PER = 60;
const WAVE_CLEAR_BONUS_BASE_S = 0.55, WAVE_CLEAR_BONUS_PER_S = 0.3;
/** Gap between one wave's arrivals and the next's, in ms; `waveIdx` is a whole-run counter. */
const waveStaggerMs = (waveIdx) => Math.max(170, 420 - 4 * waveIdx);
/** Game-over rank from accuracy (deletions / shots fired) and the run's best chain. */
function rankLetter(acc, bestChain) {
  if (acc >= 0.75 && bestChain >= 20) return "S";
  if (acc >= 0.6 && bestChain >= 10) return "A";
  if (acc >= 0.45) return "B";
  if (acc >= 0.3) return "C";
  return "D";
}

// ---------- bombs ----------
const BOMB_ROAD_CHANCE = 1 / 3;   // every road after the first (which is guaranteed)
const BOMB_HITSTOP_MS = 46;

// ---------- tasks ----------
// Handed out one at a time, in this order, on the task exchange (see
// `taskExchange()`); `spare` and `shutter` stay on the list but need
// mechanics (runners, sentinels) this prototype's arenas 0-19 never reach,
// so they are honestly untakeable here — not a bug, the 2D original's own
// unlock table puts them at arena 40 and 50.
const TASKS_LIST = [
  { id: "sweep",   desc: "Take an arena without being hit.", target: 1, reward: { time: 3 } },
  { id: "spare",   desc: "Let three runners past.", target: 3, reward: { time: 4 } },
  { id: "steel",   desc: "Break four steel guards.", target: 4, reward: { pts: 2000 } },
  { id: "chain",   desc: "Delete eight in a row without missing.", target: 1, reward: { time: 4 } },
  { id: "clean",   desc: "Clear three waves with nothing left standing.", target: 3, reward: { bomb: 1 } },
  { id: "charge",  desc: "Take six with a charged shot.", target: 6, reward: { time: 5 } },
  { id: "shutter", desc: "Break two sentinels while they are open.", target: 2, reward: { time: 0 } },
  { id: "far",     desc: "Take five arenas.", target: 5, reward: { time: 6 } },
];
const TASK_PROGRESS = {
  sweep: (r) => r.cleanArenaCount,
  spare: (r) => r.runnersPassed,
  steel: (r) => r.guardKillCount,
  chain: (r) => (r.bestChain >= 8 ? 1 : 0),
  clean: (r) => r.perfectWaveCount,
  charge: (r) => r.chargedKillCount,
  shutter: () => 0,
  far: (r) => r.arenasClearedCount,
};

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
const HITSTOP_MS = 70;          // sandbox: a normal deletion
const HITSTOP_CHARGED_MS = 110; // sandbox: a charged kill
const MAX_HITSTOP = 150;        // never freeze longer than this at once, either mode
// Advance mode's own hit-stop table (the 2D original's numbers): a guard
// answers the same whether it's plinked or finally deleted, since a charged
// delete's "guard" scoring key outranks its own "charged" tier there too.
const HITSTOP_ADV = { normal: 26, charged: 52, guard: 46, hurt: 70, chain: 26 };
const killHitstopMs = (kind, charged) => (kind === "guard" ? HITSTOP_ADV.guard : charged ? HITSTOP_ADV.charged : HITSTOP_ADV.normal);
const POPUP_MS = 650;
const POPUP_RISE = 0.5;
const CHAIN_STEPS = [5, 10, 20];
const PUNCH_MS = 250;
const PUNCH_DIST = 0.12;
const VIGNETTE_MS = 300;
const DEBRIS_MS = 600;
const DEBRIS_GRAVITY = 4.2;     // tiles / s^2
const TRACER_MS = 200;          // sandbox's charged-shot tracer
const ADV_FLASH_MS = { normal: 95, charged: 140 };  // advance's own muzzle-flash fade
const ADV_TRACER_MS = 130;      // the hitscan ray's tracer fade
const ADV_IMPACT_MS = 140;      // the spark exactly where the ray lands
const ARENA_STAGGER_MS = 60;    // between one column's retint/ripple and the next, on a clear
const LEVEL_POP_MS = 680;       // the HUD level number's pop, stepping into a new arena
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
  guardBody: 0x4a5a78, guardDark: 0x28324a, guardEye: 0x9fd8ff,
  keeperCloak: 0x141220, keeperVisor: 0xc9f6ff, keeperStaff: 0x3a3f4a, keeperOrb: 0xffd23f,
  tallyCloak: 0x1a2436, tallyVisor: 0xffd23f,
  bombBody: 0x11141c, bombFuse: 0x5a4630, bombSpark: 0xffb84a,
};

// ---------- the engine, wired for this game ----------
// Everything below this line is Buster Whack's own; everything above the
// import is the engine's. The adapters here exist so the game's own code
// reads the way it always did — `now()`, `ripple()`, `tileX()` — while the
// implementation of each lives one directory up and is shared with demo 6.

/** `?slow=4` runs the clock at a quarter speed: the same hop, stretched, for looking at the poses. */
const params = new URLSearchParams(location.search);
const SLOW = Math.max(1, Number(params.get("slow")) || 1);

let REDUCED_MOTION = watchReducedMotion((on) => { REDUCED_MOTION = on; clock.reducedMotion = on; });
const clock = new Clock({ slow: SLOW, maxHitStop: MAX_HITSTOP, reducedMotion: REDUCED_MOTION });
const now = () => clock.now();
const triggerHitStop = (ms) => clock.hitStop(ms);
const setPaused = (p) => clock.setPaused(p);

const container = document.getElementById("stage");
const $ = (id) => document.getElementById(id);

const stage = new Stage(container, {
  fog: { color: PAL.fog, near: 9, far: 22 },
  ground: { color: 0x0a0d14, size: 80, y: -0.2 },
  motes: { count: 220, color: 0x8fb0ff },
});
const { scene, renderer, camera } = stage;
const discTex = stage.discTex, shadowTex = stage.shadowTex;
/** This frame's length in ms, as every phase, spring and drift in the game reads it. Written once per frame by `updateFrame`. */
let frameDt = 16;

const fx = new Effects(scene, clock, discTex);
const ripple = (x, z, color, scaleTo, ms) => fx.ripple(x, z, color, scaleTo, ms);
const dust = (x, z, count, speed, opts) => fx.dust(x, z, count, speed, opts);
const popup = (x, z, text, opts) => fx.popup(x, z, text, { ms: POPUP_MS, rise: POPUP_RISE, ...opts });
const spawnDebris = (x, z, palette) => fx.debrisBurst(x, z, palette, { ms: DEBRIS_MS, gravity: DEBRIS_GRAVITY });
const spawnTracer = (x0, z0, x1, z1, color = PAL.charged, ms = TRACER_MS) => fx.tracer(x0, z0, x1, z1, color, ms);

// The board. `stain` is the rot: a rotter sitting on a panel turns its rim
// from the enemy half's red to a sick green, held while it sits and healing
// once it leaves — the engine runs the channel, the game says what holds it.
const grid = new TileGrid(scene, {
  cols: COLS, rows: ROWS, tile: TILE, gap: GAP,
  kinds: {
    player: [PAL.tilePlayer, PAL.tilePlayerRim],
    enemy: [PAL.tileEnemy, PAL.tileEnemyRim],
    road: [PAL.tileRoad, PAL.tileRoadRim],
    tower: [PAL.tilePlayer, PAL.tilePlayerRim],
  },
  stain: { slab: PAL.tileRot, rim: PAL.tileRotRim, rate: ROT_RATE, decay: ROT_DECAY },
});
const tileX = (col) => grid.x(col);
const tileZ = (row) => grid.z(row);
const tileAt = (col, row) => grid.at(col, row);
const buildTile = (col, row, kind) => grid.build(col, row, kind);
const retintTile = (tl, kind) => grid.retint(tl, kind);
const disposeTile = (col, row) => grid.dispose(col, row);
const pressTile = (col, row, amount) => grid.press(col, row, amount);
const flashTile = (col, row, color) => grid.flash(col, row, color);

const chips = new Chips(["mode", "aim", "cam", "lock"], $);
const announce = (id, value, via) => chips.announce(id, value, via);

const hud = {
  busted: $("hud-busted"), hits: $("hud-hits"),
  fire: $("btn-fire"), orbit: $("pad-orbit"),
  // advance / story mode
  level: $("hud-level"), pips: $("hud-pips"), chain: $("hud-chain"),
  talkHint: $("hud-talk-hint"), taskLine: $("hud-task-line"), talkBtn: $("btn-talk"),
  bombBtn: $("btn-bomb"), bombValue: $("chip-bomb"),
  caption: $("hud-caption"), card: $("card"),
  advanceOnly: [$("hud-advance-stats")], sandboxOnly: [$("hud-sandbox-stats")],
  vignette: $("vignette"),
};

const CAM_POS = new THREE.Vector3(0, 3.3, 4.9);
const LOOK_AT = new THREE.Vector3(0, 0.05, 0.1);
const rig3 = new CameraRig(camera, {
  modes: CAM_MODES,
  mode: CAM_MODES.includes(params.get("cam")) ? params.get("cam") : "fixed",
  home: CAM_POS, lookAt: LOOK_AT,
  fitWidth: COLS * TILE,
  punchMs: PUNCH_MS, punchDist: PUNCH_DIST,
  onModeChange: (m, via) => { hud.orbit.hidden = m !== "orbit"; announce("cam", m, via); },
});
stage.onResize = () => rig3.fitFov();
/** The rig, under the name the game has always called it. `cam.mode`, `cam.yaw`, `cam.shake` all still read. */
const cam = rig3;
const setCamMode = (m, via) => rig3.setMode(m, via);
const cycleCamMode = (via) => rig3.cycle(via);
const orbitBy = (dyaw, dpitch, via) => rig3.orbitBy(dyaw, dpitch, via);
/** Bump the camera shake envelope; a no-op under reduced motion. */
function shakeCam(amount) { if (!REDUCED_MOTION) rig3.bump(amount); }
function triggerCamPunch(bvx, bvz) { if (!REDUCED_MOTION) rig3.punch(bvx, bvz, now()); }
/** The `#vignette` overlay: a red wash that flashes in and fades over VIGNETTE_MS. */
function flashVignette() {
  if (REDUCED_MOTION) return;
  hud.vignette.classList.remove("flash");
  void hud.vignette.offsetWidth;
  hud.vignette.classList.add("flash");
}

// The buster's own body, from the engine's rig, in the game's colours.
const charMats = characterMaterials(PAL);
const { armor: matArmor, armorDark: matArmorDark, muzzle: matMuzzle } = charMats;
const rig = buildCharacter(charMats, { scale: CHAR_SCALE });
scene.add(rig.root);
// ---------- world ----------
// Sandbox is a single fixed board; advance ("story") lays segments — arena,
// road, tower — end to end along +x and only ever appends. Both live in the
// same `tiles` map, keyed by world (col, row), so a tile lookup, a walk, a
// shot's flight and the camera all read one source of truth regardless of
// mode: sandbox just happens to build a world that never grows past its one
// arena. `COLS` (6) is the width every arena and tower segment shares; a
// road is `ROAD_COLS` (3) wide.
/** Every segment ever built, oldest first; the world only ever grows. */
const world = { segments: [], nextX: 0 };
let roadCount = 0;   // the very first road ever built always carries a bomb; after that, 1 in 3
/** The arena the player is walking towards or fighting — always the newest one built. */
function activeArena() {
  for (let i = world.segments.length - 1; i >= 0; i--) if (world.segments[i].kind === "arena") return world.segments[i];
  return null;
}
/** The world column an arena's fight starts at: 0 in sandbox (the whole board is the "arena"), the active arena's x0 in advance. */
function arenaBaseCol() { return mode === "sandbox" ? 0 : (activeArena()?.x0 ?? 0); }

function onBoard(col, row) { return grid.has(col, row); }
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
  // Boxed in: while the newest arena is still contested, the ground behind
  // its own x0 (every earlier segment) is off limits too — no retreating
  // once the fight is joined. Cleared, the whole world behind is open again.
  const a = activeArena();
  if (a && a.owner === "enemy" && a.entered && col < a.x0) return false;
  return true;
}
/** Past the built world's edge by more than a tile: where shots and bolts are spent, so nothing streams off into the sky. */
const offBoard = (x, z) => grid.offBoard(x, z);

/** Build one arena: the left PCOLS columns player ground, the rest the guard's, until cleared. */
function buildArenaSegment(x0, idx) {
  const seg = {
    kind: "arena", x0, cols: COLS, idx, owner: "enemy",
    pool: Math.min(20, 4 + Math.floor(idx * 0.16)),
    waveSize: Math.min(5, 2 + Math.floor(idx / 25)),
    dealt: 0, entered: false, wakeAt: null, nextWaveAt: null, wave: null, waveN: 0,
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
  const guaranteed = roadCount === 0;
  roadCount++;
  if (guaranteed || Math.random() < BOMB_ROAD_CHANCE) spawnBombPickup(seg);
  return seg;
}
/** A tower: the player's own ground, holding a keeper NPC on its middle tile (not standable); every tower but the first also carries "tally", a second, smaller NPC that counts the run. */
function buildTowerSegment(x0, ordinal) {
  const seg = {
    kind: "tower", x0, cols: COLS, ordinal, roostShown: ordinal === 0,
    keeperTopics: ordinal === 0 ? KEEPER_START_TOPICS : KEEPER_ROOST2_TOPICS, keeperTopicIdx: 0,
    tallyTopics: ordinal >= 1 ? TALLY_TOPICS : null, tallyTopicIdx: 0,
  };
  for (let row = 0; row < ROWS; row++) for (let col = x0; col < x0 + COLS; col++) buildTile(col, row, "tower");
  tileAt(x0 + PCOLS, 1).isNpc = true;
  buildSegmentDecor(seg);
  buildKeeper(seg);
  if (seg.tallyTopics) { tileAt(x0 + 4, 2).isNpc = true; buildTally(seg); }
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
  if (seg.kind === "tower") { disposeKeeper(seg); disposeTally(seg); }
  if (seg.kind === "road") disposeBombsOn(seg);
  if (grid.colMin === seg.x0 || grid.colMax === seg.x0 + seg.cols - 1) grid.recomputeBounds();
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
  grid.recomputeBounds();
  roadCount = 0;
  bombPickups.length = 0;   // their meshes already went with disposeSegment(road)
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
    score: 0, deletions: 0, chain: 0, bestChain: 0, shotsFired: 0, whiffs: 0,
    waveIdx: 0, waveWhiffed: false, waveHit: false,
    hitThisArena: false, cleanArenaCount: 0, arenasClearedCount: 0, guardKillCount: 0,
    chargedKillCount: 0, perfectWaveCount: 0, runnersPassed: 0, bombs: 0,
    task: null, tasksGiven: [], taskExchNpc: null, talk: null,
  };
}
let run = freshRun();

const chainMultiplier = (chain) => (chain >= 20 ? 4 : chain >= 10 ? 3 : chain >= 5 ? 2 : 1);
/** Clearing, wave-clearing and tasks pay the clock back; never past the cap. */
function addTime(sec) { run.timeLeft = Math.min(CLOCK_CAP, run.timeLeft + sec); }

const aliveInArena = () => rotters.filter((r) => r.phase !== "die").length;

/**
 * Deal the next wave: pick a formation at random, rotate it 0-2 rows, and
 * schedule its slots (the arena's own x0 baked in) to arrive staggered by
 * `waveStaggerMs(waveIdx)` — `waveIdx` is a whole-run counter, never reset
 * per arena. From GUARD_FROM_ARENA, the formation's anchor slot may become a
 * guard. Spawning itself happens in `processWave()`, frame by frame, so a
 * slot whose tile is taken or the board full can simply wait.
 */
function dealWave(a, t) {
  const n = Math.min(a.waveSize, a.pool - a.dealt, MAX_ALIVE);
  a.dealt += n;
  const stagger = waveStaggerMs(run.waveIdx);
  run.waveIdx++;
  const form = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
  const rot = Math.floor(Math.random() * ROWS);
  let guardSlot = -1;
  if (a.idx >= GUARD_FROM_ARENA && form.anchor < n && Math.random() < guardChance(a.idx)) guardSlot = form.anchor;
  const pending = [];
  for (let i = 0; i < n; i++) {
    const [col0, row0] = form.slots[i];
    pending.push({ col: a.x0 + col0, row: (row0 + rot) % ROWS, kind: i === guardSlot ? "guard" : "mett", arriveAt: t + i * stagger, spawned: false });
  }
  a.wave = { pending };
  a.waveN = n;
  run.waveWhiffed = false;
  run.waveHit = false;
}
/** Spawn every pending slot whose arrival has come and whose tile is free; a blocked one just waits another 90ms. */
function processWave(a, t) {
  const w = a.wave;
  if (!w) return;
  for (const slot of w.pending) {
    if (slot.spawned || t < slot.arriveAt) continue;
    if (aliveInArena() >= MAX_ALIVE || occupied(slot.col, slot.row)) { slot.arriveAt = t + 90; continue; }
    spawnAdvanceRotter(slot.col, slot.row, slot.kind, t);
    slot.spawned = true;
  }
}
/** A wave's last enemy is gone: pay a perfect clear (no whiff, no hit, the whole wave through), then move on. */
function finishWave(a, t) {
  if (!run.waveWhiffed && !run.waveHit) {
    const n = a.waveN;
    const mult = chainMultiplier(run.chain);
    const pts = WAVE_CLEAR_PTS_PER * n * mult;
    const sec = (WAVE_CLEAR_BONUS_BASE_S + WAVE_CLEAR_BONUS_PER_S * n) * ROAD_PULSE;
    run.score += pts;
    addTime(sec);
    run.perfectWaveCount++;
    popup(state.pos.x, state.pos.z, `WAVE CLEAR +${pts}`, { color: "#ffd23f", y0: 1.05, ms: 900 });
    popup(state.pos.x, state.pos.z, `+${sec.toFixed(2)}s`, { color: "#ffd23f", y0: 0.68, ms: 900 });
  }
  a.wave = null;
  if (a.dealt >= a.pool) { clearArena(a, t); return; }
  a.nextWaveAt = t + WAVE_GAP_MS;
}

/** The pool is spent and the board is clear: flip the ground, pay the clock, and build onward. */
function clearArena(a, t) {
  a.owner = "player";
  // The ground is the buster's the instant the pool is spent: every tile of
  // the enemy half becomes walkable now, so a step asked for in the same
  // frame is honoured. Only the *look* staggers column by column — the 2D
  // original's own arena-taken pulse — on real-time `setTimeout`, not the
  // sim clock: a one-off flourish nothing else reads.
  for (let col = a.x0 + PCOLS, i = 0; col < a.x0 + COLS; col++, i++) {
    const c = col;
    for (let row = 0; row < ROWS; row++) tileAt(c, row).kind = "player";
    // by the time a late column fires the arena may already have been trimmed behind the buster
    const doColumn = () => { for (let row = 0; row < ROWS; row++) { const tl = tileAt(c, row); if (!tl) continue; retintTile(tl, "player"); ripple(tileX(c), tileZ(row), PAL.tilePlayerRim, 1.6, 420); } };
    if (i === 0) doColumn(); else setTimeout(doColumn, i * ARENA_STAGGER_MS);
  }
  dropDivider(a);
  shakeCam(0.05);
  addTime(ARENA_CLEAR_BONUS_S * ROAD_PULSE);
  run.arenasClearedCount++;
  if (!run.hitThisArena) run.cleanArenaCount++;
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
    if (state.col >= a.x0) { a.entered = true; a.wakeAt = t + WAKE_DELAY_MS; popLevelHud(); }
    return;
  }
  if (a.wakeAt != null) { if (t >= a.wakeAt) { dealWave(a, t); a.wakeAt = null; } return; }
  if (a.wave) {
    processWave(a, t);
    if (a.wave.pending.every((s) => s.spawned) && aliveInArena() === 0) finishWave(a, t);
    return;
  }
  if (a.nextWaveAt != null) { if (t >= a.nextWaveAt) { dealWave(a, t); a.nextWaveAt = null; } return; }
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
  const acc = run.shotsFired > 0 ? run.deletions / run.shotsFired : 0;
  $("card-arena").textContent = String((activeArena()?.idx ?? 0) + 1);
  $("card-score").textContent = String(run.score);
  $("card-deletions").textContent = String(run.deletions);
  $("card-chain").textContent = String(run.bestChain);
  $("card-acc").textContent = `${Math.round(acc * 100)}%`;
  $("card-rank").textContent = rankLetter(acc, run.bestChain);
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

// ---------- story ----------
// Towers: a keeper on the middle tile and, from the tower before arena 10
// on, a second and smaller NPC, "tally", who just counts the run. Both are
// talked to from beside them, player-paced beat by beat, in topics —
// pressing TALK opens whichever topic that NPC hasn't finished yet, each
// further press is one beat, and the last beat closes it and moves that
// NPC's pointer on to the next topic for next time. The original's own
// dialogue is not reproducible (its prose lives outside this repo) so these
// are new lines, written short, in the game's own voice.

const KEEPER_START_TOPICS = [
  ["The ground ahead is theirs. Take it and keep walking.", "Every panel you don't take rots a little longer under them.", "Go. The tower keeps."],
  ["Delete clean and the ground remembers whose it is.", "A charge is worth saving for the ones that don't flinch.", "Walk on."],
];
const KEEPER_ROOST2_TOPICS = [
  ["Ten arenas back there. You've a feel for the shape of it now.", "What's ahead wears plate. It won't hop, won't flinch, won't die easy.", "One good charge puts it down. Anything less just rings it."],
  ["They call it a guard because that's the job, not the temperament.", "It doesn't even aim at you. It just refuses to leave.", "Refuse back."],
  ["The pool only gets deeper past here.", "Save your charge for the ones that stand their ground."],
  ["Tally keeps the count, if you want it."],
  ["Go take the ground."],
];
/** Tally's second beat quotes the run's own numbers — a function, not a string; `beatText()` calls it at open-time. */
const TALLY_TOPICS = [
  ["Counting for you, since someone should.", (r) => `arenas taken ${r.arenasClearedCount} · deletions ${r.deletions} · best chain ${r.bestChain}`, "Ask and I'll read it back."],
  ["Go on. They're not getting any less armoured."],
];
const beatText = (b) => (typeof b === "function" ? b(run) : b);

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

// Tally: a smaller cloaked figure with no staff, a warm visor instead of the
// keeper's cool one, standing on its own tile a row over.
const tallies = [];   // { g, seg, seed }
function buildTally(seg) {
  const g = new THREE.Group();
  g.scale.setScalar(0.72);
  g.position.set(tileX(seg.x0 + 4), 0, tileZ(2));
  const cloakMat = new THREE.MeshStandardMaterial({ color: PAL.tallyCloak, roughness: 0.85, metalness: 0.1 });
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.3, 1.05, 12), cloakMat, 0, 0.53, 0));
  g.add(mesh(new THREE.SphereGeometry(0.14, 12, 10), cloakMat, 0, 1.05, 0));
  const visorMat = new THREE.MeshStandardMaterial({ color: PAL.tallyVisor, emissive: PAL.tallyVisor, emissiveIntensity: 1.6, roughness: 0.2 });
  g.add(box(0.16, 0.025, 0.02, visorMat, 0, 0.96, 0.13));
  scene.add(g);
  tallies.push({ g, seg, seed: Math.random() * 100 });
}
function disposeTally(seg) {
  const i = tallies.findIndex((k) => k.seg === seg);
  if (i < 0) return;
  const k = tallies[i];
  k.g.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry) o.geometry.dispose(); });
  scene.remove(k.g);
  tallies.splice(i, 1);
}
function updateTallies(t) {
  for (const k of tallies) {
    k.g.rotation.y = -0.08 * Math.sin(t / 1100 + k.seed);
    k.g.position.y = 0.008 * Math.sin(t / 700 + k.seed);
  }
}

/** The NPC the player is standing beside (orthogonally adjacent to its tile), if any: `{ seg, role }`. */
function nearbyNpc() {
  for (const seg of world.segments) {
    if (seg.kind !== "tower") continue;
    const kcol = seg.x0 + PCOLS, krow = 1;
    if ((state.col === kcol && Math.abs(state.row - krow) === 1) || (Math.abs(state.col - kcol) === 1 && state.row === krow)) return { seg, role: "keeper" };
    if (seg.tallyTopics) {
      const tcol = seg.x0 + 4, trow = 2;
      if ((state.col === tcol && Math.abs(state.row - trow) === 1) || (Math.abs(state.col - tcol) === 1 && state.row === trow)) return { seg, role: "tally" };
    }
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
/** Leaving every NPC's proximity ends the "row" the task exchange counts by. */
function updateTalkProximity() { if (!run.talk && !nearbyNpc()) run.taskExchNpc = null; }

const topicsFor = (seg, role) => (role === "keeper" ? seg.keeperTopics : seg.tallyTopics);
const topicIdxFor = (seg, role) => (role === "keeper" ? seg.keeperTopicIdx : seg.tallyTopicIdx);
function bumpTopicIdx(seg, role) { if (role === "keeper") seg.keeperTopicIdx++; else seg.tallyTopicIdx++; }

/** TALK: press once beside an NPC to open its next topic, once per beat to advance, and once on the last beat to close. */
function pressTalk() {
  if (mode !== "advance") return;
  if (run.talk) { advanceTalk(); return; }
  const near = nearbyNpc();
  if (!near) return;
  const { seg, role } = near;
  const npcId = seg.x0 + ":" + role;
  // The task exchange and the topic's own first beat share one caption line
  // — a hand/pay message on the very press that also opens a conversation
  // would otherwise be overwritten before it's ever read.
  let taskMsg = null;
  if (run.taskExchNpc !== npcId) { run.taskExchNpc = npcId; taskMsg = taskExchange(); }
  const topics = topicsFor(seg, role);
  const idx = topicIdxFor(seg, role);
  const fresh = idx < topics.length;
  const beats = fresh ? topics[idx] : topics[topics.length - 1];
  run.talk = { seg, role, beats, i: 0, fresh };
  showCaption(taskMsg ? `${taskMsg}  ·  ${beatText(beats[0])}` : beatText(beats[0]));
}
function advanceTalk() {
  const tk = run.talk;
  tk.i++;
  if (tk.i >= tk.beats.length) {
    if (tk.fresh) bumpTopicIdx(tk.seg, tk.role);
    closeTalk();
  } else showCaption(beatText(tk.beats[tk.i]));
}
function closeTalk() {
  run.talk = null;
  hideCaption();
}

/** Every TALK, once per distinct NPC in a row: pay the active task if its target is met, else hand the next undone one, else nothing. Returns the caption text, or null. */
function taskExchange() {
  if (run.task) {
    const def = TASKS_LIST.find((d) => d.id === run.task.id);
    const met = TASK_PROGRESS[def.id](run) >= def.target;
    return met ? payTask(def.id) : null;
  }
  const next = TASKS_LIST.find((d) => !run.tasksGiven.includes(d.id));
  if (!next) return null;
  run.tasksGiven.push(next.id);
  run.task = { id: next.id, desc: next.desc };
  return `TASK: ${next.desc}`;
}
function payTask(id) {
  const def = TASKS_LIST.find((d) => d.id === id);
  run.task = null;
  let caption = "TASK COMPLETE";
  if (def.reward.time) { addTime(def.reward.time); caption += ` +${def.reward.time}s`; }   // task rewards are not scaled by ROAD_PULSE
  if (def.reward.pts) { run.score += def.reward.pts; caption += ` +${def.reward.pts}pts`; }
  if (def.reward.bomb) { run.bombs += def.reward.bomb; caption += ` +${def.reward.bomb} bomb`; }
  return caption;
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

/** The HUD's level number pops (scale 1.3 → 1) the instant the player steps into a new arena — a boundary, not a banner. */
function popLevelHud() {
  hud.level.classList.remove("pop");
  void hud.level.offsetWidth;
  hud.level.classList.add("pop");
}

// ---------- bombs ----------
// A pickup on a road tile: walk onto it to stow it. BOMB (the chip, or `B`)
// blasts the active arena's enemy half in a 3x3 centred on (x0+4, row 1),
// deleting everything in it — guards included — at normal-kill scoring, no
// chain change, only while that arena is still contested.

const bombPickups = [];   // { g, spark, col, row, seg, taken, seed }
function buildBombMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: PAL.bombBody, roughness: 0.5, metalness: 0.4 });
  g.add(ball(0.15, bodyMat, 0, 0.15, 0, 12));
  const fuseMat = new THREE.MeshStandardMaterial({ color: PAL.bombFuse, roughness: 0.8 });
  const fuse = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 6), fuseMat, 0.03, 0.29, 0);
  fuse.rotation.z = 0.35;
  g.add(fuse);
  const sparkMat = new THREE.SpriteMaterial({ map: discTex, color: PAL.bombSpark, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const spark = new THREE.Sprite(sparkMat);
  spark.scale.setScalar(0.09);
  spark.position.set(0.065, 0.35, 0);
  g.add(spark);
  return { g, spark };
}
function spawnBombPickup(seg) {
  const col = seg.x0 + 1, row = 1;
  if (!onBoard(col, row)) return;
  const { g, spark } = buildBombMesh();
  g.position.set(tileX(col), 0, tileZ(row));
  scene.add(g);
  bombPickups.push({ g, spark, col, row, seg, taken: false, seed: Math.random() * 100 });
}
function disposeBombPickup(b) { scene.remove(b.g); b.g.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry) o.geometry.dispose(); }); }
function disposeBombsOn(seg) {
  for (let i = bombPickups.length - 1; i >= 0; i--) if (bombPickups[i].seg === seg) { disposeBombPickup(bombPickups[i]); bombPickups.splice(i, 1); }
}
function updateBombPickups(t) {
  for (let i = bombPickups.length - 1; i >= 0; i--) {
    const b = bombPickups[i];
    b.g.position.y = 0.01 * Math.sin(t / 140 + b.seed);
    b.spark.material.opacity = 0.6 + 0.4 * Math.sin(t / 90 + b.seed);
    if (!b.taken && state.col === b.col && state.row === b.row) {
      b.taken = true;
      run.bombs++;
      popup(b.g.position.x, b.g.position.z, "BOMB +1", { color: "#ffd23f" });
      disposeBombPickup(b);
      bombPickups.splice(i, 1);
    }
  }
}
/** A bomb kill pays like a normal-kill deletion (scoring + time) but sits outside the shot economy entirely: no chain, no shotsFired, no accuracy effect. */
function advanceBombKill(r, t) {
  const isGuard = r.kind === "guard";
  r.phase = "die"; r.t0 = t; r.dur = ROTTER_DIE_MS; r.hop = null;
  dust(r.x, r.z, 10, 2.2, { color: PAL.bolt, y: 0.25, rise: 0.5, size: [0.07, 0.26], ms: [260, 420], additive: true });
  spawnDebris(r.x, r.z, isGuard ? [PAL.guardBody, PAL.guardDark] : [PAL.rotter, PAL.rotterDark, PAL.rotterBlade]);
  const mult = chainMultiplier(run.chain);
  const pts = isGuard ? PTS_GUARD : PTS_NORMAL;
  run.score += pts * mult;
  addTime((isGuard ? BONUS_GUARD_S : BONUS_NORMAL_S) * ROAD_PULSE);
  popup(r.x, r.z, `+${pts * mult}`, { color: "#c9f6ff" });
  if (isGuard) run.guardKillCount++;
}
function pressBomb() {
  if (mode !== "advance" || run.over || !run.started || cardKind) return;
  if (run.bombs <= 0) return;
  const a = activeArena();
  if (!a || a.owner !== "enemy" || !a.entered) return;
  const t = now();
  run.bombs--;
  const cx = a.x0 + 4, cz = 1;
  const hits = rotters.filter((r) => (r.kind === "mett" || r.kind === "guard") && r.phase !== "die" && Math.abs(r.col - cx) <= 1 && Math.abs(r.row - cz) <= 1);
  for (const r of hits) advanceBombKill(r, t);
  triggerHitStop(BOMB_HITSTOP_MS);
  shakeCam(0.08);
  for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) flashTile(cx + dc, cz + dr, PAL.bolt);
  ripple(tileX(cx), tileZ(cz), PAL.bolt, 3.4, 420);
  dust(tileX(cx), tileZ(cz), 16, 2.8, { color: PAL.bolt, y: 0.3, rise: 0.6, size: [0.1, 0.32], ms: [320, 540], additive: true });
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
  const showTask = !!run.task;
  hud.taskLine.hidden = !showTask;
  if (showTask) hud.taskLine.textContent = `task: ${run.task.desc}`;
  const near = !run.talk && !!nearbyNpc();
  hud.talkHint.hidden = !near;
  hud.talkBtn.hidden = !(near || run.talk);
  hud.bombBtn.hidden = run.bombs <= 0;
  if (run.bombs > 0) hud.bombValue.textContent = String(run.bombs);
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
  rig3.pos.copy(CAM_POS);
  rig3.target.copy(LOOK_AT);
  camAnchorX = state.pos.x; camLookX = state.pos.x;
}
function setMode(m, via) {
  if (!MODES.includes(m) || m === mode) return;
  mode = m;
  applyMode();
  announce("mode", m, via);
}
function toggleMode(via) { setMode(mode === "sandbox" ? "advance" : "sandbox", via); }

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

// ---------- state ----------

const initialAim = AIM_MODES.includes(params.get("aim")) ? params.get("aim") : "lane";
/** Which ruleset is live: the free-play board, or the 2D original's endless road. `setMode()` (bottom, mode control) rebuilds the world when this changes. */
let mode = MODES.includes(params.get("mode")) ? params.get("mode") : "sandbox";

/**
 * The hop itself is the engine's model — one square per ration, the square
 * changing at the top of the arc. What may be stood on, what a landing
 * kicks up, and whether a hop turns the body are this game's answers, and
 * they go in as callbacks.
 */
const hopper = new Hopper({
  col: 1, row: 1,
  timing: { windup: HOP_WINDUP_MS, air: HOP_AIR_MS, settle: HOP_SETTLE_MS },
  free: (col, row) => walkable(col, row) && !rotterAt(col, row),
  canTarget: (col, row) => onBoard(col, row) && !rotterAt(col, row),
  onTarget: (col, row, ok) => {
    // a tap on a rotter's square still answers, in the rotter's own colour
    if (!ok) { if (onBoard(col, row)) ripple(tileX(col), tileZ(row), PAL.bolt, 1.1, 260); return; }
    ripple(tileX(col), tileZ(row), PAL.ripple, 1.25, 320);
    tileAt(col, row).glow = 1;
  },
  onBegin: (col, row, fromCol, fromRow, t) => {
    // Unless the barrel is being held somewhere — by the lock, live aim
    // input, or lane mode holding it down the lane on principle — a hop
    // turns the body to face where it is going, as the 2D buster turns.
    // Held, the legs go and the barrel stays: the strafe. Lane mode is
    // *always* the strafe.
    if (!state.lock && state.aimMode !== "lane" && !aimHeld(t)) setAim(angleTo(0, 0, col - fromCol, row - fromRow), t);
  },
  onLeave: (col, row) => { pressTile(col, row, 0.5); dust(tileX(col), tileZ(row), 3, 0.7); },
  onLand: (col, row) => {
    ripple(tileX(col), tileZ(row), 0xffffff, 1.5, 300);
    pressTile(col, row, 0.9);
    dust(tileX(col), tileZ(row), 6, 1.1);
  },
});

/**
 * The buster's own state. The square, the hop and the path live on the
 * hopper — the accessors below are views onto it, so everything in this
 * file still reads `state.col` the way it always did, and the two never
 * drift apart the way a mirrored copy would.
 */
const state = {
  get col() { return hopper.col; }, set col(v) { hopper.col = v; },
  get row() { return hopper.row; }, set row(v) { hopper.row = v; },
  get hop() { return hopper.hop; }, set hop(v) { hopper.hop = v; },
  get path() { return hopper.path; }, set path(v) { hopper.path = v; },
  get queued() { return hopper.queued; }, set queued(v) { hopper.queued = v; },
  get phase() { return hopper.phase; },
  get lastMoveAt() { return hopper.lastMoveAt; },
  get lastIdleAt() { return hopper.lastIdleAt; },
  pos: new THREE.Vector3(tileX(1), 0, tileZ(1)),   // where the body is, this frame
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
  charge: null,               // { t0, hold } while FIRE is held
  lastFireAt: -1e9,
  fireAt: -1e9, fireCharged: false, fireFlashMs: 70,
  hurtUntil: -1e9,
  busted: 0, hits: 0,
};

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

// ---------- movement ----------
// The rules are all above, on the hopper; these are the names the rest of
// the game calls them by.

const moveReady = (t) => hopper.ready(t);
/** Nothing stands there: a square the player may stand on, and no rotter on it. */
const free = (col, row) => walkable(col, row) && !rotterAt(col, row);
const move = (dc, dr, t, preferRow = false) => hopper.move(dc, dr, t, preferRow);
const moveTo = (col, row, t) => hopper.moveTo(col, row, t);
const runPath = (t) => hopper.runPath(t);
const updateHop = (t) => hopper.update(t);
const flushQueued = (t) => hopper.flushQueued(t);

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
  // the chip re-reads every frame, not just on the transition: the lock's
  // value flips from "held" to "target" the moment a rotter comes into range
  chips.set("lock", state.lock ? (state.lockTarget ? "target" : "held") : "off");
  chips.toggle("lock", state.lock);
}

const _v = new THREE.Vector3();

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
  if (sv) setAim(rig3.angleOfScreen(sv[0], sv[1]), t);
  else if (kv) setAim(rig3.angleOfScreen(kv[0], kv[1]), t);
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

/** How long a hold must last for the release to fire the strong shot: 700ms in advance, 520ms in sandbox. */
function currentChargeMs() { return mode === "advance" ? ADV_CHARGE_MS : CHARGE_MS; }

function fire(t, charged) {
  if (mode === "advance") { fireHitscan(t, charged); return; }
  aimDir(state.aim, _v);
  const m = new THREE.Mesh(charged ? chargedGeo : shotGeo, charged ? matCharged : matShot);
  m.position.copy(muzzle);
  const glow = new THREE.Sprite(charged ? chargedGlowMat : shotGlowMat);
  glow.scale.setScalar(charged ? 0.7 : 0.28);
  m.add(glow);
  scene.add(m);
  const speed = charged ? CHARGED_SPEED : SHOT_SPEED;
  shots.push({ m, vx: _v.x * speed, vz: _v.z * speed, charged, dmg: charged ? ROTTER_HP : 1, x0: muzzle.x, z0: muzzle.z, hit: false });
  state.lastFireAt = t;
  state.fireAt = t;
  state.fireCharged = charged;
  state.fireFlashMs = 70;
  state.aimAt = t;
  state.cosmetic = false;
  flash.material.color.set(charged ? PAL.charged : PAL.shot);
  if (charged) {
    shakeCam(0.05);
    dust(muzzle.x, muzzle.z, 5, 1.4, { color: PAL.charged, y: muzzle.y, rise: 0, size: [0.06, 0.2], ms: [140, 220], additive: true });
  }
}

/** The board's edge along a ray from (mx,mz) in direction (dx,dz): where a miss's tracer ends and it counts as a whiff. */
function rayBoardEdge(mx, mz, dx, dz) {
  let best = 8;
  if (dx > 1e-6) best = Math.min(best, (tileX(grid.colMax) + TILE / 2 + 1 - mx) / dx);
  else if (dx < -1e-6) best = Math.min(best, (tileX(grid.colMin) - TILE / 2 - 1 - mx) / dx);
  if (dz > 1e-6) best = Math.min(best, (tileZ(ROWS - 1) + TILE / 2 + 1 - mz) / dz);
  else if (dz < -1e-6) best = Math.min(best, (tileZ(0) - TILE / 2 - 1 - mz) / dz);
  return Math.max(0.3, best);
}
/**
 * Advance mode's shot: instant hitscan along the aim ray, no projectile mesh.
 * The nearest live enemy whose hit circle the ray crosses, strictly ahead,
 * takes the hit; nothing in the way is a whiff. A bright tracer runs to the
 * impact (or the board edge) and fades in ADV_TRACER_MS.
 */
function fireHitscan(t, charged) {
  if (run.over) return;
  aimDir(state.aim, _v);
  const dirX = _v.x, dirZ = _v.z;
  const mx = muzzle.x, my = muzzle.y, mz = muzzle.z;
  let best = null, bestT = Infinity;
  for (const r of rotters) {
    if (r.phase === "die" || (r.kind !== "mett" && r.kind !== "guard")) continue;
    const wx = r.x - mx, wz = r.z - mz;
    const proj = wx * dirX + wz * dirZ;
    if (proj <= 0.05) continue;   // strictly ahead
    const perp2 = wx * wx + wz * wz - proj * proj;
    const rad = ROTTER_RADIUS + (charged ? 0.15 : 0.06);
    if (perp2 <= rad * rad && proj < bestT) { bestT = proj; best = r; }
  }
  const endT = best ? bestT : rayBoardEdge(mx, mz, dirX, dirZ);
  const ex = mx + dirX * endT, ez = mz + dirZ * endT;

  run.shotsFired++;
  state.lastFireAt = t;
  state.fireAt = t;
  state.fireCharged = charged;
  state.fireFlashMs = charged ? ADV_FLASH_MS.charged : ADV_FLASH_MS.normal;
  state.aimAt = t;
  state.cosmetic = false;
  flash.material.color.set(charged ? PAL.charged : PAL.shot);
  spawnTracer(mx, mz, ex, ez, charged ? PAL.charged : PAL.shot, ADV_TRACER_MS);
  ripple(ex, ez, charged ? PAL.charged : PAL.shot, 1.0, ADV_IMPACT_MS);
  if (charged) {
    shakeCam(0.05);
    dust(mx, mz, 5, 1.4, { color: PAL.charged, y: my, rise: 0, size: [0.06, 0.2], ms: [140, 220], additive: true });
  }
  if (!best) { whiff(t); return; }
  if (best.kind === "guard" && !charged) { advanceGuardPlink(best, t); return; }
  advanceDeleteEnemy(best, charged, t);
}
/** A shot with nothing ahead of it: breaks the chain (shown only once there was one worth losing) — not a deletion, not a guard plink. */
function whiff(t) {
  run.whiffs++;
  run.waveWhiffed = true;
  if (run.chain >= 2) chainLostFlourish();
  run.chain = 0;
}
/** A normal shot off a guard: sparks bounce back, a "GUARD" popup, a wobble — no damage, no chain change, not a whiff. */
function advanceGuardPlink(r, t) {
  r.flashUntil = t + 90;
  r.knock = { vx: 0.07, vz: 0, t0: t };
  triggerHitStop(killHitstopMs("guard", false));
  dust(r.x, r.z, 6, 1.6, { color: PAL.guardEye, y: 0.28, rise: 0.25, size: [0.05, 0.16], ms: [140, 220], additive: true });
  popup(r.x, r.z, "GUARD", { color: "#8fd0ff" });
  shakeCam(0.02);
}
/** A mett (any shot) or a guard (charged only) actually deleted: score, time, chain, hit-stop, task progress. */
function advanceDeleteEnemy(r, charged, t) {
  const isGuard = r.kind === "guard";
  r.phase = "die"; r.t0 = t; r.dur = ROTTER_DIE_MS; r.hop = null;
  dust(r.x, r.z, 14, 2.6, { color: isGuard ? PAL.guardEye : PAL.bolt, y: 0.25, rise: 0.6, size: [0.08, 0.3], ms: [300, 520], additive: true });
  ripple(r.x, r.z, isGuard ? PAL.guardEye : PAL.bolt, 2.2, 420);
  pressTile(r.col, r.row, 0.6);
  shakeCam(charged ? 0.07 : 0.035);
  spawnDebris(r.x, r.z, isGuard ? [PAL.guardBody, PAL.guardDark] : [PAL.rotter, PAL.rotterDark, PAL.rotterBlade]);
  if (state.lockTarget === r) state.lockTarget = null;

  run.deletions++;
  run.chain++;
  run.bestChain = Math.max(run.bestChain, run.chain);
  const mult = chainMultiplier(run.chain);
  const pts = isGuard ? PTS_GUARD : charged ? PTS_CHARGED : PTS_NORMAL;
  run.score += pts * mult;
  addTime((isGuard ? BONUS_GUARD_S : charged ? BONUS_CHARGED_S : BONUS_NORMAL_S) * ROAD_PULSE);
  popup(r.x, r.z, mult > 1 ? `+${pts * mult} ×${mult}` : `+${pts * mult}`, { color: "#c9f6ff" });
  triggerHitStop(killHitstopMs(r.kind, charged));
  if (CHAIN_STEPS.includes(run.chain)) { chainFlourish(mult); triggerHitStop(HITSTOP_ADV.chain); }
  if (charged) run.chargedKillCount++;
  if (isGuard) run.guardKillCount++;
}

/**
 * What is holding FIRE down right now: "key", "btn" (the on-screen button),
 * "rmb". A charge belongs to the hold that started it, and a charge whose
 * hold is gone is released by the watchdog in `updateFrame` — without that,
 * one lost pointerup (a finger sliding off the button, a browser swallowing
 * the release, a capture that never took) would leave `state.charge` set for
 * good and every later press would return early: the weapon dead for the
 * rest of the run.
 */
function pressFire(t, hold = null) {
  // FIRE is also how the start and pause cards let go — a single choke
  // point covers the keyboard, the FIRE button and right-click/touch alike.
  // (The hold itself was already added to the engine's set before this ran.)
  if (cardKind === "over") return;
  if (cardKind === "start") { startRun(); return; }
  if (cardKind === "pause") { resumeGame(); return; }
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
  if (t - c.t0 >= currentChargeMs()) fire(t, true);
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
  const fu = clamp01((t - state.fireAt) / state.fireFlashMs);
  flash.position.copy(muzzle);
  flash.scale.setScalar(fu < 1 ? lerp(state.fireCharged ? 0.9 : 0.45, 0.05, fu) : 0.001);
  flash.material.opacity = fu < 1 ? 1 - fu : 0;
  chargeGlow.position.copy(muzzle);
  if (state.charge) {
    const cu = clamp01((t - state.charge.t0) / currentChargeMs());
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

/**
 * `guard`: a distinct steel look, not just a tint — a heavier cup, no rotor
 * blades (it never spins up, never winds anything), a colder grey-blue eye.
 */
function buildRotter(guard = false) {
  const g = new THREE.Group();
  const bodyColor = guard ? PAL.guardBody : PAL.rotter, darkColor = guard ? PAL.guardDark : PAL.rotterDark;
  const eyeColor = guard ? PAL.guardEye : PAL.rotterEye;
  const matBody = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: guard ? 0.35 : 0.45, metalness: guard ? 0.7 : 0.55, emissive: 0x000000 });
  const matDark = new THREE.MeshStandardMaterial({ color: darkColor, roughness: 0.5, metalness: guard ? 0.6 : 0.4, emissive: 0x000000 });
  const matBlade = new THREE.MeshStandardMaterial({ color: PAL.rotterBlade, roughness: 0.35, metalness: 0.6, emissive: PAL.rotterBlade, emissiveIntensity: 0.25 });
  const matEye = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: eyeColor, emissiveIntensity: 1.2, roughness: 0.2 });
  const body = new THREE.Group();
  g.add(body);
  body.add(mesh(new THREE.CylinderGeometry(guard ? 0.34 : 0.3, guard ? 0.2 : 0.14, guard ? 0.24 : 0.2, guard ? 10 : 8), matBody, 0, guard ? 0.14 : 0.12, 0));   // the cup — heavier on a guard
  body.add(mesh(new THREE.SphereGeometry(guard ? 0.21 : 0.19, 14, 10), matDark, 0, guard ? 0.3 : 0.27, 0));            // the dome
  const rotor = new THREE.Group();   // kept even on a guard so the shared per-frame code has somewhere to (not) spin
  rotor.position.y = guard ? 0.37 : 0.34;
  body.add(rotor);
  if (guard) {
    // a plated cap in place of the spike and blades: still, armoured, done
    body.add(mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.06, 10), matDark, 0, 0.44, 0));
    const eye = mesh(new THREE.SphereGeometry(0.08, 12, 10), matEye, -0.18, 0.3, 0);
    eye.castShadow = false;
    body.add(eye);
  } else {
    body.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 8), matBlade, 0, 0.5, 0));             // the spike
    const eye = mesh(new THREE.SphereGeometry(0.07, 12, 10), matEye, -0.16, 0.27, 0);       // the eye looks down the lane at the player's half
    eye.castShadow = false;
    body.add(eye);
    for (let i = 0; i < 3; i++) {
      const blade = box(0.62, 0.035, 0.09, matBlade, 0, 0, 0);
      blade.rotation.y = (i * Math.PI * 2) / 3;
      blade.rotation.x = 0.18;
      rotor.add(blade);
    }
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

/** Sandbox's own free-respawn rotter: unchanged, 3 hp, the random sit/hop/aim state machine below (`r.kind` unset marks it "classic"). */
function spawnRotter(t) {
  const at = freeEnemyTile();
  if (!at) return;
  const r = buildRotter(false);
  Object.assign(r, {
    col: at[0], row: at[1], x: tileX(at[0]), z: tileZ(at[1]),
    hp: ROTTER_HP, steel: false, phase: "spawn", t0: t, dur: ROTTER_SPAWN_MS, hop: null, knock: null,
    spin: 0.006, flashUntil: -1e9, nextFireAt: t + rand(ROTTER_FIRE_EVERY[0], ROTTER_FIRE_EVERY[1]) + 800, seed: Math.random() * 100,
  });
  r.g.position.set(r.x, 0, r.z);
  scene.add(r.g);
  rotters.push(r);
  ripple(r.x, r.z, PAL.bolt, 1.4, 420);
}

/** Advance mode's own spawn, at a formation slot already picked: a mett (hops its arena every MET_HOP_MS) or a guard (never moves, never attacks). */
function spawnAdvanceRotter(col, row, kind, t) {
  const guard = kind === "guard";
  const r = buildRotter(guard);
  Object.assign(r, {
    col, row, x: tileX(col), z: tileZ(row), kind,
    hp: 1, steel: false, phase: "spawn", t0: t, dur: ROTTER_SPAWN_MS, hop: null, knock: null,
    spin: guard ? 0 : 0.006, flashUntil: -1e9, seed: Math.random() * 100,
    nextHopAt: t + ROTTER_SPAWN_MS + MET_HOP_MS,
    nextFireAt: t + rand(ROTTER_FIRE_EVERY[0], ROTTER_FIRE_EVERY[1]) + 800,   // unreachable before RETALIATE_ARENA; kept so that gate has something to switch on
  });
  r.g.position.set(r.x, 0, r.z);
  scene.add(r.g);
  rotters.push(r);
  ripple(r.x, r.z, guard ? PAL.guardEye : PAL.bolt, 1.4, 420);
  return r;
}

/** Sandbox's own projectile-hit resolution — advance mode is hitscan and never spawns a `shot`, so never calls this. */
function hitRotter(r, shot, t) {
  r.hp -= shot.dmg;
  r.flashUntil = t + 90;
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
    triggerHitStop(shot.charged ? HITSTOP_CHARGED_MS : HITSTOP_MS);
    popup(r.x, r.z, "BUSTED", { color: "#c9f6ff" });
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
    triggerHitStop(HITSTOP_ADV.hurt);
    if (run.chain > 0) chainLostFlourish();
    run.hitThisArena = true;
    run.waveHit = true;
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
        tl.stain = Math.min(1, tl.stain + frameDt * ROT_RATE);
        tl.stainHeld = true;
        if (r.kind === "guard") break;   // never moves, never attacks — the formation's anchor
        if (r.kind === "mett") {
          // never the random classic sit/hop/aim state machine: a fixed
          // MET_HOP_MS shuffle, and the "aim"/bolt phase only from RETALIATE_ARENA
          if (rotterCanFire() && t >= r.nextFireAt) { r.phase = "aim"; r.t0 = t; r.dur = ROTTER_AIM_MS; break; }
          if (t >= r.nextHopAt) {
            const to = freeEnemyTile();
            if (to) { r.phase = "hop"; r.t0 = t; r.dur = ROTTER_HOP_MS; r.hop = { fromCol: r.col, fromRow: r.row, toCol: to[0], toRow: to[1], committed: false }; }
            r.nextHopAt = t + MET_HOP_MS;
          }
          break;
        }
        // classic (sandbox): random sit/hop, and (once unlocked) the aim/bolt phase
        if (dt >= r.dur) {
          if (t >= r.nextFireAt && rotterCanFire()) { r.phase = "aim"; r.t0 = t; r.dur = ROTTER_AIM_MS; }
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
// The curves are the engine's — an idle, and a hop's crouch/arc/land, each
// phase starting where the last ended so the pose is continuous. What this
// game adds on top is the shooting: the barrel arm held level whatever the
// legs do, the left hand bracing a charge, the recoil kick, the flinch of a
// hit, and the strafe twist.

function pose(t) {
  const h = state.hop;
  const base = h ? hopPose(t - h.t0, hopper.timing) : idlePose(t);

  // Aiming holds the barrel arm level whatever the legs are doing: in the
  // air the arms would swing, but a shooter's do not.
  const holding = state.lock || !!state.charge || t - state.aimAt < AIM_HOLD_MS;
  // the charge: the left hand comes across to brace the barrel
  const chargeU = state.charge ? clamp01((t - state.charge.t0) / currentChargeMs()) : 0;
  // the recoil: the barrel arm kicks up and the torso rocks back
  const ru = clamp01((t - state.fireAt) / RECOIL_MS);
  const kick = ru < 1 ? (1 - ru) * (state.fireCharged ? 0.55 : 0.28) : 0;
  // a hit: a flinch — the whole body cringes for the first part of the hurt
  const hu = clamp01((t - (state.hurtUntil - HURT_MS)) / HURT_MS);
  const flinch = hu < 1 ? (1 - hu) * (1 - hu) : 0;

  // The strafe: the legs turn towards where the hop is going, the torso
  // turns back by the same amount so the barrel stays on the aim. At rest
  // the legs come back under the barrel.
  const moveYaw = h ? angleTo(0, 0, h.toCol - h.fromCol, h.toRow - h.fromRow) : null;
  state.twist = easeTwist(state.twist, state.facing, moveYaw, frameDt, { max: TWIST_MAX, tau: 60 });

  applyPose(rig, base, { holding: holding ? 0.85 : 0, chargeU, kick, flinch, twist: state.twist, hurtColor: PAL.bolt });
}

// ---------- placement ----------

function place(t) {
  const h = state.hop;
  let x, z, y = 0;
  if (h) {
    const dt = t - h.t0;
    const e = hopEaseAt(dt, hopper.timing);
    x = lerp(tileX(h.fromCol), tileX(h.toCol), e);
    z = lerp(tileZ(h.fromRow), tileZ(h.toRow), e);
    y = HOP_HEIGHT * hopHeightAt(dt, hopper.timing);
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

// ---------- input ----------
// The engine owns the two sticks and the FIRE hold-set; what a key *means*
// is here. Anything this game wants to intercept before the engine's own
// bookkeeping — a card over the board swallowing every key but FIRE — it
// does by returning true from `onKeyDown` / `onPointerDown`.

const input = new Input({
  canvas: renderer.domElement,
  rig: rig3,
  now,
  deadPx: STICK_DEAD_PX,

  onKeyDown(e) {
    // the game-over card freezes input to just RETRY — R is the orbit tilt
    // everywhere else, but here it means what Enter means.
    if (cardKind === "over") {
      if (e.code === "Enter" || e.code === "KeyR") { e.preventDefault(); retry(); }
      return true;
    }
    // the start and pause cards: FIRE lets go of either; P/Escape also
    // resumes a pause. Everything else — movement, aim, the cameras — is
    // inert while a card has the floor.
    if (cardKind) {
      if (input.fireKeys.has(e.code)) { e.preventDefault(); input.pressFire("key"); }
      else if ((e.code === "KeyP" || e.code === "Escape") && cardKind === "pause") { e.preventDefault(); resumeGame(); }
      return true;
    }
    return false;
  },

  onKey(code, e) {
    if (code === "ShiftLeft" || code === "ShiftRight") { state.lockHold = true; lockVia = "shift"; return; }
    if (e.repeat) return;
    switch (code) {
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
      case "KeyB": pressBomb(); break;
      case "KeyP": pauseGame(); break;
      case "Escape": pauseGame(); break;
    }
  },

  // `code` is null on a window blur: everything held is let go at once.
  onKeyUp(code) {
    if (code === null || code === "ShiftLeft" || code === "ShiftRight") { state.lockHold = false; lockVia = "shift"; }
  },

  onMove(dc, dr, preferRow) { move(dc, dr, now(), preferRow); },

  onTap(clientX, clientY, ground) {
    // intersect the board plane, then snap: taps just off a tile's edge still count
    if (!ground) return;
    const col = grid.colAt(ground.x), row = grid.rowAt(ground.z);
    if (!onBoard(col, row)) return;
    const t = now();
    if (!moveReady(t)) state.queued = { kind: "to", col, row };
    else moveTo(col, row, t);
  },

  onFireDown(hold) { pressFire(now(), hold); },
  onFireUp(hold) { releaseFire(now(), hold); },

  onHover(point) {
    state.hoverAim = angleTo(state.pos.x, state.pos.z, point.x, point.z);
    state.hoverAt = now();
  },

  // a card has the floor: no move/aim stick underneath it
  onPointerDown() { return !!cardKind; },
  onWheel(deltaY) { rig3.zoom(deltaY, "wheel"); },
});

const aimStickVec = () => input.aimStickVec();
const heldAim = () => input.heldAim();

/** A held direction (keys or the left stick) re-asks every frame; the ration paces it. */
function pollHold(t) {
  const mv = input.moveStickVec();
  const d = (mv && rig3.stepOfScreen(mv[0], mv[1], false)) || input.heldDir();
  if (!d) return;
  if (!moveReady(t)) return;
  move(d[0], d[1], t, !!d[2]);
}

// The on-screen pad: FIRE holds like the key; the rest are taps. Every chip
// (and the orbit nudges) is inert while a card is up — RETRY is the one
// exception, since it's the only button the game-over card shows at all.
// The cards cover the pad, so each carries its own way out: a phone has no
// Space bar, and a card with no button on it is a run that cannot start.
const CARD_BUTTONS = new Set(["btn-retry", "btn-start", "btn-resume"]);
const bind = (id, fn) => $(id).addEventListener("click", (e) => { if (cardKind && !CARD_BUTTONS.has(id)) return; fn(e); });
bind("btn-start", startRun);
bind("btn-resume", resumeGame);
bind("btn-aim", () => cycleAimMode("tap"));
bind("btn-cam", () => cycleCamMode("tap"));
bind("btn-lock", () => { state.lockToggle = !state.lockToggle; lockVia = "tap"; });
bind("btn-orbit-l", () => orbitBy(-0.35, 0, "tap"));
bind("btn-orbit-r", () => orbitBy(0.35, 0, "tap"));
bind("btn-mode", () => toggleMode("tap"));
bind("btn-talk", pressTalk);
bind("btn-bomb", pressBomb);
bind("btn-retry", retry);
input.bindFireButton(hud.fire);
releasePadKeys();

// ---------- loop ----------

function updateCamera() {
  updateCamAnchor();
  // fixed and follow track the anchor's x in advance mode (the arena's
  // centre while it's fought over, the player's x otherwise); orbit is
  // explicitly the player's own x, not the eased anchor. Sandbox frames the
  // one fixed board, so both pin to the origin.
  const advance = mode === "advance";
  rig3.update({
    focus: state.pos,
    aim: state.aim,
    frameDt,
    now: now(),
    anchorX: advance ? camLookX : 0,
    followX: advance ? camLookX : state.pos.x,
    orbitX: advance ? state.pos.x : 0,
  });
}

/**
 * Every update call a frame makes, minus the render — the engine's loop
 * calls this, and `simulate()` calls the same thing in fixed virtual steps
 * with no rendering at all, for a test to run a whole story arc in
 * milliseconds of wall time instead of minutes.
 */
function updateFrame(t, dt) {
  frameDt = dt;
  // a charge whose hold vanished (a lost pointerup, a swallowed keyup) is
  // released here rather than jamming the buster for the rest of the run
  if (state.charge && state.charge.hold && input.staleHold(state.charge.hold, state.charge.t0, t)) {
    releaseFire(t, state.charge.hold);
  }
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
      updateTalkProximity();
      updateBombPickups(t);
      updateAdvanceHud();
    }
  }
  grid.update(frameDt);
  place(t);
  pose(t);
  updateMuzzle(t);
  fx.update(t, frameDt);
  stage.motes.update(t, frameDt);
  if (mode === "advance") { updateKeepers(t); updateTallies(t); }
  updateCamera();
}

const loop = new Loop({ clock, stage, update: updateFrame });

setAimMode(state.aimMode, params.has("aim") ? "url" : null);
setCamMode(cam.mode, params.has("cam") ? "url" : null);
applyMode();
announce("mode", mode, params.has("mode") ? "url" : null);
stage.resize();
loop.start();

// A small hook for tests and for poking at it from the console. `mode` and
// `run` are getters — both are rebound (not mutated) on every mode switch
// and RETRY, so a snapshot taken once would go stale.
window.__bw3d = {
  state, cam, rotters, shots, bolts, rig, camera, renderer, world, grid, hopper,
  get mode() { return mode; },
  get run() { return run; },
  activeArena, walkable,
  move: (dc, dr) => move(dc, dr, now()), moveTo: (c, r) => moveTo(c, r, now()),
  fire: (charged = false) => fire(now(), charged), pressFire: () => pressFire(now()), releaseFire: () => releaseFire(now()),
  setAim: (a) => setAim(a, now()), setAimMode, setCamMode, orbitBy,
  lock: (on) => { state.lockToggle = on; },
  setMode, retry, pressTalk, talk: pressTalk, bomb: pressBomb,
  forceGameOver: () => { run.timeLeft = 0; gameOver(); },
  debugHit: () => takeHit(now()),   // synthetic hit, for testing the 2.5 s / chain-break path without waiting on a bolt
  get paused() { return clock.paused; },
  get cardKind() { return cardKind; },
  pauseGame, resumeGame, startRun,
  simulate: (ms, step = 16, render = true) => loop.simulate(ms, step, render),
  renderOnce: () => loop.renderOnce(),
  now, reducedMotion: () => REDUCED_MOTION,
};
