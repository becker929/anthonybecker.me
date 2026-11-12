// Run with: node --test worker.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";
import { cleanName, place, ROWS } from "./score_rules.js";

function env() {
  const store = new Map();
  return {
    store,
    SCORES: { get: async (k) => (store.has(k) ? JSON.parse(store.get(k)) : null), put: async (k, v) => void store.set(k, v) },
    ASSETS: { fetch: async () => new Response("asset") },
  };
}
const post = (body, headers = {}) =>
  new Request("https://arcade.anthonybecker.me/api/scores", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

test("names are capitals and digits, eight at most", () => {
  assert.equal(cleanName("  anthony becker "), "ANTHONY");
  assert.equal(cleanName("<b>x</b>"), "BXB");
  assert.equal(cleanName("!!!"), "");
});

test("a table keeps the best eight, earlier first on a tie", () => {
  let table = [];
  for (let i = 1; i <= 10; i++) table = place(table, { name: "A" + i, score: i % 5, at: i });
  assert.equal(table.length, ROWS);
  assert.deepEqual(table.slice(0, 2).map((e) => e.name), ["A4", "A9"]);
});

test("scores are added, read back, and refused when malformed", async () => {
  const e = env();
  let r = await worker.fetch(post({ game: "bertie", name: "ab", score: 7 }), e);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).bertie.map((x) => [x.name, x.score]), [["AB", 7]]);
  r = await worker.fetch(new Request("https://arcade.anthonybecker.me/api/scores"), e);
  assert.deepEqual(Object.keys(await r.json()), ["tube", "bertie"]);
  for (const bad of [{ game: "pong", name: "A", score: 1 }, { game: "tube", name: "", score: 1 }, { game: "tube", name: "A", score: 0 }, { game: "tube", name: "A", score: 1.5 }, { game: "tube", name: "A", score: 99999 }]) {
    assert.equal((await worker.fetch(post(bad), e)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await worker.fetch(post({ game: "tube", name: "A", score: 3 }, { origin: "https://example.com" }), e)).status, 403);
});

test("a score below a full table writes nothing", async () => {
  const e = env();
  for (let i = 0; i < ROWS; i++) await worker.fetch(post({ game: "tube", name: "P" + i, score: 10 }), e);
  const before = e.store.get("tube");
  await worker.fetch(post({ game: "tube", name: "LOW", score: 2 }), e);
  assert.equal(e.store.get("tube"), before);
});

test("everything else is the site", async () => {
  assert.equal(await (await worker.fetch(new Request("https://arcade.anthonybecker.me/"), env())).text(), "asset");
});
