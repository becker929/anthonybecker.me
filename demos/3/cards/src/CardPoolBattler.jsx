import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   PURE CORE
   No DOM, no React, no time. Everything here is a total function of its
   arguments, which is why the whole region can be sliced out and unit-tested
   on its own (see the companion test file, which extracts it by marker).

   Five responsibilities, deliberately kept apart:
     rules   — scene → scene (draw / play / strike / begin turn)
     locate  — scene → one flat map of every card and where it sits
     place   — scene → id → transform (the layout)
     path    — pose pair → the arc between them, sampled (the layout over time)
     diff    — scene pair → RenderCommand[] (what changed)

   The shell never computes a position and never mutates a scene.

   Two things the core deliberately does *not* know:
     · what a card means. It reads `power` for combat and nothing else. `magic`
       is carried as opaque payload and read only by the display layer.
     · what is in the opponent's hand. That is a count, not a list; cards the
       player may not see are not present as data. The opponent's deck lives
       outside the scene and a card materialises at the moment it is played,
       which is exactly when the information stops being hidden.
   ═══════════════════════════════════════════════════════════════════════════ */

/* CORE:BEGIN */

const FIELD_SLOTS = 5;
const OPENING_HAND = 3;
const START_LIFE = 20;

const CARD = { width: 84, height: 118 };

// Layout constants, grouped by the zone that owns them. Ratios are fractions
// of the board; pixel values are distances from the nearest board edge.
// `arc` and `tilt` are the values reached by the outermost card, so a hand of
// any size stays on the board; only the spacing between cards changes.
const HAND = { gap: 58, maxSpread: 0.52, fromBottom: 82, arc: 16, tilt: 9 };
const OPPONENT_HAND = { gap: 44, maxSpread: 0.34, fromTop: 52, arc: 10, tilt: 7 };
const FIELD = { margin: 0.16, rowGap: 78 }; // rows sit ±rowGap either side of centre
const GRAVEYARD = { fromLeft: 58, fromEdge: 74, tilt: 2.5 };
const DROP_RADIUS = 128;

const OTHER = { player: "opponent", opponent: "player" };

/* ── decks ───────────────────────────────────────────────────────────────
   This fork replaces the fixed decks of the original card-battler demo with
   ones drawn from the Card Studio's published pool (GET /api/battler-cards,
   the one read out of that gated tool with no password — see the studio's
   publishCard/listBattleReadyCards). `power` is still the only stat combat
   reads. `magic` was hand-authored per card in the original demo; here it is
   derived from `rarity` instead (legendary === a little extra shimmer), since
   the studio has no `magic` concept of its own.

   PLAYER_DECK/OPPONENT_DECK are mutated in place by installDecks() rather
   than reassigned, so every closure that captured the array at module load
   (draw, stranded, DECK.player/opponent) keeps seeing the live contents.
   Nothing reads them until the player clicks "Begin" (see the `gate` in the
   shell below), which is what makes fetching after mount safe. */

const DEFAULT_PLAYER_DECK = [
  { id: "p-goblin", faceUp: true, name: "Goblin Raider", power: 1 },
  { id: "p-archer", faceUp: true, name: "Longbow Archer", power: 2 },
  { id: "p-wolf", faceUp: true, name: "Dire Wolf", power: 2 },
  { id: "p-mage", faceUp: true, name: "Fire Mage", power: 4, magic: true },
  { id: "p-knight", faceUp: true, name: "Iron Knight", power: 3 },
  { id: "p-adept", faceUp: true, name: "Storm Adept", power: 3, magic: true },
  { id: "p-golem", faceUp: true, name: "Stone Golem", power: 5 },
  { id: "p-seer", faceUp: true, name: "Ember Seer", power: 2, magic: true },
];

const DEFAULT_OPPONENT_DECK = [
  { id: "o-imp", faceUp: true, name: "Cinder Imp", power: 1 },
  { id: "o-warden", faceUp: true, name: "Bone Warden", power: 3 },
  { id: "o-witch", faceUp: true, name: "Marsh Witch", power: 3, magic: true },
  { id: "o-brute", faceUp: true, name: "Pit Brute", power: 4 },
  { id: "o-hound", faceUp: true, name: "Grave Hound", power: 2 },
  { id: "o-oracle", faceUp: true, name: "Void Oracle", power: 2, magic: true },
  { id: "o-lich", faceUp: true, name: "Pale Lich", power: 5, magic: true },
  { id: "o-shade", faceUp: true, name: "Fen Shade", power: 1 },
];

const PLAYER_DECK = [...DEFAULT_PLAYER_DECK];
const OPPONENT_DECK = [...DEFAULT_OPPONENT_DECK];
const DECK = { player: PLAYER_DECK, opponent: OPPONENT_DECK };

const DECK_SIZE = 8;
const RARITY_WEIGHT = { common: 6, uncommon: 3, rare: 1.5, legendary: 1 };

function replaceDeckContents(target, cards) {
  target.length = 0;
  target.push(...cards);
}

function installDecks(playerCards, opponentCards) {
  replaceDeckContents(PLAYER_DECK, playerCards);
  replaceDeckContents(OPPONENT_DECK, opponentCards);
}

// Decks change day to day as the pool grows, not shuffle to shuffle — the
// same reproducibility goal the original fixed decks had, just scoped to a
// day instead of forever, since "forever" stopped being possible once the
// deck is data instead of a literal.
function dailySeed(offset) {
  const day = Math.floor(Date.now() / 86_400_000);
  return day * 2 + offset;
}

// Weighted sample without replacement (falls back to with-replacement if the
// pool runs out before the deck is full).
function weightedSample(pool, count, rng) {
  const remaining = pool.map((card) => ({ card, weight: RARITY_WEIGHT[card.rarity] ?? 1 }));
  const picked = [];
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, e) => sum + e.weight, 0);
    let roll = rng() * total;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picked.push(remaining[index].card);
    remaining.splice(index, 1);
  }
  while (picked.length < count && pool.length > 0) {
    picked.push(pool[Math.floor(rng() * pool.length)]);
  }
  return picked;
}

function toBattlerCard(prefix, poolCard) {
  return {
    id: `${prefix}-${poolCard.id}`,
    faceUp: true,
    name: poolCard.name || "(untitled)",
    power: poolCard.power,
    rarity: poolCard.rarity,
    magic: poolCard.rarity === "legendary",
    // Absolute path: /api/battler-cards/image/<hash>, served publicly by
    // the Worker regardless of how deep this demo's own URL sits. Absent
    // for a card published before art was required, or for the fallback
    // deck, which has no `image` at all — S.face treats that as "no art".
    image: poolCard.image || null,
  };
}

// pool: [{id, name, power, rarity}], as returned by /api/battler-cards.
// No minimum pool size beyond "not empty" — rarity weighting decides who
// shows up, and weightedSample repeats cards (with replacement) once a
// small pool runs out, so even a single published card fills both decks.
// Returns null (meaning "use the fallback decks") only when nothing has
// been published yet.
function buildDecksFromPool(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const playerRng = mulberry32(dailySeed(0));
  const opponentRng = mulberry32(dailySeed(1));
  const player = weightedSample(pool, DECK_SIZE, playerRng).map((c) => toBattlerCard("p", c));
  const opponent = weightedSample(pool, DECK_SIZE, opponentRng).map((c) => toBattlerCard("o", c));
  return { player, opponent };
}

/* ── scene ───────────────────────────────────────────────────────────────── */

const emptyField = () => Array.from({ length: FIELD_SLOTS }, () => null);

// `phase` is the whole turn machine: setup → play → over. Whose play it is is
// `turn`, and `playsLeft` is the only thing the pointer is allowed to spend.
const emptyScene = () => ({
  round: 0,
  turn: "player",
  phase: "setup",
  outcome: null,
  player: {
    drawn: 0,
    hand: [],
    field: emptyField(),
    graveyard: [],
    life: START_LIFE,
    playsLeft: 0,
    attackedIds: [], // cards that have already struck this turn, cleared on beginTurn
  },
  opponent: {
    drawn: 0,
    revealed: 0, // how far into its deck the opponent has committed cards
    handCount: 0,
    field: emptyField(),
    graveyard: [],
    life: START_LIFE,
  },
});

const patch = (scene, side, fields) => ({ ...scene, [side]: { ...scene[side], ...fields } });

// Illegal transitions return the scene unchanged, by reference. Callers use
// `next === scene` to detect a rejected intent; nothing else has to report it.
// The invariant every transition preserves: an id appears at most once in a
// scene, which is what lets diff() key on ids alone.

function draw(scene, side) {
  const me = scene[side];
  if (me.drawn >= DECK[side].length) return scene;
  return side === "player"
    ? patch(scene, side, { drawn: me.drawn + 1, hand: [...me.hand, PLAYER_DECK[me.drawn]] })
    : patch(scene, side, { drawn: me.drawn + 1, handCount: me.handCount + 1 });
}

// The player's only write into the scene. Every guard the interface relies on
// lives here, so a stale pointer, a keyboard shortcut and a replayed event all
// hit the same wall.
function play(scene, cardId, slot) {
  if (scene.phase !== "play" || scene.turn !== "player") return scene;
  const me = scene.player;
  if (me.playsLeft <= 0 || slot === null || me.field[slot] !== null) return scene;
  const index = me.hand.findIndex((card) => card.id === cardId);
  if (index === -1) return scene;
  const field = [...me.field];
  field[slot] = me.hand[index];
  return patch(scene, "player", {
    field,
    hand: me.hand.filter((_, i) => i !== index),
    playsLeft: me.playsLeft - 1,
  });
}

// Deterministic and dull on purpose: block the leftmost unanswered attacker,
// otherwise take the leftmost open slot. Legible beats clever in a demo — you
// can predict it from the board, which makes the animation readable.
function chooseSlot(scene) {
  const open = [];
  for (let slot = 0; slot < FIELD_SLOTS; slot++) {
    if (scene.opponent.field[slot] === null) open.push(slot);
  }
  if (open.length === 0) return null;
  return open.find((slot) => scene.player.field[slot] !== null) ?? open[0];
}

function opponentPlay(scene) {
  const me = scene.opponent;
  if (scene.phase !== "play" || scene.turn !== "opponent") return scene;
  if (me.handCount <= 0 || me.revealed >= OPPONENT_DECK.length) return scene;
  const slot = chooseSlot(scene);
  if (slot === null) return scene;
  const field = [...me.field];
  field[slot] = OPPONENT_DECK[me.revealed];
  return patch(scene, "opponent", { field, handCount: me.handCount - 1, revealed: me.revealed + 1 });
}

const bury = (scene, side, slot) => {
  const me = scene[side];
  const card = me.field[slot];
  if (!card) return scene;
  const field = [...me.field];
  field[slot] = null;
  return patch(scene, side, { field, graveyard: [...me.graveyard, card] });
};

const settle = (scene) => {
  if (scene.player.life > 0 && scene.opponent.life > 0) return scene;
  return { ...scene, phase: "over", outcome: scene.opponent.life <= 0 ? "player" : "opponent" };
};

// A stalemate is reachable: both decks empty, both boards empty, nobody can
// ever deal damage again. Say so rather than letting the button loop forever.
const stranded = (scene, side) =>
  scene[side].drawn >= DECK[side].length &&
  scene[side].field.every((card) => card === null) &&
  (side === "player" ? scene.player.hand.length === 0 : scene.opponent.handCount === 0);

/* ── combat ──────────────────────────────────────────────────────────────
   One slot at a time, resolved against whatever is standing when the strike
   lands rather than against a snapshot — so the shell can pace the strikes
   apart and the rules still agree with what the player sees.

   Rules, entire: a card strikes the card facing it. Higher power kills; equal
   power trades. An unblocked card hits the opposing life total for its power.

   Returns null when there is nothing to resolve, so the caller can drop the
   beat instead of animating an empty slot. Otherwise returns the next scene
   plus an `fx` record — the core's account of what happened, which is what
   the display layer reads to decide on spectacle. Positions are not in it,
   but *who won* is: the shell scripts the whole clash up front, so it has to
   know at the top of the beat which card is going to fall. */

