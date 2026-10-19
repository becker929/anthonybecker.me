// One core's page: the full drawing, its label, and its field notes.
import { render, bedAt, activity } from "./render.js";
import { COLS, weekStart } from "./sample.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("en-GB");
const C = Object.fromEntries(COLS.map((k, i) => [k, i]));
const day = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const weekName = (w) => `the week of ${day(weekStart(w))}`;
const plural = (n, one, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;

let core;
try {
  core = JSON.parse($("core-data").textContent);
} catch {
  core = null;
}

if (!core) {
  $("error").textContent = "There is no core at this address.";
  $("error").hidden = false;
} else if (core.withdrawn) {
  $("withdrawn").hidden = false;
  $("w-accession").textContent = `Core ${core.n}`;
  $("w-text").textContent = `This core was withdrawn by its donor on ${day(Date.parse(core.withdrawnAt))}. The number stays retired.`;
} else {
  show(core);
}

if (new URLSearchParams(location.hash.slice(1)).get("error") === "withdraw") {
  $("error").textContent = "Only the account this core came from can withdraw it.";
  $("error").hidden = false;
  history.replaceState(null, "", location.pathname);
}

function show(core) {
  $("present").hidden = false;
  const url = `${location.origin}/demos/10/core-library/c/${core.n}`;
  $("accession").textContent = `Core ${core.n}`;
  $("title").textContent = core.displayName || `@${core.handle}`;
  const donor = $("donor");
  const a = document.createElement("a");
  a.href = `https://bsky.app/profile/${core.did}`;
  a.textContent = `@${core.handle}`;
  donor.append(a);

  // Draw at a size that keeps beds legible on a phone and sharp on a desktop.
  const img = render(core, {});
  const L = img.layout;
  const canvas = $("core");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d").putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  canvas.setAttribute("aria-label", `Core ${core.n} from @${core.handle}: ${L.length.toFixed(1)} metres of layered rock in ${L.boxesNeeded} core ${L.boxesNeeded === 1 ? "box" : "boxes"}, one bed per week.`);
  $("wait").remove();

  facts(core, L);
  notes(core, L);
  counts(core);
  pointing(core, L, canvas);

  $("zoom").addEventListener("click", () => {
    const on = $("stage").classList.toggle("zoomed");
    $("zoom").setAttribute("aria-pressed", String(on));
    $("zoom").querySelector("span").textContent = on ? "Zoom out" : "Zoom in";
    if (on) {
      const svg = $("zoom").querySelector("path");
      svg.setAttribute("d", "M10 10l4 4M4.8 6.8h4");
    } else {
      $("zoom").querySelector("path").setAttribute("d", "M10 10l4 4M4.8 6.8h4M6.8 4.8v4");
    }
  });
  $("copy").addEventListener("click", async () => {
    const label = $("copy").querySelector("span");
    try {
      await navigator.clipboard.writeText(url);
      label.textContent = "Copied";
    } catch {
      label.textContent = url;
    }
    setTimeout(() => { label.textContent = "Copy link"; }, 2000);
  });
  $("post").href = `https://bsky.app/intent/compose?text=${encodeURIComponent(`Core ${core.n} ${url}`)}`;
  $("save").addEventListener("click", () => {
    canvas.toBlob((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `core-${core.n}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png");
  });
  $("withdraw").addEventListener("click", (e) => {
    e.preventDefault();
    if (!confirm(`Withdraw core ${core.n}? It comes off the shelves for good. You'll sign in as @${core.handle} to confirm.`)) return;
    location.href = `/api/core/login?handle=${encodeURIComponent(core.did)}&withdraw=${core.n}`;
  });
}

function facts(core, L) {
  const dl = $("facts");
  const add = (k, v) => {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    dl.append(dt, dd);
  };
  add("Drilled", day(Date.parse(core.drilledAt)));
  add("Length", `${L.length.toFixed(2)} m in ${plural(L.boxesNeeded, "box", "boxes")}`);
  add("Beds", fmt(L.beds.filter((b) => b.kind === "bed").length));
  add("First bed", weekName(core.firstWeek).replace(/^the /, ""));
  add("District", L.district.name);
}

function notes(core, L) {
  const out = [];
  const beds = L.beds.filter((b) => b.kind === "bed");
  const posts = (w) => w[C.post] + w[C.reply] + w[C.quote];
  if (beds.length) {
    const thick = beds.reduce((a, b) => (activity(b.counts) > activity(a.counts) ? b : a));
    const w = thick.counts;
    const what = posts(w) ? plural(posts(w), "post") : w[C.like] ? plural(w[C.like], "like") : plural(w[C.follow], "follow");
    out.push(`Thickest bed: ${weekName(thick.week)}, with ${what}.`);
    const imgs = beds.reduce((a, b) => (b.counts[C.image] > a.counts[C.image] ? b : a));
    if (imgs.counts[C.image] > 0) out.push(`Most shells: ${weekName(imgs.week)}, with ${plural(imgs.counts[C.image], "image")}.`);
    const veins = beds.reduce((a, b) => (b.counts[C.follow] > a.counts[C.follow] ? b : a));
    if (veins.counts[C.follow] > 0) out.push(`Most veins: ${weekName(veins.week)}, with ${plural(veins.counts[C.follow], "follow")}.`);
  }
  const losses = L.beds.filter((b) => b.kind === "loss");
  const silent = L.beds.filter((b) => b.kind === "loss" || b.kind === "hiatus").reduce((s, b) => s + b.weeks, 0);
  if (losses.length) {
    const big = losses.reduce((a, b) => (b.weeks > a.weeks ? b : a));
    out.push(`Longest core loss: ${big.weeks} weeks, from ${weekName(big.week - big.weeks + 1)}.`);
  }
  if (silent) out.push(`Silent weeks in all: ${fmt(silent)} of ${fmt(core.weeks.length)}.`);
  else out.push(`No silent weeks in ${fmt(core.weeks.length)}.`);
  const peak = core.hours.indexOf(Math.max(...core.hours));
  if (core.hours[peak] > 0) out.push(`Most posts went out in the hour after ${String(peak).padStart(2, "0")}:00 UTC.`);
  if (core.early > 0) out.push(`${plural(core.early, "record")} are dated before Bluesky opened. They are not in the core.`);
  if (L.boxesNeeded >= 12) out.push("The core was shortened to fit twelve boxes. Beds keep their proportions.");
  const ul = $("notes");
  for (const t of out) {
    const li = document.createElement("li");
    li.textContent = t;
    ul.append(li);
  }
}

function counts(core) {
  const tot = COLS.map((_, i) => core.weeks.reduce((s, w) => s + w[i], 0));
  const rows = [
    ["Posts", tot[C.post]], ["Replies", tot[C.reply]], ["Quote posts", tot[C.quote]],
    ["Reposts", tot[C.repost]], ["Likes", tot[C.like]], ["Images", tot[C.image]],
    ["Videos", tot[C.video]], ["Links", tot[C.link]], ["Follows", tot[C.follow]],
  ];
  const t = $("counts");
  for (const [k, v] of rows) {
    const tr = t.insertRow();
    tr.insertCell().textContent = k;
    tr.insertCell().textContent = fmt(v);
  }
}

function describe(bed) {
  if (bed.kind === "bedrock") return "Bedrock. Granite, older than the account.";
  if (bed.kind === "loss" || bed.kind === "hiatus") {
    const span = bed.weeks === 1 ? weekName(bed.week) : `${weekName(bed.week - bed.weeks + 1)} to ${weekName(bed.week).replace(/^the /, "")}`;
    return `${bed.kind === "loss" ? "Core loss" : "Hiatus"}: ${plural(bed.weeks, "silent week")}, ${span}.`;
  }
  const w = bed.counts;
  const parts = [
    [w[C.post], "post"], [w[C.reply], "reply", "replies"], [w[C.quote], "quote post"], [w[C.repost], "repost"],
    [w[C.like], "like"], [w[C.image], "image"], [w[C.video], "video"], [w[C.link], "link"], [w[C.follow], "follow"],
  ].filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many));
  const head = `${weekName(bed.week).replace(/^the w/, "W")}${bed.top ? " (this week)" : ""}`;
  return `${head}: ${parts.length ? parts.join(", ") : "nothing"}.`;
}

function pointing(core, L, canvas) {
  const overlay = $("overlay");
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  const g = overlay.getContext("2d");
  let current = null;
  const mark = (bed) => {
    g.clearRect(0, 0, overlay.width, overlay.height);
    if (!bed) return;
    g.strokeStyle = "#f6f3ea";
    g.lineWidth = 2;
    for (const box of L.boxes) {
      for (const row of box.rows) {
        const a = Math.max(bed.d0, row.d0), b = Math.min(bed.d1, row.d1);
        if (b <= a) continue;
        const x0 = row.x0 + (a - row.d0) * L.ppm, x1 = row.x0 + (b - row.d0) * L.ppm;
        g.strokeRect(Math.round(x0) - 1, row.y - 1, Math.max(3, Math.round(x1 - x0)) + 2, L.channel + 2);
      }
    }
  };
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const y = ((e.clientY - r.top) / r.height) * canvas.height;
    return bedAt(L, x, y);
  };
  const update = (bed) => {
    if (bed === current) return;
    current = bed;
    mark(bed);
    $("readout").textContent = bed ? describe(bed) : "Point at a bed, or tap one, to read its week.";
  };
  canvas.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") update(at(e)); });
  canvas.addEventListener("pointerdown", (e) => update(at(e)));
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") update(null); });
}

