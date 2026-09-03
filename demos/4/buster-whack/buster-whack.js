var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/core/constants.js
var constants_exports = {};
__export(constants_exports, {
  ADVANCE_STAGES: () => ADVANCE_STAGES,
  ADV_UNLOCK: () => ADV_UNLOCK,
  ALLY_PTS_PENALTY: () => ALLY_PTS_PENALTY,
  ALLY_RISE_MS: () => ALLY_RISE_MS,
  ALLY_SPARE_BONUS: () => ALLY_SPARE_BONUS,
  ALLY_TIME_PENALTY: () => ALLY_TIME_PENALTY,
  ARENA_CLEAR_BONUS: () => ARENA_CLEAR_BONUS,
  ARENA_CLEAR_PTS: () => ARENA_CLEAR_PTS,
  ARENA_ENTRY_DELAY_MS: () => ARENA_ENTRY_DELAY_MS,
  ARENA_WAVE_GAP_MS: () => ARENA_WAVE_GAP_MS,
  ATTACK_FOLLOW_MS: () => ATTACK_FOLLOW_MS,
  ATTACK_START: () => ATTACK_START,
  BIT_COUNT: () => BIT_COUNT,
  BIT_GRAVITY: () => BIT_GRAVITY,
  BIT_MS: () => BIT_MS,
  BOLT: () => BOLT,
  BOLT_HIT_R: () => BOLT_HIT_R,
  BOMB_ARC_MS: () => BOMB_ARC_MS,
  BOMB_BLAST_MS: () => BOMB_BLAST_MS,
  BOMB_PICKUP_CHANCE: () => BOMB_PICKUP_CHANCE,
  BOMB_RADIUS: () => BOMB_RADIUS,
  BOMB_RANGE: () => BOMB_RANGE,
  BONUS: () => BONUS,
  CAM_TAU_MS: () => CAM_TAU_MS,
  CHAIN_BREAK_MS: () => CHAIN_BREAK_MS,
  CHARGE_MS: () => CHARGE_MS,
  COLS: () => COLS,
  DEBRIS: () => DEBRIS,
  DEFAULT_MODE: () => DEFAULT_MODE,
  EASE: () => EASE,
  FLARE_MS: () => FLARE_MS,
  FORMATIONS: () => FORMATIONS,
  GHOST_MS: () => GHOST_MS,
  HITSTOP: () => HITSTOP,
  HIT_IFRAME_MS: () => HIT_IFRAME_MS,
  HIT_MS: () => HIT_MS,
  HIT_TIME_PENALTY: () => HIT_TIME_PENALTY,
  HOPPER_LIFE: () => HOPPER_LIFE,
  HOP_GROW_MS: () => HOP_GROW_MS,
  HOP_MS: () => HOP_MS,
  HURT_FLASH_MS: () => HURT_FLASH_MS,
  HURT_SHAKE_MS: () => HURT_SHAKE_MS,
  LANE_MS: () => LANE_MS,
  LOW_TIME: () => LOW_TIME,
  LOW_TIME_LULL_MS: () => LOW_TIME_LULL_MS,
  LULL_TIGHTEN_STAGE: () => LULL_TIGHTEN_STAGE,
  MAX_ALIVE: () => MAX_ALIVE,
  MAX_BITS: () => MAX_BITS,
  MAX_HITSTOP: () => MAX_HITSTOP,
  MET_HOP_MS: () => MET_HOP_MS,
  MODES: () => MODES,
  MOVE_REPEAT_MS: () => MOVE_REPEAT_MS,
  MUZZLE_MS: () => MUZZLE_MS,
  NARROW_ROAD_CHANCE: () => NARROW_ROAD_CHANCE,
  OC_SLOPE: () => OC_SLOPE,
  OC_START: () => OC_START,
  PCOLS: () => PCOLS,
  POPUP_MS: () => POPUP_MS,
  PTS: () => PTS,
  RARE_LIFE: () => RARE_LIFE,
  RAY_IMPACT_MS: () => RAY_IMPACT_MS,
  REFIRE_MS: () => REFIRE_MS,
  RING_GAP: () => RING_GAP,
  RIPPLE_MS: () => RIPPLE_MS,
  RISE_MS: () => RISE_MS,
  RM: () => RM,
  ROAD_COLS: () => ROAD_COLS,
  ROAD_END: () => ROAD_END,
  ROAD_MID_ROW: () => ROAD_MID_ROW,
  ROWS: () => ROWS,
  SENTINEL: () => SENTINEL,
  SENTINEL_CHARGED_DMG: () => SENTINEL_CHARGED_DMG,
  SHAKE: () => SHAKE,
  SINK_MS: () => SINK_MS,
  SPARK_MS: () => SPARK_MS,
  STAGES: () => STAGES,
  STAGE_BONUS: () => STAGE_BONUS,
  START_TIME: () => START_TIME,
  TAU: () => TAU,
  TIERS: () => TIERS,
  TIME_CAP: () => TIME_CAP,
  UNLOCK: () => UNLOCK,
  WAVE_CLEAR_LULL: () => WAVE_CLEAR_LULL,
  WAVE_CLEAR_PTS: () => WAVE_CLEAR_PTS,
  WAVE_GRACE_MS: () => WAVE_GRACE_MS,
  WAVE_SIZE: () => WAVE_SIZE,
  aimMs: () => aimMs,
  allyWaveChance: () => allyWaveChance,
  arenaPlan: () => arenaPlan,
  attackChance: () => attackChance,
  boltKindFor: () => boltKindFor,
  boltPanelMs: () => boltPanelMs,
  bonusFactor: () => bonusFactor,
  dodgeWindowMs: () => dodgeWindowMs,
  guardWaveChance: () => guardWaveChance,
  hopperWaveChance: () => hopperWaveChance,
  impulseValue: () => impulseValue,
  laneY: () => laneY,
  layout: () => layout,
  level: () => level,
  makeImpulse: () => makeImpulse,
  modeById: () => modeById,
  multOf: () => multOf,
  panelRect: () => panelRect,
  rareWaveChance: () => rareWaveChance,
  sentinelWaveChance: () => sentinelWaveChance,
  upMs: () => upMs,
  waveClearBonus: () => waveClearBonus,
  waveLullMs: () => waveLullMs,
  waveSize: () => waveSize,
  waveStaggerMs: () => waveStaggerMs
});
var ROWS = 3;
var COLS = 6;
var PCOLS = 3;
var ROAD_COLS = 3;
var ROAD_MID_ROW = 1;
var NARROW_ROAD_CHANCE = 0.5;
var ARENA_CLEAR_BONUS = 3;
var ARENA_CLEAR_PTS = 1500;
var ARENA_ENTRY_DELAY_MS = 650;
var CAM_TAU_MS = 170;
var ARENA_WAVE_GAP_MS = 550;
var REFIRE_MS = 1400;
function arenaPlan(idx) {
  const pool = Math.min(20, 4 + Math.floor(idx * 0.16));
  const waveSize2 = Math.min(5, 2 + Math.floor(idx / 25));
  return { pool, waveSize: waveSize2 };
}
var ROAD_END = 100;
var ADV_UNLOCK = {
  guard: 5,
  retaliate: 9,
  hopper: 15,
  sentinel1: 20,
  ally: 30,
  sentinel2: 40,
  swarm: 55,
  sentinel3: 70,
  unlimited: ROAD_END
};
var ADVANCE_STAGES = [
  { arena: ADV_UNLOCK.guard, title: "STEEL GUARDS" },
  { arena: ADV_UNLOCK.retaliate, title: "RETALIATION" },
  { arena: ADV_UNLOCK.hopper, title: "HOPPERS" },
  { arena: ADV_UNLOCK.sentinel1, title: "SENTINELS" },
  { arena: ADV_UNLOCK.ally, title: "PROGS ONLINE" },
  { arena: ADV_UNLOCK.sentinel2, title: "SENTINEL MK II" },
  { arena: ADV_UNLOCK.swarm, title: "SWARM" },
  { arena: ADV_UNLOCK.sentinel3, title: "SENTINEL MK III" },
  { arena: ADV_UNLOCK.unlimited, title: "UNLIMITED" }
];
var MET_HOP_MS = 1500;
var SENTINEL = {
  1: { hp: 1, openMs: 1400, closedMs: 1500 },
  2: { hp: 2, openMs: 1050, closedMs: 1250 },
  3: { hp: 3, openMs: 780, closedMs: 1050 }
};
var SENTINEL_CHARGED_DMG = 2;
var sentinelWaveChance = (idx) => Math.min(0.7, 0.35 + (idx - ADV_UNLOCK.sentinel1) * 6e-3);
var BOMB_RANGE = 3;
var BOMB_ARC_MS = 640;
var BOMB_RADIUS = 1;
var BOMB_PICKUP_CHANCE = 0.6;
var BOMB_BLAST_MS = 460;
var MODES = [
  { id: "advance", name: "ADVANCE", blurb: "take the road", advancing: true },
  { id: "classic", name: "CLASSIC", blurb: "hold the line", advancing: false }
];
var DEFAULT_MODE = "advance";
var modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];
var START_TIME = 30;
var TIME_CAP = 45;
var BONUS = { sentinel: 3, normal: 1.2, charged: 2.5, guard: 3, hopper: 1.8, rare: 8 };
var PTS = { sentinel: 500, normal: 100, charged: 300, guard: 400, hopper: 250, rare: 1e3 };
var ALLY_TIME_PENALTY = 3;
var ALLY_PTS_PENALTY = 200;
var ALLY_SPARE_BONUS = 0.5;
var CHARGE_MS = 700;
var RISE_MS = 220;
var SINK_MS = 180;
var HIT_MS = 280;
var MOVE_REPEAT_MS = 130;
var HOP_MS = 550;
var HOP_GROW_MS = 120;
var HOPPER_LIFE = 2200;
var RARE_LIFE = 650;
var ALLY_RISE_MS = 460;
var upMs = (del) => Math.max(520, 1250 - del * 18);
var level = (del) => 1 + Math.floor(del / 6);
var MAX_ALIVE = 6;
var WAVE_SIZE = [2, 2, 3, 3, 3, 4, 4, 4, 5];
var waveSize = (stageIdx) => WAVE_SIZE[Math.max(0, Math.min(WAVE_SIZE.length - 1, stageIdx))];
var waveStaggerMs = (w) => Math.max(170, 420 - w * 4);
var LULL_TIGHTEN_STAGE = 7;
var waveLullMs = (w, stage = 0) => Math.max(620, (1900 - w * 10) * (stage >= LULL_TIGHTEN_STAGE ? 0.7 : 1));
var WAVE_CLEAR_LULL = 0.62;
var LOW_TIME_LULL_MS = 420;
var waveClearBonus = (n) => 0.55 + 0.3 * n;
var WAVE_CLEAR_PTS = 60;
var WAVE_GRACE_MS = 900;
var FORMATIONS = [
  { name: "spine", anchor: 0, slots: [[4, 1], [4, 0], [4, 2], [3, 1], [5, 1]] },
  { name: "rank", anchor: 2, slots: [[5, 1], [4, 1], [3, 1], [5, 0], [5, 2]] },
  { name: "stagger", anchor: 4, slots: [[3, 0], [4, 1], [5, 2], [5, 0], [3, 2]] },
  { name: "pincer", anchor: 2, slots: [[3, 0], [3, 2], [4, 1], [5, 0], [5, 2]] },
  { name: "wall", anchor: 1, slots: [[5, 0], [5, 1], [5, 2], [4, 0], [4, 2]] },
  { name: "wedge", anchor: 0, slots: [[5, 1], [4, 0], [4, 2], [3, 1], [3, 0]] }
];
var UNLOCK = { guard: 1, retaliate: 2, ally: 3, hopper: 4, rare: 5 };
var guardWaveChance = (stage) => Math.min(0.8, 0.4 + (stage - UNLOCK.guard) * 0.08);
var hopperWaveChance = (stage) => Math.min(0.65, 0.35 + (stage - UNLOCK.hopper) * 0.08);
var allyWaveChance = (stage) => Math.min(0.45, 0.25 + (stage - UNLOCK.ally) * 0.05);
var rareWaveChance = (stage, timeLeft) => (0.05 + (stage - UNLOCK.rare) * 0.01) * (timeLeft < LOW_TIME * 2 ? 2.5 : 1);
var ATTACK_START = 12;
var HIT_TIME_PENALTY = 2.5;
var HIT_IFRAME_MS = 800;
var HURT_SHAKE_MS = 260;
var BOLT_HIT_R = 0.28;
var ATTACK_FOLLOW_MS = 300;
var BOLT = {
  slow: {
    radiusFrac: 0.19,
    aimMs: (del) => Math.max(340, 560 - Math.max(0, del - ATTACK_START) * 0.8),
    panelMs: (del) => Math.max(175, 300 - Math.max(0, del - ATTACK_START) * 0.45)
  },
  fast: {
    radiusFrac: 0.135,
    aimMs: (del) => Math.max(480, 780 - Math.max(0, del - ATTACK_START) * 1.1),
    panelMs: (del) => Math.max(72, 130 - Math.max(0, del - ATTACK_START) * 0.2)
  }
};
var dodgeWindowMs = (del, kind, panels = 3) => BOLT[kind].aimMs(del) + Math.max(0, panels - BOLT_HIT_R) * BOLT[kind].panelMs(del);
var boltKindFor = (type) => type === "hopper" ? "fast" : "slow";
var aimMs = (del, kind = "slow") => BOLT[kind].aimMs(del);
var boltPanelMs = (del, kind = "slow") => BOLT[kind].panelMs(del);
var attackChance = (del, type = "mett") => {
  if (del < ATTACK_START) return 0;
  const t = Math.max(0, del - ATTACK_START);
  return type === "hopper" ? Math.min(0.45, 0.18 + t * 3e-3) : Math.min(0.55, 0.24 + t * 4e-3);
};
var OC_START = 170;
var OC_SLOPE = 0.988;
var bonusFactor = (del) => del < OC_START ? 1 : Math.pow(OC_SLOPE, del - OC_START);
var multOf = (chain) => chain >= 20 ? 4 : chain >= 10 ? 3 : chain >= 5 ? 2 : 1;
var STAGES = [
  { wave: 16, at: 26, title: "STEEL GUARDS" },
  { wave: 28, at: 52, title: "RETALIATION" },
  { wave: 40, at: 78, title: "PROGS ONLINE" },
  { wave: 52, at: 105, title: "HOPPERS" },
  { wave: 64, at: 130, title: "RARE VIRUS" },
  { wave: 76, at: OC_START, title: "OVERCLOCK" },
  { wave: 90, at: 195, title: "SWARM" },
  { wave: 106, at: 235, title: "MAXIMUM LOAD" }
];
var STAGE_BONUS = 2;
var POPUP_MS = 650;
var SPARK_MS = 140;
var RAY_IMPACT_MS = 130;
var MUZZLE_MS = { normal: 95, charged: 140 };
var HURT_FLASH_MS = 190;
var TAU = Math.PI * 2;
var RING_GAP = 0.09;
var BIT_MS = 520;
var MAX_BITS = 96;
var BIT_GRAVITY = 16e-4;
var RIPPLE_MS = 300;
var FLARE_MS = 520;
var CHAIN_BREAK_MS = 620;
var GHOST_MS = 170;
var LANE_MS = 240;
var LOW_TIME = 6;
var HITSTOP = {
  normal: 26,
  charged: 52,
  guard: 46,
  hopper: 30,
  rare: 96,
  block: 12,
  stagger: 18,
  prog: 34,
  hurt: 70,
  chain: 26
};
var MAX_HITSTOP = 150;
var SHAKE = {
  normal: { amp: 3.5, ms: 120 },
  charged: { amp: 8, ms: 210 },
  guard: { amp: 7, ms: 190 },
  hopper: { amp: 4.5, ms: 150 },
  rare: { amp: 13, ms: 380 },
  prog: { amp: 6, ms: 220 },
  hurt: { amp: 9, ms: HURT_SHAKE_MS },
  chain: { amp: 6, ms: 260 }
};
var DEBRIS = {
  mett: ["#ffd23f", "#ffe89a", "#fff0c0"],
  guard: ["#dfe7fb", "#aeb9d6", "#c9f6ff"],
  hopper: ["#5ee87c", "#a6f5bb", "#c8ffd8"],
  ally: ["#58c7ff", "#a9defc", "#e2f4ff"],
  rare: ["#fff3c4", "#ffc95a", "#ffd23f"],
  player: ["#ff5470", "#ff9f45", "#ffd7de"]
};
var BIT_COUNT = {
  normal: 9,
  charged: 14,
  guard: 13,
  hopper: 11,
  rare: 22,
  block: 4,
  stagger: 5,
  prog: 8,
  hurt: 12
};
var RM = { shake: 0.12, flash: 0.35, strobe: 0 };
var EASE = {
  linear: (p) => p,
  out2: (p) => 1 - (1 - p) ** 2,
  out3: (p) => 1 - (1 - p) ** 3
};
function makeImpulse(spec, t0 = -Infinity) {
  return { spec, t0 };
}
function impulseValue(imp, now) {
  const sp = imp.spec;
  const attack = sp.attackMs || 0;
  const over = sp.overshoot || 0;
  const rebound = sp.reboundMs || sp.releaseMs * 0.9;
  const ease = EASE[sp.ease || "linear"];
  let t = now - imp.t0;
  if (t < 0) return 0;
  if (attack > 0 && t < attack) return t / attack;
  t -= attack;
  if (t < sp.releaseMs) return 1 - (1 + over) * ease(t / sp.releaseMs);
  t -= sp.releaseMs;
  if (over > 0 && t < rebound) return -over * (1 - EASE.out2(t / rebound));
  return 0;
}
var TIERS = {
  normal: {
    scale: { peak: 1.7, attackMs: 0, releaseMs: 100, ease: "out2", overshoot: 0.06, reboundMs: 80 },
    squash: { amt: 0.18, attackMs: 0, releaseMs: 110, ease: "out2", overshoot: 0.08, reboundMs: 90 },
    kick: { px: 14, attackMs: 0, releaseMs: 120, ease: "out3", overshoot: 0.15, reboundMs: 100 },
    recoil: { px: 6, attackMs: 0, releaseMs: 90, ease: "out2", overshoot: 0 }
  },
  charged: {
    scale: { peak: 2, attackMs: 0, releaseMs: 140, ease: "out3", overshoot: 0.12, reboundMs: 120 },
    squash: { amt: 0.3, attackMs: 0, releaseMs: 150, ease: "out3", overshoot: 0.15, reboundMs: 130 },
    kick: { px: 26, attackMs: 0, releaseMs: 160, ease: "out3", overshoot: 0.2, reboundMs: 130 },
    recoil: { px: 12, attackMs: 0, releaseMs: 130, ease: "out3", overshoot: 0.1 }
  }
};
function layout(w, h) {
  const gw = Math.min(w * 0.9, 760);
  const pw = gw / COLS;
  const ph = Math.min(pw * 0.62, (h - 180) / ROWS);
  return {
    w,
    h,
    pw,
    ph,
    gx: (w - pw * COLS) / 2,
    gy: h * 0.52 - ph * ROWS / 2
  };
}
function panelRect(G, col, row) {
  return { x: G.gx + col * G.pw, y: G.gy + row * G.ph, w: G.pw, h: G.ph };
}
function laneY(G, row) {
  return panelRect(G, 0, row).y + G.ph * 0.78 - G.ph * 1.15 * 0.42;
}

// src/core/world.js
var TILE = {
  PLAYER: "player",
  ENEMY: "enemy",
  ROAD: "road",
  VOID: "void"
};
function createWorld() {
  return {
    segs: [arena(0, 0)]
  };
}
function arena(x0, idx) {
  const plan = arenaPlan(idx);
  return {
    kind: "arena",
    x0,
    cols: COLS,
    idx,
    owner: "enemy",
    entered: idx === 0,
    // the guard: how many viruses hold this road, how many join at once, and
    // how many have been dealt so far. Only advance reads these.
    pool: plan.pool,
    waveSize: plan.waveSize,
    dealt: 0
  };
}
function activeArena(world) {
  for (let i = world.segs.length - 1; i >= 0; i--) {
    if (world.segs[i].kind === "arena") return world.segs[i];
  }
  return world.segs[0];
}
function segmentAt(world, wx) {
  if (wx < 0) return null;
  for (const s of world.segs) {
    if (wx >= s.x0 && wx < s.x0 + s.cols) return s;
  }
  return null;
}
function tileAt(world, wx, row) {
  if (row < 0 || row >= ROWS) return TILE.VOID;
  const s = segmentAt(world, wx);
  if (!s) return TILE.VOID;
  if (s.kind === "road") {
    return s.rows === ROWS || row === ROAD_MID_ROW ? TILE.ROAD : TILE.VOID;
  }
  if (s.owner === "player") return TILE.PLAYER;
  return wx - s.x0 < PCOLS ? TILE.PLAYER : TILE.ENEMY;
}
function walkable(world, wx, row) {
  const t = tileAt(world, wx, row);
  return t === TILE.PLAYER || t === TILE.ROAD;
}
function clearArena(world, rng) {
  const a = activeArena(world);
  a.owner = "player";
  const narrow = rng() < NARROW_ROAD_CHANCE;
  const road = {
    kind: "road",
    x0: a.x0 + a.cols,
    cols: ROAD_COLS,
    rows: narrow ? 1 : ROWS
  };
  const next = arena(road.x0 + road.cols, a.idx + 1);
  world.segs.push(road, next);
  return { cleared: a, road, next };
}

// src/core/rng.js
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// src/core/state.js
function createState(opts = {}) {
  const seed = opts.seed === void 0 ? 1 : opts.seed;
  return {
    rng: opts.rng || mulberry32(seed),
    seed,
    mode: "ready",
    // ready | playing | interlevel | over
    paused: false,
    // Accessibility, not a preference the sim reads: only `render.js` looks at
    // it. Safe default is "full motion"; the shell overwrites it.
    reducedMotion: !!opts.reducedMotion,
    // which mode this run is playing, and the world it plays on. See world.js:
    // classic is one arena that never clears to a road; advance grows.
    modeId: opts.modeId || DEFAULT_MODE,
    world: createWorld(),
    arenasCleared: 0,
    // camera, in world columns: the left edge of the view. The simulation
    // never reads it -- it lives here so it is deterministic and replayable,
    // and the renderer applies it as a translate. Classic keeps it at 0.
    cam: 0,
    // ADVANCE inventory and ordnance. Pickups live on road tiles; a bomb in
    // flight is { fromCol,fromRow,toCol,toRow,t0,dur }; blasts are fx.
    bombs: 0,
    bombsInFlight: [],
    pickups: [],
    // { col, row, kind }
    levelT0: -1e9,
    // when the level last changed (advance: arena entry)
    unlimited: false,
    // past ROAD_END: nothing held back
    camAnchor: 0,
    // x0 of the last arena entered: the camera's floor while following
    camClock: 0,
    // clock at the last camera ease, so the ease is dt-driven and replayable
    clock: 0,
    // game clock, advances only while playing and unpaused
    canFire: true,
    score: 0,
    best: opts.best || 0,
    deletions: 0,
    shots: 0,
    whiffs: 0,
    chain: 0,
    bestChain: 0,
    timeLeft: START_TIME,
    player: { col: 1, row: 1 },
    // { col,row,type,state,t0,hp, lastHop,hopT0, fx?,tier?, wave,
    //   willAttack,fired, boltKind,aimMs }
    enemies: [],
    // incoming fire: { row, x, speed, kind, radius, heavy }
    bolts: [],
    hurtUntil: -1e9,
    // i-frames, so one volley can't drain the clock
    nextSpawnAt: 0,
    // clock at which the next wave lands (Infinity = never)
    waveIdx: 0,
    // how many waves have started this run
    waveState: "lull",
    // lull | active
    wave: null,
    // the live formation, see planWave() in step.js
    stageIdx: 0,
    charge: { downAt: null, full: false },
    lastMoveAt: -1e9,
    rank: null,
    // hit-stop: freeze the simulation clock for `hitStopMs` once `clock`
    // reaches `hitStopAt` (which is when the tracer actually lands).
    hitStopAt: -1e9,
    hitStopMs: 0,
    G: layout(opts.width || 0, opts.height || 0),
    fx: {
      recoil: makeImpulse(TIERS.normal.recoil),
      muzzleT0: -1e9,
      muzzleTier: "normal",
      ray: { t0: -1e9, row: 0, hitCol: null, x0: 0, x1: 0, dur: 1, tier: "normal" },
      popups: [],
      sparks: [],
      bits: [],
      // debris: { x,y,vx,vy,g,t0,ms,size,color }
      ripples: [],
      // panel impact rings: { col,row,t0,ms,color,w }
      hurtT0: -1e9,
      shake: { t0: -1e9, ms: 0, amp: 0 },
      flare: { t0: -1e9, mult: 1, x: 0, y: 0 },
      chainBreak: { t0: -1e9, chain: 0, x: 0, y: 0, quiet: false },
      ghost: { t0: -1e9, col: 1, row: 1 },
      blasts: []
      // bomb splashes: { col,row,x,y,t0 }
    }
  };
}
function setLayout(state, width, height) {
  const old = state.G;
  const G = layout(width, height);
  state.G = G;
  if (old && old.pw > 0 && G.pw > 0 && (old.pw !== G.pw || old.ph !== G.ph || old.gx !== G.gx || old.gy !== G.gy)) {
    remap(state, old, G);
  }
  return G;
}
function remap(state, a, b) {
  const kx = b.pw / a.pw, ky = b.ph / a.ph;
  const mx = (x) => b.gx + (x - a.gx) * kx;
  const my = (y) => b.gy + (y - a.gy) * ky;
  for (const bolt of state.bolts) {
    bolt.x = mx(bolt.x);
    bolt.speed *= kx;
    if (bolt.radius) bolt.radius *= kx;
  }
  for (const pp of state.fx.popups) {
    pp.x = mx(pp.x);
    pp.y = my(pp.y);
  }
  for (const sp of state.fx.sparks) {
    sp.x = mx(sp.x);
    sp.y = my(sp.y);
  }
  for (const bit of state.fx.bits) {
    bit.x = mx(bit.x);
    bit.y = my(bit.y);
    bit.vx *= kx;
    bit.vy *= ky;
    bit.g *= ky;
    bit.size *= Math.min(kx, ky);
  }
  const ray = state.fx.ray;
  ray.x0 = mx(ray.x0);
  ray.x1 = mx(ray.x1);
  const flare = state.fx.flare;
  flare.x = mx(flare.x);
  flare.y = my(flare.y);
  const cb = state.fx.chainBreak;
  cb.x = mx(cb.x);
  cb.y = my(cb.y);
}

