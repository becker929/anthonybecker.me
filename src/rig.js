// RPC from the browser to the Mac, through one Durable Object.
//
// The Mac runs the zpkt harness (zpkt/lib/harness). It listens on nothing:
// it dials GET /api/rig/connect (a WebSocket, `Authorization: Bearer
// <RIG_TOKEN>`) and keeps that socket open. The browser calls
//
//   POST /api/rpc  {"method": "...", "params": {...}}   Bearer <SKRNG_TOKEN>
//
// and the broker sends {"id", "method", "params"} down the socket and holds
// the HTTP request open until the Mac answers {"id", "result" | "error"}, so
// the call is synchronous from the browser's side. Long work (a Claude Code
// job) answers at once with a job id; the browser polls job_status.
//
// Two different secrets: the browser's key can call the listed methods but
// cannot pretend to be the rig, and the rig's key never reaches a browser.
import { jsonError, noindex } from "./http.js";

export const METHODS = new Set(["ping", "ask", "feedback", "job", "job_status", "jobs"]);
const MAX_BODY = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_TIMEOUT_MS = 120_000; // `ask` runs a short Claude Code session

export function bearerMatches(request, want) {
  if (!want) return false;
  const got = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!got || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i += 1) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: noindex(new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" })),
  });
}

// Validates a browser call. Returns {error} or {call: {method, params, timeout}}.
export function parseCall(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Body must be a JSON object." };
  const { method, params = {}, timeout_ms } = body;
  if (!METHODS.has(method)) return { error: `Unknown method: ${String(method).slice(0, 40)}.` };
  if (!params || typeof params !== "object" || Array.isArray(params)) return { error: "params must be an object." };
  let timeout = DEFAULT_TIMEOUT_MS;
  if (timeout_ms !== undefined) {
    if (!Number.isFinite(timeout_ms) || timeout_ms < 1000) return { error: "timeout_ms must be at least 1000." };
    timeout = Math.min(timeout_ms, MAX_TIMEOUT_MS);
  }
  if (method === "ask" && timeout_ms === undefined) timeout = MAX_TIMEOUT_MS;
  return { call: { method, params, timeout } };
}

function stub(env) {
  return env.RIG.get(env.RIG.idFromName("rig"));
}

export async function handleRigConnect(request, env) {
  if (!env.RIG_TOKEN) return jsonError(503, "Rig is not configured (RIG_TOKEN unset).");
  if (request.headers.get("Upgrade") !== "websocket") return jsonError(426, "Expected a WebSocket.");
  if (!bearerMatches(request, env.RIG_TOKEN)) return jsonError(401, "Missing or wrong rig key.");
  return stub(env).fetch("https://rig/connect", { headers: { Upgrade: "websocket" } });
}

export async function handleRpc(request, env) {
  if (!env.SKRNG_TOKEN) return jsonError(503, "RPC is not configured (SKRNG_TOKEN unset).");
  if (!bearerMatches(request, env.SKRNG_TOKEN)) return jsonError(401, "Missing or wrong key.");
  const text = await request.text();
  if (text.length > MAX_BODY) return jsonError(413, "Body too large.");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(400, "Body must be JSON.");
  }
  const { error, call } = parseCall(body);
  if (error) return jsonError(400, error);
  return stub(env).fetch("https://rig/rpc", { method: "POST", body: JSON.stringify(call) });
}

export class RigBroker {
  constructor(state) {
    this.state = state;
    this.pending = new Map(); // id -> {resolve, timer}
    // Keepalive pings from the Mac are answered without waking the object.
    state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  rig() {
    return this.state.getWebSockets("rig")[0] || null;
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/connect") {
      // A new connection replaces the old one (the Mac reconnected).
      for (const old of this.state.getWebSockets("rig")) old.close(1000, "replaced");
      const [client, server] = Object.values(new WebSocketPair());
      this.state.acceptWebSocket(server, ["rig"]);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (pathname === "/rpc") return this.rpc(await request.json());
    return new Response("Not found", { status: 404 });
  }

  rpc({ method, params, timeout }) {
    const ws = this.rig();
    if (!ws) return json(503, { error: "The Mac is offline (no harness connected)." });
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(json(504, { error: `The Mac did not answer ${method} within ${timeout / 1000} s.` }));
      }, timeout);
      this.pending.set(id, { resolve, timer });
      try {
        ws.send(JSON.stringify({ id, method, params }));
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve(json(503, { error: "The Mac's socket is closing." }));
      }
    });
  }

  webSocketMessage(ws, message) {
    let msg;
    try {
      msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    const waiting = msg && this.pending.get(msg.id);
    if (!waiting) return; // hello, or a reply that already timed out
    clearTimeout(waiting.timer);
    this.pending.delete(msg.id);
    waiting.resolve("error" in msg ? json(502, { error: String(msg.error) }) : json(200, { result: msg.result ?? null }));
  }

  webSocketClose(ws) {
    this.failAll("The Mac disconnected before answering.");
  }

  webSocketError(ws) {
    this.failAll("The Mac's socket failed.");
  }

  failAll(message) {
    for (const [id, { resolve, timer }] of this.pending) {
      clearTimeout(timer);
      resolve(json(503, { error: message }));
      this.pending.delete(id);
    }
  }
}
