// Voice review for /skrng: a batch you can judge without looking.
//
// One tap starts it. For each track it announces where you are and what
// differs, plays the track, asks what you thought, then listens until you
// say "next" (or tap Done, or press the earbud's next/play button). Whatever
// you said becomes that track's feedback, saved to the site so the agent
// building the next batch can read it.
//
// The words come from voice.js; this file drives the browser:
//   - speech out: speechSynthesis (the phone's own voices)
//   - speech in:  SpeechRecognition / webkitSpeechRecognition
//   - cues:       two short tones from Web Audio — rising when the mic
//                 opens, falling when an answer is taken
//
// The microphone is only ever on while the page is waiting for an answer.
// Never during speech, so the recogniser cannot transcribe the page's own
// voice; never during a track, because a Bluetooth headset with an open mic
// drops to its call codec and the track would be judged at phone quality.
//
// Answers are kept on the phone first (localStorage) and then posted to
// /api/skrng/feedback with the key the owner opens the page with once
// (/skrng/#key=...). Without a key, or offline, they stay on the phone and
// are retried on the next visit.
import {
  announcement, batchIntro, closing, groupsFor, parseCommand,
  PROMPT, PROMPT_AGAIN, PROMPT_FIRST, REMINDER, NO_MIC,
} from "./voice.js";

const KEY_STORE = "skrng.key";
const FB_STORE = "skrng.fb";
const REMIND_AFTER_MS = 30000;   // one spoken reminder if nothing is heard
const NEXT_SETTLE_MS = 900;      // an interim "...next" that stays put counts
const GAP_AFTER_MIC_MS = 150;    // a breath between steps; forOutput() waits for the headset
const TRACK_START_MS = 12000;    // a track that has not started by then is skipped
const TRACK_STALL_MS = 15000;    // a track that stops moving that long is ended
// 0.1 s of silence: what the start tap plays to unlock the track player, so
// unlocking never depends on a track loading.
const SILENCE = "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis || null;

// Audio session. With a Bluetooth headset, an open mic moves the headset to its
// call profile (HFP: mono, phone quality); playback alone keeps it in its
// stereo media profile (A2DP). Left to itself the phone guesses and flips
// between the two mid-sound. Safari (16.4+) lets a page say which it wants:
// navigator.audioSession.type = "playback" or "play-and-record". Every sound
// (speech, cues, tracks) first locks "playback"; only listening switches to
// "play-and-record". Each switch waits for the headset to change profile
// before anything is played or heard. Browsers without the API still get
// the wait, which is what lets their headset settle too.
const SESSION = navigator.audioSession || null;
const ROUTE_SETTLE_MS = 1200;
let sessionMode = null;
async function setMode(m) {
  if (sessionMode === m) return;
  sessionMode = m;
  if (SESSION) { try { SESSION.type = m; } catch {} }
  await sleep(ROUTE_SETTLE_MS);
}
const forOutput = () => setMode("playback");
const forInput = () => setMode("play-and-record");

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// --- Key and local store --------------------------------------------------

function readKey() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const fresh = hash.get("key") || query.get("key");
  if (fresh) {
    try { localStorage.setItem(KEY_STORE, fresh); } catch {}
    hash.delete("key");
    query.delete("key");
    const q = query.toString();
    const h = hash.toString();
    history.replaceState(null, "", `${location.pathname}${q ? `?${q}` : ""}${h ? `#${h}` : ""}`);
    return fresh;
  }
  try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; }
}

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(FB_STORE) || "[]"); } catch { return []; }
}

function saveLocal(records) {
  try { localStorage.setItem(FB_STORE, JSON.stringify(records.slice(-500))); } catch {}
}

// --- Sound: earcons and speech ---------------------------------------------

