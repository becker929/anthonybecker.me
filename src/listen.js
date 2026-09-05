// "Stage 2: ask producers" listening test — API for research/sound-function.
//
// Two routes: POST /api/listen stores one pair's answer (posted immediately
// after each pair, so a partial session still counts), and
// GET /api/listen/export dumps every stored record as JSON for analysis.
// No cookies, names, emails, or IPs are stored — the client-generated
// `session` id is the only thing that ties a person's answers together,
// and it lives only in that browser tab's memory.
import { jsonError, jsonOk, noindex } from "./http.js";

const MAX_STRING_LEN = 40;
const KEY_PREFIX = "listen:";

// The six jobs on the research page, plus "not_sure" for the per-sound
// identification question (rendered as "not sure" in the UI).
const JOB_VALUES = new Set(["kick", "rumble", "hat", "clap", "hook", "space", "not_sure"]);
const ORDER_VALUES = new Set(["ab", "ba"]); // which of pair.a/pair.b was shown as "A"
const MORE_VALUES = new Set(["a", "b", "same"]);
const PRODUCER_VALUES = new Set(["yes", "no", "dj"]);
const MAX_ELAPSED_MS = 10 * 60 * 1000; // generous per-pair ceiling, 10 minutes
const MAX_YEARS = 80;

const ALLOWED_TOP_LEVEL_KEYS = new Set(["session", "pair", "order", "jobs", "more", "elapsed_ms", "profile"]);

function isShortString(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_STRING_LEN;
}

// Returns an error message string, or null if the body is valid.
function validateListenBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Body must be a JSON object.";
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) return `Unknown field: ${key}.`;
  }

  if (!isShortString(body.session)) {
    return `session must be a non-empty string of at most ${MAX_STRING_LEN} characters.`;
  }
  if (!isShortString(body.pair)) {
    return `pair must be a non-empty string of at most ${MAX_STRING_LEN} characters.`;
  }
  if (!ORDER_VALUES.has(body.order)) {
    return `order must be one of: ${[...ORDER_VALUES].join(", ")}.`;
  }

  const jobs = body.jobs;
  if (!jobs || typeof jobs !== "object" || Array.isArray(jobs)) {
    return "jobs must be an object with a and b.";
  }
  if (!JOB_VALUES.has(jobs.a)) return `jobs.a must be one of: ${[...JOB_VALUES].join(", ")}.`;
  if (!JOB_VALUES.has(jobs.b)) return `jobs.b must be one of: ${[...JOB_VALUES].join(", ")}.`;
  if (Object.keys(jobs).length !== 2) return "jobs must only have a and b.";

  if (!MORE_VALUES.has(body.more)) {
    return `more must be one of: ${[...MORE_VALUES].join(", ")}.`;
  }

  if (
    typeof body.elapsed_ms !== "number" ||
    !Number.isFinite(body.elapsed_ms) ||
    body.elapsed_ms < 0 ||
    body.elapsed_ms > MAX_ELAPSED_MS
  ) {
    return `elapsed_ms must be a number between 0 and ${MAX_ELAPSED_MS}.`;
  }

  if (body.profile !== undefined && body.profile !== null) {
    const profile = body.profile;
    if (typeof profile !== "object" || Array.isArray(profile)) return "profile must be an object.";
    for (const key of Object.keys(profile)) {
      if (key !== "producer" && key !== "years") return `Unknown field: profile.${key}.`;
    }
    if (
      profile.producer !== undefined &&
      profile.producer !== null &&
      !PRODUCER_VALUES.has(profile.producer)
    ) {
      return `profile.producer must be one of: ${[...PRODUCER_VALUES].join(", ")}.`;
    }
    if (profile.years !== undefined && profile.years !== null) {
      if (
        typeof profile.years !== "number" ||
        !Number.isFinite(profile.years) ||
        profile.years < 0 ||
        profile.years > MAX_YEARS
      ) {
        return `profile.years must be a number between 0 and ${MAX_YEARS}.`;
      }
    }
  }

  return null;
}

// Answers arriving in the same millisecond in the same isolate would otherwise
// sort by their random suffix; a per-isolate counter keeps them in arrival
// order (across isolates the millisecond still decides, which is fine).
let seq = 0;

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export async function handleListenSubmit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const error = validateListenBody(body);
  if (error) return jsonError(400, error);

  const now = new Date();
  // ISO timestamps sort lexicographically in time order, so a plain
  // alphabetical key listing (what KV gives us) already yields the
  // records in the order they were submitted.
  seq = (seq + 1) % 1_000_000;
  const key = `${KEY_PREFIX}${now.toISOString()}:${String(seq).padStart(6, "0")}:${randomId()}`;

  const record = {
    session: body.session,
    pair: body.pair,
    order: body.order,
    jobs: { a: body.jobs.a, b: body.jobs.b },
    more: body.more,
    elapsed_ms: body.elapsed_ms,
    profile: body.profile
      ? { producer: body.profile.producer ?? null, years: body.profile.years ?? null }
      : null,
    server_time: now.toISOString(),
  };

  await env.AUDIO_KV.put(key, JSON.stringify(record));
  return jsonOk({ ok: true });
}

export async function handleListenExport(env) {
  const records = [];
  let cursor;
  do {
    const page = await env.AUDIO_KV.list({ prefix: KEY_PREFIX, cursor });
    for (const { name } of page.keys) {
      const value = await env.AUDIO_KV.get(name);
      if (!value) continue;
      try {
        records.push(JSON.parse(value));
      } catch {
        // Skip a malformed entry rather than fail the whole export.
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const headers = noindex(new Headers({ "Content-Type": "application/json" }));
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(records), { headers });
}