// src/core/select.js
function accuracy(state) {
  return state.shots ? 1 - state.whiffs / state.shots : 0;
}
function accuracyText(state) {
  return state.shots ? Math.round(accuracy(state) * 100) + "%" : "\u2014";
}
function computeRank(state) {
  const acc = accuracy(state);
  if (acc >= 0.75 && state.bestChain >= 20) return "S";
  if (acc >= 0.6 && state.bestChain >= 10) return "A";
  if (acc >= 0.45) return "B";
  if (acc >= 0.3) return "C";
  return "D";
}
function statsView(state) {
  return {
    deletions: String(state.deletions),
    bestChain: String(state.bestChain),
    accuracy: accuracyText(state),
    best: String(state.best)
  };
}
function hudView(state) {
  const oc = state.deletions >= OC_START;
  return {
    score: String(state.score).padStart(6, "0"),
    chain: state.chain,
    mult: multOf(state.chain),
    // advance counts arenas: the level is where you are on the road
    level: modeById(state.modeId).advancing ? activeArena(state.world).idx + 1 : level(state.deletions),
    unlimited: !!state.unlimited,
    bombs: state.bombs || 0,
    timeLeft: state.timeLeft,
    timeFrac: Math.max(0, Math.min(1, state.timeLeft / TIME_CAP)),
    overclock: oc,
    overclockFactor: bonusFactor(state.deletions),
    paused: state.paused,
    mode: state.mode
  };
}
function interlevelView(state, stage, stageBonus) {
  return {
    eyebrow: "",
    title: stage.title,
    sub: "",
    rows: [
      ["score", String(state.score).padStart(6, "0"), "big"],
      ["deletions", state.deletions],
      ["best chain", state.bestChain],
      ["accuracy", accuracyText(state)],
      ["stage bonus", "+" + stageBonus.toFixed(1) + "s"],
      ["time left", state.timeLeft.toFixed(1) + "s"]
    ]
  };
}
function gameOverView(state) {
  return {
    eyebrow: "run complete",
    title: state.rank,
    rank: true,
    sub: state.deletions >= OC_START ? "overclock reached \xD7" + bonusFactor(state.deletions).toFixed(2) : "",
    rows: [
      ["score", state.score + " pts", "big"],
      ["deletions", state.deletions],
      ["accuracy", accuracyText(state)],
      ["best chain", state.bestChain],
      ["best score", state.best]
    ]
  };
}

// src/core/step.js
var panel = (state, col, row) => panelRect(state.G, col, row);
function step(state, dtMs, intents = {}) {
  const events = [];
  const actions = Array.isArray(intents) ? intents : intents.actions || [];
  const hold = Array.isArray(intents) ? null : intents.hold;
  for (const a of actions) applyIntent(state, a, events);
  let adv = dtMs;
  if (state.mode === "playing" && !state.paused && state.hitStopMs > 0 && state.clock >= state.hitStopAt) {
    const used = Math.min(state.hitStopMs, adv);
    state.hitStopMs -= used;
    adv -= used;
  }
  if (state.mode === "playing" && !state.paused) {
    state.clock += adv;
    state.timeLeft -= dtMs / 1e3;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      gameOver(state, events);
    }
    if (state.charge.downAt !== null && !state.charge.full && state.clock - state.charge.downAt >= CHARGE_MS) {
      state.charge.full = true;
      events.push({ type: "chargeReady" });
    }
  }
  if (hold && (hold.dc || hold.dr)) move(state, hold.dc, hold.dr, events);
  updateEnemies(state, events);
  updateBolts(state, adv, events);
  checkStageGate(state, events);
  cullFx(state);
  return events;
}
function hitStop(state, at, ms) {
  if (state.hitStopMs <= 0) {
    state.hitStopAt = at;
    state.hitStopMs = Math.min(MAX_HITSTOP, ms);
    return;
  }
  state.hitStopAt = Math.min(state.hitStopAt, at);
  state.hitStopMs = Math.min(MAX_HITSTOP, state.hitStopMs + ms);
}
function shake(state, spec, at, scale = 1) {
  const sh = state.fx.shake;
  const t = at - sh.t0;
  const remaining = t >= 0 && t < sh.ms ? sh.amp * (1 - t / sh.ms) : 0;
  const amp = spec.amp * scale;
  if (amp < remaining) return;
  sh.t0 = at;
  sh.ms = spec.ms;
  sh.amp = amp;
}
function spawnBits(state, x, y, n, palette, opts = {}) {
  const bits = state.fx.bits;
  const t0 = opts.at === void 0 ? state.clock : opts.at;
  const dir = opts.dir === void 0 ? -Math.PI / 2 : opts.dir;
  const spread = opts.spread === void 0 ? 1 : opts.spread;
  const speed = opts.speed === void 0 ? 0.24 : opts.speed;
  const g = opts.g === void 0 ? BIT_GRAVITY : opts.g;
  for (let i = 0; i < n; i++) {
    const a = dir + (state.rng() - 0.5) * Math.PI * spread;
    const v = speed * (0.45 + state.rng());
    bits.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      g,
      t0,
      ms: opts.ms || BIT_MS,
      size: 3 + state.rng() * 4.6,
      color: palette[Math.floor(state.rng() * palette.length)]
    });
  }
  const over = bits.length - MAX_BITS;
  if (over > 0) bits.splice(0, over);
}
function ripple(state, col, row, color, at, w = 1) {
  state.fx.ripples.push({ col, row, color, w, t0: at, ms: RIPPLE_MS });
  if (state.fx.ripples.length > 12) state.fx.ripples.shift();
}
function applyIntent(state, action, events) {
  switch (action.type) {
    case "firePressed":
      firePressed(state, events);
      break;
    case "fireReleased":
      fireReleased(state, events);
      break;
    case "move":
      move(state, action.dc, action.dr, events);
      break;
    case "resetMoveThrottle":
      state.lastMoveAt = -1e9;
      break;
    case "pause":
      togglePause(state, events);
      break;
    case "pauseOnBlur":
      if (state.mode === "playing" && !state.paused) togglePause(state, events);
      break;
    case "startRun":
      resetGame(state, events, action.modeId);
      break;
    case "bomb":
      throwBomb(state, events);
      break;
    case "resume":
      resumeFromInterlevel(state, events);
      break;
    case "endRun":
      gameOver(state, events);
      break;
    default:
      break;
  }
}
function firePressed(state, events) {
  if (!state.canFire) return;
  state.canFire = false;
  if (state.mode === "ready" || state.mode === "over") {
    resetGame(state, events);
    return;
  }
  if (state.mode === "interlevel") {
    resumeFromInterlevel(state, events);
    return;
  }
  if (state.paused) return;
  shoot(state, "normal", events);
  state.charge.downAt = state.clock;
  state.charge.full = false;
}
function fireReleased(state, events) {
  if (state.canFire) return;
  state.canFire = true;
  if (state.charge.downAt !== null && state.charge.full && state.mode === "playing" && !state.paused) {
    shoot(state, "charged", events);
  }
  state.charge.downAt = null;
  state.charge.full = false;
}
function move(state, dc, dr, events) {
  if (state.mode !== "playing" || state.paused) return;
  if (state.clock - state.lastMoveAt < MOVE_REPEAT_MS) return;
  state.lastMoveAt = state.clock;
  const world = state.world;
  const wall = Math.floor(state.cam || 0);
  let col = state.player.col, row = state.player.row;
  const sc = Math.sign(dc), sr = Math.sign(dr);
  for (let i = 0; i < Math.abs(dc); i++) {
    if (col + sc < wall || !walkable(world, col + sc, row)) break;
    col += sc;
  }
  for (let i = 0; i < Math.abs(dr); i++) {
    const nr = row + sr;
    if (nr < 0 || nr >= ROWS || !walkable(world, col, nr)) break;
    row = nr;
  }
  const moved = col !== state.player.col || row !== state.player.row;
  if (moved) {
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pk = state.pickups[i];
      if (pk.col !== col || pk.row !== row) continue;
      state.pickups.splice(i, 1);
      if (pk.kind === "bomb") state.bombs++;
      const pp = panel(state, col, row);
      state.fx.popups.push({ x: pp.x + pp.w / 2, y: pp.y - 8, t0: state.clock, text: "+BOMB", color: "#ff9f45" });
      events.push({ type: "pickup", kind: pk.kind, col, row, x: pp.x + pp.w / 2, y: pp.y, bombs: state.bombs });
      events.push({ type: "statsChanged" });
    }
    state.fx.ghost.t0 = state.clock;
    state.fx.ghost.col = state.player.col;
    state.fx.ghost.row = state.player.row;
  }
  state.player.col = col;
  state.player.row = row;
  if (moved) events.push({ type: "playerMoved", col, row });
}
function togglePause(state, events) {
  if (state.mode !== "playing") return;
  state.paused = !state.paused;
  if (state.paused) {
    state.charge.downAt = null;
    state.charge.full = false;
  }
  events.push({ type: state.paused ? "paused" : "unpaused" });
}
function resetGame(state, events, modeId) {
  const cfg = modeById(modeId || state.modeId);
  state.modeId = cfg.id;
  state.world = createWorld();
  state.arenasCleared = 0;
  state.bombs = 0;
  state.bombsInFlight.length = 0;
  state.pickups.length = 0;
  state.fx.blasts.length = 0;
  state.levelT0 = -1e9;
  state.unlimited = false;
  state.cam = 0;
  state.camAnchor = 0;
  state.camClock = state.clock;
  state.mode = "playing";
  state.paused = false;
  state.score = 0;
  state.deletions = 0;
  state.shots = 0;
  state.whiffs = 0;
  state.chain = 0;
  state.bestChain = 0;
  state.timeLeft = START_TIME;
  state.player.col = 1;
  state.player.row = 1;
  state.enemies.length = 0;
  state.nextSpawnAt = state.clock + 500;
  state.waveIdx = 0;
  state.waveState = "lull";
  state.wave = null;
  state.stageIdx = 0;
  clearFx(state);
  state.bolts.length = 0;
  state.hurtUntil = -1e9;
  state.rank = null;
  events.push({ type: "runStarted", modeId: cfg.id });
  events.push({ type: "statsChanged" });
}
function gameOver(state, events) {
  state.mode = "over";
  state.rank = computeRank(state);
  const newBest = state.score > state.best;
  if (newBest) state.best = state.score;
  state.enemies.length = 0;
  state.bolts.length = 0;
  state.wave = null;
  state.waveState = "lull";
  state.charge.downAt = null;
  state.charge.full = false;
  state.hitStopMs = 0;
  events.push({
    type: "gameOver",
    score: state.score,
    rank: state.rank,
    deletions: state.deletions,
    bestChain: state.bestChain,
    best: state.best,
    newBest
  });
  events.push({ type: "statsChanged" });
}
function checkStageGate(state, events) {
  if (state.mode !== "playing" || state.paused) return;
  if (modeById(state.modeId).advancing) return;
  const st = STAGES[state.stageIdx];
  if (!st) return;
  if (state.waveIdx >= st.wave && state.deletions >= st.at) enterInterlevel(state, events);
}
function enterInterlevel(state, events) {
  const stage = STAGES[state.stageIdx];
  const index = state.stageIdx;
  state.stageIdx++;
  state.mode = "interlevel";
  state.charge.downAt = null;
  state.charge.full = false;
  state.bolts.length = 0;
  state.hitStopMs = 0;
  state.timeLeft = Math.min(TIME_CAP, state.timeLeft + STAGE_BONUS);
  events.push({
    type: "stageGate",
    stage,
    index,
    title: stage.title,
    timeBonus: STAGE_BONUS
  });
  events.push({ type: "statsChanged" });
}
function updateWorld(state, events) {
  const now = state.clock;
  const a = activeArena(state.world);
  if (!a.entered && state.player.col >= a.x0) {
    a.entered = true;
    state.camAnchor = a.x0;
    state.nextSpawnAt = now + ARENA_ENTRY_DELAY_MS;
    state.levelT0 = now;
    events.push({ type: "arenaEntered", index: a.idx, x0: a.x0 });
    if (a.idx >= ROAD_END) state.unlimited = true;
    const st = ADVANCE_STAGES.find((x) => x.arena === a.idx);
    if (st) showCard(state, events, st, ADVANCE_STAGES.indexOf(st));
  }
  const fighting = a.entered && a.owner === "enemy";
  const want = fighting ? a.x0 : Math.min(a.x0, state.player.col - 1);
  state.camAnchor = Math.max(state.camAnchor, want);
  const target = state.camAnchor;
  const dt = Math.max(0, now - state.camClock);
  state.camClock = now;
  const d = target - state.cam;
  if (Math.abs(d) < 2e-3) state.cam = target;
  else state.cam += d * (1 - Math.exp(-dt / CAM_TAU_MS));
}
function showCard(state, events, stage, index) {
  state.mode = "interlevel";
  state.charge.downAt = null;
  state.charge.full = false;
  state.bolts.length = 0;
  state.timeLeft = Math.min(TIME_CAP, state.timeLeft + STAGE_BONUS);
  events.push({ type: "stageGate", stage, index, title: stage.title, timeBonus: STAGE_BONUS });
  events.push({ type: "statsChanged" });
}
function resumeFromInterlevel(state, events) {
  if (state.mode !== "interlevel") return;
  state.mode = "playing";
  state.nextSpawnAt = state.clock + 700;
  if (state.wave) for (const slot of state.wave.queue) slot.at += 700;
  events.push({ type: "resumed" });
}
function freePanels(state, excludeCol, excludeRow) {
  const occ = new Set(state.enemies.map((e) => e.col + "," + e.row));
  const out = [];
  const a = activeArena(state.world);
  if (a.owner !== "enemy") return out;
  for (let c = a.x0 + PCOLS; c < a.x0 + a.cols; c++)
    for (let r = 0; r < ROWS; r++) {
      if (c === excludeCol && r === excludeRow) continue;
      if (!occ.has(c + "," + r)) out.push([c, r]);
    }
  return out;
}
function freeSlot(state, planned) {
  const taken = new Set(planned.map((s) => s.col + "," + s.row));
  const free = freePanels(state).filter(([c, r]) => !taken.has(c + "," + r));
  if (!free.length) return null;
  const [col, row] = free[Math.floor(state.rng() * free.length)];
  return { col, row };
}
var canRetaliate = (type) => type === "mett" || type === "hopper" || type === "sentinel";
function unlocked(state, key) {
  if (modeById(state.modeId).advancing) {
    const at = ADV_UNLOCK[key];
    return at !== void 0 && activeArena(state.world).idx >= at;
  }
  return state.stageIdx >= (UNLOCK[key] === void 0 ? Infinity : UNLOCK[key]);
}
function sentinelMark(state) {
  if (unlocked(state, "sentinel3")) return 3;
  if (unlocked(state, "sentinel2")) return 2;
  if (unlocked(state, "sentinel1")) return 1;
  return 0;
}
function planWave(state) {
  const now = state.clock;
  const idx = state.waveIdx;
  const stage = state.stageIdx;
  let size = waveSize(stage);
  const form = FORMATIONS[Math.floor(state.rng() * FORMATIONS.length)];
  const rot = Math.floor(state.rng() * ROWS);
  const stagger = waveStaggerMs(idx);
  const arena2 = activeArena(state.world);
  const ax0 = arena2.x0;
  const advancing = modeById(state.modeId).advancing;
  if (advancing) {
    size = Math.min(arena2.waveSize, arena2.pool - arena2.dealt, MAX_ALIVE);
    arena2.dealt += size;
  }
  const chanceStage = advancing ? Math.min(STAGES.length, Math.floor(arena2.idx / 8)) : stage;
  const slots = [];
  for (let i = 0; i < size; i++) {
    const [col, row] = form.slots[i];
    slots.push({
      col: col + ax0,
      row: (row + rot) % ROWS,
      type: "mett",
      at: now + i * stagger,
      persistent: advancing
    });
  }
  if (unlocked(state, "guard") && form.anchor < slots.length && state.rng() < guardWaveChance(chanceStage)) {
    slots[form.anchor].type = "guard";
  }
  if (unlocked(state, "hopper")) {
    const wanted = size >= 4 && state.rng() < 0.35 ? 2 : 1;
    for (let k = 0; k < wanted; k++) {
      if (state.rng() >= hopperWaveChance(chanceStage)) continue;
      const plain = slots.filter((s) => s.type === "mett");
      if (!plain.length) break;
      plain[Math.floor(state.rng() * plain.length)].type = "hopper";
    }
  }
  const mark = advancing ? sentinelMark(state) : 0;
  if (mark && state.rng() < sentinelWaveChance(arena2.idx)) {
    const plain = slots.filter((s) => s.type === "mett");
    if (plain.length) {
      const pick = plain[Math.floor(state.rng() * plain.length)];
      pick.type = "sentinel";
      pick.tier = mark > 1 && state.rng() < 0.35 ? mark - 1 : mark;
    }
  }
  if (unlocked(state, "ally") && state.rng() < allyWaveChance(chanceStage)) {
    const spot = freeSlot(state, slots);
    if (spot) slots.push({ ...spot, type: "ally", at: now + slots.length * stagger });
  }
  if (!advancing && unlocked(state, "rare") && state.rng() < rareWaveChance(stage, state.timeLeft)) {
    const spot = freeSlot(state, slots);
    if (spot) {
      for (const s of slots) s.at += RARE_LIFE * 0.5;
      slots.unshift({ ...spot, type: "rare", at: now });
    }
  }
  const virusCount = slots.reduce((n, s) => n + (s.type === "ally" ? 0 : 1), 0);
  return {
    index: idx,
    formation: form.name,
    size: slots.length,
    virusCount,
    kills: 0,
    startedAt: now,
    // only ever used to stop a jammed queue from stalling the run
    deadline: now + slots.length * stagger + HOPPER_LIFE + WAVE_GRACE_MS,
    queue: slots
  };
}
function startWave(state, events) {
  const wave = planWave(state);
  state.waveIdx++;
  state.wave = wave;
  state.waveState = "active";
  events.push({
    type: "waveStart",
    index: wave.index,
    size: wave.size,
    virusCount: wave.virusCount,
    formation: wave.formation
  });
}
function spawnFromSlot(state, slot, events) {
  const now = state.clock;
  const type = slot.type;
  const boltKind = boltKindFor(type);
  const armed = unlocked(state, "retaliate") && canRetaliate(type);
  const tier = slot.tier || 0;
  const sent = type === "sentinel" ? SENTINEL[tier] || SENTINEL[1] : null;
  const willAttack = slot.persistent ? armed : armed && state.rng() < attackChance(state.deletions, type);
  state.enemies.push({
    col: slot.col,
    row: slot.row,
    type,
    state: "rising",
    t0: now,
    persistent: !!slot.persistent,
    refireAt: Infinity,
    riseMs: type === "ally" ? ALLY_RISE_MS : RISE_MS,
    hp: sent ? sent.hp : type === "hopper" ? 2 : 1,
    tier,
    lastHop: now,
    hopT0: -1e9,
    wave: state.wave ? state.wave.index : -1,
    willAttack,
    // baked at spawn so the telegraph a virus is drawing cannot change length
    // underneath it when the deletion count ticks over mid-aim
    boltKind,
    aimMs: sent ? sent.openMs : aimMs(state.deletions, boltKind),
    fired: false
  });
  const p = panel(state, slot.col, slot.row);
  events.push({
    type: "enemySpawned",
    enemyType: type,
    col: slot.col,
    row: slot.row,
    willAttack,
    boltKind: willAttack ? boltKind : null,
    x: p.x + p.w / 2,
    y: p.y
  });
}
function endWave(state, events) {
  const wave = state.wave;
  const now = state.clock;
  const cleared = wave.virusCount > 0 && wave.kills >= wave.virusCount;
  let lull = waveLullMs(wave.index, state.stageIdx);
  if (cleared) lull *= WAVE_CLEAR_LULL;
  if (state.timeLeft < LOW_TIME) lull = Math.min(lull, LOW_TIME_LULL_MS);
  lull = Math.round(lull);
  let timeBonus = 0, points = 0;
  if (cleared) {
    timeBonus = waveClearBonus(wave.virusCount) * bonusFactor(state.deletions);
    state.timeLeft = Math.min(TIME_CAP, state.timeLeft + timeBonus);
    points = WAVE_CLEAR_PTS * wave.virusCount * multOf(state.chain);
    state.score += points;
    const p = panel(state, state.player.col, state.player.row);
    state.fx.popups.push({
      x: p.x + p.w / 2,
      y: p.y - 22,
      t0: now,
      text: "WAVE CLEAR +" + timeBonus.toFixed(1) + "s",
      color: "#45e0e8"
    });
  }
  state.waveState = "lull";
  state.nextSpawnAt = now + lull;
  state.wave = null;
  if (cleared && modeById(state.modeId).advancing) {
    const guard = activeArena(state.world);
    if (guard.dealt < guard.pool) {
      state.nextSpawnAt = now + ARENA_WAVE_GAP_MS;
      events.push({
        type: "waveEnded",
        index: wave.index,
        size: wave.size,
        virusCount: wave.virusCount,
        kills: wave.kills,
        cleared,
        timeBonus: 0,
        points: 0,
        lullMs: ARENA_WAVE_GAP_MS
      });
      return;
    }
    const { cleared: a, road, next } = clearArena(state.world, state.rng);
    state.arenasCleared++;
    if (a.idx === 0 || state.rng() < BOMB_PICKUP_CHANCE) {
      const pc = road.x0 + Math.floor(state.rng() * road.cols);
      const pr = road.rows === 1 ? ROAD_MID_ROW : Math.floor(state.rng() * ROWS);
      state.pickups.push({ col: pc, row: pr, kind: "bomb" });
      const pp = panel(state, pc, pr);
      events.push({ type: "pickupSpawned", kind: "bomb", col: pc, row: pr, x: pp.x + pp.w / 2, y: pp.y });
    }
    state.timeLeft = Math.min(TIME_CAP, state.timeLeft + ARENA_CLEAR_BONUS);
    state.score += ARENA_CLEAR_PTS;
    state.nextSpawnAt = Infinity;
    events.push({
      type: "arenaCleared",
      index: a.idx,
      x0: a.x0,
      roadRows: road.rows,
      nextX0: next.x0,
      timeBonus: ARENA_CLEAR_BONUS,
      points: ARENA_CLEAR_PTS
    });
  }
  events.push({
    type: "waveEnded",
    index: wave.index,
    size: wave.size,
    virusCount: wave.virusCount,
    kills: wave.kills,
    cleared,
    timeBonus,
    points,
    lullMs: lull
  });
  if (cleared) events.push({ type: "statsChanged" });
}
function updateWave(state, events) {
  const now = state.clock;
  updateWorld(state, events);
  updateBombs(state, events);
  if (state.waveState !== "active" || !state.wave) {
    if (now < state.nextSpawnAt) return;
    startWave(state, events);
  }
  const wave = state.wave;
  const queue = wave.queue;
  for (let i = 0; i < queue.length; ) {
    const slot = queue[i];
    if (slot.at > now) {
      i++;
      continue;
    }
    let busy = false;
    for (const e of state.enemies) {
      if (e.col === slot.col && e.row === slot.row) {
        busy = true;
        break;
      }
    }
    if (busy || state.enemies.length >= MAX_ALIVE) {
      if (now >= wave.deadline) {
        queue.splice(i, 1);
        continue;
      }
      slot.at = now + 90;
      i++;
      continue;
    }
    queue.splice(i, 1);
    spawnFromSlot(state, slot, events);
  }
  if (queue.length) return;
  for (const e of state.enemies) {
    if (e.wave === wave.index && e.state !== "hit") return;
  }
  endWave(state, events);
}
function lifeOf(state, e) {
  if (e.persistent) return Infinity;
  if (e.type === "rare") return RARE_LIFE;
  const base = e.type === "hopper" ? HOPPER_LIFE : upMs(state.deletions);
  if (!e.willAttack) return base;
  return Math.max(base, aimOf(state, e) + ATTACK_FOLLOW_MS);
}
var aimOf = (state, e) => e.aimMs === void 0 ? aimMs(state.deletions, e.boltKind || boltKindFor(e.type)) : e.aimMs;
function updateEnemies(state, events) {
  if (state.mode !== "playing" || state.paused) return;
  const now = state.clock;
  updateWave(state, events);
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const t = now - e.t0;
    switch (e.state) {
      case "rising":
        if (t >= (e.riseMs || RISE_MS)) {
          e.state = "up";
          e.t0 = now;
          e.lastHop = now;
          if (e.willAttack) {
            const p = panel(state, e.col, e.row);
            events.push({
              type: "enemyAim",
              enemyType: e.type,
              col: e.col,
              row: e.row,
              x: p.x + p.w / 2,
              y: p.y
            });
          }
        }
        break;
      case "up": {
        if ((e.persistent || e.type === "sentinel") && e.fired && now >= e.refireAt) {
          e.fired = false;
          e.t0 = now;
          events.push({ type: "enemyAim", col: e.col, row: e.row, boltKind: e.boltKind });
          break;
        }
        const aiming = e.willAttack && !e.fired;
        const hopEvery = e.type === "hopper" ? HOP_MS : e.type === "mett" && e.persistent ? MET_HOP_MS : Infinity;
        if (!aiming && now - e.lastHop >= hopEvery) {
          hopTo(state, e, events);
          e.lastHop = now;
        }
        if (aiming && t >= aimOf(state, e)) {
          fireBolt(state, e, events);
          e.fired = true;
          e.refireAt = now + (e.type === "sentinel" ? (SENTINEL[e.tier] || SENTINEL[1]).closedMs : REFIRE_MS);
        }
        if (t >= lifeOf(state, e)) {
          e.state = "sinking";
          e.t0 = now;
        }
        break;
      }
      case "sinking":
        if (t >= SINK_MS) {
          if (e.type === "ally") {
            state.timeLeft = Math.min(TIME_CAP, state.timeLeft + ALLY_SPARE_BONUS);
            const p = panel(state, e.col, e.row);
            state.fx.popups.push({
              x: p.x + p.w / 2,
              y: p.y,
              t0: now,
              text: "spared +" + ALLY_SPARE_BONUS.toFixed(1) + "s",
              color: "#58c7ff"
            });
            events.push({
              type: "allySpared",
              col: e.col,
              row: e.row,
              x: p.x + p.w / 2,
              y: p.y,
              timeBonus: ALLY_SPARE_BONUS
            });
          }
          events.push({ type: "enemyEscaped", enemyType: e.type, col: e.col, row: e.row });
          state.enemies.splice(i, 1);
        }
        break;
      case "hit":
        if (t >= HIT_MS) state.enemies.splice(i, 1);
        break;
    }
  }
}
function hopTo(state, e, events) {
  const free = freePanels(state, e.col, e.row);
  if (!free.length) return;
  const [c, r] = free[Math.floor(state.rng() * free.length)];
  e.hopFromCol = e.col;
  e.hopFromRow = e.row;
  e.col = c;
  e.row = r;
  e.hopT0 = state.clock;
  const p = panel(state, c, r);
  events.push({ type: "hopperHop", col: c, row: r, x: p.x + p.w / 2, y: p.y });
}
function fireBolt(state, e, events) {
  const p = panel(state, e.col, e.row);
  const kind = e.boltKind || boltKindFor(e.type);
  state.bolts.push({
    row: e.row,
    x: p.x + p.w / 2,
    speed: state.G.pw / boltPanelMs(state.deletions, kind),
    // px per ms, travelling left
    kind,
    radius: state.G.pw * BOLT[kind].radiusFrac,
    heavy: kind === "slow"
  });
  events.push({
    type: "enemyFired",
    enemyType: e.type,
    col: e.col,
    row: e.row,
    kind,
    heavy: kind === "slow",
    x: p.x + p.w / 2,
    y: p.y
  });
}
function updateBolts(state, dt, events) {
  if (state.mode !== "playing" || state.paused) return;
  const now = state.clock;
  const G = state.G;
  const pr = panel(state, state.player.col, state.player.row);
  const px = pr.x + pr.w / 2;
  const hitR = G.pw * BOLT_HIT_R;
  for (let i = state.bolts.length - 1; i >= 0; i--) {
    const b = state.bolts[i];
    b.x -= b.speed * dt;
    if (b.row === state.player.row && now >= state.hurtUntil && Math.abs(b.x - px) <= hitR) {
      state.bolts.splice(i, 1);
      takeHit(state, events);
      continue;
    }
    if (b.x < G.gx + (activeArena(state.world).x0 - 0.5) * G.pw) state.bolts.splice(i, 1);
  }
}
function throwBomb(state, events) {
  if (state.mode !== "playing" || state.paused) return;
  if (state.bombs <= 0) return;
  const now = state.clock;
  const a = activeArena(state.world);
  const toCol = Math.min(state.player.col + BOMB_RANGE, a.x0 + a.cols - 1);
  state.bombs--;
  state.bombsInFlight.push({
    fromCol: state.player.col,
    fromRow: state.player.row,
    toCol,
    toRow: state.player.row,
    t0: now,
    dur: BOMB_ARC_MS
  });
  const p = panel(state, state.player.col, state.player.row);
  events.push({
    type: "bombThrown",
    col: state.player.col,
    row: state.player.row,
    toCol,
    x: p.x + p.w / 2,
    y: p.y,
    bombs: state.bombs
  });
  events.push({ type: "statsChanged" });
}
function updateBombs(state, events) {
  const now = state.clock;
  for (let i = state.bombsInFlight.length - 1; i >= 0; i--) {
    const b = state.bombsInFlight[i];
    if (now < b.t0 + b.dur) continue;
    state.bombsInFlight.splice(i, 1);
    detonate(state, b.toCol, b.toRow, events);
  }
  const bl = state.fx.blasts;
  for (let i = bl.length - 1; i >= 0; i--) if (now - bl[i].t0 > BOMB_BLAST_MS) bl.splice(i, 1);
}
function detonate(state, col, row, events) {
  const now = state.clock;
  const R = BOMB_RADIUS;
  const p = panel(state, col, row);
  const cx = p.x + p.w / 2, cy = p.y + p.h * 0.5;
  let kills = 0;
  for (const e of state.enemies.slice()) {
    if (Math.abs(e.col - col) > R || Math.abs(e.row - row) > R) continue;
    if (!(e.state === "rising" || e.state === "up" || e.state === "sinking")) continue;
    if (e.type === "ally") {
      e.state = "hit";
      e.t0 = now;
      hitFx(e, TIERS.charged, now);
      state.whiffs++;
      breakChain(state, events, "prog");
      state.timeLeft = Math.max(0, state.timeLeft - ALLY_TIME_PENALTY);
      state.score = Math.max(0, state.score - ALLY_PTS_PENALTY);
      const ep = panel(state, e.col, e.row);
      state.fx.popups.push({
        x: ep.x + ep.w / 2,
        y: ep.y - 8,
        t0: now,
        text: "PROG HIT \u2212" + ALLY_TIME_PENALTY.toFixed(1) + "s",
        color: "#ff5470"
      });
      events.push({
        type: "progHit",
        tier: "charged",
        col: e.col,
        row: e.row,
        x: ep.x + ep.w / 2,
        y: ep.y,
        timePenalty: ALLY_TIME_PENALTY,
        pointsPenalty: ALLY_PTS_PENALTY
      });
      continue;
    }
    if (e.type === "sentinel") {
      const open = e.willAttack ? !e.fired : true;
      if (!open) continue;
      if (e.hp > SENTINEL_CHARGED_DMG) {
        e.hp -= SENTINEL_CHARGED_DMG;
        const ep = panel(state, e.col, e.row);
        events.push({ type: "sentinelHit", col: e.col, row: e.row, x: ep.x + ep.w / 2, y: ep.y, hp: e.hp });
        continue;
      }
    }
    deleteEnemy(state, e, "charged", now, events);
    kills++;
  }
  if (Math.abs(state.player.col - col) <= R && Math.abs(state.player.row - row) <= R && now >= state.hurtUntil) {
    takeHit(state, events);
  }
  for (let dc = -R; dc <= R; dc++) for (let dr = -R; dr <= R; dr++) {
    const r = row + dr;
    if (r < 0 || r >= ROWS) continue;
    ripple(state, col + dc, r, "#ff9f45", now, dc === 0 && dr === 0 ? 4 : 2);
  }
  spawnBits(state, cx, cy, 28, DEBRIS.rare, { at: now, speed: 0.42, spread: 2.2, ms: 620 });
  shake(state, SHAKE.rare || SHAKE.normal, now, 1.3);
  hitStop(state, now, HITSTOP.rare || HITSTOP.normal);
  state.fx.blasts.push({ col, row, x: cx, y: cy, t0: now });
  events.push({ type: "bombBlast", col, row, x: cx, y: cy, kills });
}
function takeHit(state, events) {
  const now = state.clock;
  state.hurtUntil = now + HIT_IFRAME_MS;
  state.fx.hurtT0 = now;
  state.timeLeft = Math.max(0, state.timeLeft - HIT_TIME_PENALTY);
  breakChain(state, events, "hurt");
  state.charge.downAt = null;
  state.charge.full = false;
  const p = panel(state, state.player.col, state.player.row);
  state.fx.popups.push({
    x: p.x + p.w / 2,
    y: p.y - 8,
    t0: now,
    text: "HIT \u2212" + HIT_TIME_PENALTY.toFixed(1) + "s",
    color: "#ff5470"
  });
  state.fx.sparks.push({ x: p.x + p.w / 2, y: p.y + p.h * 0.3, t0: now });
  spawnBits(
    state,
    p.x + p.w / 2,
    p.y + p.h * 0.4,
    BIT_COUNT.hurt,
    DEBRIS.player,
    { speed: 0.26, spread: 1.4, at: now }
  );
  ripple(state, state.player.col, state.player.row, "#ff5470", now, 3);
  shake(state, SHAKE.hurt, now);
  hitStop(state, now, HITSTOP.hurt);
  events.push({
    type: "playerHit",
    col: state.player.col,
    row: state.player.row,
    x: p.x + p.w / 2,
    y: p.y,
    timePenalty: HIT_TIME_PENALTY
  });
  events.push({ type: "statsChanged" });
}
function breakChain(state, events, cause, at = state.clock) {
  const chain = state.chain;
  state.chain = 0;
  if (chain <= 0) return;
  if (chain >= 2) {
    const p = panel(state, state.player.col, state.player.row);
    const quiet = cause === "hurt";
    state.fx.chainBreak = { t0: at, chain, x: p.x + p.w / 2, y: p.y - 6, quiet };
    if (!quiet) ripple(state, state.player.col, state.player.row, "#8a96b8", at, 2);
  }
  events.push({ type: "chainBroken", chain, cause });
}
var isVisible = (e) => e.state === "rising" || e.state === "up" || e.state === "sinking";
function hitFx(target, tier, now) {
  target.tier = tier;
  target.fx = {
    scale: makeImpulse(tier.scale, now),
    squash: makeImpulse(tier.squash, now),
    kick: makeImpulse(tier.kick, now)
  };
}
function deleteEnemy(state, target, tierName, land, events) {
  const now = state.clock;
  const tier = TIERS[tierName];
  const p = panel(state, target.col, target.row);
  const cx = p.x + p.w / 2, cy = p.y + p.h * 0.34;
  target.state = "hit";
  target.t0 = land;
  hitFx(target, tier, land);
  const multBefore = multOf(state.chain);
  state.chain++;
  if (state.chain > state.bestChain) state.bestChain = state.chain;
  const mult = multOf(state.chain);
  if (state.wave && target.wave === state.wave.index) state.wave.kills++;
  const baseKey = target.type === "guard" ? "guard" : target.type === "hopper" ? "hopper" : target.type === "rare" ? "rare" : target.type === "sentinel" ? "sentinel" : tierName;
  const pts = (PTS[baseKey] === void 0 ? PTS[tierName] : PTS[baseKey]) * mult;
  state.score += pts;
  state.deletions++;
  const bf = bonusFactor(state.deletions);
  const factor = baseKey === "rare" ? Math.sqrt(bf) : bf;
  const timeBonus = (BONUS[baseKey] === void 0 ? BONUS[tierName] : BONUS[baseKey]) * factor;
  state.timeLeft = Math.min(TIME_CAP, state.timeLeft + timeBonus);
  spawnBits(state, cx, cy, BIT_COUNT[baseKey] || BIT_COUNT.guard, DEBRIS[target.type] || DEBRIS.guard, {
    at: land,
    speed: baseKey === "rare" ? 0.4 : baseKey === "charged" ? 0.34 : 0.28,
    spread: 1.25
  });
  ripple(
    state,
    target.col,
    target.row,
    baseKey === "rare" ? "#ffd23f" : baseKey === "guard" ? "#c9f6ff" : "#45e0e8",
    land,
    baseKey === "rare" ? 4 : 3
  );
  ripple(state, state.player.col, state.player.row, "#45e0e8", land, 1);
  shake(state, SHAKE[baseKey] || SHAKE.normal, land);
  hitStop(state, land, HITSTOP[baseKey] || HITSTOP.normal);
  events.push({
    type: "hit",
    tier: tierName,
    enemyType: target.type,
    baseKey,
    col: target.col,
    row: target.row,
    x: cx,
    y: p.y,
    points: pts,
    mult,
    chain: state.chain,
    timeBonus
  });
  if (mult > multBefore) {
    events.push({ type: "multiplierUp", mult, chain: state.chain });
    state.fx.flare = { t0: land, mult, x: cx, y: cy };
    shake(state, SHAKE.chain, land, mult / 2);
    hitStop(state, land, HITSTOP.chain);
    spawnBits(
      state,
      cx,
      cy,
      6 + mult * 2,
      DEBRIS.rare,
      { at: land, speed: 0.34, spread: 2, ms: 640 }
    );
  }
  state.fx.popups.push({
    x: cx,
    y: p.y - 8,
    t0: land,
    text: "+" + pts + (mult > 1 ? " \xD7" + mult : ""),
    color: baseKey === "rare" ? "#ffe08a" : baseKey === "guard" || mult > 1 ? "#45e0e8" : "#aab4ce"
  });
  state.fx.popups.push({
    x: cx,
    y: p.y + 12,
    t0: land + 60,
    text: "+" + timeBonus.toFixed(1) + "s",
    color: factor < 1 ? "#ff9f45" : "#ffd23f"
  });
  events.push({ type: "statsChanged" });
}
function shoot(state, tierName, events) {
  const now = state.clock;
  const G = state.G;
  const tier = TIERS[tierName];
  state.fx.recoil = makeImpulse(tier.recoil, now);
  state.fx.muzzleT0 = now;
  state.fx.muzzleTier = tierName;
  state.shots++;
  const row = state.player.row;
  let target = null;
  for (const e of state.enemies) {
    if (!isVisible(e) || e.row !== row) continue;
    if (e.type === "ally" && e.state !== "up") continue;
    if (e.col <= state.player.col) continue;
    if (!target || e.col < target.col) target = e;
  }
  const pr = panel(state, state.player.col, row);
  const bwP = G.pw * 0.34;
  const x0 = pr.x + pr.w / 2 + bwP / 2 + bwP * 0.55;
  const ax0 = activeArena(state.world).x0;
  const x1 = target ? panel(state, target.col, row).x + G.pw / 2 : G.gx + G.pw * (ax0 + COLS);
  const dur = Math.max(40, Math.min(95, (x1 - x0) / 5));
  state.fx.ray = { t0: now, row, hitCol: target ? target.col : null, x0, x1, dur, tier: tierName };
  const land = now + dur;
  events.push({
    type: "shot",
    tier: tierName,
    row,
    x: x0,
    y: laneY(G, row),
    hit: !!target,
    targetType: target ? target.type : null
  });
  if (!target) {
    state.whiffs++;
    events.push({ type: "whiff", tier: tierName, row, x: x1, y: laneY(G, row) });
    breakChain(state, events, "whiff", land);
    events.push({ type: "statsChanged" });
    return;
  }
  const p = panel(state, target.col, target.row);
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h * 0.34;
  if (target.type === "ally") {
    target.state = "hit";
    target.t0 = land;
    hitFx(target, tier, land);
    state.whiffs++;
    breakChain(state, events, "prog", land);
    state.timeLeft = Math.max(0, state.timeLeft - ALLY_TIME_PENALTY);
    state.score = Math.max(0, state.score - ALLY_PTS_PENALTY);
    state.fx.popups.push({
      x: cx,
      y: p.y - 8,
      t0: land,
      text: "PROG HIT \u2212" + ALLY_TIME_PENALTY.toFixed(1) + "s",
      color: "#ff5470"
    });
    spawnBits(state, cx, cy, BIT_COUNT.prog, DEBRIS.ally, { at: land, speed: 0.18 });
    ripple(state, target.col, target.row, "#ff5470", land, 3);
    shake(state, SHAKE.prog, land);
    hitStop(state, land, HITSTOP.prog);
    events.push({
      type: "progHit",
      tier: tierName,
      col: target.col,
      row: target.row,
      x: cx,
      y: p.y,
      timePenalty: ALLY_TIME_PENALTY,
      pointsPenalty: ALLY_PTS_PENALTY
    });
    events.push({ type: "statsChanged" });
    return;
  }
  if (target.type === "guard" && tierName === "normal") {
    state.fx.sparks.push({ x: p.x + p.w * 0.28, y: p.y + p.h * 0.2, t0: land });
    state.fx.popups.push({ x: cx, y: p.y - 8, t0: land, text: "GUARD", color: "#8a96b8" });
    spawnBits(
      state,
      p.x + p.w * 0.28,
      cy,
      BIT_COUNT.block,
      DEBRIS.guard,
      { at: land, dir: Math.PI, spread: 0.7, speed: 0.16, ms: 320 }
    );
    ripple(state, target.col, target.row, "#aeb9d6", land, 2);
    hitStop(state, land, HITSTOP.block);
    events.push({ type: "guardBlocked", col: target.col, row: target.row, x: cx, y: p.y });
    return;
  }
  if (target.type === "sentinel") {
    const open = target.willAttack ? !target.fired : true;
    if (!open) {
      state.fx.sparks.push({ x: p.x + p.w * 0.28, y: p.y + p.h * 0.2, t0: land });
      state.fx.popups.push({ x: cx, y: p.y - 8, t0: land, text: "CLOSED", color: "#b48cff" });
      spawnBits(
        state,
        p.x + p.w * 0.28,
        cy,
        BIT_COUNT.block,
        DEBRIS.guard,
        { at: land, speed: 0.14, ms: 260 }
      );
      ripple(state, target.col, target.row, "#b48cff", land, 2);
      events.push({ type: "guardBlocked", col: target.col, row: target.row, x: cx, y: p.y });
      return;
    }
    const dmg = tierName === "charged" ? SENTINEL_CHARGED_DMG : 1;
    if (target.hp > dmg) {
      target.hp -= dmg;
      state.fx.sparks.push({ x: cx, y: p.y + p.h * 0.2, t0: land });
      state.fx.popups.push({ x: cx, y: p.y - 8, t0: land, text: target.hp + " more", color: "#c48cff" });
      spawnBits(state, cx, cy, BIT_COUNT.stagger, DEBRIS.guard, { at: land, speed: 0.17, ms: 340 });
      ripple(state, target.col, target.row, "#c48cff", land, 2);
      hitStop(state, land, HITSTOP.stagger);
      events.push({ type: "sentinelHit", col: target.col, row: target.row, x: cx, y: p.y, hp: target.hp });
      return;
    }
  }
  if (target.type === "hopper" && tierName === "normal" && target.hp > 1) {
    target.hp--;
    state.fx.sparks.push({ x: cx, y: p.y + p.h * 0.2, t0: land });
    state.fx.popups.push({ x: cx, y: p.y - 8, t0: land, text: "1 more", color: "#5ee87c" });
    spawnBits(
      state,
      cx,
      cy,
      BIT_COUNT.stagger,
      DEBRIS.hopper,
      { at: land, speed: 0.17, ms: 340 }
    );
    ripple(state, target.col, target.row, "#5ee87c", land, 2);
    hitStop(state, land, HITSTOP.stagger);
    events.push({
      type: "hopperStagger",
      col: target.col,
      row: target.row,
      x: cx,
      y: p.y,
      hp: target.hp
    });
    hopTo(state, target, events);
    target.lastHop = now;
    return;
  }
  deleteEnemy(state, target, tierName, land, events);
}
function cullFx(state) {
  const now = state.clock;
  const popups = state.fx.popups;
  for (let i = popups.length - 1; i >= 0; i--) {
    if (now - popups[i].t0 >= POPUP_MS) popups.splice(i, 1);
  }
  const sparks = state.fx.sparks;
  for (let i = sparks.length - 1; i >= 0; i--) {
    if (now - sparks[i].t0 >= SPARK_MS) sparks.splice(i, 1);
  }
  const bits = state.fx.bits;
  for (let i = bits.length - 1; i >= 0; i--) {
    if (now - bits[i].t0 >= bits[i].ms) bits.splice(i, 1);
  }
  const ripples = state.fx.ripples;
  for (let i = ripples.length - 1; i >= 0; i--) {
    if (now - ripples[i].t0 >= ripples[i].ms) ripples.splice(i, 1);
  }
}
function clearFx(state) {
  const fx = state.fx;
  fx.popups.length = 0;
  fx.sparks.length = 0;
  fx.bits.length = 0;
  fx.ripples.length = 0;
  fx.hurtT0 = -1e9;
  fx.shake.t0 = -1e9;
  fx.shake.amp = 0;
  fx.shake.ms = 0;
  fx.flare.t0 = -1e9;
  fx.chainBreak.t0 = -1e9;
  fx.ghost.t0 = -1e9;
  fx.ray.t0 = -1e9;
  fx.muzzleT0 = -1e9;
  state.hitStopAt = -1e9;
  state.hitStopMs = 0;
}

