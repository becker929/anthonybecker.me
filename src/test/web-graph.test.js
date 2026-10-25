import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGraph, parsePostRef, EDGE_COLLECTION } from "../../web/graph.js";

const ROOT = "at://did:plc:aaa/app.bsky.feed.post/r1";
const OTHER = "at://did:plc:bbb/app.bsky.feed.post/o1";
const PARENT = "at://did:plc:ccc/app.bsky.feed.post/p1";

const post = (uri, extra = {}) => ({ uri, cid: `cid-${uri}`, author: { handle: "x.test" }, record: { text: uri, createdAt: "2026-01-01T00:00:00Z", ...extra } });

function fakeFetch(calls) {
  return async (url) => {
    const u = new URL(url);
    calls.push(u);
    const json = (body) => new Response(JSON.stringify(body));
    if (u.pathname.endsWith("getPosts")) {
      const posts = u.searchParams.getAll("uris").map((uri) => (uri === ROOT ? post(uri, { reply: { parent: { uri: PARENT }, root: { uri: PARENT } } }) : post(uri)));
      return json({ posts });
    }
    if (u.pathname.endsWith("getBacklinks")) {
      const src = u.searchParams.get("source");
      if (src === "app.bsky.feed.post:embed.record.uri") return json({ records: [{ did: "did:plc:bbb", collection: "app.bsky.feed.post", rkey: "o1" }] });
      if (src === `${EDGE_COLLECTION}:to.uri`) return json({ records: [{ did: "did:plc:ddd", collection: EDGE_COLLECTION, rkey: "e1" }] });
      return json({ records: [] });
    }
    if (u.pathname.endsWith("getRecord")) return json({ value: { from: { uri: OTHER }, to: { uri: ROOT }, kind: "supports", note: "n" } });
    return new Response("", { status: 404 });
  };
}

test("explore merges own, incoming and custom edges", async () => {
  const calls = [];
  const r = await makeGraph(fakeFetch(calls)).explore(ROOT);
  const key = (e) => `${e.kind}:${e.from}>${e.to}`;
  assert.deepEqual(r.edges.map(key).sort(), [`quote:${OTHER}>${ROOT}`, `reply:${ROOT}>${PARENT}`, `supports:${OTHER}>${ROOT}`].sort());
  assert.equal(r.edges.find((e) => e.kind === "supports").by, "did:plc:ddd");
  assert.deepEqual(r.nodes.map((n) => n.uri).sort(), [OTHER, PARENT, ROOT].sort());
});

test("parsePostRef takes bsky.app links and AT-URIs", () => {
  assert.deepEqual(parsePostRef("https://bsky.app/profile/a.b/post/3abc"), { actor: "a.b", rkey: "3abc" });
  assert.equal(parsePostRef(ROOT), ROOT);
  assert.equal(parsePostRef("nope"), null);
});
