import { test } from "node:test";
import assert from "node:assert/strict";
import { listBattleReadyCards, publishCard, saveCard, loadCard } from "../cards.js";
import { FakeD1 } from "./fakes.js";

function seedCard(db, overrides = {}) {
  const card = {
    schema_version: 2,
    id: "card_1",
    title: "Ashfall Herald",
    portrait: null,
    flavor: { text: "", source: "generated", prompt_version: null },
    gem: null,
    stats: [],
    power: null,
    rarity: "common",
    battle_ready: false,
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
  const result = await publishCard(db, "card_1");
  assert.match(result.error, /power/);
  const stored = await loadCard(db, "card_1");
  assert.equal(stored.battle_ready, false);
});

test("publishCard rejects a non-positive or non-numeric power", async () => {
  const db = new FakeD1();
  for (const power of [0, -3, "7", NaN]) {
    seedCard(db, { power, rarity: "rare" });
    const result = await publishCard(db, "card_1");
    assert.match(result.error, /power/, String(power));
  }
});

test("publishCard rejects a missing or unknown rarity", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 5, rarity: "mythic" });
  const result = await publishCard(db, "card_1");
  assert.match(result.error, /rarity/);
});

test("publishCard rejects an unknown card id", async () => {
  const db = new FakeD1();
  const result = await publishCard(db, "nope");
  assert.equal(result.notFound, true);
});

test("publishCard sets battle_ready once power and rarity are both valid", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 7, rarity: "legendary" });
  const result = await publishCard(db, "card_1");
  assert.equal(result.card.battle_ready, true);
  const stored = await loadCard(db, "card_1");
  assert.equal(stored.battle_ready, true);
  assert.equal(stored.power, 7);
});

test("listBattleReadyCards returns only published cards, projected to id/name/power/rarity", async () => {
  const db = new FakeD1();
  seedCard(db, { id: "card_1", title: "Ashfall Herald", power: 7, rarity: "legendary", battle_ready: true });
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
  assert.deepEqual(pool[0], { id: "card_1", name: "Ashfall Herald", power: 7, rarity: "legendary" });
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
  const card = seedCard(db, { power: 3, rarity: "uncommon", battle_ready: true });
  const saved = await saveCard(db, "card_1", card);
  assert.equal(saved.power, 3);
  assert.equal(saved.rarity, "uncommon");
  assert.equal(saved.battle_ready, true);
});

test("saveCard silently drops battle_ready if the saved card no longer has valid power/rarity", async () => {
  const db = new FakeD1();
  seedCard(db, { power: 5, rarity: "rare" });
  await publishCard(db, "card_1");

  // Operator clears power mid-edit and saves without re-publishing.
  const edited = { ...(await loadCard(db, "card_1")), power: null };
  const saved = await saveCard(db, "card_1", edited);
  assert.equal(saved.battle_ready, false);

  const pool = await listBattleReadyCards(db);
  assert.equal(pool.length, 0);
});
