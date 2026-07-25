import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateCard, runMigrations, CURRENT_SCHEMA_VERSION } from "../migrate.js";

test("migrateCard: a current-version card passes through unchanged", () => {
  const card = { schema_version: CURRENT_SCHEMA_VERSION, id: "card_x", title: "Test" };
  const result = migrateCard(card);
  assert.deepEqual(result, card);
});

test("runMigrations: throws if schema_version is missing", () => {
  assert.throws(() => runMigrations({}, {}, 1), /schema_version/);
});

test("runMigrations: fails loudly on a card newer than this app understands", () => {
  assert.throws(() => runMigrations({ schema_version: 5 }, {}, 1), /newer/);
});

test("runMigrations: fails loudly when no migration is registered for an old version", () => {
  assert.throws(() => runMigrations({ schema_version: 0 }, {}, 1), /No migration registered/);
});

test("runMigrations: applies a registered v0->v1 step (contrived, proves the mechanism)", () => {
  const migrations = {
    0: (card) => ({ ...card, schema_version: 1, migratedField: true }),
  };
  const result = runMigrations({ schema_version: 0, id: "card_x" }, migrations, 1);
  assert.equal(result.schema_version, 1);
  assert.equal(result.migratedField, true);
  assert.equal(result.id, "card_x");
});

test("runMigrations: chains multiple steps in order (v0->v1->v2)", () => {
  const migrations = {
    0: (card) => ({ ...card, schema_version: 1, steps: [...(card.steps || []), "0to1"] }),
    1: (card) => ({ ...card, schema_version: 2, steps: [...card.steps, "1to2"] }),
  };
  const result = runMigrations({ schema_version: 0, steps: [] }, migrations, 2);
  assert.equal(result.schema_version, 2);
  assert.deepEqual(result.steps, ["0to1", "1to2"]);
});

test("runMigrations: guards against a step that doesn't advance schema_version", () => {
  const migrations = { 0: (card) => ({ ...card, schema_version: 0 }) };
  assert.throws(() => runMigrations({ schema_version: 0 }, migrations, 1), /did not advance/);
});