function strike(scene, side, slot) {
  if (scene.phase === "over") return null;
  const attacker = scene[side].field[slot];
  if (!attacker) return null;

  const foe = OTHER[side];
  const blocker = scene[foe].field[slot];

  if (!blocker) {
    const life = Math.max(scene[foe].life - attacker.power, 0);
    return {
      scene: settle(patch(scene, foe, { life })),
      fx: { kind: "burn", side, slot, attackerId: attacker.id, damage: attacker.power },
    };
  }

  const attackerFalls = blocker.power >= attacker.power;
  const blockerFalls = attacker.power >= blocker.power;
  let next = scene;
  if (blockerFalls) next = bury(next, foe, slot);
  if (attackerFalls) next = bury(next, side, slot);
  return {
    scene: next,
    fx: { kind: "clash", side, slot, attackerId: attacker.id, targetId: blocker.id, attackerFalls, blockerFalls },
  };
}

// The player's other write into the scene, alongside play(). Attacking is a
// choice made one card at a time — the attack phase between playing a card
// and ending the turn — so a card can strike at most once before attackedIds
// is cleared by the next beginTurn.
function attack(scene, slot) {
  if (scene.phase !== "play" || scene.turn !== "player") return null;
  const card = scene.player.field[slot];
  if (!card || scene.player.attackedIds.includes(card.id)) return null;
  const result = strike(scene, "player", slot);
  if (!result) return null;
  return { ...result, scene: patch(result.scene, "player", { attackedIds: [...scene.player.attackedIds, card.id] }) };
}

function beginTurn(scene, side) {
  if (scene.phase === "over") return scene;
  if (stranded(scene, "player") && stranded(scene, "opponent")) {
    return { ...scene, phase: "over", outcome: "stalemate" };
  }
  const next = {
    ...scene,
    turn: side,
    phase: "play",
    round: side === "player" ? scene.round + 1 : scene.round,
  };
  return side === "player" ? patch(next, "player", { playsLeft: 1, attackedIds: [] }) : next;
}

const firstFreeSlot = (scene) => {
  const slot = scene.player.field.findIndex((occupant) => occupant === null);
  return slot === -1 ? null : slot;
};

/* ── locate: scene → one flat map of every card and where it sits ────────── */

const hiddenCard = (index) => ({ id: `hidden-${index}`, faceUp: false });

function locate(scene) {
  const at = new Map();
  const put = (card, zone, index) => at.set(card.id, { zone, index, card });

  scene.player.hand.forEach((card, index) => put(card, "hand", index));
  scene.player.field.forEach((card, slot) => card && put(card, "field", slot));
  scene.player.graveyard.forEach((card, index) => put(card, "graveyard", index));
  scene.opponent.field.forEach((card, slot) => card && put(card, "oppField", slot));
  scene.opponent.graveyard.forEach((card, index) => put(card, "oppGraveyard", index));
  for (let i = 0; i < scene.opponent.handCount; i++) put(hiddenCard(i), "oppHand", i);

  return at;
}

const FIELD_ZONES = new Set(["field", "oppField"]);
const GRAVE_ZONES = new Set(["graveyard", "oppGraveyard"]);
const isOpponentZone = (zone) => zone.startsWith("opp");

/* ── place: scene → id → transform ───────────────────────────────────────── */

// Shared by both hands: cards spread evenly about the centre line, with the
// total spread capped so a large hand tightens instead of overflowing.
function fanned(index, count, { gap, maxSpread }, board) {
  const spread = Math.min(gap * Math.max(count - 1, 0), board.width * maxSpread);
  const step = count > 1 ? spread / (count - 1) : 0;
  return {
    x: board.width / 2 - spread / 2 + step * index,
    reach: count > 1 ? (index - (count - 1) / 2) / ((count - 1) / 2) : 0, // -1 … 1 across the fan
  };
}

function handTransform(index, count, board) {
  const { x, reach } = fanned(index, count, HAND, board);
  return {
    x,
    y: board.height - HAND.fromBottom + Math.abs(reach) * HAND.arc,
    rotation: reach * HAND.tilt,
  };
}

function opponentHandTransform(index, count, board) {
  const { x, reach } = fanned(index, count, OPPONENT_HAND, board);
  return {
    x,
    y: OPPONENT_HAND.fromTop - Math.abs(reach) * OPPONENT_HAND.arc,
    rotation: -reach * OPPONENT_HAND.tilt,
  };
}

function fieldTransform(slot, side, board) {
  const margin = Math.max(board.width * FIELD.margin, CARD.width / 2 + 12); // keep slot 1 on-board
  const step = (board.width - margin * 2) / (FIELD_SLOTS - 1);
  const y = board.height / 2 + (side === "player" ? FIELD.rowGap : -FIELD.rowGap);
  return { x: margin + step * slot, y, rotation: 0 };
}

function graveyardTransform(index, side, board) {
  return {
    x: GRAVEYARD.fromLeft,
    y: side === "player" ? board.height - GRAVEYARD.fromEdge : GRAVEYARD.fromEdge,
    rotation: ((index % 5) - 2) * GRAVEYARD.tilt,
  };
}

function place(scene, board) {
  const counts = { hand: scene.player.hand.length, oppHand: scene.opponent.handCount };
  const placements = new Map();
  for (const [id, { zone, index }] of locate(scene)) {
    placements.set(
      id,
      zone === "hand" ? handTransform(index, counts.hand, board)
      : zone === "oppHand" ? opponentHandTransform(index, counts.oppHand, board)
      : zone === "field" ? fieldTransform(index, "player", board)
      : zone === "oppField" ? fieldTransform(index, "opponent", board)
      : zone === "graveyard" ? graveyardTransform(index, "player", board)
      : graveyardTransform(index, "opponent", board)
    );
  }
  return placements;
}

// Which slot is a drop at `point` asking for? Only the player's row is a drop
// target — the opponent's row is scenery as far as the pointer is concerned.
// Null means "no slot": the shell treats that as an abandoned drag rather than
// a rejected play.
function slotUnder(point, board) {
  let nearest = null;
  let shortest = Infinity;
  for (let slot = 0; slot < FIELD_SLOTS; slot++) {
    const { x, y } = fieldTransform(slot, "player", board);
    const distance = Math.hypot(x - point.x, y - point.y);
    if (distance < shortest) [nearest, shortest] = [slot, distance];
  }
  return shortest < DROP_RADIUS ? nearest : null;
}

/* ── path: place, extended over time ─────────────────────────────────────
   A flight is a scripted route from where a card was to where the next scene
   puts it. Same discipline as place(): the core owns the geometry, the shell
   owns only *when* it runs. Two ideas, and nothing else:

   Anchors. A flight passes through named poses rather than sliding between two
   points — the hand, the apex out toward the camera, the slot; or the slot, the
   square-up, the point of contact, the slot again. The poses are what make an
   action legible: you can name every instant of it.

   Bows. Each leg between two anchors is a quadratic Bézier whose control point
   is the leg's midpoint pushed perpendicular to its own heading. Nothing on
   this table travels in a straight line, and a bow expressed as a fraction of
   the leg's length means a long leg sweeps wide and a short one barely curves.

   The result is sampled at fixed fractions of the animation, because CSS
   keyframes have fixed percentages and the shell hands the samples straight to
   one. Pacing is therefore a function from time to a point on the path:
   traversing the path non-uniformly in time is what makes a rise decelerate, a
   hold hold, and a blow snap. Every clash pacing puts the moment of contact at
   the same instant — 68% — so a clash scripted for three separate cards agrees
   with itself about when it happens without any of them having to coordinate
   at runtime. */

const lerp = (a, b, t) => a + (b - a) * t;

const bezier = (a, c, b, t) => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};

// The leg's midpoint, pushed along its own normal. `bow` is a fraction of the
// leg's length, so the curvature is scale-free and a zero-length leg is a point.
const control = (a, b, bow) => ({
  x: (a.x + b.x) / 2 - (b.y - a.y) * bow,
  y: (a.y + b.y) / 2 + (b.x - a.x) * bow,
});

// A pose is { x, y, rotation, scale }. Scale and rotation ride the leg
// linearly; only position is curved, which is what keeps a card readable while
// it is large and moving.
//
// Sixteen stops rather than eight. The browser interpolates *linearly* between
// keyframes, so a sampled curve is really a polyline, and every stop is a
// corner where the velocity changes. Eight was enough for a long flight, where
// the corners are small next to the travel; on a short one it read as a series
// of jerks. Doubling the samples halves the error at every corner and costs
// nothing but custom properties.
const FLIGHT_STOPS = [0, 7, 13, 20, 26, 33, 40, 47, 54, 61, 68, 74, 80, 87, 93, 100];

function samplePath(anchors, bows, pacing) {
  return FLIGHT_STOPS.map((percent) => {
    const [leg, t] = pacing(percent / 100);
    const a = anchors[leg];
    const b = anchors[leg + 1];
    const point = bezier(a, control(a, b, bows[leg]), b, t);
    return {
      x: point.x,
      y: point.y,
      rotation: lerp(a.rotation, b.rotation, t),
      scale: lerp(a.scale, b.scale, t),
    };
  });
}

/* Pacing is a function from time fraction to a point on the path, so the shape
   of an action is written as easing rather than as a table of sampled numbers.
   That matters for smoothness as much as for legibility: an easing curve is
   continuous, whereas hand-placed samples put the corners wherever the author
   happened to type them, and a strong ease expressed that way is a staircase.

   A script is a list of windows — [start, end, leg, ease]. Between two windows
   the path holds at the anchor they share, which is how a card waits at the
   apex or stands squared up. Before the first window it holds at the start;
   after the last it holds at the end. */

const clamp01 = (u) => Math.min(Math.max(u, 0), 1);
const easeOut = (u) => 1 - Math.pow(1 - u, 2.4);
const easeIn = (u) => Math.pow(u, 2.2);
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(2 - 2 * u, 3) / 2);

const script = (windows) => (u) => {
  for (const [a, b, leg, ease] of windows) {
    if (u <= a) return [leg, 0];
    if (u < b) return [leg, ease(clamp01((u - a) / (b - a)))];
  }
  const [, , leg] = windows[windows.length - 1];
  return [leg, 1];
};

const CONTACT_AT = 0.68; // every clash script puts the blow on this instant

const PACING = {
  // Out toward the camera, hold at the apex, set down deliberately.
  deploy: script([[0, 0.4, 0, easeOut], [0.54, 1, 1, easeInOut]]),
  // Square up, hold, accelerate into the blow, follow through home.
  strike: script([[0, 0.26, 0, easeOut], [0.4, CONTACT_AT, 1, easeIn], [CONTACT_AT, 1, 2, easeOut]]),
  // The same drive, by a card that does not survive it: it stops where it hit.
  lunge: script([[0, 0.26, 0, easeOut], [0.4, CONTACT_AT, 1, easeIn]]),
  // Braced, knocked back on the blow, recovered.
  absorb: script([[0, 0.26, 0, easeOut], [0.54, CONTACT_AT, 1, easeOut], [CONTACT_AT, 1, 2, easeOut]]),
  // Braced, knocked back, and it stays knocked back.
  reel: script([[0, 0.26, 0, easeOut], [0.54, CONTACT_AT, 1, easeOut]]),
  // A card you let go of, finding its slot. One leg, one settle, no character
  // of its own: the hand already did the acting.
  seat: script([[0, 1, 0, easeOut]]),
  // A body falling: slow off the mark, quickest just before it lands.
  fall: script([[0, 1, 0, easeIn]]),
};

