import { test } from "node:test";
import assert from "node:assert/strict";
import { handleFlavor, buildFlavorInput } from "../flavor.js";
import { FakeD1 } from "./fakes.js";
import { CURRENT_SCHEMA_VERSION } from "../../private/c33f3ea406426b41/cards/migrate.js";

function baseCard(overrides = {}) {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    id: "card_1",
    template_version: 3,
    title: "Ashfall Herald",
    portrait: { user_prompt: "a herald wreathed in ash", lineage: [] },
    flavor: { text: "", source: "generated", prompt_version: null },
    gem: null,
    stats: [],
    ...overrides,
  };
}

function seedCard(db, card) {
  db.cards.set(card.id, {
    id: card.id,
    schema_version: card.schema_version,
    json: JSON.stringify(card),
    updated_at: "2026-01-01T00:00:00.000Z",
  });
}

function req(body) {
  return new Request("http://x/api/flavor", { method: "POST", body: JSON.stringify(body) });
}

test("buildFlavorInput includes title, theme, guidance, and the char budget", () => {
  const input = buildFlavorInput({ title: "T", theme: "C", guidance: "G", maxChars: 200 });
  assert.match(input, /Card title: T/);
  assert.match(input, /Card concept: C/);
  assert.match(input, /Operator guidance: G/);
  assert.match(input, /200 characters/);
});

test("text under the limit on the first try is saved as-is, no retry", async () => {
  const db = new FakeD1();
  seedCard(db, baseCard());
  let calls = 0;
  const fakeGenerate = async () => {
    calls++;
    return { interactionId: "int_1", text: "Short and evocative." };
  };

  const resp = await handleFlavor(req({ card_id: "card_1" }), { CARD_DB: db }, { generateText: fakeGenerate });
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.text, "Short and evocative.");
  assert.equal(body.truncated, false);
  assert.equal(calls, 1);

  const stored = JSON.parse(db.cards.get("card_1").json);
  assert.equal(stored.flavor.text, "Short and evocative.");
  assert.equal(stored.flavor.source, "generated");
});

test("text over the limit retries once, threaded via previous_interaction_id", async () => {
  const db = new FakeD1();
  seedCard(db, baseCard());
  const calls = [];
  const fakeGenerate = async (_env, args) => {
    calls.push(args);
    if (calls.length === 1) {
      return { interactionId: "int_1", text: "x".repeat(50) };
    }
    return { interactionId: "int_2", text: "short now" };
  };

  const resp = await handleFlavor(
    req({ card_id: "card_1", max_chars: 20 }),
    { CARD_DB: db },
    { generateText: fakeGenerate },
  );
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.text, "short now");
  assert.equal(body.truncated, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].previousInteractionId, "int_1");
});

test("still over the limit after the retry gets truncated at a word boundary", async () => {
  const db = new FakeD1();
  seedCard(db, baseCard());
  const fakeGenerate = async () => ({ interactionId: "int_1", text: "still way too long for the budget here" });

  const resp = await handleFlavor(
    req({ card_id: "card_1", max_chars: 15 }),
    { CARD_DB: db },
    { generateText: fakeGenerate },
  );
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.ok(body.text.length <= 15);
  assert.equal(body.truncated, true);
});

test("a failing retry still truncates the original attempt instead of erroring", async () => {
  const db = new FakeD1();
  seedCard(db, baseCard());
  let calls = 0;
  const fakeGenerate = async () => {
    calls++;
    if (calls === 1) return { interactionId: "int_1", text: "way too long for a fifteen char budget" };
    throw new Error("network blip");
  };

  const resp = await handleFlavor(
    req({ card_id: "card_1", max_chars: 15 }),
    { CARD_DB: db },
    { generateText: fakeGenerate },
  );
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.ok(body.text.length <= 15);
  assert.equal(body.truncated, true);
});

test("missing card returns 404 and never calls the generator", async () => {
  const db = new FakeD1();
  let called = false;
  const resp = await handleFlavor(
    req({ card_id: "nope" }),
    { CARD_DB: db },
    { generateText: async () => { called = true; } },
  );
  assert.equal(resp.status, 404);
  assert.equal(called, false);
});

test("missing card_id is a 400", async () => {
  const db = new FakeD1();
  const resp = await handleFlavor(req({}), { CARD_DB: db }, { generateText: async () => ({}) });
  assert.equal(resp.status, 400);
});

test("an unknown prompt_version is a 400 and never calls the generator", async () => {
  const db = new FakeD1();
  seedCard(db, baseCard());
  let called = false;
  const resp = await handleFlavor(
    req({ card_id: "card_1", prompt_version: 999 }),
    { CARD_DB: db },
    { generateText: async () => { called = true; } },
  );
  assert.equal(resp.status, 400);
  assert.equal(called, false);
});

test("a generic Gemini failure returns 502 and writes nothing", async () => {
  const db = new FakeD1();
  seedCard(db, baseCard());
  const resp = await handleFlavor(
    req({ card_id: "card_1" }),
    { CARD_DB: db },
    { generateText: async () => { throw new Error("safety block"); } },
  );
  assert.equal(resp.status, 502);
  const stored = JSON.parse(db.cards.get("card_1").json);
  assert.equal(stored.flavor.text, "");
});
