// A chord is a root (semitones above the key's tonic, 0-11) and a set of intervals above that root.
// mask is 12 bits; bit (11 - i) is interval i. Interval 0, the root, is always set.
export type Chord = { root: number; mask: number };
export const MAX_CHORDS = 12;

export const maskOf = (a: number[]) => a.reduce((m, i) => m | (1 << (11 - i)), 0);
export const hasIv = (c: Chord, i: number) => (c.mask & (1 << (11 - i))) !== 0;
export function ivs(c: Chord): number[] {
  const o: number[] = [];
  for (let i = 0; i < 12; i++) if (hasIv(c, i)) o.push(i);
  return o;
}

// Chord ID: one hex digit for the root, three for the interval set. 0890 is I major, 7892 is V7.
export const chordId = (c: Chord) => c.root.toString(16) + c.mask.toString(16).padStart(3, '0');
export const progId = (cs: Chord[]) => cs.map(chordId).join('-');
export function parseProg(text: string): Chord[] | null {
  const parts = text.trim().toLowerCase().split('-');
  if (!parts.length || parts.length > MAX_CHORDS) return null;
  const out: Chord[] = [];
  for (const p of parts) {
    if (!/^[0-9ab][89a-f][0-9a-f]{2}$/.test(p)) return null;
    out.push({ root: parseInt(p[0], 16), mask: parseInt(p.slice(1), 16) });
  }
  return out;
}

// [key, roman suffix, absolute suffix, intervals, tier]. Tier 0 triads, 1 sevenths, 2 jazz, 3 other.
type Q = [string, string, string, number[], number];
const QS: Q[] = [
  ['major', '', '', [0, 4, 7], 0],
  ['minor', '', 'm', [0, 3, 7], 0],
  ['diminished', '°', 'dim', [0, 3, 6], 0],
  ['augmented', '+', 'aug', [0, 4, 8], 0],
  ['maj7', 'maj7', 'maj7', [0, 4, 7, 11], 1],
  ['7', '7', '7', [0, 4, 7, 10], 1],
  ['m7', '7', 'm7', [0, 3, 7, 10], 1],
  ['m7♭5', 'ø7', 'm7♭5', [0, 3, 6, 10], 1],
  ['dim7', '°7', 'dim7', [0, 3, 6, 9], 1],
  ['m(maj7)', 'maj7', 'm(maj7)', [0, 3, 7, 11], 1],
  ['6', '6', '6', [0, 4, 7, 9], 2],
  ['m6', '6', 'm6', [0, 3, 7, 9], 2],
  ['maj9', 'maj9', 'maj9', [0, 2, 4, 7, 11], 2],
  ['9', '9', '9', [0, 2, 4, 7, 10], 2],
  ['m9', '9', 'm9', [0, 2, 3, 7, 10], 2],
  ['6/9', '6/9', '6/9', [0, 2, 4, 7, 9], 2],
  ['13', '13', '13', [0, 2, 4, 7, 9, 10], 2],
  ['m11', '11', 'm11', [0, 2, 3, 5, 7, 10], 2],
  ['maj7♯11', 'maj7♯11', 'maj7♯11', [0, 4, 6, 7, 11], 2],
  ['7♯11', '7♯11', '7♯11', [0, 4, 6, 7, 10], 2],
  ['7♭9', '7♭9', '7♭9', [0, 1, 4, 7, 10], 2],
  ['7♯9', '7♯9', '7♯9', [0, 3, 4, 7, 10], 2],
  ['7♭13', '7♭13', '7♭13', [0, 4, 7, 8, 10], 2],
  ['7alt', '7alt', '7alt', [0, 1, 3, 4, 8, 10], 2],
  ['7♯5', '+7', '7♯5', [0, 4, 8, 10], 2],
  ['7sus4', '7sus4', '7sus4', [0, 5, 7, 10], 2],
  ['9sus4', '9sus4', '9sus4', [0, 2, 5, 7, 10], 2],
  ['sus4', 'sus4', 'sus4', [0, 5, 7], 2],
  ['sus2', 'sus2', 'sus2', [0, 2, 7], 2],
  ['add9', 'add9', 'add9', [0, 2, 4, 7], 2],
  ['5', '5', '5', [0, 7], 3],
];
export const QUALITIES = QS.map(([key, rs, as, iv, tier]) => ({ key, rs, as, mask: maskOf(iv), tier }));
const BY_MASK = new Map(QUALITIES.map((q) => [q.mask, q]));

