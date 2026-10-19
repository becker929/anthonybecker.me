// Turns a Bluesky repository (a CAR file from com.atproto.sync.getRepo) into
// the weekly counts a core is drawn from. Runs in the browser at drill time
// and in the Node tests; it touches no DOM and no network.
//
// Only counts leave this file. Post text is read for its length and dropped.

export const WEEK_MS = 7 * 24 * 3600 * 1000;
// 1970-01-05 was a Monday, so weeks run Monday 00:00 UTC to Monday.
const MONDAY0 = 4 * 24 * 3600 * 1000;
// Bluesky's first public posts are from November 2022. Anything dated
// earlier came in through an archive import; it is counted, not layered.
export const EARLIEST_MS = Date.UTC(2022, 10, 1);
export const MAX_WEEKS = 1000;

// Column order of one week in sample.weeks.
export const COLS = ["post", "reply", "quote", "repost", "like", "image", "video", "link", "follow", "chars"];
const C = Object.fromEntries(COLS.map((k, i) => [k, i]));

export function weekOf(ms) {
  return Math.floor((ms - MONDAY0) / WEEK_MS);
}

export function weekStart(week) {
  return MONDAY0 + week * WEEK_MS;
}

// --- CAR v1 and DAG-CBOR, only as much as a repo export needs ---

function* blocks(buf) {
  let p = 0;
  const varint = () => {
    let x = 0, s = 0, b;
    do {
      if (p >= buf.length) throw new Error("CAR ends inside a varint");
      b = buf[p++];
      x += (b & 0x7f) * 2 ** s;
      s += 7;
    } while (b & 0x80);
    return x;
  };
  const headerLen = varint(); // header (roots, version) is not needed
  p += headerLen;
  while (p < buf.length) {
    const len = varint();
    const end = p + len;
    if (end > buf.length) throw new Error("CAR block runs past the end");
    varint(); // CID version
    const codec = varint();
    varint(); // multihash code
    const digestLen = varint(); // multihash digest
    p += digestLen;
    yield { codec, bytes: buf.subarray(p, end) };
    p = end;
  }
}

const utf8 = new TextDecoder();

export function decodeCbor(b) {
  let p = 0;
  const arg = (ai) => {
    if (ai < 24) return ai;
    if (ai === 24) return b[p++];
    if (ai === 25) { const v = (b[p] << 8) | b[p + 1]; p += 2; return v; }
    if (ai === 26) { const v = b[p] * 2 ** 24 + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3]; p += 4; return v; }
    if (ai === 27) { let v = 0; for (let i = 0; i < 8; i++) v = v * 256 + b[p++]; return v; }
    throw new Error("bad CBOR length");
  };
  const item = () => {
    const ib = b[p++];
    const mt = ib >> 5, ai = ib & 31;
    switch (mt) {
      case 0: return arg(ai);
      case 1: return -1 - arg(ai);
      case 2: { const n = arg(ai); p += n; return null; } // bytes: never needed
      case 3: { const n = arg(ai); const s = utf8.decode(b.subarray(p, p + n)); p += n; return s; }
      case 4: { const n = arg(ai); const a = new Array(n); for (let i = 0; i < n; i++) a[i] = item(); return a; }
      case 5: { const n = arg(ai); const o = {}; for (let i = 0; i < n; i++) { const k = item(); o[k] = item(); } return o; }
      case 6: arg(ai); item(); return null; // tag 42, a CID link
      case 7:
        if (ai === 20) return false;
        if (ai === 21) return true;
        if (ai === 22) return null;
        if (ai === 27) { const v = new DataView(b.buffer, b.byteOffset + p, 8).getFloat64(0); p += 8; return v; }
        throw new Error("bad CBOR simple value");
      default: throw new Error("bad CBOR");
    }
  };
  return item();
}

function countLinks(facets) {
  let n = 0;
  if (!Array.isArray(facets)) return 0;
  for (const f of facets) {
    for (const feat of (f && f.features) || []) {
      if (feat && feat.$type === "app.bsky.richtext.facet#link") n++;
    }
  }
  return n;
}

// Reads every record in the repository and buckets it by week.
// nowMs is the drill time; records dated after it are ignored.
export function sampleRepo(buf, nowMs, onProgress) {
  const byWeek = new Map();
  const hours = new Array(24).fill(0);
  let early = 0, records = 0, future = 0;
  const nowWeek = weekOf(nowMs);
  const row = (w) => {
    let r = byWeek.get(w);
    if (!r) { r = new Array(COLS.length).fill(0); byWeek.set(w, r); }
    return r;
  };
  let seen = 0;
  for (const blk of blocks(buf)) {
    seen++;
    if (onProgress && seen % 20000 === 0) onProgress(seen);
    if (blk.codec !== 0x71) continue; // dag-cbor only
    // A record starts with a map holding "$type"; skip MST nodes cheaply.
    let rec;
    try { rec = decodeCbor(blk.bytes); } catch { continue; }
    const type = rec && rec.$type;
    if (typeof type !== "string" || !type.startsWith("app.bsky.")) continue;
    let col;
    if (type === "app.bsky.feed.post") col = "post";
    else if (type === "app.bsky.feed.repost") col = "repost";
    else if (type === "app.bsky.feed.like") col = "like";
    else if (type === "app.bsky.graph.follow") col = "follow";
    else continue;
    const t = Date.parse(rec.createdAt);
    if (!Number.isFinite(t)) continue;
    records++;
    if (t < EARLIEST_MS) { early++; continue; }
    if (t > nowMs) { future++; continue; }
    const r = row(weekOf(t));
    if (col !== "post") { r[C[col]]++; continue; }
    const embed = rec.embed || {};
    const et = embed.$type || "";
    const isQuote = et === "app.bsky.embed.record" || et === "app.bsky.embed.recordWithMedia";
    if (rec.reply) r[C.reply]++;
    else if (isQuote) r[C.quote]++;
    else r[C.post]++;
    const media = et === "app.bsky.embed.recordWithMedia" ? embed.media || {} : embed;
    const mt = media.$type || "";
    if (mt === "app.bsky.embed.images") r[C.image] += Math.min(4, (media.images || []).length);
    else if (mt === "app.bsky.embed.video") r[C.video]++;
    else if (mt === "app.bsky.embed.external") r[C.link]++;
    r[C.link] += countLinks(rec.facets);
    if (typeof rec.text === "string") r[C.chars] += [...rec.text].length;
    hours[new Date(t).getUTCHours()]++;
  }
  if (!byWeek.size) return { firstWeek: nowWeek, weeks: [new Array(COLS.length).fill(0)], hours, early, records, future };
  let first = Math.min(...byWeek.keys());
  // A core longer than MAX_WEEKS keeps the most recent weeks.
  first = Math.max(first, nowWeek - MAX_WEEKS + 1);
  const weeks = [];
  for (let w = first; w <= nowWeek; w++) weeks.push(byWeek.get(w) || new Array(COLS.length).fill(0));
  return { firstWeek: first, weeks, hours, early, records, future };
}
