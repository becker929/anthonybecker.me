// End-to-end test of the /skrng voice review in a real browser.
//   node e2e/server.mjs &   then   node e2e/skrng.mjs
//
// Speech in and out are replaced by scripted stand-ins (a browser has no
// microphone here, and speech engines differ by device), so this checks the
// review's own logic against the real page and the real Worker: what is
// said and in what order, which utterances count as commands, that the mic
// is never open while the page speaks or a track plays, and that each
// answer reaches /api/skrng/feedback. How a particular phone's recogniser
// behaves still needs a listen on that phone.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:8790";
const TOKEN = process.env.SKRNG_TOKEN || "e2e-skrng-token";
const results = [];
async function step(name, fn) {
  const t = Date.now();
  try { await fn(); results.push([name, "ok", Date.now() - t]); }
  catch (e) { results.push([name, "FAIL " + (e.message || e), Date.now() - t]); if (process.env.STOP_ON_FAIL) throw e; }
}

function wavBytes(seconds = 0.6, freq = 220, sr = 22050) {
  const n = Math.round(seconds * sr), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / sr) * 8000), 44 + i * 2);
  return buf;
}

// Installed before the page's own scripts. `mic` toggles whether a
// recogniser exists at all (false = a browser without speech input).
function speechStandIns(mic) {
  window.__spoken = [];
  window.__violations = [];
  window.__mic = { active: null, starts: 0 };
  class Utterance { constructor(text) { this.text = text; this.volume = 1; } }
  window.SpeechSynthesisUtterance = Utterance;
  const synth = {
    speaking: false, pending: false,
    speak(u) {
      if (u.text.trim()) {
        window.__spoken.push(u.text);
        if (window.__mic.active) window.__violations.push(`mic open while speaking: ${u.text}`);
      }
      this.speaking = true; this.cur = u;
      this.t = setTimeout(() => { this.speaking = false; u.onend && u.onend(); }, 20);
    },
    cancel() {
      clearTimeout(this.t);
      if (this.speaking) { this.speaking = false; const u = this.cur; u.onend && u.onend(); }
    },
    getVoices() { return []; },
    addEventListener() {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (window.__mic.active && !this.muted) window.__violations.push("mic open while a track plays");
    return play.call(this);
  };
  if (!mic) {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    return;
  }
  class Recogniser {
    start() {
      if (window.__mic.active) throw new Error("already started");
      window.__mic.active = this; window.__mic.starts += 1; this.results = []; this.interim = null;
      setTimeout(() => this.onstart && this.onstart(), 5);
    }
    stop() { this.end(true); }
    abort() { this.end(false); }
    end(flush) {
      if (window.__mic.active !== this) return;
      if (flush && this.interim) this.push(this.interim, true);
      this.interim = null;
      window.__mic.active = null;
      setTimeout(() => this.onend && this.onend(), 5);
    }
    push(text, final) {
      const r = { 0: { transcript: text }, isFinal: final, length: 1 };
      if (final) {
        this.results.push(r); this.interim = null;
        this.onresult && this.onresult({ resultIndex: this.results.length - 1, results: this.results });
      } else {
        this.interim = text;
        this.onresult && this.onresult({ resultIndex: this.results.length, results: [...this.results, r] });
      }
    }
  }
  window.SpeechRecognition = Recogniser;
  window.webkitSpeechRecognition = Recogniser;
  window.__say = (text, final = true) => {
    const m = window.__mic.active;
    if (!m) return false;
    m.push(text, final);
    return true;
  };
}

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
async function newPage(mic) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("**/audio/skrng/**", (route) => route.fulfill({ status: 200, contentType: "audio/wav", body: wavBytes() }));
  await ctx.addInitScript(speechStandIns, mic);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") page.errors.push("console: " + m.text()); });
  return page;
}

