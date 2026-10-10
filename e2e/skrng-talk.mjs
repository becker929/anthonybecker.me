// End-to-end test of /skrng/talk/ in a real browser.
//   node e2e/server.mjs &   then   node e2e/skrng-talk.mjs
//
// Speech in and out are scripted stand-ins and the Mac end of /api/rpc is
// faked, as in e2e/skrng.mjs; the feedback API is the real Worker. Checks the
// six steps pass, the mic is never open while the page speaks or plays, the
// words and the log reach /api/skrng/feedback, and the talk loop answers.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:8790";
const TOKEN = process.env.SKRNG_TOKEN || "e2e-skrng-token";

function wavBytes(seconds = 0.6, sr = 22050) {
  const n = Math.round(seconds * sr), buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  return buf;
}

function standIns() {
  window.__spoken = []; window.__violations = []; window.__mic = { active: null };
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  const synth = {
    speak(u) {
      if (u.text.trim()) { window.__spoken.push(u.text); if (window.__mic.active) window.__violations.push(`mic open while speaking: ${u.text}`); }
      this.cur = u; this.t = setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 20);
    },
    cancel() { clearTimeout(this.t); },
    getVoices() { return []; }, addEventListener() {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (window.__mic.active && !String(this.src).startsWith("blob:")) window.__violations.push("mic open while music plays");
    return play.call(this);
  };
  class Recogniser {
    start() { window.__mic.active = this; this.results = []; setTimeout(() => this.onstart && this.onstart(), 100); }
    stop() { this.abort(); }
    abort() { if (window.__mic.active === this) { window.__mic.active = null; setTimeout(() => this.onend && this.onend(), 5); } }
    push(text) { this.results.push({ 0: { transcript: text }, isFinal: true, length: 1 }); this.onresult({ resultIndex: this.results.length - 1, results: this.results }); }
  }
  window.SpeechRecognition = window.webkitSpeechRecognition = Recogniser;
  window.__say = (text) => { if (!window.__mic.active) return false; window.__mic.active.push(text); return true; };
}

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const asks = [];
await ctx.route("**/audio/skrng/**", (r) => r.fulfill({ status: 200, contentType: "audio/wav", body: wavBytes() }));
await ctx.route("**/api/rpc", async (r) => {
  const call = JSON.parse(r.request().postData() || "{}");
  if (call.method === "ping") return r.fulfill({ json: { ok: true, signed_in: true } });
  asks.push(call.params.prompt);
  return r.fulfill({ json: { answer: `Answer ${asks.length}.`, session_id: "s" } });
});
const page = await ctx.newPage();
await page.addInitScript(standIns);
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.goto(`${BASE}/skrng/talk/#key=${TOKEN}`);
assert.equal(new URL(page.url()).hash, "", "key is taken out of the address");

const sayWhenListening = async (text) => {
  await page.waitForFunction(() => !!window.__mic.active, null, { timeout: 30000 });
  await page.evaluate((t) => window.__say(t), text);
  await page.waitForFunction(() => !window.__mic.active, null, { timeout: 30000 });   // the answer is taken
};

// The test run.
await page.click("#run");
await sayWhenListening("the break sounds darker and wider");
await page.waitForFunction(() => window.__spoken.some((s) => /of 6 steps passed/.test(s)), null, { timeout: 60000 });
const results = await page.$$eval(".tt-res", (els) => els.map((e) => [e.id, e.className, e.textContent]));
for (const [id, cls, text] of results) assert.match(cls, /ok/, `${id}: ${text}`);
assert.ok((await page.evaluate(() => window.__spoken)).includes("Answer 1."), "the answer is spoken");
assert.match(asks[0], /the break sounds darker and wider/);

// The talk loop: two turns, then "that's all".
await page.click("#talk");
await sayWhenListening("first thing");
await sayWhenListening("second thing");
await sayWhenListening("that's all");
await page.waitForFunction(() => window.__spoken.includes("Okay, talk ended."), null, { timeout: 30000 });
assert.equal(asks.length, 3);
assert.match(asks[2], /Anthony: first thing/, "history travels with the next ask");
assert.deepEqual(await page.evaluate(() => window.__violations), []);

await page.waitForTimeout(500);
const stored = await (await fetch(`${BASE}/api/skrng/feedback?batch=0`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
const words = stored.filter((r) => r.track === "talk-test").map((r) => r.transcript);
assert.deepEqual(words.sort(), ["first thing", "second thing", "the break sounds darker and wider"]);
assert.equal(stored.filter((r) => r.track === "talk-test-log").length, 2, "a log per run");
console.log("skrng talk e2e: ok");
await browser.close();
