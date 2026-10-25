// Post graph for web.anthonybecker.me. Pure ES module: runs in the browser
// and in Node, with `fetch` injectable so tests need no network.
//
// Edges come from two places and are merged into one list:
//  - native: what a post already says about itself (reply parent/root, quote)
//    and what other posts say about it (replies and quotes, found through
//    Constellation's backlink index);
//  - custom: records in the me.anthonybecker.web.edge collection, written by
//    anyone to link any two posts. Constellation indexes every collection on
//    the network, so no firehose consumer of our own is needed.
export const EDGE_COLLECTION = "me.anthonybecker.web.edge";
const APPVIEW = "https://public.api.bsky.app/xrpc";
const CONSTELLATION = "https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks";
const SLINGSHOT = "https://slingshot.microcosm.blue/xrpc";

// Incoming-link sources: [collection:path, edge kind, which end is the subject].
const INCOMING = [
  ["app.bsky.feed.post:reply.parent.uri", "reply"],
  ["app.bsky.feed.post:embed.record.uri", "quote"],
  ["app.bsky.feed.post:embed.record.record.uri", "quote"],
];

export function parsePostRef(input) {
  const s = String(input || "").trim();
  if (s.startsWith("at://")) return s;
  const m = s.match(/^https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([a-z0-9]+)/i);
  return m ? { actor: m[1], rkey: m[2] } : null;
}

export function makeGraph(fetchImpl = fetch) {
  async function json(url) {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
    return res.json();
  }
  const q = (base, params) => `${base}?${new URLSearchParams(params)}`;

  async function toUri(input) {
    const p = parsePostRef(input);
    if (!p) throw new Error("not a post link");
    if (typeof p === "string") return p;
    let did = p.actor;
    if (!did.startsWith("did:")) {
      did = (await json(q(`${APPVIEW}/com.atproto.identity.resolveHandle`, { handle: p.actor }))).did;
    }
    return `at://${did}/app.bsky.feed.post/${p.rkey}`;
  }

  // Posts by AT-URI, 25 per call, as { uri: { uri, cid, author, text, createdAt } }.
  async function hydrate(uris) {
    const out = {};
    const todo = [...new Set(uris)];
    for (let i = 0; i < todo.length; i += 25) {
      const r = await json(`${APPVIEW}/app.bsky.feed.getPosts?${todo.slice(i, i + 25).map((u) => `uris=${encodeURIComponent(u)}`).join("&")}`);
      for (const p of r.posts || []) {
        out[p.uri] = { uri: p.uri, cid: p.cid, author: p.author.handle, text: p.record.text, createdAt: p.record.createdAt, record: p.record };
      }
    }
    return out;
  }

  async function backlinks(subject, source, limit = 25) {
    const r = await json(q(CONSTELLATION, { subject, source, limit }));
    return r.records.map((x) => ({ did: x.did, collection: x.collection, rkey: x.rkey }));
  }

  const uriOf = (r) => `at://${r.did}/${r.collection}/${r.rkey}`;

  // Everything one hop out from `input`. Returns { root, nodes, edges }.
  async function explore(input) {
    const root = await toUri(input);
    const edges = [];
    const add = (from, to, kind, extra = {}) => edges.push({ from, to, kind, ...extra });

    const rootPost = (await hydrate([root]))[root];
    if (!rootPost) throw new Error("post not found");
    const rec = rootPost.record;

    // What the root says about itself.
    if (rec.reply) {
      add(root, rec.reply.parent.uri, "reply");
      if (rec.reply.root.uri !== rec.reply.parent.uri) add(root, rec.reply.root.uri, "thread-root");
    }
    const quoted = rec.embed && (rec.embed.record && rec.embed.record.uri ? rec.embed.record : rec.embed.record && rec.embed.record.record);
    if (quoted && quoted.uri && quoted.uri.includes("/app.bsky.feed.post/")) add(root, quoted.uri, "quote");

    // What other posts say about the root.
    const incoming = await Promise.all(INCOMING.map(([src, kind]) => backlinks(root, src).then((rs) => rs.map((r) => [uriOf(r), kind]))));
    for (const [uri, kind] of incoming.flat()) add(uri, root, kind);

    // Custom edges, either end.
    const custom = [];
    for (const end of ["from", "to"]) {
      for (const r of await backlinks(root, `${EDGE_COLLECTION}:${end}.uri`)) custom.push(r);
    }
    const seen = new Set();
    for (const r of custom) {
      if (seen.has(uriOf(r))) continue;
      seen.add(uriOf(r));
      try {
        const v = (await json(q(`${SLINGSHOT}/com.atproto.repo.getRecord`, { repo: r.did, collection: r.collection, rkey: r.rkey }))).value;
        add(v.from.uri, v.to.uri, v.kind, { by: r.did, note: v.note, record: uriOf(r) });
      } catch { /* a deleted or unreachable edge is just absent */ }
    }

    const posts = await hydrate([root, ...edges.flatMap((e) => [e.from, e.to])]);
    const nodes = Object.values(posts).map(({ record, ...n }) => n);
    return { root, nodes, edges };
  }

  return { explore, hydrate, toUri };
}
