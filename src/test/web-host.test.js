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

test("wrangler.toml lists the apex as a custom domain, not only web.", async () => {
  // A deploy makes the custom domains exactly the routes listed; leaving the apex out unbinds anthonybecker.me.
  const { readFileSync } = await import("node:fs");
  const toml = readFileSync(new URL("../../wrangler.toml", import.meta.url), "utf8");
  const routes = toml.match(/^routes\s*=\s*\[([\s\S]*?)^\]/m)?.[1] ?? toml.match(/^routes\s*=\s*\[(.*)\]$/m)?.[1] ?? "";
  for (const host of ["anthonybecker.me", "web.anthonybecker.me"]) {
    assert.match(routes, new RegExp(`pattern\\s*=\\s*"${host.replace(/\./g, "\\.")}"\\s*,\\s*custom_domain\\s*=\\s*true`), `${host} missing from routes`);
  }
});
