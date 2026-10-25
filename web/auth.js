// Bluesky sign-in and edge writing, in the browser. The scope asks for
// write access to the edge collection only, so a token from here can't
// post, delete posts, or touch anything else in the account.
import { BrowserOAuthClient } from "https://esm.sh/@atproto/oauth-client-browser@0.5.9";
import { EDGE_COLLECTION, makeGraph } from "./graph.js";

const client = await BrowserOAuthClient.load({
  clientId: "https://web.anthonybecker.me/web/client-metadata.json",
  handleResolver: "https://public.api.bsky.app",
});

// Resolves to the signed-in session, or undefined. Also completes the
// redirect back from the authorization server.
export async function restore() {
  const r = await client.init();
  return r && r.session;
}

export function signIn(handle) {
  return client.signIn(handle, { scope: "atproto repo:me.anthonybecker.web.edge" });
}

// from/to are post links (bsky.app URL or AT-URI); the record stores each with its current CID.
export async function createEdge(session, { from, to, kind, note }) {
  const g = makeGraph();
  [from, to] = await Promise.all([g.toUri(from), g.toUri(to)]);
  const posts = await g.hydrate([from, to]);
  if (!posts[from] || !posts[to]) throw new Error("both posts must exist");
  const record = {
    $type: EDGE_COLLECTION,
    from: { uri: from, cid: posts[from].cid },
    to: { uri: to, cid: posts[to].cid },
    kind,
    createdAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  };
  const res = await session.fetchHandler("/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ repo: session.did, collection: EDGE_COLLECTION, record }),
  });
  if (!res.ok) throw new Error(`createRecord ${res.status}: ${await res.text()}`);
  return res.json();
}