export type VocabId = 'triads' | 'sevenths' | 'jazz' | 'all';
export const VOCABS: { id: VocabId; label: string; help: string }[] = [
  { id: 'triads', label: 'Triads', help: 'Major, minor, diminished and augmented: 48 chords.' },
  { id: 'sevenths', label: 'Seventh chords', help: 'Six seventh-chord types on every root: 72 chords.' },
  { id: 'jazz', label: 'Jazz chords', help: 'Sevenths, sixths, ninths, altered dominants and suspensions: 312 chords.' },
  { id: 'all', label: 'Every chord', help: 'Every set of notes over every root: 24,576 chords.' },
];
const vocabCache: Partial<Record<VocabId, number[]>> = {};
export function vocabMasks(v: VocabId): number[] {
  return (vocabCache[v] ||=
    v === 'all'
      ? Array.from({ length: 2048 }, (_, i) => 0x800 | i)
      : QUALITIES.filter((q) => (v === 'triads' ? q.tier === 0 : v === 'sevenths' ? q.tier === 1 : q.tier === 1 || q.tier === 2)).map((q) => q.mask));
}

// ---------- names ----------
const NUMERAL = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
export const NOTES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const IV_NAMES = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
const loose = (c: Chord) => '[' + ivs(c).slice(1).map((i) => IV_NAMES[i]).join(' ') + ']';
export const degreeName = (root: number, minor = false) => (minor ? NUMERAL[root].toLowerCase() : NUMERAL[root]);
export function romanName(c: Chord): string {
  const q = BY_MASK.get(c.mask);
  return degreeName(c.root, hasIv(c, 3) && !hasIv(c, 4)) + (q ? q.rs : loose(c));
}
export function absName(c: Chord, key: number): string {
  const q = BY_MASK.get(c.mask);
  return NOTES[(key + c.root) % 12] + (q ? q.as : loose(c));
}
export const qualityKey = (c: Chord) => BY_MASK.get(c.mask)?.key ?? '';

// ---------- keys ----------
export type Mode = 'major' | 'minor';
const SCALE: Record<Mode, number[]> = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
export function diatonic(deg: number, size: number, mode: Mode): Chord {
  const s = SCALE[mode];
  const iv: number[] = [];
  for (let k = 0; k < size; k++) iv.push((s[(deg + 2 * k) % 7] - s[deg] + 12) % 12);
  return { root: s[deg], mask: maskOf(iv) };
}
// Scale degree at or just below a root.
function degOf(root: number, mode: Mode): number {
  const s = SCALE[mode];
  let d = 0;
  for (let i = 0; i < 7; i++) if (s[i] <= root) d = i;
  return d;
}

// ---------- rules for choosing the next progression ----------
export type PRule = 'fourths' | 'fifths' | 'fourthsC' | 'fifthsC' | 'diatonic' | 'count' | 'jazz' | 'voice' | 'mutate' | 'rotate' | 'transpose' | 'random';
export const PRULES: { id: PRule; label: string; help: string }[] = [
  { id: 'fourths', label: 'Circle of 4ths, in key', help: 'Slides forward one chord. The new chord sits a fourth above the last and stays in the key.' },
  { id: 'fifths', label: 'Circle of 5ths, in key', help: 'Slides forward one chord. The new chord sits a fifth above the last and stays in the key.' },
  { id: 'fourthsC', label: 'Circle of 4ths, chromatic', help: 'Slides forward one chord. The new chord copies the last one, a perfect fourth higher. Passes all 12 roots.' },
  { id: 'fifthsC', label: 'Circle of 5ths, chromatic', help: 'Slides forward one chord. The new chord copies the last one, a perfect fifth higher. Passes all 12 roots.' },
  { id: 'diatonic', label: 'Count in key', help: 'Steps the last chord up the scale and carries leftward. Visits every in-key progression of this length.' },
  { id: 'count', label: 'Count through vocabulary', help: 'Steps the last chord through every type, then every root, and carries leftward. Visits every progression in the vocabulary.' },
  { id: 'jazz', label: 'Jazz substitution', help: 'Replaces one chord: tritone substitute, secondary dominant, relative chord or an added extension.' },
  { id: 'voice', label: 'Move one voice', help: 'Moves one note of one chord by a semitone, and now and then adds or drops a note. Wanders through every kind of chord.' },
  { id: 'mutate', label: 'Mutate one chord', help: 'Replaces one random chord with another from the vocabulary.' },
  { id: 'rotate', label: 'Rotate', help: 'Starts the same loop from its second chord.' },
  { id: 'transpose', label: 'Transpose', help: 'Moves every chord up a semitone against the key.' },
  { id: 'random', label: 'Random', help: 'Picks every chord at random from the vocabulary.' },
];

