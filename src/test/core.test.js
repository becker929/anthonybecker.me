import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CoreLibrary, handleCore, normalizeHandle, checkSample, encodePng } from "../core.js";
import { FakeDONamespace } from "./fakes.js";
import { sampleRepo, weekOf, COLS } from "../../demos/10/core-library/sample.js";
import { render } from "../../demos/10/core-library/render.js";

const ORIGIN = "https://anthonybecker.me";
const DID = "did:plc:abc123";
const PDS = "https://pds.example.com";
const ISSUER = "https://auth.example.com";

function env() {
  return { CORES: new FakeDONamespace(CoreLibrary) };
}

async function op(e, name, args) {
  const r = await e.CORES.get("library").fetch("https://x/op", { method: "POST", body: JSON.stringify({ op: name, args }) });
  return r.json();
}

// ---------- a tiny CAR writer, enough to feed sampleRepo ----------

function cbor(v) {
  const head = (mt, n) => {
    if (n < 24) return [(mt << 5) | n];
    if (n < 256) return [(mt << 5) | 24, n];
    if (n < 65536) return [(mt << 5) | 25, n >> 8, n & 255];
    return [(mt << 5) | 26, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  if (v === null) return [0xf6];
  if (typeof v === "number") return head(0, v);
  if (typeof v === "string") { const b = [...Buffer.from(v)]; return [...head(3, b.length), ...b]; }
  if (Array.isArray(v)) return [...head(4, v.length), ...v.flatMap(cbor)];
  const ks = Object.keys(v);
  return [...head(5, ks.length), ...ks.flatMap((k) => [...cbor(k), ...cbor(v[k])])];
}
const varint = (n) => { const o = []; do { let b = n & 127; n >>>= 7; if (n) b |= 128; o.push(b); } while (n); return o; };
function car(records) {
  const out = [];
  const header = cbor({ version: 1, roots: [] });
  out.push(...varint(header.length), ...header);
  for (const r of records) {
    const body = cbor(r);
    const cid = [1, 0x71, 0x12, 32, ...new Array(32).fill(7)];
    out.push(...varint(cid.length + body.length), ...cid, ...body);
  }
  return new Uint8Array(out);
}

// ---------- sampling ----------

test("sampleRepo buckets records by week and kind", () => {
  const now = Date.UTC(2026, 9, 15, 12);
  const t = (d) => new Date(now - d * 86400000).toISOString();
  const buf = car([
    { $type: "app.bsky.feed.post", text: "hello", createdAt: t(0) },
    { $type: "app.bsky.feed.post", text: "re", reply: { root: {}, parent: {} }, createdAt: t(0) },
    { $type: "app.bsky.feed.post", text: "q", embed: { $type: "app.bsky.embed.record" }, createdAt: t(0) },
    { $type: "app.bsky.feed.post", text: "pics", embed: { $type: "app.bsky.embed.images", images: [{}, {}] }, createdAt: t(14) },
    { $type: "app.bsky.feed.like", createdAt: t(14) },
    { $type: "app.bsky.feed.repost", createdAt: t(14) },
    { $type: "app.bsky.graph.follow", createdAt: t(30) },
    { $type: "app.bsky.feed.post", text: "imported", createdAt: "2011-01-01T00:00:00Z" },
    { $type: "app.bsky.feed.post", text: "future", createdAt: "2030-01-01T00:00:00Z" },
    { e: [], l: null },
  ]);
  const s = sampleRepo(buf, now);
  const C = Object.fromEntries(COLS.map((k, i) => [k, i]));
  assert.equal(s.firstWeek + s.weeks.length - 1, weekOf(now));
  const last = s.weeks[s.weeks.length - 1];
  assert.deepEqual([last[C.post], last[C.reply], last[C.quote]], [1, 1, 1]);
  const two = s.weeks[s.weeks.length - 1 - (weekOf(now) - weekOf(now - 14 * 86400000))];
  assert.deepEqual([two[C.post], two[C.image], two[C.like], two[C.repost]], [1, 2, 1, 1]);
  assert.equal(s.weeks.reduce((a, w) => a + w[C.follow], 0), 1);
  assert.equal(s.early, 1);
  assert.equal(s.future, 1);
});

// ---------- checks on what the browser sends ----------

test("checkSample accepts a sane sample and refuses bad ones", () => {
  const now = Date.UTC(2026, 9, 15);
  const good = { firstWeek: weekOf(now) - 1, weeks: [new Array(10).fill(1), new Array(10).fill(0)], hours: new Array(24).fill(0), early: 0 };
  assert.equal(checkSample(good, now, { postsCount: 10 }), null);
  assert.match(checkSample({ ...good, firstWeek: weekOf(now) - 20 }, now), /this week/);
  assert.match(checkSample({ ...good, weeks: [[1, 2, 3]] , firstWeek: weekOf(now) }, now), /bad week/);
  assert.match(checkSample({ ...good, weeks: [new Array(10).fill(-1), new Array(10).fill(0)] }, now), /bad week/);
  assert.match(checkSample({ ...good, weeks: [[9000, 0, 0, 0, 0, 0, 0, 0, 0, 0], new Array(10).fill(0)] }, now, { postsCount: 10 }), /more posts/);
  const old = Date.UTC(1972, 0, 1);
  assert.match(checkSample({ ...good, firstWeek: weekOf(old), weeks: [new Array(10).fill(0)] }, old), /before Bluesky/);
});

test("normalizeHandle", () => {
  assert.equal(normalizeHandle(" @Alice.bsky.social "), "alice.bsky.social");
  assert.equal(normalizeHandle("alice"), "alice.bsky.social");
  assert.equal(normalizeHandle("https://bsky.app/profile/yuxi.ml/post/x"), "yuxi.ml");
  assert.equal(normalizeHandle(DID), DID);
  assert.equal(normalizeHandle("<script>"), "");
});

// ---------- storage ----------

test("tickets are single use and expire", async () => {
  const e = env();
  await op(e, "tmpPut", { key: "ticket:a", value: { did: DID }, ttl: 60000 });
  assert.equal((await op(e, "tmpTake", { key: "ticket:a" })).value.did, DID);
  assert.equal((await op(e, "tmpTake", { key: "ticket:a" })).value, null);
  await op(e, "tmpPut", { key: "ticket:b", value: { did: DID }, ttl: -1 });
  assert.equal((await op(e, "tmpTake", { key: "ticket:b" })).value, null);
});

test("cores are numbered in order, once a day per account, and only the donor can withdraw", async () => {
  const e = env();
  const core = (did, at) => ({ did, handle: "h", drilledAt: at, firstWeek: 2900, weeks: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 3]] });
  assert.equal((await op(e, "addCore", { core: core("did:plc:a", "2026-10-01T00:00:00Z"), redrillMs: 72e6 })).n, 1);
  assert.equal((await op(e, "addCore", { core: core("did:plc:b", "2026-10-01T00:00:00Z"), redrillMs: 72e6 })).n, 2);
  assert.match((await op(e, "addCore", { core: core("did:plc:a", "2026-10-01T05:00:00Z"), redrillMs: 72e6 })).error, /core 1/);
  assert.equal((await op(e, "addCore", { core: core("did:plc:a", "2026-10-02T05:00:00Z"), redrillMs: 72e6 })).n, 3);
  const list = await op(e, "list", { limit: 24 });
  assert.deepEqual(list.cores.map((c) => c.n), [3, 2, 1]);
  assert.deepEqual((await op(e, "list", { before: 3, limit: 24 })).cores.map((c) => c.n), [2, 1]);
  assert.equal((await op(e, "withdraw", { n: 2, did: "did:plc:a" })).ok, false);
  assert.equal((await op(e, "withdraw", { n: 2, did: "did:plc:b" })).ok, true);
  const gone = (await op(e, "getCore", { n: 2 })).core;
  assert.equal(gone.withdrawn, true);
  assert.equal(gone.did, undefined);
  assert.deepEqual((await op(e, "list", { limit: 24 })).cores.map((c) => c.n), [3, 1]);
});

