// What Play batch plays, in order. Pure functions only: no DOM, no audio.
// skrng/index.html drives one <audio> element with these, and
// src/test/skrng-playlist.test.js pins them in Node.
//
// A run starts at a batch and keeps going through every older batch, so a
// drive does not stop at the end of a batch. Each batch is its intro (the
// experiment, said once, when batches.json gives it an "announce" file), then
// for each track its announcement (when the entry has one) and the track.
// Everything goes through one player: on a locked phone or a car stereo, the
// element that is already playing is the one allowed to keep going.

export const batchOf = (r) => (Number.isFinite(r.batch) ? r.batch : 1); // batches may be decimal, e.g. 4.1

export function metaOf(batches, n) {
  return batches.find((b) => b.n === n) || {};
}

// A batch's tracks in page order: as listed when the batch is "ordered",
// otherwise newest first.
export function itemsOf(renders, batches, n) {
  const items = renders.filter((r) => batchOf(r) === n);
  if (!metaOf(batches, n).ordered) items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return items;
}

export function newestFirst(renders) {
  return [...new Set(renders.map(batchOf))].sort((a, b) => b - a);
}

// Every entry the player plays from batch `from` on, older batches after it.
// Entry: { b: batch, i: track index in the batch (-1 for the intro),
//          kind: "intro" | "announce" | "track", src }.
export function buildQueue(renders, batches, from) {
  const order = newestFirst(renders);
  const at = order.indexOf(from);
  const q = [];
  for (const n of order.slice(at < 0 ? 0 : at)) {
    const meta = metaOf(batches, n);
    if (meta.announce) q.push({ b: n, i: -1, kind: "intro", src: meta.announce });
    itemsOf(renders, batches, n).forEach((r, i) => {
      if (r.announce) q.push({ b: n, i, kind: "announce", src: r.announce });
      q.push({ b: n, i, kind: "track", src: r.file });
    });
  }
  return q;
}

// The first entry of the track at index j: its announcement, and its
// batch's intro too when it is the batch's first track.
export function unitStart(q, j) {
  let s = j;
  while (s > 0 && q[s - 1].b === q[j].b && q[s - 1].kind !== "track") s -= 1;
  return s;
}

// Where to start for track i of batch b, or -1.
export function startOf(q, b, i) {
  const j = q.findIndex((e) => e.b === b && e.i === i && e.kind === "track");
  return j < 0 ? -1 : unitStart(q, j);
}

// The track that entry `pos` is, or leads into; -1 past the end.
export function trackAt(q, pos) {
  for (let k = Math.max(0, pos); k < q.length; k += 1) if (q[k].kind === "track") return k;
  return -1;
}

// Skip from `pos`: dir 1 is the next track, -1 the previous one (from the
// first track, the start of that track again). `restart` (a track well under
// way, skipping back) starts the current track again instead. Lands on the
// track's first entry, so its announcement plays. Returns -1 past the end.
export function skipTo(q, pos, dir, { restart = false } = {}) {
  const j = trackAt(q, pos);
  if (j < 0) return -1;
  if (dir < 0 && restart) return unitStart(q, j);
  let k = j + dir;
  while (k >= 0 && k < q.length && q[k].kind !== "track") k += dir;
  if (k >= q.length) return -1;
  if (k < 0) return unitStart(q, j);
  return unitStart(q, k);
}