export function nextProg(cs: Chord[], rule: PRule, vocab: VocabId, mode: Mode, rnd: () => number = Math.random): Chord[] {
  const n = cs.length;
  const last = cs[n - 1];
  const size = vocab === 'triads' || vocab === 'all' ? 3 : 4;
  const ri = (k: number) => Math.min(k - 1, Math.floor(rnd() * k));
  const masks = vocabMasks(vocab);
  const anyChord = (): Chord => ({ root: ri(12), mask: masks[ri(masks.length)] });
  const withSlot = (i: number, c: Chord) => cs.map((x, j) => (j === i ? c : x));
  switch (rule) {
    case 'fourths':
      return cs.slice(1).concat(diatonic((degOf(last.root, mode) + 3) % 7, size, mode));
    case 'fifths':
      return cs.slice(1).concat(diatonic((degOf(last.root, mode) + 4) % 7, size, mode));
    case 'fourthsC':
      return cs.slice(1).concat({ root: (last.root + 5) % 12, mask: last.mask });
    case 'fifthsC':
      return cs.slice(1).concat({ root: (last.root + 7) % 12, mask: last.mask });
    case 'diatonic': {
      const d = cs.map((c) => degOf(c.root, mode));
      for (let i = n - 1; i >= 0; i--) {
        d[i] = (d[i] + 1) % 7;
        if (d[i] !== 0) break;
      }
      return d.map((x) => diatonic(x, size, mode));
    }
    case 'count': {
      const Q = masks.length;
      const d = cs.map((c) => c.root * Q + Math.max(0, masks.indexOf(c.mask)));
      for (let i = n - 1; i >= 0; i--) {
        d[i] = (d[i] + 1) % (12 * Q);
        if (d[i] !== 0) break;
      }
      return d.map((x) => ({ root: Math.floor(x / Q), mask: masks[x % Q] }));
    }
    case 'jazz': {
      const i = ri(n);
      const c = cs[i];
      const nx = cs[(i + 1) % n];
      const major = hasIv(c, 4);
      const minor = hasIv(c, 3) && !major;
      const seventh = hasIv(c, 10) || hasIv(c, 11);
      const m = (a: number[]) => maskOf(a);
      const opts: Chord[] = [];
      if (major && hasIv(c, 10)) opts.push({ root: (c.root + 6) % 12, mask: c.mask }); // tritone substitute
      if (n > 1) opts.push({ root: (nx.root + 7) % 12, mask: m([0, 4, 7, 10]) }); // V7 of the next chord
      if (major && !hasIv(c, 10)) opts.push({ root: (c.root + 9) % 12, mask: m(seventh ? [0, 3, 7, 10] : [0, 3, 7]) }); // relative minor
      if (minor) opts.push({ root: (c.root + 3) % 12, mask: m(seventh ? [0, 4, 7, 11] : [0, 4, 7]) }); // relative major
      if (!seventh && major) opts.push({ root: c.root, mask: c.mask | m([11]) });
      if (!seventh && minor) opts.push({ root: c.root, mask: c.mask | m([10]) });
      if (seventh && !hasIv(c, 2) && !hasIv(c, 1)) opts.push({ root: c.root, mask: c.mask | m([2]) }); // add the ninth
      if (hasIv(c, 10) && major && hasIv(c, 2) && !hasIv(c, 9)) opts.push({ root: c.root, mask: c.mask | m([9]) }); // 9 to 13
      const real = opts.filter((o) => chordId(o) !== chordId(c));
      return withSlot(i, real.length ? real[ri(real.length)] : { root: ri(12), mask: vocabMasks('jazz')[ri(vocabMasks('jazz').length)] });
    }
    case 'voice': {
      const i = ri(n);
      const c = cs[i];
      const moves: number[] = [];
      for (const t of ivs(c)) {
        if (t === 0) continue;
        for (const to of [t - 1, t + 1]) if (to >= 1 && to <= 11 && !hasIv(c, to)) moves.push((c.mask & ~(1 << (11 - t))) | (1 << (11 - to)));
      }
      // One time in five, add or drop a note instead, so the walk is not stuck at one chord size.
      const count = ivs(c).length;
      if (!moves.length || rnd() < 0.2) {
        const flips: number[] = [];
        for (let t = 1; t <= 11; t++) if (hasIv(c, t) ? count > 2 : count < 7) flips.push(c.mask ^ (1 << (11 - t)));
        return withSlot(i, { root: c.root, mask: flips[ri(flips.length)] });
      }
      return withSlot(i, { root: c.root, mask: moves[ri(moves.length)] });
    }
    case 'mutate':
      return withSlot(ri(n), anyChord());
    case 'rotate':
      return cs.slice(1).concat(cs[0]);
    case 'transpose':
      return cs.map((c) => ({ root: (c.root + 1) % 12, mask: c.mask }));
    case 'random':
      return cs.map(anyChord);
  }
}

