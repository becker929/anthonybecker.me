// The arcade's Worker. It serves the built site from static assets and keeps the high score tables.
//
//   GET  /api/scores                      -> { tube: [{ name, score, at }], bertie: [...] }
//   POST /api/scores { game, name, score } -> the same, after adding the score if it makes the table
//
// The tables live in one KV key each. Nothing here can check that a score was really played: the game
// runs in the visitor's browser. The limits below only keep the table tidy.

import { GAMES, ROWS, cleanName, place } from "./score_rules.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function tables(env) {
  const out = {};
  for (const game of Object.keys(GAMES)) out[game] = (await env.SCORES.get(game, "json")) ?? [];
  return out;
}

async function scores(request, env) {
  if (request.method === "GET") return json(await tables(env));
  if (request.method !== "POST") return json({ error: "GET or POST" }, 405);
  // Only the arcade's own page may add a score.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).hostname !== new URL(request.url).hostname) return json({ error: "not from here" }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: "not JSON" }, 400); }
  const rules = GAMES[body?.game];
  const name = cleanName(body?.name);
  const score = body?.score;
  if (!rules) return json({ error: "no such game" }, 400);
  if (!name) return json({ error: "a name needs a letter or a digit" }, 400);
  if (!Number.isInteger(score) || score < 1 || score > rules.max) return json({ error: "not a score" }, 400);
  const table = (await env.SCORES.get(body.game, "json")) ?? [];
  const next = place(table, { name, score, at: Date.now() });
  // A score that does not make the table changes nothing, so nothing is written.
  if (JSON.stringify(next) !== JSON.stringify(table)) await env.SCORES.put(body.game, JSON.stringify(next));
  return json(await tables(env));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/scores") return scores(request, env);
    return env.ASSETS.fetch(request);
  },
};