// src/shell/dom.js
var TEMPLATE = `
<style>
  :host {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 320px;
    /* Gestures that start on the game stay on the game. 'pan-y' (not 'none')
       so the one genuinely scrollable thing inside \u2014 the start card \u2014 can still
       scroll; every actual play surface narrows it to 'none' below. Setting
       'none' here would win the ancestor intersection and freeze that card. */
    touch-action: pan-y;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    --bw-field: #1b2233;
    --bw-panel: #232c42;
    --bw-line: #2f3a57;
    --bw-ink: #aab4ce;
    --bw-ink-dim: #5f6b8c;
    --bw-accent: #45e0e8;
    --bw-mega: #4f8dff;
    --bw-warn: #ff5470;
    --bw-oc: #ff9f45;
  }
  * { box-sizing: border-box; margin: 0; }
  .bw-root {
    height: 100%;
    width: 100%;
    background: var(--bw-field);
    color: var(--bw-ink);
    font: 13px/1.5 ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    touch-action: pan-y;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }

  main {
    position: relative;
    flex: 1;
    min-height: 0;
    touch-action: pan-y;   /* narrowed to 'none' by every child but #splash */
    container-type: size;
    container-name: bwstage;
    /* The stage is the game's focus holder, but it is tabindex="-1" \u2014 script
       focuses it, the Tab key never does \u2014 so it needs no focus ring of its own.
       Keyboard users land on FIRE / PAUSE / PRESS START, which have theirs. */
    outline: none;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    touch-action: none;
  }
  #overlay, #dpad, #fireBtn, #bombBtn, #pauseBtn { touch-action: none; }

  /* Analog ring: whole disc is touchable, no gaps. Center 2/5R is neutral;
     rock the finger outward to move, diagonals press two directions. */
  #dpad {
    position: absolute;
    left: 12px;
    bottom: 12px;
    width: 168px;
    height: 168px;
    border-radius: 50%;
    border: 2px solid var(--bw-mega);
    background: rgba(79, 141, 255, 0.10);
    touch-action: none;
    cursor: pointer;
  }
  #dpad.live { background: rgba(79, 141, 255, 0.20); }
  #dpad .hub {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 40%;   /* neutral zone: radius = 2/5 of ring radius */
    height: 40%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    border: 1px dashed rgba(79, 141, 255, 0.45);
    pointer-events: none;
  }
  #dpad .arr {
    position: absolute;
    color: var(--bw-mega);
    font: 700 16px/1 ui-monospace, Menlo, Consolas, monospace;
    opacity: 0.7;
    pointer-events: none;
  }
  #dpad .arr.on { opacity: 1; color: #c9f6ff; text-shadow: 0 0 8px var(--bw-mega); }
  #aUp    { top: 10px;  left: 50%; transform: translateX(-50%); }
  #aDown  { bottom: 10px; left: 50%; transform: translateX(-50%); }
  #aLeft  { left: 12px; top: 50%; transform: translateY(-50%); }
  #aRight { right: 12px; top: 50%; transform: translateY(-50%); }

  #fireBtn {
    position: absolute;
    right: 0;
    bottom: 0;
    width: min(46vw, 200px);
    height: min(46vw, 200px);
    border: none;
    border-top: 2px solid var(--bw-accent);
    border-left: 2px solid var(--bw-accent);
    border-radius: 100% 0 0 0;   /* quarter circle, bleeds off both edges */
    background: rgba(69, 224, 232, 0.10);
    color: var(--bw-accent);
    font: 700 14px/1.3 ui-monospace, Menlo, Consolas, monospace;
    letter-spacing: 0.12em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 22% 0 0 22%;   /* bias label toward the visible arc's center */
  }
  #fireBtn:active { background: rgba(69, 224, 232, 0.25); }

  /* secondary fire: the bomb. A round button riding above the FIRE arc, lit
     while you carry one and greyed to an outline when you don't. */
  #bombBtn {
    position: absolute;
    right: 16px;
    bottom: calc(min(46vw, 200px) + 14px);
    width: 66px;
    height: 66px;
    border-radius: 50%;
    border: 2px solid var(--bw-oc);
    background: rgba(255, 159, 69, 0.14);
    color: var(--bw-oc);
    font: 700 10px/1.15 ui-monospace, Menlo, Consolas, monospace;
    letter-spacing: 0.1em;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  #bombBtn b { font-size: 16px; }
  #bombBtn.empty { border-color: var(--bw-line); color: var(--bw-ink-dim); background: rgba(35, 44, 66, 0.5); }
  #bombBtn:active { background: rgba(255, 159, 69, 0.3); }
  #bombBtn:focus-visible { outline: 2px solid var(--bw-oc); outline-offset: 3px; }
  #fireBtn:focus-visible { outline: 2px solid var(--bw-accent); outline-offset: 3px; }

  #pauseBtn {
    position: absolute;
    right: 18px;
    top: 14px;
    width: 40px;
    height: 40px;
    border-radius: 6px;
    border: 1px solid var(--bw-line);
    background: rgba(35, 44, 66, 0.8);
    color: var(--bw-ink-dim);
    font: 700 13px/1 ui-monospace, Menlo, Consolas, monospace;
    cursor: pointer;
  }
  #pauseBtn:focus-visible { outline: 2px solid var(--bw-accent); outline-offset: 2px; }

  /* Muted, as a state of the machine rather than a line of stats: a crossed
     speaker next to the pause button, shown only while sound is off. It is the
     one thing the deleted footer was carrying that the player still needs. */
  #muteFlag {
    position: absolute;
    right: 66px;
    top: 14px;
    width: 40px;
    height: 40px;
    display: none;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: 1px solid var(--bw-warn);
    background: rgba(255, 84, 112, 0.12);
    color: var(--bw-warn);
    pointer-events: none;
  }
  #muteFlag.on { display: flex; animation: bwMutePop 220ms ease-out; }
  #muteFlag svg { width: 22px; height: 22px; display: block; }
  @keyframes bwMutePop {
    from { transform: scale(0.6); opacity: 0; }
    to   { transform: none; opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) { #muteFlag.on { animation: none; } }

  /* splash / interlevel / game-over overlay */
  #overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(ellipse at 50% 38%, rgba(79, 141, 255, 0.12), transparent 62%),
      rgba(27, 34, 51, 0.92);
  }
  #overlay.hidden { display: none; }
  .ov-inner {
    text-align: center;
    padding: 24px;
    max-width: 480px;
    animation: bwOvIn 260ms ease-out;
  }
  @keyframes bwOvIn {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to   { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) { .ov-inner { animation: none; } }
  .ov-eyebrow {
    color: var(--bw-oc);
    font-size: 12px;
    letter-spacing: 0.3em;
    margin-bottom: 10px;
  }
  .ov-title {
    color: var(--bw-accent);
    font-size: 34px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-shadow: 0 0 18px rgba(69, 224, 232, 0.55);
    margin-bottom: 8px;
  }
  .ov-title.rank { font-size: 64px; }
  .ov-sub {
    color: var(--bw-ink);
    font-size: 13px;
    line-height: 1.8;
    margin-bottom: 16px;
    white-space: pre-line;
  }
  .ov-stats {
    display: inline-block;
    text-align: left;
    color: var(--bw-ink-dim);
    font-size: 12px;
    line-height: 1.9;
    margin-bottom: 20px;
  }
  .ov-stats b { color: var(--bw-ink); font-weight: 600; }
  .ov-stats b.big { color: var(--bw-accent); font-size: 20px; }
  .ov-btns { display: flex; gap: 12px; justify-content: center; }
  .ov-btns button {
    font: 700 13px/1 ui-monospace, Menlo, Consolas, monospace;
    letter-spacing: 0.12em;
    padding: 14px 24px;
    border-radius: 8px;
    cursor: pointer;
    border: 2px solid var(--bw-accent);
    background: rgba(69, 224, 232, 0.10);
    color: var(--bw-accent);
    touch-action: none;
  }
  .ov-btns button.dim {
    border-color: var(--bw-line);
    color: var(--bw-ink-dim);
    background: rgba(35, 44, 66, 0.6);
  }
  .ov-btns button:active { background: rgba(69, 224, 232, 0.25); }
  .ov-btns button:focus-visible { outline: 2px solid var(--bw-accent); outline-offset: 2px; }

  /* ---------- attract-mode start screen ---------- */
  /* Arcade title card over a cyberspace grid: perspective floor, CRT
     scanlines, and a Mega Man-style two-tone block logo. Sized in cqw
     against #stage so it scales with the mount, not the viewport. */
  #splash {
    position: absolute;
    inset: 0;
    z-index: 12;
    display: flex;
    overflow: auto;
    background: #080b14;
    /* The only surface allowed to scroll: on a short mount the card overflows
       and a drag should still reach PRESS START. */
    touch-action: pan-y;
    cursor: pointer;
  }
  /* Keep that scroll \u2014 including its momentum fling, which no touchmove
     handler can reach \u2014 from chaining out into the host page. Scoped to touch
     devices: on a desktop 'overscroll-behavior' would also stop the wheel from
     scrolling the host page whenever the cursor happened to be over the card,
     and Chromium applies it even when the card is not overflowing at all. */
  @media (hover: none) and (pointer: coarse) {
    #splash { overscroll-behavior: contain; }
  }
  #splash.hidden { display: none; }

  /* cyberspace floor, scrolling toward the viewer */
  .sp-floor {
    position: absolute;
    left: -60%;
    right: -60%;
    bottom: 0;
    height: 62%;
    background-image:
      repeating-linear-gradient(to right, rgba(69, 224, 232, 0.75) 0 1px, transparent 1px 60px),
      repeating-linear-gradient(to bottom, rgba(96, 160, 255, 0.85) 0 1px, transparent 1px 46px);
    transform: perspective(300px) rotateX(64deg);
    transform-origin: 50% 100%;
    -webkit-mask-image: linear-gradient(to bottom,
      transparent 0%, rgba(0, 0, 0, 0.7) 24%, #000 58%, rgba(0, 0, 0, 0.4) 100%);
    mask-image: linear-gradient(to bottom,
      transparent 0%, rgba(0, 0, 0, 0.7) 24%, #000 58%, rgba(0, 0, 0, 0.4) 100%);
    animation: bwFloor 1.5s linear infinite;
    pointer-events: none;
  }
  @keyframes bwFloor { to { background-position: 0 0, 0 46px; } }

  /* horizon glow + fade so the grid dissolves into the dark instead of ending */
  .sp-haze {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(58% 30% at 50% 46%, rgba(79, 141, 255, 0.40), transparent 72%),
      radial-gradient(70% 46% at 50% 42%, rgba(8, 11, 20, 0.86), transparent 72%),
      linear-gradient(to bottom, #080b14 0 34%, rgba(8, 11, 20, 0.5) 44%, rgba(8, 11, 20, 0) 62%);
    pointer-events: none;
  }

  /* CRT: fixed scanlines, a slow bloom sweep, and a vignette */
  .sp-crt {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.26) 0 1px, transparent 1px 3px),
      radial-gradient(120% 90% at 50% 50%, transparent 52%, rgba(0, 0, 0, 0.62) 100%);
  }
  .sp-crt::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 26%;
    background: linear-gradient(to bottom, transparent, rgba(140, 240, 255, 0.07), transparent);
    animation: bwSweep 7s linear infinite;
  }
  @keyframes bwSweep { from { top: -28%; } to { top: 100%; } }

  .sp-inner {
    position: relative;
    z-index: 1;
    margin: auto;
    width: 100%;
    max-width: 460px;
    padding: 20px 18px 22px;
    text-align: center;
  }

  /* arcade score header */
  .sp-hud {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    letter-spacing: 0.18em;
    color: var(--bw-ink-dim);
    margin-bottom: 14px;
  }
  .sp-hud b { color: var(--bw-oc); font-weight: 700; }
  .sp-hud .live { color: var(--bw-accent); animation: bwBlink 1s steps(1, end) infinite; }

  .sp-badge {
    display: inline-block;
    font-size: 9px;
    letter-spacing: 0.32em;
    color: var(--bw-accent);
    border: 1px solid rgba(69, 224, 232, 0.35);
    border-radius: 2px;
    padding: 4px 10px 3px;
    margin-bottom: 12px;
    background: rgba(69, 224, 232, 0.06);
  }

  /* two-tone block logo with a hard mid-band split, arcade marquee style */
  .sp-logo {
    font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
    font-weight: 900;
    line-height: 0.94;
    margin: 0 0 12px;
    animation: bwShake 8s ease-in-out infinite;
  }
  .sp-word {
    display: block;
    position: relative;
    letter-spacing: 0.08em;
    color: transparent;
    background-clip: text;
    -webkit-background-clip: text;
  }
  .sp-w1 {
    font-size: clamp(30px, 13cqw, 56px);
    background-image: linear-gradient(180deg, #dffaff 0 44%, #45e0e8 44% 52%, #1878c4 52% 100%);
    filter:
      drop-shadow(0 3px 0 #05080f)
      drop-shadow(0 0 12px rgba(69, 224, 232, 0.65));
  }
  .sp-w2 {
    font-size: clamp(36px, 16cqw, 70px);
    background-image: linear-gradient(180deg, #fff6d8 0 44%, #ffd23f 44% 52%, #e07a10 52% 100%);
    filter:
      drop-shadow(0 3px 0 #05080f)
      drop-shadow(0 0 14px rgba(255, 159, 69, 0.6));
  }
  /* chromatic ghosts, idle at zero and flicked on by the glitch cycle */
  .sp-word::before,
  .sp-word::after {
    content: attr(data-t);
    position: absolute;
    inset: 0;
    background: none;
    opacity: 0;
  }
  .sp-word::before { color: var(--bw-warn); animation: bwGhostA 8s steps(1, end) infinite; }
  .sp-word::after  { color: var(--bw-accent); animation: bwGhostB 8s steps(1, end) infinite; }
  @keyframes bwShake {
    0%, 90%, 100% { transform: none; }
    91% { transform: translateX(-3px) skewX(-1.5deg); }
    93% { transform: translateX(3px); }
    95% { transform: translateX(-1px) skewX(1deg); }
  }
  @keyframes bwGhostA {
    0%, 90%, 96%, 100% { opacity: 0; transform: none; }
    91%, 94% { opacity: 0.55; transform: translate(-4px, 1px); }
  }
  @keyframes bwGhostB {
    0%, 90%, 96%, 100% { opacity: 0; transform: none; }
    92%, 95% { opacity: 0.5; transform: translate(4px, -1px); }
  }

  .sp-rule {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 9px;
    letter-spacing: 0.34em;
    color: var(--bw-ink-dim);
    margin-bottom: 16px;
  }
  .sp-rule::before,
  .sp-rule::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(to right, transparent, var(--bw-line), transparent);
  }

  /* mode menu: one row per mode, the selected one lit like a cabinet's
     illuminated button. Arrow keys move the selection, a tap picks and starts. */
  .sp-modes {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }
  .sp-mode {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--bw-line);
    border-left: 3px solid var(--bw-line);
    border-radius: 3px;
    background: rgba(27, 34, 51, 0.72);
    color: var(--bw-ink-dim);
    font: 700 12px/1 ui-monospace, Menlo, Consolas, monospace;
    letter-spacing: 0.16em;
    text-align: left;
    cursor: pointer;
    touch-action: manipulation;
  }
  .sp-mode .blurb {
    margin-left: auto;
    font-weight: 400;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--bw-ink-dim);
  }
  .sp-mode[aria-checked="true"] {
    border-color: var(--bw-accent);
    border-left-color: var(--bw-accent);
    background: rgba(69, 224, 232, 0.12);
    color: #d9fbff;
    box-shadow: 0 0 18px rgba(69, 224, 232, 0.22);
  }
  .sp-mode[aria-checked="true"] .blurb { color: var(--bw-accent); }
  .sp-mode:focus-visible { outline: 2px solid var(--bw-accent); outline-offset: 2px; }

  .sp-start {
    font: 700 14px/1 ui-monospace, Menlo, Consolas, monospace;
    letter-spacing: 0.24em;
    color: #04181f;
    padding: 14px 30px;
    border: 0;
    border-radius: 4px;
    background: linear-gradient(180deg, #b6f7fb 0 46%, #45e0e8 46% 100%);
    box-shadow:
      0 0 0 2px #05080f,
      0 0 0 4px rgba(69, 224, 232, 0.45),
      0 0 26px rgba(69, 224, 232, 0.45);
    cursor: pointer;
    touch-action: manipulation;
    animation: bwBlink 1.15s steps(1, end) infinite;
  }
  .sp-start:active { transform: translateY(1px); }
  .sp-start:focus-visible { outline: 2px solid #fff; outline-offset: 4px; }
  @keyframes bwBlink { 0%, 62% { opacity: 1; } 63%, 100% { opacity: 0.45; } }

  .sp-coin {
    font-size: 9px;
    letter-spacing: 0.28em;
    color: var(--bw-ink-dim);
    text-shadow: 0 0 6px #080b14, 0 0 12px #080b14;
    margin-top: 14px;
  }

  /* Short mounts shed the card from the bottom up, so PRESS START never
     falls below the fold: first the spacing, then the badge. */
  @container bwstage (max-height: 620px) {
    .sp-inner { padding: 12px 16px 14px; }
    .sp-w1 { font-size: clamp(24px, 11cqw, 42px); }
    .sp-w2 { font-size: clamp(28px, 13cqw, 52px); }
    .sp-hud, .sp-badge, .sp-logo { margin-bottom: 9px; }
    .sp-rule { margin-bottom: 14px; }
    .sp-modes { gap: 4px; margin-bottom: 12px; }
    .sp-mode { padding: 7px 10px; }
    .sp-start { padding: 12px 26px; }
    .sp-coin { margin-top: 10px; }
    .sp-floor { height: 48%; opacity: 0.5; }
  }
  @container bwstage (max-height: 430px) {
    .sp-floor { opacity: 0.32; }
  }
  @container bwstage (max-height: 340px) {
    .sp-badge { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .sp-floor, .sp-crt::after, .sp-logo, .sp-word::before, .sp-word::after,
    .sp-start, .sp-hud .live { animation: none; }
    .sp-word::before, .sp-word::after { opacity: 0; }
  }
</style>

<div class="bw-root" id="bwRoot">
  <!-- tabindex="-1": focusable by script but not by Tab. Touching or clicking
       the game parks focus here, which is how keyboard input stays scoped to
       "the player is actually looking at the game" instead of the whole page.
       Tab still walks the real controls below, and focusing any of them puts
       focus inside this shadow tree, which counts just the same. -->
  <main id="stage" tabindex="-1">
    <canvas id="cv"></canvas>

    <div id="overlay" class="hidden">
      <div class="ov-inner">
        <div id="ovEyebrow" class="ov-eyebrow"></div>
        <div id="ovTitle" class="ov-title"></div>
        <div id="ovSub" class="ov-sub"></div>
        <div id="ovStats" class="ov-stats"></div>
        <div id="ovBtns" class="ov-btns"></div>
      </div>
    </div>

    <div id="splash" class="hidden" aria-label="Start screen">
      <div class="sp-floor" aria-hidden="true"></div>
      <div class="sp-haze" aria-hidden="true"></div>
      <div class="sp-crt" aria-hidden="true"></div>

      <div class="sp-inner">
        <div class="sp-hud">
          <span>HI-SCORE <b id="spBest">000000</b></span>
          <span class="live">CREDIT 01</span>
        </div>

        <div class="sp-badge">V-BUSTER SYSTEM ONLINE</div>

        <h1 class="sp-logo">
          <span class="sp-word sp-w1" data-t="BUSTER">BUSTER</span>
          <span class="sp-word sp-w2" data-t="WHACK">WHACK</span>
        </h1>

        <div class="sp-rule">SELECT MODE</div>

        <div id="spModes" class="sp-modes" role="radiogroup" aria-label="Game mode"></div>

        <button id="spStart" class="sp-start">PRESS START</button>
        <div class="sp-coin">INSERT COIN &#183; CYBERSPACE 2026</div>
      </div>
    </div>

    <div id="dpad" role="application" aria-label="Move (touch ring; arrow keys / WASD also work)">
      <span class="hub"></span>
      <span class="arr" id="aUp">&#9650;</span>
      <span class="arr" id="aLeft">&#9664;</span>
      <span class="arr" id="aRight">&#9654;</span>
      <span class="arr" id="aDown">&#9660;</span>
    </div>

    <div id="muteFlag" role="status" aria-label="Sound off" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
        <path d="M16 9l5 6M21 9l-5 6" />
      </svg>
    </div>

    <button id="pauseBtn" aria-label="Pause">II</button>
    <button id="bombBtn" class="empty" aria-label="Throw bomb">BOMB<b id="bombCount">0</b></button>
    <button id="fireBtn" aria-label="Fire">FIRE<br>&#9679;</button>
  </main>

</div>
`;
var IDS = [
  "bwRoot",
  "cv",
  "stage",
  "overlay",
  "ovEyebrow",
  "ovTitle",
  "ovSub",
  "ovStats",
  "ovBtns",
  "splash",
  "spBest",
  "spStart",
  "spModes",
  "dpad",
  "aUp",
  "aDown",
  "aLeft",
  "aRight",
  "pauseBtn",
  "fireBtn",
  "bombBtn",
  "bombCount",
  "muteFlag"
];
function createUI(container) {
  const root = container.shadowRoot || container.attachShadow({ mode: "open" });
  root.innerHTML = TEMPLATE;
  const els = {};
  for (const id of IDS) els[id] = root.getElementById(id);
  return { root, els };
}
function renderStats(_els, _stats) {
}
function renderSound(els, on) {
  els.muteFlag.classList.toggle("on", !on);
  els.muteFlag.setAttribute("aria-hidden", on ? "true" : "false");
}
function statRows(rows) {
  return rows.map((r) => "<div>" + r[0] + " <b" + (r[2] ? ' class="' + r[2] + '"' : "") + ">" + r[1] + "</b></div>").join("");
}
function showOverlay(doc, els, o) {
  els.ovEyebrow.textContent = o.eyebrow || "";
  els.ovTitle.textContent = o.title;
  els.ovTitle.classList.toggle("rank", !!o.rank);
  els.ovSub.textContent = o.sub || "";
  els.ovStats.innerHTML = o.stats || "";
  els.ovBtns.innerHTML = "";
  for (const b of o.buttons) {
    const btn = doc.createElement("button");
    btn.textContent = b.label;
    if (b.dim) btn.className = "dim";
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      b.fn();
    });
    els.ovBtns.appendChild(btn);
  }
  els.overlay.classList.remove("hidden");
}
function hideOverlay(els) {
  els.overlay.classList.add("hidden");
  els.splash.classList.add("hidden");
}
function showSplash(els, best) {
  els.spBest.textContent = String(best).padStart(6, "0");
  hideOverlay(els);
  els.splash.classList.remove("hidden");
}
function renderModes(els, modes, selectedId) {
  const doc = els.splash.ownerDocument;
  els.spModes.textContent = "";
  for (const m of modes) {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "sp-mode";
    b.dataset.mode = m.id;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(m.id === selectedId));
    const name = doc.createElement("span");
    name.textContent = m.name;
    const blurb = doc.createElement("span");
    blurb.className = "blurb";
    blurb.textContent = m.blurb;
    b.appendChild(name);
    b.appendChild(blurb);
    els.spModes.appendChild(b);
  }
  return Array.from(els.spModes.children);
}
function selectMode(els, id) {
  for (const b of els.spModes.children) {
    b.setAttribute("aria-checked", String(b.dataset.mode === id));
  }
}
function renderBombs(els, n) {
  els.bombCount.textContent = String(n);
  els.bombBtn.classList.toggle("empty", n <= 0);
}

