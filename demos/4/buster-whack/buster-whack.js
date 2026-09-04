var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/core/constants.js
var constants_exports = {};
__export(constants_exports, {
  ADVANCE_STAGES: () => ADVANCE_STAGES,
  BIT_COUNT: () => BIT_COUNT,
  BIT_GRAVITY: () => BIT_GRAVITY,
  BIT_MS: () => BIT_MS,
  CHAIN_BREAK_MS: () => CHAIN_BREAK_MS,
  COLS: () => COLS,
  DEBRIS: () => DEBRIS,
  DEFAULT_MODE: () => DEFAULT_MODE,
  EASE: () => EASE,
  FLARE_MS: () => FLARE_MS,
  FORMATIONS: () => FORMATIONS,
  GHOST_MS: () => GHOST_MS,
  HITSTOP: () => HITSTOP,
  HURT_FLASH_MS: () => HURT_FLASH_MS,
  HURT_SHAKE_MS: () => HURT_SHAKE_MS,
  LANE_MS: () => LANE_MS,
  LULL_TIGHTEN_STAGE: () => LULL_TIGHTEN_STAGE,
  MAX_BITS: () => MAX_BITS,
  MAX_HITSTOP: () => MAX_HITSTOP,
  MODES: () => MODES,
  MUZZLE_MS: () => MUZZLE_MS,
  PCOLS: () => PCOLS,
  POPUP_MS: () => POPUP_MS,
  RAY_IMPACT_MS: () => RAY_IMPACT_MS,
  RETIRED_MODES: () => RETIRED_MODES,
  RING_GAP: () => RING_GAP,
  RIPPLE_MS: () => RIPPLE_MS,
  RM: () => RM,
  ROAD_COLS: () => ROAD_COLS,
  ROAD_MID_ROW: () => ROAD_MID_ROW,
  ROWS: () => ROWS,
  SHAKE: () => SHAKE,
  SPARK_MS: () => SPARK_MS,
  STAGES: () => STAGES,
  STORY_ROUTE: () => STORY_ROUTE,
  TAP_SLACK: () => TAP_SLACK,
  TAU: () => TAU,
  TIERS: () => TIERS,
  TOWER_COLS: () => TOWER_COLS,
  TOWER_SPECS: () => TOWER_SPECS,
  UNLOCK: () => UNLOCK,
  WAVE_SIZE: () => WAVE_SIZE,
  boltKindFor: () => boltKindFor,
  impulseValue: () => impulseValue,
  laneY: () => laneY,
  layout: () => layout,
  makeImpulse: () => makeImpulse,
  modeById: () => modeById,
  multOf: () => multOf,
  panelRect: () => panelRect,
  towerSpec: () => towerSpec,
  waveSize: () => waveSize
});

// src/core/enemies.js
var ATTACKS = {
  // one bolt down the firer's own lane: the game's original shot
  bolt: { shots: [{ dRow: 0, delayKey: null, speedKey: null, radiusKey: null }] },
  // a fan: the firer's lane and both neighbours at once. Standing still is
  // the wrong answer to it; so is stepping one lane.
  spread: { shots: [
    { dRow: -1, delayKey: null, speedKey: null, radiusKey: null },
    { dRow: 0, delayKey: null, speedKey: null, radiusKey: null },
    { dRow: 1, delayKey: null, speedKey: null, radiusKey: null }
  ] },
  // two down one lane, the second a beat behind: dodging back too early is
  // the mistake it punishes
  volley: { shots: [
    { dRow: 0, delayKey: null, speedKey: null, radiusKey: null },
    { dRow: 0, delayKey: "VOLLEY_GAP_MS", speedKey: null, radiusKey: null }
  ] },
  // a slow fat one that owns the lane while it crosses: leave, or be hit
  wall: { shots: [
    { dRow: 0, delayKey: null, speedKey: "WALL_SPEED_FACTOR", radiusKey: "WALL_RADIUS_FACTOR" }
  ] }
};
var ENEMIES = {
  mett: {
    canon: "enemy.rot.01",
    family: "rot",
    friendly: false,
    hpKey: null,
    riseKey: "RISE_MS",
    lifeKey: null,
    hopKey: "MET_HOP_MS",
    hopWhenHeld: true,
    retaliate: true,
    attack: "bolt",
    bolt: "slow",
    armor: null,
    stagger: false,
    scoreKey: null
  },
  guard: {
    canon: "enemy.sweeper.01",
    family: "sweeper",
    friendly: false,
    hpKey: null,
    riseKey: "RISE_MS",
    lifeKey: null,
    hopKey: null,
    hopWhenHeld: false,
    // The anchor of a formation already demands the one thing that pins you
    // in place (a held charge); making it shoot too would punish the exact
    // behaviour it exists to teach.
    retaliate: false,
    attack: null,
    bolt: "slow",
    armor: "steel",
    stagger: false,
    scoreKey: "guard"
  },
  hopper: {
    canon: "enemy.static.01",
    family: "static",
    friendly: false,
    hpKey: "HOPPER_HP",
    riseKey: "RISE_MS",
    lifeKey: "HOPPER_LIFE",
    hopKey: "HOP_MS",
    hopWhenHeld: false,
    retaliate: true,
    attack: "bolt",
    bolt: "fast",
    armor: null,
    stagger: true,
    scoreKey: "hopper"
  },
  ally: {
    canon: "ally",
    family: "prog",
    friendly: true,
    hpKey: null,
    riseKey: "ALLY_RISE_MS",
    lifeKey: null,
    hopKey: null,
    hopWhenHeld: false,
    retaliate: false,
    attack: null,
    bolt: "slow",
    armor: null,
    stagger: false,
    scoreKey: null
  },
  rare: {
    canon: "enemy.rot.01",
    family: "rot",
    friendly: false,
    hpKey: null,
    riseKey: "RISE_MS",
    lifeKey: "RARE_LIFE",
    hopKey: null,
    hopWhenHeld: false,
    retaliate: false,
    attack: null,
    bolt: "slow",
    armor: null,
    stagger: false,
    scoreKey: "rare"
  },
  sentinel: {
    canon: "enemy.sweeper.01",
    family: "sweeper",
    friendly: false,
    hpKey: null,
    riseKey: "RISE_MS",
    lifeKey: null,
    // hp and timings come from the mark
    hopKey: null,
    hopWhenHeld: false,
    retaliate: true,
    attack: "bolt",
    bolt: "slow",
    armor: "shutter",
    stagger: true,
    scoreKey: "sentinel"
  },
  // ---- the rot that learned to fan out, to clog a lane, and the static
  // that learned to shoot twice. Each is one row here and one attack above.
  spreader: {
    canon: "enemy.rot.02",
    family: "rot",
    friendly: false,
    hpKey: "SPREADER_HP",
    riseKey: "RISE_MS",
    lifeKey: null,
    hopKey: null,
    hopWhenHeld: false,
    retaliate: true,
    attack: "spread",
    bolt: "slow",
    armor: null,
    stagger: true,
    scoreKey: "spreader"
  },
  warden: {
    canon: "enemy.rot.03",
    family: "rot",
    friendly: false,
    hpKey: "WARDEN_HP",
    riseKey: "RISE_MS",
    lifeKey: null,
    hopKey: null,
    hopWhenHeld: false,
    retaliate: true,
    attack: "wall",
    bolt: "slow",
    armor: null,
    stagger: true,
    scoreKey: "warden"
  },
  darter: {
    canon: "enemy.static.02",
    family: "static",
    friendly: false,
    hpKey: "DARTER_HP",
    riseKey: "RISE_MS",
    lifeKey: "HOPPER_LIFE",
    hopKey: "DARTER_HOP_MS",
    hopWhenHeld: false,
    retaliate: true,
    attack: "volley",
    bolt: "fast",
    armor: null,
    stagger: true,
    scoreKey: "darter"
  }
};
var ENEMY_TYPES = Object.keys(ENEMIES);
var inBoard = (row) => row >= 0 && row < ROWS;
var DEF_FALLBACK = ENEMIES.mett;
var enemyDef = (type) => ENEMIES[type] || DEF_FALLBACK;
var boltKindFor = (type) => enemyDef(type).bolt;
var canRetaliate = (type) => enemyDef(type).retaliate;
function hpOf(tuning, type) {
  const key = enemyDef(type).hpKey;
  return key ? tuning[key] : 1;
}
function riseMsOf(tuning, type) {
  return tuning[enemyDef(type).riseKey];
}
function shotsOf(tuning, type) {
  const def = enemyDef(type);
  const atk = def.attack ? ATTACKS[def.attack] : null;
  if (!atk) return [];
  return atk.shots.map((s) => ({
    dRow: s.dRow,
    delay: s.delayKey ? tuning[s.delayKey] : 0,
    speedFactor: s.speedKey ? tuning[s.speedKey] : 1,
    radiusFactor: s.radiusKey ? tuning[s.radiusKey] : 1
  }));
}

