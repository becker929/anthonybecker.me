import { test } from "node:test";
import assert from "node:assert/strict";
import {
  batchOf, itemsOf, newestFirst, buildQueue, unitStart, startOf, trackAt, skipTo,
} from "../../skrng/playlist.js";

// Three batches: 8 has an intro and short announcements, 7.6 has
// announcements but no intro, 4 has neither and is not ordered.
const renders = [
  { id: "a1", batch: 8, file: "/a1.mp3", announce: "/t-a1.mp3", date: "2026-10-07" },
  { id: "a2", batch: 8, file: "/a2.mp3", announce: "/t-a2.mp3", date: "2026-10-07" },
  { id: "b1", batch: 7.6, file: "/b1.mp3", announce: "/t-b1.mp3", date: "2026-10-06" },
  { id: "b2", batch: 7.6, file: "/b2.mp3", announce: "/t-b2.mp3", date: "2026-10-06" },
  { id: "c-old", batch: 4, file: "/c1.mp3", date: "2026-10-01" },
  { id: "c-new", batch: 4, file: "/c2.mp3", date: "2026-10-02" },
  { id: "none", file: "/d.mp3", date: "2026-09-29" },
];
const batches = [
  { n: 8, ordered: true, announce: "/intro-8.mp3" },
  { n: 7.6, ordered: true },
];
const shape = (q) => q.map((e) => `${e.b}:${e.kind[0]}${e.i}`).join(" ");

test("batches run newest first, and a render without a batch is batch 1", () => {
  assert.equal(batchOf({}), 1);
  assert.deepEqual(newestFirst(renders), [8, 7.6, 4, 1]);
});

test("an unordered batch lists newest first; an ordered one as written", () => {
  assert.deepEqual(itemsOf(renders, batches, 4).map((r) => r.id), ["c-new", "c-old"]);
  assert.deepEqual(itemsOf(renders, batches, 7.6).map((r) => r.id), ["b1", "b2"]);
});

test("the queue plays the intro once, then each announcement and track, then older batches", () => {
  const q = buildQueue(renders, batches, 8);
  assert.equal(shape(q), "8:i-1 8:a0 8:t0 8:a1 8:t1 7.6:a0 7.6:t0 7.6:a1 7.6:t1 4:t0 4:t1 1:t0");
  assert.equal(q[0].src, "/intro-8.mp3");
});

test("starting at an older batch leaves newer ones out; an unknown batch starts at the newest", () => {
  assert.equal(shape(buildQueue(renders, batches, 4)), "4:t0 4:t1 1:t0");
  assert.equal(buildQueue(renders, batches, 99).length, 12);
});

test("a track starts at its announcement, and a batch's first track at the intro", () => {
  const q = buildQueue(renders, batches, 8);
  assert.equal(startOf(q, 8, 0), 0);           // intro, announcement, track
  assert.equal(startOf(q, 8, 1), 3);           // announcement
  assert.equal(startOf(q, 7.6, 0), 5);         // no intro in 7.6
  assert.equal(startOf(q, 4, 1), 10);          // no announcement
  assert.equal(startOf(q, 5, 0), -1);
  assert.equal(unitStart(q, 2), 0);
  assert.equal(trackAt(q, 0), 2);
  assert.equal(trackAt(q, 11), 11);
  assert.equal(trackAt(q, 12), -1);
});

test("skip forward goes to the next track's announcement, into the next older batch", () => {
  const q = buildQueue(renders, batches, 8);
  assert.equal(skipTo(q, 0, 1), 3);    // during the intro: the next track is 8's second
  assert.equal(skipTo(q, 4, 1), 5);    // 8's last track -> 7.6's first announcement
  assert.equal(skipTo(q, 11, 1), -1);  // the last track of the oldest batch
});

test("skip back goes to the previous track, or restarts the current one", () => {
  const q = buildQueue(renders, batches, 8);
  assert.equal(skipTo(q, 6, -1), 3);                     // 7.6's first track -> 8's second, from its announcement
  assert.equal(skipTo(q, 6, -1, { restart: true }), 5);  // well under way: start it again
  assert.equal(skipTo(q, 2, -1), 0);                     // the very first track: from the intro again
});
