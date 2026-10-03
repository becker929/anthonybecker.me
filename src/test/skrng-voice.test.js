import { test } from "node:test";
import assert from "node:assert/strict";
import {
  speakable, parseTitle, groupsFor, trackLine, groupLine, batchIntro, announcement, closing, parseCommand,
} from "../../skrng/voice.js";

const b41 = [
  "HW002 — Track 1 earlier: 4-bar scoop, hats from bar 1, 42 s",
  "HW002 — Track 1 earlier: hats climb during the scoop, 42 s",
  "HW002 — Track 1 earlier: one-bar hat steps over the scoop, 36 s",
  "HW002 — Track 2 fixed: one phrase, wuh stretched x2, 48 s",
  "HW002 — Track 2 fixed: wuh stretched x1.5, 48 s",
  "HW002 — Track 2 fixed: wuh at natural length, not cut, 48 s",
  "HW002 — Track 2 fixed: wuh stretched x3, 48 s",
  "HW002 — Splash test: 6 beats, 42 s",
  "HW002 — Splash test: 8 beats, 42 s",
  "HW002 — Splash test: 3 beats, 42 s",
].map((title, i) => ({ id: `t${i}`, title, duration_s: title.endsWith("36 s") ? 36 : title.endsWith("48 s") ? 48 : 42 }));

test("speakable turns symbols into words a speech engine reads", () => {
  assert.equal(speakable("wuh stretched x1.5"), "wuh stretched 1.5 times.");
  assert.equal(speakable("36-48 s, bars 77–84"), "36 to 48 seconds, bars 77 to 84.");
  assert.equal(speakable("HW002 — 30 s arrangement experiment"), "H W 0 0 2, 30 seconds arrangement experiment.");
  assert.equal(speakable("kick vs rumble (dry)"), "kick versus rumble, dry.");
  assert.equal(speakable("a 9 dB duck & 72 ms return"), "a 9 decibels duck and 72 milliseconds return.");
  assert.equal(speakable("4-bar scoop"), "4-bar scoop.");
});

test("parseTitle splits label and change and drops the project and length", () => {
  assert.deepEqual(parseTitle(b41[4].title), { label: "Track 2 fixed", change: "wuh stretched x1.5" });
  assert.deepEqual(parseTitle("HW002 — Long scoop, four hat steps, 42 s"), { label: null, change: "Long scoop, four hat steps" });
});

test("groups are derived from shared title prefixes", () => {
  const g = groupsFor(b41);
  assert.deepEqual(g.map((x) => [x.start, x.end, x.label]), [
    [0, 2, "Track 1 earlier"], [3, 6, "Track 2 fixed"], [7, 9, "Splash test"],
  ]);
});

test("explicit groups in batch meta win, 1-based and inclusive", () => {
  const g = groupsFor(b41, { groups: [{ from: 1, to: 3, label: "Opening earlier", say: "Same climb, sooner." }] });
  assert.deepEqual(g, [{ start: 0, end: 2, label: "Opening earlier", say: "Same climb, sooner." }]);
});

test("a run of one is not a group; its label folds into the track line", () => {
  const items = [{ title: "HW002 — Solo: thing, 30 s", duration_s: 30 }, { title: "HW002 — Other, 30 s", duration_s: 30 }];
  assert.deepEqual(groupsFor(items), []);
  assert.equal(trackLine(items[0], 0, []), "Track 1. Solo, thing. 30 seconds.");
});

test("track line: position, the one difference, the length", () => {
  const g = groupsFor(b41);
  assert.equal(trackLine(b41[4], 4, g), "Track 5. Wuh stretched 1.5 times. 48 seconds.");
  assert.equal(trackLine({ ...b41[4], say: "Wuh one and a half times as long" }, 4, g), "Track 5. Wuh one and a half times as long. 48 seconds.");
});

test("group intro comes before the first track of a group, or on resume", () => {
  const g = groupsFor(b41);
  assert.equal(groupLine(g, 1), "Group 2 of 3: Track 2 fixed. 4 versions, tracks 4 to 7.");
  assert.match(announcement(b41, g, 3), /^Group 2 of 3: .* Track 4\. One phrase, wuh stretched 2 times\. 48 seconds\.$/);
  assert.equal(announcement(b41, g, 4), "Track 5. Wuh stretched 1.5 times. 48 seconds.");
  assert.match(announcement(b41, g, 4, { resumed: true }), /^Group 2 of 3/);
});

test("batch intro and closing", () => {
  const g = groupsFor(b41);
  assert.equal(
    batchIntro(4.1, b41, g),
    'Batch 4.1. 10 tracks, in 3 groups. After each one, I\'ll ask what you thought. Talk as long as you like, then say "next".',
  );
  assert.match(batchIntro(4.1, b41, g, {}, 3), /Starting at track 4\./);
  assert.equal(closing(4.1, 9, 10), "That's the end of batch 4.1. 9 of 10 answered. Thanks.");
  assert.equal(closing(4.1, 3, 10, 2), "Stopped after track 3. 3 of 10 answered, and saved.");
});

test("next may end a longer utterance and is taken off the feedback", () => {
  assert.deepEqual(parseCommand("Next"), { cmd: "next", rest: "" });
  assert.deepEqual(parseCommand("The splash is too short. Next."), { cmd: "next", rest: "The splash is too short" });
  assert.deepEqual(parseCommand("love the hats, okay next one"), { cmd: "next", rest: "love the hats" });
  assert.deepEqual(parseCommand("I'm done"), { cmd: "next", rest: "" });
});

test("other commands only count as a whole utterance", () => {
  assert.equal(parseCommand("again").cmd, "again");
  assert.equal(parseCommand("Play it again.").cmd, "again");
  assert.equal(parseCommand("go back").cmd, "back");
  assert.equal(parseCommand("Stop.").cmd, "stop");
  assert.equal(parseCommand("That's all").cmd, "stop");
  assert.deepEqual(parseCommand("the hats should stop"), { cmd: null, rest: "the hats should stop" });
  assert.equal(parseCommand("play that drop again later").cmd, null);
  assert.equal(parseCommand("").cmd, null);
});
