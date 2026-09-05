import { test } from "node:test";
import assert from "node:assert/strict";
import { handleListenSubmit, handleListenExport } from "../listen.js";
import { FakeKV } from "./fakes.js";

function postRequest(body) {
  return new Request("https://example.com/api/listen", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validBody(overrides = {}) {
  return {
    session: "sess-abc123",
    pair: "001_clap_bursts_1v4",
    order: "ab",
    jobs: { a: "clap", b: "not_sure" },
    more: "a",
    elapsed_ms: 4200,
    profile: { producer: "yes", years: 5 },
    ...overrides,
  };
}

test("valid post is stored in KV under a listen: key with the body and a server timestamp", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  const res = await handleListenSubmit(postRequest(validBody()), env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual(json, { ok: true });

  const keys = [...env.AUDIO_KV.store.keys()];
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^listen:.+:.+$/);

  const stored = JSON.parse(env.AUDIO_KV.store.get(keys[0]));
  assert.equal(stored.session, "sess-abc123");
  assert.equal(stored.pair, "001_clap_bursts_1v4");
  assert.equal(stored.order, "ab");
  assert.deepEqual(stored.jobs, { a: "clap", b: "not_sure" });
  assert.equal(stored.more, "a");
  assert.equal(stored.elapsed_ms, 4200);
  assert.deepEqual(stored.profile, { producer: "yes", years: 5 });
  assert.equal(typeof stored.server_time, "string");
  assert.ok(!Number.isNaN(Date.parse(stored.server_time)));
});

test("a body without a profile stores profile as null", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  const body = validBody();
  delete body.profile;
  const res = await handleListenSubmit(postRequest(body), env);
  assert.equal(res.status, 200);

  const [key] = [...env.AUDIO_KV.store.keys()];
  const stored = JSON.parse(env.AUDIO_KV.store.get(key));
  assert.equal(stored.profile, null);
});

test("invalid JSON body returns 400", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  const res = await handleListenSubmit(postRequest("not json"), env);
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.ok(json.error);
  assert.equal(env.AUDIO_KV.store.size, 0);
});

test("missing required field returns 400", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  const body = validBody();
  delete body.session;
  const res = await handleListenSubmit(postRequest(body), env);
  assert.equal(res.status, 400);
  assert.equal(env.AUDIO_KV.store.size, 0);
});

test("a disallowed enum value returns 400", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  const res = await handleListenSubmit(postRequest(validBody({ more: "definitely-a" })), env);
  assert.equal(res.status, 400);
  assert.equal(env.AUDIO_KV.store.size, 0);
});

test("a disallowed job value in jobs.a returns 400", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  const res = await handleListenSubmit(
    postRequest(validBody({ jobs: { a: "guitar", b: "clap" } })),
    env,
  );
  assert.equal(res.status, 400);
  assert.equal(env.AUDIO_KV.store.size, 0);
});

test("a string longer than 40 characters returns 400", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  const res = await handleListenSubmit(
    postRequest(validBody({ session: "s".repeat(41) })),
    env,
  );
  assert.equal(res.status, 400);
  assert.equal(env.AUDIO_KV.store.size, 0);
});

test("elapsed_ms out of range returns 400", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  const res = await handleListenSubmit(postRequest(validBody({ elapsed_ms: -1 })), env);
  assert.equal(res.status, 400);

  const res2 = await handleListenSubmit(
    postRequest(validBody({ elapsed_ms: 999_999_999 })),
    env,
  );
  assert.equal(res2.status, 400);
  assert.equal(env.AUDIO_KV.store.size, 0);
});

test("an unknown top-level field returns 400", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  const res = await handleListenSubmit(postRequest(validBody({ ip: "1.2.3.4" })), env);
  assert.equal(res.status, 400);
  assert.equal(env.AUDIO_KV.store.size, 0);
});

test("an invalid profile.producer value returns 400", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  const res = await handleListenSubmit(
    postRequest(validBody({ profile: { producer: "maybe" } })),
    env,
  );
  assert.equal(res.status, 400);
  assert.equal(env.AUDIO_KV.store.size, 0);
});

test("export returns stored records in order with no-store caching", async () => {
  const env = { AUDIO_KV: new FakeKV() };
  await handleListenSubmit(postRequest(validBody({ pair: "pair-1" })), env);
  await handleListenSubmit(postRequest(validBody({ pair: "pair-2" })), env);
  await handleListenSubmit(postRequest(validBody({ pair: "pair-3" })), env);

  const res = await handleListenExport(env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "no-store");

  const records = await res.json();
  assert.equal(records.length, 3);
  assert.deepEqual(
    records.map((r) => r.pair),
    ["pair-1", "pair-2", "pair-3"],
  );
});

test("export paginates across a cursor", async () => {
  const kv = new FakeKV();
  // Seed more entries than a single page (FakeKV's default list limit is
  // 1000, so force a small page by inserting pre-built records directly
  // and monkey-patching list to page at 2 — mirrors what a real KV
  // namespace does when a listing spans more than one page).
  for (let i = 0; i < 5; i++) {
    const key = `listen:2026-01-01T00:00:0${i}.000Z:id${i}`;
    kv.store.set(key, JSON.stringify({ pair: `pair-${i}`, server_time: key }));
  }

  const realList = kv.list.bind(kv);
  kv.list = (opts) => realList({ ...opts, limit: 2 });

  const env = { AUDIO_KV: kv };
  const res = await handleListenExport(env);
  assert.equal(res.status, 200);
  const records = await res.json();
  assert.equal(records.length, 5);
  assert.deepEqual(
    records.map((r) => r.pair),
    ["pair-0", "pair-1", "pair-2", "pair-3", "pair-4"],
  );
});