// Clash geometry, in pixels along the line between the two slots. The rows sit
// 156px apart and a card is 118 tall, so combatants have to give ground before
// they can grow: they pull back, square up at size, and only then close.
// Checked against the numbers: at these values the two risen cards overlap by
// about 14px at the sixth stop, which is a bump rather than a near miss.
const CLASH = { squareBack: 30, reach: 80, burnReach: 118, recoil: 26, kick: 9 };

const toward = (from, to, distance) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: from.x + (dx / length) * distance, y: from.y + (dy / length) * distance };
};

/* ── diff: scene pair → RenderCommand[] ──────────────────────────────────── */

// A card that changed zone *or* index gets one move; the shell reads the
// command only to pick a transition, never to work out where the card lands.
function diff(before, after) {
  const from = locate(before);
  const to = locate(after);
  const commands = [];

  for (const [id, next] of to) {
    const prev = from.get(id);
    if (!prev) commands.push({ kind: "enter", id, card: next.card, zone: next.zone, index: next.index });
    else if (prev.zone !== next.zone || prev.index !== next.index)
      commands.push({ kind: "move", id, card: next.card, from: prev.zone, zone: next.zone, index: next.index });
  }
  for (const [id, prev] of from) {
    if (!to.has(id)) commands.push({ kind: "exit", id, card: prev.card, from: prev.zone });
  }

  return commands;
}

/* ── the turn, as a list of beats ────────────────────────────────────────
   A beat is a labelled pure transition plus the pause the shell should leave
   in front of it. `run` may also return `then`: beats to splice in ahead of
   the rest of the queue, which is how a turn that depends on its own outcome
   (attack every slot that still has a card on it) stays declarative.

   The delays are sized for the default flight durations, so a beat lands as
   the previous one's arc finishes. They are deliberately generous: an action
   here is a movement with a beginning and an end, not a state change with a
   fade on it.

   The player's turn is not in here. Beats are the parts of the loop the player
   watches; the part they play is the drag, and that goes straight to play(). */

const beat = (label, delay, run) => ({ label, delay, run });

const STRIKE_BEAT = 760; // ≈ one strike flight; consecutive blows just abut

const strikeBeats = (scene, side) => {
  const beats = [];
  for (let slot = 0; slot < FIELD_SLOTS; slot++) {
    const card = scene[side].field[slot];
    // An attacker can only die at its own slot, so filtering here — before any
    // strike has landed — cannot drop a beat that would have resolved.
    if (card) beats.push(beat(`${card.name} strikes`, STRIKE_BEAT, (s) => strike(s, side, slot) ?? { scene: s }));
  }
  return beats;
};

const openingBeats = () => [
  ...Array.from({ length: OPENING_HAND }, () => beat("You draw", 200, (s) => ({ scene: draw(s, "player") }))),
  ...Array.from({ length: OPENING_HAND }, () => beat("Opponent draws", 160, (s) => ({ scene: draw(s, "opponent") }))),
  beat("Your turn", 260, (s) => ({ scene: beginTurn(s, "player") })),
];

// Delays are breathing room, not load-bearing timing: the shell will not start
// a beat while the scene is still settling, so these can be sized for rhythm
// rather than padded against the longest animation they might collide with.
// The player's own strikes are no longer in here — each is a beat of its own,
// queued by a sword button in the attack phase, before the turn ever ends.
const endTurnBeats = () => [
  beat("Opponent's turn", 380, (s) => ({ scene: beginTurn(s, "opponent") })),
  beat("Opponent draws", 300, (s) => ({ scene: draw(s, "opponent") })),
  beat("Opponent plays", 360, (s) => ({ scene: opponentPlay(s) })),
  beat("Opponent's board attacks", 240, (s) => ({ scene: s, then: strikeBeats(s, "opponent") })),
  beat("Your turn", 380, (s) => ({ scene: beginTurn(s, "player") })),
  beat("You draw", 240, (s) => ({ scene: draw(s, "player") })),
];

/* CORE:END */

/* ═══════════════════════════════════════════════════════════════════════════
   IMPERATIVE SHELL
   The DOM analogue of PixiRenderer + GSAP. It owns exactly four things the
   core cannot: measured board size, transient visual effects with a duration,
   the pointer, and the clock that paces the opponent's turn.

   Card positions are re-derived from the scene on every render, so a rejected
   play snaps back for free — there is no second copy of the layout to keep in
   sync. The beat runner is the same idea applied to time: the queue holds pure
   transitions, and the only thing the shell adds is when each one fires.

   Flights are that discipline extended to motion. The core samples an arc into
   eight poses; the shell writes them onto the card as eight custom properties
   and points one fixed CSS keyframe at them. Because a flight's last pose is,
   by construction, the placement the next scene gives the card, the animation
   can simply be dropped when it finishes: the card is already exactly where
   place() would have put it. Nothing has to be reconciled, and the compositor
   owns every frame in between.

   Performance shape: the drag path is the only thing that fires at pointer
   rate, so it is the only thing tuned for it. Pointer samples are coalesced to
   one setState per animation frame; Card and Slot are memoized on primitive
   props; and place() is memoized on [scene, board], so a mid-drag frame
   re-renders exactly one card — the held one — and leaves the rest untouched.

   Juice keeps the same shape. Every effect is fire-and-forget: one state write
   to spawn it, CSS animations on compositor properties (transform/opacity) to
   run it, one shared timer to reap it. No rAF loops, no per-frame JS, nothing
   added to the drag path. Shake lives on its own wrapper layer so retriggering
   it re-renders one div, not the board's children.
   ═══════════════════════════════════════════════════════════════════════════ */

const ENTER_MS = 320;
const EXIT_MS = 300;
const MOVE_MS = 380;

const ZONE_DEPTH = { oppHand: 1, oppGraveyard: 2, graveyard: 2, oppField: 3, field: 4, hand: 5 };
const FLIGHT_DEPTH = 800; // anything in the air clears the board
const HELD_DEPTH = 1000;
const JUICE_DEPTH = 1200; // above every card, including the held one
const ATTACK_BUTTON_DEPTH = 700; // above field cards, below anything in flight
const HAND_HALO = { width: 380, height: 150 }; // sized to sit under the fan, not the board

const INK = {
  table: "#101c18",
  tableEdge: "#1b2f28",
  rule: "#25382f",
  chrome: "#0a1512",
  text: "#cfded6",
  dim: "#6f8a80",
  brass: "#a5883f",
  parchment: "#efe3c3",
  parchmentEdge: "#dbc894",
  back: "#2a4a41",
  // The opponent's half is the same table lit from the other side: colder
  // stock, oxidised metal, a red that only appears when something is hurt.
  ash: "#cdd2d8",
  ashEdge: "#a9b1ba",
  verdigris: "#6f8f86",
  oppBack: "#3a2b32",
  enter: "#79b9a4",
  move: "#8fa9cf",
  exit: "#c47a5c",
  wound: "#c4564a",
  dust: "#c9b585",
  dustCloud: "#b3a077",
  sparkHot: "#fff3cd",
  sparkGlow: "rgba(255, 214, 106, .85)",
  arcHot: "#dff4ff",
  arcGlow: "rgba(126, 205, 255, .85)",
};

// Slot feedback during a drag: idle, open, would receive the drop, occupied.
const SLOT_EDGE = { idle: "#2b463d", candidate: "#4c6d5e", target: INK.brass, blocked: INK.exit };
const SLOT_FILL = {
  idle: "transparent",
  candidate: "rgba(165,136,63,.05)",
  target: "rgba(165,136,63,.12)",
  blocked: "rgba(196,122,92,.12)",
};

/* ── juice policy ─────────────────────────────────────────────────────────
   One emitter, several populations. Every burst — dust, sparks, arcs alike —
   is a card throwing particles off its own outline: pick an angle, find where
   that ray leaves the card's rectangle, start there, travel straight out along
   the same heading. Nothing is emitted from a point, because nothing on this
   table is a point; the thing that triggered the burst is a physical card of
   known size, and the burst is that card shedding material.

   A `layer` is one population of that emitter: how many, how big, how far, how
   long. Layers differ only in what they draw once they are moving — a mote
   shrinks, a cloud swells, a streak stretches along its own heading. They
   share the rim, the angle, and the outward vector, which is what makes the
   sparks read as the same event as the dust rather than as decoration on top
   of it. Dust is in every burst for exactly that reason: sparks and arcs are
   populations *within* a dust cloud, never a separate flash beside one.

     land   motes + clouds            an ordinary card sets down
     land + arcs                      a magic card sets down
     impact motes + clouds            a blow lands, where the two cards met
     cast   motes + arcs              a magic card discharges, off its own rim
     break  motes + sparks            a card is destroyed

   Two streak tints keep the two rare events distinguishable at a glance: hot
   brass sparks mean something broke, cold blue arcs mean something was cast.

   Every burst is now fired at the moment the motion says it should be — a
   landing at the end of a descent, not at the top of it — which is what the
   flight timings buy. */

const SHAKE_LEVELS = ["subtle", "strong", "intense"];
const isMagic = (card) => card?.magic === true;

// Rarity reads as a ring around the card face rather than a badge, so it
// never competes with the power/name/sigil for space on an 84×118 card.
// common has no ring at all — rarity is a bonus signal, not baseline chrome.
const RARITY_RING = {
  uncommon: "rgba(111,143,134,.55)", // INK.verdigris, dimmed
  rare: INK.arcGlow,
  legendary: INK.sparkGlow,
};

const TAU = Math.PI * 2;

// Where a ray at `angle` leaves the card. The card is a rectangle, so the exit
// point is the nearer of the two axis crossings — which is what makes a burst
// hug the long edges instead of tracing a circle painted on the middle of the
// card. `rim` is the emitting body; every emitter on this table is card-sized,
// including the empty slot a blow lands in.
function rimPoint(angle, rim) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const reach = Math.min(Math.abs(rim.width / 2 / ux), Math.abs(rim.height / 2 / uy));
  return { ux, uy, x: ux * reach, y: uy * reach };
}

// Populations, each reading its numbers off the live settings. `shape` picks
// the rendering; everything about *where* a particle starts and which way it
// goes is shared, and lives in the emitter.
const LAYERS = {
  motes: (s) => ({
    shape: "mote",
    count: s.dustFastCount,
    size: s.dustFastSize,
    distance: s.dustFastDistance,
    life: s.dustFastLifeMs,
  }),
  clouds: (s) => ({
    shape: "cloud",
    count: s.dustSlowCount,
    size: s.dustSlowSize,
    distance: s.dustSlowDistance,
    life: s.dustSlowLifeMs,
  }),
  sparks: (s) => ({
    shape: "streak",
    tint: "hot",
    count: s.sparkCount,
    size: s.sparkLength,
    distance: s.sparkDistance,
    life: s.sparkLifeMs,
  }),
  arcs: (s) => ({
    shape: "streak",
    tint: "cold",
    ring: true, // the one flourish: a shockwave on the rim, magic only
    count: s.arcCount,
    size: s.arcLength,
    distance: s.arcDistance,
    life: s.arcLifeMs,
  }),
};

const BURSTS = {
  land: ["motes", "clouds"],
  landMagic: ["motes", "clouds", "arcs"],
  impact: ["motes", "clouds"],
  cast: ["motes", "arcs"],
  break: ["motes", "sparks"],
};

// A small pool per event so two hits in a row don't sound identical; picked
// from the loudest, most physical samples in the set so they read over the
// particle work rather than under it.
const SOUND_POOLS = {
  clash: ["sounds/Debris1.wav", "sounds/Debris2.wav"],
  burn: ["sounds/Explosion1.wav", "sounds/Explosion3.wav", "sounds/Explosion5.wav"],
  break: ["sounds/Explosion1.wav", "sounds/Explosion3.wav", "sounds/Explosion5.wav"],
  victory: ["sounds/VictoryBig.wav"],
  defeat: ["sounds/Decompression.wav"],
};

