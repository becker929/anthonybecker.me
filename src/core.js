// Core Library (demos/10/core-library): Bluesky sign-in, the core store, and
// the social card.
//
// Flow. The visitor types a handle. /api/core/login resolves it to a DID,
// finds the account's PDS and that PDS's authorization server, and starts
// atproto OAuth (PAR + PKCE + DPoP) as a public client asking only for the
// "atproto" scope, which proves who the visitor is and grants nothing else.
// /api/core/callback trades the code for a token, checks that the token's
// `sub` is the DID we resolved and that `iss` is the server we chose, then
// revokes the token unused. The visitor leaves with a one-time drill ticket.
//
// The browser then downloads the account's repository straight from its PDS
// and counts it (demos/10/core-library/sample.js); a repository can run to
// tens of megabytes, more than a Worker should parse. It posts the weekly
// counts with the ticket to /api/core/drill. The server checks the counts
// against the public profile, takes the name and avatar from the AppView
// itself, and files the core under the next accession number.
//
// Everything lives in one Durable Object (CoreLibrary): pending sign-ins,
// tickets, cores, and rendered cards. One object gives a strictly ordered
// accession counter, and the traffic is small.
import { jsonError, jsonOk } from "./http.js";
import { render } from "../demos/10/core-library/render.js";
import { COLS, MAX_WEEKS, weekOf } from "../demos/10/core-library/sample.js";

const PAGE = "/demos/10/core-library/";
const API = "/api/core/";
const APPVIEW = "https://public.api.bsky.app";
const PLC = "https://plc.directory";
const OAUTH_TTL_MS = 15 * 60 * 1000;
const TICKET_TTL_MS = 30 * 60 * 1000;
const REDRILL_MS = 20 * 3600 * 1000;
const PAD = 7;

// ---------- small helpers ----------

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomToken = (n = 24) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const enc = new TextEncoder();

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}

function errorPage(origin, code) {
  return redirect(`${origin}${PAGE}#error=${encodeURIComponent(code)}`);
}

async function getJson(url, init) {
  const res = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init && init.headers) } });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
}

export function normalizeHandle(input) {
  let h = String(input || "").trim().replace(/^@/, "").toLowerCase();
  if (h.startsWith("did:")) return h;
  if (h.startsWith("https://bsky.app/profile/")) h = h.slice(25).split("/")[0];
  if (h && !h.includes(".")) h += ".bsky.social";
  return /^[a-z0-9.-]{3,253}$/.test(h) ? h : "";
}

// ---------- identity ----------

export async function resolveDid(handleOrDid) {
  if (handleOrDid.startsWith("did:")) return handleOrDid;
  const r = await getJson(`${APPVIEW}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handleOrDid)}`);
  if (typeof r.did !== "string" || !r.did.startsWith("did:")) throw new Error("no DID for that handle");
  return r.did;
}

export async function pdsOf(did) {
  let doc;
  if (did.startsWith("did:plc:")) doc = await getJson(`${PLC}/${did}`);
  else if (did.startsWith("did:web:")) doc = await getJson(`https://${did.slice(8)}/.well-known/did.json`);
  else throw new Error("unsupported DID method");
  const svc = (doc.service || []).find((s) => s.id === "#atproto_pds" || s.id === `${did}#atproto_pds`);
  if (!svc || typeof svc.serviceEndpoint !== "string" || !svc.serviceEndpoint.startsWith("https://")) throw new Error("no PDS in DID document");
  return svc.serviceEndpoint.replace(/\/+$/, "");
}

export async function authServerOf(pds) {
  const pr = await getJson(`${pds}/.well-known/oauth-protected-resource`);
  const issuer = (pr.authorization_servers || [])[0];
  if (typeof issuer !== "string" || !issuer.startsWith("https://")) throw new Error("PDS names no authorization server");
  const meta = await getJson(`${issuer}/.well-known/oauth-authorization-server`);
  if (meta.issuer !== issuer) throw new Error("authorization server issuer mismatch");
  for (const k of ["authorization_endpoint", "token_endpoint", "pushed_authorization_request_endpoint"]) {
    if (typeof meta[k] !== "string" || !meta[k].startsWith("https://")) throw new Error(`authorization server lacks ${k}`);
  }
  return meta;
}