// src/core/constants.js
var ROWS = 3;
var COLS = 6;
var PCOLS = 3;
var ROAD_COLS = 3;
var ROAD_MID_ROW = 1;
var ADVANCE_STAGES = [
  { arena: 5, title: "STEEL GUARDS" },
  { arena: 9, title: "RETALIATION" },
  { arena: 15, title: "HOPPERS" },
  { arena: 20, title: "SENTINELS" },
  { arena: 30, title: "PROGS ONLINE" },
  { arena: 40, title: "SENTINEL MK II" },
  { arena: 55, title: "SWARM" },
  { arena: 70, title: "SENTINEL MK III" },
  { arena: 100, title: "UNLIMITED" }
];
var TOWER_COLS = 6;
var STORY_ROUTE = [
  "roost.01",
  "roost.02",
  "roost.03",
  "roost.05",
  "roost.06",
  "roost.04",
  "roost.07",
  "roost.08",
  "roost.05",
  "roost.03",
  "roost.02",
  "roost.04",
  "roost.01"
];
var TOWER_SPECS = {
  "roost.01": { npcs: [{ id: "npc.keeper.01", col: 3, row: 1, verb: "talk" }] },
  "roost.02": { npcs: [{ id: "npc.keeper.02", col: 3, row: 1, verb: "talk" }, { id: "npc.side.tally", col: 4, row: 2, verb: "talk" }] },
  "roost.03": { npcs: [{ id: "npc.keeper.03", col: 3, row: 1, verb: "talk" }, { id: "npc.side.vesper", col: 4, row: 0, verb: "talk" }] },
  "roost.04": { npcs: [{ id: "npc.keeper.04", col: 3, row: 1, verb: "talk" }, { id: "npc.side.rivet", col: 4, row: 2, verb: "talk" }] },
  "roost.05": { npcs: [{ id: "npc.keeper.05", col: 3, row: 1, verb: "talk" }, { id: "npc.side.bean", col: 4, row: 0, verb: "talk" }] },
  "roost.06": { npcs: [{ id: "boss.ferryman", col: 3, row: 1, verb: "talk" }, { id: "npc.sweeper.tidy", col: 4, row: 2, verb: "talk" }] },
  "roost.07": { npcs: [{ id: "boss.foreman", col: 3, row: 1, verb: "talk" }] },
  "roost.08": { npcs: [{ id: "item.journal.steward", col: 3, row: 1, verb: "read" }] }
};
var towerSpec = (roost) => TOWER_SPECS[roost] || { npcs: [] };
var TAP_SLACK = 0.4;
var MODES = [
  // The game: the Rookery's story on one strip. Two-thumb controls -- the
  // ring and the quarter-circle FIRE -- with the board taking taps to walk
  // there, and every step a hop.
  {
    id: "story",
    name: "STORY",
    blurb: "the Rookery",
    advancing: true,
    story: true,
    controls: "pad",
    hop: true,
    tapMove: true
  }
];
var RETIRED_MODES = [
  {
    id: "onehand",
    name: "ONE HAND",
    blurb: "stick \xB7 tap \xB7 fire",
    advancing: true,
    controls: "touch",
    hop: true,
    tapMove: true
  },
  {
    id: "advance",
    name: "ADVANCE",
    blurb: "ring + fire",
    advancing: true,
    controls: "pad"
  },
  {
    id: "classic",
    name: "CLASSIC",
    blurb: "hold the line",
    advancing: false,
    controls: "pad"
  }
];
var DEFAULT_MODE = "story";
var modeById = (id) => MODES.find((m) => m.id === id) || RETIRED_MODES.find((m) => m.id === id) || MODES[0];
var WAVE_SIZE = [2, 2, 3, 3, 3, 4, 4, 4, 5];
var waveSize = (stageIdx) => WAVE_SIZE[Math.max(0, Math.min(WAVE_SIZE.length - 1, stageIdx))];
var LULL_TIGHTEN_STAGE = 7;
var FORMATIONS = [
  { name: "spine", anchor: 0, slots: [[4, 1], [4, 0], [4, 2], [3, 1], [5, 1]] },
  { name: "rank", anchor: 2, slots: [[5, 1], [4, 1], [3, 1], [5, 0], [5, 2]] },
  { name: "stagger", anchor: 4, slots: [[3, 0], [4, 1], [5, 2], [5, 0], [3, 2]] },
  { name: "pincer", anchor: 2, slots: [[3, 0], [3, 2], [4, 1], [5, 0], [5, 2]] },
  { name: "wall", anchor: 1, slots: [[5, 0], [5, 1], [5, 2], [4, 0], [4, 2]] },
  { name: "wedge", anchor: 0, slots: [[5, 1], [4, 0], [4, 2], [3, 1], [3, 0]] }
];
var UNLOCK = { guard: 1, retaliate: 2, ally: 3, hopper: 4, rare: 5 };
var HURT_SHAKE_MS = 260;
var multOf = (chain) => chain >= 20 ? 4 : chain >= 10 ? 3 : chain >= 5 ? 2 : 1;
var STAGES = [
  { wave: 16, at: 26, title: "STEEL GUARDS" },
  { wave: 28, at: 52, title: "RETALIATION" },
  { wave: 40, at: 78, title: "PROGS ONLINE" },
  { wave: 52, at: 105, title: "HOPPERS" },
  { wave: 64, at: 130, title: "RARE VIRUS" },
  { wave: 76, at: 170, title: "OVERCLOCK" },
  // the shipped OC_START
  { wave: 90, at: 195, title: "SWARM" },
  { wave: 106, at: 235, title: "MAXIMUM LOAD" }
];
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
var HITSTOP = {
  normal: 26,
  charged: 52,
  guard: 46,
  hopper: 30,
  rare: 96,
  spreader: 38,
  warden: 44,
  darter: 32,
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
  spreader: { amp: 6, ms: 175 },
  warden: { amp: 7.5, ms: 200 },
  darter: { amp: 5, ms: 160 },
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
  spreader: ["#ffa23f", "#ffd0a0", "#ffe8d0"],
  warden: ["#c07be0", "#e0bcf0", "#f0dcff"],
  darter: ["#3fd8b0", "#a0f0dc", "#d8fff4"],
  player: ["#ff5470", "#ff9f45", "#ffd7de"]
};
var BIT_COUNT = {
  normal: 9,
  charged: 14,
  guard: 13,
  hopper: 11,
  rare: 22,
  spreader: 12,
  warden: 13,
  darter: 11,
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
function layout(w, h, bottomInset = 0) {
  const gw = Math.min(w * 0.9, 760);
  const pw = gw / COLS;
  const hh = h - bottomInset;
  const reserve = 180;
  const ph = Math.min(pw * 0.62, (hh - reserve) / ROWS);
  return {
    w,
    h,
    pw,
    ph,
    gx: (w - pw * COLS) / 2,
    // above a deck the board rests on it: the squares are the tap targets and
    // FIRE is under the same thumb, so the two should touch
    gy: bottomInset > 0 ? hh - ph * ROWS : h * 0.52 - ph * ROWS / 2,
    bottomInset
  };
}
function panelRect(G, col, row) {
  return { x: G.gx + col * G.pw, y: G.gy + row * G.ph, w: G.pw, h: G.ph };
}
function laneY(G, row) {
  return panelRect(G, 0, row).y + G.ph * 0.78 - G.ph * 1.15 * 0.42;
}

// src/core/tuning.js
var TUNING_SCHEMA = [
  ["clock", [
    ["START_TIME", 30, 5, 120, 1, "s", "Pulse at the start of a run."],
    ["TIME_CAP", 45, 10, 180, 1, "s", "The most pulse you can hold."],
    ["LOW_TIME", 6, 1, 20, 0.5, "s", "Below this the clock is low: alarm, red pips, shorter lulls, more rares."],
    ["HIT_TIME_PENALTY", 2.5, 0, 10, 0.1, "s", "Pulse lost to one hit."],
    ["DRAIN_BASE", 1, 0.2, 3, 0.05, "x", "Pulse spent per second in a contested arena, at the start of the road."],
    ["DRAIN_PER_ARENA", 0.02, 0, 0.2, 1e-3, "x", "The road breathes harder: drain rises by this per arena."],
    ["DRAIN_MAX", 1.45, 0.5, 4, 0.05, "x", "Drain stops rising here, and the viruses carry the rest."],
    ["HIT_IFRAME_MS", 800, 0, 3e3, 50, "ms", "Invulnerable after a hit for this long."],
    ["STAGE_BONUS", 2, 0, 10, 0.1, "s", "Pulse for passing a stage card (retired modes)."]
  ]],
  ["scoring", [
    ["PTS_NORMAL", 100, 0, 5e3, 10, "pts", "A plain deletion."],
    ["PTS_CHARGED", 300, 0, 5e3, 10, "pts", "A charged deletion."],
    ["PTS_GUARD", 400, 0, 5e3, 10, "pts", "A steel guard."],
    ["PTS_HOPPER", 250, 0, 5e3, 10, "pts", "A hopper."],
    ["PTS_SENTINEL", 500, 0, 5e3, 10, "pts", "A sentinel."],
    ["PTS_RARE", 1e3, 0, 1e4, 50, "pts", "A rare virus (retired modes)."],
    ["PTS_SPREADER", 350, 0, 5e3, 10, "pts", "A spreader: the rot that fires across three lanes."],
    ["PTS_WARDEN", 450, 0, 5e3, 10, "pts", "A warden: the rot that walls a lane."],
    ["PTS_DARTER", 300, 0, 5e3, 10, "pts", "A darter: the static that shoots twice."],
    ["BONUS_NORMAL", 1.2, 0, 10, 0.1, "s", "Pulse for a plain deletion, before overclock decay."],
    ["BONUS_CHARGED", 2.5, 0, 10, 0.1, "s", "Pulse for a charged deletion."],
    ["BONUS_GUARD", 3, 0, 10, 0.1, "s", "Pulse for a steel guard."],
    ["BONUS_HOPPER", 1.8, 0, 10, 0.1, "s", "Pulse for a hopper."],
    ["BONUS_SENTINEL", 3, 0, 10, 0.1, "s", "Pulse for a sentinel."],
    ["BONUS_RARE", 8, 0, 30, 0.5, "s", "Pulse for a rare."],
    ["BONUS_SPREADER", 2.2, 0, 10, 0.1, "s", "Pulse for a spreader."],
    ["BONUS_WARDEN", 2.6, 0, 10, 0.1, "s", "Pulse for a warden."],
    ["BONUS_DARTER", 2, 0, 10, 0.1, "s", "Pulse for a darter."],
    ["ALLY_TIME_PENALTY", 3, 0, 10, 0.1, "s", "Pulse lost for shooting a runner."],
    ["ALLY_PTS_PENALTY", 200, 0, 5e3, 10, "pts", "Points lost for shooting a runner."],
    ["ALLY_SPARE_BONUS", 0.5, 0, 5, 0.1, "s", "Pulse for letting a runner pass."],
    ["ARENA_CLEAR_BONUS", 3, 0, 15, 0.1, "s", "Pulse for taking an arena."],
    ["ARENA_CLEAR_PTS", 1500, 0, 1e4, 50, "pts", "Points for taking an arena."],
    ["WAVE_CLEAR_PTS", 60, 0, 1e3, 5, "pts", "Points per virus for a perfect wave, times the multiplier."],
    ["WAVE_CLEAR_BONUS_BASE", 0.55, 0, 5, 0.05, "s", "Pulse for a perfect wave, plus per-virus below."],
    ["WAVE_CLEAR_BONUS_PER", 0.3, 0, 2, 0.05, "s", "Extra pulse per virus in a perfect wave."],
    ["OC_START", 170, 20, 1e3, 5, "kills", "Deletions after which pulse rewards decay (overclock)."],
    ["OC_SLOPE", 0.988, 0.9, 1, 1e-3, "x", "Per-deletion decay factor past overclock."],
    ["ROAD_PULSE", 0.4, 0.1, 2, 0.05, "x", "Pulse rewards on the road, where nothing escapes and every kill pays."],
    ["LEVEL_PER_KILLS", 6, 1, 50, 1, "kills", "Kills per level in the retired kill-counted modes."]
  ]],
  ["timings", [
    ["CHARGE_MS", 700, 200, 2e3, 10, "ms", "Hold FIRE this long for a charged shot."],
    ["RISE_MS", 220, 50, 1e3, 10, "ms", "A virus surfacing."],
    ["SINK_MS", 180, 50, 1e3, 10, "ms", "A virus sinking away."],
    ["HIT_MS", 280, 50, 1e3, 10, "ms", "A virus's hit reaction."],
    ["MOVE_REPEAT_MS", 130, 30, 500, 10, "ms", "Ring repeat in the retired step-on-the-spot modes."],
    ["TAP_MOVE_MS", 195, 60, 1e3, 5, "ms", "The step ration: one hop per this."],
    ["HOP_WINDUP_MS", 30, 0, 300, 5, "ms", "The crouch before a hop."],
    ["HOP_MOVE_MS", 80, 20, 500, 5, "ms", "The hop's arc."],
    ["HOP_SETTLE_MS", 55, 0, 300, 5, "ms", "The landing squash."],
    ["HOP_MS", 550, 100, 2e3, 10, "ms", "A hopper's own hop between panels."],
    ["HOP_GROW_MS", 120, 20, 500, 10, "ms", "A hopper regrowing after a hop."],
    ["HOPPER_LIFE", 2200, 500, 1e4, 50, "ms", "How long a hopper stays up (arcade)."],
    ["DARTER_HOP_MS", 340, 100, 2e3, 10, "ms", "A darter moves half again as often as a hopper."],
    ["RARE_LIFE", 650, 100, 5e3, 50, "ms", "How long a rare stays up."],
    ["ALLY_RISE_MS", 460, 100, 2e3, 10, "ms", "A runner surfaces slowly and cannot be hit until up."],
    ["MET_HOP_MS", 1500, 300, 5e3, 50, "ms", "A persistent mett shuffles a panel this often."],
    ["REFIRE_MS", 1400, 300, 5e3, 50, "ms", "A persistent attacker re-aims this long after firing."],
    ["ARENA_ENTRY_DELAY_MS", 650, 0, 3e3, 50, "ms", "The beat between stepping into an arena and its wave waking."],
    ["ARENA_WAVE_GAP_MS", 550, 0, 3e3, 50, "ms", "The beat between a wave dying and the next dealing."],
    ["CAM_TAU_MS", 170, 30, 1e3, 10, "ms", "Camera ease: 63% of the way per this."],
    ["ATTACK_FOLLOW_MS", 300, 0, 2e3, 10, "ms", "An attacker outlives its own aim by this."],
    ["WAVE_GRACE_MS", 900, 0, 5e3, 50, "ms", "A wave gives up once every member has had its chance plus this."],
    ["LOW_TIME_LULL_MS", 420, 0, 3e3, 10, "ms", "A lull never outstays a nearly dead clock by more than this."]
  ]],
  ["world", [
    ["NARROW_ROAD_CHANCE", 0.5, 0, 1, 0.05, "p", "Chance a road is one row instead of three."],
    ["TOWER_EVERY", 10, 1, 50, 1, "arenas", "A tower stands before every N-th arena in the story."],
    ["POOL_BASE", 4, 1, 30, 1, "viruses", "Viruses guarding arena 0."],
    ["POOL_PER_ARENA", 0.16, 0, 2, 0.01, "viruses", "Extra viruses per arena index."],
    ["POOL_MAX", 20, 1, 60, 1, "viruses", "The most viruses one arena guards."],
    ["WAVE_SIZE_BASE", 2, 1, 6, 1, "viruses", "Viruses dealt together in arena 0."],
    ["WAVE_SIZE_PER_ARENAS", 25, 1, 200, 1, "arenas", "One more per wave every this many arenas."],
    ["WAVE_SIZE_MAX", 5, 1, 8, 1, "viruses", "The most dealt together."],
    ["MAX_ALIVE", 6, 1, 12, 1, "viruses", "Hard ceiling on the board: wave plus runner plus rare."],
    ["STASH_SLOTS", 4, 1, 12, 1, "slots", "How much you can carry: a bomb is one slot, a bell is three."],
    ["SHARD_DROP_BASE", 0.18, 0, 1, 0.02, "p", "Chance a taken arena leaves a shard on the road."],
    ["SHARD_DROP_PER", 4e-3, 0, 0.1, 1e-3, "p", "Plus this per arena, so the far road is better stocked."],
    ["SHARD_DROP_MAX", 0.45, 0, 1, 0.05, "p", ""],
    ["SHARD_UNLOCK", 20, 0, 500, 1, "arena", "Shards start turning up on the road from this arena."]
  ]],
  ["story unlocks", [
    ["UNLOCK_GUARD", 10, 0, 500, 1, "arena", "Steel guards from this arena on."],
    ["UNLOCK_ALLY", 20, 0, 500, 1, "arena", "Runners from this arena on."],
    ["UNLOCK_RETALIATE", 30, 0, 500, 1, "arena", "Viruses fire back from this arena on."],
    ["UNLOCK_HOPPER", 40, 0, 500, 1, "arena", "Hoppers from this arena on."],
    ["UNLOCK_SENTINEL1", 50, 0, 500, 1, "arena", "Sentinels (mark I) from this arena on."],
    ["UNLOCK_SWARM", 60, 0, 500, 1, "arena", "Tighter lulls from this arena on."],
    ["UNLOCK_SPREADER", 60, 0, 500, 1, "arena", "Spreaders from this arena on."],
    ["UNLOCK_DARTER", 80, 0, 500, 1, "arena", "Darters from this arena on."],
    ["UNLOCK_SENTINEL2", 70, 0, 500, 1, "arena", "Sentinel mark II from this arena on."],
    ["UNLOCK_WARDEN", 90, 0, 500, 1, "arena", "Wardens from this arena on."],
    ["UNLOCK_SENTINEL3", 90, 0, 500, 1, "arena", "Sentinel mark III from this arena on."],
    ["ROAD_END", 100, 10, 1e3, 1, "arena", "Past this the run is unlimited: nothing new is held back."]
  ]],
  ["arcade unlocks (retired ADVANCE)", [
    ["ADV_GUARD", 5, 0, 500, 1, "arena", ""],
    ["ADV_RETALIATE", 9, 0, 500, 1, "arena", ""],
    ["ADV_HOPPER", 15, 0, 500, 1, "arena", ""],
    ["ADV_SENTINEL1", 20, 0, 500, 1, "arena", ""],
    ["ADV_ALLY", 30, 0, 500, 1, "arena", ""],
    ["ADV_SENTINEL2", 40, 0, 500, 1, "arena", ""],
    ["ADV_SWARM", 55, 0, 500, 1, "arena", ""],
    ["ADV_SENTINEL3", 70, 0, 500, 1, "arena", ""],
    ["ADV_SPREADER", 35, 0, 500, 1, "arena", ""],
    ["ADV_DARTER", 45, 0, 500, 1, "arena", ""],
    ["ADV_WARDEN", 60, 0, 500, 1, "arena", ""]
  ]],
  ["waves", [
    ["WAVE_STAGGER_BASE", 420, 50, 2e3, 10, "ms", "Gap between arrivals inside a wave, at wave 0."],
    ["WAVE_STAGGER_PER_WAVE", 4, 0, 50, 1, "ms", "The gap shrinks by this per wave."],
    ["WAVE_STAGGER_MIN", 170, 20, 1e3, 10, "ms", "The gap never drops below this."],
    ["WAVE_LULL_BASE", 1900, 200, 6e3, 50, "ms", "The pause between waves, at wave 0."],
    ["WAVE_LULL_PER_WAVE", 10, 0, 100, 1, "ms", "The pause shrinks by this per wave."],
    ["WAVE_LULL_MIN", 620, 100, 3e3, 10, "ms", "The pause never drops below this."],
    ["WAVE_LULL_SWARM_FACTOR", 0.7, 0.2, 1, 0.05, "x", "The pause is multiplied by this once SWARM is unlocked."],
    ["WAVE_CLEAR_LULL", 0.62, 0.1, 1, 0.02, "x", "A perfect clear multiplies the next lull by this."],
    ["UP_MS_BASE", 1250, 300, 5e3, 10, "ms", "How long a virus stays up at zero kills (arcade)."],
    ["UP_MS_PER_KILL", 18, 0, 100, 1, "ms", "Stays up this much less per kill."],
    ["UP_MS_MIN", 520, 100, 3e3, 10, "ms", "Never less than this."],
    ["GUARD_CHANCE_BASE", 0.4, 0, 1, 0.05, "p", "Chance the anchor slot is a steel guard, once unlocked."],
    ["GUARD_CHANCE_PER", 0.08, 0, 0.5, 0.01, "p", "Plus this per unlock step."],
    ["GUARD_CHANCE_MAX", 0.8, 0, 1, 0.05, "p", ""],
    ["HOPPER_CHANCE_BASE", 0.35, 0, 1, 0.05, "p", "Chance one slot is a hopper, once unlocked."],
    ["HOPPER_CHANCE_PER", 0.08, 0, 0.5, 0.01, "p", ""],
    ["HOPPER_CHANCE_MAX", 0.65, 0, 1, 0.05, "p", ""],
    ["ALLY_CHANCE_BASE", 0.25, 0, 1, 0.05, "p", "Chance a runner tags along, once unlocked."],
    ["ALLY_CHANCE_PER", 0.05, 0, 0.5, 0.01, "p", ""],
    ["ALLY_CHANCE_MAX", 0.45, 0, 1, 0.05, "p", ""],
    ["RARE_CHANCE_BASE", 0.05, 0, 1, 0.01, "p", "Chance a rare leads a wave (retired modes)."],
    ["RARE_CHANCE_PER", 0.01, 0, 0.2, 5e-3, "p", ""],
    ["RARE_LOW_TIME_FACTOR", 2.5, 1, 10, 0.5, "x", "Rares are this much likelier when the clock is low."],
    ["SENTINEL_CHANCE_BASE", 0.35, 0, 1, 0.05, "p", "Chance a wave carries a sentinel, once unlocked."],
    ["SENTINEL_CHANCE_PER", 6e-3, 0, 0.1, 1e-3, "p", "Plus this per arena past the unlock."],
    ["SENTINEL_CHANCE_MAX", 0.7, 0, 1, 0.05, "p", ""],
    ["SPREADER_CHANCE_BASE", 0.3, 0, 1, 0.05, "p", "Chance one slot is a spreader, once unlocked."],
    ["SPREADER_CHANCE_PER", 6e-3, 0, 0.1, 1e-3, "p", "Plus this per arena past the unlock."],
    ["SPREADER_CHANCE_MAX", 0.55, 0, 1, 0.05, "p", ""],
    ["DARTER_CHANCE_BASE", 0.25, 0, 1, 0.05, "p", "Chance one slot is a darter, once unlocked."],
    ["DARTER_CHANCE_PER", 6e-3, 0, 0.1, 1e-3, "p", "Plus this per arena past the unlock."],
    ["DARTER_CHANCE_MAX", 0.5, 0, 1, 0.05, "p", ""],
    ["WARDEN_CHANCE_BASE", 0.22, 0, 1, 0.05, "p", "Chance one slot is a warden, once unlocked."],
    ["WARDEN_CHANCE_PER", 5e-3, 0, 0.1, 1e-3, "p", "Plus this per arena past the unlock."],
    ["WARDEN_CHANCE_MAX", 0.45, 0, 1, 0.05, "p", ""]
  ]],
  ["counterattack", [
    ["ATTACK_START", 12, 0, 500, 1, "kills", "Kill count before anything shoots (arcade); ramps read from here."],
    ["VOLLEY_GAP_MS", 260, 40, 1500, 10, "ms", "The beat between the two shots of a volley."],
    ["WALL_SPEED_FACTOR", 0.55, 0.1, 1, 0.05, "x", "A wall bolt crosses a panel this much faster than a plain one."],
    ["WALL_RADIUS_FACTOR", 1.7, 1, 4, 0.1, "x", "A wall bolt is this much wider."],
    ["BOLT_HIT_R", 0.28, 0.05, 1, 0.01, "panels", "A bolt lands within this fraction of a panel."],
    ["ATTACK_CHANCE_MET_BASE", 0.24, 0, 1, 0.01, "p", "Per-mett chance to retaliate at the attack start."],
    ["ATTACK_CHANCE_MET_PER", 4e-3, 0, 0.1, 1e-3, "p", "Plus this per kill past the start."],
    ["ATTACK_CHANCE_MET_MAX", 0.55, 0, 1, 0.05, "p", ""],
    ["ATTACK_CHANCE_HOP_BASE", 0.18, 0, 1, 0.01, "p", "Per-hopper chance to retaliate."],
    ["ATTACK_CHANCE_HOP_PER", 3e-3, 0, 0.1, 1e-3, "p", ""],
    ["ATTACK_CHANCE_HOP_MAX", 0.45, 0, 1, 0.05, "p", ""],
    ["BOLT_SLOW_RADIUS", 0.19, 0.05, 0.5, 0.01, "panels", "The mett's shell, as a fraction of panel width."],
    ["BOLT_SLOW_AIM_BASE", 560, 100, 3e3, 10, "ms", "The mett's telegraph at the attack start."],
    ["BOLT_SLOW_AIM_PER_KILL", 0.8, 0, 10, 0.1, "ms", "Shorter by this per kill."],
    ["BOLT_SLOW_AIM_MIN", 340, 50, 3e3, 10, "ms", ""],
    ["BOLT_SLOW_PANEL_BASE", 300, 30, 2e3, 10, "ms", "The mett's shell crosses one panel in this, at the start."],
    ["BOLT_SLOW_PANEL_PER_KILL", 0.45, 0, 10, 0.05, "ms", ""],
    ["BOLT_SLOW_PANEL_MIN", 175, 20, 2e3, 5, "ms", ""],
    ["BOLT_FAST_RADIUS", 0.135, 0.05, 0.5, 5e-3, "panels", "The hopper's bolt."],
    ["BOLT_FAST_AIM_BASE", 780, 100, 3e3, 10, "ms", "The hopper's telegraph at the start: the longest in the game."],
    ["BOLT_FAST_AIM_PER_KILL", 1.1, 0, 10, 0.1, "ms", ""],
    ["BOLT_FAST_AIM_MIN", 480, 50, 3e3, 10, "ms", ""],
    ["BOLT_FAST_PANEL_BASE", 130, 20, 1e3, 5, "ms", "The hopper's bolt crosses a panel in this: a blink."],
    ["BOLT_FAST_PANEL_PER_KILL", 0.2, 0, 10, 0.05, "ms", ""],
    ["BOLT_FAST_PANEL_MIN", 72, 10, 1e3, 2, "ms", ""]
  ]],
  ["sentinels", [
    ["SENTINEL_1_HP", 1, 1, 10, 1, "hits", "Mark I: hits to delete."],
    ["SENTINEL_1_OPEN_MS", 1400, 200, 5e3, 50, "ms", "Mark I: the iris is open (and hittable) this long."],
    ["SENTINEL_1_CLOSED_MS", 1500, 200, 5e3, 50, "ms", "Mark I: closed (armour) this long."],
    ["SENTINEL_2_HP", 2, 1, 10, 1, "hits", ""],
    ["SENTINEL_2_OPEN_MS", 1050, 200, 5e3, 50, "ms", ""],
    ["SENTINEL_2_CLOSED_MS", 1250, 200, 5e3, 50, "ms", ""],
    ["SENTINEL_3_HP", 3, 1, 10, 1, "hits", ""],
    ["SENTINEL_3_OPEN_MS", 780, 200, 5e3, 50, "ms", ""],
    ["SENTINEL_3_CLOSED_MS", 1050, 200, 5e3, 50, "ms", ""],
    ["HOPPER_HP", 2, 1, 8, 1, "hits", "Hits to delete a hopper (a charged shot takes it outright)."],
    ["SPREADER_HP", 2, 1, 8, 1, "hits", "Hits to delete a spreader."],
    ["WARDEN_HP", 2, 1, 8, 1, "hits", "Hits to delete a warden."],
    ["DARTER_HP", 2, 1, 8, 1, "hits", "Hits to delete a darter."],
    ["SENTINEL_CHARGED_DMG", 2, 1, 10, 1, "hits", "A charged shot counts as this many hits on a sentinel."]
  ]],
  ["bomb", [
    ["BOMB_RANGE", 3, 1, 6, 1, "panels", "Thrown this many columns ahead."],
    ["BOMB_ARC_MS", 640, 100, 3e3, 10, "ms", "In the air for this long."],
    ["BOMB_RADIUS", 1, 0, 2, 1, "panels", "Splash reaches this many tiles either side."],
    ["BOMB_PICKUP_CHANCE", 0.6, 0, 1, 0.05, "p", "Chance a road carries a bomb (the first always does)."],
    ["BOMB_BLAST_MS", 460, 100, 2e3, 10, "ms", "The blast's lifetime on screen."]
  ]]
];
var TUNING_ENTRIES = TUNING_SCHEMA.flatMap(([group, rows]) => rows.map(([key, def, min, max, step2, unit, desc]) => ({ key, default: def, min, max, step: step2, unit, desc, group })));
var BY_KEY = new Map(TUNING_ENTRIES.map((e) => [e.key, e]));
var TUNING_KEYS = TUNING_ENTRIES.map((e) => e.key);
function defaultValues() {
  const v = {};
  for (const e of TUNING_ENTRIES) v[e.key] = e.default;
  return v;
}
function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function resolveTuning(overrides) {
  const v = defaultValues();
  const applied = {};
  if (overrides && typeof overrides === "object") {
    for (const [k, raw] of Object.entries(overrides)) {
      const e = BY_KEY.get(k);
      if (!e) continue;
      const num = Number(raw);
      if (!Number.isFinite(num)) continue;
      const clamped = Math.min(e.max, Math.max(e.min, num));
      if (clamped === e.default) continue;
      v[k] = clamped;
      applied[k] = clamped;
    }
  }
  const keys = Object.keys(applied).sort();
  const version = keys.length ? fnv1a(JSON.stringify(keys.map((k) => [k, applied[k]]))) : "default";
  return Object.freeze(assemble(v, applied, version));
}
var DEFAULT = null;
function defaultTuning() {
  if (!DEFAULT) DEFAULT = resolveTuning(null);
  return DEFAULT;
}
function assemble(v, applied, version) {
  const t = { ...v, values: v, overrides: applied, version };
  t.PTS = {
    normal: v.PTS_NORMAL,
    charged: v.PTS_CHARGED,
    guard: v.PTS_GUARD,
    hopper: v.PTS_HOPPER,
    sentinel: v.PTS_SENTINEL,
    rare: v.PTS_RARE,
    spreader: v.PTS_SPREADER,
    warden: v.PTS_WARDEN,
    darter: v.PTS_DARTER
  };
  t.BONUS = {
    normal: v.BONUS_NORMAL,
    charged: v.BONUS_CHARGED,
    guard: v.BONUS_GUARD,
    hopper: v.BONUS_HOPPER,
    sentinel: v.BONUS_SENTINEL,
    rare: v.BONUS_RARE,
    spreader: v.BONUS_SPREADER,
    warden: v.BONUS_WARDEN,
    darter: v.BONUS_DARTER
  };
  t.SENTINEL = {
    1: { hp: v.SENTINEL_1_HP, openMs: v.SENTINEL_1_OPEN_MS, closedMs: v.SENTINEL_1_CLOSED_MS },
    2: { hp: v.SENTINEL_2_HP, openMs: v.SENTINEL_2_OPEN_MS, closedMs: v.SENTINEL_2_CLOSED_MS },
    3: { hp: v.SENTINEL_3_HP, openMs: v.SENTINEL_3_OPEN_MS, closedMs: v.SENTINEL_3_CLOSED_MS }
  };
  t.STORY_UNLOCK = {
    guard: v.UNLOCK_GUARD,
    ally: v.UNLOCK_ALLY,
    retaliate: v.UNLOCK_RETALIATE,
    hopper: v.UNLOCK_HOPPER,
    sentinel1: v.UNLOCK_SENTINEL1,
    swarm: v.UNLOCK_SWARM,
    sentinel2: v.UNLOCK_SENTINEL2,
    sentinel3: v.UNLOCK_SENTINEL3,
    unlimited: v.ROAD_END,
    spreader: v.UNLOCK_SPREADER,
    darter: v.UNLOCK_DARTER,
    warden: v.UNLOCK_WARDEN
  };
  t.ADV_UNLOCK = {
    guard: v.ADV_GUARD,
    retaliate: v.ADV_RETALIATE,
    hopper: v.ADV_HOPPER,
    sentinel1: v.ADV_SENTINEL1,
    ally: v.ADV_ALLY,
    sentinel2: v.ADV_SENTINEL2,
    swarm: v.ADV_SWARM,
    sentinel3: v.ADV_SENTINEL3,
    unlimited: v.ROAD_END,
    spreader: v.ADV_SPREADER,
    darter: v.ADV_DARTER,
    warden: v.ADV_WARDEN
  };
  t.unlockTable = (mode) => mode.story ? t.STORY_UNLOCK : t.ADV_UNLOCK;
  t.HOP_TOTAL_MS = v.HOP_WINDUP_MS + v.HOP_MOVE_MS + v.HOP_SETTLE_MS;
  t.HOP_COMMIT_MS = v.HOP_WINDUP_MS + v.HOP_MOVE_MS / 2;
  const past = (del) => Math.max(0, del - v.ATTACK_START);
  t.BOLT = {
    slow: {
      radiusFrac: v.BOLT_SLOW_RADIUS,
      aimMs: (del) => Math.max(v.BOLT_SLOW_AIM_MIN, v.BOLT_SLOW_AIM_BASE - past(del) * v.BOLT_SLOW_AIM_PER_KILL),
      panelMs: (del) => Math.max(v.BOLT_SLOW_PANEL_MIN, v.BOLT_SLOW_PANEL_BASE - past(del) * v.BOLT_SLOW_PANEL_PER_KILL)
    },
    fast: {
      radiusFrac: v.BOLT_FAST_RADIUS,
      aimMs: (del) => Math.max(v.BOLT_FAST_AIM_MIN, v.BOLT_FAST_AIM_BASE - past(del) * v.BOLT_FAST_AIM_PER_KILL),
      panelMs: (del) => Math.max(v.BOLT_FAST_PANEL_MIN, v.BOLT_FAST_PANEL_BASE - past(del) * v.BOLT_FAST_PANEL_PER_KILL)
    }
  };
  t.aimMs = (del, kind = "slow") => t.BOLT[kind].aimMs(del);
  t.boltPanelMs = (del, kind = "slow") => t.BOLT[kind].panelMs(del);
  t.dodgeWindowMs = (del, kind, panels = 3) => t.BOLT[kind].aimMs(del) + Math.max(0, panels - v.BOLT_HIT_R) * t.BOLT[kind].panelMs(del);
  t.attackChance = (del, type = "mett") => {
    if (del < v.ATTACK_START) return 0;
    const k = past(del);
    return type === "hopper" ? Math.min(v.ATTACK_CHANCE_HOP_MAX, v.ATTACK_CHANCE_HOP_BASE + k * v.ATTACK_CHANCE_HOP_PER) : Math.min(v.ATTACK_CHANCE_MET_MAX, v.ATTACK_CHANCE_MET_BASE + k * v.ATTACK_CHANCE_MET_PER);
  };
  const perArena = (base, per, max) => (k) => Math.min(max, base + Math.max(0, k) * per);
  t.spreaderWaveChance = perArena(v.SPREADER_CHANCE_BASE, v.SPREADER_CHANCE_PER, v.SPREADER_CHANCE_MAX);
  t.darterWaveChance = perArena(v.DARTER_CHANCE_BASE, v.DARTER_CHANCE_PER, v.DARTER_CHANCE_MAX);
  t.wardenWaveChance = perArena(v.WARDEN_CHANCE_BASE, v.WARDEN_CHANCE_PER, v.WARDEN_CHANCE_MAX);
  t.shardDropChance = (idx) => Math.min(v.SHARD_DROP_MAX, v.SHARD_DROP_BASE + Math.max(0, idx - v.SHARD_UNLOCK) * v.SHARD_DROP_PER);
  t.drainRate = (idx) => Math.min(v.DRAIN_MAX, v.DRAIN_BASE + Math.max(0, idx) * v.DRAIN_PER_ARENA);
  t.upMs = (del) => Math.max(v.UP_MS_MIN, v.UP_MS_BASE - del * v.UP_MS_PER_KILL);
  t.level = (del) => 1 + Math.floor(del / v.LEVEL_PER_KILLS);
  t.bonusFactor = (del) => del < v.OC_START ? 1 : Math.pow(v.OC_SLOPE, del - v.OC_START);
  t.pulseScale = (del, advancing) => advancing ? v.ROAD_PULSE : t.bonusFactor(del);
  t.arenaPlan = (idx) => ({
    pool: Math.min(v.POOL_MAX, v.POOL_BASE + Math.floor(idx * v.POOL_PER_ARENA)),
    waveSize: Math.min(v.WAVE_SIZE_MAX, v.WAVE_SIZE_BASE + Math.floor(idx / v.WAVE_SIZE_PER_ARENAS))
  });
  t.waveStaggerMs = (w) => Math.max(v.WAVE_STAGGER_MIN, v.WAVE_STAGGER_BASE - w * v.WAVE_STAGGER_PER_WAVE);
  t.waveLullMs = (w, tight = false) => Math.max(v.WAVE_LULL_MIN, (v.WAVE_LULL_BASE - w * v.WAVE_LULL_PER_WAVE) * (tight ? v.WAVE_LULL_SWARM_FACTOR : 1));
  t.waveClearBonus = (n) => v.WAVE_CLEAR_BONUS_BASE + v.WAVE_CLEAR_BONUS_PER * n;
  t.guardWaveChance = (k) => Math.min(v.GUARD_CHANCE_MAX, v.GUARD_CHANCE_BASE + k * v.GUARD_CHANCE_PER);
  t.hopperWaveChance = (k) => Math.min(v.HOPPER_CHANCE_MAX, v.HOPPER_CHANCE_BASE + k * v.HOPPER_CHANCE_PER);
  t.allyWaveChance = (k) => Math.min(v.ALLY_CHANCE_MAX, v.ALLY_CHANCE_BASE + k * v.ALLY_CHANCE_PER);
  t.rareWaveChance = (k, timeLeft) => (v.RARE_CHANCE_BASE + k * v.RARE_CHANCE_PER) * (timeLeft < v.LOW_TIME * 2 ? v.RARE_LOW_TIME_FACTOR : 1);
  t.sentinelWaveChance = (k) => Math.min(v.SENTINEL_CHANCE_MAX, v.SENTINEL_CHANCE_BASE + k * v.SENTINEL_CHANCE_PER);
  return t;
}

// src/core/world.js
var TILE = {
  PLAYER: "player",
  ENEMY: "enemy",
  ROAD: "road",
  NPC: "npc",
  // a keeper or item on a tower: not standable, talked to from beside
  VOID: "void"
};
function createWorld(opts = {}) {
  const t = opts.tuning || defaultTuning();
  if (!opts.story) return { segs: [arena(0, 0, true, t)] };
  return { segs: [tower(0, STORY_ROUTE[0], true), arena(TOWER_COLS, 0, false, t)] };
}
function tower(x0, roost, entered = false) {
  const spec = towerSpec(roost);
  return {
    kind: "tower",
    x0,
    cols: TOWER_COLS,
    roost,
    npcs: spec.npcs.map((n) => ({ ...n, col: x0 + n.col })),
    entered
  };
}
function arena(x0, idx, entered = idx === 0, t = defaultTuning()) {
  const plan = t.arenaPlan(idx);
  return {
    kind: "arena",
    x0,
    cols: COLS,
    idx,
    owner: "enemy",
    entered,
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
function safeZone(world) {
  const a = activeArena(world);
  return !(a.entered && a.owner === "enemy");
}
function worldEnd(world) {
  const s = world.segs[world.segs.length - 1];
  return s.x0 + s.cols;
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
  if (s.kind === "tower") {
    return s.npcs.some((n) => n.col === wx && n.row === row) ? TILE.NPC : TILE.PLAYER;
  }
  if (s.owner === "player") return TILE.PLAYER;
  return wx - s.x0 < PCOLS ? TILE.PLAYER : TILE.ENEMY;
}
function walkable(world, wx, row) {
  const t = tileAt(world, wx, row);
  return t === TILE.PLAYER || t === TILE.ROAD;
}
function npcAt(world, wx, row) {
  const s = segmentAt(world, wx);
  if (!s || s.kind !== "tower") return null;
  return s.npcs.find((n) => n.col === wx && n.row === row) || null;
}
function npcBeside(world, wx, row) {
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const n = npcAt(world, wx + dc, row + dr);
    if (n) return n;
  }
  return null;
}
function clearArena(world, rng, opts = {}) {
  const tun = opts.tuning || defaultTuning();
  const a = activeArena(world);
  a.owner = "player";
  const narrow = rng() < tun.NARROW_ROAD_CHANCE;
  const road = {
    kind: "road",
    x0: a.x0 + a.cols,
    cols: ROAD_COLS,
    rows: narrow ? 1 : ROWS
  };
  world.segs.push(road);
  let x = road.x0 + road.cols;
  let t = null;
  if (opts.tower) {
    t = tower(x, opts.tower);
    world.segs.push(t);
    x += t.cols;
  }
  const next = arena(x, a.idx + 1, false, tun);
  world.segs.push(next);
  return { cleared: a, road, tower: t, next };
}

// src/core/tasks.js
var TASKS = [
  { id: "sweep", text: "Take an arena without being hit.", counter: "cleanArenas", need: 1, reward: { pulse: 3 } },
  { id: "spare", text: "Let three runners past.", counter: "spared", need: 3, reward: { pulse: 4 } },
  { id: "steel", text: "Break four steel guards.", counter: "guards", need: 4, reward: { points: 2e3 } },
  { id: "chain", text: "Delete eight in a row without missing.", counter: "chain8", need: 1, reward: { pulse: 4 } },
  { id: "clean", text: "Clear three waves with nothing left standing.", counter: "perfectWaves", need: 3, reward: { bombs: 1 } },
  { id: "charge", text: "Take six with a charged shot.", counter: "charged", need: 6, reward: { pulse: 5 } },
  { id: "shutter", text: "Break two sentinels while they are open.", counter: "sentinels", need: 2, reward: { points: 3e3 } },
  { id: "far", text: "Take five arenas.", counter: "arenas", need: 5, reward: { pulse: 6 } }
];
var TASK_BY_ID = Object.fromEntries(TASKS.map((t) => [t.id, t]));
function newTaskState() {
  return {
    lastNpc: null,
    // one task exchange per person, however long you talk
    counts: {
      cleanArenas: 0,
      spared: 0,
      guards: 0,
      sentinels: 0,
      chain8: 0,
      perfectWaves: 0,
      charged: 0,
      arenas: 0
    },
    active: null,
    // { id, base } -- base is the counter when taken
    done: [],
    // ids, in the order they were paid
    hitThisArena: false
    // reset when an arena is entered; a clean take needs it false
  };
}
function progress(tasks) {
  if (!tasks.active) return null;
  const task = TASK_BY_ID[tasks.active.id];
  if (!task) return null;
  const have = Math.max(0, (tasks.counts[task.counter] || 0) - tasks.active.base);
  return { task, have: Math.min(have, task.need), need: task.need, met: have >= task.need };
}
function nextTask(tasks) {
  if (tasks.active) return null;
  for (const t of TASKS) if (!tasks.done.includes(t.id)) return t;
  return null;
}
function takeTask(tasks, id) {
  const task = TASK_BY_ID[id];
  if (!task || tasks.active || tasks.done.includes(id)) return false;
  tasks.active = { id, base: tasks.counts[task.counter] || 0 };
  return true;
}
function claimTask(tasks) {
  const p = progress(tasks);
  if (!p || !p.met) return null;
  tasks.done.push(p.task.id);
  tasks.active = null;
  return { id: p.task.id, ...p.task.reward };
}
function taskExchange(state, npcId, events) {
  const t = state.tasks;
  if (!t || t.lastNpc === npcId) return;
  t.lastNpc = npcId;
  const p = progress(t);
  if (p && p.met) {
    const paid = claimTask(t);
    const parts = [];
    if (paid.pulse) {
      state.timeLeft = Math.min(state.tuning.TIME_CAP, state.timeLeft + paid.pulse);
      parts.push("+" + paid.pulse.toFixed(1) + "s");
    }
    if (paid.points) {
      state.score += paid.points;
      parts.push("+" + paid.points);
    }
    if (paid.bombs) {
      state.bombs += paid.bombs;
      parts.push("+" + paid.bombs + " bomb");
    }
    events.push({ type: "taskDone", npc: npcId, id: paid.id, text: "Done. " + parts.join(", ") + ".", reward: paid });
    events.push({ type: "statsChanged" });
    return;
  }
  if (p) {
    events.push({
      type: "taskProgress",
      npc: npcId,
      id: p.task.id,
      text: p.task.text + " (" + p.have + " of " + p.need + ")",
      have: p.have,
      need: p.need
    });
    return;
  }
  const next = nextTask(t);
  if (!next) {
    events.push({ type: "taskNone", npc: npcId });
    return;
  }
  takeTask(t, next.id);
  events.push({ type: "taskGiven", npc: npcId, id: next.id, text: next.text });
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
  const tuning = opts.tuning && opts.tuning.values ? opts.tuning : resolveTuning(opts.tuning);
  return {
    rng: opts.rng || mulberry32(seed),
    seed,
    tuning,
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
    // bombs in the stash: kept equal by syncStash()
    stash: [],
    // what you are carrying, oldest first; the top is used
    parry: false,
    // the spell shard: the next bolt that would land does not
    cloakUntil: -1e9,
    // the sock shard: nothing aims at you until then
    lastShotTier: null,
    // what the footnote shard would echo
    echo: null,
    // { tier, share } while an echoed shot is resolving
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
    // the bonus-task ledger: counters, what is taken, what has been paid
    tasks: newTaskState(),
    shots: 0,
    whiffs: 0,
    chain: 0,
    bestChain: 0,
    timeLeft: tuning.START_TIME,
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
    queuedMove: null,
    // one-hand: the step held for the end of the cooldown, { kind:"to",col,row } | { kind:"by",dc,dr }
    holdDir: null,
    // the direction a stick/ring is holding this frame, { dc, dr }
    holdT0: -1e9,
    // when that push began: a push gets one held step, never two
    talks: {},
    // story: TALK presses per npc id; the shell picks the line
    routeIdx: 1,
    // story: the next tower on STORY_ROUTE
    hop: null,
    // touch modes: the step in flight, { fromCol, fromRow, toCol, toRow, t0, committed }
    path: null,
    // touch modes: the square a far tap is walking to, { col, row }
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
function setLayout(state, width, height, bottomInset = 0) {
  const old = state.G;
  const G = layout(width, height, bottomInset);
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

// src/core/fx.js
var panel = (state, col, row) => panelRect(state.G, col, row);
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

// src/core/items.js
var ITEMS = {
  bomb: { id: "bomb", name: "BOMB", slots: 1, effect: "blast", canon: "item.bomb" },
  // the five shards, with the bible's own costs
  spell: { id: "spell", name: "SPELL", slots: 1, effect: "parry", canon: "shard.spell" },
  footnote: { id: "footnote", name: "FOOTNOTE", slots: 1, effect: "echo", arg: 0.5, canon: "shard.footnote" },
  sock: { id: "sock", name: "SOCK", slots: 2, effect: "cloak", arg: 1400, canon: "shard.sock" },
  weather: { id: "weather", name: "WEATHER", slots: 2, effect: "summon", arg: "darter", canon: "shard.weather" },
  bell: { id: "bell", name: "BELL", slots: 3, effect: "provoke", canon: "shard.bell" }
};
var SHARDS = ["spell", "footnote", "sock", "weather", "bell"];
var itemDef = (id) => ITEMS[id] || null;
function slotsUsed(stash) {
  let n = 0;
  for (const id of stash) n += ITEMS[id] ? ITEMS[id].slots : 1;
  return n;
}
function fits(stash, id, cap) {
  const def = ITEMS[id];
  if (!def) return false;
  return slotsUsed(stash) + def.slots <= cap;
}
function stow(stash, id, cap) {
  if (!fits(stash, id, cap)) return false;
  stash.push(id);
  return true;
}
var topOf = (stash) => stash.length ? stash[stash.length - 1] : null;
var takeTop = (stash) => stash.length ? stash.pop() : null;
function stashView(stash) {
  const out = [];
  for (let i = stash.length - 1; i >= 0; i--) {
    const def = ITEMS[stash[i]];
    if (def) out.push({ id: def.id, name: def.name, slots: def.slots });
  }
  return out;
}
function syncStash(state) {
  let n = 0;
  for (const id of state.stash) if (id === "bomb") n++;
  state.bombs = n;
}

// src/core/movement.js
var moveMs = (state) => modeById(state.modeId).hop ? state.tuning.TAP_MOVE_MS : state.tuning.MOVE_REPEAT_MS;
var moveReady = (state) => state.clock - state.lastMoveAt >= moveMs(state);
var hops = (state) => !!modeById(state.modeId).hop;
function queueMove(state, q) {
  if (!hops(state)) return;
  state.queuedMove = q;
}
function flushQueuedMove(state, events) {
  const q = state.queuedMove;
  if (!q) return;
  if (state.mode !== "playing" || state.paused) {
    state.queuedMove = null;
    return;
  }
  if (!moveReady(state)) return;
  state.queuedMove = null;
  if (q.kind === "to") moveTo(state, q.col, q.row, events);
  else move(state, q.dc, q.dr, events);
}
function move(state, dc, dr, events, fromHold = false) {
  if (state.mode !== "playing" || state.paused) return;
  if (!(dc || dr)) return;
  state.path = null;
  if (!moveReady(state)) {
    if (!fromHold || state.lastMoveAt < state.holdT0) queueMove(state, { kind: "by", dc, dr });
    return;
  }
  if (hops(state) && dc && dr) {
    if (Math.abs(dc) >= Math.abs(dr)) dr = 0;
    else dc = 0;
  }
  const [col, row] = stepFrom(state, state.player.col, state.player.row, dc, dr);
  go(state, col, row, events);
}
function stepFrom(state, col, row, dc, dr) {
  const world = state.world;
  const wall = Math.floor(state.cam || 0);
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
  return [col, row];
}
function go(state, col, row, events) {
  state.lastMoveAt = state.clock;
  if (!hops(state)) {
    land(state, col, row, events);
    return;
  }
  const prev = state.hop;
  if (prev && !prev.committed) {
    prev.committed = true;
    land(state, prev.toCol, prev.toRow, events);
  }
  if (col === state.player.col && row === state.player.row) {
    state.hop = null;
    return;
  }
  state.hop = {
    fromCol: state.player.col,
    fromRow: state.player.row,
    toCol: col,
    toRow: row,
    t0: state.clock,
    committed: false
  };
  events.push({ type: "hop", fromCol: state.player.col, fromRow: state.player.row, col, row });
}
function updateHop(state, events) {
  const h = state.hop;
  if (!h) return;
  const t = state.clock - h.t0;
  if (!h.committed && t >= state.tuning.HOP_COMMIT_MS) {
    h.committed = true;
    land(state, h.toCol, h.toRow, events);
  }
  if (t >= state.tuning.HOP_TOTAL_MS) state.hop = null;
}
function moveTo(state, col, row, events) {
  if (state.mode !== "playing" || state.paused) return;
  if (col === state.player.col && row === state.player.row) {
    state.path = null;
    return;
  }
  if (!reachable(state, col, row)) return;
  ripple(state, col, row, "#4f8dff", state.clock, 1);
  state.path = { col, row };
  runPath(state, events);
}
function runPath(state, events) {
  const p = state.path;
  if (!p) return;
  if (state.mode !== "playing" || state.paused) {
    state.path = null;
    return;
  }
  if (p.col === state.player.col && p.row === state.player.row) {
    state.path = null;
    return;
  }
  if (!moveReady(state)) return;
  const next = nextStep(state, p.col, p.row);
  if (!next) {
    state.path = null;
    return;
  }
  go(state, next[0], next[1], events);
}
function nextStep(state, col, row) {
  const world = state.world;
  const wall = Math.floor(state.cam || 0);
  if (row < 0 || row >= ROWS || col < wall) return null;
  if (!walkable(world, col, row)) return null;
  const end = worldEnd(world);
  const key = (c, r) => c * ROWS + r;
  const from = key(state.player.col, state.player.row);
  const parent = /* @__PURE__ */ new Map([[from, null]]);
  const open = [[state.player.col, state.player.row]];
  let head = 0;
  while (head < open.length) {
    const [c, r] = open[head++];
    if (c === col && r === row) {
      let k = key(c, r);
      while (parent.get(k) !== from) k = parent.get(k);
      return [Math.floor(k / ROWS), k % ROWS];
    }
    for (const [nc, nr] of [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]) {
      if (nc < wall || nc >= end || nr < 0 || nr >= ROWS) continue;
      const nk = key(nc, nr);
      if (parent.has(nk) || !walkable(world, nc, nr)) continue;
      parent.set(nk, key(c, r));
      open.push([nc, nr]);
    }
  }
  return null;
}
function reachable(state, col, row) {
  if (col === state.player.col && row === state.player.row) return true;
  return nextStep(state, col, row) !== null;
}
function tapAt(state, x, y, events) {
  const G = state.G;
  if (!G.pw || !G.ph) return;
  const wx = (x + (state.cam || 0) * G.pw - G.gx) / G.pw;
  const wy = (y - G.gy) / G.ph;
  let row = Math.floor(wy);
  if (row === -1 && wy >= -TAP_SLACK) row = 0;
  if (row === ROWS && wy < ROWS + TAP_SLACK) row = ROWS - 1;
  const col = Math.floor(wx);
  if (!moveReady(state) && hops(state)) {
    if (reachable(state, col, row)) queueMove(state, { kind: "to", col, row });
    return;
  }
  moveTo(state, col, row, events);
}
function land(state, col, row, events) {
  const moved = col !== state.player.col || row !== state.player.row;
  if (moved) {
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pk = state.pickups[i];
      if (pk.col !== col || pk.row !== row) continue;
      const pp0 = panel(state, col, row);
      if (!stow(state.stash, pk.kind, state.tuning.STASH_SLOTS)) {
        state.fx.popups.push({ x: pp0.x + pp0.w / 2, y: pp0.y - 8, t0: state.clock, text: "STASH FULL", color: "#8a96b8" });
        events.push({ type: "stashFull", kind: pk.kind, col, row });
        continue;
      }
      state.pickups.splice(i, 1);
      syncStash(state);
      const pp = pp0;
      const took = itemDef(pk.kind);
      state.fx.popups.push({ x: pp.x + pp.w / 2, y: pp.y - 8, t0: state.clock, text: "+" + (took ? took.name : "?"), color: "#ff9f45" });
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

// src/core/tasks-count.js
var CHAIN_RUN = 8;
function bumpTask(state, what, info = {}) {
  const t = state.tasks;
  if (!t) return;
  const c = t.counts;
  switch (what) {
    case "kill": {
      const def = enemyDef(info.type);
      if (def.armor === "steel") c.guards++;
      if (def.armor === "shutter") c.sentinels++;
      if (info.tier === "charged") c.charged++;
      if (info.chain > 0 && info.chain % CHAIN_RUN === 0) c.chain8++;
      break;
    }
    case "spared":
      c.spared++;
      break;
    case "hurt":
      t.hitThisArena = true;
      break;
    case "waveCleared":
      c.perfectWaves++;
      break;
    case "arenaEntered":
      t.hitThisArena = false;
      break;
    case "arenaTaken":
      c.arenas++;
      if (!t.hitThisArena) c.cleanArenas++;
      break;
    default:
      break;
  }
}

// src/core/select.js
function hopPose(state, now) {
  const h = state.hop;
  const still = { col: state.player.col, row: state.player.row, lift: 0, sx: 1, sy: 1, phase: "still" };
  if (!h) return still;
  const t = now - h.t0;
  if (t < 0 || t >= state.tuning.HOP_TOTAL_MS) return still;
  if (t < state.tuning.HOP_WINDUP_MS) {
    const k = t / state.tuning.HOP_WINDUP_MS;
    return { col: h.fromCol, row: h.fromRow, lift: 0, sx: 1 + 0.12 * k, sy: 1 - 0.14 * k, phase: "windup" };
  }
  const m = t - state.tuning.HOP_WINDUP_MS;
  if (m < state.tuning.HOP_MOVE_MS) {
    const k = m / state.tuning.HOP_MOVE_MS;
    const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
    return {
      col: h.fromCol + (h.toCol - h.fromCol) * e,
      row: h.fromRow + (h.toRow - h.fromRow) * e,
      lift: Math.sin(Math.PI * k),
      sx: 1 - 0.08 * Math.sin(Math.PI * k),
      sy: 1 + 0.12 * Math.sin(Math.PI * k),
      phase: "move"
    };
  }
  const st = (m - state.tuning.HOP_MOVE_MS) / state.tuning.HOP_SETTLE_MS;
  const d = Math.sin(Math.PI * st) * (1 - st);
  return { col: h.toCol, row: h.toRow, lift: 0, sx: 1 + 0.16 * d, sy: 1 - 0.2 * d, phase: "settle" };
}
function contextVerb(state) {
  const n = npcBeside(state.world, state.player.col, state.player.row);
  return n ? { verb: n.verb || "talk", npc: n.id } : { verb: "bomb", npc: null };
}
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
  const advancing = !!modeById(state.modeId).advancing;
  const oc = !advancing && state.deletions >= state.tuning.OC_START;
  return {
    score: String(state.score).padStart(6, "0"),
    chain: state.chain,
    mult: multOf(state.chain),
    // advance counts arenas: the level is where you are on the road
    level: modeById(state.modeId).advancing ? activeArena(state.world).idx + 1 : state.tuning.level(state.deletions),
    unlimited: !!state.unlimited,
    bombs: state.bombs || 0,
    timeLeft: state.timeLeft,
    timeFrac: Math.max(0, Math.min(1, state.timeLeft / state.tuning.TIME_CAP)),
    // the clock is paused: nothing here is held against you
    safe: safeZone(state.world),
    overclock: oc,
    overclockFactor: state.tuning.pulseScale(state.deletions, advancing),
    // what a second in this arena costs: 1 at the start of the road, more later
    drain: advancing ? state.tuning.drainRate(activeArena(state.world).idx) : 1,
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
    sub: !modeById(state.modeId).advancing && state.deletions >= state.tuning.OC_START ? "overclock reached \xD7" + state.tuning.bonusFactor(state.deletions).toFixed(2) : "",
    rows: [
      ["score", state.score + " pts", "big"],
      ["deletions", state.deletions],
      ["accuracy", accuracyText(state)],
      ["best chain", state.bestChain],
      ["best score", state.best]
    ]
  };
}

// src/core/flow.js
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
  state.world = createWorld({ story: !!cfg.story, tuning: state.tuning });
  state.talks = {};
  state.routeIdx = 1;
  state.hop = null;
  state.path = null;
  state.arenasCleared = 0;
  state.bombs = 0;
  state.stash.length = 0;
  state.parry = false;
  state.cloakUntil = -1e9;
  state.lastShotTier = null;
  state.echo = null;
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
  state.timeLeft = state.tuning.START_TIME;
  state.player.col = 1;
  state.player.row = 1;
  state.queuedMove = null;
  state.lastMoveAt = -1e9;
  state.holdDir = null;
  state.holdT0 = -1e9;
  state.enemies.length = 0;
  state.nextSpawnAt = activeArena(state.world).entered ? state.clock + 500 : Infinity;
  state.waveIdx = 0;
  state.waveState = "lull";
  state.wave = null;
  state.stageIdx = 0;
  clearFx(state);
  state.bolts.length = 0;
  state.hurtUntil = -1e9;
  state.rank = null;
  events.push({ type: "runStarted", modeId: cfg.id, story: !!cfg.story });
  const first = state.world.segs[0];
  if (first.kind === "tower") events.push({ type: "towerEntered", roost: first.roost, x0: first.x0 });
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
  state.timeLeft = Math.min(state.tuning.TIME_CAP, state.timeLeft + state.tuning.STAGE_BONUS);
  events.push({
    type: "stageGate",
    stage,
    index,
    title: stage.title,
    timeBonus: state.tuning.STAGE_BONUS
  });
  events.push({ type: "statsChanged" });
}
function updateWorld(state, events) {
  const now = state.clock;
  const a = activeArena(state.world);
  for (const seg of state.world.segs) {
    if (seg.kind === "tower" && !seg.entered && state.player.col >= seg.x0) {
      seg.entered = true;
      events.push({ type: "towerEntered", roost: seg.roost, x0: seg.x0 });
    }
  }
  if (!a.entered && state.player.col >= a.x0) {
    a.entered = true;
    state.camAnchor = a.x0;
    state.nextSpawnAt = now + state.tuning.ARENA_ENTRY_DELAY_MS;
    state.levelT0 = now;
    bumpTask(state, "arenaEntered");
    events.push({ type: "arenaEntered", index: a.idx, x0: a.x0 });
    if (a.idx >= state.tuning.ROAD_END) state.unlimited = true;
    const st = modeById(state.modeId).story ? null : ADVANCE_STAGES.find((x) => x.arena === a.idx);
    if (st) showCard(state, events, st, ADVANCE_STAGES.indexOf(st));
  }
  const fighting = a.entered && a.owner === "enemy";
  const here = segmentAt(state.world, state.player.col);
  const onTower = here && here.kind === "tower";
  const want = fighting ? a.x0 : Math.min(a.x0, onTower ? here.x0 : state.player.col - 1);
  state.camAnchor = Math.max(state.camAnchor, want);
  const target = state.camAnchor;
  const dt = Math.max(0, now - state.camClock);
  state.camClock = now;
  const d = target - state.cam;
  if (Math.abs(d) < 2e-3) state.cam = target;
  else state.cam += d * (1 - Math.exp(-dt / state.tuning.CAM_TAU_MS));
}
function showCard(state, events, stage, index) {
  state.mode = "interlevel";
  state.charge.downAt = null;
  state.charge.full = false;
  state.bolts.length = 0;
  state.timeLeft = Math.min(state.tuning.TIME_CAP, state.timeLeft + state.tuning.STAGE_BONUS);
  events.push({ type: "stageGate", stage, index, title: stage.title, timeBonus: state.tuning.STAGE_BONUS });
  events.push({ type: "statsChanged" });
}
function resumeFromInterlevel(state, events) {
  if (state.mode !== "interlevel") return;
  state.mode = "playing";
  state.nextSpawnAt = state.clock + 700;
  if (state.wave) for (const slot of state.wave.queue) slot.at += 700;
  events.push({ type: "resumed" });
}

// src/core/waves.js
var advancingMode = (state) => !!modeById(state.modeId).advancing;
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
function unlocked(state, key) {
  const mode = modeById(state.modeId);
  if (mode.advancing) {
    const at = state.tuning.unlockTable(mode)[key];
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
  const stagger = state.tuning.waveStaggerMs(idx);
  const arena2 = activeArena(state.world);
  const ax0 = arena2.x0;
  const advancing = modeById(state.modeId).advancing;
  if (advancing) {
    size = Math.min(arena2.waveSize, arena2.pool - arena2.dealt, state.tuning.MAX_ALIVE);
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
      persistent: advancing,
      tier: 0
    });
  }
  if (unlocked(state, "guard") && form.anchor < slots.length && state.rng() < state.tuning.guardWaveChance(chanceStage - UNLOCK.guard)) {
    slots[form.anchor].type = "guard";
  }
  if (unlocked(state, "hopper")) {
    const wanted = size >= 4 && state.rng() < 0.35 ? 2 : 1;
    for (let k = 0; k < wanted; k++) {
      if (state.rng() >= state.tuning.hopperWaveChance(chanceStage - UNLOCK.hopper)) continue;
      const plain = slots.filter((s) => s.type === "mett");
      if (!plain.length) break;
      plain[Math.floor(state.rng() * plain.length)].type = "hopper";
    }
  }
  const mark = advancing ? sentinelMark(state) : 0;
  if (mark && state.rng() < state.tuning.sentinelWaveChance(arena2.idx - state.tuning.ADV_UNLOCK.sentinel1)) {
    const plain = slots.filter((s) => s.type === "mett");
    if (plain.length) {
      const pick = plain[Math.floor(state.rng() * plain.length)];
      pick.type = "sentinel";
      pick.tier = mark > 1 && state.rng() < 0.35 ? mark - 1 : mark;
    }
  }
  for (const [key, chance] of [
    ["spreader", "spreaderWaveChance"],
    ["darter", "darterWaveChance"],
    ["warden", "wardenWaveChance"]
  ]) {
    if (!unlocked(state, key)) continue;
    const at = state.tuning.unlockTable(modeById(state.modeId))[key];
    if (state.rng() >= state.tuning[chance](arena2.idx - at)) continue;
    const plain = slots.filter((sl) => sl.type === "mett");
    if (!plain.length) continue;
    plain[Math.floor(state.rng() * plain.length)].type = key;
  }
  if (unlocked(state, "ally") && state.rng() < state.tuning.allyWaveChance(chanceStage - UNLOCK.ally)) {
    const spot = freeSlot(state, slots);
    if (spot) slots.push({ ...spot, type: "ally", at: now + slots.length * stagger });
  }
  if (!advancing && unlocked(state, "rare") && state.rng() < state.tuning.rareWaveChance(stage - UNLOCK.rare, state.timeLeft)) {
    const spot = freeSlot(state, slots);
    if (spot) {
      for (const s of slots) s.at += state.tuning.RARE_LIFE * 0.5;
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
    deadline: now + slots.length * stagger + state.tuning.HOPPER_LIFE + state.tuning.WAVE_GRACE_MS,
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
  const sent = type === "sentinel" ? state.tuning.SENTINEL[tier] || state.tuning.SENTINEL[1] : null;
  const willAttack = slot.persistent ? armed : armed && state.rng() < state.tuning.attackChance(state.deletions, type);
  state.enemies.push({
    col: slot.col,
    row: slot.row,
    type,
    state: "rising",
    t0: now,
    persistent: !!slot.persistent,
    refireAt: Infinity,
    riseMs: riseMsOf(state.tuning, type),
    hp: sent ? sent.hp : hpOf(state.tuning, type),
    tier,
    lastHop: now,
    hopT0: -1e9,
    wave: state.wave ? state.wave.index : -1,
    willAttack,
    // baked at spawn so the telegraph a virus is drawing cannot change length
    // underneath it when the deletion count ticks over mid-aim
    boltKind,
    aimMs: sent ? sent.openMs : state.tuning.aimMs(state.deletions, boltKind),
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
  let lull = state.tuning.waveLullMs(wave.index, state.stageIdx >= LULL_TIGHTEN_STAGE);
  if (cleared) lull *= state.tuning.WAVE_CLEAR_LULL;
  if (state.timeLeft < state.tuning.LOW_TIME) lull = Math.min(lull, state.tuning.LOW_TIME_LULL_MS);
  lull = Math.round(lull);
  let timeBonus = 0, points = 0;
  if (cleared) bumpTask(state, "waveCleared");
  if (cleared) {
    timeBonus = state.tuning.waveClearBonus(wave.virusCount) * state.tuning.pulseScale(state.deletions, advancingMode(state));
    state.timeLeft = Math.min(state.tuning.TIME_CAP, state.timeLeft + timeBonus);
    points = state.tuning.WAVE_CLEAR_PTS * wave.virusCount * multOf(state.chain);
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
      state.nextSpawnAt = now + state.tuning.ARENA_WAVE_GAP_MS;
      events.push({
        type: "waveEnded",
        index: wave.index,
        size: wave.size,
        virusCount: wave.virusCount,
        kills: wave.kills,
        cleared,
        timeBonus: 0,
        points: 0,
        lullMs: state.tuning.ARENA_WAVE_GAP_MS
      });
      return;
    }
    const story = !!modeById(state.modeId).story;
    const roost = story && (guard.idx + 1) % state.tuning.TOWER_EVERY === 0 ? STORY_ROUTE[state.routeIdx] : null;
    const { cleared: a, road, tower: tower2, next } = clearArena(state.world, state.rng, { tower: roost || void 0, tuning: state.tuning });
    if (tower2) state.routeIdx++;
    state.arenasCleared++;
    bumpTask(state, "arenaTaken");
    if (a.idx === 0 || state.rng() < state.tuning.BOMB_PICKUP_CHANCE) {
      const pc = road.x0 + Math.floor(state.rng() * road.cols);
      const pr = road.rows === 1 ? ROAD_MID_ROW : Math.floor(state.rng() * ROWS);
      state.pickups.push({ col: pc, row: pr, kind: "bomb" });
      const pp = panel(state, pc, pr);
      events.push({ type: "pickupSpawned", kind: "bomb", col: pc, row: pr, x: pp.x + pp.w / 2, y: pp.y });
    }
    if (a.idx >= state.tuning.SHARD_UNLOCK && state.rng() < state.tuning.shardDropChance(a.idx)) {
      const reach = Math.min(SHARDS.length, 1 + Math.floor((a.idx - state.tuning.SHARD_UNLOCK) / 15));
      const kind = SHARDS[Math.floor(state.rng() * reach)];
      const sc = road.x0 + Math.floor(state.rng() * road.cols);
      const sr = road.rows === 1 ? ROAD_MID_ROW : Math.floor(state.rng() * ROWS);
      if (!state.pickups.some((q) => q.col === sc && q.row === sr)) {
        state.pickups.push({ col: sc, row: sr, kind });
        const sp = panel(state, sc, sr);
        events.push({ type: "pickupSpawned", kind, col: sc, row: sr, x: sp.x + sp.w / 2, y: sp.y });
      }
    }
    const arenaBonus = state.tuning.ARENA_CLEAR_BONUS * state.tuning.pulseScale(state.deletions, advancingMode(state));
    state.timeLeft = Math.min(state.tuning.TIME_CAP, state.timeLeft + arenaBonus);
    state.score += state.tuning.ARENA_CLEAR_PTS;
    state.nextSpawnAt = Infinity;
    events.push({
      type: "arenaCleared",
      index: a.idx,
      x0: a.x0,
      roadRows: road.rows,
      nextX0: next.x0,
      timeBonus: arenaBonus,
      points: state.tuning.ARENA_CLEAR_PTS
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
    if (busy || state.enemies.length >= state.tuning.MAX_ALIVE) {
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
  const lifeKey = enemyDef(e.type).lifeKey;
  const base = lifeKey ? state.tuning[lifeKey] : state.tuning.upMs(state.deletions);
  if (e.type === "rare") return base;
  if (!e.willAttack) return base;
  return Math.max(base, aimOf(state, e) + state.tuning.ATTACK_FOLLOW_MS);
}
var aimOf = (state, e) => e.aimMs === void 0 ? state.tuning.aimMs(state.deletions, e.boltKind || boltKindFor(e.type)) : e.aimMs;
function updateEnemies(state, events) {
  if (state.mode !== "playing" || state.paused) return;
  const now = state.clock;
  updateWave(state, events);
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const t = now - e.t0;
    if (e.pending) updatePending(state, e, events);
    switch (e.state) {
      case "rising":
        if (t >= (e.riseMs || state.tuning.RISE_MS)) {
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
        const aiming = e.willAttack && !e.fired && now >= (state.cloakUntil || -1e9);
        const def = enemyDef(e.type);
        const hopEvery = !def.hopKey || def.hopWhenHeld && !e.persistent ? Infinity : state.tuning[def.hopKey];
        if (!aiming && now - e.lastHop >= hopEvery) {
          hopTo(state, e, events);
          e.lastHop = now;
        }
        if (aiming && t >= aimOf(state, e)) {
          fireBolt(state, e, events);
          e.fired = true;
          e.refireAt = now + (e.type === "sentinel" ? (state.tuning.SENTINEL[e.tier] || state.tuning.SENTINEL[1]).closedMs : state.tuning.REFIRE_MS);
        }
        if (t >= lifeOf(state, e)) {
          e.state = "sinking";
          e.t0 = now;
        }
        break;
      }
      case "sinking":
        if (t >= state.tuning.SINK_MS) {
          if (e.type === "ally") {
            state.timeLeft = Math.min(state.tuning.TIME_CAP, state.timeLeft + state.tuning.ALLY_SPARE_BONUS);
            const p = panel(state, e.col, e.row);
            state.fx.popups.push({
              x: p.x + p.w / 2,
              y: p.y,
              t0: now,
              text: "spared +" + state.tuning.ALLY_SPARE_BONUS.toFixed(1) + "s",
              color: "#58c7ff"
            });
            bumpTask(state, "spared");
            events.push({
              type: "allySpared",
              col: e.col,
              row: e.row,
              x: p.x + p.w / 2,
              y: p.y,
              timeBonus: state.tuning.ALLY_SPARE_BONUS
            });
          }
          events.push({ type: "enemyEscaped", enemyType: e.type, col: e.col, row: e.row });
          state.enemies.splice(i, 1);
        }
        break;
      case "hit":
        if (t >= state.tuning.HIT_MS) state.enemies.splice(i, 1);
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
function launchBolt(state, e, shot, events) {
  const row = e.row + shot.dRow;
  if (!inBoard(row)) return;
  const p = panel(state, e.col, row);
  const kind = e.boltKind || boltKindFor(e.type);
  state.bolts.push({
    row,
    x: p.x + p.w / 2,
    // px per ms, travelling left
    speed: state.G.pw / state.tuning.boltPanelMs(state.deletions, kind) * shot.speedFactor,
    kind,
    radius: state.G.pw * state.tuning.BOLT[kind].radiusFrac * shot.radiusFactor,
    heavy: kind === "slow"
  });
  events.push({
    type: "enemyFired",
    enemyType: e.type,
    col: e.col,
    row,
    kind,
    heavy: kind === "slow",
    x: p.x + p.w / 2,
    y: p.y
  });
}
function fireBolt(state, e, events) {
  const shots = shotsOf(state.tuning, e.type);
  const now = state.clock;
  for (const shot of shots) {
    if (shot.delay > 0) (e.pending || (e.pending = [])).push({ at: now + shot.delay, shot });
    else launchBolt(state, e, shot, events);
  }
}
function updatePending(state, e, events) {
  const q = e.pending;
  if (!q || !q.length) return;
  const now = state.clock;
  for (let i = 0; i < q.length; ) {
    if (q[i].at > now) {
      i++;
      continue;
    }
    launchBolt(state, e, q[i].shot, events);
    q.splice(i, 1);
  }
}

// src/core/combat.js
function updateBolts(state, dt, events) {
  if (state.mode !== "playing" || state.paused) return;
  const now = state.clock;
  const G = state.G;
  const pr = panel(state, state.player.col, state.player.row);
  const px = pr.x + pr.w / 2;
  const hitR = G.pw * state.tuning.BOLT_HIT_R;
  for (let i = state.bolts.length - 1; i >= 0; i--) {
    const b = state.bolts[i];
    b.x -= b.speed * dt;
    if (b.row === state.player.row && now >= state.hurtUntil && Math.abs(b.x - px) <= hitR) {
      if (now < (state.cloakUntil || 0)) continue;
      state.bolts.splice(i, 1);
      if (state.parry) {
        state.parry = false;
        ripple(state, state.player.col, state.player.row, "#c9f6ff", now, 2);
        state.fx.popups.push({ x: px, y: pr.y - 8, t0: now, text: "PARRIED", color: "#c9f6ff" });
        events.push({ type: "parried", col: state.player.col, row: state.player.row, x: px, y: pr.y });
        events.push({ type: "statsChanged" });
        continue;
      }
      takeHit(state, events);
      continue;
    }
    if (b.x < G.gx + (activeArena(state.world).x0 - 0.5) * G.pw) state.bolts.splice(i, 1);
  }
}
function contextAction(state, events) {
  if (state.mode !== "playing" || state.paused) return;
  const n = npcBeside(state.world, state.player.col, state.player.row);
  if (!n) {
    useTop(state, events);
    return;
  }
  state.talks[n.id] = (state.talks[n.id] || 0) + 1;
  const p = panel(state, n.col, n.row);
  ripple(state, n.col, n.row, "#ffd23f", state.clock, 1);
  events.push({
    type: "talk",
    npc: n.id,
    verb: n.verb || "talk",
    count: state.talks[n.id],
    col: n.col,
    row: n.row,
    x: p.x + p.w / 2,
    y: p.y
  });
  taskExchange(state, n.id, events);
}
function useTop(state, events) {
  if (state.mode !== "playing" || state.paused) return;
  const id = topOf(state.stash);
  if (!id) {
    events.push({ type: "bombEmpty" });
    return;
  }
  const def = itemDef(id);
  if (!def) {
    takeTop(state.stash);
    syncStash(state);
    return;
  }
  if (def.effect === "blast") {
    throwBomb(state, events);
    return;
  }
  takeTop(state.stash);
  syncStash(state);
  const now = state.clock;
  const p = panel(state, state.player.col, state.player.row);
  const pop = (text, color) => state.fx.popups.push({ x: p.x + p.w / 2, y: p.y - 8, t0: now, text, color });
  switch (def.effect) {
    case "parry":
      state.parry = true;
      pop("PARRY SET", "#c9f6ff");
      break;
    case "cloak":
      state.cloakUntil = now + def.arg;
      pop("CLOAK", "#a9defc");
      break;
    case "provoke": {
      let n = 0;
      for (const e of state.enemies) {
        if (!e.willAttack || e.fired || e.state !== "up") continue;
        fireBolt(state, e, events);
        e.fired = true;
        e.refireAt = now + state.tuning.REFIRE_MS;
        n++;
      }
      pop("BELL \xD7" + n, "#ffd23f");
      break;
    }
    case "summon":
      summonOne(state, def.arg, events);
      pop("SUMMONED", "#5ee87c");
      break;
    case "echo":
      if (state.lastShotTier) {
        state.echo = { tier: state.lastShotTier, share: def.arg };
        shoot(state, state.lastShotTier, events);
        state.echo = null;
        pop("ECHO", "#45e0e8");
      } else {
        pop("NOTHING TO ECHO", "#8a96b8");
      }
      break;
    default:
      break;
  }
  events.push({ type: "itemUsed", item: def.id, effect: def.effect, stash: state.stash.slice() });
  events.push({ type: "statsChanged" });
}
function summonOne(state, type, events) {
  if (state.enemies.length >= state.tuning.MAX_ALIVE) return;
  const a = activeArena(state.world);
  if (a.owner !== "enemy") return;
  for (let col = a.x0 + a.cols - 1; col > state.player.col; col--) {
    if (state.enemies.some((e) => e.col === col && e.row === state.player.row)) continue;
    spawnFromSlot(state, { col, row: state.player.row, type, persistent: true, tier: 0 }, events);
    return;
  }
}
function throwBomb(state, events) {
  if (state.mode !== "playing" || state.paused) return;
  if (state.bombs <= 0) {
    events.push({ type: "bombEmpty" });
    return;
  }
  const now = state.clock;
  const a = activeArena(state.world);
  const toCol = Math.min(state.player.col + state.tuning.BOMB_RANGE, a.x0 + a.cols - 1);
  const at = state.stash.lastIndexOf("bomb");
  if (at >= 0) state.stash.splice(at, 1);
  syncStash(state);
  state.bombsInFlight.push({
    fromCol: state.player.col,
    fromRow: state.player.row,
    toCol,
    toRow: state.player.row,
    t0: now,
    dur: state.tuning.BOMB_ARC_MS
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
  for (let i = bl.length - 1; i >= 0; i--) if (now - bl[i].t0 > state.tuning.BOMB_BLAST_MS) bl.splice(i, 1);
}
function detonate(state, col, row, events) {
  const now = state.clock;
  const R = state.tuning.BOMB_RADIUS;
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
      state.timeLeft = Math.max(0, state.timeLeft - state.tuning.ALLY_TIME_PENALTY);
      state.score = Math.max(0, state.score - state.tuning.ALLY_PTS_PENALTY);
      const ep = panel(state, e.col, e.row);
      state.fx.popups.push({
        x: ep.x + ep.w / 2,
        y: ep.y - 8,
        t0: now,
        text: "PROG HIT \u2212" + state.tuning.ALLY_TIME_PENALTY.toFixed(1) + "s",
        color: "#ff5470"
      });
      events.push({
        type: "progHit",
        tier: "charged",
        col: e.col,
        row: e.row,
        x: ep.x + ep.w / 2,
        y: ep.y,
        timePenalty: state.tuning.ALLY_TIME_PENALTY,
        pointsPenalty: state.tuning.ALLY_PTS_PENALTY
      });
      continue;
    }
    if (e.type === "sentinel") {
      const open = e.willAttack ? !e.fired : true;
      if (!open) continue;
      if (e.hp > state.tuning.SENTINEL_CHARGED_DMG) {
        e.hp -= state.tuning.SENTINEL_CHARGED_DMG;
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
  state.hurtUntil = now + state.tuning.HIT_IFRAME_MS;
  state.fx.hurtT0 = now;
  state.timeLeft = Math.max(0, state.timeLeft - state.tuning.HIT_TIME_PENALTY);
  breakChain(state, events, "hurt");
  state.charge.downAt = null;
  state.charge.full = false;
  state.path = null;
  const p = panel(state, state.player.col, state.player.row);
  state.fx.popups.push({
    x: p.x + p.w / 2,
    y: p.y - 8,
    t0: now,
    text: "HIT \u2212" + state.tuning.HIT_TIME_PENALTY.toFixed(1) + "s",
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
  bumpTask(state, "hurt");
  events.push({
    type: "playerHit",
    col: state.player.col,
    row: state.player.row,
    x: p.x + p.w / 2,
    y: p.y,
    timePenalty: state.tuning.HIT_TIME_PENALTY
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
function deleteEnemy(state, target, tierName, land2, events) {
  const now = state.clock;
  const tier = TIERS[tierName];
  const p = panel(state, target.col, target.row);
  const cx = p.x + p.w / 2, cy = p.y + p.h * 0.34;
  target.state = "hit";
  target.t0 = land2;
  hitFx(target, tier, land2);
  const multBefore = multOf(state.chain);
  state.chain++;
  if (state.chain > state.bestChain) state.bestChain = state.chain;
  const mult = multOf(state.chain);
  bumpTask(state, "kill", { type: target.type, tier: tierName, chain: state.chain });
  if (state.wave && target.wave === state.wave.index) state.wave.kills++;
  const baseKey = enemyDef(target.type).scoreKey || tierName;
  const share = state.echo ? state.echo.share : 1;
  const pts = Math.round((state.tuning.PTS[baseKey] === void 0 ? state.tuning.PTS[tierName] : state.tuning.PTS[baseKey]) * mult * share);
  state.score += pts;
  state.deletions++;
  const bf = state.tuning.pulseScale(state.deletions, modeById(state.modeId).advancing);
  const factor = baseKey === "rare" ? Math.sqrt(bf) : bf;
  const timeBonus = (state.tuning.BONUS[baseKey] === void 0 ? state.tuning.BONUS[tierName] : state.tuning.BONUS[baseKey]) * factor * share;
  state.timeLeft = Math.min(state.tuning.TIME_CAP, state.timeLeft + timeBonus);
  spawnBits(state, cx, cy, BIT_COUNT[baseKey] || BIT_COUNT.guard, DEBRIS[target.type] || DEBRIS.guard, {
    at: land2,
    speed: baseKey === "rare" ? 0.4 : baseKey === "charged" ? 0.34 : 0.28,
    spread: 1.25
  });
  ripple(
    state,
    target.col,
    target.row,
    baseKey === "rare" ? "#ffd23f" : baseKey === "guard" ? "#c9f6ff" : "#45e0e8",
    land2,
    baseKey === "rare" ? 4 : 3
  );
  ripple(state, state.player.col, state.player.row, "#45e0e8", land2, 1);
  shake(state, SHAKE[baseKey] || SHAKE.normal, land2);
  hitStop(state, land2, HITSTOP[baseKey] || HITSTOP.normal);
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
    state.fx.flare = { t0: land2, mult, x: cx, y: cy };
    shake(state, SHAKE.chain, land2, mult / 2);
    hitStop(state, land2, HITSTOP.chain);
    spawnBits(
      state,
      cx,
      cy,
      6 + mult * 2,
      DEBRIS.rare,
      { at: land2, speed: 0.34, spread: 2, ms: 640 }
    );
  }
  state.fx.popups.push({
    x: cx,
    y: p.y - 8,
    t0: land2,
    text: "+" + pts + (mult > 1 ? " \xD7" + mult : ""),
    color: baseKey === "rare" ? "#ffe08a" : baseKey === "guard" || mult > 1 ? "#45e0e8" : "#aab4ce"
  });
  state.fx.popups.push({
    x: cx,
    y: p.y + 12,
    t0: land2 + 60,
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
  if (!state.echo) state.lastShotTier = tierName;
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
  const land2 = now + dur;
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
    breakChain(state, events, "whiff", land2);
    events.push({ type: "statsChanged" });
    return;
  }
  const p = panel(state, target.col, target.row);
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h * 0.34;
  if (target.type === "ally") {
    target.state = "hit";
    target.t0 = land2;
    hitFx(target, tier, land2);
    state.whiffs++;
    breakChain(state, events, "prog", land2);
    state.timeLeft = Math.max(0, state.timeLeft - state.tuning.ALLY_TIME_PENALTY);
    state.score = Math.max(0, state.score - state.tuning.ALLY_PTS_PENALTY);
    state.fx.popups.push({
      x: cx,
      y: p.y - 8,
      t0: land2,
      text: "PROG HIT \u2212" + state.tuning.ALLY_TIME_PENALTY.toFixed(1) + "s",
      color: "#ff5470"
    });
    spawnBits(state, cx, cy, BIT_COUNT.prog, DEBRIS.ally, { at: land2, speed: 0.18 });
    ripple(state, target.col, target.row, "#ff5470", land2, 3);
    shake(state, SHAKE.prog, land2);
    hitStop(state, land2, HITSTOP.prog);
    events.push({
      type: "progHit",
      tier: tierName,
      col: target.col,
      row: target.row,
      x: cx,
      y: p.y,
      timePenalty: state.tuning.ALLY_TIME_PENALTY,
      pointsPenalty: state.tuning.ALLY_PTS_PENALTY
    });
    events.push({ type: "statsChanged" });
    return;
  }
  if (enemyDef(target.type).armor === "steel" && tierName === "normal") {
    state.fx.sparks.push({ x: p.x + p.w * 0.28, y: p.y + p.h * 0.2, t0: land2 });
    state.fx.popups.push({ x: cx, y: p.y - 8, t0: land2, text: "GUARD", color: "#8a96b8" });
    spawnBits(
      state,
      p.x + p.w * 0.28,
      cy,
      BIT_COUNT.block,
      DEBRIS.guard,
      { at: land2, dir: Math.PI, spread: 0.7, speed: 0.16, ms: 320 }
    );
    ripple(state, target.col, target.row, "#aeb9d6", land2, 2);
    hitStop(state, land2, HITSTOP.block);
    events.push({ type: "guardBlocked", col: target.col, row: target.row, x: cx, y: p.y });
    return;
  }
  if (enemyDef(target.type).armor === "shutter") {
    const open = target.willAttack ? !target.fired : true;
    if (!open) {
      state.fx.sparks.push({ x: p.x + p.w * 0.28, y: p.y + p.h * 0.2, t0: land2 });
      state.fx.popups.push({ x: cx, y: p.y - 8, t0: land2, text: "CLOSED", color: "#b48cff" });
      spawnBits(
        state,
        p.x + p.w * 0.28,
        cy,
        BIT_COUNT.block,
        DEBRIS.guard,
        { at: land2, speed: 0.14, ms: 260 }
      );
      ripple(state, target.col, target.row, "#b48cff", land2, 2);
      events.push({ type: "guardBlocked", col: target.col, row: target.row, x: cx, y: p.y });
      return;
    }
    const dmg = tierName === "charged" ? state.tuning.SENTINEL_CHARGED_DMG : 1;
    if (target.hp > dmg) {
      target.hp -= dmg;
      state.fx.sparks.push({ x: cx, y: p.y + p.h * 0.2, t0: land2 });
      state.fx.popups.push({ x: cx, y: p.y - 8, t0: land2, text: target.hp + " more", color: "#c48cff" });
      spawnBits(state, cx, cy, BIT_COUNT.stagger, DEBRIS.guard, { at: land2, speed: 0.17, ms: 340 });
      ripple(state, target.col, target.row, "#c48cff", land2, 2);
      hitStop(state, land2, HITSTOP.stagger);
      events.push({ type: "sentinelHit", col: target.col, row: target.row, x: cx, y: p.y, hp: target.hp });
      return;
    }
  }
  if (enemyDef(target.type).stagger && tierName === "normal" && target.hp > 1) {
    target.hp--;
    state.fx.sparks.push({ x: cx, y: p.y + p.h * 0.2, t0: land2 });
    state.fx.popups.push({ x: cx, y: p.y - 8, t0: land2, text: "1 more", color: "#5ee87c" });
    spawnBits(
      state,
      cx,
      cy,
      BIT_COUNT.stagger,
      DEBRIS.hopper,
      { at: land2, speed: 0.17, ms: 340 }
    );
    ripple(state, target.col, target.row, "#5ee87c", land2, 2);
    hitStop(state, land2, HITSTOP.stagger);
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
  deleteEnemy(state, target, tierName, land2, events);
}

// src/core/step.js
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
    if (!safeZone(state.world)) {
      state.timeLeft -= dtMs / 1e3 * state.tuning.drainRate(activeArena(state.world).idx);
    }
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      gameOver(state, events);
    }
    if (state.charge.downAt !== null && !state.charge.full && state.clock - state.charge.downAt >= state.tuning.CHARGE_MS) {
      state.charge.full = true;
      events.push({ type: "chargeReady" });
    }
  }
  if (hold && (hold.dc || hold.dr)) {
    const hd = state.holdDir;
    if (!hd || hd.dc !== hold.dc || hd.dr !== hold.dr) {
      state.holdDir = { dc: hold.dc, dr: hold.dr };
      state.holdT0 = state.clock;
    }
    move(state, hold.dc, hold.dr, events, true);
  } else {
    state.holdDir = null;
  }
  updateHop(state, events);
  flushQueuedMove(state, events);
  runPath(state, events);
  updateEnemies(state, events);
  updateBolts(state, adv, events);
  checkStageGate(state, events);
  cullFx(state);
  return events;
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
    case "moveTo":
      moveTo(state, action.col, action.row, events);
      break;
    case "tapAt":
      tapAt(state, action.x, action.y, events);
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
      contextAction(state, events);
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
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
  /* an empty press: the button says no, visibly */
  #bombBtn.deny { animation: bwDeny 260ms ease-out; border-color: var(--bw-warn) !important; }
  @keyframes bwDeny {
    0%   { transform: translateX(0); }
    25%  { transform: translateX(-5px); }
    55%  { transform: translateX(5px); }
    80%  { transform: translateX(-3px); }
    100% { transform: translateX(0); }
  }
  #bombBtn:focus-visible { outline: 2px solid var(--bw-oc); outline-offset: 3px; }
  #fireBtn:focus-visible { outline: 2px solid var(--bw-accent); outline-offset: 3px; }

  /* ---------- one-hand deck ---------- */
  /* The bottom of the stage is FIRE: one rounded rectangle across the whole
     width where a phone keyboard would sit, with the board resting directly
     on it so the thumb rolls from squares to trigger without a reach. BOMB
     is a wide bar just above the board -- out of the way of the fast loop,
     still one thumb away. The ring goes; the board is the movement surface.
     Sized in cqh against #stage so a short embed keeps a board; the mount
     hands the deck's height to the layout as a bottom inset and places BOMB
     from the layout it gets back, so the three always line up. */
  main {
    --bw-deck-h: clamp(120px, 32cqh, 280px);
    --bw-deck-pad: 10px;
    --bw-bomb-h: 54px;
  }
  #deck {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--bw-deck-h);
    display: none;
    background: linear-gradient(to bottom, rgba(8, 11, 20, 0.55), rgba(8, 11, 20, 0.92));
    pointer-events: none;
  }
  main.touch #deck { display: block; }
  main.touch #dpad { display: none; }
  main.touch canvas { cursor: pointer; }
  main.touch #fireBtn {
    position: absolute;
    left: var(--bw-deck-pad);
    right: var(--bw-deck-pad);
    bottom: var(--bw-deck-pad);
    top: auto;
    width: auto;
    height: calc(var(--bw-deck-h) - var(--bw-deck-pad) * 2);
    border-radius: 22px;
    padding: 0;
    flex-direction: column;
    gap: 6px;
    font-size: 15px;
    letter-spacing: 0.22em;
    border: 2px solid var(--bw-accent);
    background: linear-gradient(180deg, rgba(69, 224, 232, 0.20), rgba(69, 224, 232, 0.08));
    box-shadow: inset 0 0 0 1px rgba(69, 224, 232, 0.18), 0 0 22px rgba(69, 224, 232, 0.12);
  }
  main.touch #fireBtn:active { background: rgba(69, 224, 232, 0.32); }
  main.touch #fireBtn .glyph { font-size: 30px; line-height: 1; }
  main.touch #bombBtn {
    /* left / top / width are set by the mount from the board's layout */
    position: absolute;
    z-index: 6;   /* over the line strip, which is pointer-events: none but sits in the same band */
    right: auto;
    bottom: auto;
    height: var(--bw-bomb-h);
    border-radius: 16px;
    padding: 0;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 14px;
    font-size: 13px;
    letter-spacing: 0.22em;
    background: linear-gradient(180deg, rgba(255, 159, 69, 0.20), rgba(255, 159, 69, 0.08));
    box-shadow: inset 0 0 0 1px rgba(255, 159, 69, 0.18);
  }
  main.touch #bombBtn b { font-size: 22px; }
  main.touch #bombBtn.empty { background: rgba(35, 44, 66, 0.5); box-shadow: none; }

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

  /* ---------- story: a line over the board ---------- */
  /* One representation: text is a strip laid over the play space, never a
     screen of its own. It sits where the mount puts it (above the BOMB bar in
     one-hand, under the HUD otherwise) and fades on its own. */
  #say {
    position: absolute;
    left: 5%;
    right: 5%;
    top: 100px;
    z-index: 5;
    padding: 10px 14px;
    border: 1px solid var(--bw-line);
    border-left: 3px solid var(--bw-accent);
    border-radius: 10px;
    background: rgba(8, 11, 20, 0.86);
    color: var(--bw-ink);
    font: 500 13px/1.45 var(--bw-mono);
    letter-spacing: 0.02em;
    pointer-events: none;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 180ms ease, transform 180ms ease;
  }
  #say.on { opacity: 1; transform: none; }
  /* where you are: a quiet label under LEVEL, set on arrival at a tower */
  #place {
    position: absolute;
    left: 28px;
    top: 74px;
    color: var(--bw-ink-dim);
    font: 600 11px/1 var(--bw-mono);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    pointer-events: none;
    opacity: 0;
    transition: opacity 240ms ease;
  }
  #place.on { opacity: 1; }
  /* The stash: what you are carrying, top first -- the leftmost name is what
     the context button would spend. */
  #stash {
    position: absolute;
    right: 28px;
    top: 74px;
    color: var(--bw-ink-dim);
    font: 600 11px/1 var(--bw-mono);
    letter-spacing: 0.18em;
    text-align: right;
    pointer-events: none;
    opacity: 0;
    transition: opacity 240ms ease;
  }
  #stash.has { opacity: 1; }
  #stash::first-letter { color: var(--bw-accent); }
  #say b { display: block; color: var(--bw-accent); font-size: 11px; letter-spacing: 0.22em; margin-bottom: 3px; }
  #say b:empty { display: none; }
  #bombBtn.talk {
    color: var(--bw-ink);
    border-color: var(--bw-accent);
    background: linear-gradient(180deg, rgba(69, 224, 232, 0.22), rgba(69, 224, 232, 0.08));
    box-shadow: inset 0 0 0 1px rgba(69, 224, 232, 0.18);
  }
  #bombBtn.talk b { display: none; }

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

        <div id="spModeRule" class="sp-rule">SELECT MODE</div>

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

    <div id="deck" aria-hidden="true"></div>
    <div id="say" role="status" aria-live="polite"><b id="sayWho"></b><span id="sayText"></span></div>
    <div id="place" aria-live="polite"></div>
    <div id="stash" aria-live="polite" aria-label="Stash"></div>
    <button id="pauseBtn" aria-label="Pause">II</button>
    <button id="bombBtn" class="empty" aria-label="Throw bomb"><span id="bombLabel">BOMB</span><b id="bombCount">0</b></button>
    <button id="fireBtn" aria-label="Fire"><span>FIRE</span><span class="glyph">&#9679;</span></button>
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
  "spModeRule",
  "dpad",
  "aUp",
  "aDown",
  "aLeft",
  "aRight",
  "pauseBtn",
  "fireBtn",
  "bombBtn",
  "bombCount",
  "bombLabel",
  "muteFlag",
  "deck",
  "say",
  "sayWho",
  "sayText",
  "place",
  "stash"
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
  const single = modes.length <= 1;
  els.spModes.hidden = single;
  els.spModeRule.hidden = single;
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
function setControls(els, controls) {
  els.stage.classList.toggle("touch", controls === "touch");
  return deckInset(els);
}
function deckInset(els) {
  if (!els.stage.classList.contains("touch")) return 0;
  const r = els.deck.getBoundingClientRect();
  return r.height || 0;
}
function placeTouchControls(els, G) {
  const st = els.bombBtn.style;
  if (!els.stage.classList.contains("touch")) {
    st.left = st.top = st.width = "";
    els.say.style.top = els.say.style.bottom = "";
    return;
  }
  const h = els.bombBtn.getBoundingClientRect().height || 54;
  st.left = G.gx + "px";
  st.width = G.pw * COLS + "px";
  const top = Math.max(0, G.gy - h - 12);
  st.top = top + "px";
  els.say.style.top = "auto";
  els.say.style.bottom = G.h - top + 10 + "px";
}
function renderBombs(els, n, verb = "bomb", stash = null) {
  const talk = verb !== "bomb";
  const top = stash && stash.length ? stash[0] : null;
  const label = { read: "READ", talk: "TALK", next: "NEXT", done: "DONE" }[verb] || (top ? top.name : "BOMB");
  const count = talk ? n : top ? stash.filter((it) => it.id === top.id).length : 0;
  els.bombCount.textContent = String(talk ? n : count);
  els.bombLabel.textContent = label;
  els.bombBtn.setAttribute("aria-label", talk ? label[0] + label.slice(1).toLowerCase() : "Use " + label.toLowerCase());
  els.bombBtn.classList.toggle("talk", talk);
  els.bombBtn.classList.toggle("empty", !talk && !top);
  if (els.stash) {
    els.stash.textContent = stash && stash.length ? stash.map((it) => it.name).join(" \xB7 ") : "";
    els.stash.classList.toggle("has", !!(stash && stash.length));
  }
}
function denyBomb(els) {
  els.bombBtn.classList.remove("deny");
  void els.bombBtn.offsetWidth;
  els.bombBtn.classList.add("deny");
}
function renderPlace(els, text) {
  els.place.textContent = text || "";
  els.place.classList.toggle("on", !!text);
}
function renderSay(els, who, text) {
  els.sayWho.textContent = who || "";
  els.sayText.textContent = text || "";
  els.say.classList.toggle("on", !!text);
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
var CHARGE_MS = 700;
var LOW_TIME = 6;
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
  const AC = (
    /** @type {any} */
    win.AudioContext || /** @type {any} */
    win.webkitAudioContext
  );
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
    const secs = CHARGE_MS / 1e3;
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
      case "bombEmpty":
        tone({ wave: "square", freq: 160, to: 120, dur: 0.06, gain: 0.05 });
        break;
      case "talk":
        seq([64, 71], { step: 0.07, dur: 0.11, gain: 0.07 });
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
    music.lowTime = view.mode === "playing" && !view.paused && !view.safe && view.timeLeft < LOW_TIME;
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

// src/canon/decoder.js
function fnv1a2(s) {
  let h = 2166136261;
  const bytes = new TextEncoder().encode(s);
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}
function xs(x) {
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}
function keystream(seed, n) {
  let x = seed;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    x = xs(x);
    out[i] = x & 255;
  }
  return out;
}
function perm(seed, block) {
  let x = (seed ^ 2654435769) >>> 0 || 1;
  const p = Array.from({ length: block }, (_, i) => i);
  for (let i = block - 1; i > 0; i--) {
    x = xs(x);
    const j = x % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}
function unpermute(data, p) {
  const b = p.length;
  const out = new Uint8Array(data);
  for (let s = 0; s + b <= data.length; s += b) {
    for (let i = 0; i < b; i++) out[s + p[i]] = data[s + i];
  }
  return out;
}
function unb64custom(text, alphabet) {
  const lut = /* @__PURE__ */ new Map();
  for (let i = 0; i < 64; i++) lut.set(alphabet[i], i);
  const out = [];
  let acc = 0, bits = 0;
  for (const ch of text) {
    const v = lut.get(ch);
    if (v === void 0) continue;
    acc = acc << 6 | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push(acc >>> bits & 255);
    }
  }
  return Uint8Array.from(out);
}
function parseContainer(container) {
  const idx = container.indexOf("\n\n");
  const head = container.slice(0, idx);
  const rest = container.slice(idx + 2);
  const meta = {};
  for (const line of head.split("\n")) {
    const c = line.indexOf(":");
    if (c > 0) meta[line.slice(0, c).trim()] = line.slice(c + 1).trim();
  }
  const body2 = rest.split("-----END MESH VAULT-----")[0].replace(/\n/g, "");
  return { meta: { v: meta.v, id: meta.id, sha256: meta.sha256, len: Number(meta.len) }, body: body2 };
}
var K = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
];
function sha256hexSync(bytes) {
  const rotr = (x, n) => x >>> n | x << 32 - n;
  const len = bytes.length;
  const padded = new Uint8Array(len + 9 + 63 >> 6 << 6);
  padded.set(bytes);
  padded[len] = 128;
  const bits = len * 8;
  padded[padded.length - 4] = bits >>> 24 & 255;
  padded[padded.length - 3] = bits >>> 16 & 255;
  padded[padded.length - 2] = bits >>> 8 & 255;
  padded[padded.length - 1] = bits & 255;
  const H = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = padded[j] << 24 | padded[j + 1] << 16 | padded[j + 2] << 8 | padded[j + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = h + S1 + ch + K[i] + w[i] >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
    H[5] = H[5] + f >>> 0;
    H[6] = H[6] + g >>> 0;
    H[7] = H[7] + h >>> 0;
  }
  return H.map((x) => x.toString(16).padStart(8, "0")).join("");
}
async function sha256hex(data) {
  const subtle = typeof crypto !== "undefined" && crypto.subtle;
  if (!subtle) return sha256hexSync(data);
  const d = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function decode(container, m) {
  const { meta, body: body2 } = parseContainer(container);
  const seed = fnv1a2(meta.id + "" + m.salt);
  const p = perm(seed, m.block);
  const enc = unb64custom(body2, m.alphabet);
  const ks = keystream(seed, enc.length);
  const xored = new Uint8Array(enc.length);
  for (let i = 0; i < enc.length; i++) xored[i] = enc[i] ^ ks[i];
  const raw = unpermute(xored, p);
  if (meta.sha256 && await sha256hex(raw) !== meta.sha256) {
    throw new Error("vault integrity check failed: " + meta.id);
  }
  return new TextDecoder().decode(raw);
}

// src/canon/unseal.js
var __curtain__ = [
  "9JzN6ICchJ3diwiIq5GO2hFMCtmRxk2V1sycjFXZkhHdUJTT",
  "1x2SodURD9WWtdmcaBVV5YlNIlnTKdjYmxkezEVQSRzLwF2U",
  "3RUSPJiOiQXZiFGawxWYiwiNxojIrN2bsJmIsIicv9GZtUGa",
  "01iclRmb11CdpZWLvRXLodWdv5WZtwGbh12ciojI0xWYzJye"
];
var __method__ = null;
function __drawTheCurtain__() {
  if (__method__) return __method__;
  const reversed = __curtain__.join("");
  const b64 = Array.from(reversed).reverse().join("");
  const json = typeof atob === "function" ? atob(b64) : (
    /** @type {any} */
    globalThis.Buffer.from(b64, "base64").toString("utf8")
  );
  __method__ = JSON.parse(json);
  return __method__;
}
async function unseal(container) {
  return decode(container, __drawTheCurtain__());
}

// src/canon/canon.js
var PlayerState = class {
  constructor() {
    this.kv = /* @__PURE__ */ new Map();
  }
  set(k, v) {
    this.kv.set(k, v);
  }
  get(k) {
    return this.kv.get(k);
  }
  inc(k, by = 1) {
    this.kv.set(k, Number(this.kv.get(k) ?? 0) + by);
  }
  flag(k) {
    this.kv.set(k, true);
  }
  has(k) {
    return this.kv.get(k) === true;
  }
  snapshot() {
    return Object.fromEntries(this.kv);
  }
  restore(s) {
    this.kv = new Map(Object.entries(s));
  }
};
var Canon = class _Canon {
  /** Use Canon.load(). */
  constructor(strings, triggers, state) {
    this.strings = strings;
    this.triggers = triggers;
    this.state = state;
    this.gateFor = /* @__PURE__ */ new Map();
    for (const t of triggers) for (const id of t.unlocks) this.gateFor.set(id, t);
    this.seenOpen = /* @__PURE__ */ new Set();
  }
  /**
   * @param {string} stringsVault - the sealed string table, as text
   * @param {Array} triggers - bible/triggers.json
   * @param {PlayerState} [state]
   */
  static async load(stringsVault, triggers, state = new PlayerState()) {
    const strings = JSON.parse(await unseal(stringsVault));
    return new _Canon(strings, triggers, state);
  }
  /** Evaluate a gate predicate against the current player state. */
  eval(p) {
    if ("all" in p) return p.all.every((q) => this.eval(q));
    if ("any" in p) return p.any.some((q) => this.eval(q));
    if ("flag" in p) return p.flag.startsWith("!") ? !this.state.has(p.flag.slice(1)) : this.state.has(p.flag);
    if ("secret" in p) return this.unlocked(p.secret);
    const v = this.state.get(p.key);
    const a = typeof v === "number" ? v : Number(v ?? 0);
    const b = typeof p.value === "number" ? p.value : Number(p.value);
    switch (p.op) {
      case ">=":
        return a >= b;
      case "<=":
        return a <= b;
      case ">":
        return a > b;
      case "<":
        return a < b;
      case "==":
        return v === p.value;
      case "!=":
        return v !== p.value;
      default:
        throw new Error("canon: unknown op " + p.op);
    }
  }
  /** Is a trigger open? Unknown ids throw, so a typo can never open a secret. */
  unlocked(triggerId) {
    const t = this.triggers.find((x) => x.id === triggerId);
    if (!t) throw new Error("canon: unknown trigger id " + triggerId);
    return this.eval(t.gate);
  }
  /** Is this string id readable right now? Ungated ids always are. */
  open(id) {
    const g = this.gateFor.get(id);
    return !g || this.eval(g.gate);
  }
  /** Get a string. Locked strings return "". Missing ids throw so you notice. */
  t(id, vars) {
    if (!(id in this.strings)) throw new Error("canon: unknown string id " + id);
    if (!this.open(id)) return "";
    let s = this.strings[id];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v));
    return s;
  }
  /** Ids only; safe to print in tooling. */
  ids() {
    return Object.keys(this.strings);
  }
  /**
   * Gates are evaluated on read, so nothing announces a reveal by itself.
   * This is the announcement: every gated id that is open now and was not
   * the last time this was called. The game asks after each state write and
   * gets the list of things it may now show for the first time.
   */
  newlyUnlocked() {
    const out = [];
    for (const id of this.gateFor.keys()) {
      if (this.seenOpen.has(id)) continue;
      if (this.open(id)) {
        this.seenOpen.add(id);
        out.push(id);
      }
    }
    return out;
  }
};

// src/canon/embed.js
var STRINGS_VAULT = "-----BEGIN MESH VAULT-----\nv: 1\nid: strings.v3\nsha256: 226ffdaa0c311a4a1fdb76819757da3e9942da1052e8b399032ea1e40c87aa10\nlen: 15533\n\n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\n-----END MESH VAULT-----\n";
var TRIGGERS = [{ "id": "S01", "gate": { "all": [{ "flag": "entered.roost.08" }, { "key": "reads.item.journal.steward", "op": ">=", "value": 1 }] }, "unlocks": ["npc.hidden.02.journal.last"] }, { "id": "S02", "gate": { "key": "talks.ferryman", "op": ">=", "value": 4 }, "unlocks": ["boss.ferryman.carried"] }, { "id": "S03", "gate": { "all": [{ "flag": "carried.npc.keeper.05" }, { "flag": "entered.roost.08" }] }, "unlocks": ["charter.09", "npc.keeper.05.fit"] }, { "id": "S04", "gate": { "all": [{ "key": "roosts.dark", "op": ">=", "value": 5 }, { "key": "talks.ferryman", "op": ">=", "value": 3 }] }, "unlocks": ["npc.hidden.01.name", "npc.hidden.01.greet", "npc.hidden.01.nice"] }, { "id": "S05", "gate": { "any": [{ "key": "ferried.count", "op": ">=", "value": 1 }, { "all": [{ "key": "day", "op": ">=", "value": 8 }, { "flag": "!carried.npc.keeper.03" }] }] }, "unlocks": ["boss.ferryman.sorry"], "engine_note": "see AGENTS.md: engine picks the keeper; ferried.count>=1 -> keeper.02; else keeper.03 if uncarried at (annex sunset - 1 day); else keeper.02. keeper.04 never." }, { "id": "S06", "gate": { "flag": "reached.final_roost" }, "unlocks": ["npc.keeper.01.list", "item.list.dot"] }, { "id": "S07", "gate": { "all": [{ "secret": "S01" }, { "key": "reads.item.journal.steward", "op": ">=", "value": 2 }] }, "unlocks": ["npc.hidden.02.journal.margin"] }, { "id": "S08", "gate": { "all": [{ "key": "logs.player", "op": ">=", "value": 5 }, { "flag": "reached.final_roost" }] }, "unlocks": ["npc.hidden.03.reply"], "engine_note": "npc.hidden.03.reply is intentionally empty in strings.v1. See AGENTS.md." }, { "id": "C04", "gate": { "flag": "carried.npc.keeper.03" }, "unlocks": ["charter.04", "item.clause.04"] }, { "id": "CHARTER", "gate": { "flag": "entered.roost.08" }, "unlocks": ["charter.title", "charter.01", "charter.02", "charter.03", "charter.05", "charter.06", "charter.07", "charter.08", "charter.10"] }, { "id": "KEEPER04_STAY", "gate": { "key": "roosts.dark", "op": ">=", "value": 5 }, "unlocks": ["npc.keeper.04.stay"] }, { "id": "KEEPER02_LEAVE", "gate": { "flag": "carried.npc.keeper.02" }, "unlocks": ["npc.keeper.02.leave"] }, { "id": "KEEPER03_GIVE", "gate": { "flag": "carried.npc.keeper.03" }, "unlocks": ["npc.keeper.03.give"] }];

// src/shell/story.js
var P = "player.name";
var conv = (id, n, count, who = id + ".name") => Array.from({ length: count }, (_, i) => [i % 2 === 1 ? P : who, id + ".c" + n + "." + i]);
var TALKS = {
  "npc.keeper.01": [
    conv("npc.keeper.01", 0, 4),
    conv("npc.keeper.01", 1, 3),
    conv("npc.keeper.01", 2, 3),
    conv("npc.keeper.01", 3, 1),
    [["npc.keeper.01.name", "npc.keeper.01.sunset"]],
    [["npc.keeper.01.name", "npc.keeper.01.list"]]
  ],
  "npc.keeper.02": [
    conv("npc.keeper.02", 0, 3),
    conv("npc.keeper.02", 1, 3),
    [["npc.keeper.02.name", "npc.keeper.02.c2.0"], ["npc.keeper.02.name", "npc.keeper.02.c2.1"]],
    conv("npc.keeper.02", 3, 1),
    [["npc.keeper.02.name", "npc.keeper.02.leave"]]
  ],
  "npc.side.tally": [conv("npc.side.tally", 0, 3), conv("npc.side.tally", 1, 1)],
  "npc.keeper.03": [
    conv("npc.keeper.03", 0, 1),
    conv("npc.keeper.03", 1, 3),
    conv("npc.keeper.03", 2, 3),
    conv("npc.keeper.03", 3, 1),
    [["npc.keeper.03.name", "npc.keeper.03.trade"]],
    [["npc.keeper.03.name", "npc.keeper.03.give"]]
  ],
  "npc.side.vesper": [conv("npc.side.vesper", 0, 3), conv("npc.side.vesper", 1, 1)],
  "npc.keeper.05": [
    conv("npc.keeper.05", 0, 3),
    conv("npc.keeper.05", 1, 1),
    conv("npc.keeper.05", 2, 3),
    conv("npc.keeper.05", 3, 3),
    [["npc.keeper.05.name", "npc.keeper.05.fit"]]
  ],
  "npc.side.bean": [
    [["npc.side.bean.name", "npc.side.bean.c0.0"], ["npc.keeper.05.name", "npc.side.bean.c0.1"]],
    [["npc.side.bean.name", "npc.side.bean.c1.0"], ["npc.keeper.05.name", "npc.side.bean.c1.1"]]
  ],
  "npc.keeper.04": [
    conv("npc.keeper.04", 0, 1),
    conv("npc.keeper.04", 1, 3),
    conv("npc.keeper.04", 2, 1),
    conv("npc.keeper.04", 3, 1),
    [["npc.keeper.04.name", "npc.keeper.04.stay"]]
  ],
  "npc.side.rivet": [conv("npc.side.rivet", 0, 3), conv("npc.side.rivet", 1, 1)],
  "boss.ferryman": [
    conv("boss.ferryman", 0, 3),
    [["boss.ferryman.name", "boss.ferryman.c1.0"], ["boss.ferryman.name", "boss.ferryman.c1.1"]],
    conv("boss.ferryman", 2, 1),
    conv("boss.ferryman", 3, 1),
    [["boss.ferryman.name", "boss.ferryman.carried"]],
    [["boss.ferryman.name", "boss.ferryman.sorry"]]
  ],
  "npc.sweeper.tidy": [conv("npc.sweeper.tidy", 0, 3), conv("npc.sweeper.tidy", 1, 1)],
  "boss.foreman": [conv("boss.foreman", 0, 3), conv("boss.foreman", 1, 1)],
  "item.journal.steward": [
    [["item.journal.steward.name", "item.journal.steward.read.0"]],
    [["item.journal.steward.name", "item.journal.steward.read.1"]],
    [["npc.hidden.02.name", "npc.hidden.02.journal.last"]],
    [["npc.hidden.02.name", "npc.hidden.02.journal.margin"]]
  ],
  "npc.hidden.01": [[["npc.hidden.01.name", "npc.hidden.01.greet"]], [["npc.hidden.01.name", "npc.hidden.01.nice"]]]
};
function createStory({ say, hush, place, onError, load = Canon.load }) {
  let canon = null;
  let pending = [];
  let active = false;
  let done = {};
  let convo = null;
  const ready = load(STRINGS_VAULT, TRIGGERS).then((c) => {
    canon = c;
    const q = pending;
    pending = [];
    for (const ev of q) handle(ev);
    return c;
  }).catch((e) => {
    if (onError) onError(e);
    return null;
  });
  function beatText(what) {
    return what && typeof what === "object" && what.plain !== void 0 ? what.plain : canon.t(what);
  }
  function nthOpen(list, n) {
    const open = list.filter((beats) => beatText(beats[0][1]) !== "");
    if (!open.length) return null;
    return open[Math.min(n, open.length - 1)];
  }
  function showBeat() {
    const [who, what] = convo.beats[convo.i];
    say(who ? canon.t(who) : "", beatText(what));
  }
  function press(npc, verb) {
    if (convo && convo.npc === npc) {
      convo.i++;
      if (convo.i < convo.beats.length && beatText(convo.beats[convo.i][1]) !== "") {
        showBeat();
        return;
      }
      done[npc] = (done[npc] || 0) + 1;
      const key = npc.replace(/^(npc|boss|item)\./, "");
      canon.state.inc((verb === "read" ? "reads." : "talks.") + key);
      if (verb === "read") canon.state.inc("reads." + npc);
      close();
      return;
    }
    const beats = nthOpen(TALKS[npc] || [], done[npc] || 0);
    if (!beats) return;
    convo = { npc, beats: beats.slice(), i: 0 };
    showBeat();
  }
  function close() {
    convo = null;
    if (hush) hush();
  }
  function handle(ev) {
    switch (ev.type) {
      case "runStarted": {
        active = !!ev.story;
        close();
        done = {};
        if (place) place("");
        if (!active) return;
        canon.state.restore({});
        canon.seenOpen.clear();
        break;
      }
      case "towerEntered": {
        if (!active) return;
        canon.state.inc("day");
        canon.state.flag("entered." + ev.roost);
        if (place) place(canon.t(ev.roost + ".name"));
        break;
      }
      case "arenaEntered": {
        if (active && place) place("");
        break;
      }
      case "talk": {
        if (!active) return;
        press(ev.npc, ev.verb);
        break;
      }
      // The bonus task is the last thing this person says: what they are
      // asking for, how far along it is, or what they are paying out. It
      // arrives with the talk it belongs to, so it lands as one more press
      // of TALK rather than a box that appears on its own.
      case "taskGiven":
      case "taskProgress":
      case "taskDone": {
        if (!active || !ev.text) return;
        if (!convo || convo.npc !== ev.npc) return;
        convo.beats.push([convo.beats[0][0], { plain: ev.text }]);
        break;
      }
      default:
        break;
    }
  }
  return {
    ready,
    /** Feed every core event; the module ignores what is not its business. */
    handleAll(events) {
      for (const ev of events) {
        if (![
          "runStarted",
          "towerEntered",
          "arenaEntered",
          "talk",
          "taskGiven",
          "taskProgress",
          "taskDone"
        ].includes(ev.type)) continue;
        if (!canon) pending.push(ev);
        else handle(ev);
      }
    },
    /**
     * What the context button should read beside `npc`: "next" while their
     * conversation is open and more beats remain, "done" on its last beat,
     * or null when no conversation is open (the verb itself applies).
     */
    label(npc) {
      if (!convo || convo.npc !== npc) return null;
      const more = convo.i + 1 < convo.beats.length && canon.t(convo.beats[convo.i + 1][1]) !== "";
      return more ? "next" : "done";
    },
    /** Walking away from the person closes the box; it is theirs, not the road's. */
    leave() {
      if (convo) close();
    },
    get open() {
      return !!convo;
    },
    /** The canon, once decoded (null before). For tooling; never log its strings. */
    get canon() {
      return canon;
    },
    get active() {
      return active;
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
var STICK_DEAD_PX = 26;
function createTouchMove(dispatch) {
  let id = null, ax = 0, ay = 0, dc = 0, dr = 0, pushed = false, tappable = true;
  return {
    /** Whose finger is on the stick, or null. */
    get pointer() {
      return id;
    },
    /** The held direction, polled each frame, or null at centre / with no finger. */
    hold() {
      return id !== null && (dc || dr) ? { dc, dr } : null;
    },
    /**
     * A finger lands. The stick can be planted anywhere on the stage -- the
     * board, the FIRE button mid-charge, the dead space -- but only a finger
     * that landed on the board can be a tap on a square when it lifts: a
     * lift on FIRE is FIRE's business.
     */
    down(src, x, y, canTap = true) {
      if (src === void 0) return false;
      if (id !== null && !(canTap && !pushed && !tappable)) return false;
      id = src;
      ax = x;
      ay = y;
      dc = 0;
      dr = 0;
      pushed = false;
      tappable = canTap;
      return true;
    },
    move(src, x, y) {
      if (id === null || src !== id) return false;
      const dx = x - ax, dy = y - ay;
      const d = Math.hypot(dx, dy);
      let ndc = 0, ndr = 0;
      if (d >= STICK_DEAD_PX) {
        pushed = true;
        if (Math.abs(dx) >= Math.abs(dy)) ndc = Math.sign(dx);
        else ndr = Math.sign(dy);
      }
      dc = ndc;
      dr = ndr;
      return pushed;
    },
    /** Lift: a board finger that never pushed the stick was a tap on a square. */
    up(src, x, y) {
      if (id === null || src !== id) return false;
      const wasTap = !pushed && tappable;
      id = null;
      dc = 0;
      dr = 0;
      if (wasTap) dispatch({ type: "tapAt", x, y });
      return wasTap;
    },
    /** The pointer went away without a proper lift: no tap, and the stick centres. */
    cancel(src) {
      if (id === null || src !== void 0 && src !== id) return false;
      id = null;
      dc = 0;
      dr = 0;
      return true;
    }
  };
}
function createInput({ win, host, root, els, on, dispatch, onGesture, onMute, modes, onModeChange }) {
  const doc = host && host.ownerDocument || win.document;
  const latch = createFireLatch(dispatch);
  const modeList = modes && modes.length ? modes : [{ id: "onehand" }];
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
  let controls = "pad";
  let tapMove = false;
  const touch = () => controls === "touch";
  for (const triggerEl of [els.cv, els.fireBtn]) {
    on(triggerEl, "pointerdown", (e) => {
      e.preventDefault();
      onGesture();
      if (triggerEl === els.cv && tapMove) return;
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
  const mover = createTouchMove(dispatch);
  const stagePt = (e) => {
    const r = els.cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  on(els.bwRoot, "pointerdown", (e) => {
    if (!tapMove) return;
    if (!els.splash.classList.contains("hidden")) return;
    const onBoard = e.target === els.cv;
    if (!onBoard && !touch()) return;
    if (onBoard) {
      try {
        els.cv.setPointerCapture(e.pointerId);
      } catch (err) {
      }
    }
    mover.down(e.pointerId, ...stagePt(e), onBoard);
  });
  on(els.bwRoot, "pointermove", (e) => {
    if (mover.pointer !== e.pointerId) return;
    e.preventDefault();
    mover.move(e.pointerId, ...stagePt(e));
  });
  on(els.bwRoot, "pointerup", (e) => {
    if (mover.pointer === e.pointerId) mover.up(e.pointerId, ...stagePt(e));
  });
  on(els.bwRoot, "pointercancel", (e) => mover.cancel(e.pointerId));
  on(els.cv, "lostpointercapture", (e) => mover.cancel(e.pointerId));
  on(win, "blur", () => mover.cancel());
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
    // whichever surface is live: the ring in pad modes, the board's stick in one-hand
    hold: () => padState.id !== null && (padState.dc || padState.dr) ? { dc: padState.dc, dr: padState.dr } : mover.hold(),
    focus: focusStage,
    /** Switch the scheme for the run that just started; ends any drag in progress. */
    setControls(next, opts = {}) {
      controls = next === "touch" ? "touch" : "pad";
      tapMove = !!opts.tapMove;
      mover.cancel();
      padEnd(null);
    }
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
    if (!e.cancelable || onSplash(e.target)) return;
    e.preventDefault();
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

// src/shell/painters.js
var SKINS = {
  mett: { dome: "#ffd23f", stripe: "#c9992a" },
  guard: { dome: "#aeb9d6", stripe: "#6c7794" },
  hopper: { dome: "#5ee87c", stripe: "#1f7c3d" },
  ally: { dome: "#58c7ff", stripe: "#2a7ab8" },
  rare: { dome: "#fff3c4", stripe: "#e8a020" },
  // the later rot and static: each wears the family's hue, darker and harder
  spreader: { dome: "#ffa23f", stripe: "#a85a12" },
  warden: { dome: "#c07be0", stripe: "#5f2f7a" },
  darter: { dome: "#3fd8b0", stripe: "#12705a" },
  // the sentinel is drawn on its own path below; this is for debris and ghosts
  sentinel: { dome: "#b48cff", stripe: "#5a3f9a" }
};
var SENTINEL_CORE = { 1: "#c48cff", 2: "#ff6fd8", 3: "#ff4d4d" };
var KEEPER = { robe: "#c9b6ff", hood: "#7d63c4", face: "#fff3c4", eye: "#2b1f4a" };
var PEOPLE = {
  "npc.keeper.01": { robe: "#ffd7e0", hood: "#c45b7a", face: "#fff3c4", eye: "#3a1a26" },
  "npc.keeper.02": { robe: "#c9f6ff", hood: "#2f8fd6", face: "#fff3c4", eye: "#0f2a44" },
  "npc.keeper.03": { robe: "#e8dcc0", hood: "#7a5a2e", face: "#fff3c4", eye: "#2b1f0a" },
  "npc.keeper.04": { robe: "#ffcf9a", hood: "#a54b1e", face: "#fff3c4", eye: "#3a1a06" },
  "npc.keeper.05": { robe: "#c8ffb0", hood: "#3f9a4a", face: "#fff3c4", eye: "#0f2a12" },
  "npc.side.bean": { robe: "#e2ffd2", hood: "#6ab86f", face: "#fff3c4", eye: "#0f2a12", small: true },
  "npc.side.tally": { robe: "#dfe6f2", hood: "#5c6f8f", face: "#fff3c4", eye: "#1a2233" },
  "npc.side.vesper": { robe: "#d9d2f0", hood: "#4a4470", face: "#fff3c4", eye: "#1a1830", small: true },
  "npc.side.rivet": { robe: "#ffe0b0", hood: "#c07a2a", face: "#fff3c4", eye: "#3a1a06", small: true },
  "boss.ferryman": { robe: "#ffffff", hood: "#9fb4c8", face: "#e8f4ff", eye: "#2a3a4a" },
  "npc.sweeper.tidy": { robe: "#f0f0f0", hood: "#b5b5b5", face: "#ffffff", eye: "#444" },
  "boss.foreman": { robe: "#f4f4f4", hood: "#8a8a8a", face: "#ffffff", eye: "#444" }
};
var enemyBox = (G) => ({ bw: G.pw * 0.4, bh: G.ph * 1 });
var playerBox = (G) => ({ bw: G.pw * 0.34, bh: G.ph * 1.15 });
var keeperBox = (G, small) => {
  const s = small ? 0.72 : 1;
  return { w: G.pw * 0.3 * s, h: G.ph * 1 * s };
};
var itemBox = (G) => ({ w: G.pw * 0.36, h: G.ph * 0.3 });
var pickupRadius = (G) => Math.min(G.pw, G.ph) * 0.16;
var SENTINEL_OPEN_FRAMES = 6;
var irisGap = (frame) => 0.18 + 0.5 * (1 - (frame + 0.5) / SENTINEL_OPEN_FRAMES);
function blend(fg, bg, a) {
  const f = parseInt(fg.slice(1), 16), b = parseInt(bg.slice(1), 16);
  const ch = (sh) => Math.round((f >> sh & 255) * a + (b >> sh & 255) * (1 - a));
  return "#" + [16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("");
}
function paintEnemy(ctx, { bw, bh }, type) {
  const skin = SKINS[type] || SKINS.mett;
  ctx.fillStyle = skin.dome;
  ctx.beginPath();
  ctx.arc(0, -bh * 0.42, bw * 0.55, Math.PI, 0);
  ctx.lineTo(bw * 0.55, -bh * 0.1);
  ctx.lineTo(-bw * 0.55, -bh * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = skin.stripe;
  ctx.fillRect(-bw * 0.08, -bh * 0.98, bw * 0.16, bh * 0.5);
  if (type === "guard") {
    ctx.fillStyle = "#6c7794";
    ctx.fillRect(-bw * 0.55, -bh * 0.34, bw * 1.1, bh * 0.1);
    ctx.fillStyle = "#232c42";
    ctx.fillRect(-bw * 0.42, -bh * 0.24, bw * 0.84, bh * 0.12);
  } else if (type === "ally") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-bw * 0.42, -bh * 0.36, bw * 0.84, bh * 0.26);
    ctx.fillStyle = "#2a7ab8";
    ctx.fillRect(-bw * 0.06, -bh * 0.34, bw * 0.12, bh * 0.22);
    ctx.fillRect(-bw * 0.24, -bh * 0.28, bw * 0.48, bh * 0.1);
  } else if (type === "spreader") {
    ctx.fillStyle = "#232c42";
    ctx.fillRect(-bw * 0.46, -bh * 0.34, bw * 0.92, bh * 0.24);
    ctx.fillStyle = "#ffd7a8";
    for (const dx of [-0.32, -0.06, 0.2]) ctx.fillRect(bw * dx, -bh * 0.3, bw * 0.12, bh * 0.16);
  } else if (type === "warden") {
    ctx.fillStyle = "#232c42";
    ctx.fillRect(-bw * 0.5, -bh * 0.34, bw * 1, bh * 0.24);
    ctx.fillStyle = "#f0d7ff";
    ctx.fillRect(-bw * 0.38, -bh * 0.29, bw * 0.76, bh * 0.13);
  } else if (type === "darter") {
    ctx.fillStyle = "#232c42";
    ctx.fillRect(-bw * 0.42, -bh * 0.34, bw * 0.84, bh * 0.24);
    ctx.fillStyle = "#d8fff4";
    ctx.fillRect(-bw * 0.16, -bh * 0.3, bw * 0.1, bh * 0.14);
    ctx.fillRect(bw * 0.06, -bh * 0.3, bw * 0.1, bh * 0.14);
  } else {
    ctx.fillStyle = "#232c42";
    ctx.fillRect(-bw * 0.42, -bh * 0.34, bw * 0.84, bh * 0.24);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-bw * 0.26, -bh * 0.3, bw * 0.12, bh * 0.14);
    ctx.fillRect(bw * 0.14, -bh * 0.3, bw * 0.12, bh * 0.14);
  }
}
function paintSentinel(ctx, { bw, bh }, tier, openFrame) {
  const open = openFrame !== null && openFrame !== void 0;
  const core = SENTINEL_CORE[tier] || SENTINEL_CORE[1];
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
  const gap = open ? irisGap(openFrame) : 0.04;
  const half = R * 0.62;
  ctx.fillStyle = blend(core, "#3a3452", open ? 0.92 : 0.25);
  ctx.beginPath();
  ctx.arc(0, cy, half * 0.62, 0, Math.PI * 2 - RING_GAP);
  ctx.fill();
  ctx.fillStyle = "#1a1728";
  ctx.fillRect(-half, cy - half, half * 2, half * (1 - gap));
  ctx.fillRect(-half, cy + half * gap, half * 2, half * (1 - gap));
  ctx.fillStyle = core;
  for (let i = 0; i < (tier || 1); i++) ctx.fillRect(-bw * 0.26 + i * bw * 0.16, cy + R * 0.7, bw * 0.1, 3);
}
function paintPlayer(ctx, { bw, bh }, full) {
  ctx.fillStyle = "#4f8dff";
  ctx.fillRect(-bw / 2, -bh, bw, bh);
  ctx.fillStyle = "#2f5fc4";
  ctx.fillRect(-bw / 2, -bh, bw, bh * 0.28);
  ctx.fillStyle = "#c9f6ff";
  ctx.fillRect(-bw * 0.28, -bh * 0.62, bw * 0.56, bh * 0.14);
  const rayY = -bh * 0.42;
  ctx.fillStyle = full ? "#fff3c4" : "#ffd23f";
  ctx.fillRect(bw / 2 - 2, rayY - 5, bw * 0.55, 10);
}
function paintKeeper(ctx, { w, h }, look, frame = 0) {
  const dy = frame ? 1 : 0;
  ctx.fillStyle = look.robe;
  ctx.fillRect(-w / 2, -h + dy, w, h - dy);
  ctx.fillStyle = look.hood;
  ctx.fillRect(-w * 0.6, -h - h * 0.12 + dy, w * 1.2, h * 0.42);
  ctx.fillStyle = look.face;
  ctx.fillRect(-w * 0.32, -h + h * 0.06 + dy, w * 0.64, h * 0.2);
  ctx.fillStyle = look.eye;
  ctx.fillRect(-w * 0.2, -h + h * 0.12 + dy, 3, 3);
  ctx.fillRect(w * 0.2 - 3, -h + h * 0.12 + dy, 3, 3);
}
function paintItem(ctx, { w, h }) {
  ctx.fillStyle = "#2a2226";
  ctx.fillRect(-w * 0.6, h * 0.5, w * 1.2, 4);
  ctx.fillStyle = "#6b4a3a";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = "#c9b18f";
  ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
  ctx.fillStyle = "#3a2a22";
  ctx.fillRect(-w / 2 + 6, -1, w * 0.5, 2);
  ctx.fillRect(-w / 2 + 6, 4, w * 0.35, 2);
}
function paintPickup(ctx, r, frame = 0) {
  ctx.fillStyle = "#1a1f33";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2 - RING_GAP);
  ctx.fill();
  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 0.4, -r * 0.8);
  ctx.lineTo(r * 1.1, -r * 1.6);
  ctx.stroke();
  ctx.fillStyle = frame ? "#ffffff" : "#ff5470";
  ctx.fillRect(r * 1, -r * 1.8, 3, 3);
}
var SHARD_LOOK = {
  spell: { body: "#c9f6ff", edge: "#4f8dff" },
  footnote: { body: "#ffe08a", edge: "#e8a020" },
  sock: { body: "#a9defc", edge: "#2a7ab8" },
  weather: { body: "#a6f5bb", edge: "#1f7c3d" },
  bell: { body: "#f0d7ff", edge: "#5f2f7a" }
};
function paintShard(ctx, r, look, frame = 0) {
  ctx.fillStyle = look.edge;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.25);
  ctx.lineTo(r * 0.85, -r * 0.2);
  ctx.lineTo(0, r * 1.05);
  ctx.lineTo(-r * 0.85, -r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.body;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.9);
  ctx.lineTo(r * 0.5, -r * 0.18);
  ctx.lineTo(0, r * 0.7);
  ctx.lineTo(-r * 0.5, -r * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = frame ? "#ffffff" : look.edge;
  ctx.fillRect(-r * 0.16, -r * 0.62, r * 0.3, r * 0.36);
}
var ceil = Math.ceil;
function manifestFor(G) {
  const ents = {};
  const eb = enemyBox(G), pb = playerBox(G), ib = itemBox(G), pr = pickupRadius(G);
  const bodyCell = (halfW, up, down) => ({ w: 2 * ceil(halfW) + 4, h: ceil(up) + ceil(down) + 4, ax: ceil(halfW) + 2, ay: ceil(up) + 2 });
  for (const type of ["mett", "guard", "hopper", "ally", "rare", "spreader", "warden", "darter"]) {
    ents["enemy." + type] = {
      cell: bodyCell(eb.bw * 0.62, eb.bh * 1, 0),
      states: { up: { frames: 1, ms: 0 } },
      paint: (ctx) => paintEnemy(ctx, eb, type)
    };
  }
  for (const tier of [1, 2, 3]) {
    ents["sentinel." + tier] = {
      cell: bodyCell(eb.bw * 0.7, eb.bh * 0.44 + eb.bw * 0.62 + 2, 0),
      // the open frames follow the spell, not the clock: the renderer picks one
      states: { closed: { frames: 1, ms: 0 }, open: { frames: SENTINEL_OPEN_FRAMES, ms: 0, byPhase: true } },
      paint: (ctx, frame, st) => paintSentinel(ctx, eb, tier, st === "open" ? frame : null)
    };
  }
  ents.player = {
    cell: { w: ceil(pb.bw / 2) + ceil(pb.bw / 2 + pb.bw * 0.55) + 4, h: ceil(pb.bh) + 4, ax: ceil(pb.bw / 2) + 2, ay: ceil(pb.bh) + 2 },
    states: { idle: { frames: 1, ms: 0 }, charged: { frames: 1, ms: 0 } },
    paint: (ctx, frame, st) => paintPlayer(ctx, pb, st === "charged")
  };
  const people = { default: KEEPER, ...PEOPLE };
  for (const [id, look] of Object.entries(people)) {
    const kb = keeperBox(G, look.small);
    ents["keeper." + id] = {
      cell: bodyCell(kb.w * 0.6, kb.h * 1.12, 1),
      states: { idle: { frames: 2, ms: 700 } },
      paint: (ctx, frame) => paintKeeper(ctx, kb, look, frame)
    };
  }
  ents["item.journal"] = {
    cell: { w: 2 * ceil(ib.w * 0.6) + 4, h: ceil(ib.h / 2) + ceil(ib.h * 0.5 + 4) + 4, ax: ceil(ib.w * 0.6) + 2, ay: ceil(ib.h / 2) + 2 },
    states: { idle: { frames: 1, ms: 0 } },
    paint: (ctx) => paintItem(ctx, ib)
  };
  ents["pickup.bomb"] = {
    cell: { w: 2 * ceil(pr * 1.3) + 6, h: ceil(pr * 1.9) + ceil(pr) + 6, ax: ceil(pr * 1.3) + 3, ay: ceil(pr * 1.9) + 3 },
    states: { idle: { frames: 2, ms: 120 } },
    paint: (ctx, frame) => paintPickup(ctx, pr, frame)
  };
  for (const [kind, look] of Object.entries(SHARD_LOOK)) {
    ents["pickup." + kind] = {
      cell: { w: 2 * ceil(pr * 0.9) + 4, h: ceil(pr * 1.3) + ceil(pr * 1.1) + 4, ax: ceil(pr * 0.9) + 2, ay: ceil(pr * 1.3) + 2 },
      states: { idle: { frames: 2, ms: 120 } },
      paint: (ctx, frame) => paintShard(ctx, pr, look, frame)
    };
  }
  return { pw: G.pw, ph: G.ph, entities: ents };
}
function frameAt(spec, now) {
  if (!spec || spec.frames <= 1 || !spec.ms) return 0;
  return Math.floor(now / spec.ms) % spec.frames;
}

// src/shell/render.js
var ART = null;
function body(ctx, id, st, frame, painter) {
  if (ART && ART.paint(ctx, id, st, frame)) return;
  painter(ctx);
}
var { EASE: EASE2, impulseValue: impulseValue2, TAU: TAU2, RING_GAP: RING_GAP2 } = constants_exports;
var panel2 = (G, col, row) => panelRect(G, col, row);
var MONO = "px ui-monospace, Menlo, Consolas, monospace";
var font = (weight, size) => weight + " " + size + MONO;
var PANELS = { mine: ["#3a2330", "#7c3652"], theirs: ["#1e2c4d", "#35528f"] };
var PANELS_OC = { mine: ["#40252c", "#95483f"], theirs: ["#2b2a35", "#7b5733"] };
var ROAD = ["#121828", "#243050"];
var ROAD_DASH = "#34416a";
var TOWER = ["#2a2436", "#5a4a6e"];
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
function draw(ctx, state, now, art = null) {
  const G = state.G;
  const rm = !!state.reducedMotion;
  ART = art;
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
  ART = null;
}
function drawPickups(ctx, state, now) {
  const G = state.G;
  for (const pk of state.pickups || []) {
    const p = panel2(G, pk.col, pk.row);
    const cx = p.x + p.w / 2, cy = p.y + p.h * 0.5 + Math.sin(now / 260) * 3;
    const r = pickupRadius(G);
    const shard = SHARD_LOOK[pk.kind];
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(now / 180);
    ctx.fillStyle = shard ? shard.body : "#ff9f45";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2 - RING_GAP);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    const f = frameAt({ frames: 2, ms: 120 }, now);
    if (shard) body(ctx, "pickup." + pk.kind, "idle", f, (c) => paintShard(c, r, shard, f));
    else body(ctx, "pickup.bomb", "idle", f, (c) => paintPickup(c, r, f));
    ctx.restore();
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
    const q = Math.min(1, (now - bl.t0) / state.tuning.BOMB_BLAST_MS);
    const R = state.tuning.BOMB_RADIUS;
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
  const oc = state.deletions >= state.tuning.OC_START;
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
      const seg = segmentAt(world, c);
      const onTower = seg && seg.kind === "tower";
      const [fill, edge] = road ? ROAD : onTower ? TOWER : t === TILE.PLAYER ? skin.mine : skin.theirs;
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
      if (t === TILE.NPC) {
        const who = npcAt(world, c, r);
        if (who && who.verb === "read") drawItem(ctx, p, now, state, c, r);
        else drawKeeper(ctx, p, now, state, c, r, PEOPLE[who && who.id] || KEEPER, who && PEOPLE[who.id] ? who.id : "default");
      }
      if (t !== TILE.ENEMY && c === state.player.col && r === state.player.row) {
        ctx.strokeStyle = "#45e0e8";
        ctx.strokeRect(p.x + 5, p.y + 5, p.w - 10, p.h - 10);
      }
    }
  }
  drawRipples(ctx, state, now);
}
function drawKeeper(ctx, p, now, state, col, row, look = KEEPER, id = "default") {
  const cx = p.x + p.w / 2;
  const base = p.y + p.h * 0.8;
  const kb = keeperBox(state.G, look.small);
  const f = Math.floor(now / 700 + col) % 2;
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(base));
  body(ctx, "keeper." + id, "idle", f, (c) => paintKeeper(c, kb, look, f));
  ctx.restore();
  const beside = Math.abs(state.player.col - col) + Math.abs(state.player.row - row) === 1;
  if (beside) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 220);
    ctx.fillStyle = "#45e0e8";
    const y = p.y - 6 - 3 * Math.abs(Math.sin(now / 320));
    ctx.beginPath();
    ctx.moveTo(cx - 6, y - 8);
    ctx.lineTo(cx + 6, y - 8);
    ctx.lineTo(cx, y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
function drawItem(ctx, p, now, state, col, row) {
  const cx = p.x + p.w / 2, cy = p.y + p.h * 0.62;
  const ib = itemBox(state.G);
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));
  body(ctx, "item.journal", "idle", 0, (c) => paintItem(c, ib));
  ctx.restore();
  const beside = Math.abs(state.player.col - col) + Math.abs(state.player.row - row) === 1;
  if (beside) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 220);
    ctx.fillStyle = "#45e0e8";
    const y = p.y - 6 - 3 * Math.abs(Math.sin(now / 320));
    ctx.beginPath();
    ctx.moveTo(cx - 6, y - 8);
    ctx.lineTo(cx + 6, y - 8);
    ctx.lineTo(cx, y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
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
  const fallbackAim = state.tuning.aimMs(state.deletions);
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
  const pose = hopPose(state, now);
  const p = panel2(G, pose.col, pose.row);
  const eRecoil = impulseValue2(state.fx.recoil, now);
  const rx = -state.fx.recoil.spec.px * eRecoil;
  const pb = playerBox(G);
  const bw = pb.bw * pose.sx, bh = pb.bh * pose.sy;
  const cx = p.x + p.w / 2 + rx;
  const baseY = p.y + p.h * 0.78 - pose.lift * G.ph * 0.55;
  const coreY = baseY - bh * 0.5;
  const cdn = state.charge.downAt;
  const charging = cdn !== null && state.mode === "playing";
  const held = charging ? now - cdn : 0;
  const prog = charging ? Math.min(1, held / state.tuning.CHARGE_MS) : 0;
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
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(baseY));
  if (pose.sx !== 1 || pose.sy !== 1) ctx.scale(pose.sx, pose.sy);
  const full = !!state.charge.full;
  body(ctx, "player", full ? "charged" : "idle", 0, (c) => paintPlayer(c, pb, full));
  ctx.restore();
  const rayY = baseY - bh * 0.42;
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
  drawStepRation(ctx, state, now, panel2(G, state.player.col, state.player.row));
  return { rayY, busterX: cx + bw / 2 + bw * 0.55 };
}
function drawStepRation(ctx, state, now, p) {
  const mode = modeById(state.modeId);
  if (mode.controls !== "touch" || state.mode !== "playing") return;
  const ms = mode.hop ? state.tuning.TAP_MOVE_MS : state.tuning.MOVE_REPEAT_MS;
  const t = now - state.lastMoveAt;
  if (t >= 0 && t < ms) {
    const frac = t / ms;
    const x0 = p.x + 6, w = p.w - 12, y = p.y + p.h - 5;
    ctx.fillStyle = "rgba(79,141,255,0.25)";
    ctx.fillRect(x0, y, w, 2);
    ctx.fillStyle = "#4f8dff";
    ctx.fillRect(x0, y, w * frac, 2);
  }
  const q = state.path || (state.queuedMove && state.queuedMove.kind === "to" ? state.queuedMove : null);
  if (q) {
    const tp = panel2(state.G, q.col, q.row);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -(now / 40) % 9;
    ctx.strokeStyle = "rgba(201,246,255,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(tp.x + 6, tp.y + 6, tp.w - 12, tp.h - 12);
    ctx.restore();
  }
}
function drawEnemy(ctx, state, now, e) {
  const G = state.G;
  const p = panel2(G, e.col, e.row);
  const t = now - e.t0;
  const { bw, bh } = enemyBox(G);
  let cx = p.x + p.w / 2;
  const baseY = p.y + p.h * 0.78;
  let grow = 1, sx = 1, sy = 1, flash = 0;
  if (e.state === "rising") grow = EASE2.out2(Math.min(1, t / (e.riseMs || state.tuning.RISE_MS)));
  else if (e.state === "sinking") grow = 1 - EASE2.out2(t / state.tuning.SINK_MS);
  else if (e.state === "hit") {
    const tier = e.tier;
    const uniform = 1 + (tier.scale.peak - 1) * impulseValue2(e.fx.scale, now);
    const sqy = 1 + tier.squash.amt * impulseValue2(e.fx.squash, now);
    sx = uniform / sqy;
    sy = uniform * sqy;
    cx += tier.kick.px * impulseValue2(e.fx.kick, now);
    flash = t < 0 ? 0 : Math.max(0, 1 - t / 70);
    grow = Math.min(1, 1 - Math.max(0, (t - state.tuning.HIT_MS * 0.55) / (state.tuning.HIT_MS * 0.45)));
  }
  const ht = now - e.hopT0;
  if (e.state === "up" && ht < state.tuning.HOP_GROW_MS) grow *= EASE2.out2(ht / state.tuning.HOP_GROW_MS);
  if (grow <= 0) return;
  const skin = SKINS[e.type];
  if (e.state === "up" && e.hopFromCol !== void 0 && ht >= 0 && ht < state.tuning.HOP_GROW_MS * 2) {
    const from = panel2(G, e.hopFromCol, e.hopFromRow);
    const k = 1 - ht / (state.tuning.HOP_GROW_MS * 2);
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
  ctx.translate(Math.round(cx), Math.round(baseY));
  ctx.scale(sx, sy * grow);
  ctx.globalAlpha = e.state === "hit" ? grow : 1;
  if (e.type === "sentinel") {
    const open = e.state === "up" && !e.fired;
    const cfg = state.tuning.SENTINEL[e.tier] || state.tuning.SENTINEL[1];
    const q = open ? Math.min(1, (now - e.t0) / cfg.openMs) : 0;
    const f = open ? Math.min(SENTINEL_OPEN_FRAMES - 1, Math.floor(q * SENTINEL_OPEN_FRAMES)) : 0;
    const tier = e.tier || 1;
    body(ctx, "sentinel." + tier, open ? "open" : "closed", f, (c) => paintSentinel(c, { bw, bh }, tier, open ? f : null));
    ctx.restore();
    return;
  }
  body(ctx, "enemy." + e.type, "up", 0, (c) => paintEnemy(c, { bw, bh }, e.type));
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
  if (e.type === "hopper" || e.type === "darter") return BLASTS.hopper;
  if (e.type === "spreader" || e.type === "warden") return BLASTS.guard;
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
  if (left > 0 && left <= state.tuning.HIT_IFRAME_MS && state.mode === "playing") {
    const k = left / state.tuning.HIT_IFRAME_MS;
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
  if (del <= 0 || state.tuning.level(del) === state.tuning.level(del - 1)) return -Infinity;
  const d = lastDeletion(state);
  return d ? d.at : -Infinity;
}
function pipLayout(G, t) {
  const w = G.w - PAD * 2;
  let L = null;
  for (let i = 0; i < PIP_LADDER.length; i++) {
    const secs = PIP_LADDER[i];
    const n = Math.max(1, Math.round(t.TIME_CAP / secs));
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
  const L = pipLayout(state.G, state.tuning);
  const y = PIP_Y, h = PIP_H;
  const playing = hud.mode === "playing";
  const low = hud.timeLeft < state.tuning.LOW_TIME && playing;
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
    const lost = state.tuning.HIT_TIME_PENALTY / L.secs;
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
      filled + state.tuning.BONUS.normal * hud.overclockFactor / L.secs,
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
    const reached = CHAIN_TIERS.filter((c) => c <= hud.chain);
    const lo = reached[reached.length - 1] || 0;
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
  const low = hud.timeLeft < state.tuning.LOW_TIME;
  if (hud.mode === "playing" && !hud.paused && low && !hud.safe) {
    const urg = 1 - Math.max(0, hud.timeLeft) / state.tuning.LOW_TIME;
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

// src/shell/art.js
function createArt({ makeCanvas }) {
  let manifest = null;
  let key = "";
  let dpr = 1;
  let cells = /* @__PURE__ */ new Map();
  let external = null;
  let externalCells = /* @__PURE__ */ new Map();
  const cellKey = (id, st, frame) => id + "/" + st + "/" + frame;
  function ensure(G, deviceScale = 1) {
    const k = G.pw + "|" + G.ph + "|" + deviceScale;
    if (k === key) return;
    key = k;
    dpr = deviceScale;
    manifest = manifestFor(G);
    cells = /* @__PURE__ */ new Map();
    for (const [id, ent] of Object.entries(manifest.entities)) {
      for (const [st, spec] of Object.entries(ent.states)) {
        for (let f = 0; f < spec.frames; f++) {
          const { w, h, ax, ay } = ent.cell;
          const cv = makeCanvas(Math.ceil(w * dpr), Math.ceil(h * dpr));
          const c = cv.getContext("2d");
          c.setTransform(dpr, 0, 0, dpr, 0, 0);
          c.translate(ax, ay);
          ent.paint(c, f, st);
          cells.set(cellKey(id, st, f), { canvas: c.canvas || cv, w, h, ax, ay });
        }
      }
    }
    if (external) cutExternal();
  }
  function cutExternal() {
    externalCells = /* @__PURE__ */ new Map();
    if (!external || !manifest) return;
    const { manifest: m, image } = external;
    for (const [id, ent] of Object.entries(m.entities || {})) {
      const local = manifest.entities[id];
      if (!local) continue;
      for (const [st, spec] of Object.entries(ent.states || {})) {
        if (!local.states[st]) continue;
        for (let f = 0; f < spec.frames.length; f++) {
          const src = spec.frames[f];
          const { w, h, ax, ay } = local.cell;
          const cv = makeCanvas(Math.ceil(w * dpr), Math.ceil(h * dpr));
          const c = cv.getContext("2d");
          c.setTransform(dpr, 0, 0, dpr, 0, 0);
          const sx = w / src.w, sy = h / src.h;
          c.imageSmoothingEnabled = !!m.smooth;
          c.drawImage(image, src.x, src.y, src.w, src.h, ax - src.ax * sx, ay - src.ay * sy, src.w * sx, src.h * sy);
          externalCells.set(cellKey(id, st, f), { canvas: c.canvas || cv, w, h, ax, ay });
        }
      }
    }
  }
  return {
    ensure,
    get manifest() {
      return manifest;
    },
    get pack() {
      return external ? external.manifest.name || "external" : "procedural";
    },
    /** Use a loaded pack: { manifest, image }. Cells it lacks keep pack zero. */
    applyPack(pack) {
      external = pack;
      cutExternal();
    },
    /** Back to pack zero. */
    clearPack() {
      external = null;
      externalCells = /* @__PURE__ */ new Map();
    },
    /** The frame to show for a state at `now`, from the manifest's timing. */
    frame(id, st, now) {
      const ent = manifest && manifest.entities[id];
      return frameAt(ent && ent.states[st], now);
    },
    /**
     * Draw a cell with its anchor at the current origin. Falls back to the
     * painter when the pack has no such cell, drawing the same pixels.
     */
    paint(ctx, id, st, frame = 0) {
      const k = cellKey(id, st, frame);
      const cell = externalCells.get(k) || cells.get(k);
      if (cell) {
        ctx.drawImage(cell.canvas, -cell.ax, -cell.ay, cell.w, cell.h);
        return true;
      }
      const ent = manifest && manifest.entities[id];
      if (ent) {
        ent.paint(ctx, frame, st);
        return true;
      }
      return false;
    },
    /** For tooling: the baked cells, by key. Never needed to draw. */
    get cells() {
      return cells;
    }
  };
}
async function loadArtPack(baseUrl, { fetchJson, loadImage }) {
  try {
    const base = baseUrl.replace(/\/?$/, "/");
    const manifest = await fetchJson(base + "manifest.json");
    if (!manifest || !manifest.entities) return null;
    const image = await loadImage(base + (manifest.atlas || "atlas.png"));
    return image ? { manifest, image } : null;
  } catch (e) {
    return null;
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
  const art = createArt({ makeCanvas: (w, h) => {
    const c = doc.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  } });
  if (options.artUrl) {
    loadArtPack(options.artUrl, {
      fetchJson: (u) => win.fetch(u, { cache: "no-cache" }).then((r) => r.ok ? r.json() : null),
      loadImage: (u) => new Promise((res) => {
        const im = new win.Image();
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = u;
      })
    }).then((pack) => {
      if (pack && !destroyed) art.applyPack(pack);
    });
  }
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
  const state = createState({ seed, best, reducedMotion: !!(motionQuery && motionQuery.matches), tuning: options.tuning });
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
    setLayout(state, r.width, r.height, deckInset(els));
    placeTouchControls(els, state.G);
    art.ensure(state.G, dpr);
  }
  setControls(els, modeById(state.modeId).controls);
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
  let verb = "bomb";
  function refreshStats() {
    renderStats(els, statsView(state));
    renderBombs(els, state.bombs || 0, verb, stashView(state.stash || []));
  }
  const story = createStory({
    say: (who, text) => renderSay(els, who, text),
    hush: () => renderSay(els, "", ""),
    place: (text) => renderPlace(els, text),
    // never the text; only that it could not be opened, and why
    onError: (e) => {
      try {
        win.console.warn("buster-whack: canon unavailable:", e && e.message);
      } catch (err) {
      }
    }
  });
  function showInterlevel(ev) {
    const v = interlevelView(state, ev.stage, ev.timeBonus === void 0 ? state.tuning.STAGE_BONUS : ev.timeBonus);
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
  function applyControls(modeId) {
    const mode = modeById(modeId);
    setControls(els, mode.controls);
    input.setControls(mode.controls, { tapMove: !!mode.tapMove });
    resize();
  }
  function handleEvent(ev) {
    switch (ev.type) {
      case "statsChanged":
        refreshStats();
        break;
      case "runStarted":
        hideOverlay(els);
        applyControls(ev.modeId);
        break;
      case "resumed":
        hideOverlay(els);
        break;
      case "bombEmpty":
        denyBomb(els);
        break;
      case "talk": {
        const ctxv = contextVerb(state);
        verb = ctxv.npc && story.label(ctxv.npc) || ctxv.verb;
        refreshStats();
        break;
      }
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
    story.handleAll(events);
    for (const ev of events) handleEvent(ev);
    const ctxv = contextVerb(state);
    if (story.open && (ctxv.verb === "bomb" || story.label(ctxv.npc) === null)) story.leave();
    const cv = ctxv.npc && story.label(ctxv.npc) || ctxv.verb;
    if (cv !== verb) {
      verb = cv;
      refreshStats();
    }
    audio.observe(hudView(state), state.charge.downAt !== null, state.charge.full);
    draw(ctx, state, state.clock, art);
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
  function setTuning(overrides) {
    if (state.mode === "playing" || state.mode === "interlevel") return false;
    state.tuning = resolveTuning(overrides);
    return true;
  }
  return { destroy, setTuning, get tuningVersion() {
    return state.tuning.version;
  }, get artPack() {
    return art.pack;
  } };
}
var mount_default = mountBusterWhack;
export {
  mount_default as default,
  mountBusterWhack
};
/*!
 * The enemy table: every virus as data, and the attacks they use.
 *
 * One entry per type says what the thing *is* — how many hits it takes, how
 * long it stays up, whether it moves, whether it shoots and with what, what
 * armour it wears and what it is worth. The numbers behind those answers are
 * tuning (see tuning.js); this table names which of them each type reads, so
 * a new virus is a row here plus its numbers there, not a new branch in five
 * files.
 *
 * Attacks are their own vocabulary. An attack is a list of shots, each with a
 * row offset and a delay, and optional factors on the bolt's speed and size.
 * That is enough for every pattern the game fires: a single bolt, a fan across
 * three lanes, a two-shot volley down one, or a slow fat wall.
 *
 * Pure module. No DOM, no clock, no randomness.
 */
/*!
 * Tuning tables, ramp functions and layout math.
 *
 * Pure module: numbers in, numbers out. No DOM, no audio, no randomness,
 * no clock. Everything the game is balanced around lives here so the ramps
 * can be read (and tested) without booting the shell.
 */
/*!
 * Tuning: every number the game is balanced on, as data.
 *
 * `TUNING_SCHEMA` names each value with its default, its bounds, its unit
 * and what it does. `resolveTuning(overrides)` turns a bag of overrides into
 * the object the simulation reads from `state.tuning`: the scalars, the
 * small tables assembled from them (bolt kinds, sentinel marks, unlock
 * arenas), and the ramp functions bound to them. With no overrides the
 * result is exactly the numbers the game shipped with, so every golden and
 * every determinism test holds.
 *
 * Structural constants (board size, tile kinds, layout math) and presentation
 * data (colours, fx lifetimes, shake) stay in `constants.js`: they are not
 * balance. Content (the route, who stands on which tower) is not tuning
 * either; it will be a document of its own.
 *
 * Pure module. No DOM, no clock, no randomness.
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
 * Bonus tasks: a thing to do on the road, asked for by the people on the
 * towers, paid out when you have done it.
 *
 * A task is data: an id, the plain sentence the player reads, the counter it
 * watches and how much of it is wanted, and what it pays. Progress is counted
 * from the moment the task was taken -- the baseline is snapshotted then --
 * so nothing can be claimed by walking up with it already done.
 *
 * The core owns the counters and the ledger; the shell decides when someone
 * says any of it out loud. The text here is the player's instructions, not
 * canon: plain, mechanical, and safe to read in a reply.
 *
 * Pure module. No DOM, no clock, no randomness.
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
 * Juice authoring. The core owns the fx *data*; `render.js` only reads it.
 * Every random number here comes from `state.rng`, so a seed still
 * reproduces a run frame for frame, debris included.
 */
/*!
 * Items: what you can be carrying, and what it does when you use it.
 *
 * The stash is one list with a capacity in slots. The bomb is the first item
 * and the five shards are the rest, named and costed by the bible; each row
 * here names an effect from the vocabulary below, and the core applies it.
 * The context button uses the top of the stash -- the last thing you picked
 * up -- so what a press will do is always the thing the HUD shows on top.
 *
 * Effects, as a small closed vocabulary:
 *
 *   blast        the bomb: an arc onto a panel ahead, splashing a 3x3
 *   parry        the next bolt that would land on you does not
 *   cloak        nothing aims at you for a while
 *   provoke      everything armed on the board fires this instant
 *   summon       one virus of a named type arrives in your row
 *   echo         your last shot is taken again, for a share of its worth
 *
 * Pure module. No DOM, no clock, no randomness.
 */
/*!
 * Movement: the step ration, the hop, paths, taps, and landing on a square.
 * The world decides where you may stand; this decides when and how you get
 * there.
 */
/*!
 * The counters the bonus tasks watch. One function, called from the places
 * where the thing being counted actually happens, so no module has to learn
 * the task table to keep it fed.
 *
 * Pure module. No DOM, no clock, no randomness.
 */
/*!
 * Pure selectors — the view model the renderer, the HUD and the overlays read.
 * Never mutates state.
 */
/*!
 * Run flow: fire presses, pause, a run's start and end, the arcade's stage
 * gates and cards, and the world watcher that notices you stepping into an
 * arena or onto a tower and eases the camera.
 */
/*!
 * Waves and viruses: composing a wave, dealing an arena's pool, spawning,
 * the up-state (aim, hop, re-arm), and the wave ending into a lull or a
 * taken arena.
 */
/*!
 * Combat: the buster shot, bolts in flight, the bomb, damage to viruses and
 * to the player, and the chain.
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
 * decoder.js — pure, parameterised unsealing of MESH VAULT containers.
 *
 * No secrets live here. The method parameters are injected by unseal.js.
 * Byte-identical with canon/tools/vaultkit.py; if you change one, change both.
 * Needs `crypto.subtle` and `TextEncoder` (every browser, Node 18+).
 */
/*!
 * unseal.js — the curtain.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  READ BEFORE TOUCHING                                                    │
 * │                                                                          │
 * │  The array below is the vault method, stored reversed-base64. It is NOT  │
 * │  a lock. Anyone can open it in thirty seconds. It is a curtain, and the  │
 * │  whole point of a curtain is that pulling it aside is a choice you make  │
 * │  on purpose, not something that happens because you scrolled past.      │
 * │                                                                          │
 * │  The person who commissioned this game asked not to see the story until  │
 * │  the game shows it to him. If you are that person: this file is for the  │
 * │  build, not for you. Close it. The game will tell you everything, in     │
 * │  order, when it is time.                                                 │
 * │                                                                          │
 * │  If you are an agent authoring canon: use canon/tools/vaultkit.py in     │
 * │  your own session and never echo plaintext into a reply he will read.    │
 * │                                                                          │
 * │  If you are the game: call unseal(). That is the only sanctioned caller. │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
/*!
 * canon.js — the game-facing API. Loads the sealed string table, evaluates
 * reveal gates against player state, and hands the game only what it has
 * earned. Nothing here knows about the board; `src/shell/story.js` is the
 * bridge from core events to this.
 *
 *   const canon = await Canon.load(STRINGS_VAULT, TRIGGERS);
 *   canon.t("roost.01.name")                 // string, or "" while gated
 *   canon.t("ui.sunset.days", { n: 3 })      // template fill
 *   canon.state.inc("talks.ferryman")        // the engine writes, gates read
 *   canon.unlocked("S01")                    // boolean
 *   canon.newlyUnlocked()                    // ids that opened since last asked
 */
/*!
 * GENERATED by tools/canon-embed.mjs from canon/vault/strings.vault and
 * canon/bible/triggers.json. Do not edit; edit canon/ and re-run.
 * The vault is sealed prose: leave it sealed.
 */
/*!
 * Story shell: the bridge from core events to the sealed canon and back to
 * the board. The player paces every line: TALK opens, TALK advances, TALK
 * closes; nothing is shown that was not asked for.
 *
 * The core knows tiles and presses ("you pressed TALK beside npc.keeper.01
 * for the second time"). This module owns the canon's PlayerState, writes the
 * keys the bible names (canon/bible/state_keys.json, `sources`), picks the
 * string id a press earns, and hands the shell text to show as a strip over
 * the board. No scene change, no dialogue screen: one representation.
 *
 * Text never reaches the core, so a replay from a seed is text-free and the
 * goldens never carry prose.
 */
/*!
 * Input shell: DOM pointer / keyboard / d-pad / board taps -> core intents.
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
 * Painters: the bodies of things, drawn at the origin.
 *
 * Every character the game shows -- the buster, each virus, the sentinel's
 * marks, the people on the towers, the journal, a bomb on the road -- is a
 * painter here: a pure function of a size and a frame that draws the body
 * with its anchor at (0, 0). Nothing in this file reads the state, the
 * clock, or the DOM. The renderer decides where and how big; an art pack may
 * replace any painter with a raster of the same cell.
 *
 * These are pack zero: the procedural art the game shipped with. `art.js`
 * bakes them into an atlas at the current panel size, and the identity check
 * (tools/art-check.mjs) asserts that a baked cell blitted at an integer
 * origin is byte-for-byte the painter drawn there.
 *
 * Animation is by frame, not by continuous time, so a frame can be a raster:
 * a state names how many frames it has and how long each lasts, and the
 * renderer picks the frame from the clock. Effects that are not a body -- the
 * charge glow, a hit flash, debris, rings, bolts -- stay in the renderer.
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
 * Art: the pack the renderer draws bodies from.
 *
 * A pack is a set of cells, one per entity, state and frame, each a raster
 * with an anchor. Pack zero is baked here from the painters at the current
 * panel size and device scale, so the game needs no image to run; a loaded
 * pack (an atlas PNG and a manifest) replaces any cell it names, and the
 * painter stays the fallback for every cell it does not.
 *
 * The renderer never reads the DOM, so it is handed an `art` object built
 * by the shell with a canvas factory; the headless harness builds one with
 * @napi-rs/canvas the same way. `paint(ctx, id, state, frame)` draws the
 * cell with its anchor at the current origin -- the caller has already
 * translated to an integer position, so a cell and its painter land on the
 * same pixels. That is the identity the pack tool asserts.
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