const listening = (page, n) => page.waitForFunction(
  (k) => document.getElementById("rv-state").textContent.startsWith(`Track ${k}: listening`) && window.__mic.active,
  n, { timeout: 15000 },
);
const say = async (page, text, final = true) => {
  assert.ok(await page.evaluate(([t, f]) => window.__say(t, f), [text, final]), `mic was not open for "${text}"`);
};
const spoken = (page) => page.evaluate(() => window.__spoken);
const feedback = async () => (await fetch(`${BASE}/api/skrng/feedback?batch=4.1`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();

const page = await newPage(true);

await step("key: read from the link, kept on the phone, taken off the URL", async () => {
  await page.goto(`${BASE}/skrng/?batch=4.1#key=${TOKEN}`, { waitUntil: "networkidle" });
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(await page.evaluate(() => localStorage.getItem("skrng.key")), TOKEN);
  await page.waitForSelector("#review:not([hidden])");
  assert.match(await page.textContent("#review"), /Review by voice/);
  assert.match(await page.textContent("#rv-key"), /save to the site/);
});

await step("start: intro, group, track, play, question, then the mic opens", async () => {
  await page.click("#review");
  await listening(page, 1);
  const s = await spoken(page);
  assert.match(s[0], /^Batch 4\.1\. 10 tracks, in 3 groups\./);
  assert.match(s[1], /^Group 1 of 3: Batch 4's track 1, brought earlier\. 3 versions, tracks 1 to 3\..*Track 1\. 4-bar scoop/);
  assert.equal(s[2], 'What did you think? Say "next" when you\'re done.');
});

await step("voice: an answer, then \"next\" moves on and saves it", async () => {
  await say(page, "The opening works, the scoop could be shorter.");
  await say(page, "next");
  await listening(page, 2);
  const s = await spoken(page);
  assert.equal(s[s.length - 2], "Track 2. Hats climb during the scoop. 42 seconds.");
  assert.equal(s[s.length - 1], "What did you think?");
});

await step("tap: Done keeps the words still being recognised", async () => {
  await say(page, "hats should come in sooner", false);
  await page.click("#rv-done");
  await listening(page, 3);
});

await step("feedback that ends in \"stop\" is not the stop command", async () => {
  await say(page, "the hats should stop");
  await page.waitForTimeout(300);
  assert.match(await page.textContent("#rv-state"), /^Track 3: listening/);
  assert.match(await page.textContent("#rv-heard"), /the hats should stop/);
});

await step("\"again\" replays the track, then asks for more", async () => {
  await say(page, "again");
  await page.waitForFunction(() => window.__spoken[window.__spoken.length - 1] === "Anything to add?", null, { timeout: 15000 });
  await listening(page, 3);
  await say(page, "better the second time, next");
  await listening(page, 4);
});

await step("\"stop\" ends the review and says where it stopped", async () => {
  await say(page, "stop");
  await page.waitForSelector("#review:not([hidden])", { timeout: 15000 });
  const s = await spoken(page);
  assert.equal(s[s.length - 1], "Stopped after track 4. 3 of 10 answered, and saved.");
  assert.match(await page.textContent("#review"), /Resume voice review at track 5/);
});

await step("server: one record per track, with the words as said", async () => {
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("skrng.fb") || "[]").every((r) => r.synced), null, { timeout: 5000 });
  const recs = await feedback();
  assert.deepEqual(recs.map((r) => [r.index, r.transcript, r.ended_by, r.replays]), [
    [0, "The opening works, the scoop could be shorter.", "voice", 0],
    [1, "hats should come in sooner", "tap", 0],
    [2, "the hats should stop better the second time", "voice", 1],
    [3, "", "voice", 0],
  ]);
  assert.ok(recs.every((r) => r.stt === "speech" && r.session === recs[0].session));
  assert.equal(await page.locator(".renders .fb p").count(), 3);
});

await step("the mic was never open while the page spoke or a track played", async () => {
  assert.deepEqual(await page.evaluate(() => window.__violations), []);
});

await step("resume: starts at the first unanswered track with its group intro; \"go back\" works", async () => {
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#review:not([hidden])");
  assert.match(await page.textContent("#review"), /Resume voice review at track 5/);
  await page.click("#review");
  await listening(page, 5);
  const s = await spoken(page);
  assert.match(s[0], /Starting at track 5\./);
  assert.match(s[1], /^Group 2 of 3: .*Track 5\. Wuh stretched 1\.5 times\. 48 seconds\.$/);
  await say(page, "go back");
  await listening(page, 4);
  await say(page, "stop");
  await page.waitForSelector("#review:not([hidden])", { timeout: 15000 });
  assert.equal((await feedback()).length, 5, "go back with nothing said is not stored; the stop on track 4 is");
});

await step("Stop button mid-answer ends quietly", async () => {
  await page.click("#rv-from-start");
  await listening(page, 1);
  await page.click("#rv-stop");
  await page.waitForSelector("#review:not([hidden])", { timeout: 15000 });
  assert.match(await page.textContent("#now"), /^Stopped after track 1\./);
});

await step("Play batch still works after a review", async () => {
  assert.equal(await page.isDisabled("#play-batch"), false);
});

await step("no speech input: the question says to tap, Done moves on", async () => {
  const p2 = await newPage(false);
  await p2.goto(`${BASE}/skrng/?batch=4.1`, { waitUntil: "networkidle" });
  await p2.evaluate((t) => localStorage.setItem("skrng.key", t), TOKEN);
  await p2.reload({ waitUntil: "networkidle" });
  await p2.click("#rv-from-start").catch(() => p2.click("#review"));
  await p2.waitForFunction(() => /tap Done/.test(document.getElementById("rv-state").textContent), null, { timeout: 15000 });
  assert.ok((await spoken(p2)).includes('I can\'t hear you. Tap "Done" when you\'re ready.'));
  await p2.fill("#rv-typed", "typed note on track 1");
  await p2.click("#rv-done");
  await p2.waitForFunction(() => document.getElementById("rv-state").textContent.startsWith("Track 2"), null, { timeout: 15000 });
  await p2.click("#rv-stop");
  const recs = await feedback();
  const typedRec = recs.find((r) => r.typed === "typed note on track 1");
  assert.ok(typedRec && typedRec.stt === "none" && typedRec.ended_by === "tap");
  assert.deepEqual(p2.errors, []);
});

await step("no page errors", async () => { assert.deepEqual(page.errors, []); });

await browser.close();
for (const [name, status, ms] of results) console.log(`${status === "ok" ? "✓" : "✗"} ${name}${status === "ok" ? "" : ` — ${status}`} (${ms} ms)`);
if (results.some(([, s]) => s !== "ok")) process.exit(1);