// Every juice number a slider can reach, flat so the copied JSON is the
// settings, verbatim. Motion sits alongside particles because the timing of an
// action is as much a tuned quantity as the dust it throws.
const DEFAULT_SETTINGS = {
  seatMs: 320,
  deployMs: 980,
  strikeMs: 820,
  fallMs: 460,
  stageScale: 1.46,
  clashScale: 1.24,
  arcBow: 0.12,
  shakeSubtlePx: 8,
  shakeSubtleMs: 420,
  shakeStrongPx: 18,
  shakeStrongMs: 700,
  shakeIntensePx: 28,
  shakeIntenseMs: 880,
  dustFastCount: 8,
  dustFastSize: 12,
  dustFastDistance: 52,
  dustFastLifeMs: 1200,
  dustSlowCount: 6,
  dustSlowSize: 24,
  dustSlowDistance: 26,
  dustSlowLifeMs: 3000,
  sparkCount: 12,
  sparkDistance: 72,
  sparkLength: 11,
  sparkLifeMs: 420,
  arcCount: 16,
  arcDistance: 96,
  arcLength: 18,
  arcLifeMs: 520,
};

const shakeOf = (s, level) =>
  level === "subtle" ? { px: s.shakeSubtlePx, ms: s.shakeSubtleMs }
  : level === "strong" ? { px: s.shakeStrongPx, ms: s.shakeStrongMs }
  : { px: s.shakeIntensePx, ms: s.shakeIntenseMs };


// Deterministic per-burst randomness: a Burst is a pure function of its
// props, so React.memo holds and a burst never re-rolls mid-flight.
const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const withId = (set, id) => new Set(set).add(id);
const withoutId = (set, id) => {
  const next = new Set(set);
  next.delete(id);
  return next;
};
const withKey = (map, key, value) => new Map(map).set(key, value);
const withoutKey = (map, key) => {
  const next = new Map(map);
  next.delete(key);
  return next;
};

/* ── flights, shell side ──────────────────────────────────────────────────
   A pose becomes one transform string; eight of them become eight custom
   properties on the sprite; one fixed keyframe reads them back. The base
   transform carries an explicit scale(1) so it is structurally identical to
   every pose — matching function lists are what let the browser interpolate,
   and what makes dropping the finished animation a no-op rather than a jump. */

const poseTransform = (p) =>
  `translate(${(p.x - CARD.width / 2).toFixed(1)}px, ${(p.y - CARD.height / 2).toFixed(1)}px)` +
  ` rotate(${(p.rotation ?? 0).toFixed(2)}deg) scale(${(p.scale ?? 1).toFixed(3)})`;

// Two identical keyframe names, picked by the flight's sequence number. Same
// trick the shake layer uses: it is the cheap way to restart an animation that
// is already running — a card that is struck and then falls replaces its own
// flight mid-air, and must not merely inherit the old one's progress.
const flightStyle = (flight) => {
  const style = { animation: `flight-${flight.seq % 2} ${flight.duration}ms linear both` };
  flight.poses.forEach((pose, i) => {
    style[`--w${i}`] = poseTransform(pose);
  });
  return style;
};

// Every deferred effect goes through here so unmounting cannot leave a timer
// writing into dead state.
function useTimers() {
  const pending = useRef(new Set());
  useEffect(() => () => {
    pending.current.forEach(clearTimeout);
    pending.current.clear();
  }, []);
  return useCallback((ms, run) => {
    const timer = setTimeout(() => {
      pending.current.delete(timer);
      run();
    }, ms);
    pending.current.add(timer);
  }, []);
}

// Owns the two juice channels: particle bursts (spawn → CSS runs it → timer
// reaps it) and screen shake (level + nonce; the nonce's parity picks between
// two identical keyframe names, which is the cheap way to restart a running
// CSS animation without re-keying — and therefore remounting — the layer).
// Reads settings through a ref so its callbacks stay identity-stable while
// sliders move.
function useJuice(after, settingsRef) {
  const [bursts, setBursts] = useState([]);
  const [shake, setShake] = useState(null);
  const seq = useRef(0);

  const burst = useCallback(
    (event, x, y) => {
      const s = settingsRef.current;
      // Snapshot the numbers this burst will use; later slider moves don't
      // reach into effects already in the air.
      const layers = BURSTS[event].map((name) => LAYERS[name](s));
      const ttl = layers.reduce((longest, layer) => Math.max(longest, layer.life), 0);
      const id = ++seq.current;
      setBursts((live) => [...live, { id, x, y, layers, seed: (id * 2654435761) >>> 0 }]);
      after(ttl + 60, () => setBursts((live) => live.filter((b) => b.id !== id)));
    },
    [after, settingsRef]
  );

  const rumble = useCallback(
    (level) => {
      const { ms } = shakeOf(settingsRef.current, level);
      const nonce = ++seq.current;
      setShake({ level, nonce, ms });
      // Only the shake that set the state clears it, so a fresh intense
      // shake is never cut short by a stale subtle one's timer.
      after(ms, () => setShake((current) => (current?.nonce === nonce ? null : current)));
    },
    [after, settingsRef]
  );

  return { bursts, shake, burst, rumble };
}

// One <audio> element per source, reused and restarted rather than recreated,
// except when an event's own sound is still ringing — then a clone plays
// alongside it, so two clashes half a beat apart don't cut each other off.
function useSound() {
  const pool = useRef(new Map());

  return useCallback((event) => {
    const choices = SOUND_POOLS[event];
    if (!choices || choices.length === 0) return;
    const src = choices[(Math.random() * choices.length) | 0];

    let base = pool.current.get(src);
    if (!base) {
      base = new Audio(src);
      base.preload = "auto";
      pool.current.set(src, base);
    }
    const voice = base.paused ? base : base.cloneNode(true);
    voice.volume = 0.55;
    voice.currentTime = 0;
    voice.play().catch(() => {}); // autoplay can be blocked before the first gesture
  }, []);
}

// Flights in the air, keyed by card. `launch` stamps each one with a sequence
// number and schedules its own removal; a flight only ever clears itself, so a
// card that has already been given a follow-on flight is never yanked out from
// under it by the previous one's timer.
function useFlights(after) {
  const [flights, setFlights] = useState(() => new Map());
  const seq = useRef(0);

  const launch = useCallback(
    (entries) => {
      if (entries.length === 0) return;
      const stamped = entries.map(([id, flight]) => [id, { ...flight, seq: ++seq.current }]);
      setFlights((live) => {
        const next = new Map(live);
        for (const [id, flight] of stamped) next.set(id, flight);
        return next;
      });
      for (const [id, flight] of stamped) {
        after(flight.duration + 40, () =>
          setFlights((live) => (live.get(id)?.seq === flight.seq ? withoutKey(live, id) : live))
        );
      }
    },
    [after]
  );

  const clear = useCallback(() => setFlights(new Map()), []);

  return { flights, launch, clear };
}

// The board reports a *logical* size, not its measured one. Every layout
// number in this file — card size, fan spread, row gap, drop radius — is a
// pixel value tuned against a table at least STAGE_MIN wide. Rather than make
// all of them responsive (and with them the flights, poses and particle rims
// that assume the same units), the stage keeps its units and shrinks bodily:
// below STAGE_MIN the whole thing is drawn scaled down, so a phone gets the
// same table seen from further away instead of a cramped one.
//
// `scale` is what the shell renders with; `width`/`height` are what the
// geometry thinks it has. Above STAGE_MIN the scale is exactly 1 and this is
// the identity it always was.
const STAGE_MIN = 600;

