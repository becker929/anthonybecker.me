// Talk test for /skrng: proves the spoken loop one step at a time.
//
//   1 key   2 speech out   3 music   4 speech in   5 saved and read back   6 the Mac answers aloud
//
// "Talk with Claude" then loops 4-6 as a conversation: listen until a pause,
// send the words to the Mac's harness (`ask`, src/rig.js), speak the answer.
// The ask is stateless, so the last few turns travel in each prompt.
//
// Records go to /api/skrng/feedback as batch 0 (not a real batch): each
// utterance as track "talk-test", and at the end the page's own log as
// track "talk-test-log", so the agent can see which step broke on which
// phone. The audio-session handling copies review.js: playback for every
// sound, play-and-record only while listening, a pause after each switch
// for a Bluetooth headset to change profile.
import { parseCommand, speakable } from "../voice.js";

const KEY_STORE = "skrng.key";
const BATCH = 0;
const CLIP = "/audio/skrng/2026-10-09-hw002-b8-7-break-colour-t1.mp3";
const CLIP_S = 8;
const PAUSE_ENDS_MS = 2200;      // after you stop talking, the answer is taken
const NOTHING_HEARD_MS = 25000;  // listening with nothing heard gives up
const ROUTE_SETTLE_MS = 1200;
const ASK_TIMEOUT_MS = 120000;
// 0.1 s of 8-bit silence, played inside the first tap to unlock the media element.
const SILENCE = (() => {
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer), w = (o, s) => [...s].forEach((c, i) => { b[o + i] = c.charCodeAt(0); });
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
  b.fill(128, 44);
  return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
})();

const $ = (id) => document.getElementById(id);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis || null;
const SESSION = navigator.audioSession || null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const session = uid().slice(0, 18);
const audio = new Audio();
audio.preload = "auto";

// --- log ---------------------------------------------------------------------
const t0 = performance.now();
const lines = [];
function log(msg) {
  const line = `${((performance.now() - t0) / 1000).toFixed(1).padStart(6)}  ${msg}`;
  lines.push(line);
  $("log").textContent = lines.join("\n");
}
function result(step, ok, text) {
  const el = $(`r-${step}`);
  el.className = `tt-res ${ok === true ? "ok" : ok === false ? "bad" : ""}`;
  el.textContent = text;
  log(`[${step}] ${ok === true ? "pass" : ok === false ? "FAIL" : "…"} ${text}`);
}

