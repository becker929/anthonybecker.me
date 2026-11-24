// /skrng is for listening only (24 November 2026). The render feedback and
// the Claude Code jobs behind it are gone: their routes must answer 404, and
// the page, its manifest and its audio must still be served.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import * as worker from "../index.js";
import { FakeKV } from "./fakes.js";

const ROOT = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");

// Static assets from the repo, the way the platform serves them: a directory
// path serves its index.html, anything else that is not a file is a 404.
const assets = {
  async fetch(req) {
    let p = decodeURIComponent(new URL(req.url).pathname).slice(1);
    if (p === "" || p.endsWith("/")) p += "index.html";
    const file = new URL(p, ROOT);
    if (!existsSync(file) || statSync(file).isDirectory()) return new Response("Not found", { status: 404 });
    const type = p.endsWith(".html") ? "text/html; charset=utf-8" : p.endsWith(".json") ? "application/json" : "text/plain";
    return new Response(readFileSync(file), { headers: { "Content-Type": type } });
  },
};

// R2 with byte ranges, holding a few seconds of "audio" at each key it is given.
function audioBucket(keys) {
  const bytes = new Uint8Array(4000);
  return {
    async get(key, opts = {}) {
      if (!keys.includes(key)) return null;
      const offset = opts.range?.offset ?? 0;
      const length = opts.range?.length ?? bytes.length - offset;
      return {
        size: bytes.length,
        range: { offset, length },
        httpEtag: '"e"',
        body: bytes.slice(offset, offset + length),
        writeHttpMetadata(h) { h.set("Content-Type", "audio/mpeg"); },
      };
    },
  };
}

const manifest = JSON.parse(read("skrng/manifest.json"));
const batches = JSON.parse(read("skrng/batches.json"));
const newest = manifest[0];
const intro = batches.find((b) => b.announce)?.announce;
const audioKeys = [newest.file, intro].filter(Boolean).map((u) => u.replace(/^\/audio\//, "audio/"));

// The old secrets may still be set in Cloudflare; the routes must stay gone anyway.
function env() {
  return {
    ASSETS: assets,
    AUDIO_KV: new FakeKV(),
    AUDIO_BUCKET: audioBucket(audioKeys),
    SKRNG_TOKEN: "old-browser-key",
    RIG_TOKEN: "old-rig-key",
  };
}

const call = (path, init = {}) => worker.default.fetch(new Request(`https://anthonybecker.me${path}`, init), env());

test("the feedback, RPC and rig routes answer 404, even with the old keys", async () => {
  const browser = { Authorization: "Bearer old-browser-key", "Content-Type": "application/json" };
  const cases = [
    ["/api/skrng/feedback", { method: "POST", headers: browser, body: "{}" }],
    ["/api/skrng/feedback?batch=4.1", { headers: browser }],
    ["/api/rpc", { method: "POST", headers: browser, body: JSON.stringify({ method: "ping" }) }],
    ["/api/rig/connect", { headers: { Upgrade: "websocket", Authorization: "Bearer old-rig-key" } }],
  ];
  for (const [path, init] of cases) {
    assert.equal((await call(path, init)).status, 404, `${init.method || "GET"} ${path}`);
  }
});

test("the feedback pages and scripts are gone", async () => {
  for (const path of ["/skrng/talk/", "/skrng/review.js", "/skrng/voice.js", "/skrng/agent.js"]) {
    assert.equal((await call(path)).status, 404, path);
  }
});

test("the Worker no longer exports RigBroker", () => {
  assert.equal(worker.RigBroker, undefined);
  assert.equal(typeof worker.CoreLibrary, "function");
});

test("wrangler.toml stops routing the old paths and deletes the RigBroker class", () => {
  const toml = read("wrangler.toml");
  const first = toml.match(/^run_worker_first\s*=\s*\[(.*)\]$/m)?.[1] ?? "";
  assert.ok(first.includes('"/audio*"'), "/audio must still reach the Worker");
  for (const gone of ["/api/skrng", "/api/rpc", "/api/rig"]) assert.ok(!first.includes(gone), `${gone} still in run_worker_first`);
  assert.doesNotMatch(toml, /class_name\s*=\s*"RigBroker"/);
  // Without this migration the production deploy refuses the missing class.
  assert.match(toml, /\[\[migrations\]\]\s*\ntag\s*=\s*"v3-rig-removed"\s*\ndeleted_classes\s*=\s*\["RigBroker"\]/);
});

test("/skrng/ still serves the listening page", async () => {
  const res = await call("/skrng/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /id="play-batch"/);
  assert.match(html, /from '\.\/playlist\.js'/);
  assert.doesNotMatch(html, /review\.js|agent\.js|\/api\/rpc|\/api\/skrng/);
});

test("/skrng/ manifest and batches are served", async () => {
  const m = await call("/skrng/manifest.json");
  assert.equal(m.status, 200);
  assert.ok((await m.json()).length > 0);
  const b = await call("/skrng/batches.json");
  assert.equal(b.status, 200);
  assert.ok(Array.isArray(await b.json()));
  assert.equal((await call("/skrng/playlist.js")).status, 200);
});

test("a render and a batch intro are served from /audio/, with byte ranges", async () => {
  for (const url of [newest.file, intro].filter(Boolean)) {
    const res = await call(url);
    assert.equal(res.status, 200, url);
    assert.equal(res.headers.get("Content-Type"), "audio/mpeg");
    const part = await call(url, { headers: { Range: "bytes=0-99" } });
    assert.equal(part.status, 206, url);
    assert.equal(part.headers.get("Content-Range"), "bytes 0-99/4000");
  }
  assert.equal((await call("/audio/skrng/not-a-render.mp3")).status, 404);
});
