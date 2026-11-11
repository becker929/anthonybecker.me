// A rhythm is `len` sixteenth-note steps. Step i is an onset when bit (len-1-i) of v is set,
// so the pattern reads left to right as a binary number.
export type Rhythm = { len: number; v: bigint };
export const MAX_LEN = 128;

export const full = (len: number) => (1n << BigInt(len)) - 1n;
export const getStep = (r: Rhythm, i: number) => ((r.v >> BigInt(r.len - 1 - i)) & 1n) === 1n;
export const toggleStep = (r: Rhythm, i: number): Rhythm => ({ len: r.len, v: r.v ^ (1n << BigInt(r.len - 1 - i)) });
export function onsets(r: Rhythm): number {
  let n = 0;
  for (let x = r.v; x > 0n; x >>= 1n) if (x & 1n) n++;
  return n;
}
export function resize(r: Rhythm, len: number): Rhythm {
  len = Math.max(1, Math.min(MAX_LEN, Math.round(len)));
  if (len === r.len) return r;
  return len < r.len ? { len, v: r.v >> BigInt(r.len - len) } : { len, v: r.v << BigInt(len - r.len) };
}

// ID = "<steps>.<hex>". Bits are left-aligned into hex digits, so 16.8888 is four on the floor.
export function toId(r: Rhythm): string {
  const digits = Math.ceil(r.len / 4);
  const pad = digits * 4 - r.len;
  return r.len + '.' + (r.v << BigInt(pad)).toString(16).padStart(digits, '0');
}

export function parse(text: string): Rhythm | null {
  const s = text.trim();
  const m = /^(\d{1,3})[.:]([0-9a-fA-F]+)$/.exec(s);
  if (m) {
    const len = parseInt(m[1], 10);
    if (len < 1 || len > MAX_LEN) return null;
    const digits = Math.ceil(len / 4);
    if (m[2].length !== digits) return null;
    const pad = BigInt(digits * 4 - len);
    const raw = BigInt('0x' + m[2]);
    if (raw & ((1n << pad) - 1n)) return null;
    return { len, v: raw >> pad };
  }
  const p = s.replace(/[\s|]/g, '');
  if (!p || p.length > MAX_LEN || !/^[xX1*.\-0_]+$/.test(p)) return null;
  let v = 0n;
  for (const c of p) v = (v << 1n) | ('xX1*'.includes(c) ? 1n : 0n);
  return { len: p.length, v };
}

// ---------- rules for choosing the next rhythm ----------
export type RuleId = 'count' | 'gray' | 'density' | 'necklace' | 'rotate' | 'euclid' | 'mutate' | 'random';
export const RULES: { id: RuleId; label: string; help: string }[] = [
  { id: 'density', label: 'Same density', help: 'Keeps the onset count. Visits every placement of those onsets.' },
  { id: 'count', label: 'Count up', help: 'Adds one in binary. Visits every pattern of this length in order.' },
  { id: 'gray', label: 'Gray code', help: 'Flips exactly one step each time. Visits every pattern of this length.' },
  { id: 'necklace', label: 'Necklaces', help: 'Skips rotations of rhythms already visited. Runs from dense to sparse.' },
  { id: 'rotate', label: 'Rotate', help: 'Shifts every onset one step later.' },
  { id: 'euclid', label: 'Euclidean', help: 'Adds one onset, then spreads all onsets evenly.' },
  { id: 'mutate', label: 'Mutate', help: 'Flips one random step.' },
  { id: 'random', label: 'Random', help: 'Picks any pattern of this length.' },
];

function nextNecklace(a: number[]): number[] {
  const n = a.length;
  // canonical form: lexicographically smallest rotation
  let best = a;
  for (let s = 1; s < n; s++) {
    const rot = a.slice(s).concat(a.slice(0, s));
    for (let i = 0; i < n; i++) {
      if (rot[i] !== best[i]) {
        if (rot[i] < best[i]) best = rot;
        break;
      }
    }
  }
  const w = best.slice();
  for (;;) {
    let i = n - 1;
    while (i >= 0 && w[i] === 1) i--;
    if (i < 0) return new Array(n).fill(0);
    w[i] = 1;
    const p = i + 1;
    for (let j = p; j < n; j++) w[j] = w[j - p];
    if (n % p === 0) return w;
  }
}

