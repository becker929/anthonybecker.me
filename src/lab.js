// The lab: a private area where the site owner uploads tracks, samples and
// multitrack stems, and an analysis runner (a Python process outside
// Cloudflare) picks them up, measures them, and posts a report back.
//
// Two ways in:
//   * the browser, with the same password as the studio (env.DEMO_PASSWORD),
//     which sets a lab-scoped cookie;
//   * the runner, with `Authorization: Bearer <env.LAB_TOKEN>`.
// Files live in R2 (env.AUDIO_BUCKET) under lab/uploads/<item>/<name>, reports
// under lab/results/<item>.json plus lab/results/<item>/<artifact>. Item
// metadata is one KV value per item (env.AUDIO_KV, key lab:item:<id>) so the
// list is a prefix scan; the lab is one person's, so that scale is fine.
import { jsonError, jsonOk, noindex } from "./http.js";

export const LAB_BASE = "/lab";
export const LAB_PRIVATE_DIR = "/private/lab";
const COOKIE_NAME = "lab_auth";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const KEY_PREFIX = "lab:item:";
const KINDS = new Set(["track", "sample", "multitrack", "reference"]);
const STATUSES = new Set(["uploading", "pending", "running", "done", "failed"]);
const MAX_FILE_BYTES = 200_000_000;
const MAX_FILES_PER_ITEM = 40;
const MAX_REPORT_BYTES = 5_000_000;

// ---------- auth ----------------------------------------------------------

async function hmacHex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function labCookieAuthed(request, env) {
  if (!env.DEMO_PASSWORD) return false;
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return false;
  const [expiry, sig] = token.split(".");
  if (!expiry || !sig || Date.now() > Number(expiry)) return false;
  return (await hmacHex(env.DEMO_PASSWORD, `lab:${expiry}`)) === sig;
}

export function labTokenAuthed(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return Boolean(env.LAB_TOKEN) && auth === `Bearer ${env.LAB_TOKEN}`;
}

export async function labAuthed(request, env) {
  return labTokenAuthed(request, env) || (await labCookieAuthed(request, env));
}