// ---------- OAuth client ----------

// Production uses the published metadata document. On localhost, atproto's
// loopback client id needs no document at all, which is how this is tested.
export function clientFor(origin) {
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (local) {
    const redirectUri = `${origin.replace("localhost", "127.0.0.1")}${API}callback`;
    return {
      clientId: `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=atproto`,
      redirectUri,
    };
  }
  return { clientId: `${origin}${PAGE}client-metadata.json`, redirectUri: `${origin}${API}callback` };
}

async function newDpopKey() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return crypto.subtle.exportKey("jwk", kp.privateKey);
}

async function dpopProof(jwk, htm, htu, nonce) {
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = { typ: "dpop+jwt", alg: "ES256", jwk: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } };
  const payload = { jti: randomToken(16), htm, htu, iat: Math.floor(Date.now() / 1000) };
  if (nonce) payload.nonce = nonce;
  const input = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(payload)))}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(input));
  return `${input}.${b64url(sig)}`;
}

// POSTs a form with a DPoP proof, retrying once with the server's nonce.
export async function dpopPost(url, form, jwk, nonce) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", DPoP: await dpopProof(jwk, "POST", url, nonce) },
      body: new URLSearchParams(form).toString(),
    });
    const fresh = res.headers.get("DPoP-Nonce");
    if (fresh) nonce = fresh;
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { body, nonce };
    if (body.error === "use_dpop_nonce" && fresh && attempt === 0) continue;
    throw new Error(`${new URL(url).host}: ${body.error || res.status}${body.error_description ? ` (${body.error_description})` : ""}`);
  }
}

async function pkce() {
  const verifier = randomToken(32);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", enc.encode(verifier)));
  return { verifier, challenge };
}

// ---------- routes ----------

function library(env) {
  return env.CORES.get(env.CORES.idFromName("library"));
}

async function call(env, op, args = {}) {
  const res = await library(env).fetch("https://core-library/op", { method: "POST", body: JSON.stringify({ op, args }) });
  return res.json();
}

async function handleLogin(request, env, url) {
  const handle = normalizeHandle(url.searchParams.get("handle"));
  const withdraw = url.searchParams.get("withdraw");
  if (!handle) return errorPage(url.origin, "handle");
  let did, pds, meta;
  try {
    did = await resolveDid(handle);
    pds = await pdsOf(did);
    meta = await authServerOf(pds);
  } catch (e) {
    return errorPage(url.origin, "resolve");
  }
  const { clientId, redirectUri } = clientFor(url.origin);
  const jwk = await newDpopKey();
  const { verifier, challenge } = await pkce();
  const state = randomToken(24);
  let par;
  try {
    par = await dpopPost(meta.pushed_authorization_request_endpoint, {
      client_id: clientId,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      redirect_uri: redirectUri,
      scope: "atproto",
      login_hint: handle,
    }, jwk);
  } catch (e) {
    return errorPage(url.origin, "authorize");
  }
  await call(env, "tmpPut", {
    key: `oauth:${state}`,
    ttl: OAUTH_TTL_MS,
    value: {
      did, pds, handle, jwk, verifier, clientId, redirectUri,
      issuer: meta.issuer,
      tokenEndpoint: meta.token_endpoint,
      revocationEndpoint: meta.revocation_endpoint || null,
      nonce: par.nonce || null,
      withdraw: withdraw && /^\d{1,7}$/.test(withdraw) ? Number(withdraw) : null,
    },
  });
  const auth = new URL(meta.authorization_endpoint);
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("request_uri", par.body.request_uri);
  return redirect(auth.toString());
}

