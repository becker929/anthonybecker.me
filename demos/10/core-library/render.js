// Draws a core from its weekly counts, pixel by pixel, into a plain RGBA
// buffer. No canvas calls and no floating-point drawing APIs: the output is
// a pure function of the stored core, so the browser and the server draw the
// same bytes. The server uses it for the social card.
//
// Reading the picture: the core lies in a box, left to right, top row first.
// The top-left end is the drill week. The far end is the account's first
// week, then bedrock. One bed is one week.
import { COLS, weekStart } from "./sample.js";
import { drawText, textWidth } from "./font.js";

const C = Object.fromEntries(COLS.map((k, i) => [k, i]));

export const ROW_M = 1; // one metre of core per box row
export const ROWS_PER_BOX = 5;
export const MAX_BOXES = 12;
const DIAMETER_M = 0.0635; // HQ core
const BEDROCK_M = 0.16;

// ---------- deterministic noise ----------

export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function h2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------- colour ----------

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Each account draws from one district. Colours are taken from photographs
// of real core, so nothing glows.
export const DISTRICTS = [
  { name: "Redbed", beds: ["#8e3b2a", "#b5583b", "#c98a5e", "#7a4a3a", "#a86b4f"], granite: ["#c99a86", "#e3d8cf", "#4a403a"] },
  { name: "Chalk", beds: ["#e3ddcc", "#d2c9b2", "#bdb39b", "#cfc6ae", "#9f988a"], granite: ["#d9cfc4", "#9da1a3", "#262626"] },
  { name: "Slate", beds: ["#545a61", "#666e76", "#454a51", "#7d8389", "#5c5a55"], granite: ["#b9b2a8", "#7d8287", "#1f2123"] },
  { name: "Banded iron", band: true, beds: ["#7b3026", "#3a3536", "#94402f", "#5d5455", "#a9553f"], granite: ["#c7816a", "#cfc8c0", "#1e1b1b"] },
  { name: "Coal measures", beds: ["#3a3631", "#57514a", "#7a705f", "#968a72", "#2b2927"], granite: ["#a69a8c", "#d6d0c6", "#1b1a19"] },
  { name: "Marl", beds: ["#c2baa1", "#a9a58c", "#8e9a86", "#d4cdb8", "#7c8471"], granite: ["#d8c2b0", "#b8b6ae", "#2c2c2a"] },
  { name: "Tuff", beds: ["#a39882", "#76716a", "#b9a27a", "#5e5953", "#c4b496"], granite: ["#cf9f8a", "#e0dbd3", "#24211f"] },
  { name: "Glauconite", beds: ["#56654c", "#6f7c5b", "#46503f", "#8f9775", "#a59d7c"], granite: ["#cdb5a6", "#a9aba5", "#1d201c"] },
];
const PEBBLES = ["#d8d2c4", "#3b3a38", "#9a6b52", "#c4b08a", "#6f7a80", "#b9a69a"].map(hex);
const SHELL = hex("#e2d9c6");
const SHELL_DARK = hex("#8c806b");
const PYRITE = hex("#c6a54a");
const VEIN = hex("#ece8dd");

// ---------- the core as a list of beds ----------

export function activity(w) {
  return w[C.post] * 3 + w[C.reply] * 1.5 + w[C.quote] * 2.5 + w[C.repost] + w[C.like] * 0.2 +
    w[C.image] + w[C.video] * 2 + w[C.follow] * 0.3;
}

