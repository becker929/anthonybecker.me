// What the voice review says and what it listens for. Pure functions only:
// no DOM, no audio. skrng/review.js drives the browser APIs with these, and
// src/test/skrng-voice.test.js pins them in Node.
//
// The spoken script is written for the ear, not the page. A listener on a
// commute cannot glance back, so every announcement follows one fixed order:
// where you are (track number), the one thing that differs, then the length.
// Group intros say once what a run of tracks is comparing, so each track's
// announcement can be just its difference. Numbers stay as digits (speech
// engines read "4.1" as "four point one"); symbols that engines mangle or
// skip are turned into words.

// Rewrite page text into something a speech engine reads cleanly.
export function speakable(text) {
  let s = String(text || "");
  s = s.replace(/\bHW(\d+)\b/g, (_, d) => `H W ${d.split("").join(" ")}`);
  s = s.replace(/(\d)\s*[–-]\s*(\d)/g, "$1 to $2"); // 36-48 s, bars 77–84
  s = s.replace(/\s*[—–]\s*/g, ", ");
  s = s.replace(/\bx(\d+(?:\.\d+)?)\b/g, "$1 times"); // stretched x2
  s = s.replace(/(\d+(?:\.\d+)?)\s?ms\b/g, "$1 milliseconds");
  s = s.replace(/(\d+(?:\.\d+)?)\s?s\b/g, "$1 seconds");
  s = s.replace(/(\d+(?:\.\d+)?)\s?dB\b/g, "$1 decibels");
  s = s.replace(/\bdBTP\b/g, "decibels true peak");
  s = s.replace(/\bLUFS\b/g, "loudness units");
  s = s.replace(/\bBPM\b/g, "B P M");
  s = s.replace(/\s&\s/g, " and ");
  s = s.replace(/\bvs\.?\s/g, "versus ");
  s = s.replace(/[()]/g, ", ");
  s = s.replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
  s = s.replace(/^,\s*|,\s*$/g, "");
  if (s && !/[.!?]$/.test(s)) s += ".";
  return s;
}

const PROJECT_PREFIX = /^HW\d+\s*[—–-]\s*/;
const TRAILING_LENGTH = /,?\s*\d+(?:\.\d+)?\s?s$/;

// Split a render title into the run it belongs to and what this one changes.
// "HW002 — Track 2 fixed: wuh stretched x1.5, 48 s"
//   -> { label: "Track 2 fixed", change: "wuh stretched x1.5" }
export function parseTitle(title) {
  const t = String(title || "").replace(PROJECT_PREFIX, "").trim();
  const colon = t.indexOf(":");
  if (colon < 0) return { label: null, change: t.replace(TRAILING_LENGTH, "").trim() };
  return {
    label: t.slice(0, colon).trim(),
    change: t.slice(colon + 1).replace(TRAILING_LENGTH, "").trim(),
  };
}

function seconds(item) {
  if (Number.isFinite(item.duration_s)) return Math.round(item.duration_s);
  const m = String(item.title || "").match(/(\d+(?:\.\d+)?)\s?s$/);
  return m ? Math.round(Number(m[1])) : null;
}

// Groups are runs of consecutive tracks that compare one thing. A batch may
// name them in batches.json ("groups": [{ "from": 1, "to": 3, "label": ...,
// "say": ... }], 1-based and inclusive); otherwise consecutive titles that
// share the text before the colon form one. A run of one is not a group:
// its label folds back into the track's own description.
export function groupsFor(items, meta = {}) {
  if (Array.isArray(meta.groups) && meta.groups.length) {
    return meta.groups.map((g) => ({
      start: g.from - 1,
      end: g.to - 1,
      label: g.label || "",
      say: g.say || "",
    }));
  }
  const out = [];
  items.forEach((item, i) => {
    const { label } = parseTitle(item.title);
    const last = out[out.length - 1];
    if (label && last && last.label === label && last.end === i - 1) last.end = i;
    else out.push({ start: i, end: i, label, say: "" });
  });
  return out.filter((g) => g.label && g.end > g.start);
}

export function groupOf(groups, i) {
  const k = groups.findIndex((g) => i >= g.start && i <= g.end);
  return k < 0 ? null : { index: k, ...groups[k] };
}

