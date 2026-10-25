// Live check of the read side against the real network:
//   node web/probe.mjs [post-url]
import { makeGraph } from "./graph.js";
const url = process.argv[2] || "at://did:plc:xrr5j2okn7ew2zvcwsxus3gb/app.bsky.feed.post/3mymxa653fs27";
const g = await makeGraph().explore(url);
console.log(`root ${g.root}\n${g.nodes.length} nodes, ${g.edges.length} edges`);
const kinds = {};
for (const e of g.edges) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
console.log(kinds);
console.log(g.edges.slice(0, 3));