function useBoardSize(ref) {
  const [board, setBoard] = useState({ width: 900, height: 560, scale: 1 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBoard((prev) => {
        const scale = Math.min(1, Math.max(width, 1) / STAGE_MIN);
        const next = {
          width: Math.max(width / scale, 320),
          height: Math.max(height / scale, 420),
          scale,
        };
        // Skip the state write when the derived stage is unchanged, so a
        // no-op resize notification cannot trigger a full board re-layout.
        return prev.width === next.width && prev.height === next.height && prev.scale === next.scale
          ? prev
          : next;
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return board;
}

export default function TcgDisplayLayer() {
  const boardRef = useRef(null);
  const board = useBoardSize(boardRef);
  const after = useTimers();

  // The tuning table is fixed now that the live sliders are gone; it still
  // drives every duration and juice level, it just no longer changes.
  const settings = DEFAULT_SETTINGS;
  const settingsRef = useRef(settings);

  const { bursts, shake, burst, rumble } = useJuice(after, settingsRef);
  const { flights, launch, clear: clearFlights } = useFlights(after);
  const sound = useSound();

  const [scene, setScene] = useState(emptyScene);
  const [queue, setQueue] = useState([]);
  const [beatLabel, setBeatLabel] = useState(null);

  // Nothing reads PLAYER_DECK/OPPONENT_DECK until the opening "Begin" beat,
  // so it's safe to still be fetching when the component first renders —
  // decksReady only has to land before the gate button becomes clickable.
  // A failed fetch (offline, cold worker) still resolves decksReady so the
  // demo starts on the fixed fallback decks instead of hanging forever.
  const [decksReady, setDecksReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/battler-cards")
      .then((resp) => (resp.ok ? resp.json() : []))
      .then((pool) => {
        const decks = buildDecksFromPool(pool);
        if (decks) installDecks(decks.player, decks.opponent);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDecksReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Transient visual state: which cards are mid-entrance, mid-death, or
  // mid-exit, and which life plate was just hit.
  const [entering, setEntering] = useState(() => new Map()); // id → entrance name
  const [perishing, setPerishing] = useState(() => new Set());
  const [departing, setDeparting] = useState(() => new Map()); // id → frozen sprite
  const [wound, setWound] = useState(null); // { side, nonce }
  const [drag, setDrag] = useState(null);

  const cards = useMemo(() => locate(scene), [scene]);
  const placements = useMemo(() => place(scene, board), [scene, board]);

  // The beat runner and the pointer both need the newest scene from inside a
  // timer callback. A ref is the honest way to say that: state for rendering,
  // ref for reading. (Doing this work inside a setState updater instead would
  // fire twice under StrictMode — side effects do not belong in a reducer.)
  const sceneRef = useRef(scene);
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    if (scene.outcome === "player") sound("victory");
    else if (scene.outcome) sound("defeat"); // opponent win or stalemate: no fanfare either way
  }, [scene.outcome, sound]);

  // Shake amplitudes live in settings, so the keyframe text is rebuilt when a
  // slider moves — and only then. The game path never touches this memo.
  const keyframes = useMemo(() => buildKeyframes(settings), [settings]);

  /* ── the settle horizon ──────────────────────────────────────────────────
     A beat must never run against a scene that something already in the air is
     about to overwrite. A strike commits at the moment of contact, several
     hundred milliseconds after its beat was applied; if the next beat ran in
     that window it would read a stale scene, and the late commit would then
     throw away whatever the next beat wrote. (That is exactly how the
     opponent's turn was being lost: beginTurn ran before the strike committed,
     and the strike's commit put `turn` back to the player, so opponentPlay
     found it was not their turn and returned the scene unchanged.)

     So anything that will change the scene later pushes this horizon out, and
     the runner waits for it. Falls and other purely decorative flights do not:
     they cannot write to the scene, so nothing has to wait for them. */

  const settleRef = useRef(0);
  const hold = useCallback((ms) => {
    settleRef.current = Math.max(settleRef.current, Date.now() + ms + 40); // margin: never tie
  }, []);

  /* ── commit: the single write path into the scene ────────────────────────
     Commands choose transitions; the new positions come from place(), not from
     the commands. A card landing on the field gets a flight instead of a
     transition, and its landing juice is deferred to the moment the descent
     actually ends — the arc is what the burst is a consequence of, so the two
     have to agree. `fx`, when present, is the core's account of a strike, and
     `spots` is the shell's own account of where the clash physically happened,
     which the diff cannot see because the cards were in the air at the time. */

  const commit = useCallback(
    (next, { fx = null, spots = null, released = null } = {}) => {
      const previous = sceneRef.current;
      if (next === previous && !fx) return;
      const s = settingsRef.current;
      const commands = diff(previous, next);
      const before = place(previous, board);
      const landing = place(next, board);
      const at = (id) => spots?.at.get(id) ?? before.get(id);

      const deploys = [];

      for (const command of commands) {
        const { id } = command;
        const onField = FIELD_ZONES.has(command.zone);

        if (onField && (command.kind === "enter" || command.kind === "move")) {
          // Two different arrivals, because they are two different events. Your
          // card was already in your hand and is already where you dropped it,
          // so it only has to seat. Theirs is the first time you have seen it,
          // so it comes out toward the camera before it lands.
          const to = { ...landing.get(id), scale: 1 };
          if (isOpponentZone(command.zone)) {
            const above = { ...fieldTransform(command.index, "opponent", board), y: -CARD.height, rotation: -6, scale: 0.86 };
            deploys.push([id, deployFlight(above, to, board, s)]);
            hold(s.deployMs);
          } else {
            // Scale stays at 1 here. The face already carries the grab size and
            // is already easing out of it on its own 160ms transition; a
            // wrapper that also scaled would multiply the two, and two curves
            // on one visual property is what a lumpy settle looks like.
            const from = released?.id === id
              ? { ...released.pose, rotation: 0, scale: 1 } // where your hand left it
              : { ...before.get(id), scale: 1 }; // played from the keyboard: it leaves the hand
            deploys.push([id, seatFlight(from, to, s)]);
          }
        } else if (command.kind === "enter") {
          setEntering((ids) => withKey(ids, id, isOpponentZone(command.zone) ? "descend" : "deal"));
          after(ENTER_MS, () => setEntering((ids) => withoutKey(ids, id)));
        } else if (command.kind === "move" && GRAVE_ZONES.has(command.zone)) {
          setPerishing((ids) => withId(ids, id));
          after(s.strikeMs * (1 - CONTACT_AT) + s.fallMs + 80, () =>
            setPerishing((ids) => withoutId(ids, id))
          );
        } else if (command.kind === "exit") {
          const sprite = { card: command.card, transform: before.get(id), mine: !isOpponentZone(command.from) };
          setDeparting((sprites) => withKey(sprites, id, sprite));
          after(EXIT_MS, () => setDeparting((sprites) => withoutKey(sprites, id)));
        }
      }

      launch(deploys);

      // Juice pass one: what the diff can see. A landing's burst waits for the
      // descent; a death's fires now, off the dying card's own rim at the point
      // it was actually struck.
      for (const command of commands) {
        if (FIELD_ZONES.has(command.zone) && (command.kind === "enter" || command.kind === "move")) {
          const spot = landing.get(command.id);
          const magic = isMagic(command.card);
          const arrival = isOpponentZone(command.zone) ? s.deployMs * 0.84 : s.seatMs * 0.8;
          after(arrival, () => {
            burst(magic ? "landMagic" : "land", spot.x, spot.y);
            rumble(magic ? "intense" : "subtle");
          });
        } else if (command.kind === "move" && GRAVE_ZONES.has(command.zone)) {
          const origin = at(command.id);
          if (origin) burst("break", origin.x, origin.y);
          rumble("strong");
          sound("break");
        }
      }

      // Juice pass two: the strike itself, at the point the two cards met.
      if (fx) {
        const attacker = previous[fx.side].field[fx.slot];
        if (spots?.impact) burst("impact", spots.impact.x, spots.impact.y);

        // The spell comes off the caster, not off the thing it hits — and off
        // the caster where it actually is, which at this instant is its
        // contact pose. The arcs and the card cannot disagree about that,
        // because both read the same sample of the same path.
        const from = at(fx.attackerId);
        if (isMagic(attacker) && from) burst("cast", from.x, from.y);

        if (fx.kind === "burn") {
          setWound({ side: OTHER[fx.side], nonce: fx.slot + Date.now() });
          rumble("strong");
          sound("burn");
        } else {
          rumble(isMagic(attacker) ? "intense" : "subtle");
          sound("clash");
        }
      }

      sceneRef.current = next;
      setScene(next);
    },
    [board, after, burst, rumble, sound, launch, hold]
  );

  /* ── the beat runner ─────────────────────────────────────────────────────
     One timer, one beat. A strike is scripted in full before any of it plays:
     the core has already said who falls, so the shell can lay out three arcs —
     the attacker's, the blocker's, and the loser's fall — that agree with each
     other about when contact happens, and then commit the scene at exactly
     that instant. The death and the impact are one moment, not two. */

  const applyBeat = useCallback(
    (current) => {
      const result = current.run(sceneRef.current);
      setBeatLabel(current.label);

      if (!result.fx) {
        commit(result.scene);
        return result.then ?? [];
      }

      // Placed from the ref rather than the memo on purpose: this callback
      // must not change identity when the scene does, or committing one beat
      // would restart the timer already counting down for the next.
      const s = settingsRef.current;
      const clash = clashFlights(sceneRef.current, result.fx, board, s);
      launch(clash.flights);
      hold(s.strikeMs * CONTACT_AT);
      after(s.strikeMs * CONTACT_AT, () => commit(result.scene, { fx: result.fx, spots: clash.spots }));

      // The fallen do not travel to the graveyard until they have finished
      // being dead. Their destination is read at that moment, not now, so a
      // second death committed in between cannot leave this one aimed at a
      // stale spot in the stack.
      for (const [id, hit] of clash.fallen) {
        after(s.strikeMs, () => {
          const rest = place(sceneRef.current, board).get(id);
          if (rest) launch([[id, fallFlight(hit, { ...rest, scale: 0.94 }, s)]]);
        });
      }

      return result.then ?? [];
    },
    [after, commit, launch, hold, board]
  );

  useEffect(() => {
    if (queue.length === 0) return;
    if (sceneRef.current.phase === "over") {
      setQueue([]);
      return;
    }
    const [current, ...rest] = queue;
    // The beat's own delay, or the wait for the scene to stop moving under it,
    // whichever is longer.
    const wait = Math.max(current.delay, settleRef.current - Date.now());
    const timer = setTimeout(() => setQueue([...applyBeat(current), ...rest]), wait);
    return () => clearTimeout(timer);
  }, [queue, applyBeat]);

  /* ── intents ─────────────────────────────────────────────────────────── */

  const running = queue.length > 0;
  // A card in the air is a card whose scene position is a promise not yet kept,
  // so the turn does not advance underneath it.
  const settled = !running && flights.size === 0;
  const yourMove = settled && scene.phase === "play" && scene.turn === "player";
  const canPlay = yourMove && scene.player.playsLeft > 0;
  // The attack phase: every field card not yet in attackedIds is still owed a
  // sword button. Once none are, ending the turn is the only thing left to do,
  // and the button says so.
  const attacksAvailable =
    yourMove && scene.player.field.some((card) => card && !scene.player.attackedIds.includes(card.id));
  // Both action kinds have to be spent — a card still in hand is a strike not
  // yet chosen not to make, exactly like an unstruck field card.
  const readyToEndTurn = yourMove && !attacksAvailable && !canPlay;

  // `released` is where the pointer let the card go. It is the one position in
  // the whole shell that place() cannot derive, because it is a fact about the
  // player's hand rather than about the scene — so it is passed in rather than
  // looked up, and used only as the first pose of the seat.
  const attempt = useCallback(
    (cardId, slot, released = null) => {
      if (slot === null) return;
      const next = play(sceneRef.current, cardId, slot);
      if (next === sceneRef.current) return; // rejected plays need no handling: layout is unchanged
      commit(next, { released: released && { id: cardId, pose: released } });
    },
    [commit]
  );

  const advance = useCallback(() => {
    const current = sceneRef.current;
    if (queue.length > 0 || current.phase === "over") return;
    if (current.phase === "setup") return setQueue(openingBeats());
    if (current.turn === "player") setQueue(endTurnBeats());
  }, [queue.length]);

  // The attack phase's one intent: strike with a single field card, queued as
  // a single beat so it runs through the same clash-flight machinery as every
  // other strike. Guarded the same way play() is guarded inside attack() —
  // this is only ever an optimistic nudge to try, never a source of truth.
  const attackWithSlot = useCallback(
    (slot) => {
      const current = sceneRef.current;
      if (queue.length > 0 || current.phase !== "play" || current.turn !== "player") return;
      const card = current.player.field[slot];
      if (!card || current.player.attackedIds.includes(card.id)) return;
      setQueue([beat(`${card.name} attacks`, 0, (s) => attack(s, slot) ?? { scene: s })]);
    },
    [queue.length]
  );

  const reset = useCallback(() => {
    setQueue([]);
    setBeatLabel(null);
    setWound(null);
    setPerishing(new Set());
    settleRef.current = 0;
    clearFlights();
    commit(emptyScene());
  }, [commit, clearFlights]);

  /* ── pointer ──────────────────────────────────────────────────────────────
     Drag is the one interaction that fires at pointer sample rate, so its cost
     is paid per frame, not per event. `dragRef` mirrors the live drag for the
     rAF callback; `boardRectRef` caches the board rect measured at grab time so
     a move never forces a layout read; pointer samples land in `pendingRef` and
     one rAF flushes the newest to state. Shake translates the inner layer, not
     the board element, so the cached rect stays honest during a rumble. */

  const dragRef = useRef(null);
  const boardRectRef = useRef(null);
  const pendingRef = useRef(null);
  const rafRef = useRef(0);
  // Mirrors the stage scale for the same reason: the move handler is built
  // once and reads everything it needs through refs.
  const scaleRef = useRef(board.scale);
  useEffect(() => {
    scaleRef.current = board.scale;
  }, [board.scale]);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), []);

  const startDrag = useCallback(
    (id, event) => {
      const origin = placements.get(id);
      if (!origin) return;
      event.currentTarget.setPointerCapture?.(event.pointerId); // keeps the drag alive outside the board
      const rect = boardRef.current.getBoundingClientRect();
      boardRectRef.current = rect;
      // Screen pixels → stage units. The stage is drawn scaled, so a pointer
      // reading has to be divided back out before it can be compared with any
      // of the layout numbers.
      const point = {
        x: (event.clientX - rect.left) / board.scale,
        y: (event.clientY - rect.top) / board.scale,
      };
      const next = { id, x: origin.x, y: origin.y, grabX: origin.x - point.x, grabY: origin.y - point.y };
      dragRef.current = next;
      pendingRef.current = null;
      setDrag(next);
    },
    [placements, board.scale]
  );

  const moveDrag = useCallback((event) => {
    const held = dragRef.current;
    if (!held) return;
    const rect = boardRectRef.current;
    pendingRef.current = {
      x: (event.clientX - rect.left) / scaleRef.current,
      y: (event.clientY - rect.top) / scaleRef.current,
    };
    if (rafRef.current) return; // a flush is already queued for this frame
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const cur = dragRef.current;
      const point = pendingRef.current;
      if (!cur || !point) return;
      setDrag({ ...cur, x: point.x + cur.grabX, y: point.y + cur.grabY });
    });
  }, []);

  const endDrag = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const held = dragRef.current;
    if (!held) return;
    const point = pendingRef.current;
    const pos = point ? { x: point.x + held.grabX, y: point.y + held.grabY } : { x: held.x, y: held.y };
    pendingRef.current = null;
    setDrag(null);
    attempt(held.id, slotUnder(pos, board), pos);
  }, [attempt, board]);

  /* ── render ───────────────────────────────────────────────────────────── */

  const quickPlay = useCallback((cardId) => attempt(cardId, firstFreeSlot(sceneRef.current)), [attempt]);

  // A death lasts from the blow to the landing in the graveyard: the tail of
  // the strike flight plus the fall. Same arithmetic that schedules the flag's
  // removal, so the darkening and the state it darkens for end together.
  const perishMs = Math.round(settings.strikeMs * (1 - CONTACT_AT) + settings.fallMs);

  // The same pure query that decides the drop also drives the highlight, so
  // what the board promises and what the release does cannot disagree.
  const targetSlot = drag ? slotUnder({ x: drag.x, y: drag.y }, board) : null;
  const slotState = (slot) => {
    const open = scene.player.field[slot] === null;
    if (!drag) return "idle";
    if (slot === targetSlot) return open ? "target" : "blocked";
    return open ? "candidate" : "idle";
  };

  // The board asks for exactly one of two things: a decision at the edges of a
  // game, or a play in the middle of one. `gate` is the former — present only
  // before the opening deal and after the outcome is known, absent for the
  // whole of the game in between.
  const gate =
    scene.phase === "setup"
      ? decksReady
        ? { label: "Begin", act: advance, line: "Both sides draw three." }
        : { label: "Loading…", act: () => {}, disabled: true, line: "Fetching the card pool…" }
      : scene.phase === "over" ? { label: "New Game", act: reset, line: OUTCOME_TEXT[scene.outcome] }
      : null;

  // While a gate is up it is saying the only thing worth saying, so the strip
  // above stays quiet rather than repeating it back.
  const status =
    gate ? ""
    : !settled ? (beatLabel ?? "…")
    : attacksAvailable
      ? canPlay
        ? "Drag a card to play it, or strike with the sword buttons."
        : "Strike with the sword buttons, then end your turn."
      : canPlay
        ? "Your turn. Drag a card to an open slot."
        : "All attacks made — end your turn.";

  return (
    <div className="tcg-poc" style={S.frame}>
      <style>{keyframes}</style>

      <header style={S.header}>
        <span style={S.status}>{status}</span>
        {/* Ending the turn is the one thing the player must be able to ask for
            mid-game, so it stays out of the board and in the chrome, where it
            can never sit on top of a card. */}
        {!gate && (
          <button onClick={advance} disabled={!settled} style={S.turnButton(!settled, readyToEndTurn)}>
            End turn
          </button>
        )}
      </header>

      <div
        ref={boardRef}
        style={S.board}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* The stage holds the table's own coordinate system and is drawn at
            whatever scale fits. Everything inside it — layout, flights,
            particles — is written in those units and never learns about the
            scale; only the pointer has to convert. */}
        <div style={S.stage(board)}>
          {/* Everything visual sits on the shake layer; the board element
              itself never moves, so pointer math and the drag's cached rect
              are immune to the rumble. */}
          <div style={S.shakeLayer(shake)}>
          <div style={S.midline(scene.turn, running)} />

          <LifePlate side="opponent" life={scene.opponent.life} wound={wound} />
          <LifePlate side="player" life={scene.player.life} wound={wound} />

          {/* The hand's tell: a card still owed a play, glowing under the fan
              exactly as long as one is. Gone the instant the play is made,
              same as a struck sword button. */}
          {canPlay && <div style={S.handHalo(board)} />}

          {["opponent", "player"].map((side) =>
            Array.from({ length: FIELD_SLOTS }, (_, slot) => {
              const { x, y } = fieldTransform(slot, side, board);
              return (
                <Slot
                  key={`${side}-slot-${slot}`}
                  x={x}
                  y={y}
                  state={side === "player" ? slotState(slot) : "idle"}
                />
              );
            })
          )}

          {Array.from(cards, ([id, { card, zone, index }]) => {
            const isHeld = drag?.id === id;
            const flight = flights.get(id);
            return (
              <Card
                key={id}
                id={id}
                card={card}
                mine={!zone.startsWith("opp")}
                transform={isHeld ? { x: drag.x, y: drag.y, rotation: 0 } : placements.get(id)}
                depth={
                  isHeld ? HELD_DEPTH
                  : flight ? FLIGHT_DEPTH + (flight.lift ?? 0)
                  : ZONE_DEPTH[zone] * 100 + index
                }
                held={isHeld}
                playable={zone === "hand" && canPlay}
                entrance={entering.get(id)}
                perishing={perishing.has(id)}
                perishMs={perishMs}
                spent={GRAVE_ZONES.has(zone)}
                flight={flight}
                onGrab={startDrag}
                onQuickPlay={quickPlay}
              />
            );
          })}

          {/* The attack phase, entire: one sword per field card that hasn't
              struck yet this turn, sitting below the card it belongs to. Drawn
              only on the player's own turn — the opponent has no such button,
              it strikes on its own beat. */}
          {scene.phase === "play" &&
            scene.turn === "player" &&
            scene.player.field.map((card, slot) => {
              if (!card) return null;
              const { x, y } = fieldTransform(slot, "player", board);
              const struck = scene.player.attackedIds.includes(card.id);
              return (
                <AttackButton
                  key={`attack-${slot}`}
                  slot={slot}
                  x={x}
                  y={y + CARD.height / 2 + 16}
                  name={card.name}
                  enabled={settled && !struck}
                  onAttack={attackWithSlot}
                />
              );
            })}

          {Array.from(departing, ([id, { card, transform, mine }]) => (
            <Card key={id} id={id} card={card} mine={mine} transform={transform} depth={0} departing />
          ))}

          {bursts.map((b) => (
            <Burst key={b.id} x={b.x} y={b.y} layers={b.layers} seed={b.seed} />
          ))}
          </div>
        </div>

        {/* The two thresholds of a game — before the first card and after the
            last — are the only moments the table asks for a decision rather
            than a play, so they get the whole board and the good lettering.
            Mid-game the board must stay clear, so this is absent entirely. */}
        {gate && (
          <div style={S.gate}>
            {gate.line && <span style={S.gateLine}>{gate.line}</span>}
            <button onClick={gate.act} disabled={gate.disabled} style={S.gateButton(gate.disabled)}>
              {gate.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── the three flights ────────────────────────────────────────────────────
   Each is a pure function from poses to a flight record. They are here rather
   than in the core only because they read the tuning settings; the geometry
   they lean on — anchors, bows, pacings — is all core. */

// Where you let go → the slot. A card you dragged has already been carried by
// a hand and shown to you at arm's length; the only thing left for the shell to
// do is take it the last few inches and set it down. Short, low, one leg.
function seatFlight(from, to, s) {
  return { poses: samplePath([from, to], [s.arcBow * 0.5], PACING.seat), duration: s.seatMs, lift: 2 };
}

// Off the top edge → held out toward the camera at the middle of the board →
// the slot. This is the *reveal*, so it is only ever used for a card the player
// has not already seen — which, since the player drags their own cards into
// play, means the opponent's. The bows are opposite so the card sweeps out on
// one side and comes back down the other rather than retracing its own line.
function deployFlight(from, to, board, s) {
  const stage = { x: board.width / 2, y: board.height / 2, rotation: 0, scale: s.stageScale };
  return {
    poses: samplePath([from, stage, to], [s.arcBow, -s.arcBow], PACING.deploy),
    duration: s.deployMs,
    lift: 2,
  };
}

// The hit pose → the graveyard. One long leg, bowed so the card falls away in
// an arc rather than sliding along the diagonal.
function fallFlight(hit, rest, s) {
  return { poses: samplePath([hit, rest], [-s.arcBow * 1.4], PACING.fall), duration: s.fallMs, lift: 1 };
}

// The whole clash, scripted before a frame of it plays. Both combatants give
// ground and come up to size; the attacker drives in on the sixth stop; the
// blocker is knocked back on the same stop. Whoever the core says falls simply
// stops there, and is handed its fall separately once it has finished dying.
function clashFlights(scene, fx, board, s) {
  const foe = OTHER[fx.side];
  const here = place(scene, board);
  const attackerAt = here.get(fx.attackerId);
  const slot = fieldTransform(fx.slot, foe, board);
  const bows = [s.arcBow * 0.6, s.arcBow * 0.25, -s.arcBow];

  const flights = [];
  const fallen = [];
  const at = new Map();

  const attackerRest = { ...attackerAt, scale: 1 };
  const squaredA = {
    ...toward(attackerAt, slot, -CLASH.squareBack),
    rotation: 0,
    scale: s.clashScale,
  };
  const reach = fx.kind === "burn" ? CLASH.burnReach : CLASH.reach;
  const contactA = {
    ...toward(attackerAt, slot, reach),
    rotation: fx.side === "player" ? -CLASH.kick * 0.5 : CLASH.kick * 0.5,
    scale: s.clashScale,
  };
  at.set(fx.attackerId, contactA);

  const attackerFalls = fx.kind === "clash" && fx.attackerFalls;
  flights.push([
    fx.attackerId,
    {
      poses: samplePath(
        attackerFalls ? [attackerRest, squaredA, contactA] : [attackerRest, squaredA, contactA, attackerRest],
        bows,
        attackerFalls ? PACING.lunge : PACING.strike
      ),
      duration: s.strikeMs,
      lift: 3, // the card driving the blow reads over the one taking it
    },
  ]);
  if (attackerFalls) fallen.push([fx.attackerId, contactA]);

  let impact = contactA;

  if (fx.kind === "clash") {
    const blockerAt = here.get(fx.targetId);
    const blockerRest = { ...blockerAt, scale: 1 };
    const squaredB = {
      ...toward(blockerAt, attackerAt, -CLASH.squareBack),
      rotation: 0,
      scale: s.clashScale,
    };
    const recoilB = {
      ...toward(squaredB, attackerAt, -CLASH.recoil),
      rotation: fx.side === "player" ? -CLASH.kick : CLASH.kick,
      scale: s.clashScale,
    };
    at.set(fx.targetId, recoilB);
    impact = { x: (contactA.x + recoilB.x) / 2, y: (contactA.y + recoilB.y) / 2 };

    flights.push([
      fx.targetId,
      {
        poses: samplePath(
          fx.blockerFalls ? [blockerRest, squaredB, recoilB] : [blockerRest, squaredB, recoilB, blockerRest],
          bows,
          fx.blockerFalls ? PACING.reel : PACING.absorb
        ),
        duration: s.strikeMs,
        lift: 2,
      },
    ]);
    if (fx.blockerFalls) fallen.push([fx.targetId, recoilB]);
  }

  return { flights, fallen, spots: { at, impact } };
}

// Said once, on the gate, with the button directly underneath — so none of
// these need to tell you how to start again.
const OUTCOME_TEXT = {
  player: "The opponent is out of life. You win.",
  opponent: "You are out of life.",
  stalemate: "Both decks and both boards are empty. Stalemate.",
};

// Memoized on primitive props (plus the two stable callbacks, the transform
// object place() hands back unchanged, and the flight record, which is stable
// for as long as it is in the air), so a card only re-renders when its own
// inputs move. During a drag that is the held card alone.
const Card = memo(function Card({
  id,
  card,
  mine,
  transform,
  depth,
  held,
  playable,
  entrance,
  perishing,
  perishMs,
  spent,
  departing,
  flight,
  onGrab,
  onQuickPlay,
}) {
  return (
    <div
      role={playable ? "button" : undefined}
      tabIndex={playable ? 0 : undefined}
      aria-label={playable ? `Play ${card.name}, power ${card.power}` : undefined}
      onPointerDown={playable ? (event) => onGrab(id, event) : undefined}
      onKeyDown={
        playable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onQuickPlay(id);
              }
            }
          : undefined
      }
      style={S.sprite(transform, depth, held, departing, playable, flight)}
    >
      <div style={S.face(card, mine, { perishing, perishMs, spent, entrance, held, departing })}>
        {card.faceUp ? (
          <>
            <span style={S.power(mine)}>{card.power}</span>
            <span style={S.name(card)}>{card.name}</span>
            {isMagic(card) && <span style={S.sigil}>✦</span>}
          </>
        ) : (
          <span style={S.backMark} />
        )}
      </div>
    </div>
  );
});

// Memoized so the ten slots stop rebuilding their style objects every drag
// frame; a slot only reconciles when its own highlight state flips.
const Slot = memo(function Slot({ x, y, state }) {
  return <div style={S.slot(x, y, state)} />;
});

// One sword per attacker, idling with a cute little wiggle so it reads as
// something you can poke. Goes still and dims the moment it can't be pressed
// — mid-animation, already struck, or not your turn — a native `disabled`
// button being the simplest way to make that also true for the keyboard and
// for hit-testing.
const AttackButton = memo(function AttackButton({ slot, x, y, name, enabled, onAttack }) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => onAttack(slot)}
      aria-label={`Attack with ${name}`}
      style={S.attackButton(x, y, enabled)}
    >
      <span aria-hidden="true" style={S.attackButtonGlyph(enabled)}>
        🗡️
      </span>
    </button>
  );
});