async function handleCallback(request, env, url) {
  const q = url.searchParams;
  const origin = url.origin.replace("127.0.0.1", "localhost");
  const state = q.get("state");
  if (!state) return errorPage(origin, "denied");
  const { value: s } = await call(env, "tmpTake", { key: `oauth:${state}` });
  if (!s) return errorPage(origin, "expired");
  if (q.get("error") || !q.get("code")) return errorPage(origin, "denied");
  if (q.get("iss") !== s.issuer) return errorPage(origin, "issuer");
  let token;
  try {
    token = (await dpopPost(s.tokenEndpoint, {
      grant_type: "authorization_code",
      code: q.get("code"),
      redirect_uri: s.redirectUri,
      code_verifier: s.verifier,
      client_id: s.clientId,
    }, s.jwk, s.nonce)).body;
  } catch (e) {
    return errorPage(origin, "token");
  }
  const scopes = String(token.scope || "").split(" ");
  // The one check that makes this a sign-in: the server we resolved from the
  // DID document says the person who approved is that DID.
  if (token.sub !== s.did || !scopes.includes("atproto")) return errorPage(origin, "identity");
  if (s.revocationEndpoint && token.access_token) {
    await dpopPost(s.revocationEndpoint, { token: token.access_token, client_id: s.clientId }, s.jwk, s.nonce).catch(() => {});
  }
  if (s.withdraw) {
    const r = await call(env, "withdraw", { n: s.withdraw, did: s.did });
    return redirect(`${origin}${PAGE}c/${s.withdraw}${r.ok ? "" : "#error=withdraw"}`);
  }
  const ticket = randomToken(24);
  await call(env, "tmpPut", { key: `ticket:${ticket}`, ttl: TICKET_TTL_MS, value: { did: s.did, pds: s.pds, handle: s.handle } });
  return redirect(`${origin}${PAGE}#drill=${ticket}`);
}

// Checks the browser's counts. Returns an error string or null.
export function checkSample(sample, nowMs, profile) {
  if (!sample || typeof sample !== "object") return "no sample";
  const { firstWeek, weeks, hours, early } = sample;
  if (!Number.isInteger(firstWeek) || !Array.isArray(weeks) || weeks.length < 1 || weeks.length > MAX_WEEKS) return "bad weeks";
  const last = firstWeek + weeks.length - 1;
  const now = weekOf(nowMs);
  if (Math.abs(last - now) > 1) return "the core must end this week";
  if (firstWeek < weekOf(Date.UTC(2022, 10, 1))) return "the core starts before Bluesky";
  const ok = (v) => Number.isInteger(v) && v >= 0 && v <= 5e6;
  for (const w of weeks) if (!Array.isArray(w) || w.length !== COLS.length || !w.every(ok)) return "bad week";
  if (!Array.isArray(hours) || hours.length !== 24 || !hours.every(ok)) return "bad hours";
  if (!ok(early)) return "bad early count";
  if (profile && Number.isInteger(profile.postsCount)) {
    const posts = weeks.reduce((s, w) => s + w[0] + w[1] + w[2], 0);
    if (posts > profile.postsCount * 1.25 + 200) return "more posts than the profile shows";
  }
  return null;
}

async function handleDrill(request, env) {
  if (Number(request.headers.get("Content-Length") || 0) > 512 * 1024) return jsonError(413, "Too much data.");
  let body;
  try { body = await request.json(); } catch { return jsonError(400, "Expected JSON."); }
  const { value: t } = await call(env, "tmpTake", { key: `ticket:${String(body.ticket || "")}` });
  if (!t) return jsonError(403, "That drill ticket has expired. Sign in again.");
  let profile;
  try {
    profile = await getJson(`${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(t.did)}`);
  } catch {
    return jsonError(502, "Bluesky didn't return the profile. Try again in a minute.");
  }
  const now = Date.now();
  const problem = checkSample(body.sample, now, profile);
  if (problem) return jsonError(400, `The counts were refused: ${problem}.`);
  const s = body.sample;
  const avatar = typeof profile.avatar === "string" && profile.avatar.startsWith("https://cdn.bsky.app/") ? profile.avatar : null;
  const core = {
    did: t.did,
    handle: String(profile.handle || t.handle).slice(0, 253),
    displayName: String(profile.displayName || "").slice(0, 64),
    avatar,
    accountCreatedAt: profile.createdAt || null,
    drilledAt: new Date(now).toISOString(),
    profile: { posts: profile.postsCount | 0, followers: profile.followersCount | 0, follows: profile.followsCount | 0 },
    firstWeek: s.firstWeek,
    weeks: s.weeks,
    hours: s.hours,
    early: s.early,
  };
  const r = await call(env, "addCore", { core, redrillMs: REDRILL_MS });
  if (r.error) return jsonError(429, r.error);
  return jsonOk({ n: r.n });
}

