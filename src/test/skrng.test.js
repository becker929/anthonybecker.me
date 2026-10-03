import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../index.js";
import { FakeKV } from "./fakes.js";

const TOKEN = "test-token-123";
const URL_ = "https://example.com/api/skrng/feedback";

function env(overrides = {}) {
  return { AUDIO_KV: new FakeKV(), SKRNG_TOKEN: TOKEN, ...overrides };
}

function body(overrides = {}) {
  return {
    id: "fb-1",
    session: "s-1",
    batch: 4.1,
    track: "2026-10-02-hw002-b41-05-t2-wuh-x1_5-48s",
    index: 4,
    transcript: "The stretch works, the drop still feels weak",
    typed: "",
    ended_by: "voice",
    replays: 0,
    listen_ms: 9100,
    client_time: "2026-10-02T15:04:05.000Z",
    stt: "speech",
    ...overrides,
  };
}

function post(b, token = TOKEN) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(URL_, { method: "POST", headers, body: typeof b === "string" ? b : JSON.stringify(b) });
}

function get(query = "", token = TOKEN) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return new Request(`${URL_}${query}`, { headers });
}

test("a valid post is stored under its batch, time and id", async () => {
  const e = env();
  const res = await worker.fetch(post(body()), e);
  assert.equal(res.status, 200);
  const keys = [...e.AUDIO_KV.store.keys()];
  assert.deepEqual(keys, ["skrng:fb:4.1:2026-10-02T15:04:05.000Z:fb-1"]);
  const rec = JSON.parse(e.AUDIO_KV.store.get(keys[0]));
  assert.equal(rec.transcript, "The stretch works, the drop still feels weak");
  assert.equal(rec.index, 4);
  assert.ok(rec.server_time);
});

test("a retried post overwrites instead of duplicating", async () => {
  const e = env();
  await worker.fetch(post(body()), e);
  await worker.fetch(post(body({ transcript: "second copy" })), e);
  assert.equal(e.AUDIO_KV.store.size, 1);
});

test("no secret configured: 503, nothing stored", async () => {
  const e = env({ SKRNG_TOKEN: undefined });
  const res = await worker.fetch(post(body()), e);
  assert.equal(res.status, 503);
  assert.equal(e.AUDIO_KV.store.size, 0);
  assert.equal((await worker.fetch(get(), e)).status, 503);
});

test("missing or wrong key: 401 for writes and reads", async () => {
  const e = env();
  assert.equal((await worker.fetch(post(body(), null), e)).status, 401);
  assert.equal((await worker.fetch(post(body(), "wrong-token-123"), e)).status, 401);
  assert.equal((await worker.fetch(get("", "nope"), e)).status, 401);
  assert.equal(e.AUDIO_KV.store.size, 0);
});

test("invalid bodies are refused with a reason", async () => {
  const e = env();
  for (const bad of [
    body({ extra: 1 }),
    body({ batch: "4.1" }),
    body({ ended_by: "shrug" }),
    body({ transcript: "x".repeat(6001) }),
    body({ track: "../etc" }),
    body({ client_time: "yesterday" }),
  ]) {
    const res = await worker.fetch(post(bad), e);
    assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 60));
    assert.ok((await res.json()).error);
  }
  assert.equal((await worker.fetch(post("{not json"), e)).status, 400);
  assert.equal(e.AUDIO_KV.store.size, 0);
});

test("listing filters by batch and keeps time order", async () => {
  const e = env();
  await worker.fetch(post(body({ id: "b", client_time: "2026-10-02T15:05:00Z", index: 5 })), e);
  await worker.fetch(post(body({ id: "a", client_time: "2026-10-02T15:04:00Z", index: 4 })), e);
  await worker.fetch(post(body({ id: "c", batch: 4, client_time: "2026-10-01T10:00:00Z" })), e);
  const res = await worker.fetch(get("?batch=4.1"), e);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await res.json()).map((r) => r.index), [4, 5]);
  assert.equal((await (await worker.fetch(get(), e)).json()).length, 3);
  assert.equal((await worker.fetch(get("?batch=x"), e)).status, 400);
});