// Top of the core first. Each entry: {kind, week, len (m), ...}.
// kind is "bed", "hiatus" (one or two empty weeks), "loss" (three or more),
// or "bedrock".
export function bedsOf(core) {
  const seed = hashString(core.did);
  const district = DISTRICTS[seed % DISTRICTS.length];
  const weeks = core.weeks;
  const out = [];
  let q = -1, colourIdx = seed % 5;
  for (let i = weeks.length - 1; i >= 0; ) {
    const w = weeks[i];
    if (activity(w) === 0 && i !== weeks.length - 1) {
      let j = i;
      while (j >= 0 && activity(weeks[j]) === 0) j--;
      const n = i - j;
      if (j < 0) break; // nothing before: the account is younger than its first records
      out.push(n < 3
        ? { kind: "hiatus", week: core.firstWeek + i, weeks: n, len: 0.004 }
        : { kind: "loss", week: core.firstWeek + i, weeks: n, len: Math.min(0.16, 0.035 + 0.004 * n) });
      i = j;
      continue;
    }
    const week = core.firstWeek + i;
    const d = new Date(weekStart(week));
    const quarter = d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3);
    if (quarter !== q) {
      // A new formation each calendar quarter, never the same colour twice running.
      const step = 1 + (hashString(core.did + ":" + quarter) % 4);
      colourIdx = (colourIdx + step) % 5;
      q = quarter;
    }
    const a = activity(w);
    const posts = w[C.post] + w[C.reply] + w[C.quote];
    // Banded iron alternates two colours week by week.
    const ci = district.band && week % 2 ? (colourIdx + 1) % 5 : colourIdx;
    out.push({
      kind: "bed",
      week,
      index: i,
      len: 0.006 + 0.0042 * Math.sqrt(a),
      colour: hex(district.beds[ci]),
      formation: quarter,
      counts: w,
      replyShare: posts ? w[C.reply] / posts : 0,
      repostShare: w[C.repost] / Math.max(1, posts + w[C.repost]),
      meanChars: posts ? w[C.chars] / posts : 0,
      top: i === weeks.length - 1,
      tone: 0.9 + (hashString(core.did + "/" + week) % 1000) / 1000 * 0.2,
    });
    i--;
  }
  out.push({ kind: "bedrock", len: BEDROCK_M, granite: district.granite.map(hex) });
  // Very long cores are shortened so they still fit the shelf.
  let total = out.reduce((s, b) => s + b.len, 0);
  const cap = MAX_BOXES * ROWS_PER_BOX * ROW_M - 0.2;
  if (total > cap) {
    const k = (cap - BEDROCK_M) / (total - BEDROCK_M);
    for (const b of out) if (b.kind !== "bedrock") b.len *= k;
    total = cap;
  }
  let d = 0;
  for (const b of out) { b.d0 = d; d += b.len; b.d1 = d; }
  return { beds: out, length: total, district };
}

// ---------- layout ----------

export function layout(core, opts = {}) {
  const { beds, length, district } = bedsOf(core);
  const boxesNeeded = Math.min(MAX_BOXES, Math.ceil((length + 0.06) / (ROW_M * ROWS_PER_BOX)));
  const boxCount = opts.boxes ? Math.min(opts.boxes, boxesNeeded) : boxesNeeded;
  const ppm = opts.ppm || 1000; // pixels per metre
  const dia = Math.round(DIAMETER_M * ppm);
  const channel = dia + Math.round(dia * 0.16);
  const divider = Math.max(4, Math.round(dia * 0.14));
  const rim = Math.max(10, Math.round(dia * 0.3));
  const labelH = Math.max(18, Math.round(dia * 0.5));
  const endBlock = Math.max(14, Math.round(dia * 0.42));
  const margin = Math.max(12, Math.round(dia * 0.5));
  const header = opts.header === false ? 0 : Math.round(dia * 1.4);
  const rowLen = Math.round(ROW_M * ppm);
  const boxW = rowLen + 2 * endBlock + 2 * rim;
  const boxH = labelH + rim + ROWS_PER_BOX * channel + (ROWS_PER_BOX - 1) * divider + rim;
  const gap = Math.round(dia * 0.6);
  const width = opts.width || boxW + 2 * margin;
  const left = Math.round((width - boxW) / 2);
  let height = margin + header + boxCount * boxH + (boxCount - 1) * gap + margin;
  let top = margin + header;
  if (opts.height) {
    top += Math.round((opts.height - height) / 2);
    height = opts.height;
  }
  const boxes = [];
  for (let b = 0; b < boxCount; b++) {
    const y = top + b * (boxH + gap);
    const rows = [];
    for (let r = 0; r < ROWS_PER_BOX; r++) {
      const ry = y + labelH + rim + r * (channel + divider);
      const d0 = (b * ROWS_PER_BOX + r) * ROW_M;
      rows.push({ y: ry, cy: ry + Math.floor(channel / 2), x0: left + rim + endBlock, x1: left + rim + endBlock + rowLen, d0, d1: d0 + ROW_M });
    }
    boxes.push({ x: left, y, w: boxW, h: boxH, rows, index: b });
  }
  return { width, height, ppm, dia, channel, divider, rim, labelH, endBlock, margin, header, rowLen, boxes, boxesNeeded, beds, length, district, headerTop: margin };
}

