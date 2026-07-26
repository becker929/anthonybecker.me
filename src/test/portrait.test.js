import { test } from "node:test";
import assert from "node:assert/strict";
import { handlePortrait } from "../portrait.js";
import { GeminiThreadExpiredError } from "../gemini.js";
import { FakeD1, FakeR2 } from "./fakes.js";
import { CURRENT_SCHEMA_VERSION } from "../../private/c33f3ea406426b41/cards/migrate.js";

function baseCard(overrides = {}) {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    id: "card_1",
    template_version: 3,
    title: "",
    portrait: null,
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

function env(db, bucket, overrides = {}) {
  return { CARD_DB: db, CARD_BUCKET: bucket, GEMINI_API_KEY: "test-key", ...overrides };
}

function req(body) {
  return new Request("http://x/api/portrait", { method: "POST", body: JSON.stringify(body) });
}

const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("fresh generation on an existing card creates a lineage entry and records the interaction", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  seedCard(db, baseCard());

  let seenArgs;
  const fakeGenerate = async (_env, args) => {
    seenArgs = args;
    return { interactionId: "int_1", mimeType: "image/png", data: PNG_B64 };
  };

  const resp = await handlePortrait(
    req({ card_id: "card_1", instruction: "a herald wreathed in ash" }),
    env(db, bucket),
    { generatePortrait: fakeGenerate },
  );
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.interaction_id, "int_1");
  assert.match(body.asset, /^sha256:[0-9a-f]{64}$/);

  assert.equal(seenArgs.previousInteractionId, null);
  assert.equal(seenArgs.referenceImage, null);
  assert.equal(seenArgs.instruction, "a herald wreathed in ash");

  const stored = JSON.parse(db.cards.get("card_1").json);
  assert.equal(stored.portrait.lineage.length, 1);
  assert.equal(stored.portrait.user_prompt, "a herald wreathed in ash");
  assert.equal(stored.portrait.interaction_id, "int_1");
  assert.equal(stored.portrait.asset, body.asset);

  assert.equal(db.interactions.length, 1);
  assert.equal(db.interactions[0].seq, 0);
  assert.equal(db.interactions[0].card_id, "card_1");
});

test("continuing with previous_interaction_id appends lineage and keeps the original user_prompt", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  seedCard(
    db,
    baseCard({
      portrait: {
        asset: "sha256:" + "a".repeat(64),
        style_version: 1,
        user_prompt: "a herald wreathed in ash",
        interaction_id: "int_1",
        lineage: [{ instruction: "a herald wreathed in ash", asset: "sha256:" + "a".repeat(64), interaction_id: "int_1" }],
      },
    }),
  );

  let seenArgs;
  const fakeGenerate = async (_env, args) => {
    seenArgs = args;
    return { interactionId: "int_2", mimeType: "image/png", data: PNG_B64 };
  };

  const resp = await handlePortrait(
    req({ card_id: "card_1", instruction: "make the sky darker", previous_interaction_id: "int_1" }),
    env(db, bucket),
    { generatePortrait: fakeGenerate },
  );
  assert.equal(resp.status, 200);

  assert.equal(seenArgs.previousInteractionId, "int_1");
  assert.equal(seenArgs.referenceImage, null);

  const stored = JSON.parse(db.cards.get("card_1").json);
  assert.equal(stored.portrait.lineage.length, 2);
  assert.equal(stored.portrait.user_prompt, "a herald wreathed in ash", "user_prompt must not change on edits");
  assert.equal(stored.portrait.interaction_id, "int_2");
  assert.deepEqual(
    db.interactions.map((i) => i.seq),
    [1],
  );
});

test("reference_asset mode fetches the stored blob and attaches it as input", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  const rawBytes = Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0));
  const hashHex = Buffer.from(
    await crypto.subtle.digest("SHA-256", rawBytes),
  ).toString("hex");
  await bucket.put(`blob/${hashHex}`, rawBytes, { httpMetadata: { contentType: "image/png" } });

  seedCard(
    db,
    baseCard({
      portrait: {
        asset: `sha256:${hashHex}`,
        style_version: 1,
        user_prompt: "a herald",
        interaction_id: "int_expired",
        lineage: [{ instruction: "a herald", asset: `sha256:${hashHex}`, interaction_id: "int_expired" }],
      },
    }),
  );

  let seenArgs;
  const fakeGenerate = async (_env, args) => {
    seenArgs = args;
    return { interactionId: "int_new", mimeType: "image/png", data: PNG_B64 };
  };

  const resp = await handlePortrait(
    req({ card_id: "card_1", instruction: "same herald, darker sky", reference_asset: `sha256:${hashHex}` }),
    env(db, bucket),
    { generatePortrait: fakeGenerate },
  );
  assert.equal(resp.status, 200);
  assert.equal(seenArgs.previousInteractionId, null);
  assert.equal(seenArgs.referenceImage.mimeType, "image/png");
  assert.equal(seenArgs.referenceImage.data, PNG_B64);
});

test("expired thread maps to 409 with an actionable message, and nothing is written", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  seedCard(
    db,
    baseCard({
      portrait: {
        asset: "sha256:" + "b".repeat(64),
        style_version: 1,
        user_prompt: "x",
        interaction_id: "int_old",
        lineage: [{ instruction: "x", asset: "sha256:" + "b".repeat(64), interaction_id: "int_old" }],
      },
    }),
  );

  const fakeGenerate = async () => {
    throw new GeminiThreadExpiredError("interaction not found");
  };

  const resp = await handlePortrait(
    req({ card_id: "card_1", instruction: "edit it", previous_interaction_id: "int_old" }),
    env(db, bucket),
    { generatePortrait: fakeGenerate },
  );
  assert.equal(resp.status, 409);
  const body = await resp.json();
  assert.match(body.error, /reference_asset/);

  const stored = JSON.parse(db.cards.get("card_1").json);
  assert.equal(stored.portrait.lineage.length, 1, "no new lineage entry on failure");
  assert.equal(db.interactions.length, 0);
});

test("missing card returns 404 and never calls the generator", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  let called = false;
  const fakeGenerate = async () => {
    called = true;
    throw new Error("should not be called");
  };

  const resp = await handlePortrait(
    req({ card_id: "does_not_exist", instruction: "anything" }),
    env(db, bucket),
    { generatePortrait: fakeGenerate },
  );
  assert.equal(resp.status, 404);
  assert.equal(called, false);
});

test("rejects both previous_interaction_id and reference_asset in the same request", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  seedCard(db, baseCard());

  const resp = await handlePortrait(
    req({
      card_id: "card_1",
      instruction: "x",
      previous_interaction_id: "int_1",
      reference_asset: "sha256:" + "c".repeat(64),
    }),
    env(db, bucket),
    { generatePortrait: async () => { throw new Error("should not be called"); } },
  );
  assert.equal(resp.status, 400);
});

test("rejects a missing instruction", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  seedCard(db, baseCard());

  const resp = await handlePortrait(req({ card_id: "card_1", instruction: "  " }), env(db, bucket), {
    generatePortrait: async () => { throw new Error("should not be called"); },
  });
  assert.equal(resp.status, 400);
});

test("a generic Gemini failure returns 502 and writes nothing", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  seedCard(db, baseCard());

  const resp = await handlePortrait(
    req({ card_id: "card_1", instruction: "x" }),
    env(db, bucket),
    { generatePortrait: async () => { throw new Error("safety block"); } },
  );
  assert.equal(resp.status, 502);
  const stored = JSON.parse(db.cards.get("card_1").json);
  assert.equal(stored.portrait, null);
  assert.equal(db.interactions.length, 0);
});