// --- key ---------------------------------------------------------------------
function readKey() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const fresh = hash.get("key");
  if (fresh) {
    try { localStorage.setItem(KEY_STORE, fresh); } catch {}
    history.replaceState(null, "", location.pathname);
    return fresh;
  }
  try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; }
}
const key = readKey();
const auth = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${key}` });

// --- sound -------------------------------------------------------------------
let mode = null;
async function setMode(m) {
  if (mode === m) return;
  mode = m;
  if (SESSION) { try { SESSION.type = m; } catch (e) { log(`audioSession ${m} refused: ${e.message}`); } }
  log(`audio session -> ${m}${SESSION ? "" : " (no audioSession API; waiting only)"}`);
  await sleep(ROUTE_SETTLE_MS);
}

let voice = null;
function pickVoice() {
  if (!synth) return;
  const score = (v) => (/^en[-_]US/i.test(v.lang) ? 2 : /^en/i.test(v.lang) ? 1 : -9)
    + (/premium|enhanced|natural|neural/i.test(v.name) ? 3 : 0)
    + (/samantha|ava|allison|daniel|karen|serena|google us english|aria|jenny/i.test(v.name) ? 2 : 0);
  const best = synth.getVoices().sort((a, b) => score(b) - score(a))[0];
  if (best && score(best) > 0) voice = best;
}
if (synth) { pickVoice(); synth.addEventListener?.("voiceschanged", pickVoice); }

let stopped = false;
let abort = () => {};
let done = () => {};   // Done: ends the current answer (listen only)

async function speak(text) {
  if (!synth || stopped) return { ok: false, why: synth ? "stopped" : "no speechSynthesis" };
  await setMode("playback");
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(speakable(text));
    if (voice) u.voice = voice;
    u.lang = voice?.lang || "en-US";
    let started = false;
    const t = performance.now();
    const finish = (why) => {
      clearTimeout(guard);
      abort = () => {};
      resolve({ ok: started || why === "ended", why, ms: Math.round(performance.now() - t) });
    };
    const guard = setTimeout(() => finish("timed out"), 4000 + text.split(/\s+/).length * 600);
    u.onstart = () => { started = true; };
    u.onend = () => finish("ended");
    u.onerror = (e) => finish(`error ${e.error}`);
    abort = () => { synth.cancel(); finish("stopped"); };
    synth.speak(u);
  });
}

async function playClip() {
  await setMode("playback");
  return new Promise((resolve) => {
    const t = performance.now();
    let playing = false;
    const finish = (ok, why) => {
      clearTimeout(guard); clearTimeout(cut);
      audio.pause();
      audio.onplaying = audio.onerror = null;
      abort = () => {};
      resolve({ ok, why, startMs: playing ? Math.round(playing - t) : null });
    };
    let cut;
    const guard = setTimeout(() => finish(false, "did not start within 12 s"), 12000);
    audio.onplaying = () => {
      if (playing) return;
      playing = performance.now();
      clearTimeout(guard);
      cut = setTimeout(() => finish(true, "played"), CLIP_S * 1000);
    };
    audio.onerror = () => finish(false, `media error ${audio.error?.code}`);
    abort = () => finish(false, "stopped");
    audio.src = CLIP;
    audio.currentTime = 0;
    audio.play().catch((e) => finish(false, `play() refused: ${e.name}`));
  });
}

// Listen until a pause after speech, a spoken command, Done, or nothing heard.
// Resolves { text, by, cmd, firstResultMs, error }.
async function listen() {
  if (!SR) return { text: "", by: "none", error: "no SpeechRecognition in this browser" };
  await setMode("play-and-record");
  return new Promise((resolve) => {
    const t = performance.now();
    const segments = [];
    let interim = "", rec = null, finished = false, firstResultMs = null, error = null;
    let pauseTimer, nothingTimer;
    const paint = () => {
      $("heard").innerHTML = `${segments.join(" ")} <i>${interim}</i>`.trim() || "<i>listening…</i>";
    };
    const finish = (by, cmd = null) => {
      if (finished) return;
      finished = true;
      clearTimeout(pauseTimer); clearTimeout(nothingTimer);
      if (interim) segments.push(interim);
      try { rec?.abort(); } catch {}
      $("done").disabled = true;
      abort = () => {};
      done = () => {};
      const text = segments.join(" ").replace(/\s+/g, " ").trim();
      log(`heard (${by}): "${text}"`);
      resolve({ text, by, cmd, firstResultMs, error, ms: Math.round(performance.now() - t) });
    };
    const armPause = () => {
      clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => finish("pause"), PAUSE_ENDS_MS);
    };
    const take = (text) => {
      const p = parseCommand(text);
      if (p.rest) segments.push(p.rest);
      interim = "";
      paint();
      if (p.cmd) finish("voice", p.cmd);
      else armPause();
    };
    const open = () => {
      if (finished) return;
      rec = new SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onstart = () => log("mic open");
      rec.onaudiostart = () => log("mic audio start");
      rec.onspeechstart = () => log("speech detected");
      rec.onresult = (e) => {
        if (firstResultMs == null) firstResultMs = Math.round(performance.now() - t);
        clearTimeout(nothingTimer);
        interim = "";
        for (let k = e.resultIndex; k < e.results.length; k += 1) {
          const text = e.results[k][0].transcript;
          if (e.results[k].isFinal) take(text);
          else interim += text;
        }
        interim = interim.trim();
        paint();
        if (interim) armPause();   // engines that never finalise still end on a pause
      };
      rec.onerror = (e) => {
        log(`recogniser error: ${e.error}${e.message ? ` (${e.message})` : ""}`);
        if (e.error !== "no-speech" && e.error !== "aborted") error = e.error;
        if (["not-allowed", "service-not-allowed", "audio-capture"].includes(e.error)) finish("error");
      };
      rec.onend = () => {
        log("mic closed");
        if (finished) return;
        if (interim) { const s = interim; interim = ""; take(s); }
        setTimeout(open, 250);   // recognisers stop on their own; keep listening
      };
      try { rec.start(); } catch (e) { log(`start() threw: ${e.message}`); setTimeout(open, 500); }
    };
    $("done").disabled = false;
    abort = () => finish("stop", "stop");
    done = () => finish("tap");
    nothingTimer = setTimeout(() => finish("nothing heard"), NOTHING_HEARD_MS);
    paint();
    open();
  });
}

// --- site and Mac ------------------------------------------------------------
async function postRecord(track, transcript, typed, by, listenMs) {
  const body = {
    id: uid(), session, batch: BATCH, track, index: 0, transcript, typed: typed.slice(-2000),
    ended_by: by === "tap" ? "tap" : by === "stop" ? "stop" : "voice",
    replays: 0, listen_ms: Math.min(listenMs || 0, 3600000), client_time: new Date().toISOString(),
    stt: SR ? "speech" : "none",
  };
  const res = await fetch("/api/skrng/feedback", { method: "POST", headers: auth(), body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
  return body.id;
}

async function readBack(id) {
  const res = await fetch(`/api/skrng/feedback?batch=${BATCH}`, { headers: auth(), cache: "no-store" });
  if (!res.ok) throw new Error(`read HTTP ${res.status}`);
  return (await res.json()).find((r) => r.id === id) || null;
}

async function rpc(method, params, timeoutMs) {
  const res = await fetch("/api/rpc", {
    method: "POST", headers: auth(),
    body: JSON.stringify(timeoutMs ? { method, params, timeout_ms: timeoutMs } : { method, params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

const turns = [];
function askPrompt(said) {
  const history = turns.slice(-6).map((t) => `${t.who}: ${t.text}`).join("\n");
  return [
    "Anthony is talking to you by voice from the /skrng talk test page (his phone, maybe in the car).",
    "Your reply is read aloud by a speech engine: answer in at most three short spoken sentences,",
    "plain words, no markdown, no lists, no symbols. This is a live conversation about his music",
    "(HW002, the /skrng batches); use the repo and memory if it helps, but keep it quick.",
    history ? `\nThe conversation so far:\n${history}` : "",
    `\nAnthony just said: "${said}"`,
  ].join(" ");
}

async function askMac(said) {
  const t = performance.now();
  $("reply").textContent = "Asking the Mac…";
  const r = await rpc("ask", { prompt: askPrompt(said) }, ASK_TIMEOUT_MS);
  const ms = Math.round(performance.now() - t);
  const answer = String(r.answer || "").trim();
  $("reply").textContent = answer || "(empty answer)";
  turns.push({ who: "Anthony", text: said }, { who: "Claude", text: answer });
  return { answer, ms };
}

// --- the test ----------------------------------------------------------------
function unlock() {
  // Inside the tap: unlock the media element and the speech engine for later.
  audio.src = SILENCE;
  audio.play().catch(() => {});
  if (synth) { synth.cancel(); synth.speak(new SpeechSynthesisUtterance(" ")); }
}

function environment() {
  log(`page ${location.href.split("#")[0]}`);
  log(`browser ${navigator.userAgent}`);
  log(`speechRecognition ${SR ? "yes" : "NO"}, speechSynthesis ${synth ? "yes" : "NO"}, audioSession ${SESSION ? "yes" : "no"}, voice ${voice ? voice.name : "default"}`);
}

async function sendLog(kind) {
  if (!key) return;
  try { await postRecord("talk-test-log", `${kind} log`, lines.join("\n"), "voice", Math.round(performance.now() - t0)); log("log sent to the site"); }
  catch (e) { log(`log not sent: ${e.message}`); }
}

async function macReady() {
  const p = await rpc("ping", {}, 10000);
  log(`mac ping: ${JSON.stringify(p)}`);
  // signed_in only reports the background-job token; asks also work on the Mac's own login.
  return p;
}

async function runTest() {
  stopped = false;
  unlock();
  environment();
  $("reply").textContent = "";
  for (const s of ["key", "speak", "music", "listen", "save", "mac"]) result(s, null, "");

  result("key", !!key, key ? "found" : "missing: open /skrng/#key=… once on this phone");

  const sp = await speak("Talk test. If you can hear me, step two passed. Next, eight seconds of music.");
  result("speak", sp.ok, sp.ok ? `spoken (${sp.ms} ms)` : `nothing spoken: ${sp.why}`);
  if (stopped) return sendLog("stopped");

  const mu = await playClip();
  result("music", mu.ok, mu.ok ? `played, started after ${mu.startMs} ms` : mu.why);
  if (stopped) return sendLog("stopped");

  await speak("Now say a sentence about that music. I'll stop listening when you pause.");
  const heard = await listen();
  const listenOk = !!heard.text;
  result("listen", listenOk, listenOk
    ? `heard ${heard.text.split(" ").length} words, first words after ${heard.firstResultMs} ms, ended by ${heard.by}`
    : heard.error || heard.by);
  if (stopped) return sendLog("stopped");

  if (!key) {
    result("save", false, "no key");
    result("mac", false, "no key");
  } else {
    try {
      const id = await postRecord("talk-test", heard.text, "", heard.by, heard.ms);
      const back = await readBack(id);
      result("save", !!back, back ? `stored and read back: "${back.transcript.slice(0, 60)}"` : "posted, but not found on read-back");
    } catch (e) { result("save", false, e.message); }

    try {
      await macReady();
      const said = heard.text || "I didn't say anything. Tell me the test reached you.";
      const { answer, ms } = await askMac(said);
      const sp2 = await speak(answer || "The Mac sent an empty answer.");
      result("mac", !!answer && sp2.ok, answer ? `answered in ${(ms / 1000).toFixed(1)} s and spoken` : "empty answer");
    } catch (e) {
      result("mac", false, e.message);
      await speak(`Step six failed. ${e.message}`);
    }
  }
  const passed = ["key", "speak", "music", "listen", "save", "mac"].filter((s) => $(`r-${s}`).classList.contains("ok")).length;
  await speak(`${passed} of 6 steps passed.`);
  await sendLog("test");
}

async function talkLoop() {
  stopped = false;
  unlock();
  environment();
  if (!key) { $("reply").textContent = "No key on this phone: open /skrng/#key=… once."; return; }
  try { await macReady(); } catch (e) { $("reply").textContent = e.message; await speak(e.message); return sendLog("talk"); }
  await speak("I'm listening. Say that's all when you're done.");
  while (!stopped) {
    const heard = await listen();
    if (stopped || heard.cmd === "stop") break;
    if (heard.error && !heard.text) { await speak(`I can't hear you: ${heard.error}.`); break; }
    if (!heard.text) { await speak("I didn't catch anything. Go ahead."); continue; }
    postRecord("talk-test", heard.text, "", heard.by, heard.ms).catch((e) => log(`not saved: ${e.message}`));
    try {
      const { answer, ms } = await askMac(heard.text);
      log(`answer in ${ms} ms`);
      await speak(answer || "I got an empty answer.");
    } catch (e) {
      log(`ask failed: ${e.message}`);
      await speak(`That didn't reach the Mac: ${e.message}`);
    }
  }
  await speak("Okay, talk ended.");
  await sendLog("talk");
}

let busy = false;
const guarded = (fn) => async () => {
  if (busy) return;
  busy = true;
  $("run").disabled = $("talk").disabled = true;
  try { await fn(); } catch (e) { log(`unexpected: ${e.stack || e}`); }
  finally { busy = false; $("run").disabled = $("talk").disabled = false; $("done").disabled = true; }
};
$("run").addEventListener("click", guarded(runTest));
$("talk").addEventListener("click", guarded(talkLoop));
$("done").addEventListener("click", () => done());
$("stop").addEventListener("click", () => { stopped = true; abort(); });
result("key", key ? true : false, key ? "found" : "missing: open /skrng/#key=… once on this phone");
