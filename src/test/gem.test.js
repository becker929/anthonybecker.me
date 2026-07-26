import { test } from "node:test";
import assert from "node:assert/strict";
import { handleListGems, handleCreateGem, handleUpdateGemMask, handleApproveGem } from "../gem.js";
import { selectKeyColor } from "../key-color.js";
import { FakeD1, FakeR2 } from "./fakes.js";

const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function env(db, bucket) {
  return { CARD_DB: db, CARD_BUCKET: bucket };
}

function req(url, opts) {
  return new Request(url, { method: "POST", ...opts });
}

function seedGem(db, overrides = {}) {
  const row = {
    id: "gem_1",
    name: "Ember Shard",
    palette: JSON.stringify(["#8a2d1c"]),
    key_color: "#0000ff",
    raw_hash: "a".repeat(64),
    mask_params: JSON.stringify({ threshold: 40, edgeSoftness: 24, despill: 0.6 }),
    approved: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
  db.gems.set(row.id, row);
  return row;
}

test("creates a gem: picks the key color, injects it into the prompt, stores raw art unapproved", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  const palette = ["#8a2d1c", "#f4b93f"];
  const expectedKeyColor = selectKeyColor(palette);

  let seenSystemInstruction;
  const fakeGenerate = async (_env, args) => {
    seenSystemInstruction = args.systemInstruction;
    return { interactionId: "int_1", mimeType: "image/png", data: PNG_B64 };
  };

  const resp = await handleCreateGem(
    req("http://x/api/gems", {
      body: JSON.stringify({ name: "Ember Shard", instruction: "a faceted ember crystal", palette }),
    }),
    env(db, bucket),
    { generateGemArt: fakeGenerate },
  );
  assert.equal(resp.status, 200);
  const body = await resp.json();

  assert.match(seenSystemInstruction, new RegExp(expectedKeyColor.hex));
  assert.equal(body.gem.key_color, expectedKeyColor.hex);
  assert.equal(body.gem.approved, false);
  assert.deepEqual(body.gem.palette, palette);
  assert.deepEqual(body.gem.mask_params, { threshold: 40, edgeSoftness: 24, despill: 0.6 });
  assert.match(body.gem.raw_hash, /^[0-9a-f]{64}$/);
  assert.ok(db.gems.get(body.gem.id));
});

test("rejects an entirely empty body or invalid hex entries", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  const fail = async () => { throw new Error("should not be called"); };

  const cases = [
    {}, // nothing supplied at all — no context to fill in from
    { name: "x", instruction: "x", palette: ["not-a-color"] }, // bad hex, not just missing
  ];
  for (const body of cases) {
    const resp = await handleCreateGem(
      req("http://x/api/gems", { body: JSON.stringify(body) }),
      env(db, bucket),
      { generateGemArt: fail, generateText: fail },
    );
    assert.equal(resp.status, 400, JSON.stringify(body));
  }
});

test("fills in a missing name, instruction, or palette from whatever was supplied", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  const fakeGenerateGemArt = async () => ({ interactionId: "int_1", mimeType: "image/png", data: PNG_B64 });

  const cases = [
    {
      body: { instruction: "a faceted ember crystal", palette: ["#8a2d1c"] },
      fillText: JSON.stringify({ name: "Ember Shard" }),
      missing: ["name"],
    },
    {
      body: { name: "Ember Shard", palette: ["#8a2d1c"] },
      fillText: JSON.stringify({ instruction: "a faceted ember crystal" }),
      missing: ["instruction"],
    },
    {
      body: { name: "Ember Shard", instruction: "a faceted ember crystal" },
      fillText: JSON.stringify({ palette: ["#8a2d1c"] }),
      missing: ["palette"],
    },
  ];

  for (const { body, fillText, missing } of cases) {
    let seenMissing;
    const fakeGenerateText = async (_env, args) => {
      seenMissing = missing;
      assert.ok(args.instruction.includes(missing[0]), JSON.stringify({ body, args }));
      return { interactionId: "int_fill", text: fillText };
    };

    const resp = await handleCreateGem(
      req("http://x/api/gems", { body: JSON.stringify(body) }),
      env(db, bucket),
      { generateGemArt: fakeGenerateGemArt, generateText: fakeGenerateText },
    );
    assert.equal(resp.status, 200, JSON.stringify({ body, respStatus: resp.status }));
    const result = await resp.json();
    assert.equal(result.gem.name, "Ember Shard");
    assert.deepEqual(result.gem.palette, ["#8a2d1c"]);
    assert.deepEqual(seenMissing, missing);
  }
});

