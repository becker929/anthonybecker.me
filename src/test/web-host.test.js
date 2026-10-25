import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../index.js";

function env() {
  const seen = [];
  return {
    seen,
    ASSETS: { fetch: async (req) => { seen.push(new URL(req.url).pathname); return new Response("ok"); } },
  };
}

test("web host root serves web/", async () => {
  const e = env();
  await worker.fetch(new Request("https://web.anthonybecker.me/"), e);
  assert.deepEqual(e.seen, ["/web/"]);
});

test("apex root is left to the static site", async () => {
  const e = env();
  await worker.fetch(new Request("https://anthonybecker.me/"), e);
  assert.notDeepEqual(e.seen, ["/web/"]);
});