// ---------- painting ----------

export function render(core, opts = {}) {
  const L = layout(core, opts);
  const { width: W, height: H } = L;
  const data = new Uint8ClampedArray(W * H * 4);
  const seed = hashString(core.did);
  const detail = opts.detail !== false;

  const put = (x, y, r, g, b) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  };
  const mix = (x, y, c, a) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    data[i] += (c[0] - data[i]) * a;
    data[i + 1] += (c[1] - data[i + 1]) * a;
    data[i + 2] += (c[2] - data[i + 2]) * a;
  };
  const shade = (x, y, k) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    data[i] *= k; data[i + 1] *= k; data[i + 2] *= k;
  };

  // Concrete floor.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = detail ? vnoise(x / 38, y / 38, 11) * 0.6 + vnoise(x / 7, y / 7, 12) * 0.4 : 0.35 + h2(x, y, 12) * 0.3;
      const speck = h2(x, y, 13) < 0.012 ? -18 : 0;
      const v = 132 + (n - 0.5) * 26 + speck;
      put(x, y, v + 2, v, v - 4);
    }
  }

  if (L.header) paintHeader(L, core, put, mix, detail);
  for (const box of L.boxes) paintBox(L, box, core, seed, put, mix, shade, detail);
  // One lamp, up and to the left of the camera.
  const diag = Math.hypot(W, H);
  if (detail) for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = 1.04 - 0.14 * (Math.hypot(x - W * 0.3, y - H * 0.1) / diag);
      const i = (y * W + x) * 4;
      data[i] *= k; data[i + 1] *= k; data[i + 2] *= k;
    }
  }
  return { width: W, height: H, data, layout: L };
}

function paintHeader(L, core, put, mix, detail) {
  const y0 = L.headerTop;
  const h = Math.round(L.dia * 0.7);
  const left = L.boxes[0].x;
  // Scale bar: 50 cm in 10 cm blocks.
  const seg = Math.round(0.1 * L.ppm);
  for (let s = 0; s < 5; s++) {
    const c = s % 2 ? [236, 234, 228] : [24, 24, 24];
    for (let y = 0; y < Math.round(h * 0.32); y++) for (let x = 0; x < seg; x++) put(left + s * seg + x, y0 + y, ...c);
  }
  const scale = Math.max(1, Math.round(L.dia / 32));
  const ty = y0 + Math.round(h * 0.32) + 3 * scale;
  for (let s = 0; s <= 5; s++) {
    const label = String(s * 10);
    drawText(label, left + s * seg - (s ? Math.floor(textWidth(label, scale) / 2) : 0), ty, scale, (x, y) => put(x, y, 24, 24, 24));
  }
  drawText("CM", left + 5 * seg + 6 * scale, ty, scale, (x, y) => put(x, y, 24, 24, 24));
  // Colour card: a grey ramp, then the district's own colours.
  const chip = Math.round(h * 0.55);
  const cardX = left + L.boxes[0].w - 11 * (chip + 2);
  const ramp = [245, 205, 165, 125, 85, 45].map((v) => [v, v, v]);
  const chips = ramp.concat(L.district.beds.map(hex));
  for (let i = 0; i < chips.length; i++) {
    for (let y = 0; y < chip; y++) for (let x = 0; x < chip; x++) put(cardX + i * (chip + 2) + x, y0 + y, ...chips[i]);
  }
}