// ---------- sign-in, against a fake Bluesky ----------

function fakeBluesky({ sub = DID, scope = "atproto", iss = ISSUER } = {}) {
  const seen = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    seen.push({ url, init });
    const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
    if (url.includes("resolveHandle")) return json({ did: DID });
    if (url === `https://plc.directory/${DID}`) return json({ service: [{ id: "#atproto_pds", serviceEndpoint: PDS }] });
    if (url === `${PDS}/.well-known/oauth-protected-resource`) return json({ authorization_servers: [ISSUER] });
    if (url === `${ISSUER}/.well-known/oauth-authorization-server`) {
      return json({ issuer: iss, authorization_endpoint: `${ISSUER}/authorize`, token_endpoint: `${ISSUER}/token`, pushed_authorization_request_endpoint: `${ISSUER}/par`, revocation_endpoint: `${ISSUER}/revoke` });
    }
    if (url === `${ISSUER}/par`) {
      // First try is refused for want of a nonce, as real servers do.
      const proof = JSON.parse(Buffer.from(init.headers.DPoP.split(".")[1], "base64url"));
      if (!proof.nonce) return json({ error: "use_dpop_nonce" }, 400, { "DPoP-Nonce": "n1" });
      return json({ request_uri: "urn:req:1" }, 201, { "DPoP-Nonce": "n1" });
    }
    if (url === `${ISSUER}/token`) return json({ access_token: "tok", token_type: "DPoP", sub, scope }, 200, { "DPoP-Nonce": "n2" });
    if (url === `${ISSUER}/revoke`) return json({});
    throw new Error(`unexpected fetch ${url}`);
  };
  return seen;
}