// The words for one track: "Track 5. Wuh stretched 1.5 times. 48 seconds."
// An entry's own "say" field, when present, replaces the derived difference.
export function trackLine(item, i, groups) {
  const g = groupOf(groups, i);
  const { label, change } = parseTitle(item.title);
  let what = item.say || change;
  if (!item.say && !g && label) what = `${label}, ${change}`;
  const secs = seconds(item);
  const said = speakable(what);
  return [`Track ${i + 1}.`, said.charAt(0).toUpperCase() + said.slice(1), secs ? `${secs} seconds.` : ""]
    .filter(Boolean)
    .join(" ");
}

export function groupLine(groups, k) {
  const g = groups[k];
  const count = g.end - g.start + 1;
  const parts = [
    `Group ${k + 1} of ${groups.length}: ${speakable(g.label).replace(/\.$/, "")}.`,
    `${count} versions, tracks ${g.start + 1} to ${g.end + 1}.`,
  ];
  if (g.say) parts.push(speakable(g.say));
  return parts.join(" ");
}

export function batchIntro(n, items, groups, meta = {}, startAt = 0) {
  const parts = [`Batch ${n}.`];
  const shape = groups.length
    ? `${items.length} tracks, in ${groups.length} group${groups.length === 1 ? "" : "s"}.`
    : `${items.length} tracks.`;
  parts.push(shape);
  if (meta.say) parts.push(speakable(meta.say));
  if (startAt > 0) parts.push(`Starting at track ${startAt + 1}.`);
  parts.push(`After each one, I'll ask what you thought. Talk as long as you like, then say "next".`);
  return parts.join(" ");
}

// Everything spoken before a track plays: the group intro when a group
// starts (or when a review starts part-way into one), then the track line.
export function announcement(items, groups, i, { resumed = false } = {}) {
  const g = groupOf(groups, i);
  const lines = [];
  if (g && (i === g.start || resumed)) lines.push(groupLine(groups, g.index));
  lines.push(trackLine(items[i], i, groups));
  return lines.join(" ");
}

export const PROMPT_FIRST = 'What did you think? Say "next" when you\'re done.';
export const PROMPT = "What did you think?";
export const PROMPT_AGAIN = "Anything to add?";
export const REMINDER = 'Say "next" when you\'re ready.';
export const NO_MIC = 'I can\'t hear you. Tap "Done" when you\'re ready.';

export function closing(n, answered, total, stoppedAfter = null) {
  if (stoppedAfter != null) {
    return `Stopped after track ${stoppedAfter + 1}. ${answered} of ${total} answered, and saved.`;
  }
  return `That's the end of batch ${n}. ${answered} of ${total} answered. Thanks.`;
}

// --- Listening for the stop signal -------------------------------------
//
// Feedback is free speech, so a command must be unmistakable. "next" (and
// its few variants) may end a longer utterance — "too short, next" — since
// that is how people actually close a thought. Every other command must be
// the whole utterance on its own: "the hats should stop" is feedback, not
// "stop". Recognisers split utterances at pauses, which is what makes the
// whole-utterance rule workable.

const NEXT_TAIL = /(?:^|\s)(?:(?:ok|okay|alright|all right)\s+)?(?:next(?:\s+(?:one|track|please))?)$/;
const WHOLE = new Map([
  ["done", "next"], ["im done", "next"], ["i am done", "next"], ["skip", "next"], ["skip it", "next"],
  ["again", "again"], ["play it again", "again"], ["play again", "again"], ["one more time", "again"], ["repeat", "again"], ["repeat that", "again"],
  ["back", "back"], ["go back", "back"], ["previous", "back"], ["previous track", "back"],
  ["stop", "stop"], ["stop review", "stop"], ["end review", "stop"], ["thats all", "stop"], ["that is all", "stop"], ["quit", "stop"],
]);

export function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Returns { cmd, rest }: cmd is "next" | "again" | "back" | "stop" | null,
// and rest is the feedback left once the command words are taken off.
export function parseCommand(text) {
  const n = normalise(text);
  if (!n) return { cmd: null, rest: "" };
  if (WHOLE.has(n)) return { cmd: WHOLE.get(n), rest: "" };
  const m = n.match(NEXT_TAIL);
  if (m) {
    // Keep the speaker's own wording for the feedback, minus the command.
    const words = String(text).trim().split(/\s+/);
    const drop = m[0].trim().split(/\s+/).length;
    const rest = words.slice(0, Math.max(0, words.length - drop)).join(" ").replace(/[\s,;:.-]+$/, "");
    return { cmd: "next", rest };
  }
  return { cmd: null, rest: String(text).trim() };
}