function wood(x, y, s, base, detail) {
  if (!detail) {
    const k = 0.95 + Math.sin(y * 0.9 + ((x >> 5) & 7)) * 0.04 + (h2(x, y, s) - 0.5) * 0.06;
    return [base[0] * k, base[1] * k, base[2] * k];
  }
  const g = Math.sin(y * 0.55 + vnoise(x / 90, y / 9, s) * 9) * 0.5 + 0.5;
  const k = 0.9 + g * 0.12 + (h2(x, y, s) - 0.5) * 0.05;
  return [base[0] * k, base[1] * k, base[2] * k];
}

function paintBox(L, box, core, seed, put, mix, shade, detail) {
  const WOOD = [150, 114, 76], INSIDE = [92, 70, 47], LIGHT = [184, 150, 108];
  // Drop shadow on the floor.
  for (let y = 0; y < box.h; y++) for (let x = 0; x < 8; x++) shade(box.x + box.w + x, box.y + 6 + y, 0.8 + x * 0.025);
  for (let x = 0; x < box.w; x++) for (let y = 0; y < 8; y++) shade(box.x + 6 + x, box.y + box.h + y, 0.8 + y * 0.025);
  // Frame and floor of the box.
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const gx = box.x + x, gy = box.y + y;
      const edge = x < L.rim || x >= box.w - L.rim || y < L.labelH + L.rim || y >= box.h - L.rim;
      const c = wood(gx, gy, 21 + box.index, edge ? WOOD : INSIDE, detail);
      put(gx, gy, c[0], c[1], c[2]);
    }
  }
  // Label strip, written in marker.
  const lab = box.y + Math.round(L.labelH * 0.25);
  const ts = Math.max(1, Math.round(L.labelH / 14));
  const from = (box.index * ROWS_PER_BOX).toFixed(2), to = ((box.index + 1) * ROWS_PER_BOX).toFixed(2);
  let text = `CORE ${core.n}   @${core.handle}   BOX ${box.index + 1}/${L.boxesNeeded}   ${from}-${to} M`;
  const maxChars = Math.floor((box.w - 2 * L.rim) / (6 * ts));
  if (text.length > maxChars) text = text.slice(0, maxChars);
  drawText(text, box.x + L.rim, lab, ts, (x, y) => put(x, y, 30, 26, 24));
  // Dividers between rows.
  for (let r = 1; r < ROWS_PER_BOX; r++) {
    const dy = box.rows[r].y - L.divider;
    for (let y = 0; y < L.divider; y++) {
      for (let x = L.rim; x < box.w - L.rim; x++) {
        const k = y === 0 ? 1.12 : y === L.divider - 1 ? 0.8 : 1;
        const c = wood(box.x + x, dy + y, 31, LIGHT, detail);
        put(box.x + x, dy + y, c[0] * k, c[1] * k, c[2] * k);
      }
    }
  }
  for (const row of box.rows) paintRow(L, row, core, seed, put, mix, shade, detail, ts);
}