// Re-keyed on the wound nonce so the flash animation restarts on every hit;
// it is one small element, so the remount is cheaper than a parity dance.
const LifePlate = memo(function LifePlate({ side, life, wound }) {
  const hit = wound?.side === side;
  return (
    <div style={S.lifePlate(side)}>
      <span style={S.lifeLabel}>HP</span>
      <span key={hit ? wound.nonce : "calm"} style={S.lifeValue(hit)}>
        {life}
      </span>
    </div>
  );
});

// One burst = one absolutely positioned container and N particle divs, each
// running a single CSS animation on transform/opacity and never touched again.
// Memoized + seeded + carrying its own spec snapshot, so the component body
// runs once per burst; after that the compositor owns it. pointerEvents:none
// keeps it out of hit-testing on the drag path, and JUICE_DEPTH puts it in
// front of every card, the landing one included.
const Burst = memo(function Burst({ x, y, layers, seed, rim = CARD }) {
  const rand = mulberry32(seed);
  const particles = [];

  layers.forEach((layer, index) => {
    for (let i = 0; i < layer.count; i++) {
      // The emitter, entire. Everything below this line is rendering.
      const angle = rand() * TAU;
      const start = rimPoint(angle, rim);
      const distance = layer.distance * (0.5 + rand() * 0.8);
      const size = layer.size * (0.7 + rand() * 0.6);
      const life = layer.life * (0.6 + rand() * 0.4);
      particles.push(
        <span
          key={`${index}-${i}`}
          style={PARTICLE[layer.shape](start, start.ux * distance, start.uy * distance, size, life, layer.tint, angle)}
        />
      );
    }
    // The one flourish that is not a particle: a shockwave sized to the card
    // it came off, so even the ring is a property of the emitting body.
    if (layer.ring) {
      particles.push(<span key={`${index}-ring`} style={S.ring(rim, layer.life)} />);
    }
  });

  return <div style={S.burst(x, y)}>{particles}</div>;
});

