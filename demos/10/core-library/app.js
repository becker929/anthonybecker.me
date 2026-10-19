// The library's front page: the drill, and the shelves.
import { render } from "./render.js";
import { COLS } from "./sample.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-GB");

const ERRORS = {
  handle: "That doesn't look like a Bluesky handle.",
  resolve: "Couldn't find that account. Check the handle and try again.",
  authorize: "The account's server didn't accept the sign-in request.",
  denied: "Sign-in was cancelled.",
  expired: "The sign-in took too long. Start again.",
  issuer: "The sign-in came back from the wrong server. Start again.",
  identity: "The sign-in came back for a different account.",
  token: "The account's server didn't finish the sign-in. Start again.",
};

function hashParams() {
  return new URLSearchParams(location.hash.slice(1));
}

// ---------- the drill ----------

const lines = [];
function log(text, replaceLast = false) {
  if (replaceLast && lines.length) lines[lines.length - 1] = text;
  else lines.push(text);
  $("log").textContent = lines.join("\n");
}

async function download(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`the account's server answered ${res.status}`);
  const reader = res.body.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    total += value.length;
    onBytes(total);
  }
  const buf = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { buf.set(p, o); o += p.length; }
  return buf;
}

function count(buf, now) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./drill-worker.js", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      if (e.data.progress) log(`Reading blocks: ${fmt(e.data.progress)}`, true);
      else if (e.data.sample) { w.terminate(); resolve(e.data.sample); }
      else if (e.data.error) { w.terminate(); reject(new Error(e.data.error)); }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || "the counter stopped")); };
    w.postMessage({ buf: buf.buffer, now }, [buf.buffer]);
  });
}

async function drill(ticket) {
  $("start").hidden = true;
  $("drilling").hidden = false;
  $("drill-retry").hidden = true;
  lines.length = 0;
  try {
    const tr = await fetch(`/api/core/ticket?t=${encodeURIComponent(ticket)}`);
    if (!tr.ok) throw new Error("this drill ticket has expired. Sign in again");
    const t = await tr.json();
    log(`Signed in as @${t.handle}.`);
    log("Downloading the repository: 0 MB");
    const buf = await download(`${t.pds}/xrpc/com.atproto.sync.getRepo?did=${encodeURIComponent(t.did)}`,
      (n) => log(`Downloading the repository: ${(n / 1e6).toFixed(1)} MB`, true));
    log("Reading blocks: 0");
    const sample = await count(buf, Date.now());
    const tot = COLS.map((_, i) => sample.weeks.reduce((s, w) => s + w[i], 0));
    log(`Read ${fmt(sample.records)} records over ${fmt(sample.weeks.length)} weeks.`, true);
    log(`${fmt(tot[0] + tot[1] + tot[2])} posts, ${fmt(tot[3])} reposts, ${fmt(tot[4])} likes, ${fmt(tot[8])} follows.`);
    log("Filing the core.");
    const res = await fetch("/api/core/drill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket, sample: { firstWeek: sample.firstWeek, weeks: sample.weeks, hours: sample.hours, early: sample.early } }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `the library answered ${res.status}`);
    log(`Filed as core ${body.n}.`);
    // Warm the social card so the first share has a picture.
    fetch(`c/${body.n}/card.png`).catch(() => {});
    history.replaceState(null, "", location.pathname);
    location.href = `c/${body.n}`;
  } catch (err) {
    const msg = String(err.message || err);
    log(`Stopped: ${msg.charAt(0).toLowerCase() + msg.slice(1)}${/[.!?]$/.test(msg) ? "" : "."}`);
    history.replaceState(null, "", location.pathname);
    $("drill-retry").hidden = false;
  }
}

$("retry").addEventListener("click", () => {
  $("drilling").hidden = true;
  $("start").hidden = false;
  $("handle").focus();
});

$("drill-form").addEventListener("submit", (e) => {
  const v = $("handle").value.trim();
  if (!v) { e.preventDefault(); return; }
  try { localStorage.setItem("core-library-handle", v); } catch {}
});

try {
  const last = localStorage.getItem("core-library-handle");
  if (last) $("handle").value = last;
} catch {}

// ---------- the shelves ----------

const shelf = $("shelf");
let oldest = 0;

function thumb(core) {
  const img = render({ ...core }, { boxes: 1, ppm: 300, header: false, detail: false });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d").putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  c.setAttribute("aria-hidden", "true");
  return c;
}

async function loadShelf(before) {
  const res = await fetch(`/api/core/list${before ? `?before=${before}` : ""}`);
  if (!res.ok) throw new Error(String(res.status));
  const { cores, more } = await res.json();
  if (!before) shelf.textContent = "";
  if (!cores.length && !before) {
    shelf.innerHTML = '<li class="small">The shelves are empty. The first core will go here.</li>';
  }
  for (const core of cores) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `c/${core.n}`;
    a.append(thumb(core));
    const cap = document.createElement("div");
    cap.className = "cap";
    const b = document.createElement("b");
    b.textContent = `Core ${core.n}`;
    const span = document.createElement("span");
    span.textContent = ` @${core.handle}`;
    cap.append(b, span);
    a.append(cap);
    li.append(a);
    shelf.append(li);
    oldest = core.n;
    // Let the page paint between thumbnails.
    await new Promise((r) => setTimeout(r, 0));
  }
  $("more").hidden = !more;
}

$("more").addEventListener("click", () => loadShelf(oldest).catch(() => {}));

// ---------- start ----------

const hp = hashParams();
if (hp.get("error")) {
  $("error").textContent = ERRORS[hp.get("error")] || "Something went wrong. Start again.";
  $("error").hidden = false;
  history.replaceState(null, "", location.pathname);
}
if (hp.get("drill")) drill(hp.get("drill"));

loadShelf(0).catch(() => {
  shelf.innerHTML = '<li class="small">The shelves didn\'t load. Reload to try again.</li>';
});