function paintRow(L, row, core, seed, put, mix, shade, detail, ts) {
  const { ppm, dia } = L;
  const R = dia / 2;
  const cy = row.cy;
  const beds = L.beds;
  // Depth markers at both ends of the row.
  const ds = String(row.d0);
  let ms = ts;
  while (ms > 1 && textWidth(ds, ms) > L.endBlock - 4) ms--;
  drawText(ds, row.x0 - L.endBlock + Math.floor((L.endBlock - textWidth(ds, ms)) / 2), cy - Math.floor(3.5 * ms), ms, (px, py) => put(px, py, 236, 232, 222));
  if (row.d0 >= L.length) return; // the hole ended before this row
  // Bed index for each pixel column.
  const n = row.x1 - row.x0;
  const idx = new Int32Array(n);
  let bi = 0;
  while (bi < beds.length - 1 && beds[bi].d1 <= row.d0) bi++;
  for (let x = 0; x < n; x++) {
    const d = row.d0 + (x + 0.5) / ppm;
    while (bi < beds.length - 1 && beds[bi].d1 <= d) bi++;
    idx[x] = d < L.length ? bi : -1;
  }
  // Wavy bed contacts: each scanline reads the bed a pixel or two off.
  // The wave changes every 24 px along the row, so contacts don't all match.
  const chunks = Math.ceil(n / 24) + 1;
  const wob = new Int8Array(chunks * (dia + 1));
  for (let c = 0; c < chunks; c++) {
    for (let y = 0; y <= dia; y++) wob[c * (dia + 1) + y] = Math.round((vnoise(y / 7, c * 1.7 + row.d0 * 3, seed) - 0.5) * 4);
  }
  // Breaks in the core, where the drill or the box cracked it.
  const breaks = [];
  const br = rng(seed ^ hashString("breaks" + row.d0));
  for (let x = Math.floor(80 + br() * 200); x < n - 10; x += Math.floor(90 + br() * 280)) breaks.push({ x, s: Math.floor(br() * 1e6) });

  for (let y = 0; y <= dia; y++) {
    const u = (y - R) / R; // -1 top edge, 1 bottom edge
    if (u < -1 || u > 1) continue;
    const nz = Math.sqrt(1 - u * u);
    const light = 0.42 + 0.58 * Math.max(0, nz * 0.86 - u * 0.4);
    const spec = Math.max(0, 1 - Math.abs(u + 0.35) * 4.5) * 0.08;
    const py = Math.round(cy - R + y);
    for (let x = 0; x < n; x++) {
      let xi = x + wob[((x / 24) | 0) * (dia + 1) + y];
      if (xi < 0) xi = 0; else if (xi >= n) xi = n - 1;
      const b = idx[xi];
      if (b < 0) continue;
      const bed = beds[b];
      const px = row.x0 + x;
      let r, g, bl, k = 1;
      if (bed.kind === "bed") {
        [r, g, bl] = bed.colour;
        const grain = bed.meanChars > 140 ? 3 : bed.meanChars > 60 ? 2 : 1;
        k = bed.tone - bed.replyShare * 0.12 + bed.repostShare * 0.06;
        const along = (row.d0 + (x + 0.5) / ppm - bed.d0) / bed.len;
        k *= 0.94 + along * 0.1;
        k += (h2((px / grain) | 0, (py / grain) | 0, seed) - 0.5) * 0.1;
        if (detail) {
          k += (vnoise(px / 26, py / 18, seed + 1) - 0.5) * 0.08;
          if (bed.replyShare > 0.15) k += Math.sin(px * 1.9 + vnoise(px / 10, py / 30, 5) * 4) * 0.05 * bed.replyShare;
          if (bed.repostShare > 0.08) {
            const t = (px + u * R * (bed.week % 2 ? 1.6 : -1.6)) * 0.45;
            k += ((t - Math.floor(t)) - 0.5) * 0.12 * Math.min(1, bed.repostShare * 2.5);
          }
          if (bed.top && Math.abs(vnoise(px / 9, py / 9, 77) - 0.5) < 0.04) k *= 0.55;
          const likes = bed.counts[C.like];
          if (likes && h2(px, py, seed + 9) < Math.min(0.03, likes / (likes + 120) * 0.03)) k += 0.35 * nz;
        }
      } else if (bed.kind === "bedrock") {
        const cx = Math.floor(px / 2.5 + vnoise(px / 4, py / 4, 3) * 1.6), cyy = Math.floor(py / 2.5 + vnoise(px / 4, py / 4, 8) * 1.6);
        const m = h2(cx, cyy, seed + 2);
        [r, g, bl] = bed.granite[m < 0.6 ? 0 : m < 0.96 ? 1 : 2];
        k = 0.95 + (h2(px, py, 4) - 0.5) * 0.08;
      } else if (bed.kind === "hiatus") {
        r = 40; g = 36; bl = 34;
      } else {
        // Core loss: a spacer block cut from scrap wood.
        [r, g, bl] = wood(px, py, 41, [196, 168, 122], detail);
        k = 1;
      }
      let s = light * k + spec;
      if (bed.kind === "bed" || bed.kind === "bedrock") for (const c of breaks) {
        const jx = c.x + Math.round((vnoise(y / 5, c.s, 6) - 0.5) * 6);
        if (x === jx || x === jx + 1) s *= 0.25;
        else if (x === jx + 2) s *= 0.7;
      }
      put(px, py, r * s, g * s, bl * s);
    }
  }
  // Shadow of the core along the bottom of its channel.
  for (let x = row.x0; x < row.x1; x++) {
    if (idx[x - row.x0] < 0) continue;
    for (let s = 1; s <= 3; s++) shade(x, Math.round(cy + R) + s, 0.62 + s * 0.1);
  }
  paintInclusions(L, row, idx, core, seed, put, mix, ts);
}