// src/shell/audio.js
var MASTER_GAIN = 0.85;
var SFX_GAIN = 0.9;
var MUSIC_GAIN = 0.34;
var LOOKAHEAD = 0.14;
var PUMP_MS = 25;
var STEPS = 16;
var BARS = 4;
var PHRASES = 4;
var FORM_BARS = BARS * PHRASES;
var PH_LEAD_OCT = [0, 0, 12, 0];
var PH_STABS = [false, true, true, true];
var PH_BSECTION = [false, false, true, false];
var CHARGE_MS2 = 700;
var LOW_TIME2 = 6;
var A4 = 440;
var hz = (n) => A4 * Math.pow(2, (n - 69) / 12);
var PROG_MAIN = [45, 41, 43, 40];
var PROG_OC = [45, 44, 43, 42];
var ARP_MIN = [0, 3, 7, 12, 15, 12, 7, 3];
var ARP_DIM = [0, 3, 6, 9, 12, 9, 6, 3];
var KICK = ["x.......x.......", "x.......x...x...", "x..x....x...x..x", "x...x...x...x..."];
var SNARE = ["....x.......x...", "....x.......x...", "....x.......x...", "....x...x...x..x"];
var HAT = ["..x...x...x...x.", "x.x.x.x.x.x.x.x.", "x.x.x.x.x.x.x.x.", "xxxxxxxxxxxxxxxx"];
var LEAD = ["x...x...x...x...", "x.x.x.x.x.x.x.x.", "xxx.xx.xxx.xx.x.", "xxx.xx.xxx.xx.x."];
var STAB = ["................", "..x.......x.....", "..x...x...x...x.", "..x...x...x...x."];
var BPM = [128, 140, 150, 162];
var KICK_LOW_TIME = "x...x...x...x...";
function createAudio(win) {
  let ac = null;
  let master = null, sfxBus = null, musicBus = null, duck = null;
  let on = true;
  let dead = false;
  const live = /* @__PURE__ */ new Set();
  const AC = win.AudioContext || win.webkitAudioContext;
  function build() {
    ac = new AC();
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 3;
    limiter.ratio.value = 20;
    limiter.attack.value = 2e-3;
    limiter.release.value = 0.12;
    master = ac.createGain();
    master.gain.value = on ? MASTER_GAIN : 0;
    sfxBus = ac.createGain();
    sfxBus.gain.value = SFX_GAIN;
    musicBus = ac.createGain();
    musicBus.gain.value = 0;
    duck = ac.createGain();
    duck.gain.value = 1;
    musicBus.connect(duck);
    duck.connect(master);
    sfxBus.connect(master);
    master.connect(limiter);
    limiter.connect(ac.destination);
  }
  function ctx() {
    if (dead) return null;
    if (!ac && AC) {
      try {
        build();
      } catch (e) {
        ac = null;
      }
    }
    if (ac && ac.state === "suspended") {
      try {
        ac.resume();
      } catch (e) {
      }
    }
    return ac;
  }
  function audible() {
    return !dead && on && !!ctx();
  }
  function track(node, stopAt) {
    live.add(node);
    node.onended = () => {
      live.delete(node);
      try {
        node.disconnect();
      } catch (e) {
      }
    };
    if (stopAt !== void 0) {
      try {
        node.stop(stopAt);
      } catch (e) {
      }
    }
    return node;
  }
  function stopAll() {
    for (const n of Array.from(live)) {
      try {
        n.onended = null;
      } catch (e) {
      }
      try {
        n.stop(0);
      } catch (e) {
      }
      try {
        n.disconnect();
      } catch (e) {
      }
    }
    live.clear();
  }
  let vi = 0;
  const vary = (spread) => {
    vi = (vi + 1) % 5;
    return (vi - 2) * spread;
  };
  const waves = /* @__PURE__ */ new Map();
  function pulse(duty) {
    let w = waves.get(duty);
    if (!w) {
      const n = 24;
      const real = new Float32Array(n), imag = new Float32Array(n);
      for (let i = 1; i < n; i++) imag[i] = 2 / (i * Math.PI) * Math.sin(i * Math.PI * duty);
      w = ac.createPeriodicWave(real, imag);
      waves.set(duty, w);
    }
    return w;
  }
  function pulseSafe(duty) {
    return ac ? pulse(duty) : "square";
  }
  let whiteBuf = null, crushBuf = null;
  function noiseBuffer(crushed) {
    if (crushed && crushBuf) return crushBuf;
    if (!crushed && whiteBuf) return whiteBuf;
    const len = Math.max(1, Math.floor(ac.sampleRate));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    if (crushed) {
      let held = 0;
      for (let i = 0; i < len; i++) {
        if (i % 12 === 0) held = Math.round((Math.random() * 2 - 1) * 8) / 8;
        d[i] = held;
      }
      crushBuf = buf;
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      whiteBuf = buf;
    }
    return buf;
  }
  function osc(type, freq, t) {
    const o = ac.createOscillator();
    if (typeof type === "string") o.type = type;
    else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(freq, t);
    return o;
  }
  const PAN_SPREAD = 0.62;
  function panOf(col) {
    if (col === void 0 || col === null) return 0;
    return Math.max(-1, Math.min(1, (col - (COLS - 1) / 2) / ((COLS - 1) / 2) * PAN_SPREAD));
  }
  function panner(pan, t) {
    if (!pan || !ac.createStereoPanner) return null;
    const n = ac.createStereoPanner();
    n.pan.setValueAtTime(pan, t);
    return n;
  }
  function gain(v, t) {
    const g = ac.createGain();
    g.gain.setValueAtTime(v, t);
    return g;
  }
  function filt(type, freq, q, t) {
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (q !== void 0) f.Q.setValueAtTime(q, t);
    return f;
  }
  function bufSrc(crushed, t) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuffer(crushed);
    s.loop = true;
    s.playbackRate.setValueAtTime(1, t);
    return s;
  }
  function perc(param, t, peak, a, dur) {
    param.setValueAtTime(1e-4, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.exponentialRampToValueAtTime(1e-4, t + dur);
    param.setValueAtTime(0, t + dur + 1e-3);
  }
  function tone(o) {
    if (!audible()) return null;
    const dest = o.dest || sfxBus;
    const t = ac.currentTime + (o.delay || 0);
    const dur = o.dur || 0.1;
    const src = osc(o.wave || "square", o.freq, t);
    if (o.detune) src.detune.setValueAtTime(o.detune, t);
    if (o.to) src.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide || dur));
    const g = gain(0, t);
    perc(g.gain, t, o.gain === void 0 ? 0.1 : o.gain, o.attack === void 0 ? 4e-3 : o.attack, dur);
    if (o.filter) {
      const f = filt(o.filter, o.cutoff, o.q, t);
      if (o.cutoffTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.cutoffTo), t + dur);
      src.connect(f);
      f.connect(g);
    } else {
      src.connect(g);
    }
    const pn = panner(o.pan, t);
    if (pn) {
      g.connect(pn);
      pn.connect(dest);
    } else {
      g.connect(dest);
    }
    src.start(t);
    track(src, t + dur + 0.03);
    return src;
  }
  function hiss(o) {
    if (!audible()) return null;
    const dest = o.dest || sfxBus;
    const t = ac.currentTime + (o.delay || 0);
    const dur = o.dur || 0.06;
    const s = bufSrc(!!o.crushed, t);
    const f = filt(o.filter || "highpass", o.cutoff || 2e3, o.q, t);
    if (o.cutoffTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.cutoffTo), t + dur);
    const g = gain(0, t);
    perc(g.gain, t, o.gain === void 0 ? 0.1 : o.gain, o.attack === void 0 ? 2e-3 : o.attack, dur);
    s.connect(f);
    f.connect(g);
    const pn = panner(o.pan, t);
    if (pn) {
      g.connect(pn);
      pn.connect(dest);
    } else {
      g.connect(dest);
    }
    s.start(t, 0.5 + vary(0.07));
    track(s, t + dur + 0.02);
    return s;
  }
  function seq(notes, o) {
    o = o || {};
    const step2 = o.step || 0.06;
    const dur = o.dur || 0.09;
    const g = o.gain === void 0 ? 0.14 : o.gain;
    for (let i = 0; i < notes.length; i++) {
      tone({
        wave: o.wave || pulseSafe(0.25),
        freq: hz(notes[i]),
        dur,
        gain: g,
        delay: (o.delay || 0) + i * step2,
        dest: o.dest,
        filter: "lowpass",
        cutoff: 6e3,
        q: 0.7
      });
      if (o.octave) {
        tone({
          wave: "triangle",
          freq: hz(notes[i] + 12),
          dur: dur * 0.8,
          gain: g * 0.45,
          delay: (o.delay || 0) + i * step2,
          dest: o.dest
        });
      }
    }
  }
  function blast(size, pan, delay) {
    const d = delay || 0;
    const dur = 0.1 + 0.34 * size;
    hiss({
      dur: 0.02 + 0.02 * size,
      filter: "highpass",
      cutoff: 1800,
      q: 0.6,
      gain: 0.1 + 0.13 * size,
      delay: d,
      pan
    });
    hiss({
      dur,
      filter: "lowpass",
      cutoff: 4200 + 3e3 * size,
      cutoffTo: 180,
      q: 3 + 7 * size,
      gain: 0.1 + 0.16 * size,
      delay: d + 6e-3,
      crushed: true,
      pan
    });
    hiss({
      dur: dur * 0.7,
      filter: "bandpass",
      cutoff: 1400,
      cutoffTo: 300,
      q: 2,
      gain: 0.05 + 0.08 * size,
      delay: d + 0.03 + 0.03 * size,
      crushed: true,
      pan
    });
    tone({
      wave: "sine",
      freq: 120 - 40 * size,
      to: (120 - 40 * size) * 0.66,
      glide: dur,
      dur: dur + 0.09 * size,
      gain: 0.16 + 0.16 * size,
      attack: 6e-3,
      delay: d,
      pan
    });
  }
  function duckMusic(depth, hold) {
    if (dead || !ac || !duck) return;
    const t = ac.currentTime;
    const g = duck.gain;
    try {
      g.cancelScheduledValues(t);
    } catch (e) {
    }
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(Math.max(0.05, 1 - depth), t + 0.012);
    g.linearRampToValueAtTime(1, t + 0.012 + hold);
  }
  const CHAIN_LADDER = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];
  const sfx = {
    /** The buster. Fired constantly, so: short, bright and never fatiguing. */
    shoot() {
      const d = vary(14);
      hiss({ dur: 0.035, cutoff: 5200, cutoffTo: 2600, q: 1, gain: 0.075 });
      tone({
        wave: pulseSafe(0.25),
        freq: 1180 + d,
        to: 420,
        glide: 0.05,
        dur: 0.07,
        gain: 0.11,
        filter: "lowpass",
        cutoff: 7e3,
        q: 1
      });
      tone({ wave: "triangle", freq: 300 + d, to: 150, dur: 0.06, gain: 0.05 });
    },
    /** The payoff of a held button: a detuned saw cannon, a sub and a whoosh. */
    charged() {
      duckMusic(0.35, 0.28);
      hiss({ dur: 0.28, filter: "bandpass", cutoff: 900, cutoffTo: 5200, q: 1.2, gain: 0.1 });
      for (const dt of [-9, 0, 9]) {
        tone({
          wave: "sawtooth",
          freq: 300,
          to: 96,
          glide: 0.22,
          detune: dt,
          dur: 0.3,
          gain: 0.1,
          attack: 6e-3,
          filter: "lowpass",
          cutoff: 4200,
          cutoffTo: 420,
          q: 6
        });
      }
      tone({ wave: "sine", freq: 150, to: 44, glide: 0.24, dur: 0.34, gain: 0.22, attack: 8e-3 });
      tone({ wave: pulseSafe(0.5), freq: 1400, to: 500, dur: 0.09, gain: 0.06 });
    },
    /**
     * A deletion. The pitch climbs with the chain, which is the whole game
     * loop. Body + transient + tail, heavier for a charged kill.
     */
    hit(chain, heavy, pan) {
      const i = Math.min(Math.max(chain, 1) - 1, CHAIN_LADDER.length - 1);
      const n = CHAIN_LADDER[i];
      const maxed = chain - 1 >= CHAIN_LADDER.length;
      duckMusic(heavy ? 0.42 : 0.26, heavy ? 0.24 : 0.15);
      blast(heavy ? 0.62 : 0.3, pan);
      hiss({ dur: 0.05, cutoff: 3400, cutoffTo: 1200, q: 1, gain: heavy ? 0.14 : 0.09, pan });
      tone({
        wave: pulseSafe(0.35),
        freq: hz(n),
        to: hz(n) * 0.55,
        glide: 0.1,
        dur: heavy ? 0.18 : 0.13,
        gain: heavy ? 0.17 : 0.13,
        pan,
        filter: "lowpass",
        cutoff: 9e3,
        cutoffTo: 2200,
        q: 1
      });
      tone({
        wave: pulseSafe(0.35),
        freq: hz(n) * 1.005,
        to: hz(n) * 0.55,
        glide: 0.1,
        dur: heavy ? 0.18 : 0.13,
        gain: heavy ? 0.1 : 0.07,
        delay: 6e-3
      });
      tone({
        wave: "triangle",
        freq: heavy ? 190 : 260,
        to: heavy ? 52 : 90,
        dur: heavy ? 0.22 : 0.14,
        gain: heavy ? 0.2 : 0.11
      });
      if (heavy) {
        tone({
          wave: "sawtooth",
          freq: hz(n - 12),
          to: hz(n - 12) * 0.5,
          glide: 0.2,
          dur: 0.26,
          gain: 0.08,
          filter: "lowpass",
          cutoff: 3200,
          cutoffTo: 400,
          q: 5
        });
        tone({ wave: "sine", freq: 70, to: 40, dur: 0.3, gain: 0.16, attack: 8e-3 });
        hiss({
          dur: 0.22,
          filter: "lowpass",
          cutoff: 2400,
          cutoffTo: 300,
          q: 2,
          gain: 0.07,
          delay: 0.02,
          crushed: true
        });
      }
      if (maxed) {
        tone({ wave: "sine", freq: hz(n + 12), dur: 0.24, gain: 0.06, delay: 0.02 });
        tone({ wave: "sine", freq: hz(n + 19), dur: 0.2, gain: 0.04, delay: 0.05 });
      }
    },
    /** Steel guard cracked open: inharmonic ring, crunch, and a sub drop. */
    guardBreak(pan) {
      duckMusic(0.5, 0.36);
      blast(0.8, pan);
      hiss({ dur: 0.09, filter: "highpass", cutoff: 2600, q: 0.8, gain: 0.16, crushed: true });
      for (const [f, g, d] of [[1830, 0.09, 0.34], [2710, 0.07, 0.28], [4390, 0.05, 0.2]]) {
        tone({ wave: "sine", freq: f, dur: d, gain: g, filter: "bandpass", cutoff: f, q: 14 });
      }
      tone({
        wave: "sawtooth",
        freq: 220,
        to: 55,
        glide: 0.26,
        dur: 0.34,
        gain: 0.16,
        filter: "lowpass",
        cutoff: 2600,
        cutoffTo: 260,
        q: 8
      });
      tone({ wave: "sine", freq: 110, to: 38, dur: 0.4, gain: 0.24, attack: 0.01 });
      hiss({
        dur: 0.3,
        filter: "lowpass",
        cutoff: 1400,
        cutoffTo: 200,
        q: 3,
        gain: 0.1,
        delay: 0.02,
        crushed: true
      });
    },
    /** Jackpot: a rising run, a bright held chord, sparkle. Unmistakable. */
    rareGet(pan) {
      duckMusic(0.62, 0.9);
      blast(1, pan);
      seq([69, 76, 81, 88, 93, 100], { step: 0.055, dur: 0.075, gain: 0.13, octave: true });
      for (const n of [81, 85, 88, 93]) {
        tone({
          wave: pulseSafe(0.5),
          freq: hz(n),
          dur: 0.55,
          gain: 0.075,
          delay: 0.33,
          attack: 0.01,
          filter: "lowpass",
          cutoff: 8e3,
          q: 0.7
        });
        tone({ wave: "sawtooth", freq: hz(n), detune: 8, dur: 0.5, gain: 0.03, delay: 0.33, attack: 0.02 });
      }
      tone({ wave: "sine", freq: hz(45), dur: 0.5, gain: 0.2, delay: 0.33, attack: 0.01 });
      hiss({
        dur: 0.5,
        filter: "highpass",
        cutoff: 5e3,
        cutoffTo: 11e3,
        q: 0.7,
        gain: 0.05,
        delay: 0.33
      });
    },
    /** A rare has surfaced and you have 650ms. An alert, not a decoration. */
    rareSpawn() {
      seq([88, 95, 100], { step: 0.055, dur: 0.06, gain: 0.11, octave: true });
      tone({ wave: "sine", freq: hz(100), dur: 0.3, gain: 0.045, delay: 0.11 });
    },
    /** A prog is surfacing: a soft, friendly two-note "hold fire". */
    progWarn() {
      tone({ wave: "sine", freq: hz(74), dur: 0.11, gain: 0.05 });
      tone({ wave: "sine", freq: hz(69), dur: 0.16, gain: 0.05, delay: 0.09 });
    },
    /** Wrong tool: a normal shot off steel. Hard, metallic, short. */
    plink() {
      hiss({ dur: 0.045, filter: "bandpass", cutoff: 5200, q: 5, gain: 0.13 });
      tone({
        wave: "square",
        freq: 2400,
        to: 1900,
        dur: 0.05,
        gain: 0.06,
        filter: "bandpass",
        cutoff: 3e3,
        q: 9
      });
      tone({ wave: "sine", freq: 6100, dur: 0.09, gain: 0.03, filter: "bandpass", cutoff: 6100, q: 18 });
    },
    /** A hopper took a tap and bolted. Rubbery — "one more". */
    stagger() {
      tone({ wave: "triangle", freq: 420, to: 900, glide: 0.05, dur: 0.09, gain: 0.11 });
      tone({ wave: pulseSafe(0.15), freq: 900, to: 300, glide: 0.08, dur: 0.1, gain: 0.06, delay: 0.05 });
      hiss({ dur: 0.03, cutoff: 4e3, gain: 0.05 });
    },
    /** Hopper movement. Deliberately tiny: texture, not an event. */
    hop() {
      tone({ wave: "triangle", freq: 300, to: 460, glide: 0.035, dur: 0.045, gain: 0.045 });
    },
    /** Charge complete. Bright, and it hands over to the idle hum. */
    ready() {
      tone({ wave: pulseSafe(0.25), freq: hz(81), dur: 0.07, gain: 0.11 });
      tone({ wave: pulseSafe(0.25), freq: hz(88), dur: 0.14, gain: 0.11, delay: 0.055 });
      tone({ wave: "sine", freq: hz(93), dur: 0.2, gain: 0.05, delay: 0.055 });
      hiss({ dur: 0.14, filter: "highpass", cutoff: 6e3, cutoffTo: 12e3, q: 0.7, gain: 0.045 });
    },
    /** ×2 / ×3 / ×4. A real fanfare, and it grows with the multiplier. */
    rankup(mult) {
      duckMusic(0.4, 0.5);
      if (mult >= 4) {
        seq([69, 73, 76, 81, 85, 88, 93], { step: 0.05, dur: 0.07, gain: 0.13, octave: true });
        for (const n of [81, 85, 88]) {
          tone({ wave: "sawtooth", freq: hz(n), detune: 7, dur: 0.6, gain: 0.045, delay: 0.35, attack: 0.02 });
          tone({ wave: "sawtooth", freq: hz(n), detune: -7, dur: 0.6, gain: 0.045, delay: 0.35, attack: 0.02 });
        }
        tone({ wave: "sine", freq: hz(45), dur: 0.6, gain: 0.18, delay: 0.35, attack: 0.01 });
        hiss({
          dur: 0.45,
          filter: "highpass",
          cutoff: 4e3,
          cutoffTo: 12e3,
          q: 0.7,
          gain: 0.05,
          delay: 0.32
        });
      } else if (mult === 3) {
        seq([72, 76, 79, 84], { step: 0.055, dur: 0.08, gain: 0.13, octave: true });
        tone({ wave: "sine", freq: hz(48), dur: 0.35, gain: 0.15, delay: 0.16, attack: 8e-3 });
        hiss({
          dur: 0.3,
          filter: "highpass",
          cutoff: 5e3,
          cutoffTo: 1e4,
          q: 0.7,
          gain: 0.04,
          delay: 0.16
        });
      } else {
        seq([72, 76, 79], { step: 0.06, dur: 0.09, gain: 0.12 });
        tone({ wave: "sine", freq: hz(48), dur: 0.3, gain: 0.13, delay: 0.12, attack: 8e-3 });
      }
    },
    /**
     * A chain worth having, gone. A deflating minor fall.
     *
     * `after` pushes it behind the impact that caused it: the core emits
     * `chainBroken` *before* `playerHit` / `progHit`, and the loss should land
     * as the consequence of the hit, not underneath it.
     */
    chainLost(chain, after) {
      const big = chain >= 10;
      const d = after || 0;
      duckMusic(0.2, 0.3 + d);
      seq([69, 66, 62], { step: 0.075, dur: 0.11, gain: big ? 0.1 : 0.075, wave: "triangle", delay: d });
      tone({
        wave: "sawtooth",
        freq: 190,
        to: 60,
        glide: 0.34,
        dur: 0.4,
        gain: big ? 0.09 : 0.06,
        filter: "lowpass",
        cutoff: 1600,
        cutoffTo: 260,
        q: 3,
        delay: d + 0.05
      });
    },
    /** Every second under six. Two beeps; tighter and higher when it is dire. */
    alarm(dire) {
      const f = dire ? hz(81) : hz(76);
      const gap = dire ? 0.11 : 0.16;
      for (let i = 0; i < 2; i++) {
        tone({
          wave: "sawtooth",
          freq: f,
          dur: 0.09,
          gain: dire ? 0.09 : 0.065,
          delay: i * gap,
          filter: "bandpass",
          cutoff: f * 2,
          q: 3
        });
        tone({ wave: "square", freq: f / 2, dur: 0.09, gain: dire ? 0.05 : 0.035, delay: i * gap });
      }
    },
    /** You shot a friendly. The anti-spam tax should sound like a mistake. */
    allyHit() {
      duckMusic(0.6, 0.5);
      tone({
        wave: "sawtooth",
        freq: 116,
        dur: 0.42,
        gain: 0.13,
        attack: 6e-3,
        filter: "lowpass",
        cutoff: 2e3,
        cutoffTo: 400,
        q: 4
      });
      tone({ wave: "sawtooth", freq: 123, dur: 0.42, gain: 0.13, attack: 6e-3 });
      tone({ wave: "square", freq: 520, to: 180, glide: 0.34, dur: 0.4, gain: 0.08 });
      hiss({
        dur: 0.35,
        filter: "lowpass",
        cutoff: 2600,
        cutoffTo: 300,
        q: 2,
        gain: 0.1,
        crushed: true
      });
    },
    /** A prog reached cover untouched. Small, warm, and worth +0.5s. */
    spared() {
      tone({ wave: "triangle", freq: hz(76), dur: 0.1, gain: 0.055 });
      tone({ wave: "triangle", freq: hz(83), dur: 0.16, gain: 0.055, delay: 0.075 });
    },
    /** Taking a bolt. Meant to be genuinely unpleasant. */
    hurt(pan) {
      duckMusic(0.94, 0.6);
      blast(0.85, pan);
      hiss({
        dur: 0.34,
        filter: "lowpass",
        cutoff: 4200,
        cutoffTo: 180,
        q: 12,
        gain: 0.3,
        crushed: true,
        delay: 0.025,
        pan
      });
      hiss({
        dur: 0.06,
        filter: "highpass",
        cutoff: 900,
        q: 0.7,
        gain: 0.26,
        pan
      });
      tone({
        wave: "sawtooth",
        freq: 196,
        to: 62,
        glide: 0.34,
        dur: 0.42,
        gain: 0.14,
        attack: 2e-3,
        filter: "lowpass",
        cutoff: 2600,
        cutoffTo: 240,
        q: 6
      });
      tone({ wave: "sawtooth", freq: 277, to: 88, glide: 0.34, dur: 0.42, gain: 0.11, attack: 2e-3 });
      tone({ wave: "square", freq: 58, dur: 0.6, gain: 0.2, attack: 4e-3, pan });
      tone({
        wave: "sawtooth",
        freq: 150,
        to: 66,
        glide: 0.5,
        dur: 0.62,
        gain: 0.07,
        attack: 0.05,
        delay: 0.12,
        filter: "bandpass",
        cutoff: 520,
        q: 7,
        pan
      });
      tone({
        wave: pulseSafe(0.1),
        freq: 330,
        to: 150,
        glide: 0.2,
        dur: 0.22,
        gain: 0.07,
        filter: "bandpass",
        cutoff: 800,
        q: 4,
        delay: 0.02
      });
    },
    /** A virus has marked your row. Pure gameplay information — it must read. */
    aim(pan) {
      tone({
        wave: "sawtooth",
        freq: 210,
        to: 430,
        glide: 0.16,
        dur: 0.18,
        gain: 0.055,
        filter: "bandpass",
        cutoff: 900,
        cutoffTo: 1900,
        q: 5,
        pan
      });
      tone({ wave: "square", freq: 1500, dur: 0.035, gain: 0.035, pan });
      tone({ wave: "square", freq: 1500, dur: 0.035, gain: 0.035, delay: 0.1, pan });
    },
    /** Bolt away. Heavy (a guard's) is lower, so you can hear which is coming. */
    bolt(heavy, pan) {
      hiss({
        dur: heavy ? 0.09 : 0.05,
        filter: "bandpass",
        cutoff: heavy ? 900 : 2200,
        cutoffTo: heavy ? 300 : 900,
        q: 2,
        gain: heavy ? 0.11 : 0.07,
        pan
      });
      tone({
        wave: heavy ? "sawtooth" : "square",
        freq: heavy ? 300 : 520,
        to: heavy ? 90 : 190,
        glide: 0.1,
        dur: heavy ? 0.16 : 0.1,
        gain: heavy ? 0.1 : 0.065,
        pan,
        filter: "lowpass",
        cutoff: heavy ? 2200 : 5e3,
        q: 2
      });
      if (heavy) tone({ wave: "sine", freq: 110, to: 50, dur: 0.2, gain: 0.1, pan });
    },
    /**
     * A wave wiped out. Short and bright — it lands in the lull that follows,
     * so it has room, but it must not compete with the next wave arriving.
     * Scaled by how big the wave was.
     */
    waveClear(n) {
      const size = Math.min(1, (n || 1) / 5);
      duckMusic(0.3, 0.3);
      seq([76, 81, 88], { step: 0.05, dur: 0.07, gain: 0.09 + 0.04 * size, octave: size > 0.6 });
      tone({ wave: "sine", freq: hz(57), dur: 0.3, gain: 0.1, attack: 6e-3 });
    },
    /**
     * The interlevel card used to be about 1.4s of dead air after the sting's
     * tail. A quiet held pad under it: the run has not ended, it is holding.
     */
    cardPad() {
      for (const n of [45, 57, 64]) {
        tone({
          wave: "sawtooth",
          freq: hz(n),
          detune: n === 57 ? 7 : -5,
          dur: 2.6,
          gain: 0.035,
          attack: 0.35,
          delay: 0.5,
          filter: "lowpass",
          cutoff: 1400,
          q: 0.8
        });
      }
    },
    /** Credit accepted. Also the proof that audio unlocked on the gesture. */
    boot() {
      seq([57, 64, 69], { step: 0.07, dur: 0.06, gain: 0.11 });
      tone({ wave: pulseSafe(0.5), freq: hz(81), dur: 0.22, gain: 0.11, delay: 0.21 });
      tone({ wave: "sine", freq: hz(45), dur: 0.3, gain: 0.16, delay: 0.21, attack: 6e-3 });
      hiss({ dur: 0.24, filter: "highpass", cutoff: 400, cutoffTo: 9e3, q: 1, gain: 0.06 });
    },
    /** A stage gate. Its own motif — this is not another multiplier. */
    stageSting() {
      seq([64, 69, 71, 76], { step: 0.1, dur: 0.11, gain: 0.13, octave: true });
      for (const n of [64, 71, 76]) {
        tone({ wave: "sawtooth", freq: hz(n), detune: 6, dur: 0.7, gain: 0.045, delay: 0.3, attack: 0.03 });
        tone({ wave: "sawtooth", freq: hz(n), detune: -6, dur: 0.7, gain: 0.045, delay: 0.3, attack: 0.03 });
      }
      tone({ wave: "sine", freq: hz(40), dur: 0.7, gain: 0.2, delay: 0.3, attack: 0.01 });
      hiss({
        dur: 0.4,
        filter: "highpass",
        cutoff: 3e3,
        cutoffTo: 11e3,
        q: 0.7,
        gain: 0.05,
        delay: 0.28
      });
    },
    /** Run over: a minor cadence into a power-down. */
    over() {
      seq([69, 65, 62, 57], { step: 0.16, dur: 0.2, gain: 0.11, wave: "square" });
      tone({
        wave: "sawtooth",
        freq: 400,
        to: 34,
        glide: 1.1,
        dur: 1.25,
        gain: 0.11,
        delay: 0.62,
        attack: 0.02,
        filter: "lowpass",
        cutoff: 3e3,
        cutoffTo: 140,
        q: 4
      });
      tone({ wave: "square", freq: 200, to: 24, glide: 1.1, dur: 1.2, gain: 0.06, delay: 0.62, attack: 0.02 });
    },
    /** UI: the run stopped, or started again. Confirmation, nothing more. */
    pauseBlip(down) {
      seq(down ? [76, 69] : [69, 76], { step: 0.07, dur: 0.07, gain: 0.07, wave: "triangle" });
    },
    /** A step across the grid. Below the buster in level; reads as a footfall. */
    step() {
      hiss({ dur: 0.022, filter: "bandpass", cutoff: 2600, q: 1.5, gain: 0.035 });
      tone({ wave: "triangle", freq: 180, to: 120, dur: 0.03, gain: 0.03 });
    }
  };
  let chargeVoices = null;
  function chargeStart() {
    chargeStop(0);
    if (!audible()) return;
    const t = ac.currentTime;
    const secs = CHARGE_MS2 / 1e3;
    const out = gain(0, t);
    out.gain.linearRampToValueAtTime(0.075, t + secs * 0.75);
    out.connect(sfxBus);
    const f = filt("lowpass", 300, 7, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + secs);
    f.connect(out);
    const oscs = [];
    for (const dt of [-6, 6]) {
      const o = osc("sawtooth", 150, t);
      o.detune.setValueAtTime(dt, t);
      o.frequency.exponentialRampToValueAtTime(560, t + secs);
      o.connect(f);
      o.start(t);
      track(o);
      oscs.push(o);
    }
    const lfo = osc("sine", 6, t);
    lfo.frequency.exponentialRampToValueAtTime(22, t + secs);
    const lfoAmt = gain(0.035, t);
    lfo.connect(lfoAmt);
    lfoAmt.connect(out.gain);
    lfo.start(t);
    track(lfo);
    chargeVoices = { out, oscs, lfo };
  }
  function chargeStop(fade) {
    const cv = chargeVoices;
    chargeVoices = null;
    if (!cv || !ac) return;
    const t = ac.currentTime;
    const f = fade === void 0 ? 0.06 : fade;
    try {
      cv.out.gain.cancelScheduledValues(t);
      cv.out.gain.setValueAtTime(cv.out.gain.value, t);
      cv.out.gain.linearRampToValueAtTime(0, t + f);
    } catch (e) {
    }
    for (const o of cv.oscs.concat([cv.lfo])) {
      try {
        o.stop(t + f + 0.02);
      } catch (e) {
      }
    }
  }
  function chargeFullNow() {
    const cv = chargeVoices;
    if (!cv || !ac) {
      sfx.ready();
      return;
    }
    const t = ac.currentTime;
    try {
      cv.out.gain.cancelScheduledValues(t);
      cv.out.gain.setValueAtTime(cv.out.gain.value, t);
      cv.out.gain.linearRampToValueAtTime(0, t + 0.05);
      cv.out.gain.linearRampToValueAtTime(0.03, t + 0.22);
    } catch (e) {
    }
    for (const o of cv.oscs) {
      try {
        o.frequency.cancelScheduledValues(t);
        o.frequency.setValueAtTime(o.frequency.value, t);
        o.frequency.linearRampToValueAtTime(660, t + 0.12);
      } catch (e) {
      }
    }
    try {
      cv.lfo.frequency.cancelScheduledValues(t);
      cv.lfo.frequency.setValueAtTime(cv.lfo.frequency.value, t);
      cv.lfo.frequency.linearRampToValueAtTime(13, t + 0.12);
    } catch (e) {
    }
    sfx.ready();
  }
  const music = {
    running: false,
    // the transport is advancing
    playing: false,
    // …and audible (not paused, not behind a card)
    step: 0,
    // global sixteenth index
    nextAt: 0,
    // ac.currentTime at which the next step sounds
    tier: 0,
    lowTime: false,
    startAfter: 0,
    // hold the downbeat until here, so a jingle lands first
    timer: null
  };
  function stepDur() {
    const bpm = BPM[music.tier] + (music.lowTime ? 10 : 0);
    return 60 / bpm / 4;
  }
  function bass(t, root, dur) {
    const g = gain(0, t);
    perc(g.gain, t, 0.5, 5e-3, dur);
    const f = filt("lowpass", music.tier >= 2 ? 1400 : 900, 4, t);
    f.frequency.exponentialRampToValueAtTime(300, t + dur);
    f.connect(g);
    g.connect(musicBus);
    for (const dt of [-8, 8]) {
      const o = osc("sawtooth", hz(root), t);
      o.detune.setValueAtTime(dt, t);
      o.connect(f);
      o.start(t);
      track(o, t + dur + 0.02);
    }
    const sub = osc("triangle", hz(root - 12), t);
    const sg = gain(0, t);
    perc(sg.gain, t, 0.42, 5e-3, dur);
    sub.connect(sg);
    sg.connect(musicBus);
    sub.start(t);
    track(sub, t + dur + 0.02);
  }
  function lead(t, note, dur, oc) {
    const o = osc(pulse(oc ? 0.125 : 0.25), hz(note), t);
    const g = gain(0, t);
    perc(g.gain, t, 0.2, 4e-3, dur);
    const f = filt("lowpass", 5200, 1, t);
    o.connect(f);
    f.connect(g);
    g.connect(musicBus);
    o.start(t);
    track(o, t + dur + 0.02);
    if (oc) {
      const o2 = osc(pulse(0.5), hz(note + 12), t);
      o2.detune.setValueAtTime(14, t);
      const g2 = gain(0, t);
      perc(g2.gain, t, 0.09, 4e-3, dur * 0.8);
      o2.connect(g2);
      g2.connect(musicBus);
      o2.start(t);
      track(o2, t + dur + 0.02);
    }
  }
  function stab(t, root, oc) {
    for (const iv of oc ? [0, 3, 6] : [0, 3, 7]) {
      const o = osc(pulse(0.5), hz(root + 24 + iv), t);
      const g = gain(0, t);
      perc(g.gain, t, 0.075, 3e-3, 0.075);
      o.connect(g);
      g.connect(musicBus);
      o.start(t);
      track(o, t + 0.1);
    }
  }
  function kick(t) {
    const o = osc("sine", 160, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.085);
    const g = gain(0, t);
    perc(g.gain, t, 0.85, 2e-3, 0.19);
    o.connect(g);
    g.connect(musicBus);
    o.start(t);
    track(o, t + 0.22);
    const n = bufSrc(true, t);
    const f = filt("highpass", 1600, 1, t);
    const ng = gain(0, t);
    perc(ng.gain, t, 0.16, 1e-3, 0.02);
    n.connect(f);
    f.connect(ng);
    ng.connect(musicBus);
    n.start(t, 0.3);
    track(n, t + 0.04);
  }
  function snare(t) {
    const n = bufSrc(false, t);
    const f = filt("bandpass", 1900, 0.9, t);
    const g = gain(0, t);
    perc(g.gain, t, 0.34, 2e-3, 0.14);
    n.connect(f);
    f.connect(g);
    g.connect(musicBus);
    n.start(t, 0.5 + vary(0.09));
    track(n, t + 0.16);
    const o = osc("triangle", 210, t);
    const og = gain(0, t);
    perc(og.gain, t, 0.18, 2e-3, 0.09);
    o.connect(og);
    og.connect(musicBus);
    o.start(t);
    track(o, t + 0.11);
  }
  function hat(t, open) {
    const n = bufSrc(true, t);
    const f = filt("highpass", 7200, 0.8, t);
    const g = gain(0, t);
    perc(g.gain, t, open ? 0.11 : 0.07, 1e-3, open ? 0.09 : 0.028);
    n.connect(f);
    f.connect(g);
    g.connect(musicBus);
    n.start(t, 0.5 + vary(0.11));
    track(n, t + (open ? 0.11 : 0.04));
  }
  function scheduleStep(i, t) {
    const tier = music.tier;
    const oc = tier === 3;
    const s = i % STEPS;
    const absBar = Math.floor(i / STEPS) % FORM_BARS;
    const bar = absBar % BARS;
    const phrase = Math.floor(absBar / BARS);
    const bSection = PH_BSECTION[phrase];
    const root = (oc ? PROG_OC : PROG_MAIN)[bar] + (bSection && !oc ? 3 : 0);
    const arp = oc || bSection ? ARP_DIM : ARP_MIN;
    const sd = stepDur();
    const fill = bar === BARS - 1 && s >= 8;
    if ((music.lowTime ? KICK_LOW_TIME : KICK[tier])[s] === "x") kick(t);
    if (SNARE[tier][s] === "x" || fill && tier >= 1 && s % 2 === 0) snare(t);
    if (HAT[tier][s] === "x" || fill && s % 2 === 1) hat(t, s % 8 === 6 || fill && s === 15);
    if (s % 2 === 0 || tier >= 2 && s % 4 === 3) {
      bass(t, root + (s % 8 === 6 ? 12 : 0), sd * (tier >= 2 ? 1.5 : 2.4));
    }
    if (!music.lowTime && LEAD[tier][s] === "x") {
      lead(
        t,
        root + 24 + PH_LEAD_OCT[phrase] + arp[(i + bar + phrase) % arp.length],
        sd * 1.6,
        oc
      );
    }
    if (STAB[tier][s] === "x" || PH_STABS[phrase] && tier >= 1 && s === 10) {
      stab(t, root, oc);
    }
  }
  function pump() {
    if (dead || !music.running || !ac) return;
    const horizon = ac.currentTime + LOOKAHEAD;
    let guard = 256;
    while (music.nextAt < horizon && guard-- > 0) {
      if (on && music.playing && music.nextAt >= music.startAfter) {
        scheduleStep(music.step, music.nextAt);
      }
      music.step = (music.step + 1) % (STEPS * FORM_BARS);
      music.nextAt += stepDur();
    }
    schedulePump();
  }
  function schedulePump() {
    clearPump();
    if (!music.running || dead) return;
    music.timer = (win.setTimeout || setTimeout).call(win, pump, PUMP_MS);
  }
  function clearPump() {
    if (music.timer !== null) {
      (win.clearTimeout || clearTimeout).call(win, music.timer);
      music.timer = null;
    }
  }
  function musicStart(delaySec) {
    if (!ctx()) return;
    const d = delaySec || 0;
    music.step = 0;
    music.running = true;
    music.playing = true;
    music.nextAt = ac.currentTime + 0.06 + d;
    music.startAfter = ac.currentTime + d;
    rampMusic(MUSIC_GAIN, 0.12 + d);
    pump();
  }
  function musicHold() {
    if (!music.running) return;
    music.playing = false;
    rampMusic(0, 0.07);
  }
  function musicResume() {
    if (!ctx() || !music.running) return;
    music.playing = true;
    music.nextAt = ac.currentTime + 0.06;
    music.startAfter = 0;
    rampMusic(MUSIC_GAIN, 0.1);
    pump();
  }
  function musicStop() {
    music.running = false;
    music.playing = false;
    music.step = 0;
    clearPump();
    rampMusic(0, 0.12);
  }
  function rampMusic(to, secs) {
    if (!ac || !musicBus) return;
    const t = ac.currentTime;
    const g = musicBus.gain;
    try {
      g.cancelScheduledValues(t);
    } catch (e) {
    }
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + secs);
  }
  function handle(ev) {
    if (dead) return;
    switch (ev.type) {
      case "shot":
        (ev.tier === "charged" ? sfx.charged : sfx.shoot)();
        break;
      case "hit": {
        const p = panOf(ev.col);
        if (ev.enemyType === "rare") sfx.rareGet(p);
        else if (ev.enemyType === "guard") sfx.guardBreak(p);
        else sfx.hit(ev.chain || 1, ev.tier === "charged", p);
        break;
      }
      case "guardBlocked":
        sfx.plink();
        break;
      case "hopperStagger":
        sfx.stagger();
        break;
      case "hopperHop":
        sfx.hop();
        break;
      case "multiplierUp":
        sfx.rankup(ev.mult || 2);
        break;
      case "chainBroken":
        if ((ev.chain || 0) >= 5) sfx.chainLost(ev.chain, ev.cause === "whiff" ? 0 : 0.22);
        break;
      case "progHit":
        sfx.allyHit();
        break;
      case "allySpared":
        sfx.spared();
        break;
      case "playerHit":
        sfx.hurt(panOf(ev.col));
        break;
      case "playerMoved":
        sfx.step();
        break;
      case "enemySpawned":
        if (ev.enemyType === "rare") sfx.rareSpawn();
        else if (ev.enemyType === "ally") sfx.progWarn();
        break;
      case "enemyAim":
        sfx.aim(panOf(ev.col));
        break;
      case "enemyFired":
        sfx.bolt(!!ev.heavy, panOf(ev.col));
        break;
      case "runStarted":
        alarmAt = 0;
        sfx.boot();
        musicStart(0.5);
        break;
      case "paused":
        sfx.pauseBlip(true);
        break;
      case "unpaused":
        sfx.pauseBlip(false);
        break;
      case "stageGate":
        sfx.stageSting();
        sfx.cardPad();
        break;
      case "bombThrown":
        hiss({ dur: 0.22, filter: "bandpass", cutoff: 500, cutoffTo: 2400, q: 1.5, gain: 0.08, pan: panOf(ev.col) });
        tone({ wave: "triangle", freq: 220, to: 520, glide: 0.2, dur: 0.22, gain: 0.05, pan: panOf(ev.col) });
        break;
      case "bombBlast":
        duckMusic(0.7, 0.5);
        blast(1, panOf(ev.col));
        tone({ wave: "sine", freq: 60, to: 34, glide: 0.5, dur: 0.6, gain: 0.26, attack: 6e-3, pan: panOf(ev.col) });
        break;
      case "pickup":
        seq([76, 83, 88], { step: 0.05, dur: 0.07, gain: 0.1, octave: true });
        break;
      case "sentinelHit":
        tone({ wave: "sine", freq: 1320, dur: 0.14, gain: 0.07, filter: "bandpass", cutoff: 1320, q: 12, pan: panOf(ev.col) });
        tone({ wave: "square", freq: 330, to: 200, dur: 0.08, gain: 0.05, pan: panOf(ev.col) });
        break;
      case "waveEnded":
        if (ev.cleared) sfx.waveClear(ev.virusCount || ev.size || 1);
        break;
      case "gameOver":
        musicStop();
        sfx.over();
        break;
      default:
        break;
    }
  }
  let alarmAt = 0;
  let wasCharging = false, wasFull = false;
  function observe(view, charging, chargeFull) {
    if (dead || !ac || !view) return;
    music.tier = view.overclock ? 3 : view.level >= 7 ? 2 : view.level >= 3 ? 1 : 0;
    music.lowTime = view.mode === "playing" && !view.paused && view.timeLeft < LOW_TIME2;
    if (view.mode === "playing" && !view.paused) {
      if (!music.running) musicStart(0);
      else if (!music.playing) musicResume();
    } else if (view.mode === "interlevel" || view.paused) {
      if (music.playing) musicHold();
    } else if (music.running) {
      musicStop();
    }
    if (music.running) pump();
    if (charging && !wasCharging) chargeStart();
    else if (!charging && wasCharging) chargeStop();
    if (charging && chargeFull && !wasFull) chargeFullNow();
    wasCharging = !!charging;
    wasFull = !!(charging && chargeFull);
    if (music.lowTime && on) {
      if (ac.currentTime >= alarmAt) {
        const dire = view.timeLeft < 3;
        sfx.alarm(dire);
        alarmAt = ac.currentTime + (dire ? 0.42 : 0.84);
      }
    } else {
      alarmAt = 0;
    }
  }
  function setMuted(muted) {
    on = !muted;
    if (!ac) return;
    if (!on) chargeStop(0.02);
    const t = ac.currentTime;
    const g = master.gain;
    try {
      g.cancelScheduledValues(t);
    } catch (e) {
    }
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(on ? MASTER_GAIN : 0, t + (on ? 0.03 : 0.015));
  }
  return {
    sfx,
    handle,
    handleAll(events) {
      for (const ev of events) handle(ev);
    },
    observe,
    /** Called from a user gesture: creates/unsuspends the context. */
    resume() {
      ctx();
    },
    get muted() {
      return !on;
    },
    toggleMute() {
      setMuted(on);
      return !on;
    },
    // test / diagnostic seams
    get _ctx() {
      return ac;
    },
    get _live() {
      return live;
    },
    get _music() {
      return music;
    },
    /**
     * Leave nothing running: no scheduler timer, no oscillator, no buffer
     * source, no context — and no way for a late event to start one.
     */
    close() {
      if (dead) return;
      dead = true;
      music.running = false;
      music.playing = false;
      clearPump();
      chargeVoices = null;
      stopAll();
      try {
        if (ac) ac.close();
      } catch (e) {
      }
      ac = null;
      master = sfxBus = musicBus = duck = null;
      waves.clear();
      whiteBuf = crushBuf = null;
    }
  };
}