export function euclid(k: number, len: number): Rhythm {
  let v = 0n;
  for (let i = 0; i < len; i++) v = (v << 1n) | ((i * k) % len < k ? 1n : 0n);
  return { len, v };
}

export function nextRhythm(r: Rhythm, rule: RuleId, rnd: () => number = Math.random): Rhythm {
  const { len, v } = r;
  const L = BigInt(len);
  const all = full(len);
  switch (rule) {
    case 'count':
      return { len, v: (v + 1n) & all };
    case 'gray': {
      let b = v;
      for (let s = 1n; s < L; s <<= 1n) b ^= b >> s;
      b = (b + 1n) & all;
      return { len, v: b ^ (b >> 1n) };
    }
    case 'density': {
      if (v === 0n || v === all) return r;
      const c = v & -v;
      const up = v + c;
      const nx = (((up ^ v) >> 2n) / c) | up;
      return { len, v: nx > all ? (1n << BigInt(onsets(r))) - 1n : nx };
    }
    case 'necklace': {
      // onset = symbol 0, so each representative starts on an onset
      const a: number[] = [];
      for (let i = 0; i < len; i++) a.push(getStep(r, i) ? 0 : 1);
      let nv = 0n;
      for (const x of nextNecklace(a)) nv = (nv << 1n) | (x ? 0n : 1n);
      return { len, v: nv };
    }
    case 'rotate':
      return { len, v: (v >> 1n) | ((v & 1n) << (L - 1n)) };
    case 'euclid':
      return euclid((onsets(r) + 1) % (len + 1), len);
    case 'mutate':
      return toggleStep(r, Math.min(len - 1, Math.floor(rnd() * len)));
    case 'random': {
      let nv = 0n;
      for (let i = 0; i < len; i++) nv = (nv << 1n) | (rnd() < 0.5 ? 1n : 0n);
      return { len, v: nv };
    }
  }
}

// ---------- emphasis layer ----------
// A fixed map of emphasized steps, laid over the onsets. A bar is 16 steps.
// An emphasized step with no onset stays silent.
export type EmphId = 'none' | 'down' | 'half' | 'beat' | 'back' | 'off8' | 'off16' | 'antic' | 'tresillo' | 'clave';
export const EMPHASIS: { id: EmphId; label: string; help: string; bar: number[] }[] = [
  { id: 'none', label: 'None', help: 'Every onset plays at the same level.', bar: [] },
  { id: 'down', label: 'Downbeat', help: 'The first step of each bar.', bar: [0] },
  { id: 'half', label: 'Beats 1 and 3', help: 'The two strong beats of each bar.', bar: [0, 8] },
  { id: 'beat', label: 'Every beat', help: 'All four quarter-note beats.', bar: [0, 4, 8, 12] },
  { id: 'back', label: 'Backbeat', help: 'Beats 2 and 4.', bar: [4, 12] },
  { id: 'off8', label: 'Offbeat eighths', help: 'The "and" halfway between beats.', bar: [2, 6, 10, 14] },
  { id: 'off16', label: 'Offbeat sixteenths', help: 'The "e" and "a" around each eighth.', bar: [1, 3, 5, 7, 9, 11, 13, 15] },
  { id: 'antic', label: 'Anticipation', help: 'The sixteenth just before each beat.', bar: [3, 7, 11, 15] },
  { id: 'tresillo', label: 'Tresillo 3-3-2', help: 'Groups of 3, 3 and 2 steps, twice a bar.', bar: [0, 3, 6, 8, 11, 14] },
  { id: 'clave', label: 'Son clave', help: 'The 3-2 son clave across each bar.', bar: [0, 3, 6, 10, 12] },
];
export function emphasisMask(id: EmphId, len: number): bigint {
  const bar = (EMPHASIS.find((e) => e.id === id) || EMPHASIS[0]).bar;
  let v = 0n;
  for (let i = 0; i < len; i++) v = (v << 1n) | (bar.includes(i % 16) ? 1n : 0n);
  return v;
}

// ---------- MIDI (format 0, 480 PPQ, channel 10, one 16th = 120 ticks) ----------
export const PPQ = 480;
export const STEP = PPQ / 4;

function vlq(n: number): number[] {
  const out = [n & 0x7f];
  while ((n >>= 7) > 0) out.unshift((n & 0x7f) | 0x80);
  return out;
}
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0) & 0x7f);