// Fossils and other things in the rock, placed bed by bed from the counts.
function paintInclusions(L, row, idx, core, seed, put, mix, ts) {
  const R = L.dia / 2, cy = row.cy;
  const n = idx.length;
  const spans = [];
  for (let x = 0; x < n; ) {
    const b = idx[x];
    let e = x;
    while (e < n && idx[e] === b) e++;
    if (b >= 0) spans.push({ b, x0: x, x1: e });
    x = e;
  }
  for (const sp of spans) {
    const bed = L.beds[sp.b];
    const px0 = row.x0 + sp.x0, px1 = row.x0 + sp.x1;
    const span = px1 - px0;
    if (bed.kind === "loss") {
      const label = `${bed.weeks}W`;
      const tw = textWidth(label, ts);
      if (tw < span - 2) drawText(label, px0 + Math.floor((span - tw) / 2), cy - Math.floor(3.5 * ts), ts, (x, y) => put(x, y, 40, 34, 28));
      continue;
    }
    if (bed.kind !== "bed") continue;
    const w = bed.counts;
    const rand = rng(seed ^ hashString(`${bed.week}:${row.d0}`));
    // Inclusions follow rates, not raw counts, so a busy account gets a
    // longer core rather than a cluttered one.
    const posts = Math.max(1, w[C.post] + w[C.reply] + w[C.quote]);
    const area = (span * L.dia) / 10000;
    const howMany = (count, perArea) => {
      if (!count) return 0;
      const exp = area * perArea * Math.min(1, count / posts);
      const k = Math.floor(exp + rand());
      return Math.min(count, k);
    };
    const inCore = (x, y) => Math.abs(y - cy) < R * 0.86;
    const place = () => [px0 + rand() * span, cy + (rand() * 2 - 1) * R * 0.7];
    const tint = (c, a) => [c[0] + (bed.colour[0] - c[0]) * a, c[1] + (bed.colour[1] - c[1]) * a, c[2] + (bed.colour[2] - c[2]) * a];
    const shell = tint(SHELL, 0.35), shellDark = tint(SHELL_DARK, 0.3);

    // Quote posts: pebbles of other rock.
    for (let i = 0, m = howMany(w[C.quote], 7); i < m; i++) {
      const [x, y] = place();
      const rx = 1.5 + rand() * R * 0.13, ry = rx * (0.55 + rand() * 0.4);
      const col = PEBBLES[Math.floor(rand() * PEBBLES.length)];
      ellipse(x, y, rx, ry, (px, py, e) => inCore(px, py) && mix(px, py, e > 0.8 ? [30, 28, 26] : shadeC(col, 1.08 - (py - y) / (ry * 3)), 0.9));
    }
    // Images: ammonites.
    for (let i = 0, m = howMany(w[C.image], 3.2); i < m; i++) {
      const [x, y] = place();
      const rr = 2.5 + rand() * R * 0.18;
      const turn = rand() * 6.28;
      ellipse(x, y, rr, rr, (px, py, e) => {
        if (!inCore(px, py)) return;
        const dx = px - x, dy = py - y;
        const rad = Math.hypot(dx, dy) + 0.6;
        const th = Math.atan2(dy, dx) + turn;
        const f = Math.log(rad) / 0.55 - th / 6.283;
        const ring = f - Math.floor(f) < 0.22;
        const rib = Math.abs(Math.sin(th * 11)) > 0.93;
        mix(px, py, ring || e > 0.85 ? shellDark : rib ? shadeC(shell, 0.9) : shell, 0.85);
      });
    }
    // Videos: crinoid stems.
    for (let i = 0, m = howMany(w[C.video], 2.5); i < m; i++) {
      let [x, y] = place();
      const ang = rand() * 3.14, step = 2.2 + R * 0.05, rr = 1.6 + R * 0.05;
      for (let k = 0, len = 4 + Math.floor(rand() * 5); k < len; k++) {
        ellipse(x, y, rr, rr, (px, py, e) => inCore(px, py) && mix(px, py, e > 0.7 ? shellDark : shell, 0.8));
        x += Math.cos(ang) * step; y += Math.sin(ang) * step;
      }
    }
    // Links: pyrite cubes.
    for (let i = 0, m = howMany(w[C.link], 5); i < m; i++) {
      const [x, y] = place();
      const s = 2 + Math.floor(rand() * 3);
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
        const px = Math.round(x) + dx, py = Math.round(y) + dy;
        if (!inCore(px, py)) continue;
        const k = dx === 0 || dy === 0 ? 1.35 : dx === s - 1 || dy === s - 1 ? 0.6 : 1;
        put(px, py, ...shadeC(PYRITE, k));
      }
    }
    // Follows: quartz veins that cut across the beds.
    for (let i = 0, m = Math.min(4, Math.floor(Math.log2(1 + w[C.follow]) / 1.6)); i < m; i++) {
      const x = px0 + rand() * span;
      const slope = (rand() * 2 - 1) * 0.9;
      const thick = rand() < 0.3 ? 2 : 1;
      for (let y = Math.ceil(cy - R * 0.86); y < cy + R * 0.86; y++) {
        const vx = Math.round(x + (y - cy) * slope + Math.sin(y * 0.4 + i) * 0.7);
        if (vx < row.x0 || vx >= row.x1) continue;
        for (let t = 0; t < thick; t++) mix(vx + t, y, VEIN, 0.75);
      }
    }
  }
}

function shadeC(c, k) {
  return [c[0] * k, c[1] * k, c[2] * k];
}

// Calls fn(x, y, e) for pixels inside an ellipse; e runs 0 at the centre to 1 at the rim.
function ellipse(cx, cy, rx, ry, fn) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (e <= 1) fn(x, y, Math.sqrt(e));
    }
  }
}

// Which week is under a pixel? Returns the bed, or null.
export function bedAt(L, x, y) {
  for (const box of L.boxes) {
    for (const row of box.rows) {
      if (y < row.y || y > row.y + L.channel || x < row.x0 || x >= row.x1) continue;
      const d = row.d0 + (x - row.x0 + 0.5) / L.ppm;
      return L.beds.find((b) => d >= b.d0 && d < b.d1) || null;
    }
  }
  return null;
}
