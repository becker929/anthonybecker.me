import test from "node:test";
import assert from "node:assert/strict";
import { FakeKV, FakeR2 } from "./fakes.js";
import { handleLab } from "../lab.js";

const ORIGIN = "https://example.test";
const PASSWORD = "open-sesame";
const TOKEN = "runner-token-123";

function makeEnv(overrides = {}) {
  return {
    DEMO_PASSWORD: PASSWORD,
    LAB_TOKEN: TOKEN,
    AUDIO_KV: new FakeKV(),
    AUDIO_BUCKET: new FakeR2(),
    ASSETS: { fetch: async (req) => new Response(`asset:${new URL(req.url).pathname}`, { status: 200, headers: { "Content-Type": "text/html" } }) },
    ...overrides,
  };
}

const req = (path, init = {}) => new Request(ORIGIN + path, init);
const tokenHeaders = (extra = {}) => ({ Authorization: `Bearer ${TOKEN}`, ...extra });

async function login(env) {
  const form = new FormData(); form.set("password", PASSWORD);
  const res = await handleLab(req("/lab/login", { method: "POST", body: form }), env);
  assert.equal(res.status, 302);
  const cookie = res.headers.get("Set-Cookie").split(";")[0];
  return { Cookie: cookie };
}

test("paths outside /lab are not the lab's", async () => {
  assert.equal(await handleLab(req("/labs/x"), makeEnv()), null);
  assert.equal(await handleLab(req("/"), makeEnv()), null);
});

test("the private asset directory is never served directly", async () => {
  const res = await handleLab(req("/private/lab/index.html"), makeEnv());
  assert.equal(res.status, 404);
});

test("no cookie: the page is the login form; the api is 401", async () => {
  const env = makeEnv();
  const page = await handleLab(req("/lab/"), env);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Same password as the studio/);
  const api = await handleLab(req("/lab/api/items"), env);
  assert.equal(api.status, 401);
});

test("wrong password is refused; right password sets a lab-scoped cookie and the page serves from /private/lab", async () => {
  const env = makeEnv();
  const bad = new FormData(); bad.set("password", "nope");
  assert.equal((await handleLab(req("/lab/login", { method: "POST", body: bad }), env)).status, 401);
  const headers = await login(env);
  assert.match(headers.Cookie, /^lab_auth=/);
  const page = await handleLab(req("/lab/", { headers }), env);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "asset:/private/lab/index.html");
  assert.equal(page.headers.get("Cache-Control"), "private, no-store");
  const js = await handleLab(req("/lab/lab.js", { headers }), env);
  assert.equal(await js.text(), "asset:/private/lab/lab.js");
});

test("the studio cookie does not open the lab", async () => {
  const env = makeEnv();
  const res = await handleLab(req("/lab/api/items", { headers: { Cookie: "studio_auth=123.abc" } }), env);
  assert.equal(res.status, 401);
});

test("runner token works; a missing server token says so", async () => {
  const env = makeEnv();
  const ok = await handleLab(req("/lab/api/whoami", { headers: tokenHeaders() }), env);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { runner: true, ok: true });
  const wrong = await handleLab(req("/lab/api/whoami", { headers: { Authorization: "Bearer nope" } }), env);
  assert.equal(wrong.status, 401);
  const unset = await handleLab(req("/lab/api/whoami", { headers: tokenHeaders() }), makeEnv({ LAB_TOKEN: undefined }));
  assert.equal(unset.status, 401);
  assert.match((await unset.json()).error, /LAB_TOKEN is not configured/);
});