/* ── styles ─────────────────────────────────────────────────────────────── */

const MONO = "'JetBrains Mono', 'SFMono-Regular', ui-monospace, monospace";
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Georgia, serif";

// Shake keyframes are generated from live settings: three levels × two parity
// variants. The two variants of a level are identical; alternating the *name*
// by nonce parity is what lets a shake restart while the previous one is
// still running, without re-keying the layer (which would remount every card
// on it). Frequency scales down slightly with amplitude so intense reads as
// heavy, not just wide.
const shakeFrames = (name, px) => {
  const swings = [[1, -0.7], [-1, 0.5], [0.75, 0.9], [-0.6, -0.6], [0.35, 0.4], [-0.15, -0.2]];
  const body = swings
    .map(([sx, sy], i) => {
      const at = Math.round(((i + 1) / (swings.length + 1)) * 100);
      const decay = 1 - i / swings.length;
      return `${at}% { transform: translate(${(sx * px * decay).toFixed(1)}px, ${(sy * px * decay).toFixed(1)}px); }`;
    })
    .join(" ");
  return `@keyframes ${name} { 0%, 100% { transform: translate(0, 0); } ${body} }`;
};

// The flight keyframe: one stop per sample, every value read from a custom
// property the sprite carries. One rule serves every arc in the game, and the
// pacing lives in where along the path each stop was taken. Two identical
// copies, picked by sequence parity, so a flight can replace a flight mid-air.
const flightFrames = (name) =>
  `@keyframes ${name} { ${FLIGHT_STOPS.map((at, i) => `${at}% { transform: var(--w${i}); }`).join(" ")} }`;

const buildKeyframes = (settings) => `
@keyframes deal { from { opacity: 0; transform: scale(0.72) translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes descend { from { opacity: 0; transform: scale(0.9) translateY(-44px); } to { opacity: 1; transform: none; } }
${flightFrames("flight-0")}
${flightFrames("flight-1")}
@keyframes perish {
  0%   { filter: brightness(1.75) saturate(.35); transform: translate(0, 0) scale(1); }
  7%   { filter: brightness(.62) saturate(.5); transform: translate(-7px, 3px) scale(1.03); }
  14%  { transform: translate(7px, -3px) scale(1.01); }
  21%  { transform: translate(-5px, 2px) scale(1); }
  29%  { transform: translate(4px, -2px) scale(.99); }
  37%  { transform: translate(-2px, 1px) scale(.98); }
  46%  { filter: grayscale(.4) brightness(.55); transform: translate(0, 0) scale(.97); }
  100% { filter: grayscale(.55) brightness(.62); transform: translate(0, 0) scale(.94); }
}
@keyframes wound-flash {
  0% { color: ${INK.wound}; transform: scale(1.35); }
  100% { color: inherit; transform: scale(1); }
}
@keyframes dust-puff {
  0% { opacity: .9; transform: translate(-50%, -50%) translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(.25); }
}
@keyframes dust-linger {
  0% { opacity: 0; transform: translate(-50%, -50%) translate(0, 0) scale(.7); }
  12% { opacity: .5; }
  55% { opacity: .32; }
  100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(1.6); }
}
@keyframes streak-fly {
  0% { opacity: 1; transform: translate(-50%, -50%) translate(0, 0) rotate(var(--rot)) scaleY(1); }
  60% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) rotate(var(--rot)) scaleY(.35); }
}
@keyframes arc-ring {
  0% { opacity: .9; transform: scale(.82); }
  100% { opacity: 0; transform: scale(2.1); }
}
@keyframes sword-wiggle {
  0%, 100% { transform: rotate(-16deg); }
  50% { transform: rotate(16deg); }
}
@keyframes end-turn-shimmer {
  0%, 100% { box-shadow: 0 0 0 rgba(232, 196, 103, 0); }
  50% { box-shadow: 0 0 14px 4px rgba(232, 196, 103, .75); }
}
@keyframes hand-halo-pulse {
  0%, 100% { opacity: .5; }
  50% { opacity: .85; }
}
${SHAKE_LEVELS.flatMap((level) => [0, 1].map((v) => shakeFrames(`shake-${level}-${v}`, shakeOf(settings, level).px))).join("\n")}
.tcg-poc [role="button"]:focus-visible { outline: 2px solid ${INK.brass}; outline-offset: 3px; border-radius: 6px; }
.tcg-poc button:focus-visible { outline: 2px solid ${INK.brass}; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .tcg-poc, .tcg-poc * { transition-duration: 1ms !important; animation-duration: 1ms !important; } }

/* Portrait. The table is a landscape object — five slots across, two rows and
   two hands deep — so on a phone it is given a shape close to its own rather
   than the screen's. Stretching it to a phone's aspect would only pad the
   space between the rows with emptiness: the cards do not grow to fill it. */
@media (max-width: 700px) {
  /* !important because the frame's height is an inline style, and inline
     wins over a stylesheet rule regardless of order. */
  .tcg-poc {
    height: auto !important;
    aspect-ratio: 2 / 3;
    max-height: calc(100dvh - 24px);
    font-size: 11px;
  }
}
`;