async function signIn(e, opts) {
  const seen = fakeBluesky(opts);
  const login = await handleCore(new Request(`${ORIGIN}/api/core/login?handle=alice.example.com`), e);
  assert.equal(login.status, 302);
  const auth = new URL(login.headers.get("Location"));
  assert.equal(auth.origin + auth.pathname, `${ISSUER}/authorize`);
  assert.equal(auth.searchParams.get("client_id"), `${ORIGIN}/demos/10/core-library/client-metadata.json`);
  const par = seen.filter((s) => s.url === `${ISSUER}/par`).pop();
  const form = new URLSearchParams(par.init.body);
  assert.equal(form.get("scope"), "atproto");
  assert.equal(form.get("code_challenge_method"), "S256");
  const state = form.get("state");
  const cb = await handleCore(new Request(`${ORIGIN}/api/core/callback?code=c&state=${state}&iss=${encodeURIComponent(opts?.cbIss || ISSUER)}`), e);
  return { cb, seen };
}

test("a good sign-in ends with a drill ticket and a revoked token", async () => {
  const e = env();
  const { cb, seen } = await signIn(e);
  const loc = cb.headers.get("Location");
  assert.match(loc, /\/demos\/10\/core-library\/#drill=/);
  assert.ok(seen.some((s) => s.url === `${ISSUER}/revoke`));
  const ticket = loc.split("#drill=")[1];
  const t = await handleCore(new Request(`${ORIGIN}/api/core/ticket?t=${ticket}`), e);
  assert.deepEqual(await t.json(), { did: DID, pds: PDS, handle: "alice.example.com" });
});

test("a token for a different account is refused", async () => {
  const { cb } = await signIn(env(), { sub: "did:plc:mallory" });
  assert.match(cb.headers.get("Location"), /#error=identity/);
});

test("a token without the atproto scope is refused", async () => {
  const { cb } = await signIn(env(), { scope: "transition:generic" });
  assert.match(cb.headers.get("Location"), /#error=identity/);
});

test("a callback naming another issuer is refused", async () => {
  const { cb } = await signIn(env(), { cbIss: "https://evil.example.com" });
  assert.match(cb.headers.get("Location"), /#error=issuer/);
});

test("an authorization server whose metadata names another issuer is never used", async () => {
  fakeBluesky({ iss: "https://evil.example.com" });
  const r = await handleCore(new Request(`${ORIGIN}/api/core/login?handle=alice.example.com`), env());
  assert.match(r.headers.get("Location"), /#error=resolve/);
});

test("a callback state can't be replayed", async () => {
  const e = env();
  const seen = fakeBluesky();
  await handleCore(new Request(`${ORIGIN}/api/core/login?handle=alice.example.com`), e);
  const state = new URLSearchParams(seen.filter((s) => s.url === `${ISSUER}/par`).pop().init.body).get("state");
  const url = `${ORIGIN}/api/core/callback?code=c&state=${state}&iss=${encodeURIComponent(ISSUER)}`;
  assert.match((await handleCore(new Request(url), e)).headers.get("Location"), /#drill=/);
  assert.match((await handleCore(new Request(url), e)).headers.get("Location"), /#error=expired/);
});

// ---------- drawing ----------

test("the same core always draws the same pixels", () => {
  const core = { n: 7, did: DID, handle: "alice.example.com", firstWeek: 2900, weeks: Array.from({ length: 60 }, (_, i) => [i % 7, i % 5, i % 3, i % 4, i * 3, i % 6, i % 9 === 0 ? 1 : 0, i % 2, i < 3 ? 40 : 0, i * 50]) };
  const a = createHash("sha256").update(render(core).data).digest("hex");
  const b = createHash("sha256").update(render(structuredClone(core)).data).digest("hex");
  assert.equal(a, b);
  const other = createHash("sha256").update(render({ ...core, did: "did:plc:other" }).data).digest("hex");
  assert.notEqual(a, other);
});

test("encodePng writes a valid PNG at double size", async () => {
  const rgba = new Uint8ClampedArray(3 * 2 * 4).fill(200);
  const png = await encodePng(3, 2, rgba);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const dv = new DataView(png.buffer);
  assert.equal(dv.getUint32(16), 6);
  assert.equal(dv.getUint32(20), 4);
});
