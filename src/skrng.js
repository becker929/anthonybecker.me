// Spoken feedback from the /skrng voice review.
//
// POST /api/skrng/feedback stores one track's feedback: what was said after
// the track played (the speech recogniser's transcript), anything typed, and
// how the item ended. GET /api/skrng/feedback?batch=N returns a batch's
// records (or every record without ?batch) for the agent that builds the
// next batch.
//
// Text only. The repo rule is that audio from the owner reaches agents
// through Google Drive, never through an upload path in this Worker, so the
// voice itself stays on the phone and only the recogniser's words come here.
//
// Both routes need `Authorization: Bearer <SKRNG_TOKEN>`. The page is public
// and unlisted; the feedback is the owner's own words about unreleased
// work, so reading it is gated as well as writing it. Without the secret set
// both routes answer 503 rather than accept or leak anything.
import { jsonError, jsonOk, noindex } from "./http.js";

const KEY_PREFIX = "skrng:fb:";
const ENDED_BY = new Set(["voice", "tap", "earbud", "stop"]);
const STT = new Set(["speech", "none"]);
const ALLOWED = new Set([
  "id", "session", "batch", "track", "index", "transcript", "typed",
  "ended_by", "replays", "listen_ms", "client_time", "stt",
]);
const MAX_TRANSCRIPT = 6000;
const MAX_TYPED = 2000;
const MAX_LISTEN_MS = 60 * 60 * 1000;

function authorised(request, env) {
  const want = env.SKRNG_TOKEN;
  const got = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!got || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i += 1) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

function gate(request, env) {
  if (!env.SKRNG_TOKEN) return jsonError(503, "Feedback storage is not configured (SKRNG_TOKEN unset).");
  if (!authorised(request, env)) return jsonError(401, "Missing or wrong key.");
  return null;
}

const isId = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max && /^[A-Za-z0-9._-]+$/.test(v);
const isText = (v, max) => v === undefined || v === null || (typeof v === "string" && v.length <= max);
const isCount = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;

// Returns an error message, or null when the body is valid.
export function validateFeedback(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Body must be a JSON object.";
  for (const key of Object.keys(body)) if (!ALLOWED.has(key)) return `Unknown field: ${key}.`;
  if (!isId(body.id, 64)) return "id must be a short identifier.";
  if (!isId(body.session, 64)) return "session must be a short identifier.";
  if (typeof body.batch !== "number" || !Number.isFinite(body.batch) || body.batch < 0 || body.batch > 100000) {
    return "batch must be a number.";
  }
  if (!isId(body.track, 160)) return "track must be a render id.";
  if (!isCount(body.index, 1000)) return "index must be a whole number.";
  if (!isText(body.transcript, MAX_TRANSCRIPT)) return `transcript must be text of at most ${MAX_TRANSCRIPT} characters.`;
  if (!isText(body.typed, MAX_TYPED)) return `typed must be text of at most ${MAX_TYPED} characters.`;
  if (!ENDED_BY.has(body.ended_by)) return `ended_by must be one of: ${[...ENDED_BY].join(", ")}.`;
  if (!isCount(body.replays, 100)) return "replays must be a whole number.";
  if (!isCount(body.listen_ms, MAX_LISTEN_MS)) return "listen_ms must be a whole number of milliseconds.";
  if (typeof body.client_time !== "string" || Number.isNaN(Date.parse(body.client_time))) return "client_time must be an ISO time.";
  if (!STT.has(body.stt)) return `stt must be one of: ${[...STT].join(", ")}.`;
  return null;
}

export async function handleSkrngFeedbackSubmit(request, env) {
  const blocked = gate(request, env);
  if (blocked) return blocked;
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }
  const error = validateFeedback(body);
  if (error) return jsonError(400, error);

  // The client's id is in the key, so a retry after a dropped response
  // overwrites its first copy instead of adding a second. Batch first, so a
  // prefix listing returns one batch; then time, so it lists in order.
  const clientTime = new Date(body.client_time).toISOString();
  const key = `${KEY_PREFIX}${body.batch}:${clientTime}:${body.id}`;
  const record = {
    id: body.id,
    session: body.session,
    batch: body.batch,
    track: body.track,
    index: body.index,
    transcript: (body.transcript || "").trim(),
    typed: (body.typed || "").trim(),
    ended_by: body.ended_by,
    replays: body.replays,
    listen_ms: body.listen_ms,
    stt: body.stt,
    client_time: clientTime,
    server_time: new Date().toISOString(),
  };
  await env.AUDIO_KV.put(key, JSON.stringify(record));
  return jsonOk({ ok: true, key });
}

export async function handleSkrngFeedbackList(request, env) {
  const blocked = gate(request, env);
  if (blocked) return blocked;
  const raw = new URL(request.url).searchParams.get("batch");
  let prefix = KEY_PREFIX;
  if (raw !== null) {
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) return jsonError(400, "batch must be a number.");
    prefix = `${KEY_PREFIX}${n}:`;
  }
  const records = [];
  let cursor;
  do {
    const page = await env.AUDIO_KV.list({ prefix, cursor });
    for (const { name } of page.keys) {
      const value = await env.AUDIO_KV.get(name);
      if (!value) continue;
      try {
        records.push(JSON.parse(value));
      } catch {
        // Skip a malformed entry rather than fail the whole listing.
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  const headers = noindex(new Headers({ "Content-Type": "application/json" }));
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(records), { headers });
}