const S = {
  frame: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    // Tall enough for the table on a desktop, but never taller than the
    // viewport it is sitting in — on a phone the demo should be the screen,
    // not something you scroll through. Height, not min-height: the board
    // flexes into whatever is left after the header.
    height: "min(720px, calc(100dvh - 32px))",
    minHeight: 460,
    borderRadius: 10,
    overflow: "hidden",
    border: `1px solid ${INK.tableEdge}`,
    background: INK.table,
    color: INK.text,
    fontFamily: MONO,
    fontSize: 12,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 14px",
    background: INK.chrome,
    borderBottom: `1px solid ${INK.rule}`,
  },
  status: { flex: 1, color: INK.text, opacity: 0.8, minWidth: 0 },
  // The mid-game action. Quiet next to the gate lettering — it is a button you
  // press many times a game, not a threshold you cross twice. `shimmer` is the
  // one exception: once the attack phase has nothing left owed to it, the
  // button itself says so, in the one color nothing else on the table uses.
  turnButton: (disabled, shimmer) => ({
    flexShrink: 0,
    padding: "6px 14px",
    minHeight: 34,
    borderRadius: 4,
    border: `1px solid ${shimmer ? "#e8c467" : disabled ? INK.rule : "#3d6252"}`,
    background: disabled ? "transparent" : "#1d3830",
    color: shimmer ? "#f7e4a8" : disabled ? INK.dim : INK.text,
    font: "inherit",
    letterSpacing: 0.4,
    cursor: disabled ? "default" : "pointer",
    touchAction: "manipulation",
    animation: shimmer ? "end-turn-shimmer 1.6s ease-in-out infinite" : "none",
  }),
  // Below the card it belongs to, small and round, wiggling like it wants to
  // be pressed. Disabled state is flat and still — no motion is the tell that
  // nothing will happen if you press it.
  attackButton: (x, y, enabled) => ({
    position: "absolute",
    left: x - 16,
    top: y,
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: `1px solid ${enabled ? INK.brass : INK.rule}`,
    background: enabled
      ? "linear-gradient(180deg, #3a5c4c, #1c342a)"
      : "rgba(20,32,28,.45)",
    color: enabled ? INK.parchment : INK.dim,
    fontSize: 15,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: enabled ? "pointer" : "default",
    boxShadow: enabled ? "0 2px 8px rgba(0,0,0,.4)" : "none",
    zIndex: ATTACK_BUTTON_DEPTH,
    transformOrigin: "50% 0%",
    animation: enabled ? "sword-wiggle 1.9s ease-in-out infinite" : "none",
    transition: "opacity 160ms ease, background 160ms ease, border-color 160ms ease",
    touchAction: "manipulation",
  }),
  // Full-color emoji ignores `color`, so dimming for the disabled state has
  // to happen here via opacity instead of riding along with the button's
  // currentColor the way the old stroked SVG did.
  attackButtonGlyph: (enabled) => ({
    fontSize: 15,
    lineHeight: 1,
    opacity: enabled ? 1 : 0.5,
    transform: "rotate(180deg)",
    transition: "opacity 160ms ease",
  }),
  board: {
    position: "relative",
    flex: 1,
    overflow: "hidden",
    touchAction: "none",
    background: `radial-gradient(120% 90% at 50% 50%, #17302a 0%, ${INK.table} 74%)`,
  },
  // The table's own coordinate space, drawn at whatever scale fits the board.
  // Anchored top-left so the scale is a pure multiplier on every coordinate
  // inside — which is exactly the conversion the pointer undoes.
  stage: (board) => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: board.width,
    height: board.height,
    transform: `scale(${board.scale})`,
    transformOrigin: "0 0",
  }),
  // The rumble surface. Cheap when idle (no animation, no layer); promoted by
  // the browser only while a shake animation is live.
  shakeLayer: (shake) => ({
    position: "absolute",
    inset: 0,
    animation: shake ? `shake-${shake.level}-${shake.nonce % 2} ${shake.ms}ms linear both` : "none",
  }),
  // The one piece of chrome that carries state: which half of the table is
  // live. Brass toward you, verdigris toward them.
  midline: (turn, running) => ({
    position: "absolute",
    left: 40,
    right: 40,
    top: "50%",
    height: 1,
    background: `linear-gradient(90deg, transparent, ${
      running ? INK.rule : turn === "player" ? "rgba(165,136,63,.5)" : "rgba(111,143,134,.5)"
    }, transparent)`,
    transition: "background 300ms ease",
    pointerEvents: "none",
  }),
  // The hand's own tell, the mirror of the sword wiggle: a soft glow under the
  // cards rather than motion on them, since a whole hand moving would read as
  // noise. Centred a little below the card row so its brightest point falls
  // in the open table beneath the fan rather than under the card art, where
  // it would be spent hiding behind the very thing it is meant to be seen
  // under. Sits low in the stack, behind every card either way.
  handHalo: (board) => ({
    position: "absolute",
    left: board.width / 2 - HAND_HALO.width / 2,
    top: board.height - HAND.fromBottom + CARD.height / 2 + 26 - HAND_HALO.height / 2,
    width: HAND_HALO.width,
    height: HAND_HALO.height,
    borderRadius: "50%",
    background: "radial-gradient(closest-side, rgba(232,196,103,.5), rgba(232,196,103,0) 68%)",
    animation: "hand-halo-pulse 2.6s ease-in-out infinite",
    pointerEvents: "none",
    zIndex: 0,
  }),
  lifePlate: (side) => ({
    position: "absolute",
    right: 18,
    [side === "player" ? "bottom" : "top"]: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
    padding: "6px 10px",
    borderRadius: 5,
    border: `1px solid ${side === "player" ? "rgba(165,136,63,.4)" : "rgba(111,143,134,.4)"}`,
    background: "rgba(8, 20, 17, .6)",
    pointerEvents: "none",
  }),
  lifeLabel: { fontSize: 9, letterSpacing: 1.6, textTransform: "uppercase", color: INK.dim },
  lifeValue: (hit) => ({
    fontFamily: SERIF,
    fontSize: 22,
    lineHeight: 1,
    color: INK.text,
    fontVariantNumeric: "tabular-nums",
    animation: hit ? "wound-flash 460ms ease-out both" : "none",
  }),
  slot: (x, y, state) => ({
    position: "absolute",
    left: x - CARD.width / 2,
    top: y - CARD.height / 2,
    width: CARD.width,
    height: CARD.height,
    borderRadius: 6,
    border: `1px ${state === "target" || state === "blocked" ? "solid" : "dashed"} ${SLOT_EDGE[state]}`,
    background: SLOT_FILL[state],
    boxShadow: state === "target" ? `0 0 0 3px rgba(165,136,63,.14)` : "none",
    transition: "border-color 140ms ease, background 140ms ease, box-shadow 140ms ease",
    pointerEvents: "none",
  }),
  /* ── the gate: begin, and begin again ───────────────────────────────────
     Sits on the board rather than the stage, so it is measured in screen
     pixels and stays legible at any scale — the one piece of the table that
     should not shrink with a phone. */
  gate: {
    position: "absolute",
    inset: 0,
    zIndex: 1500,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    padding: 24,
    textAlign: "center",
    background: "radial-gradient(60% 50% at 50% 50%, rgba(6,12,10,.72), rgba(6,12,10,.92))",
    backdropFilter: "blur(1.5px)",
  },
  gateLine: {
    fontFamily: SERIF,
    fontSize: 17,
    letterSpacing: 0.4,
    color: INK.text,
    opacity: 0.9,
    maxWidth: "26ch",
    lineHeight: 1.4,
  },
  // Brass on dark, letter-spaced small caps, a hairline inside the border:
  // the lettering the rest of the table is set in, given room.
  gateButton: (disabled) => ({
    fontFamily: SERIF,
    fontSize: 20,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    color: disabled ? "rgba(165,136,63,.55)" : INK.brass,
    padding: "14px 34px 14px 40px", // the extra left pad balances the tracking
    minHeight: 48,
    borderRadius: 3,
    border: `1px solid rgba(165,136,63,.55)`,
    outline: `1px solid rgba(165,136,63,.18)`,
    outlineOffset: 3,
    background: "linear-gradient(180deg, rgba(30,44,38,.95), rgba(14,26,22,.95))",
    boxShadow: "0 2px 18px rgba(0,0,0,.45), inset 0 1px 0 rgba(239,227,195,.08)",
    cursor: disabled ? "default" : "pointer",
    touchAction: "manipulation",
  }),
  // The wrapper owns position and, while a flight is on, nothing else does.
  // The base transform carries scale(1) so it is the same shape as a pose:
  // when the flight is dropped, the value underneath is already the value the
  // last keyframe held, and the card does not move.
  sprite: (t, depth, held, departing, playable, flight) => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: CARD.width,
    height: CARD.height,
    transform: poseTransform({ ...t, scale: 1 }),
    transition: held || flight ? "none" : `transform ${MOVE_MS}ms cubic-bezier(.2,.8,.2,1), opacity ${EXIT_MS}ms ease`,
    zIndex: depth,
    opacity: departing ? 0 : 1,
    // Promote only the card that is actively moving to its own compositor
    // layer, so drag and flight frames repaint nothing underneath them.
    willChange: held || flight ? "transform" : "auto",
    cursor: playable ? (held ? "grabbing" : "grab") : "default",
    userSelect: "none",
    touchAction: "none",
    ...(flight ? flightStyle(flight) : null),
  }),
  // The face carries every animation that is about the card rather than its
  // position: the entrance, the death. The wrapper owns the position, so the
  // two never fight. A card that has been struck darkens where it stands and
  // stays darkened once it is in the graveyard — the animation's last frame
  // and the resting style agree, so nothing snaps when it ends.
  face: (card, mine, { perishing, perishMs = 720, spent, entrance, held, departing }) => {
    const magic = isMagic(card);
    const stock = mine
      ? `linear-gradient(158deg, ${INK.parchment} 0%, ${INK.parchmentEdge} 100%)`
      : `linear-gradient(158deg, ${INK.ash} 0%, ${INK.ashEdge} 100%)`;
    // card.image is the studio's flattened render of the whole card (title,
    // portrait, flavor, stats already baked in) — the same render an
    // operator sees in Card Studio, just shrunk to card-slot size here. The
    // bottom scrim keeps the name label (drawn on top, see S.name) legible
    // over whatever the art looks like. `stock` stays as a background layer
    // under the image, so a 404'd/loading image still shows the plain card
    // back instead of a blank rectangle.
    const faceBackground = card.image
      ? `linear-gradient(180deg, rgba(10,14,12,0) 52%, rgba(10,14,12,.82) 100%), url("${card.image}") center / cover no-repeat, ${stock}`
      : stock;
    const edge = mine ? INK.brass : INK.verdigris;
    const animation =
      perishing ? `perish ${perishMs}ms cubic-bezier(.2,.7,.3,1) both`
      : entrance ? `${entrance} ${ENTER_MS}ms cubic-bezier(.2,.8,.2,1) both`
      : undefined;
    // Cards drawn from the studio pool carry a rarity; the fixed fallback
    // deck doesn't, and reads as "common" (no ring) rather than erroring.
    const rarityGlow = RARITY_RING[card.rarity];
    const boxShadow = [
      magic ? "inset 0 0 14px rgba(126,205,255,.28)" : null,
      rarityGlow ? `0 0 0 2px ${rarityGlow}` : null,
      held ? "0 14px 28px rgba(0,0,0,.5)" : "0 2px 5px rgba(0,0,0,.35)",
    ]
      .filter(Boolean)
      .join(", ");
    return {
      position: "relative",
      width: "100%",
      height: "100%",
      borderRadius: 6,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: card.faceUp
        ? faceBackground
        : `linear-gradient(158deg, ${mine ? INK.back : INK.oppBack} 0%, ${mine ? "#1b332c" : "#241a1f"} 100%)`,
      border: `1px solid ${card.faceUp ? edge : mine ? "#162923" : "#2a1e22"}`,
      boxShadow,
      filter: spent && !perishing ? "grayscale(.55) brightness(.62)" : "none",
      transform: `scale(${held ? 1.06 : departing ? 0.82 : spent ? 0.94 : 1})`,
      transition: "background 200ms ease, box-shadow 160ms ease, transform 160ms ease, opacity 300ms ease",
      animation,
    };
  },
  power: (mine) => ({
    position: "absolute",
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: `1px solid ${mine ? INK.brass : INK.verdigris}`,
    background: mine ? "#f7efd7" : "#e6eaee",
    color: mine ? "#4a3a10" : "#25333a",
    fontSize: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  // A function of card because the color has to invert over card art: the
  // parchment/ash stock is light (dark text), but the bottom scrim over an
  // image is dark (needs light text + a shadow to stay legible on any art).
  name: (card) => ({
    fontFamily: SERIF,
    fontSize: 12,
    lineHeight: 1.2,
    color: card.image ? "#f3ead0" : "#2c2410",
    textShadow: card.image ? "0 1px 3px rgba(0,0,0,.85)" : "none",
    textAlign: "center",
    padding: "0 7px",
  }),
  sigil: { position: "absolute", bottom: 5, right: 7, fontSize: 11, color: "#3d6b86" },
  backMark: {
    width: 24,
    height: 24,
    border: `1px solid rgba(157,185,174,.35)`,
    borderRadius: 3,
    transform: "rotate(45deg)",
  },
  /* burst container: above every card, never hit-tested, gone within its
     longest particle's life. */
  burst: (x, y) => ({
    position: "absolute",
    left: x,
    top: y,
    width: 0,
    height: 0,
    zIndex: JUICE_DEPTH,
    pointerEvents: "none",
  }),
  ring: (rim, duration) => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: rim.width,
    height: rim.height,
    marginLeft: -rim.width / 2,
    marginTop: -rim.height / 2,
    borderRadius: 8,
    border: `1px solid ${INK.arcGlow}`,
    boxShadow: `0 0 18px 2px ${INK.arcGlow}`,
    opacity: 0,
    animation: `arc-ring ${Math.round(duration * 1.15)}ms cubic-bezier(.15,.8,.3,1) both`,
  }),
};

/* ── particles ────────────────────────────────────────────────────────────
   Every particle in the game is emitted the same way: it starts on the card's
   rim and carries one outward vector, `--dx`/`--dy`. That much is shared, and
   `emitted` is where the sharing lives. A shape may only decide what it looks
   like while it travels — shrink, swell, or stretch along the heading — which
   is why a spark and a mote from the same burst always agree about where they
   came from and which way they are going. */

const emitted = (start, dx, dy) => ({
  position: "absolute",
  left: start.x,
  top: start.y,
  opacity: 0,
  "--dx": `${dx.toFixed(1)}px`,
  "--dy": `${dy.toFixed(1)}px`,
});

const PARTICLE = {
  // Small, fast, gone: the visible edge of the impact.
  mote: (start, dx, dy, size, life) => ({
    ...emitted(start, dx, dy),
    width: size,
    height: size,
    borderRadius: "50%",
    background: INK.dust,
    animation: `dust-puff ${Math.round(life)}ms cubic-bezier(.2,.7,.4,1) both`,
  }),
  // Big, slow, lingering: the air the impact displaced.
  cloud: (start, dx, dy, size, life) => ({
    ...emitted(start, dx, dy),
    width: size,
    height: size,
    borderRadius: "50%",
    background: INK.dustCloud,
    filter: "blur(1.5px)",
    animation: `dust-linger ${Math.round(life)}ms ease-out both`,
  }),
  // A thin line rotated onto its own heading, so it reads as a discharge
  // rather than confetti. `--rot` orients it; the travel is the shared vector.
  streak: (start, dx, dy, size, life, tint, angle) => {
    const cold = tint === "cold";
    return {
      ...emitted(start, dx, dy),
      width: 2,
      height: size,
      borderRadius: 1,
      background: cold
        ? `linear-gradient(${INK.arcHot}, ${INK.verdigris})`
        : `linear-gradient(${INK.sparkHot}, ${INK.brass})`,
      boxShadow: `0 0 6px 1px ${cold ? INK.arcGlow : INK.sparkGlow}`,
      "--rot": `${(((angle * 180) / Math.PI + 90) % 360).toFixed(1)}deg`,
      animation: `streak-fly ${Math.round(life)}ms cubic-bezier(.1,.8,.3,1) both`,
    };
  },
};