// src/shell/input.js
var MOVE_KEYS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0]
};
var PAD_NEUTRAL = 0.4;
var PAD_AXIS = 0.42;
var DOUBLE_TAP_MS = 350;
var KEY_SOURCE = "key";
function createFireLatch(dispatch) {
  let holder = null;
  const norm = (src) => src === void 0 ? null : src;
  return {
    /** Who holds the button, or null. */
    get holder() {
      return holder;
    },
    /**
     * Take the button for `src`. A second source pressing while one already
     * holds it is ignored — which is what the core's `canFire` latch already
     * did, except now the shell and the core agree on *why*.
     * @returns {boolean} true if this press was the one that latched.
     */
    press(src) {
      if (holder !== null) return false;
      const id = norm(src);
      if (id === null) return false;
      holder = id;
      dispatch({ type: "firePressed" });
      return true;
    },
    /**
     * Release, but only for the source that pressed.
     * @returns {boolean} true if this release actually let go.
     */
    release(src) {
      if (holder === null || holder !== norm(src)) return false;
      holder = null;
      dispatch({ type: "fireReleased" });
      return true;
    },
    /**
     * Let go no matter who was holding — for blur, page-hide and teardown,
     * where the press can no longer be completed. The player must never be
     * left unable to fire.
     */
    releaseAny() {
      if (holder === null) return false;
      holder = null;
      dispatch({ type: "fireReleased" });
      return true;
    }
  };
}
function createInput({ win, host, root, els, on, dispatch, onGesture, onMute, modes, onModeChange }) {
  const doc = host && host.ownerDocument || win.document;
  const latch = createFireLatch(dispatch);
  const modeList = modes && modes.length ? modes : [{ id: "classic" }];
  let modeIdx = 0;
  const modeId = () => modeList[modeIdx].id;
  function setMode(id) {
    const i = modeList.findIndex((m) => m.id === id);
    if (i < 0 || i === modeIdx) return;
    modeIdx = i;
    if (onModeChange) onModeChange(modeId());
  }
  function stepMode(d) {
    setMode(modeList[(modeIdx + d + modeList.length) % modeList.length].id);
  }
  const onMenu = () => !els.splash.classList.contains("hidden");
  function focusStage() {
    try {
      els.stage.focus({ preventScroll: true });
    } catch (e) {
    }
  }
  function ownsKeyboard() {
    const a = doc.activeElement;
    if (a === host) return true;
    if (host && a && host.contains(a)) return true;
    if (root && root.activeElement) return true;
    return !a || a === doc.body || a === doc.documentElement;
  }
  on(win, "keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!ownsKeyboard()) return;
    const mk = MOVE_KEYS[e.code];
    if (mk && onMenu()) {
      if (mk[1]) {
        e.preventDefault();
        stepMode(mk[1]);
      }
      return;
    }
    if (mk) {
      e.preventDefault();
      dispatch({ type: "move", dc: mk[0], dr: mk[1] });
      return;
    }
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      dispatch({ type: "pause" });
      return;
    }
    if (e.code === "KeyM") {
      e.preventDefault();
      onMute();
      return;
    }
    if (e.code === "KeyB" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
      e.preventDefault();
      if (e.repeat) return;
      onGesture();
      dispatch({ type: "bomb" });
      return;
    }
    if (e.code !== "Space") return;
    e.preventDefault();
    if (e.repeat) return;
    onGesture();
    latch.press(KEY_SOURCE);
  });
  on(win, "keyup", (e) => {
    if (e.code !== "Space") return;
    latch.release(KEY_SOURCE);
  });
  for (const triggerEl of [els.cv, els.fireBtn]) {
    on(triggerEl, "pointerdown", (e) => {
      e.preventDefault();
      onGesture();
      try {
        triggerEl.setPointerCapture(e.pointerId);
      } catch (err) {
      }
      latch.press(e.pointerId);
    });
    on(triggerEl, "lostpointercapture", (e) => latch.release(e.pointerId));
  }
  on(els.bombBtn, "pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onGesture();
    dispatch({ type: "bomb" });
  });
  on(win, "pointerup", (e) => latch.release(e.pointerId));
  on(win, "pointercancel", (e) => latch.release(e.pointerId));
  on(win, "blur", () => {
    latch.releaseAny();
    dispatch({ type: "pauseOnBlur" });
  });
  on(doc, "visibilitychange", () => {
    if (doc.visibilityState !== "hidden") return;
    latch.releaseAny();
    dispatch({ type: "pauseOnBlur" });
  });
  const pad = els.dpad;
  const arrows = { up: els.aUp, down: els.aDown, left: els.aLeft, right: els.aRight };
  const padState = { id: null, dc: 0, dr: 0 };
  function padSetArrows() {
    arrows.up.classList.toggle("on", padState.dr < 0);
    arrows.down.classList.toggle("on", padState.dr > 0);
    arrows.left.classList.toggle("on", padState.dc < 0);
    arrows.right.classList.toggle("on", padState.dc > 0);
  }
  function padUpdate(e) {
    const r = pad.getBoundingClientRect();
    const R = r.width / 2;
    const dx = e.clientX - (r.left + R);
    const dy = e.clientY - (r.top + R);
    const d = Math.hypot(dx, dy);
    let dc = 0, dr = 0;
    if (d >= R * PAD_NEUTRAL && d > 0) {
      if (dx / d > PAD_AXIS) dc = 1;
      else if (dx / d < -PAD_AXIS) dc = -1;
      if (dy / d > PAD_AXIS) dr = 1;
      else if (dy / d < -PAD_AXIS) dr = -1;
    }
    if ((dc !== padState.dc || dr !== padState.dr) && (dc || dr)) {
      dispatch({ type: "resetMoveThrottle" });
    }
    padState.dc = dc;
    padState.dr = dr;
    padSetArrows();
  }
  on(pad, "pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (padState.id !== null) return;
    try {
      pad.setPointerCapture(e.pointerId);
    } catch (err) {
    }
    padState.id = e.pointerId;
    pad.classList.add("live");
    padUpdate(e);
  });
  on(pad, "pointermove", (e) => {
    if (padState.id !== e.pointerId) return;
    e.preventDefault();
    padUpdate(e);
  });
  function padEnd(e) {
    if (e && padState.id !== e.pointerId) return;
    padState.id = null;
    padState.dc = 0;
    padState.dr = 0;
    pad.classList.remove("live");
    padSetArrows();
  }
  on(pad, "pointerup", padEnd);
  on(pad, "pointercancel", padEnd);
  on(pad, "lostpointercapture", padEnd);
  on(win, "blur", () => padEnd(null));
  on(els.pauseBtn, "pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: "pause" });
  });
  on(els.spModes, "click", (e) => {
    const row = e.target.closest && e.target.closest(".sp-mode");
    if (!row) return;
    e.stopPropagation();
    onGesture();
    setMode(row.dataset.mode);
    dispatch({ type: "startRun", modeId: modeId() });
  });
  on(els.splash, "click", () => {
    onGesture();
    dispatch({ type: "startRun", modeId: modeId() });
  });
  on(els.spStart, "pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onGesture();
    dispatch({ type: "startRun", modeId: modeId() });
  });
  installGestureGuards({ els, on, focusStage });
  return {
    hold: () => padState.id !== null && (padState.dc || padState.dr) ? { dc: padState.dc, dr: padState.dr } : null,
    focus: focusStage
  };
}
function installGestureGuards({ els, on, focusStage }) {
  const surface = els.bwRoot;
  const nonPassive = { passive: false };
  const onSplash = (target) => !els.splash.classList.contains("hidden") && els.splash.contains(target);
  let dragFromY = 0;
  function splashCanScroll(e) {
    if (!onSplash(e.target)) return false;
    const sp = els.splash;
    const max = sp.scrollHeight - sp.clientHeight;
    if (max <= 0) return false;
    const dy = (e.touches[0] ? e.touches[0].clientY : dragFromY) - dragFromY;
    if (dy > 0 && sp.scrollTop <= 0) return false;
    if (dy < 0 && sp.scrollTop >= max - 1) return false;
    return true;
  }
  on(surface, "pointerdown", () => focusStage(), true);
  on(surface, "touchstart", (e) => {
    if (e.touches[0]) dragFromY = e.touches[0].clientY;
    if (e.touches.length > 1 && e.cancelable && !onSplash(e.target)) e.preventDefault();
  }, nonPassive);
  on(surface, "touchmove", (e) => {
    if (!e.cancelable) return;
    if (e.touches.length > 1) {
      e.preventDefault();
      return;
    }
    if (splashCanScroll(e)) return;
    e.preventDefault();
  }, nonPassive);
  let lastTapAt = 0;
  on(surface, "touchend", (e) => {
    const now = Date.now();
    if (!onSplash(e.target) && e.cancelable && now - lastTapAt < DOUBLE_TAP_MS) e.preventDefault();
    lastTapAt = now;
  }, nonPassive);
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    on(surface, type, (e) => {
      if (e.cancelable !== false) e.preventDefault();
    }, nonPassive);
  }
  on(surface, "contextmenu", (e) => e.preventDefault());
  on(surface, "dragstart", (e) => e.preventDefault());
  on(surface, "selectstart", (e) => e.preventDefault());
}