// ---------- voicing ----------
// inv: -1 picks the inversion that moves least from the previous chord; 0 is root position, 1-3 the inversions.
// dens: 0 plays the chord as written; 2-6 sets the number of notes, dropping or doubling chord tones.
export function voiceChord(c: Chord, key: number, inv: number, dens: number, prev: number[] | null): number[] {
  let t = ivs(c);
  if (dens > 0 && dens < t.length) {
    const third = t.includes(3) || t.includes(4);
    const rank = (i: number) => (i === 3 || i === 4 || (!third && (i === 2 || i === 5)) ? 0 : i === 0 ? 1 : i === 10 || i === 11 ? 2 : i === 7 ? 5 : 3);
    t = t
      .slice()
      .sort((a, b) => rank(a) - rank(b) || a - b)
      .slice(0, dens)
      .sort((a, b) => a - b);
  }
  const pcs = t.map((i) => (key + c.root + i) % 12);
  const up = (from: number, pc: number) => from + ((((pc - from) % 12) + 12) % 12);
  const build = (k: number, lo: number) => {
    const out = [up(lo, pcs[k])];
    for (let j = 1; j < pcs.length; j++) out.push(up(out[j - 1] + 1, pcs[(k + j) % pcs.length]));
    return out;
  };
  let best = build(Math.min(Math.max(inv, 0), pcs.length - 1), 48);
  if (inv < 0) {
    let bc = Infinity;
    for (let k = 0; k < pcs.length; k++) {
      for (const lo of [44, 50, 56]) {
        const v = build(k, lo);
        let cost = 0.25 * Math.abs(v.reduce((a, b) => a + b, 0) / v.length - 58);
        if (prev && prev.length) for (const x of v) cost += Math.min(...prev.map((p) => Math.abs(p - x))) / v.length;
        if (cost < bc - 1e-9) {
          bc = cost;
          best = v;
        }
      }
    }
  }
  const out = best.slice();
  for (let j = 0; out.length < dens && j < 12 && out[j] + 12 <= 84; j++) out.push(out[j] + 12);
  return out;
}

const voiceCache = new Map<string, number[][]>();
export function voiceProg(cs: Chord[], key: number, inv: number, dens: number): number[][] {
  const k = `${progId(cs)}|${key}|${inv}|${dens}`;
  let v = voiceCache.get(k);
  if (!v) {
    v = [];
    let prev: number[] | null = null;
    for (const c of cs) {
      prev = voiceChord(c, key, inv, dens, prev);
      v.push(prev);
    }
    if (voiceCache.size > 500) voiceCache.clear();
    voiceCache.set(k, v);
  }
  return v;
}

export const INVERSIONS = [
  { v: -1, l: 'Smooth' },
  { v: 0, l: 'Root' },
  { v: 1, l: '1st' },
  { v: 2, l: '2nd' },
  { v: 3, l: '3rd' },
];
export const DENSITIES = [
  { v: 0, l: 'As written' },
  { v: 2, l: '2' },
  { v: 3, l: '3' },
  { v: 4, l: '4' },
  { v: 5, l: '5' },
  { v: 6, l: '6' },
];