let audioCtx = null;
async function cue(up) {
  await forOutput();
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + 0.02;
    const notes = up ? [660, 990] : [990, 660];
    notes.forEach((f, k) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const s = t0 + k * 0.11;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.18, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.1);
      o.connect(g).connect(audioCtx.destination);
      o.start(s);
      o.stop(s + 0.11);
    });
  } catch {}
  return sleep(260);
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
if (synth) {
  pickVoice();
  synth.addEventListener?.("voiceschanged", pickVoice);
}

// --- The controller ---------------------------------------------------------

function start(page) {
  const { n, meta, items, list } = page;
  const groups = groupsFor(items, meta);
  let key = readKey();
  let records = loadLocal();

  const btn = $("review");
  const panel = $("rv");
  const state = $("rv-state");
  const heard = $("rv-heard");
  const typed = $("rv-typed");
  const keyLine = $("rv-key");
  const bDone = $("rv-done");
  const bAgain = $("rv-again");
  const bStop = $("rv-stop");
  const fromStart = $("rv-from-start");
  const audio = $("rv-audio");

  let run = null; // the active review, or null

  // --- what has been said about this batch already

  function forBatch() {
    return records.filter((r) => r.batch === n);
  }

  function showFeedback() {
    list.querySelectorAll("li[data-i]").forEach((li) => {
      const item = items[Number(li.dataset.i)];
      const mine = forBatch().filter((r) => r.track === item.id && (r.transcript || r.typed));
      let p = li.querySelector(".fb");
      if (!mine.length) { p?.remove(); return; }
      if (!p) { p = document.createElement("div"); p.className = "fb"; li.appendChild(p); }
      p.innerHTML = mine.map((r) => `<p>“${esc([r.transcript, r.typed].filter(Boolean).join(" — "))}”${r.synced ? "" : ' <span class="unsynced">not yet saved to the site</span>'}</p>`).join("");
    });
  }

  function firstUnanswered() {
    const done = new Set(forBatch().map((r) => r.track));
    const i = items.findIndex((it) => !done.has(it.id));
    return i < 0 ? 0 : i;
  }

  function idleLabel() {
    const at = firstUnanswered();
    const resume = at > 0;
    btn.innerHTML = `<span>${resume ? `Resume voice review at track ${at + 1}` : "Review by voice"}</span>`;
    fromStart.hidden = !resume;
  }

  // Where the answers are: on the site (agents can read them) or only on this phone.
  function showWhere() {
    const where = $("rv-where");
    const exp = $("rv-export");
    const all = records.filter((r) => r.transcript || r.typed);
    if (!all.length) { where.hidden = true; exp.hidden = true; return; }
    const onSite = all.filter((r) => r.synced).length;
    const local = all.length - onSite;
    where.textContent = local
      ? `${all.length} answers: ${onSite} saved to the site, ${local} only on this phone.`
      : `${all.length} answers, all saved to the site, where the agent building the next batch reads them.`;
    where.hidden = false;
    exp.hidden = false;
  }

  function exportText() {
    return records.filter((r) => r.transcript || r.typed).map((r) => {
      const item = items.find((it) => it.id === r.track);
      return `batch ${r.batch} · ${item ? item.title : r.track} · ${r.client_time}${r.synced ? "" : " (phone only)"}\n${[r.transcript, r.typed].filter(Boolean).join(" — ")}`;
    }).join("\n\n");
  }

  function showKey(msg) {
    keyLine.textContent = msg || (key
      ? "Answers save to the site."
      : "No key on this phone: answers stay here until you open the page with your key.");
  }

  // --- saving

  async function post(rec) {
    if (!key) return "nokey";
    try {
      const res = await fetch("/api/skrng/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(rec),
      });
      if (res.ok) return "ok";
      if (res.status === 401) return "badkey";
      if (res.status === 503) return "off";
      return "error";
    } catch {
      return "offline";
    }
  }

  async function sync() {
    let note = "";
    for (const r of records.filter((x) => !x.synced)) {
      const { synced, ...body } = r;
      const result = await post(body);
      if (result === "ok") r.synced = true;
      else {
        note = {
          nokey: "",
          badkey: "The key on this phone was refused; answers stay here.",
          off: "The site is not set up to store answers yet; they stay here.",
          offline: "Offline: answers stay here and are sent on the next visit.",
          error: "The site refused an answer; it stays here.",
        }[result];
        break;
      }
    }
    saveLocal(records);
    showKey(note);
    showFeedback();
    showWhere();
  }

  // Pull answers already on the site (another phone, an earlier session).
  async function pull() {
    if (!key) return;
    try {
      const res = await fetch(`/api/skrng/feedback?batch=${n}`, { headers: { Authorization: `Bearer ${key}` } });
      if (!res.ok) return;
      const remote = await res.json();
      const have = new Set(records.map((r) => r.id));
      for (const r of remote) if (!have.has(r.id)) records.push({ ...r, synced: true });
      records.sort((a, b) => (a.client_time < b.client_time ? -1 : 1));
      saveLocal(records);
    } catch {}
  }

  // --- interruptible steps
  //
  // Each step resolves early when Stop (or a skip) calls run.abort(). After
  // every await the loop checks run.cancelled.

  async function speak(text) {
    if (synth && !run?.cancelled) await forOutput();
    return new Promise((resolve) => {
      if (!synth || run?.cancelled) return resolve();
      let done = false;
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || "en-US";
      u.rate = 1.0;
      const prev = { abort: run.abort, skip: run.skip };
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        // Hand Stop and skip back to whatever step was speaking.
        run.abort = prev.abort;
        run.skip = prev.skip;
        resolve();
      };
      // Some engines drop onend; never wait longer than the text could take.
      const guard = setTimeout(finish, 2500 + text.split(/\s+/).length * 550);
      u.onend = finish;
      u.onerror = finish;
      run.abort = () => { synth.cancel(); finish(); };
      run.skip = run.abort;
      // Safari can drop an utterance queued straight after cancel(), so
      // only cancel when something is actually speaking.
      if (synth.speaking || synth.pending) synth.cancel();
      synth.speak(u);
    });
  }

  // Resolves true once the track has played (to the end, or until skipped),
  // false if it never started. play() can stay pending indefinitely — Chrome
  // defers loading media in a tab that is not visible, and a dropped network
  // leaves it loading — so a watchdog decides instead of the promise.
  async function playTrack(i) {
    if (!run.cancelled) await forOutput();
    return new Promise((resolve) => {
      if (run.cancelled) return resolve(true);
      const item = items[i];
      let started = false;
      let lastMove = Date.now();
      let lastTime = -1;
      const done = () => {
        clearInterval(watch);
        audio.onended = audio.onerror = audio.ontimeupdate = audio.onplaying = null;
        audio.pause();
        resolve(started);
      };
      const watch = setInterval(() => {
        if (!started && Date.now() - lastMove > TRACK_START_MS) done();
        else if (started && !audio.paused && Date.now() - lastMove > TRACK_STALL_MS) done();
      }, 1000);
      audio.onended = done;
      audio.onerror = done;
      audio.onplaying = () => { started = true; lastMove = Date.now(); };
      audio.ontimeupdate = () => {
        if (audio.currentTime !== lastTime) { lastTime = audio.currentTime; lastMove = Date.now(); if (audio.currentTime > 0) started = true; }
        const t = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "–:––");
        state.textContent = `Playing track ${i + 1} · ${t(audio.currentTime)} / ${t(audio.duration || item.duration_s)}`;
      };
      run.abort = done;
      run.skip = done; // earbud "next" during a track ends it and asks
      audio.muted = false;
      if (!audio.src.endsWith(item.file)) audio.src = item.file;
      audio.currentTime = 0;
      audio.play().catch(done);
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: `Track ${i + 1}`,
            artist: `skrng batch ${n}`,
            album: item.title,
          });
        } catch {}
      }
    });
  }

  // Wait for the answer. Resolves { cmd, text, by }.
  function listen(i, prompt) {
    return new Promise(async (resolve) => {
      if (run.cancelled) return resolve({ cmd: "stop", text: "", by: "stop" });
      const segments = [];
      let interim = "";
      let settle = null;
      let remind = null;
      let reminded = false;
      let finished = false;
      let rec = null;
      let recRunning = false;

      const paint = () => {
        heard.innerHTML = `${esc(segments.join(" "))}${interim ? ` <em>${esc(interim)}</em>` : ""}` || "";
      };

      const stopMic = (graceful) => new Promise((done) => {
        if (!rec || !recRunning) return done();
        const r = rec;
        const t = setTimeout(done, 1200);
        r.onend = () => { recRunning = false; clearTimeout(t); done(); };
        try { graceful ? r.stop() : r.abort(); } catch { done(); }
      });

      const finish = async (cmd, by) => {
        if (finished) return;
        finished = true;
        clearTimeout(settle);
        clearTimeout(remind);
        if (synth && (synth.speaking || synth.pending)) synth.cancel();
        // A tap or earbud press may land mid-sentence: let the recogniser
        // hand over what it already heard before closing.
        await stopMic(by !== "voice");
        if (interim) {
          const p = parseCommand(interim);
          if (p.rest) segments.push(p.rest);
          interim = "";
        }
        paint();
        bDone.disabled = bAgain.disabled = true;
        resolve({ cmd, text: segments.join(" ").trim(), by });
      };

      const take = (text) => {
        const p = parseCommand(text);
        if (p.rest) segments.push(p.rest);
        paint();
        if (p.cmd) finish(p.cmd, "voice");
      };

      const openMic = () => {
        if (!SR || run.micDenied || finished) return;
        rec = new SR();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e) => {
          interim = "";
          for (let k = e.resultIndex; k < e.results.length; k += 1) {
            const text = e.results[k][0].transcript;
            if (e.results[k].isFinal) take(text);
            else interim += text;
          }
          interim = interim.trim();
          paint();
          clearTimeout(remind);
          // Engines that are slow to finalise: an interim ending in "next"
          // that stops changing is taken as said.
          clearTimeout(settle);
          if (interim && parseCommand(interim).cmd === "next") {
            const snapshot = interim;
            settle = setTimeout(() => { if (interim === snapshot) { interim = ""; take(snapshot); } }, NEXT_SETTLE_MS);
          }
        };
        rec.onerror = (e) => {
          if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
            run.micDenied = true;
          }
        };
        // Recognisers end on their own after silence or a minute; while
        // still waiting, keep what was heard and start again.
        rec.onend = () => {
          recRunning = false;
          if (finished || run.cancelled) return;
          if (interim) { const t = interim; interim = ""; take(t); }
          if (run.micDenied) return noMic();
          setTimeout(openMic, 250);
        };
        // Count the mic as on from the moment it is asked for, not from
        // onstart: an answer can end (a tap, an earbud press) before the
        // recogniser reports that it started, and stopMic must still close it.
        try { rec.start(); recRunning = true; } catch { setTimeout(openMic, 500); }
      };

      const noMic = async () => {
        if (run.saidNoMic) return;
        run.saidNoMic = true;
        state.textContent = `Track ${i + 1}: tap Done when you're ready`;
        await speak(NO_MIC);
      };

      const armReminder = () => {
        clearTimeout(remind);
        if (reminded || !SR || run.micDenied) return;
        remind = setTimeout(async () => {
          if (finished || segments.length || interim) return;
          reminded = true;
          await stopMic(false);       // never let the mic hear the page speak
          if (finished) return;
          if (run.cancelled) return finish("stop", "stop");
          await speak(REMINDER);
          if (run.cancelled) return finish("stop", "stop");
          await cue(true);
          await forInput();
          if (finished || run.cancelled) return;
          openMic();
        }, REMIND_AFTER_MS);
      };

      run.abort = () => finish("stop", "stop");
      run.skip = () => finish("next", "earbud");
      run.tap = (cmd) => finish(cmd, "tap");

      heard.textContent = "";
      bDone.disabled = bAgain.disabled = false;
      state.textContent = `Track ${i + 1}: what did you think?`;
      const usable = SR && !run.micDenied;
      await speak(usable ? prompt : (run.saidNoMic ? PROMPT : NO_MIC));
      run.saidNoMic = run.saidNoMic || !usable;
      if (finished) return;
      if (run.cancelled) return finish("stop", "stop");
      await cue(true);
      if (finished) return;
      if (run.cancelled) return finish("stop", "stop");
      if (usable) {
        state.textContent = `Track ${i + 1}: opening the mic…`;
        await forInput();
        if (finished) return;
        if (run.cancelled) return finish("stop", "stop");
      }
      state.textContent = usable ? `Track ${i + 1}: listening — say "next" when you're done` : `Track ${i + 1}: tap Done when you're ready`;
      openMic();
      armReminder();
    });
  }

  // --- one review, start to finish

  async function review(startAt) {
    page.stopRun?.();
    page.players?.forEach((p) => p.pause());
    run = { cancelled: false, micDenied: !SR, saidNoMic: false, abort: () => {}, skip: () => {}, tap: () => {} };
    const me = run;
    const session = uid();
    let answered = 0;
    let stoppedAfter = null;
    panel.hidden = false;
    btn.hidden = true;
    fromStart.hidden = true;
    $("play-batch").disabled = true;
    bStop.disabled = false;
    let lock = null;
    try { lock = await navigator.wakeLock?.request("screen"); } catch {}
    me.relock = async () => {
      if (document.visibilityState === "visible" && !me.cancelled) {
        try { lock = await navigator.wakeLock?.request("screen"); } catch {}
      }
    };
    document.addEventListener("visibilitychange", me.relock);

    claimButtons(true);
    if (SR) { await forInput(); await primeMic(me); }

    state.textContent = `Batch ${n}`;
    await speak(batchIntro(n, items, groups, meta, startAt));

    let i = startAt;
    let resumed = startAt > 0;
    let first = true;
    while (i < items.length && !me.cancelled) {
      const item = items[i];
      list.querySelectorAll("li").forEach((li) => li.classList.toggle("current", Number(li.dataset.i) === i));
      list.querySelector(`li[data-i="${i}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      state.textContent = `Track ${i + 1} of ${items.length}`;
      heard.textContent = "";
      await speak(announcement(items, groups, i, { resumed }));
      resumed = false;
      if (me.cancelled) break;
      if (!(await playTrack(i))) {
        if (me.cancelled) break;
        state.textContent = `Track ${i + 1} didn't load`;
        await speak(`Track ${i + 1} didn't load. Moving on.`);
        i += 1;
        continue;
      }
      if (me.cancelled) break;
      await sleep(150);

      const t0 = Date.now();
      let text = "";
      let replays = 0;
      let prompt = first ? PROMPT_FIRST : PROMPT;
      first = false;
      let answer;
      for (;;) {
        answer = await listen(i, prompt);
        text = [text, answer.text].filter(Boolean).join(" ");
        if (answer.cmd !== "again" || me.cancelled) break;
        replays += 1;
        await sleep(GAP_AFTER_MIC_MS);
        await playTrack(i);
        prompt = PROMPT_AGAIN;
      }
      const note = typed.value.trim();
      typed.value = "";
      // "go back" with nothing said is navigation, not an answer.
      if (!(answer.cmd === "back" && !text && !note)) {
        const rec = {
          id: uid(),
          session,
          batch: n,
          track: item.id,
          index: i,
          transcript: text,
          typed: note,
          ended_by: answer.by,
          replays,
          listen_ms: Math.min(Date.now() - t0, 3600000),
          client_time: new Date().toISOString(),
          stt: me.micDenied ? "none" : "speech",
          synced: false,
        };
        records.push(rec);
        saveLocal(records);
        showFeedback();
        sync();
        if (text || note) answered += 1;
      }
      if (answer.cmd === "stop") { stoppedAfter = i; break; }
      await cue(false);
      await sleep(GAP_AFTER_MIC_MS);
      if (answer.cmd === "back") { i = Math.max(0, i - 1); resumed = true; continue; }
      i += 1;
    }

    const wasTapStop = me.tapStopped;
    if (wasTapStop && stoppedAfter == null && i > startAt) stoppedAfter = i - 1;
    me.cancelled = false; // allow the closing line to be spoken
    const words = closing(n, answered, items.length - startAt, stoppedAfter);
    state.textContent = words;
    if (!wasTapStop) await speak(words);
    me.cancelled = true;
    document.removeEventListener("visibilitychange", me.relock);
    claimButtons(false);
    try { await lock?.release(); } catch {}
    run = null;
    panel.hidden = true;
    btn.hidden = false;
    $("play-batch").disabled = false;
    list.querySelectorAll("li").forEach((li) => li.classList.remove("current"));
    idleLabel();
    $("now").textContent = words;
  }

  // Ask for the microphone once, at the start, so the permission prompt
  // never interrupts the first answer.
  function primeMic(me) {
    return new Promise((resolve) => {
      let r;
      try { r = new SR(); } catch { me.micDenied = true; return resolve(); }
      const t = setTimeout(() => { try { r.abort(); } catch {} resolve(); }, 10000);
      r.onstart = () => { try { r.abort(); } catch {} };
      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") me.micDenied = true;
      };
      r.onend = () => { clearTimeout(t); resolve(); };
      try { r.start(); } catch { clearTimeout(t); resolve(); }
    });
  }

  // Mobile browsers only let audio and speech start on their own after a
  // tap has started them once; do both inside the tap, before any await.
  function unlock(startAt) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.resume();
    } catch {}
    audio.src = SILENCE;
    audio.play().then(() => audio.pause()).catch(() => {});
    if (synth) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      synth.speak(u);
    }
  }

  function begin(at) {
    if (run) return;
    unlock(at);
    review(at);
  }

  btn.addEventListener("click", () => begin(firstUnanswered()));
  fromStart.addEventListener("click", (e) => { e.preventDefault(); begin(0); });
  bDone.addEventListener("click", () => run?.tap("next"));
  bAgain.addEventListener("click", () => run?.tap("again"));
  bStop.addEventListener("click", () => {
    if (!run) return;
    run.tapStopped = true;
    run.cancelled = true;
    bStop.disabled = true;
    run.abort();
  });

  // Earbud and lock-screen buttons. Browsers route these to whatever last
  // played media, so they work best right after a track; on a phone with
  // the screen on they reach the page throughout.
  // They are claimed only while a review runs, so Play batch and the
  // track players keep the browser's own pause and skip outside a review.
  const BUTTONS = ["nexttrack", "play", "pause", "previoustrack"];
  function claimButtons(on) {
    if (!("mediaSession" in navigator)) return;
    for (const action of BUTTONS) {
      const fn = !on ? null : action === "previoustrack" ? () => run?.tap?.("again") : () => run?.skip();
      try { navigator.mediaSession.setActionHandler(action, fn); } catch {}
    }
  }

  $("rv-export").addEventListener("click", async (e) => {
    e.preventDefault();
    const text = exportText();
    try {
      if (navigator.share) await navigator.share({ title: `skrng answers`, text });
      else { await navigator.clipboard.writeText(text); $("rv-export").textContent = "Copied"; }
    } catch {
      try { await navigator.clipboard.writeText(text); $("rv-export").textContent = "Copied"; } catch {}
    }
  });

  window.addEventListener("online", sync);
  showKey();
  idleLabel();
  showFeedback();
  showWhere();
  btn.hidden = false;
  pull().then(() => { showFeedback(); idleLabel(); sync(); });
}

if (window.skrngPage) start(window.skrngPage);
else window.addEventListener("skrng:ready", (e) => start(e.detail), { once: true });
