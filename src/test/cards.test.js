import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listBattleReadyCards,
  publishCard,
  saveCard,
  loadCard,
  isPublishedImageHash,
  listCards,
  archiveCard,
  unarchiveCard,
} from "../cards.js";
import { FakeD1 } from "./fakes.js";

const VALID_HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);

function seedCard(db, overrides = {}) {
  const card = {
    schema_version: 3,
    id: "card_1",
    title: "Ashfall Herald",
    portrait: null,
    flavor: { text: "", source: "generated", prompt_version: null },
    gem: null,
    stats: [],
    power: null,
    rarity: "common",
    battle_ready: false,
    battler_image: null,
    archived: false,
    ...overrides,
  };
  db.cards.set(card.id, {
    id: card.id,
    schema_version: card.schema_version,
    json: JSON.stringify(card),
    updated_at: "2026-01-01T00:00:00.000Z",
  });
  return card;
}

test("publishCard rejects a card with no power", async () => {
  const db = new FakeD1();
  seedCard(db, { power: null, rarity: "rare" });
  const result = await publishCard(db, "card_1", { imageHash: VALID_HASH });
  assert.match(result.error, /power/);
  const stored = await loadCard(db, "card_1");
  assert.equal(stored.battle_ready, false);
});

test("publishCard rejects a non-positive or non-numeric power", async () => {
  const db = new FakeD1();
  for (const power of [0, -3, "7", NaN]) {
    seedCard(db, { power, rarity: "rare" });
    const result = await publishCard(db, "card_1", { imageHash: VALID_HASH });
    assert.match(result.error, /power/, String(power));
  }
});

test("publishCard rejects a missing or unknown rarity", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 5, rarity: "mythic" });
  const result = await publishCard(db, "card_1", { imageHash: VALID_HASH });
  assert.match(result.error, /rarity/);
});

test("publishCard rejects an unknown card id", async () => {
  const db = new FakeD1();
  const result = await publishCard(db, "nope", { imageHash: VALID_HASH });
  assert.equal(result.notFound, true);
});

test("publishCard rejects a missing or malformed image hash", async () => {
  const db = new FakeD1();
  for (const imageHash of [undefined, null, "", "not-a-hash", "a".repeat(63)]) {
    seedCard(db, { power: 5, rarity: "rare" });
    const result = await publishCard(db, "card_1", { imageHash });
    assert.match(result.error, /image/i, String(imageHash));
    const stored = await loadCard(db, "card_1");
    assert.equal(stored.battle_ready, false);
  }
});

test("publishCard sets battle_ready and stores the image hash once everything is valid", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 7, rarity: "legendary" });
  const result = await publishCard(db, "card_1", { imageHash: VALID_HASH });
  assert.equal(result.card.battle_ready, true);
  assert.equal(result.card.battler_image, VALID_HASH);
  const stored = await loadCard(db, "card_1");
  assert.equal(stored.battle_ready, true);
  assert.equal(stored.power, 7);
  assert.equal(stored.battler_image, VALID_HASH);
});

test("publishCard re-publishing without a new imageHash keeps the card's existing image", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 7, rarity: "legendary" });
  await publishCard(db, "card_1", { imageHash: VALID_HASH });

  // Operator bumps power and republishes without re-rendering art.
  const edited = { ...(await loadCard(db, "card_1")), power: 9 };
  await saveCard(db, "card_1", edited);
  const result = await publishCard(db, "card_1", {});
  assert.equal(result.card.battle_ready, true);
  assert.equal(result.card.battler_image, VALID_HASH);
});

test("listBattleReadyCards returns only published cards, projected to id/name/power/rarity/imageHash", async () => {
  const db = new FakeD1();
  seedCard(db, {
    id: "card_1",
    title: "Ashfall Herald",
    power: 7,
    rarity: "legendary",
    battle_ready: true,
    battler_image: VALID_HASH,
  });
  seedCard(db, { id: "card_2", title: "Unfinished Draft", power: null, rarity: "common", battle_ready: false });
  db.cards.get("card_2").json = JSON.stringify({
    ...JSON.parse(db.cards.get("card_1").json),
    id: "card_2",
    title: "Unfinished Draft",
    power: null,
    battle_ready: false,
  });

  const pool = await listBattleReadyCards(db);
  assert.equal(pool.length, 1);
  assert.deepEqual(pool[0], { id: "card_1", name: "Ashfall Herald", power: 7, rarity: "legendary", imageHash: VALID_HASH });
});

test("listBattleReadyCards excludes a battle_ready card left over from before the image requirement", async () => {
  // Simulates a card published while battle_ready only required power+rarity,
  // before publishCard started requiring an image too. The flag is stale
  // relative to today's rules and must not surface an image-less card.
  const db = new FakeD1();
  seedCard(db, { id: "card_1", title: "Cherry Bomb", power: 26, rarity: "uncommon", battle_ready: true, battler_image: null });

  const pool = await listBattleReadyCards(db);
  assert.equal(pool.length, 0);
});

test("isPublishedImageHash rejects a stale battle_ready card missing valid stats", async () => {
  const db = new FakeD1();
  seedCard(db, { id: "card_1", power: null, rarity: "common", battle_ready: true, battler_image: VALID_HASH });

  assert.equal(await isPublishedImageHash(db, VALID_HASH), false);
});

test("listBattleReadyCards migrates older stored cards before filtering", async () => {
  const db = new FakeD1();
  const v1 = { schema_version: 1, id: "card_old", title: "Pre-battler Card" };
  db.cards.set("card_old", { id: "card_old", schema_version: 1, json: JSON.stringify(v1), updated_at: "2025-01-01T00:00:00.000Z" });

  const pool = await listBattleReadyCards(db);
  assert.equal(pool.length, 0); // migrated defaults are battle_ready: false
});