// ---------- the core page and its card ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function handleCorePage(request, env, url, n) {
  const { core } = await call(env, "getCore", { n });
  if (!core) return env.ASSETS.fetch(new Request(`${url.origin}/404.html`)).then((r) => new Response(r.body, { status: 404, headers: r.headers }));
  const tpl = await (await env.ASSETS.fetch(new Request(`${url.origin}${PAGE}core.html`))).text();
  const pageUrl = `${url.origin}${PAGE}c/${n}`;
  const title = core.withdrawn ? `Core ${n}` : `Core ${n}: @${core.handle}`;
  const desc = core.withdrawn
    ? "This core was withdrawn by its donor."
    : `A core drilled from @${core.handle} on Bluesky, one bed per week.`;
  const data = JSON.stringify(core).replace(/</g, "\\u003c");
  const html = tpl
    .replaceAll("__TITLE__", esc(title))
    .replaceAll("__DESC__", esc(desc))
    .replaceAll("__URL__", esc(pageUrl))
    .replaceAll("__IMAGE__", esc(core.withdrawn ? `${url.origin}${PAGE}card.png` : `${pageUrl}/card.png`))
    .replace("__CORE_JSON__", data);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" } });
}

// PNG from RGBA, each source pixel drawn as a 2x2 block.
export async function encodePng(w, h, rgba, scale = 2) {
  const W = w * scale, H = h * scale;
  const stride = W * 4 + 1;
  const raw = new Uint8Array(stride * H);
  const src32 = new Uint32Array(rgba.buffer, rgba.byteOffset, w * h);
  const line = new Uint32Array(W);
  const line8 = new Uint8Array(line.buffer);
  for (let y = 0; y < h; y++) {
    for (let x = 0, o = 0; x < w; x++) {
      const v = src32[y * w + x] | 0xff000000; // opaque, whatever the buffer says
      for (let k = 0; k < scale; k++) line[o++] = v;
    }
    // First copy of the row uses the Sub filter (repeated pixels become
    // zeros); the copies below it use Up, which makes them all zeros. Both
    // keep the deflate input cheap.
    let o = y * scale * stride;
    raw[o++] = 1;
    for (let i = 0; i < 4; i++) raw[o++] = line8[i];
    for (let i = 4; i < line8.length; i++) raw[o++] = (line8[i] - line8[i - 4]) & 255;
    for (let k = 1; k < scale; k++) raw[(y * scale + k) * stride] = 2;
  }
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  const chunk = (type, data) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    out.set(enc.encode(type), 4);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 6;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", z), chunk("IEND", new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { png.set(p, o); o += p.length; }
  return png;
}

let CRC_TABLE;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// The card is drawn at half size without fine texture, then doubled, so it
// fits a Worker's CPU budget. It is cached once drawn.
export function renderCard(core) {
  return render({ ...core }, { width: 600, height: 315, boxes: 1, ppm: 470, detail: false });
}

async function handleCard(request, env, url, n) {
  const fallback = () => redirect(`${url.origin}${PAGE}card.png`);
  const cached = await call(env, "cardGet", { n });
  let bytes = cached.png ? Uint8Array.from(atob(cached.png), (c) => c.charCodeAt(0)) : null;
  if (!bytes) {
    const { core } = await call(env, "getCore", { n });
    if (!core || core.withdrawn) return fallback();
    const img = renderCard({ ...core, n });
    bytes = await encodePng(img.width, img.height, img.data);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    await call(env, "cardPut", { n, png: btoa(bin) });
  }
  return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}