export function labLoginPage(showError) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Lab</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0e1116;color:#e6e9ef}
  form{background:#151a22;padding:2rem;border-radius:10px;display:flex;flex-direction:column;gap:.75rem;min-width:280px;border:1px solid #262d39}
  h2{margin:0 0 .25rem;font-size:1.1rem} p{margin:0;color:#9aa4b5;font-size:.9rem}
  input{padding:.6rem .7rem;border-radius:6px;border:1px solid #262d39;background:#0e1116;color:#e6e9ef;font-size:1rem}
  button{padding:.6rem;border-radius:6px;border:none;background:#45e0e8;color:#0e1116;cursor:pointer;font-size:1rem;font-weight:600}
  .err{color:#ff5470;font-size:.85rem}
</style></head>
<body><form method="post" action="${LAB_BASE}/login">
  <h2>The lab</h2><p>Private. Same password as the studio.</p>
  ${showError ? '<div class="err">That is not it.</div>' : ""}
  <input type="password" name="password" placeholder="Password" autofocus required>
  <button type="submit">Enter</button>
</form></body></html>`;
}

export async function handleLabLogin(request, env) {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  if (!env.DEMO_PASSWORD || password !== env.DEMO_PASSWORD) {
    return new Response(labLoginPage(true), { status: 401, headers: noindex(new Headers({ "Content-Type": "text/html; charset=utf-8" })) });
  }
  const expiry = String(Date.now() + SESSION_MS);
  const sig = await hmacHex(env.DEMO_PASSWORD, `lab:${expiry}`);
  const headers = new Headers({ Location: `${LAB_BASE}/` });
  headers.append("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(`${expiry}.${sig}`)}; Path=${LAB_BASE}/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS / 1000)}`);
  return new Response(null, { status: 302, headers });
}

// ---------- items in KV -----------------------------------------------------

function newId() {
  const rand = crypto.getRandomValues(new Uint8Array(4));
  return `${Date.now().toString(36)}-${[...rand].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const ID_RE = /^[a-z0-9]{6,12}-[0-9a-f]{8}$/;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._()\-]{0,118}[A-Za-z0-9)]$/;

async function loadItem(env, id) {
  if (!ID_RE.test(id)) return null;
  const raw = await env.AUDIO_KV.get(KEY_PREFIX + id);
  return raw ? JSON.parse(raw) : null;
}

async function saveItem(env, item) {
  item.updated = new Date().toISOString();
  await env.AUDIO_KV.put(KEY_PREFIX + item.id, JSON.stringify(item));
  return item;
}

async function listItems(env) {
  const items = [];
  let cursor;
  do {
    const page = await env.AUDIO_KV.list({ prefix: KEY_PREFIX, cursor });
    for (const { name } of page.keys) {
      const raw = await env.AUDIO_KV.get(name);
      if (raw) items.push(JSON.parse(raw));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  items.sort((a, b) => (a.created < b.created ? 1 : -1));
  return items;
}

function publicItem(item) {
  // everything in the item is the owner's own data; nothing to hide, but keep the shape stable
  return item;
}

// ---------- handlers ----------------------------------------------------------

async function createItem(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonError(400, "Invalid JSON body."); }
  const kind = String(body.kind || "");
  if (!KINDS.has(kind)) return jsonError(400, "kind must be track, sample, multitrack or reference.");
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  const item = { id: newId(), kind, title, notes, files: [], status: "uploading", created: new Date().toISOString(), results: false };
  await saveItem(env, item);
  return jsonOk(publicItem(item));
}

async function uploadFile(request, env, item, name) {
  if (!NAME_RE.test(name)) return jsonError(400, "File name has characters we do not accept.");
  if (item.files.length >= MAX_FILES_PER_ITEM && !item.files.some((f) => f.name === name)) return jsonError(400, `At most ${MAX_FILES_PER_ITEM} files per item.`);
  const length = Number(request.headers.get("Content-Length") || 0);
  if (!length) return jsonError(411, "Content-Length is required.");
  if (length > MAX_FILE_BYTES) return jsonError(413, "File is larger than 200 MB.");
  const type = request.headers.get("Content-Type") || "application/octet-stream";
  const key = `lab/uploads/${item.id}/${name}`;
  await env.AUDIO_BUCKET.put(key, request.body, { httpMetadata: { contentType: type } });
  item.files = item.files.filter((f) => f.name !== name);
  item.files.push({ name, size: length, type, key });
  await saveItem(env, item);
  return jsonOk({ ok: true, file: { name, size: length, type } });
}

async function streamObject(env, key, downloadName) {
  const obj = await env.AUDIO_BUCKET.get(key);
  if (!obj) return jsonError(404, "No such file.");
  const headers = noindex(new Headers({
    "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
    "Cache-Control": "private, no-store",
  }));
  if (downloadName) headers.set("Content-Disposition", `inline; filename="${downloadName}"`);
  return new Response(obj.body ?? (await obj.arrayBuffer()), { headers });
}

async function putResults(request, env, item) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_REPORT_BYTES) return jsonError(413, "Report is too large.");
  let report;
  try { report = await request.json(); } catch { return jsonError(400, "Report must be JSON."); }
  if (!report || typeof report !== "object" || typeof report.headline !== "string") return jsonError(400, "Report needs at least a headline.");
  await env.AUDIO_BUCKET.put(`lab/results/${item.id}.json`, JSON.stringify(report), { httpMetadata: { contentType: "application/json" } });
  item.results = true; item.status = "done"; item.error = undefined; item.analysed = new Date().toISOString();
  await saveItem(env, item);
  return jsonOk({ ok: true });
}

async function putArtifact(request, env, item, name) {
  if (!NAME_RE.test(name)) return jsonError(400, "Artifact name has characters we do not accept.");
  const length = Number(request.headers.get("Content-Length") || 0);
  if (!length || length > 20_000_000) return jsonError(413, "Artifact must be between 1 byte and 20 MB.");
  const type = request.headers.get("Content-Type") || "application/octet-stream";
  await env.AUDIO_BUCKET.put(`lab/results/${item.id}/${name}`, request.body, { httpMetadata: { contentType: type } });
  item.artifacts = [...new Set([...(item.artifacts || []), name])];
  await saveItem(env, item);
  return jsonOk({ ok: true });
}

async function patchItem(request, env, item) {
  let body;
  try { body = await request.json(); } catch { return jsonError(400, "Invalid JSON body."); }
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) return jsonError(400, "Unknown status.");
    item.status = body.status;
  }
  if (typeof body.title === "string") item.title = body.title.trim().slice(0, 120);
  if (typeof body.notes === "string") item.notes = body.notes.trim().slice(0, 2000);
  if (typeof body.error === "string") item.error = body.error.slice(0, 2000);
  if (body.error === null) item.error = undefined;
  await saveItem(env, item);
  return jsonOk(publicItem(item));
}

async function deleteItem(env, item) {
  const keys = item.files.map((f) => f.key).concat([`lab/results/${item.id}.json`], (item.artifacts || []).map((a) => `lab/results/${item.id}/${a}`));
  for (const key of keys) await env.AUDIO_BUCKET.delete(key);
  await env.AUDIO_KV.delete(KEY_PREFIX + item.id);
  return jsonOk({ ok: true, deleted: item.id });
}

async function getItem(env, item) {
  let report = null;
  if (item.results) {
    const obj = await env.AUDIO_BUCKET.get(`lab/results/${item.id}.json`);
    if (obj) report = JSON.parse(new TextDecoder().decode(await obj.arrayBuffer()));
  }
  return jsonOk({ ...publicItem(item), report });
}

// Route everything under /lab. Returns a Response, or null when the path is
// not the lab's.
export async function handleLab(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === LAB_PRIVATE_DIR || path.startsWith(`${LAB_PRIVATE_DIR}/`)) return new Response("Not found", { status: 404 });
  if (path !== LAB_BASE && !path.startsWith(`${LAB_BASE}/`)) return null;
  if (path === LAB_BASE) return Response.redirect(`${url.origin}${LAB_BASE}/`, 301);
  const sub = path.slice(LAB_BASE.length + 1);   // "", "login", "api/items", "app.js"

  if (sub === "login" && request.method === "POST") return handleLabLogin(request, env);

  if (sub.startsWith("api/")) {
    if (!(await labAuthed(request, env))) {
      const hint = request.headers.get("Authorization") && !env.LAB_TOKEN ? "LAB_TOKEN is not configured on the server." : "Sign in or send the lab token.";
      return jsonError(401, hint);
    }
    return handleApi(request, env, sub.slice(4), url);
  }

  if (!(await labCookieAuthed(request, env))) {
    return new Response(labLoginPage(false), { status: 200, headers: noindex(new Headers({ "Content-Type": "text/html; charset=utf-8" })) });
  }
  const assetUrl = new URL(request.url);
  assetUrl.pathname = `${LAB_PRIVATE_DIR}/${sub || "index.html"}`;
  const resp = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  const headers = noindex(new Headers(resp.headers));
  headers.set("Cache-Control", "private, no-store");
  return new Response(resp.body, { status: resp.status, headers });
}

async function handleApi(request, env, api, url) {
  const m = request.method;
  if (api === "items" && m === "GET") {
    const status = url.searchParams.get("status");
    const items = (await listItems(env)).filter((it) => !status || it.status === status);
    return jsonOk({ items: items.map(publicItem) });
  }
  if (api === "items" && m === "POST") return createItem(request, env);
  if (api === "whoami" && m === "GET") return jsonOk({ runner: labTokenAuthed(request, env), ok: true });

  const parts = api.split("/");                  // items/<id>[/files|results|artifacts|finish/<name>]
  if (parts[0] !== "items" || !parts[1]) return jsonError(404, "No such API.");
  const item = await loadItem(env, parts[1]);
  if (!item) return jsonError(404, "No such item.");
  const rest = parts.slice(2);
  const name = rest[1] ? decodeURIComponent(rest[1]) : "";

  if (rest.length === 0 && m === "GET") return getItem(env, item);
  if (rest.length === 0 && m === "PATCH") return patchItem(request, env, item);
  if (rest.length === 0 && m === "DELETE") return deleteItem(env, item);
  if (rest[0] === "finish" && m === "POST") {
    if (!item.files.length) return jsonError(400, "Upload at least one file first.");
    item.status = "pending"; await saveItem(env, item); return jsonOk(publicItem(item));
  }
  if (rest[0] === "files" && name && m === "PUT") return uploadFile(request, env, item, name);
  if (rest[0] === "files" && name && m === "GET") {
    const f = item.files.find((x) => x.name === name);
    return f ? streamObject(env, f.key, f.name) : jsonError(404, "No such file.");
  }
  if (rest[0] === "results" && m === "PUT") return putResults(request, env, item);
  if (rest[0] === "artifacts" && name && m === "PUT") return putArtifact(request, env, item, name);
  if (rest[0] === "artifacts" && name && m === "GET") return streamObject(env, `lab/results/${item.id}/${name}`, name);
  return jsonError(404, "No such API.");
}
