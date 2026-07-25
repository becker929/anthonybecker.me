// Gated, unlisted image-generation demo. Everything under BASE requires a
// password (checked against env.DEMO_PASSWORD) before the real app assets
// (under PRIVATE_DIR) or the generate API are reachable. Direct requests to
// PRIVATE_DIR are always rejected — the only way assets from there get
// served is the internal env.ASSETS.fetch() call below, which never goes
// back through this fetch() handler.
import { listCards, loadCard, saveCard } from "./cards.js";
import { putBlob, getBlob } from "./blobs.js";
import { handlePortrait } from "./portrait.js";
import { noindex, jsonError, jsonOk } from "./http.js";

const BASE = "/studio-c33f3ea406426b41";
const PRIVATE_DIR = "/private/c33f3ea406426b41";
const COOKIE_NAME = "studio_auth";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const GEMINI_MODEL = "gemini-2.5-flash-image";

async function hmacHex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
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

async function isAuthed(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return false;
  const [expiry, sig] = token.split(".");
  if (!expiry || !sig) return false;
  if (Date.now() > Number(expiry)) return false;
  const expected = await hmacHex(env.DEMO_PASSWORD, expiry);
  return expected === sig;
}

function loginPage(showError) {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Locked</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#eee}
  form{background:#1c1c1c;padding:2rem;border-radius:10px;display:flex;flex-direction:column;gap:.75rem;min-width:280px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  h2{margin:0 0 .25rem}
  input{padding:.6rem .7rem;border-radius:6px;border:1px solid #3a3a3a;background:#0d0d0d;color:#eee;font-size:1rem}
  button{padding:.6rem;border-radius:6px;border:none;background:#4a7dff;color:white;cursor:pointer;font-size:1rem}
  button:hover{background:#3d6be0}
  .err{color:#ff6b6b;font-size:.85rem}
</style></head>
<body>
<form method="POST" action="${BASE}/login">
  <h2>Password required</h2>
  ${showError ? '<div class="err">Incorrect password.</div>' : ""}
  <input type="password" name="password" placeholder="Password" autofocus required>
  <button type="submit">Enter</button>
</form>
</body></html>`;
}

async function handleLogin(request, env) {
  const form = await request.formData();
  const password = String(form.get("password") || "");
  const expected = env.DEMO_PASSWORD;
  if (!expected || password !== expected) {
    return new Response(loginPage(true), {
      status: 401,
      headers: noindex(new Headers({ "Content-Type": "text/html; charset=utf-8" })),
    });
  }
  const expiry = String(Date.now() + SESSION_MS);
  const sig = await hmacHex(expected, expiry);
  const token = `${expiry}.${sig}`;
  const headers = new Headers({ Location: `${BASE}/` });
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=${BASE}/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(SESSION_MS / 1000)}`,
  );
  return new Response(null, { status: 302, headers });
}

const MAX_IMAGE_B64_LEN = 15_000_000; // ~11MB decoded, plenty for a photo

async function handleGenerate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const images = Array.isArray(body.images) ? body.images : [];

  if (!prompt) return jsonError(400, "A prompt is required.");
  if (images.length > 2) return jsonError(400, "At most two images are allowed.");
  for (const img of images) {
    if (!img || typeof img.data !== "string" || typeof img.mimeType !== "string") {
      return jsonError(400, "Each image needs mimeType and base64 data.");
    }
    if (!img.mimeType.startsWith("image/")) {
      return jsonError(400, "Only image/* mime types are allowed.");
    }
    if (img.data.length > MAX_IMAGE_B64_LEN) {
      return jsonError(400, "Image is too large.");
    }
  }

  if (!env.GEMINI_API_KEY) return jsonError(500, "Server is missing GEMINI_API_KEY.");

  const parts = [
    ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    { text: prompt },
  ];

  const geminiResp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    },
  );

  if (!geminiResp.ok) {
    const errText = await geminiResp.text();
    return jsonError(502, `Gemini API error (${geminiResp.status}): ${errText.slice(0, 500)}`);
  }

  const data = await geminiResp.json();
  const resultParts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = resultParts.find((p) => p.inlineData);
  if (!imagePart) {
    const textPart = resultParts.find((p) => p.text);
    return jsonError(502, textPart ? `No image returned: ${textPart.text}` : "No image returned.");
  }

  return new Response(
    JSON.stringify({
      mimeType: imagePart.inlineData.mimeType,
      data: imagePart.inlineData.data,
    }),
    { headers: noindex(new Headers({ "Content-Type": "application/json" })) },
  );
}

async function handleListCards(env) {
  const cards = await listCards(env.CARD_DB);
  return jsonOk(cards);
}

async function handleLoadCard(env, id) {
  const card = await loadCard(env.CARD_DB, id);
  if (!card) return jsonError(404, "Card not found.");
  return jsonOk(card);
}

async function handleSaveCard(request, env, id) {
  let card;
  try {
    card = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }
  try {
    const saved = await saveCard(env.CARD_DB, id, card);
    return jsonOk(saved);
  } catch (err) {
    return jsonError(400, err.message);
  }
}

async function handleUploadBlob(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }
  try {
    const hash = await putBlob(env.CARD_BUCKET, body);
    return jsonOk({ hash });
  } catch (err) {
    return jsonError(400, err.message);
  }
}

async function handleGetBlob(env, hash) {
  const obj = await getBlob(env.CARD_BUCKET, hash);
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Never let the underlying asset directory be reached directly — only
    // the authenticated passthrough below (via env.ASSETS.fetch) may serve it.
    if (path === PRIVATE_DIR || path.startsWith(`${PRIVATE_DIR}/`)) {
      return new Response("Not found", { status: 404 });
    }

    if (path === BASE) {
      return Response.redirect(`${url.origin}${BASE}/`, 301);
    }

    if (!path.startsWith(`${BASE}/`)) {
      return env.ASSETS.fetch(request);
    }

    const sub = path.slice(BASE.length + 1); // "", "login", "api/generate", "app.js", ...

    if (sub === "login" && request.method === "POST") {
      return handleLogin(request, env);
    }

    const authed = await isAuthed(request, env);
    if (!authed) {
      return new Response(loginPage(false), {
        status: 200,
        headers: noindex(new Headers({ "Content-Type": "text/html; charset=utf-8" })),
      });
    }

    if (sub === "api/generate" && request.method === "POST") {
      return handleGenerate(request, env);
    }

    if (sub === "api/cards" && request.method === "GET") {
      return handleListCards(env);
    }

    if (sub.startsWith("api/cards/") && request.method === "GET") {
      return handleLoadCard(env, sub.slice("api/cards/".length));
    }

    if (sub.startsWith("api/cards/") && request.method === "PUT") {
      return handleSaveCard(request, env, sub.slice("api/cards/".length));
    }

    if (sub === "api/blobs" && request.method === "POST") {
      return handleUploadBlob(request, env);
    }

    if (sub === "api/portrait" && request.method === "POST") {
      return handlePortrait(request, env);
    }

    if (sub.startsWith("blob/") && request.method === "GET") {
      return handleGetBlob(env, sub.slice("blob/".length));
    }

    const assetUrl = new URL(request.url);
    assetUrl.pathname = `${PRIVATE_DIR}/${sub}`;
    const resp = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    const headers = noindex(new Headers(resp.headers));
    return new Response(resp.body, { status: resp.status, headers });
  },
};