test("the whole life of an item: create, upload, finish, run, report, artifact, delete", async () => {
  const env = makeEnv();
  const headers = await login(env);

  // create
  const created = await handleLab(req("/lab/api/items", { method: "POST", headers, body: JSON.stringify({ kind: "track", title: "Demo 1", notes: "first" }) }), env);
  assert.equal(created.status, 200);
  const item = await created.json();
  assert.match(item.id, /^[a-z0-9]+-[0-9a-f]{8}$/);
  assert.equal(item.status, "uploading");

  // bad kind
  const badKind = await handleLab(req("/lab/api/items", { method: "POST", headers, body: JSON.stringify({ kind: "loop" }) }), env);
  assert.equal(badKind.status, 400);

  // finish before any file
  assert.equal((await handleLab(req(`/lab/api/items/${item.id}/finish`, { method: "POST", headers }), env)).status, 400);

  // upload two files, one streamed
  const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
  const up = await handleLab(req(`/lab/api/items/${item.id}/files/demo%201.wav`, { method: "PUT", headers: { ...headers, "Content-Type": "audio/wav", "Content-Length": String(bytes.length) }, body: bytes }), env);
  assert.equal(up.status, 200);
  const stream = new Blob([new Uint8Array([9, 9, 9])]).stream();
  const up2 = await handleLab(req(`/lab/api/items/${item.id}/files/kick.wav`, { method: "PUT", headers: { ...headers, "Content-Type": "audio/wav", "Content-Length": "3" }, body: stream, duplex: "half" }), env);
  assert.equal(up2.status, 200);
  // bad name, missing length
  assert.equal((await handleLab(req(`/lab/api/items/${item.id}/files/..%2Fevil`, { method: "PUT", headers: { ...headers, "Content-Length": "3" }, body: bytes }), env)).status, 400);
  assert.equal((await handleLab(req(`/lab/api/items/${item.id}/files/x.wav`, { method: "PUT", headers, body: bytes }), env)).status, 411);

  // finish -> pending, listed for the runner
  const fin = await handleLab(req(`/lab/api/items/${item.id}/finish`, { method: "POST", headers }), env);
  assert.equal((await fin.json()).status, "pending");
  const pending = await handleLab(req("/lab/api/items?status=pending", { headers: tokenHeaders() }), env);
  const list = (await pending.json()).items;
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].files.map((f) => f.name).sort(), ["demo 1.wav", "kick.wav"]);

  // runner downloads a file
  const dl = await handleLab(req(`/lab/api/items/${item.id}/files/demo%201.wav`, { headers: tokenHeaders() }), env);
  assert.equal(dl.status, 200);
  assert.deepEqual(new Uint8Array(await dl.arrayBuffer()), bytes);
  assert.equal(dl.headers.get("Content-Type"), "audio/wav");

  // runner marks running, posts a report and an artifact
  assert.equal((await handleLab(req(`/lab/api/items/${item.id}`, { method: "PATCH", headers: tokenHeaders(), body: JSON.stringify({ status: "running" }) }), env)).status, 200);
  const badReport = await handleLab(req(`/lab/api/items/${item.id}/results`, { method: "PUT", headers: tokenHeaders(), body: JSON.stringify({ rows: [] }) }), env);
  assert.equal(badReport.status, 400);
  const report = { headline: "This reads as a track at 148 bpm", rows: [{ label: "tempo", value: 148 }] };
  const rep = await handleLab(req(`/lab/api/items/${item.id}/results`, { method: "PUT", headers: tokenHeaders(), body: JSON.stringify(report) }), env);
  assert.equal(rep.status, 200);
  const png = new Uint8Array([137, 80, 78, 71]);
  const art = await handleLab(req(`/lab/api/items/${item.id}/artifacts/grid.png`, { method: "PUT", headers: tokenHeaders({ "Content-Type": "image/png", "Content-Length": "4" }), body: png }), env);
  assert.equal(art.status, 200);

  // owner sees the report and the artifact
  const got = await handleLab(req(`/lab/api/items/${item.id}`, { headers }), env);
  const full = await got.json();
  assert.equal(full.status, "done");
  assert.deepEqual(full.report, report);
  assert.deepEqual(full.artifacts, ["grid.png"]);
  const artGet = await handleLab(req(`/lab/api/items/${item.id}/artifacts/grid.png`, { headers }), env);
  assert.equal(artGet.headers.get("Content-Type"), "image/png");

  // a failure is recorded and cleared
  await handleLab(req(`/lab/api/items/${item.id}`, { method: "PATCH", headers: tokenHeaders(), body: JSON.stringify({ status: "failed", error: "demucs crashed" }) }), env);
  assert.equal((await (await handleLab(req(`/lab/api/items/${item.id}`, { headers }), env)).json()).error, "demucs crashed");

  // delete removes files, report, artifact and the record
  const del = await handleLab(req(`/lab/api/items/${item.id}`, { method: "DELETE", headers }), env);
  assert.equal(del.status, 200);
  assert.equal(env.AUDIO_BUCKET.store.size, 0);
  assert.equal((await handleLab(req(`/lab/api/items/${item.id}`, { headers }), env)).status, 404);
});

test("items list newest first and filter by status", async () => {
  const env = makeEnv();
  const headers = tokenHeaders();
  const ids = [];
  for (const title of ["a", "b", "c"]) {
    const r = await handleLab(req("/lab/api/items", { method: "POST", headers, body: JSON.stringify({ kind: "sample", title }) }), env);
    ids.push((await r.json()).id);
    await new Promise((r) => setTimeout(r, 2));
  }
  const all = (await (await handleLab(req("/lab/api/items", { headers }), env)).json()).items;
  assert.deepEqual(all.map((i) => i.title), ["c", "b", "a"]);
  await handleLab(req(`/lab/api/items/${ids[0]}`, { method: "PATCH", headers, body: JSON.stringify({ status: "pending" }) }), env);
  const pending = (await (await handleLab(req("/lab/api/items?status=pending", { headers }), env)).json()).items;
  assert.deepEqual(pending.map((i) => i.title), ["a"]);
});