// src/shell/render.js
var { EASE: EASE2, impulseValue: impulseValue2, TAU: TAU2, RING_GAP: RING_GAP2 } = constants_exports;
var panel2 = (G, col, row) => panelRect(G, col, row);
var MONO = "px ui-monospace, Menlo, Consolas, monospace";
var font = (weight, size) => weight + " " + size + MONO;
var SKINS = {
  mett: { dome: "#ffd23f", stripe: "#c9992a" },
  guard: { dome: "#aeb9d6", stripe: "#6c7794" },
  hopper: { dome: "#5ee87c", stripe: "#1f7c3d" },
  ally: { dome: "#58c7ff", stripe: "#2a7ab8" },
  rare: { dome: "#fff3c4", stripe: "#e8a020" },
  // the sentinel is drawn on its own path below; this is for debris and ghosts
  sentinel: { dome: "#b48cff", stripe: "#5a3f9a" }
};
var SENTINEL_CORE = { 1: "#c48cff", 2: "#ff6fd8", 3: "#ff4d4d" };
var PANELS = { mine: ["#3a2330", "#7c3652"], theirs: ["#1e2c4d", "#35528f"] };
var PANELS_OC = { mine: ["#40252c", "#95483f"], theirs: ["#2b2a35", "#7b5733"] };
var ROAD = ["#121828", "#243050"];
var ROAD_DASH = "#34416a";
function ring(ctx, x, y, r, squash = 1) {
  ctx.beginPath();
  if (squash === 1) {
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU2 - RING_GAP2);
    return;
  }
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + i / steps * (TAU2 - RING_GAP2);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * squash;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
}
function draw(ctx, state, now) {
  const G = state.G;
  const rm = !!state.reducedMotion;
  ctx.clearRect(0, 0, G.w, G.h);
  const sh = state.fx.shake;
  const st = now - sh.t0;
  let dx = 0, dy = 0;
  if (st >= 0 && st < sh.ms && sh.amp > 0) {
    const k = (1 - st / sh.ms) ** 2 * (rm ? RM.shake : 1);
    dx = Math.sin(st / 16.5) * sh.amp * k;
    dy = Math.cos(st / 11.5) * sh.amp * k * 0.62;
  }
  ctx.save();
  if (dx || dy) ctx.translate(dx, dy);
  const camPx = (state.cam || 0) * G.pw;
  if (camPx) ctx.translate(-camPx, 0);
  drawPanels(ctx, state, now);
  drawPickups(ctx, state, now);
  drawLane(ctx, state, now);
  drawAim(ctx, state, now);
  drawGhost(ctx, state, now);
  const { rayY, busterX } = drawPlayer(ctx, state, now, rm);
  for (const e of state.enemies) drawBlastUnder(ctx, state, now, e);
  for (const e of state.enemies) drawEnemy(ctx, state, now, e);
  for (const e of state.enemies) drawBlastOver(ctx, state, now, e);
  drawBolts(ctx, state, now);
  drawBombs(ctx, state, now);
  drawShots(ctx, state, now, rayY, busterX);
  drawBits(ctx, state, now);
  drawSparks(ctx, state, now);
  drawHurtWorld(ctx, state, now, rm);
  drawFlare(ctx, state, now);
  drawPopups(ctx, state, now);
  drawChainBreak(ctx, state, now);
  ctx.restore();
  drawHUD(ctx, state, now, rm);
}
function drawPickups(ctx, state, now) {
  const G = state.G;
  for (const pk of state.pickups || []) {
    const p = panel2(G, pk.col, pk.row);
    const cx = p.x + p.w / 2, cy = p.y + p.h * 0.5 + Math.sin(now / 260) * 3;
    const r = Math.min(p.w, p.h) * 0.16;
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(now / 180);
    ctx.fillStyle = "#ff9f45";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2 - RING_GAP);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1a1f33";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2 - RING_GAP);
    ctx.fill();
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.4, cy - r * 0.8);
    ctx.lineTo(cx + r * 1.1, cy - r * 1.6);
    ctx.stroke();
    ctx.fillStyle = Math.floor(now / 120) % 2 ? "#ffffff" : "#ff5470";
    ctx.fillRect(cx + r * 1, cy - r * 1.8, 3, 3);
  }
}
function drawBombs(ctx, state, now) {
  const G = state.G;
  for (const b of state.bombsInFlight || []) {
    const q = Math.min(1, (now - b.t0) / b.dur);
    const from = panel2(G, b.fromCol, b.fromRow), to = panel2(G, b.toCol, b.toRow);
    const x = from.x + (to.x - from.x) * q + from.w / 2;
    const ground = from.y + from.h * 0.5;
    const y = ground - G.ph * 1.6 * 4 * q * (1 - q);
    const r = Math.min(G.pw, G.ph) * 0.15;
    ctx.globalAlpha = 0.3 * (1 - 2.4 * q * (1 - q));
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, ground + G.ph * 0.28, r * 1.2, r * 0.45, 0, 0, Math.PI * 2 - RING_GAP);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1a1f33";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2 - RING_GAP);
    ctx.fill();
    ctx.strokeStyle = "#ff9f45";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2 - RING_GAP);
    ctx.stroke();
    ctx.fillStyle = Math.floor(now / 70) % 2 ? "#ffffff" : "#ff5470";
    ctx.fillRect(x + r * 0.6, y - r * 1.5, 3, 3);
  }
  for (const bl of state.fx.blasts || []) {
    const q = Math.min(1, (now - bl.t0) / BOMB_BLAST_MS);
    const R = BOMB_RADIUS;
    ctx.globalAlpha = 0.55 * (1 - q) ** 1.5;
    ctx.fillStyle = "#ff9f45";
    for (let dc = -R; dc <= R; dc++) for (let dr = -R; dr <= R; dr++) {
      const r = bl.row + dr;
      if (r < 0 || r >= ROWS) continue;
      const p = panel2(G, bl.col + dc, r);
      ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
    }
    const rad = G.pw * 1.5 * EASE2.out3(q);
    ctx.globalAlpha = (1 - q) * 0.9;
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 6 * (1 - q) + 1;
    ctx.beginPath();
    ctx.arc(bl.x, bl.y, rad, 0, Math.PI * 2 - RING_GAP);
    ctx.stroke();
    ctx.globalAlpha = (1 - q) ** 2 * 0.8;
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.arc(bl.x, bl.y, rad * 0.45, 0, Math.PI * 2 - RING_GAP);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function drawPanels(ctx, state, now) {
  const G = state.G;
  const oc = state.deletions >= OC_START;
  const skin = oc ? PANELS_OC : PANELS;
  const advancing = modeById(state.modeId).advancing;
  const world = state.world;
  const c0 = Math.floor(state.cam || 0) - 1;
  const c1 = c0 + COLS + 3;
  for (let r = 0; r < ROWS; r++) {
    for (let c = c0; c < c1; c++) {
      const t = tileAt(world, c, r);
      if (t === TILE.VOID) continue;
      const p = panel2(G, c, r);
      const road = t === TILE.ROAD;
      const [fill, edge] = road ? ROAD : t === TILE.PLAYER ? skin.mine : skin.theirs;
      ctx.fillStyle = fill;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
      ctx.strokeRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
      if (road) {
        ctx.fillStyle = ROAD_DASH;
        ctx.fillRect(p.x + p.w * 0.3, p.y + p.h / 2 - 1.5, p.w * 0.4, 3);
      }
      if (advancing && t === TILE.PLAYER && tileAt(world, c + 1, r) === TILE.ENEMY) {
        ctx.globalAlpha = 0.5 + 0.28 * Math.sin(now / 260);
        ctx.strokeStyle = "#45e0e8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x + p.w - 3, p.y + 4);
        ctx.lineTo(p.x + p.w - 3, p.y + p.h - 4);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
      }
      if (oc) {
        ctx.globalAlpha = 0.055 + 0.05 * Math.sin(now / 380 - c * 0.62 - r * 0.24);
        ctx.fillStyle = "#ff9f45";
        ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
        ctx.globalAlpha = 1;
      }
      if (t !== TILE.ENEMY && c === state.player.col && r === state.player.row) {
        ctx.strokeStyle = "#45e0e8";
        ctx.strokeRect(p.x + 5, p.y + 5, p.w - 10, p.h - 10);
      }
    }
  }
  drawRipples(ctx, state, now);
}
function drawRipples(ctx, state, now) {
  const G = state.G;
  for (const rp of state.fx.ripples) {
    const t = now - rp.t0;
    if (t < 0 || t >= rp.ms) continue;
    const q = EASE2.out2(t / rp.ms);
    const p = panel2(G, rp.col, rp.row);
    const ix = 4 + p.w * 0.42 * (1 - q);
    const iy = 4 + p.h * 0.42 * (1 - q);
    ctx.globalAlpha = (1 - t / rp.ms) * 0.8;
    ctx.strokeStyle = rp.color;
    ctx.lineWidth = rp.w;
    ctx.strokeRect(p.x + ix, p.y + iy, p.w - ix * 2, p.h - iy * 2);
  }
  ctx.globalAlpha = 1;
}
function drawLane(ctx, state, now) {
  const ray = state.fx.ray;
  const t = now - ray.t0;
  const span = ray.dur + LANE_MS;
  if (t < 0 || t >= span) return;
  const G = state.G;
  const y = laneY(G, ray.row);
  const head = t <= ray.dur ? ray.x0 + (ray.x1 - ray.x0) * (t / ray.dur) : ray.x1;
  const fade = t <= ray.dur ? 1 : 1 - (t - ray.dur) / LANE_MS;
  const x0 = ray.x0 - G.pw * 0.4;
  const h = G.ph * 0.44;
  ctx.globalAlpha = fade * (ray.hitCol !== null ? 0.2 : 0.1);
  ctx.fillStyle = "#45e0e8";
  ctx.fillRect(x0, y - h / 2, Math.max(0, head - x0), h);
  ctx.globalAlpha = fade * 0.35;
  ctx.fillRect(x0, y - 1.5, Math.max(0, head - x0), 3);
  ctx.globalAlpha = 1;
}
function drawAim(ctx, state, now) {
  if (state.mode !== "playing") return;
  const G = state.G;
  const fallbackAim = aimMs(state.deletions);
  for (const e of state.enemies) {
    if (!e.willAttack || e.fired || e.state !== "up") continue;
    const q = Math.min(1, (now - e.t0) / (e.aimMs || fallbackAim));
    const p = panel2(G, e.col, e.row);
    const x1 = p.x + p.w / 2;
    const y = laneY(G, e.row);
    const pulse = 0.55 + 0.45 * Math.sin(now / 42);
    ctx.save();
    ctx.fillStyle = "#ff5470";
    ctx.globalAlpha = 0.05 + 0.13 * q;
    ctx.fillRect(G.gx + 3, p.y + 3, x1 - G.gx - 3, p.h - 6);
    ctx.globalAlpha = (0.2 + 0.4 * q) * pulse;
    ctx.strokeStyle = "#ff5470";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(G.gx + 6, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = q > 0.75 ? "#ffd23f" : "#ff5470";
    ctx.beginPath();
    ctx.moveTo(G.gx + 4, y);
    ctx.lineTo(G.gx + 15, y - 7);
    ctx.lineTo(G.gx + 15, y + 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
var BOLT_TRAIL_MS = 120;
function boltView(b, G) {
  const kind = b.kind || (b.heavy ? "heavy" : "fast");
  const heavy = kind === "heavy" || kind === "slow" || kind === "mett";
  const r = b.radius || (heavy ? G.ph * 0.17 : G.ph * 0.115);
  const speed = b.speed > 0 ? b.speed : 0.7;
  return { heavy, r: Math.max(5, r), speed };
}
function drawBolts(ctx, state, now) {
  const G = state.G;
  for (const b of state.bolts) {
    const y = laneY(G, b.row);
    const { heavy, r, speed } = boltView(b, G);
    const trail = Math.min(G.pw * 3.4, Math.max(r * 1.6, speed * BOLT_TRAIL_MS));
    const grad = ctx.createLinearGradient(b.x + trail, 0, b.x, 0);
    grad.addColorStop(0, "rgba(255,84,112,0)");
    grad.addColorStop(1, heavy ? "#ff9f45" : "#ff5470");
    ctx.strokeStyle = grad;
    ctx.lineWidth = heavy ? r * 1.5 : r * 0.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(b.x + trail, y);
    ctx.lineTo(b.x, y);
    ctx.stroke();
    ctx.lineCap = "butt";
    if (heavy) {
      ctx.globalAlpha = 0.3 + 0.12 * Math.sin(now / 130);
      ctx.fillStyle = "#ff9f45";
      ctx.beginPath();
      ctx.arc(b.x, y, r * 1.85, 0, TAU2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ff9f45";
      ctx.beginPath();
      ctx.arc(b.x, y, r, 0, TAU2);
      ctx.fill();
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 2;
      ring(ctx, b.x, y, r * 1.32, 0.9);
      ctx.stroke();
      ctx.fillStyle = "#fff3c4";
      ctx.beginPath();
      ctx.arc(b.x - r * 0.22, y - r * 0.24, r * 0.42, 0, TAU2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#ff8ba0";
      let a = 0.34;
      for (const f of [0.38, 0.7]) {
        ctx.globalAlpha = a;
        const off = trail * f, rr = r * (1 - f * 0.55);
        ctx.beginPath();
        ctx.moveTo(b.x + off - rr, y);
        ctx.lineTo(b.x + off, y - rr * 0.8);
        ctx.lineTo(b.x + off + rr * 0.7, y);
        ctx.lineTo(b.x + off, y + rr * 0.8);
        ctx.closePath();
        ctx.fill();
        a *= 0.5;
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ff5470";
      ctx.beginPath();
      ctx.moveTo(b.x - r * 1.5, y);
      ctx.lineTo(b.x + r * 0.5, y - r * 0.85);
      ctx.lineTo(b.x + r * 1.2, y);
      ctx.lineTo(b.x + r * 0.5, y + r * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(b.x - r * 0.9, y);
      ctx.lineTo(b.x + r * 0.35, y - r * 0.34);
      ctx.lineTo(b.x + r * 0.35, y + r * 0.34);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function drawGhost(ctx, state, now) {
  const g = state.fx.ghost;
  const t = now - g.t0;
  if (t < 0 || t >= GHOST_MS) return;
  const G = state.G;
  const p = panel2(G, g.col, g.row);
  const bw = G.pw * 0.34, bh = G.ph * 1.15;
  const k = 1 - t / GHOST_MS;
  const w = bw * 0.62;
  ctx.globalAlpha = 0.34 * k * k;
  ctx.fillStyle = "#45e0e8";
  ctx.fillRect(p.x + p.w / 2 - w / 2, p.y + p.h * 0.78 - bh * k, w, bh * k);
  ctx.globalAlpha = 1;
}
function drawPlayer(ctx, state, now, rm) {
  const G = state.G;
  const p = panel2(G, state.player.col, state.player.row);
  const eRecoil = impulseValue2(state.fx.recoil, now);
  const rx = -state.fx.recoil.spec.px * eRecoil;
  const bw = G.pw * 0.34, bh = G.ph * 1.15;
  const cx = p.x + p.w / 2 + rx;
  const baseY = p.y + p.h * 0.78;
  const coreY = baseY - bh * 0.5;
  const cdn = state.charge.downAt;
  const charging = cdn !== null && state.mode === "playing";
  const held = charging ? now - cdn : 0;
  const prog = charging ? Math.min(1, held / CHARGE_MS) : 0;
  if (prog > 0.12) {
    ctx.globalAlpha = 0.08 + 0.26 * prog * prog;
    ctx.fillStyle = state.charge.full ? "#c9f6ff" : "#45e0e8";
    const gw = bw * (1.5 + prog * 0.9), gh = bh * (0.78 + prog * 0.34);
    ctx.fillRect(cx - gw / 2, coreY - gh / 2, gw, gh);
    ctx.globalAlpha = 1;
  }
  const hurtNow = now < state.hurtUntil;
  const flicker = hurtNow && (rm || Math.floor(now / 70) % 2 === 0);
  if (flicker) ctx.globalAlpha = rm ? 0.68 : 0.35;
  ctx.fillStyle = "#4f8dff";
  ctx.fillRect(cx - bw / 2, baseY - bh, bw, bh);
  ctx.fillStyle = "#2f5fc4";
  ctx.fillRect(cx - bw / 2, baseY - bh, bw, bh * 0.28);
  ctx.fillStyle = "#c9f6ff";
  ctx.fillRect(cx - bw * 0.28, baseY - bh * 0.62, bw * 0.56, bh * 0.14);
  const rayY = baseY - bh * 0.42;
  ctx.fillStyle = state.charge.full ? "#fff3c4" : "#ffd23f";
  ctx.fillRect(cx + bw / 2 - 2, rayY - 5, bw * 0.55, 10);
  ctx.globalAlpha = 1;
  if (charging && held > 120) {
    for (let i = 0; i < 3; i++) {
      const f = (now / 300 + i / 3) % 1;
      const a = i * (TAU2 / 3) + f * 2.4 + now / 900;
      const r = bw * (2.4 - 1.45 * f);
      const sz = 2 + 2.5 * f;
      ctx.globalAlpha = Math.min(1, prog * 1.2) * f * 0.9;
      ctx.fillStyle = state.charge.full ? "#c9f6ff" : "#45e0e8";
      ctx.fillRect(cx + Math.cos(a) * r - sz / 2, coreY + Math.sin(a) * r * 0.75 - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = state.charge.full ? rm ? "#8fe9ef" : Math.sin(now / 55) > 0 ? "#45e0e8" : "#c9f6ff" : "rgba(69,224,232,0.5)";
    ctx.lineWidth = state.charge.full ? 4 : 2 + 2 * prog;
    ctx.beginPath();
    ctx.arc(cx, coreY, bw * 0.95, -Math.PI / 2, -Math.PI / 2 + prog * (TAU2 - RING_GAP2));
    ctx.stroke();
    if (state.charge.full) {
      const pulse = rm ? 0.5 : 0.5 + 0.5 * Math.sin(now / 90);
      ctx.globalAlpha = 0.3 + 0.4 * pulse;
      ctx.lineWidth = 2;
      ring(ctx, cx, coreY, bw * (1.16 + 0.12 * pulse), 0.85);
      ctx.stroke();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "#c9f6ff";
      for (let i = 0; i < 4; i++) {
        const a = i * (TAU2 / 4) + now / 260;
        const r0 = bw * 1.02, r1 = bw * (1.34 + 0.22 * Math.sin(now / 70 + i));
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, coreY + Math.sin(a) * r0 * 0.85);
        ctx.lineTo(cx + Math.cos(a) * r1, coreY + Math.sin(a) * r1 * 0.85);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  return { rayY, busterX: cx + bw / 2 + bw * 0.55 };
}
function drawSentinel(ctx, e, now, bw, bh) {
  const open = e.state === "up" && (e.willAttack ? !e.fired : true);
  const cfg = SENTINEL[e.tier] || SENTINEL[1];
  const q = open ? Math.min(1, (now - e.t0) / cfg.openMs) : 0;
  const core = SENTINEL_CORE[e.tier] || SENTINEL_CORE[1];
  const R = bw * 0.62, cy = -bh * 0.44;
  ctx.fillStyle = "#3a3452";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    const x = Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.92;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#6a5f8f";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#2a2540";
  ctx.fillRect(-bw * 0.34, -bh * 0.12, bw * 0.68, bh * 0.1);
  const gap = open ? 0.18 + 0.5 * (1 - q) : 0.04;
  const half = R * 0.62;
  ctx.fillStyle = core;
  ctx.globalAlpha = open ? 0.85 + 0.15 * Math.sin(now / (60 + 90 * (1 - q))) : 0.25;
  ctx.beginPath();
  ctx.arc(0, cy, half * 0.62, 0, Math.PI * 2 - RING_GAP);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#1a1728";
  ctx.fillRect(-half, cy - half, half * 2, half * (1 - gap));
  ctx.fillRect(-half, cy + half * gap, half * 2, half * (1 - gap));
  ctx.fillStyle = core;
  for (let i = 0; i < (e.tier || 1); i++) ctx.fillRect(-bw * 0.26 + i * bw * 0.16, cy + R * 0.7, bw * 0.1, 3);
}
function drawEnemy(ctx, state, now, e) {
  const G = state.G;
  const p = panel2(G, e.col, e.row);
  const t = now - e.t0;
  const bw = G.pw * 0.4, bh = G.ph * 1;
  let cx = p.x + p.w / 2;
  const baseY = p.y + p.h * 0.78;
  let grow = 1, sx = 1, sy = 1, flash = 0;
  if (e.state === "rising") grow = EASE2.out2(Math.min(1, t / (e.riseMs || RISE_MS)));
  else if (e.state === "sinking") grow = 1 - EASE2.out2(t / SINK_MS);
  else if (e.state === "hit") {
    const tier = e.tier;
    const uniform = 1 + (tier.scale.peak - 1) * impulseValue2(e.fx.scale, now);
    const sqy = 1 + tier.squash.amt * impulseValue2(e.fx.squash, now);
    sx = uniform / sqy;
    sy = uniform * sqy;
    cx += tier.kick.px * impulseValue2(e.fx.kick, now);
    flash = t < 0 ? 0 : Math.max(0, 1 - t / 70);
    grow = Math.min(1, 1 - Math.max(0, (t - HIT_MS * 0.55) / (HIT_MS * 0.45)));
  }
  const ht = now - e.hopT0;
  if (e.state === "up" && ht < HOP_GROW_MS) grow *= EASE2.out2(ht / HOP_GROW_MS);
  if (grow <= 0) return;
  const skin = SKINS[e.type];
  if (e.state === "up" && e.hopFromCol !== void 0 && ht >= 0 && ht < HOP_GROW_MS * 2) {
    const from = panel2(G, e.hopFromCol, e.hopFromRow);
    const k = 1 - ht / (HOP_GROW_MS * 2);
    ctx.fillStyle = skin.dome;
    for (let i = 1; i <= 2; i++) {
      const f = i / 3;
      const gx = from.x + (p.x - from.x) * (1 - f) + p.w / 2;
      const gy = from.y + (p.y - from.y) * (1 - f) + p.h * 0.78;
      ctx.globalAlpha = 0.26 * k * (1 - f * 0.4);
      ctx.fillRect(gx - bw * 0.42, gy - bh * 0.72, bw * 0.84, bh * 0.62);
    }
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(sx, sy * grow);
  ctx.globalAlpha = e.state === "hit" ? grow : 1;
  if (e.type === "sentinel") {
    drawSentinel(ctx, e, now, bw, bh);
    ctx.restore();
    return;
  }
  ctx.fillStyle = skin.dome;
  ctx.beginPath();
  ctx.arc(0, -bh * 0.42, bw * 0.55, Math.PI, 0);
  ctx.lineTo(bw * 0.55, -bh * 0.1);
  ctx.lineTo(-bw * 0.55, -bh * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = skin.stripe;
  ctx.fillRect(-bw * 0.08, -bh * 0.98, bw * 0.16, bh * 0.5);
  if (e.type === "guard") {
    ctx.fillStyle = "#6c7794";
    ctx.fillRect(-bw * 0.55, -bh * 0.34, bw * 1.1, bh * 0.1);
    ctx.fillStyle = "#232c42";
    ctx.fillRect(-bw * 0.42, -bh * 0.24, bw * 0.84, bh * 0.12);
  } else if (e.type === "ally") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-bw * 0.42, -bh * 0.36, bw * 0.84, bh * 0.26);
    ctx.fillStyle = "#2a7ab8";
    ctx.fillRect(-bw * 0.06, -bh * 0.34, bw * 0.12, bh * 0.22);
    ctx.fillRect(-bw * 0.24, -bh * 0.28, bw * 0.48, bh * 0.1);
  } else {
    ctx.fillStyle = "#232c42";
    ctx.fillRect(-bw * 0.42, -bh * 0.34, bw * 0.84, bh * 0.24);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-bw * 0.26, -bh * 0.3, bw * 0.12, bh * 0.14);
    ctx.fillRect(bw * 0.14, -bh * 0.3, bw * 0.12, bh * 0.14);
  }
  if (e.type === "rare") {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 70);
    ctx.strokeStyle = "#ffe08a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -bh * 0.42, bw * 0.62, Math.PI, 0);
    ctx.lineTo(bw * 0.62, -bh * 0.04);
    ctx.lineTo(-bw * 0.62, -bh * 0.04);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = e.state === "hit" ? grow : 1;
  }
  if (flash > 0) {
    ctx.globalAlpha = flash;
    ctx.fillStyle = e.type === "ally" ? "#ff5470" : e.type === "rare" ? "#fff3c4" : "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -bh * 0.42, bw * 0.6, Math.PI, 0);
    ctx.lineTo(bw * 0.6, -bh * 0.06);
    ctx.lineTo(-bw * 0.6, -bh * 0.06);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
function drawShots(ctx, state, now, rayY, busterX) {
  const G = state.G;
  const ray = state.fx.ray;
  const rt = now - ray.t0;
  const charged = ray.tier === "charged";
  if (rt >= 0 && rt < ray.dur + RAY_IMPACT_MS) {
    const y = laneY(G, ray.row);
    if (rt <= ray.dur) {
      const head = ray.x0 + (ray.x1 - ray.x0) * (rt / ray.dur);
      const trail = Math.max(ray.x0, head - (charged ? 150 : 90));
      if (head > trail) {
        const grad = ctx.createLinearGradient(trail, 0, head, 0);
        grad.addColorStop(0, "rgba(69,224,232,0)");
        grad.addColorStop(1, charged ? "#c9f6ff" : "#45e0e8");
        ctx.strokeStyle = grad;
        ctx.lineWidth = charged ? 6 : 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(trail, y);
        ctx.lineTo(head, y);
        ctx.stroke();
        ctx.lineCap = "butt";
      }
      if (charged) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#45e0e8";
        ctx.beginPath();
        ctx.arc(head, y, 11, 0, TAU2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(head, y, charged ? 5 : 3, 0, TAU2);
      ctx.fill();
    } else if (ray.hitCol !== null) {
      const q = (rt - ray.dur) / RAY_IMPACT_MS;
      const e = EASE2.out2(q);
      ctx.globalAlpha = 1 - q;
      ctx.strokeStyle = charged ? "#c9f6ff" : "#45e0e8";
      ctx.lineWidth = charged ? 4 : 2;
      ring(ctx, ray.x1, y, (charged ? 10 : 6) + (charged ? 26 : 16) * e);
      ctx.stroke();
      ctx.globalAlpha = (1 - q) * 0.5;
      ctx.lineWidth = 1.5;
      ring(ctx, ray.x1, y, (charged ? 4 : 3) + (charged ? 44 : 27) * e, 0.62);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  const mdur = MUZZLE_MS[state.fx.muzzleTier] || MUZZLE_MS.normal;
  const mt = now - state.fx.muzzleT0;
  if (mt >= 0 && mt < mdur) {
    const q = mt / mdur;
    const a = 1 - q;
    const s = state.fx.muzzleTier === "charged" ? 1.6 : 1;
    ctx.save();
    ctx.translate(busterX + 2, rayY);
    ctx.globalAlpha = a * 0.85;
    const rad = (10 + 15 * EASE2.out2(q)) * s;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, "rgba(255,240,180,0.95)");
    g.addColorStop(1, "rgba(255,159,69,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, TAU2);
    ctx.fill();
    ctx.globalAlpha = a * a * 0.75;
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 2 * s;
    ring(ctx, 0, 0, (6 + 18 * EASE2.out3(q)) * s, 0.8);
    ctx.stroke();
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = "round";
    for (const ang of [-0.55, -0.18, 0.18, 0.55]) {
      const len = (7 + 15 * EASE2.out3(q)) * s;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 4, Math.sin(ang) * 4);
      ctx.lineTo(Math.cos(ang) * (4 + len), Math.sin(ang) * (4 + len));
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.globalAlpha = a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(2, 0, Math.max(0.5, (4.5 - 3 * q) * s), 0, TAU2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
function drawBits(ctx, state, now) {
  for (const b of state.fx.bits) {
    const t = now - b.t0;
    if (t < 0 || t >= b.ms) continue;
    const q = t / b.ms;
    const s = b.size * (1 - q * 0.45);
    ctx.globalAlpha = 1 - q * q * q;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x + b.vx * t - s / 2, b.y + b.vy * t + 0.5 * b.g * t * t - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}
function drawSparks(ctx, state, now) {
  for (const s of state.fx.sparks) {
    const p = (now - s.t0) / SPARK_MS;
    if (p < 0 || p >= 1) continue;
    const d = 4 + 10 * EASE2.out2(p);
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = "#c9d2e8";
    ctx.fillRect(s.x - d, s.y - 2, 5, 3);
    ctx.fillRect(s.x + d - 4, s.y - 2, 5, 3);
    ctx.fillRect(s.x - 2, s.y - d, 3, 5);
    ctx.fillRect(s.x - 2, s.y + d - 4, 3, 5);
  }
  ctx.globalAlpha = 1;
}
function drawFlare(ctx, state, now) {
  const f = state.fx.flare;
  const t = now - f.t0;
  if (t < 0 || t >= FLARE_MS) return;
  const G = state.G;
  const q = t / FLARE_MS;
  const e = EASE2.out3(q);
  const col = f.mult >= 4 ? "#ff9f45" : f.mult >= 3 ? "#ffd23f" : "#45e0e8";
  const r = G.pw * (0.22 + 0.9 * e);
  const spin = q * 0.7;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.globalAlpha = (1 - q) ** 1.6 * 0.95;
  ctx.lineWidth = 2 + 3 * (1 - q);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * (TAU2 / 6) + spin;
    const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r * 0.8;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = (1 - q) ** 1.6 * 0.5;
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * (TAU2 / 6) + spin;
    ctx.beginPath();
    ctx.moveTo(f.x + Math.cos(a) * r * 0.5, f.y + Math.sin(a) * r * 0.4);
    ctx.lineTo(f.x + Math.cos(a) * r * 0.94, f.y + Math.sin(a) * r * 0.75);
    ctx.stroke();
  }
  const pop = 1 + 0.9 * EASE2.out3(Math.min(1, q * 3.2));
  ctx.globalAlpha = Math.max(0, 1 - q * 1.35);
  ctx.textAlign = "center";
  ctx.fillStyle = col;
  ctx.font = font(700, Math.round(19 * pop));
  ctx.fillText("\xD7" + f.mult, f.x, f.y - G.ph * 0.86 - 22 * e);
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawChainBreak(ctx, state, now) {
  const cb = state.fx.chainBreak;
  const t = now - cb.t0;
  if (cb.quiet || t < 0 || t >= CHAIN_BREAK_MS) return;
  const q = t / CHAIN_BREAK_MS;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = font(700, 17);
  ctx.globalAlpha = Math.max(0, 1 - q * 1.2);
  ctx.fillStyle = "#ff5470";
  ctx.fillText("\xD7" + cb.chain + " CHAIN LOST", cb.x, cb.y - 16 - 22 * EASE2.out2(q));
  ctx.fillStyle = "#8a96b8";
  for (let i = 0; i < 5; i++) {
    const k = i - 2;
    ctx.globalAlpha = (1 - q) * 0.8;
    const sz = 8 - 4 * q;
    ctx.fillRect(cb.x + k * 13 + k * 34 * q - sz / 2, cb.y - 6 + 130 * q * q - sz / 2, sz, sz);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawPopups(ctx, state, now) {
  ctx.textAlign = "center";
  ctx.font = font(700, 15);
  for (const pp of state.fx.popups) {
    const t = now - pp.t0;
    if (t < 0 || t >= POPUP_MS) continue;
    const p = t / POPUP_MS;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = pp.color;
    ctx.fillText(pp.text, pp.x, pp.y - 30 * EASE2.out2(p));
  }
  ctx.globalAlpha = 1;
}
var BLASTS = {
  normal: { ms: 210, r: 1.7, rings: 1, shards: 7, wash: 0.05, hot: "#ffffff", warm: "#ffd23f", soot: "#c9992a" },
  charged: { ms: 250, r: 2.4, rings: 2, shards: 10, wash: 0.1, hot: "#ffffff", warm: "#c9f6ff", soot: "#45e0e8" },
  guard: { ms: 240, r: 2.1, rings: 2, shards: 9, wash: 0.08, hot: "#ffffff", warm: "#dfe7fb", soot: "#6c7794" },
  hopper: { ms: 215, r: 1.8, rings: 1, shards: 8, wash: 0.05, hot: "#ffffff", warm: "#a6f5bb", soot: "#1f7c3d" },
  rare: { ms: 275, r: 3.2, rings: 3, shards: 14, wash: 0.16, hot: "#ffffff", warm: "#ffe08a", soot: "#e8a020" },
  prog: { ms: 205, r: 1.5, rings: 1, shards: 6, wash: 0.04, hot: "#ffd7de", warm: "#ff5470", soot: "#2a7ab8" }
};
var spray = (i) => Math.sin(i * 127.1) * 0.5;
function blastOf(e) {
  if (e.type === "ally") return BLASTS.prog;
  if (e.type === "rare") return BLASTS.rare;
  if (e.type === "guard") return BLASTS.guard;
  if (e.type === "hopper") return BLASTS.hopper;
  return e.tier && e.tier.scale && e.tier.scale.peak >= 1.9 ? BLASTS.charged : BLASTS.normal;
}
function blastPhase(state, now, e) {
  if (e.state !== "hit") return -1;
  const t = now - e.t0;
  if (t < 0) return -1;
  const b = blastOf(e);
  return t >= b.ms ? -1 : t / b.ms;
}
function blastCenter(G, e) {
  const p = panel2(G, e.col, e.row);
  return { x: p.x + p.w / 2, y: p.y + p.h * 0.78 - G.ph * 1 * 0.42, u: G.pw * 0.4 };
}
function drawBlastUnder(ctx, state, now, e) {
  const q = blastPhase(state, now, e);
  if (q < 0) return;
  const b = blastOf(e);
  const G = state.G;
  const { x, y, u } = blastCenter(G, e);
  for (let r = 0; r < b.rings; r++) {
    const rq = (q - r * 0.14) / (1 - r * 0.14);
    if (rq <= 0) continue;
    const e3 = EASE2.out3(rq);
    ctx.globalAlpha = (1 - rq) ** 1.2 * (r ? 0.55 : 0.95);
    ctx.strokeStyle = r ? b.soot : b.warm;
    ctx.lineWidth = (r ? 3 : 7) * (1 - rq * 0.72);
    ring(ctx, x, y, u * (0.55 + b.r * e3 * (1 + r * 0.35)), 0.82);
    ctx.stroke();
  }
  ctx.lineCap = "round";
  ctx.strokeStyle = b.warm;
  for (let i = 0; i < b.shards; i++) {
    const a = i / b.shards * TAU2 + spray(i) * 0.42;
    const reach = 1 + spray(i + 7) * 0.5;
    const e3 = EASE2.out3(Math.min(1, q * 1.25));
    const r0 = u * 0.25 * e3, r1 = u * b.r * 1.15 * reach * e3;
    ctx.globalAlpha = (1 - q) ** 1.4;
    ctx.lineWidth = Math.max(1.5, 6.5 * (1 - q) * (b.r / 2));
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.85);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.85);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.globalAlpha = 1;
}
function drawBlastOver(ctx, state, now, e) {
  const q = blastPhase(state, now, e);
  if (q < 0) return;
  const b = blastOf(e);
  const G = state.G;
  const { x, y, u } = blastCenter(G, e);
  const cq = Math.min(1, q / 0.5);
  if (cq < 1) {
    const rad = u * (0.95 + b.r * 0.72 * EASE2.out2(cq));
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(255,255,255," + ((1 - cq) * 0.95).toFixed(3) + ")");
    g.addColorStop(0.45, "rgba(255,210,63," + ((1 - cq) * 0.4).toFixed(3) + ")");
    g.addColorStop(1, "rgba(255,159,69,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TAU2);
    ctx.fill();
  }
  ctx.globalAlpha = (1 - q) * 0.4;
  ctx.strokeStyle = b.soot;
  ctx.lineWidth = 6 * (1 - q * 0.5);
  ring(ctx, x, y, u * (0.6 + b.r * 0.5 * EASE2.out2(q)), 0.8);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawBlastWash(ctx, state, now, rm) {
  let a = 0;
  for (const e of state.enemies) {
    const q = blastPhase(state, now, e);
    if (q < 0 || q > 0.3) continue;
    const b = blastOf(e);
    a = Math.max(a, b.wash * (1 - q / 0.3));
  }
  if (a <= 2e-3) return;
  const G = state.G;
  ctx.fillStyle = "rgba(255,243,196," + (a * (rm ? RM.flash : 1)).toFixed(3) + ")";
  ctx.fillRect(0, 0, G.w, G.h);
}
var HURT_BURST_MS = 300;
var HURT_TEAR_MS = 120;
var HURT_VIGNETTE_MS = 440;
function drawHurtWorld(ctx, state, now, rm) {
  const G = state.G;
  const p = panel2(G, state.player.col, state.player.row);
  const cx = p.x + p.w / 2;
  const bh = G.ph * 1.15;
  const cy = p.y + p.h * 0.78 - bh * 0.5;
  const u = G.pw * 0.34;
  const t = now - state.fx.hurtT0;
  if (t >= 0 && t < HURT_BURST_MS) {
    const q = t / HURT_BURST_MS;
    const e3 = EASE2.out3(q);
    ctx.globalAlpha = (1 - q) ** 1.5;
    ctx.strokeStyle = "#ff5470";
    ctx.lineWidth = 5 * (1 - q * 0.7);
    ring(ctx, cx, cy, u * (0.7 + 2.6 * e3), 0.85);
    ctx.stroke();
    ctx.globalAlpha = (1 - q) ** 2 * 0.8;
    ctx.strokeStyle = "#ffd7de";
    ctx.lineWidth = 2;
    ring(ctx, cx, cy, u * (0.4 + 1.6 * EASE2.out2(q)), 0.7);
    ctx.stroke();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ff5470";
    ctx.globalAlpha = (1 - q) ** 1.4;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * (TAU2 / 4);
      const r0 = u * 0.5, r1 = u * (1.1 + 2.2 * e3);
      ctx.lineWidth = 5 * (1 - q);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.85);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.85);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.globalAlpha = 1;
  }
  const left = state.hurtUntil - now;
  if (left > 0 && left <= HIT_IFRAME_MS && state.mode === "playing") {
    const k = left / HIT_IFRAME_MS;
    const ending = k < 0.28;
    ctx.globalAlpha = (ending ? 0.85 : 0.45) * (rm ? 0.75 : 1);
    ctx.strokeStyle = ending ? "#45e0e8" : "#ff8ba0";
    ctx.lineWidth = ending ? 3 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, u * 1.3, -Math.PI / 2, -Math.PI / 2 + k * (TAU2 - RING_GAP2));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
function drawHurtScreen(ctx, state, now, rm, hud) {
  if (hud.mode !== "playing") return;
  const G = state.G;
  const t = now - state.fx.hurtT0;
  if (t < 0) return;
  if (t < HURT_FLASH_MS) {
    const a = 0.34 * (1 - t / HURT_FLASH_MS) ** 2 * (rm ? RM.flash : 1);
    ctx.fillStyle = "rgba(255,84,112," + a.toFixed(3) + ")";
    ctx.fillRect(0, 0, G.w, G.h);
  }
  if (t < HURT_TEAR_MS && !rm) {
    const q = t / HURT_TEAR_MS;
    for (let i = 0; i < 3; i++) {
      const ph = Math.sin(state.fx.hurtT0 * 0.013 + i * 2.399);
      const y = G.h * (0.18 + 0.3 * i + 0.08 * ph);
      const h = G.h * (0.035 + 0.02 * Math.abs(ph));
      const dx = (28 + 46 * Math.abs(ph)) * (1 - q) * (i % 2 ? -1 : 1);
      ctx.globalAlpha = (1 - q) * 0.4;
      ctx.fillStyle = "#ff5470";
      ctx.fillRect(dx, y, G.w, h);
      ctx.globalAlpha = (1 - q) * 0.22;
      ctx.fillStyle = "#45e0e8";
      ctx.fillRect(-dx * 0.6, y + h * 0.55, G.w, h * 0.5);
    }
    ctx.globalAlpha = 1;
  }
  if (t < HURT_VIGNETTE_MS) {
    const q = t / HURT_VIGNETTE_MS;
    const w = 36 * (1 - EASE2.out2(q));
    ctx.globalAlpha = (1 - q) ** 1.5 * 0.45 * (rm ? RM.flash + 0.3 : 1);
    ctx.strokeStyle = "#ff5470";
    ctx.lineWidth = w;
    ctx.strokeRect(w / 2, w / 2, G.w - w, G.h - w);
    ctx.globalAlpha = 1;
  }
}
var PAD = 18;
var LEVEL_POP_MS = 680;
var PIP_Y = 66;
var PIP_H = 12;
var PIP_GAP = 2;
var PIP_SECTION = 6;
var PIP_SECTION_GAP = 5;
var PIP_MIN_W = 5;
var PIP_LADDER = [1.25, 2.5, 5];
var PIP_LOSS_MS = 520;
var PIP_GAIN_MS = 260;
var CHAIN_TIERS = [5, 10, 20];
function lastDeletion(state) {
  const ps = state.fx.popups;
  for (let i = ps.length - 1; i >= 0; i--) {
    const txt = ps[i].text;
    if (txt.charCodeAt(0) === 43 && txt.charCodeAt(txt.length - 1) === 115) {
      const secs = parseFloat(txt);
      if (secs > 0) return { at: ps[i].t0 - 60, secs };
    }
  }
  return null;
}
function levelUpAt(state) {
  return Math.max(levelUpFromKills(state), state.levelT0 === void 0 ? -1e9 : state.levelT0);
}
function levelUpFromKills(state) {
  const del = state.deletions;
  if (del <= 0 || level(del) === level(del - 1)) return -Infinity;
  const d = lastDeletion(state);
  return d ? d.at : -Infinity;
}
function pipLayout(G) {
  const w = G.w - PAD * 2;
  let L = null;
  for (let i = 0; i < PIP_LADDER.length; i++) {
    const secs = PIP_LADDER[i];
    const n = Math.max(1, Math.round(TIME_CAP / secs));
    const sections = Math.ceil(n / PIP_SECTION);
    const pw = (w - (n - 1) * PIP_GAP - (sections - 1) * PIP_SECTION_GAP) / n;
    L = { x: PAD, w, n, secs, pw };
    if (pw >= PIP_MIN_W) break;
  }
  return L;
}
var pipX = (L, i) => L.x + i * (L.pw + PIP_GAP) + Math.floor(i / PIP_SECTION) * PIP_SECTION_GAP;
function eachPip(L, a, b, fn) {
  const from = Math.max(0, a), to = Math.min(L.n, b);
  if (to <= from) return;
  for (let i = Math.floor(from); i < Math.ceil(to); i++) {
    const lo = Math.min(1, Math.max(0, from - i));
    const hi = Math.min(1, Math.max(0, to - i));
    if (hi <= lo) continue;
    fn(pipX(L, i) + lo * L.pw, Math.max(1, (hi - lo) * L.pw), i);
  }
}
function drawTimePips(ctx, state, now, hud, rm) {
  const L = pipLayout(state.G);
  const y = PIP_Y, h = PIP_H;
  const playing = hud.mode === "playing";
  const low = hud.timeLeft < LOW_TIME && playing;
  const col = low ? "#ff5470" : hud.overclock ? "#ff9f45" : "#45e0e8";
  const filled = Math.max(0, Math.min(L.n, hud.timeLeft / L.secs));
  ctx.fillStyle = "#232c42";
  for (let i = 0; i < L.n; i++) ctx.fillRect(pipX(L, i), y, L.pw, h);
  ctx.fillStyle = "#2f3a57";
  for (let i0 = 0; i0 < L.n; i0 += PIP_SECTION) {
    const i1 = Math.min(L.n, i0 + PIP_SECTION) - 1;
    ctx.fillRect(pipX(L, i0), y + h + 3, pipX(L, i1) + L.pw - pipX(L, i0), 2);
  }
  if (low) ctx.globalAlpha = rm ? 0.9 : 0.74 + 0.26 * Math.sin(now / 105);
  ctx.fillStyle = col;
  eachPip(L, 0, filled, (x, w) => ctx.fillRect(x, y, w, h));
  ctx.globalAlpha = 1;
  const del = lastDeletion(state);
  if (del && playing) {
    const gt = now - del.at;
    if (gt >= 0 && gt < PIP_GAIN_MS) {
      const q = gt / PIP_GAIN_MS;
      ctx.globalAlpha = (1 - q) * 0.95;
      ctx.fillStyle = "#ffffff";
      const grow = 3 * (1 - q);
      eachPip(
        L,
        filled - del.secs / L.secs,
        filled,
        (x, w) => ctx.fillRect(x, y - grow, w, h + grow * 2)
      );
      ctx.globalAlpha = 1;
    }
  }
  const ht = now - state.fx.hurtT0;
  if (ht >= 0 && ht < PIP_LOSS_MS && playing) {
    const q = ht / PIP_LOSS_MS;
    const lift = rm ? 0 : 11 * EASE2.out2(q);
    const lost = HIT_TIME_PENALTY / L.secs;
    ctx.globalAlpha = (1 - q) * (rm ? 0.75 : 1);
    ctx.fillStyle = "#ff5470";
    eachPip(L, filled, filled + lost, (x, w) => ctx.fillRect(x, y - lift, w, h * (1 - 0.45 * q)));
    ctx.fillStyle = "#ffd7de";
    eachPip(L, filled, filled + lost, (x, w) => ctx.fillRect(x, y - lift, w, 2));
    ctx.globalAlpha = 1;
  }
  if (hud.overclock && playing) {
    ctx.strokeStyle = "#ff9f45";
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    eachPip(
      L,
      filled,
      filled + BONUS.normal * hud.overclockFactor / L.secs,
      (x, w) => ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), h - 1)
    );
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  if (filled > 0 && filled < L.n) {
    const i = Math.min(L.n - 1, Math.floor(filled));
    const hx = pipX(L, i) + (filled - i) * L.pw;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(hx - 2, y - 2, 2, h + 4);
    ctx.globalAlpha = 1;
  }
}
function drawLevel(ctx, state, now, hud, rm) {
  const G = state.G;
  const t = now - levelUpAt(state);
  const restSize = 34;
  const restX = PAD + 11, restY = 56;
  const col = hud.overclock ? "#ff9f45" : "#45e0e8";
  const num = String(hud.level).padStart(2, "0");
  const band0 = PIP_Y + PIP_H + 12;
  const bandH = Math.max(0, G.gy - 6 - band0);
  const room = bandH >= 46;
  const announcing = t >= 0 && t < LEVEL_POP_MS && hud.mode === "playing";
  const q = announcing ? t / LEVEL_POP_MS : 1;
  const hand = EASE2.out2(Math.min(1, Math.max(0, (q - 0.55) / 0.45)));
  const flash = announcing ? Math.max(0, 1 - q * 1.7) : 0;
  ctx.save();
  ctx.textAlign = "left";
  if (announcing && room) {
    const size = Math.round(Math.max(restSize, Math.min(bandH * 0.72, 92)));
    const y = band0 + bandH / 2 + size * 0.34;
    ctx.font = font(700, size);
    const x = G.w / 2 - ctx.measureText(num).width / 2;
    const a = 1 - hand;
    if (!rm) {
      ctx.globalAlpha = a * (1 - q) * 0.6;
      ctx.fillStyle = col;
      const rw = G.w * EASE2.out3(Math.min(1, q * 2.4));
      ctx.fillRect(G.w / 2 - rw / 2, y - size * 0.36, rw, 2);
      ctx.fillRect(G.w / 2 - rw / 2, y + size * 0.16, rw, 1);
    }
    ctx.globalAlpha = a * 0.8;
    ctx.font = font(700, Math.round(size * 0.19));
    ctx.fillStyle = "#5f6b8c";
    ctx.fillText(hud.unlimited ? "UNLIMITED" : "LEVEL", x, y - size * 0.82);
    ctx.font = font(700, size);
    if (flash > 0) {
      ctx.globalAlpha = a * flash * 0.5;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(num, x - 3, y - 3);
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = flash > 0.5 ? "#ffffff" : col;
    ctx.fillText(num, x, y);
  }
  const settle = announcing && room ? hand : 1;
  const pop = announcing ? Math.max(0, 1 - q * 1.2) : 0;
  ctx.globalAlpha = 0.9 * settle;
  ctx.fillStyle = col;
  ctx.fillRect(PAD, 16, 3, 42);
  ctx.globalAlpha = 0.75 * settle;
  ctx.font = font(700, 10);
  ctx.fillStyle = pop > 0.4 ? "#ffffff" : "#5f6b8c";
  ctx.fillText(hud.unlimited ? "UNLIMITED" : "LEVEL", restX, 26);
  ctx.globalAlpha = settle;
  ctx.font = font(700, restSize);
  ctx.fillStyle = pop > 0.4 && !room ? "#ffffff" : col;
  ctx.fillText(num, restX, restY);
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawChain(ctx, state, now, hud) {
  const G = state.G;
  const x = G.w - 70;
  const cb = state.fx.chainBreak;
  const cbt = now - cb.t0;
  ctx.textAlign = "right";
  if (hud.chain >= 2) {
    const ft = now - state.fx.flare.t0;
    const pop = ft >= 0 && ft < 280 ? 1 - ft / 280 : 0;
    const col = hud.mult >= 4 ? "#ff9f45" : hud.mult >= 3 ? "#ffd23f" : "#45e0e8";
    ctx.fillStyle = col;
    if (hud.mult >= 2) {
      ctx.font = font(700, Math.round(21 + 9 * pop));
      ctx.fillText("\xD7" + hud.mult, x, 40 + pop * 2);
    }
    const lo = CHAIN_TIERS.filter((c) => c <= hud.chain).at(-1) || 0;
    const hi = CHAIN_TIERS.find((c) => c > hud.chain);
    const frac = hi ? (hud.chain - lo) / (hi - lo) : 1;
    const bw = 54;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x - bw, 48, bw, 3);
    ctx.globalAlpha = 1;
    ctx.fillRect(x - bw, 48, bw * frac, 3);
  } else if (multOf(cb.chain) >= 2 && cbt >= 0 && cbt < CHAIN_BREAK_MS) {
    const q = cbt / CHAIN_BREAK_MS;
    const label = "\xD7" + multOf(cb.chain);
    ctx.globalAlpha = (1 - q) * 0.9;
    ctx.font = font(700, 21);
    ctx.fillStyle = "#5f6b8c";
    ctx.fillText(label, x, 40 + 6 * EASE2.out2(q));
    const w = ctx.measureText(label).width;
    ctx.strokeStyle = "#ff5470";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - w, 33 + 6 * EASE2.out2(q));
    ctx.lineTo(x - w + w * Math.min(1, q * 3), 33 + 6 * EASE2.out2(q));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left";
}
function drawHUD(ctx, state, now, rm) {
  const G = state.G;
  const hud = hudView(state);
  drawBlastWash(ctx, state, now, rm);
  drawLevel(ctx, state, now, hud, rm);
  drawChain(ctx, state, now, hud);
  drawTimePips(ctx, state, now, hud, rm);
  const low = hud.timeLeft < LOW_TIME;
  if (hud.mode === "playing" && !hud.paused && low) {
    const urg = 1 - Math.max(0, hud.timeLeft) / LOW_TIME;
    const pulse = rm ? 0.5 : 0.5 + 0.5 * Math.sin(now / 105);
    const a = (0.08 + 0.2 * urg) * (0.45 + 0.55 * pulse);
    ctx.strokeStyle = "#ff5470";
    ctx.globalAlpha = a;
    ctx.lineWidth = 24;
    ctx.strokeRect(12, 12, G.w - 24, G.h - 24);
    ctx.globalAlpha = Math.min(1, a * 2);
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, G.w - 3, G.h - 3);
    ctx.globalAlpha = 1;
  }
  drawHurtScreen(ctx, state, now, rm, hud);
  if (hud.mode === "playing" && hud.paused) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(27,34,51,0.75)";
    ctx.fillRect(0, 0, G.w, G.h);
    ctx.fillStyle = "#aab4ce";
    ctx.font = font(700, 24);
    ctx.fillText("PAUSED", G.w / 2, G.h / 2 - 8);
    ctx.fillStyle = "#45e0e8";
    ctx.globalAlpha = rm ? 0.8 : 0.55 + 0.45 * Math.sin(now / 320);
    ctx.fillRect(G.w / 2 - 11, G.h / 2 + 16, 7, 22);
    ctx.fillRect(G.w / 2 + 4, G.h / 2 + 16, 7, 22);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
}

// src/shell/mount.js
var MAX_DT = 50;
function mountBusterWhack(container, options = {}) {
  const doc = container && container.ownerDocument;
  const win = doc && doc.defaultView || (typeof window !== "undefined" ? window : null);
  if (!win || !(container instanceof win.Element)) {
    throw new TypeError("mountBusterWhack: container must be a DOM element");
  }
  const storageKey = options.storageKey || "bw_best";
  const { root, els } = createUI(container);
  const ctx = els.cv.getContext("2d");
  const audio = createAudio(win);
  let destroyed = false;
  let rafId = null;
  let resizeObserver = null;
  const cleanupFns = [];
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    cleanupFns.push(() => target.removeEventListener(type, fn, opts));
  }
  function storage() {
    try {
      return win.localStorage;
    } catch (e) {
      return null;
    }
  }
  let best = 0;
  try {
    best = Number(storage().getItem(storageKey)) || 0;
  } catch (e) {
  }
  const seed = options.seed !== void 0 ? options.seed : (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0;
  const motionQuery = win.matchMedia ? win.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const state = createState({ seed, best, reducedMotion: !!(motionQuery && motionQuery.matches) });
  if (motionQuery) {
    const onMotion = (e) => {
      state.reducedMotion = e.matches;
    };
    if (motionQuery.addEventListener) on(motionQuery, "change", onMotion);
    else if (motionQuery.addListener) {
      motionQuery.addListener(onMotion);
      cleanupFns.push(() => motionQuery.removeListener(onMotion));
    }
  }
  function resize() {
    const dpr = win.devicePixelRatio || 1;
    const r = els.stage.getBoundingClientRect();
    els.cv.width = Math.round(r.width * dpr);
    els.cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setLayout(state, r.width, r.height);
  }
  resize();
  const RO = win.ResizeObserver || (typeof ResizeObserver !== "undefined" ? ResizeObserver : null);
  if (RO) {
    resizeObserver = new RO(() => resize());
    resizeObserver.observe(els.stage);
  } else {
    on(win, "resize", resize);
  }
  const queue = [];
  const dispatch = (intent) => queue.push(intent);
  function toggleMute() {
    const muted = audio.toggleMute();
    renderSound(els, !muted);
  }
  renderModes(els, MODES, DEFAULT_MODE);
  const input = createInput({
    win,
    host: container,
    root,
    els,
    on,
    dispatch,
    onGesture: () => audio.resume(),
    onMute: toggleMute,
    modes: MODES,
    onModeChange: (id) => selectMode(els, id)
  });
  function refreshStats() {
    renderStats(els, statsView(state));
    renderBombs(els, state.bombs || 0);
  }
  function showInterlevel(ev) {
    const v = interlevelView(state, ev.stage, ev.timeBonus === void 0 ? STAGE_BONUS : ev.timeBonus);
    showOverlay(doc, els, {
      eyebrow: v.eyebrow,
      title: v.title,
      sub: v.sub,
      stats: statRows(v.rows),
      buttons: [
        { label: "CONTINUE", fn: () => dispatch({ type: "resume" }) },
        { label: "END RUN", dim: true, fn: () => dispatch({ type: "endRun" }) }
      ]
    });
  }
  function showOver() {
    const v = gameOverView(state);
    showOverlay(doc, els, {
      eyebrow: v.eyebrow,
      title: v.title,
      rank: v.rank,
      sub: v.sub,
      stats: statRows(v.rows),
      // retry the mode you were playing, not whatever the menu last had lit
      buttons: [{ label: "RETRY", fn: () => {
        audio.resume();
        dispatch({ type: "startRun", modeId: state.modeId });
      } }]
    });
  }
  function handleEvent(ev) {
    switch (ev.type) {
      case "statsChanged":
        refreshStats();
        break;
      case "runStarted":
        hideOverlay(els);
        break;
      case "resumed":
        hideOverlay(els);
        break;
      case "stageGate":
        showInterlevel(ev);
        break;
      case "gameOver":
        if (ev.newBest) {
          try {
            storage().setItem(storageKey, String(ev.best));
          } catch (e) {
          }
        }
        showOver();
        break;
      case "paused":
      case "unpaused":
        if (root.activeElement && root.activeElement !== els.stage) root.activeElement.blur();
        input.focus();
        break;
      default:
        break;
    }
  }
  const raf = win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : requestAnimationFrame;
  const caf = win.cancelAnimationFrame ? win.cancelAnimationFrame.bind(win) : cancelAnimationFrame;
  let lastFrame = 0;
  function frame(nowRaf) {
    const dt = Math.min(MAX_DT, nowRaf - lastFrame);
    lastFrame = nowRaf;
    const actions = queue.splice(0, queue.length);
    const events = step(state, dt, { actions, hold: input.hold() });
    audio.handleAll(events);
    for (const ev of events) handleEvent(ev);
    audio.observe(hudView(state), state.charge.downAt !== null, state.charge.full);
    draw(ctx, state, state.clock);
    rafId = raf(frame);
  }
  refreshStats();
  showSplash(els, state.best);
  lastFrame = (win.performance || performance).now();
  rafId = raf(frame);
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (rafId !== null) caf(rafId);
    if (resizeObserver) resizeObserver.disconnect();
    for (const fn of cleanupFns) fn();
    audio.close();
    root.innerHTML = "";
  }
  return { destroy };
}
var mount_default = mountBusterWhack;
export {
  mount_default as default,
  mountBusterWhack
};
/*!
 * Tuning tables, ramp functions and layout math.
 *
 * Pure module: numbers in, numbers out. No DOM, no audio, no randomness,
 * no clock. Everything the game is balanced around lives here so the ramps
 * can be read (and tested) without booting the shell.
 */
/*!
 * The world: an unbounded horizontal strip of segments.
 *
 *   [arena][road][arena][road][arena] ...
 *
 * An arena is COLS wide. While it is held by the enemy its left PCOLS columns
 * are the player's footing and the rest is theirs; once its wave is wiped the
 * whole arena is the player's, a road opens off its right edge, and the next
 * arena waits at the far end of the road. A road is ROAD_COLS long and either
 * full height or a single middle row, so some crossings funnel the player.
 *
 * Classic is the degenerate case: one arena at x0 = 0 that never clears to a
 * road. Everything below reads the segment list, so there is no classic branch
 * in the simulation -- only a mode flag that decides whether a wipe appends.
 *
 * Coordinates are world columns, unbounded to the right. The simulation works
 * in world pixels (gx + wx * pw) throughout; the camera exists only in the
 * renderer, as a translate. Deterministic: road heights come from state.rng.
 */
/*!
 * Seedable PRNG (mulberry32).
 *
 * The core never calls Math.random(); it draws from an rng function held on
 * the state, so a run is reproducible from its seed. Same seed + same dt
 * sequence + same intents => same state.
 */
/*!
 * The game state object.
 *
 * Plain data plus an injected rng. `step` mutates it in place — at 60fps that
 * is the point — so nothing here is frozen or copied per frame.
 */
/*!
 * Pure selectors — the view model the renderer, the HUD and the overlays read.
 * Never mutates state.
 */
/*!
 * The simulation.
 *
 *   step(state, dtMs, intents) -> events[]
 *
 * Deterministic and effect-free: no DOM, no audio, no Math.random, no clock
 * reads. Randomness comes from `state.rng`, time only from `dtMs`. Anything
 * the outside world should hear, show or persist leaves as an event; the shell
 * drains the list and performs it.
 *
 * `intents` is either an array of actions or `{ actions, hold }`:
 *   actions - discrete inputs since the last step, applied in order *before*
 *             the clock advances (which is where they landed when the shell
 *             handled DOM events inline).
 *   hold    - a held d-pad direction `{ dc, dr }`, polled after the clock
 *             advances, throttled by MOVE_REPEAT_MS like any other move.
 */
/*!
 * DOM shell: the shadow-root template, and the overlays/footer that hang off it.
 * Everything here is markup and element plumbing — no game logic.
 */
/*!
 * Web Audio shell.
 *
 * Owns the AudioContext, the sfx bank and the music engine, and maps core
 * events to sound. The core never makes a noise; it emits `{ type: "hit", … }`
 * and this module decides what that sounds like.
 *
 * Everything is synthesized — no samples, no dependencies, so the game is
 * still one bundled JS file with nothing to fetch.
 *
 * Signal flow:
 *
 *     sfx voices ─────────────────► sfxBus ──┐
 *                                            ├─► master ─► limiter ─► out
 *     music voices ─► musicBus ─► duck ──────┘
 *
 * `master` is the mute switch — one gain, so muting is instant and also
 * silences notes already scheduled ahead of the clock. `duck` is the
 * sidechain: big sfx pull the music down for a moment so they cut through.
 *
 * Two things drive this module:
 *   - `handleAll(events)` — discrete core events become one-shot sounds.
 *   - `observe(view, charging, chargeFull)` — a per-frame read of the game's
 *     view model. Everything continuous (the music transport, the charge
 *     sweep, the low-time alarm) is derived from it declaratively, so no
 *     transition can be missed and nothing can be left stuck on.
 */
/*!
 * Input shell: DOM pointer / keyboard / d-pad -> core intents.
 *
 * Nothing here touches game state. Discrete inputs are queued via `dispatch`
 * and drained by the frame loop; the analog ring's held direction is polled
 * each frame through `hold()`.
 *
 * Three rules shape everything below, and all three exist because the game is
 * a *guest* on someone else's page — often inside a sandboxed iframe on a
 * phone:
 *
 *   1. Every press is owned by the source that made it. A finger on the ring
 *      and a finger on FIRE are two independent pointers; releasing one must
 *      not release the other. Same for the keyboard.
 *   2. Touch gestures that start on the game stop at the game. The host page
 *      must never read them as a scroll, a swipe or a pinch.
 *   3. The keyboard is only ours when nobody else has claimed it. A host page's
 *      text field outranks the player.
 */
/*!
 * Canvas renderer.
 *
 * `draw(ctx, state, now)` takes a 2D context, a plain state object (which
 * carries its own geometry in `state.G`) and a time in ms. It touches no DOM:
 * no document, no window, no element lookups, no getBoundingClientRect, no
 * matchMedia — so the same frame can be drawn off-screen against any
 * CanvasRenderingContext2D implementation. It never mutates the state either.
 *
 * Everything it animates is a pure function of `state` and `now`. It owns no
 * randomness: particles, shake envelopes and flourishes are authored in the
 * core (seeded) and merely read here. That is what keeps the golden-frame
 * harness honest.
 *
 * Accessibility: `state.reducedMotion` damps screen shake, full-screen
 * flashing and every strobe. The renderer cannot read a media query itself, so
 * the shell reads it and hands the answer in as data.
 */
/*!
 * The shell's wiring: shadow root, canvas, rAF loop, and the bridge between
 * the pure core and the effectful world (DOM, audio, storage).
 */
/*!
 * Buster Whack — a virus-busting, whack-a-mole arcade minigame.
 *
 * Usage:
 *   import { mountBusterWhack } from "./buster-whack.js";
 *   const game = mountBusterWhack(document.getElementById("game-container"));
 *   // ...later, if you need to tear it down:
 *   game.destroy();
 *
 * The container element must have a real, non-zero size (set width/height
 * via CSS on your page) — the game fills it completely. Everything is
 * rendered inside a Shadow DOM root, so the game's styles, element IDs and
 * global key/pointer listeners are self-contained and won't collide with
 * the rest of the host page, and multiple instances can be mounted safely.
 *
 * Layout: `src/core/` is the deterministic simulation (no DOM, no audio, no
 * clock, no Math.random) and `src/shell/` performs its effects. See README.
 */