export interface MidiItem {
  r: Rhythm;
  mask: bigint; // emphasis map, same bit order as the rhythm
  tag?: string; // extra marker text, such as hearts
}

// map = false: onsets, velocity 120 where emphasized and 60 elsewhere (100 throughout with no emphasis).
// map = true: one note on every emphasized step, whether or not it holds an onset.
export function writeMidi(items: MidiItem[], bpm: number, note: number, map: boolean, title: string): Uint8Array {
  const ev: number[] = [];
  const us = Math.round(60000000 / bpm);
  ev.push(0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255);
  ev.push(0, 0xff, 0x58, 4, 4, 2, 24, 8);
  const name = ascii(title);
  ev.push(0, 0xff, 0x03, ...vlq(name.length), ...name);
  let last = 0; // tick of the last event written
  let base = 0;
  for (const { r, mask, tag } of items) {
    const id = ascii(toId(r) + (tag ? ' ' + tag : ''));
    ev.push(...vlq(base - last), 0xff, 0x06, ...vlq(id.length), ...id);
    last = base;
    for (let i = 0; i < r.len; i++) {
      const em = ((mask >> BigInt(r.len - 1 - i)) & 1n) === 1n;
      if (map ? !em : !getStep(r, i)) continue;
      const t = base + i * STEP;
      ev.push(...vlq(t - last), 0x99, note, map || mask === 0n ? 100 : em ? 120 : 60);
      ev.push(...vlq(STEP / 2), 0x89, note, 0);
      last = t + STEP / 2;
    }
    base += r.len * STEP;
  }
  ev.push(...vlq(base - last), 0xff, 0x2f, 0);
  const n = ev.length;
  return new Uint8Array([
    ...ascii('MThd'), 0, 0, 0, 6, 0, 0, 0, 1, PPQ >> 8, PPQ & 255,
    ...ascii('MTrk'), (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255,
    ...ev,
  ]);
}

// Reads note-ons from any MIDI file and snaps them to the 16th grid.
export function parseMidi(d: Uint8Array): Rhythm | null {
  const u32 = (o: number) => ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;
  if (d.length < 14 || String.fromCharCode(d[0], d[1], d[2], d[3]) !== 'MThd') return null;
  const div = (d[12] << 8) | d[13];
  if (div & 0x8000 || div === 0) return null;
  const ticks: number[] = [];
  let end = 0;
  let o = 8 + u32(4);
  while (o + 8 <= d.length) {
    const size = u32(o + 4);
    const isTrack = String.fromCharCode(d[o], d[o + 1], d[o + 2], d[o + 3]) === 'MTrk';
    let p = o + 8;
    const stop = Math.min(d.length, p + size);
    o = stop;
    if (!isTrack) continue;
    let t = 0;
    let status = 0;
    while (p < stop) {
      let dt = 0;
      for (;;) {
        const b = d[p++];
        dt = (dt << 7) | (b & 0x7f);
        if (!(b & 0x80) || p >= stop) break;
      }
      t += dt;
      let b = d[p];
      if (b === 0xff) {
        const type = d[p + 1];
        p += 2;
        let l = 0;
        for (;;) {
          const x = d[p++];
          l = (l << 7) | (x & 0x7f);
          if (!(x & 0x80)) break;
        }
        p += l;
        if (type === 0x2f) end = Math.max(end, t);
      } else if (b === 0xf0 || b === 0xf7) {
        p++;
        let l = 0;
        for (;;) {
          const x = d[p++];
          l = (l << 7) | (x & 0x7f);
          if (!(x & 0x80)) break;
        }
        p += l;
      } else {
        if (b & 0x80) {
          status = b;
          p++;
        }
        const hi = status & 0xf0;
        const d1 = d[p++];
        const d2 = hi === 0xc0 || hi === 0xd0 ? 0 : d[p++];
        void d1;
        if (hi === 0x90 && d2 > 0) ticks.push(t);
      }
    }
    end = Math.max(end, t);
  }
  const per = div / 4;
  const steps = ticks.map((t) => Math.round(t / per));
  let len = Math.round(end / per);
  for (const s of steps) len = Math.max(len, s + 1);
  len = Math.max(1, Math.min(MAX_LEN, len));
  let v = 0n;
  for (const s of steps) if (s < len) v |= 1n << BigInt(len - 1 - s);
  return { len, v };
}

// ---------- ZIP (stored, single file) ----------
let crcTable: Uint32Array | null = null;
function crc32(d: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = crcTable[(c ^ d[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const le16 = (n: number) => [n & 255, (n >> 8) & 255];
  const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const parts: (number[] | Uint8Array)[] = [];
  const central: number[] = [];
  let off = 0;
  for (const f of files) {
    const nm = ascii(f.name);
    const common = [...le16(20), ...le16(0), ...le16(0), ...le16(0), ...le16(0x21), ...le32(crc32(f.data)), ...le32(f.data.length), ...le32(f.data.length), ...le16(nm.length), ...le16(0)];
    const local = [0x50, 0x4b, 3, 4, ...common, ...nm];
    central.push(0x50, 0x4b, 1, 2, ...le16(20), ...common, ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(off), ...nm);
    parts.push(local, f.data);
    off += local.length + f.data.length;
  }
  parts.push(central, [0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...le16(files.length), ...le16(files.length), ...le32(central.length), ...le32(off), ...le16(0)]);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// Pulls the first uncompressed file out of a zip (the kind this tool writes).
export function unzipStored(d: Uint8Array): Uint8Array | null {
  if (d.length < 30 || d[0] !== 0x50 || d[1] !== 0x4b || d[2] !== 3 || d[3] !== 4) return null;
  const le16 = (o: number) => d[o] | (d[o + 1] << 8);
  const le32 = (o: number) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
  if (le16(8) !== 0) return null;
  const start = 30 + le16(26) + le16(28);
  return d.slice(start, start + le32(18));
}

// Every uncompressed file in a zip.
export function unzipAll(d: Uint8Array): { name: string; data: Uint8Array }[] {
  const le16 = (o: number) => d[o] | (d[o + 1] << 8);
  const le32 = (o: number) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;
  const out: { name: string; data: Uint8Array }[] = [];
  let o = 0;
  while (o + 30 <= d.length && d[o] === 0x50 && d[o + 1] === 0x4b && d[o + 2] === 3 && d[o + 3] === 4) {
    const size = le32(o + 18);
    const nl = le16(o + 26);
    const start = o + 30 + nl + le16(o + 28);
    if (le16(o + 8) !== 0) break;
    out.push({ name: String.fromCharCode(...d.slice(o + 30, o + 30 + nl)), data: d.slice(start, start + size) });
    o = start + size;
  }
  return out;
}

// General MIDI writer for pitched and layered exports. Times are in ticks at 480 per quarter note.
export interface MNote { t: number; d: number; ch: number; n: number; v: number }
export function midiFile(notes: MNote[], markers: { t: number; text: string }[], bpm: number, title: string, end: number): Uint8Array {
  const plain = (x: string) => ascii(x.replace(/\u266d/g, 'b').replace(/\u266f/g, '#').replace(/\u00b0/g, 'dim').replace(/\u00f87/g, 'm7b5').replace(/[^\x20-\x7e]/g, '?'));
  const evs: { t: number; o: number; b: number[] }[] = [];
  for (const m of markers) {
    const x = plain(m.text);
    evs.push({ t: m.t, o: 1, b: [0xff, 0x06, ...vlq(x.length), ...x] });
  }
  for (const n of notes) {
    evs.push({ t: n.t, o: 2, b: [0x90 | n.ch, n.n, n.v] });
    evs.push({ t: n.t + Math.max(1, n.d), o: 0, b: [0x80 | n.ch, n.n, 0] });
  }
  evs.sort((a, b) => a.t - b.t || a.o - b.o);
  const us = Math.round(60000000 / bpm);
  const name = plain(title);
  const ev: number[] = [0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255, 0, 0xff, 0x58, 4, 4, 2, 24, 8, 0, 0xff, 0x03, ...vlq(name.length), ...name];
  let last = 0;
  for (const e of evs) {
    ev.push(...vlq(e.t - last), ...e.b);
    last = e.t;
  }
  ev.push(...vlq(Math.max(0, end - last)), 0xff, 0x2f, 0);
  const n = ev.length;
  const out = new Uint8Array(22 + n);
  out.set([...ascii('MThd'), 0, 0, 0, 6, 0, 0, 0, 1, PPQ >> 8, PPQ & 255, ...ascii('MTrk'), (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  out.set(ev, 22);
  return out;
}