test("saveCard round-trips the new battler fields", async () => {
  const db = new FakeD1();
  const card = seedCard(db, { power: 3, rarity: "uncommon", battle_ready: true, battler_image: VALID_HASH });
  const saved = await saveCard(db, "card_1", card);
  assert.equal(saved.power, 3);
  assert.equal(saved.rarity, "uncommon");
  assert.equal(saved.battle_ready, true);
  assert.equal(saved.battler_image, VALID_HASH);
});

test("saveCard silently drops battle_ready if the saved card no longer has valid power/rarity", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 5, rarity: "rare" });
  await publishCard(db, "card_1", { imageHash: VALID_HASH });

  // Operator clears power mid-edit and saves without re-publishing.
  const edited = { ...(await loadCard(db, "card_1")), power: null };
  const saved = await saveCard(db, "card_1", edited);
  assert.equal(saved.battle_ready, false);

  const pool = await listBattleReadyCards(db);
  assert.equal(pool.length, 0);
});

test("saveCard silently drops battle_ready if the image hash becomes invalid", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 5, rarity: "rare" });
  await publishCard(db, "card_1", { imageHash: VALID_HASH });

  const edited = { ...(await loadCard(db, "card_1")), battler_image: null };
  const saved = await saveCard(db, "card_1", edited);
  assert.equal(saved.battle_ready, false);
});

test("isPublishedImageHash is true only for the hash a battle_ready card currently points at", async () => {
  const db = new FakeD1();
  seedCard(db, { id: "card_1", power: 5, rarity: "rare" });
  await publishCard(db, "card_1", { imageHash: VALID_HASH });

  assert.equal(await isPublishedImageHash(db, VALID_HASH), true);
  assert.equal(await isPublishedImageHash(db, OTHER_HASH), false);
});

test("isPublishedImageHash is false for an unpublished card's image (never made it into the pool)", async () => {
  const db = new FakeD1();
  seedCard(db, { id: "card_1", power: null, rarity: "common", battler_image: VALID_HASH, battle_ready: false });

  assert.equal(await isPublishedImageHash(db, VALID_HASH), false);
});

test("isPublishedImageHash goes false once a card is republished with a different image", async () => {
  const db = new FakeD1();
  seedCard(db, { id: "card_1", power: 5, rarity: "rare" });
  await publishCard(db, "card_1", { imageHash: VALID_HASH });

  const edited = { ...(await loadCard(db, "card_1")) };
  await saveCard(db, "card_1", edited);
  await publishCard(db, "card_1", { imageHash: OTHER_HASH });

  assert.equal(await isPublishedImageHash(db, VALID_HASH), false);
  assert.equal(await isPublishedImageHash(db, OTHER_HASH), true);
});

test("archiveCard pulls a published card out of the pool immediately", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 5, rarity: "rare" });
  await publishCard(db, "card_1", { imageHash: VALID_HASH });

  const result = await archiveCard(db, "card_1");
  assert.equal(result.card.archived, true);
  assert.equal(result.card.battle_ready, false);

  const pool = await listBattleReadyCards(db);
  assert.equal(pool.length, 0);
});

test("archiveCard rejects an unknown card id", async () => {
  const db = new FakeD1();
  const result = await archiveCard(db, "nope");
  assert.equal(result.notFound, true);
});

test("unarchiveCard clears archived but does not restore battle_ready on its own", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 5, rarity: "rare" });
  await publishCard(db, "card_1", { imageHash: VALID_HASH });
  await archiveCard(db, "card_1");

  const result = await unarchiveCard(db, "card_1");
  assert.equal(result.card.archived, false);
  assert.equal(result.card.battle_ready, false); // requires a deliberate re-publish

  const pool = await listBattleReadyCards(db);
  assert.equal(pool.length, 0);

  await publishCard(db, "card_1", {});
  assert.equal((await listBattleReadyCards(db)).length, 1);
});

test("publishCard rejects an archived card", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 5, rarity: "rare" });
  await publishCard(db, "card_1", { imageHash: VALID_HASH });
  await archiveCard(db, "card_1");

  const result = await publishCard(db, "card_1", { imageHash: VALID_HASH });
  assert.match(result.error, /archived/i);
});

test("saveCard cannot smuggle battle_ready back onto an archived card", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 5, rarity: "rare" });
  await publishCard(db, "card_1", { imageHash: VALID_HASH });
  await archiveCard(db, "card_1");

  const edited = { ...(await loadCard(db, "card_1")), battle_ready: true };
  const saved = await saveCard(db, "card_1", edited);
  assert.equal(saved.battle_ready, false);
});

test("listCards excludes archived cards by default and archivedOnly shows just them", async () => {
  const db = new FakeD1();
  seedCard(db, { id: "card_1", title: "Active Card" });
  seedCard(db, { id: "card_2", title: "Archived Card", archived: true });

  const active = await listCards(db);
  assert.deepEqual(active.map((c) => c.id), ["card_1"]);

  const archived = await listCards(db, { archivedOnly: true });
  assert.deepEqual(archived.map((c) => c.id), ["card_2"]);
});

test("listCards projects power/rarity/battle_ready/archived for the sidebar's at-a-glance status", async () => {
  const db = new FakeD1();
  seedCard(db, { id: "card_1", title: "Ashfall Herald", power: 7, rarity: "legendary", battle_ready: true, battler_image: VALID_HASH });

  const [row] = await listCards(db);
  assert.deepEqual(row, {
    id: "card_1",
    title: "Ashfall Herald",
    updated_at: "2026-01-01T00:00:00.000Z",
    power: 7,
    rarity: "legendary",
    battle_ready: true,
    archived: false,
  });
});