test("a fill-in response that is unparseable or invalid returns 502 and writes nothing", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  const fail = async () => { throw new Error("should not be called"); };

  const badResponses = [
    "not json at all",
    JSON.stringify({ name: "" }), // empty string doesn't count as filled
    JSON.stringify({ palette: [] }), // empty array doesn't count as filled
    JSON.stringify({ palette: ["not-a-color"] }), // invalid hex from the model itself
  ];
  for (const text of badResponses) {
    const resp = await handleCreateGem(
      req("http://x/api/gems", { body: JSON.stringify({ instruction: "x", palette: ["#000000"] }) }),
      env(db, bucket),
      { generateGemArt: fail, generateText: async () => ({ interactionId: "int_1", text }) },
    );
    assert.equal(resp.status, 502, text);
    assert.equal(db.gems.size, 0, text);
  }
});

test("a generic generation failure returns 502 and writes nothing", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  const resp = await handleCreateGem(
    req("http://x/api/gems", {
      body: JSON.stringify({ name: "x", instruction: "x", palette: ["#000000"] }),
    }),
    env(db, bucket),
    { generateGemArt: async () => { throw new Error("safety block"); } },
  );
  assert.equal(resp.status, 502);
  assert.equal(db.gems.size, 0);
});

test("listGems filters to approved-only when ?approved=1 is set", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  seedGem(db, { id: "gem_approved", approved: 1 });
  seedGem(db, { id: "gem_candidate", approved: 0 });

  const allResp = await handleListGems(new Request("http://x/api/gems"), env(db, bucket));
  const all = await allResp.json();
  assert.equal(all.length, 2);

  const approvedResp = await handleListGems(new Request("http://x/api/gems?approved=1"), env(db, bucket));
  const approved = await approvedResp.json();
  assert.equal(approved.length, 1);
  assert.equal(approved[0].id, "gem_approved");
  assert.equal(approved[0].approved, true);
});

test("updates mask params and returns the updated gem", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  seedGem(db);

  const resp = await handleUpdateGemMask(
    req("http://x/api/gems/gem_1", { method: "PATCH", body: JSON.stringify({ mask_params: { threshold: 10, edgeSoftness: 5, despill: 0.2 } }) }),
    env(db, bucket),
    "gem_1",
  );
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.deepEqual(body.gem.mask_params, { threshold: 10, edgeSoftness: 5, despill: 0.2 });
});

test("rejects mask_params with missing or non-numeric fields", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  seedGem(db);
  const resp = await handleUpdateGemMask(
    req("http://x/api/gems/gem_1", { method: "PATCH", body: JSON.stringify({ mask_params: { threshold: 10 } }) }),
    env(db, bucket),
    "gem_1",
  );
  assert.equal(resp.status, 400);
});

test("updating mask params for a missing gem returns 404", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  const resp = await handleUpdateGemMask(
    req("http://x/api/gems/nope", { method: "PATCH", body: JSON.stringify({ mask_params: { threshold: 1, edgeSoftness: 1, despill: 1 } }) }),
    env(db, bucket),
    "nope",
  );
  assert.equal(resp.status, 404);
});

test("approving a gem sets approved true", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  seedGem(db);
  const resp = await handleApproveGem(env(db, bucket), "gem_1");
  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.gem.approved, true);
});

test("approving a missing gem returns 404", async () => {
  const db = new FakeD1();
  const bucket = new FakeR2();
  const resp = await handleApproveGem(env(db, bucket), "nope");
  assert.equal(resp.status, 404);
});