export async function handleCore(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const m = path.match(/^\/demos\/10\/core-library\/c\/(\d{1,7})(\/card\.png)?\/?$/);
  if (m && request.method === "GET") {
    if (!env.CORES) return jsonError(503, "Core storage is not configured.");
    return m[2] ? handleCard(request, env, url, Number(m[1])) : handleCorePage(request, env, url, Number(m[1]));
  }
  if (!path.startsWith(API)) return null;
  if (!env.CORES) return jsonError(503, "Core storage is not configured.");
  const sub = path.slice(API.length);
  if (sub === "login" && request.method === "GET") return handleLogin(request, env, url);
  if (sub === "callback" && request.method === "GET") return handleCallback(request, env, url);
  if (sub === "ticket" && request.method === "GET") {
    const { value } = await call(env, "tmpPeek", { key: `ticket:${url.searchParams.get("t") || ""}` });
    return value ? jsonOk({ did: value.did, pds: value.pds, handle: value.handle }) : jsonError(404, "No such ticket.");
  }
  if (sub === "drill" && request.method === "POST") return handleDrill(request, env);
  if (sub === "list" && request.method === "GET") {
    const before = Number(url.searchParams.get("before")) || 0;
    const r = await call(env, "list", { before, limit: 24 });
    return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  const c = sub.match(/^c\/(\d{1,7})$/);
  if (c && request.method === "GET") {
    const { core } = await call(env, "getCore", { n: Number(c[1]) });
    return core ? jsonOk(core) : jsonError(404, "No such core.");
  }
  return jsonError(404, "Not found.");
}

// ---------- storage ----------

const coreKey = (n) => `core:${String(n).padStart(PAD, "0")}`;

export class CoreLibrary {
  constructor(state) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request) {
    const { op, args } = await request.json();
    const fn = this[`op_${op}`];
    if (!fn) return Response.json({ error: "unknown op" }, { status: 400 });
    return Response.json(await fn.call(this, args || {}));
  }

  async op_tmpPut({ key, value, ttl }) {
    await this.storage.put(key, { value, exp: Date.now() + ttl });
    // Sign-ins that never came back would pile up; sweep a few each time.
    const prefix = key.slice(0, key.indexOf(":") + 1);
    const now = Date.now();
    for (const [k, e] of await this.storage.list({ prefix, limit: 50 })) {
      if (e.exp < now) await this.storage.delete(k);
    }
    return { ok: true };
  }

  async op_tmpPeek({ key }) {
    const e = await this.storage.get(key);
    if (!e || e.exp < Date.now()) return { value: null };
    return { value: e.value };
  }

  async op_tmpTake({ key }) {
    const e = await this.storage.get(key);
    if (e) await this.storage.delete(key);
    if (!e || e.exp < Date.now()) return { value: null };
    return { value: e.value };
  }

  async op_addCore({ core, redrillMs }) {
    const dk = `did:${core.did}`;
    const donor = (await this.storage.get(dk)) || { cores: [], last: 0 };
    const now = Date.parse(core.drilledAt);
    if (now - donor.last < redrillMs) {
      const latest = donor.cores[donor.cores.length - 1];
      return { error: `This account was drilled less than a day ago. Its latest is core ${latest}.` };
    }
    const n = ((await this.storage.get("next")) || 1);
    await this.storage.put("next", n + 1);
    await this.storage.put(coreKey(n), { ...core, n });
    donor.cores.push(n);
    donor.last = now;
    await this.storage.put(dk, donor);
    return { n };
  }

  async op_getCore({ n }) {
    return { core: (await this.storage.get(coreKey(n))) || null };
  }

  async op_list({ before, limit }) {
    const opts = { prefix: "core:", reverse: true, limit: Math.min(48, limit || 24) };
    if (before) opts.end = coreKey(before);
    const rows = await this.storage.list(opts);
    const cores = [];
    for (const c of rows.values()) {
      if (c.withdrawn) continue;
      cores.push({ n: c.n, did: c.did, handle: c.handle, displayName: c.displayName, drilledAt: c.drilledAt, firstWeek: c.firstWeek, weeks: c.weeks });
    }
    return { cores, more: rows.size === opts.limit };
  }

  async op_withdraw({ n, did }) {
    const c = await this.storage.get(coreKey(n));
    if (!c || c.did !== did) return { ok: false };
    await this.storage.put(coreKey(n), { n, withdrawn: true, drilledAt: c.drilledAt, withdrawnAt: new Date().toISOString() });
    await this.storage.delete(`card:${n}`);
    return { ok: true };
  }

  async op_cardGet({ n }) {
    return { png: (await this.storage.get(`card:${n}`)) || null };
  }

  async op_cardPut({ n, png }) {
    await this.storage.put(`card:${n}`, png);
    return { ok: true };
  }
}
