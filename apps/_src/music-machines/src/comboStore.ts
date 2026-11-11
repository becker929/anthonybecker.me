import { getStep, parse } from './rhythm';
import { parseProg, voiceProg } from './chords';
import { RItem, PItem, mkR, mkP } from './sets';
import { ChordSynth } from './synth';
import { Engine, SOUNDS } from './audio';
import { EMPHASIS, EmphId } from './rhythm';
import { Loop, makeStore, loadSaved } from './machine';

export interface Pair { r: RItem; p: PItem; id: string; src: string; hearts: number }
export type XRule = 'all' | 'rhythm' | 'chords' | 'both' | 'unheard' | 'hearts';
export const XRULES: { id: XRule; label: string; help: string }[] = [
  { id: 'hearts', label: 'Random, favoring hearts', help: 'Picks any pair. A pair gets more turns for each heart on its rhythm, its progression and the pair itself.' },
  { id: 'unheard', label: 'Unheard pairs, favoring hearts', help: 'Picks only pairs not in the history yet, most-hearted sides first in the draw, until none are left.' },
  { id: 'all', label: 'Every pair, most hearts first', help: 'Walks every pair once, from the most-hearted combination down to the least.' },
  { id: 'rhythm', label: 'Next rhythm, same chords', help: 'Holds the progression and steps down the rhythm list.' },
  { id: 'chords', label: 'Next chords, same rhythm', help: 'Holds the rhythm and steps down the progression list.' },
  { id: 'both', label: 'Step both', help: 'Moves to the next rhythm and the next progression together.' },
];
export interface XState {
  rhythms: RItem[];
  progs: PItem[];
  rEx: boolean; // still the built-in examples
  pEx: boolean;
  history: Pair[];
  hv: number;
  cur: number;
  playing: boolean;
  bpm: number;
  key: number;
  rule: XRule;
  repeat: number;
  spc: number; // steps per chord; 0 = one rhythm loop per chord
  voice: number;
  drum: number; // -1 = no drum layer
  loop: number;
  step: number;
}
const KEY = 'pairing-machine-v1';
const mkPair = (r: RItem, p: PItem, src: string, hearts = 0): Pair => ({ r, p, id: r.id + '/' + p.id, src, hearts });
const emphOk = (e: any): EmphId => (EMPHASIS.some((x) => x.id === e) ? e : 'none');

const exR = ([['16.9228', 'none', 2], ['16.8888', 'back', 1], ['16.9292', 'tresillo', 3], ['16.2222', 'off8', 1]] as [string, EmphId, number][]).map(([id, e, h]) => mkR(parse(id)!, e, h));
const exP = ([['0891-9912-2912-7892', 2], ['2912-7892-0891-0891', 3], ['0890-7890-9910-5890', 1], ['9912-5891-0891-7892', 1]] as [string, number][]).map(([id, h]) => mkP(parseProg(id)!, -1, 0, h));
const init: XState = {
  rhythms: exR, progs: exP, rEx: true, pEx: true, history: [mkPair(exR[0], exP[0], 'Example')],
  hv: 0, cur: 0, playing: false, bpm: 100, key: 0, rule: 'hearts', repeat: 2, spc: 16, voice: 1, drum: -1, loop: 0, step: -1,
};
const sv = loadSaved(KEY);
if (sv) {
  try {
    const rd = (a: any): RItem | null => {
      const r = parse(String(a[0]));
      return r ? mkR(r, emphOk(a[1]), a[2] | 0) : null;
    };
    const pd = (a: any): PItem | null => {
      const c = parseProg(String(a[0]));
      return c ? mkP(c, a[1] | 0, a[2] | 0, a[3] | 0) : null;
    };
    const R = (sv.R as any[]).map(rd).filter(Boolean) as RItem[];
    const P = (sv.P as any[]).map(pd).filter(Boolean) as PItem[];
    const H: Pair[] = [];
    for (const [ra, pa, src, hearts] of sv.h as any[]) {
      const r = rd(ra);
      const p = pd(pa);
      if (r && p) H.push(mkPair(r, p, String(src), hearts | 0));
    }
    if (R.length && P.length && H.length) {
      Object.assign(init, { rhythms: R, progs: P, rEx: !!sv.rEx, pEx: !!sv.pEx, history: H, cur: Math.max(0, Math.min(H.length - 1, sv.cur | 0)) });
      if (sv.bpm >= 30 && sv.bpm <= 300) init.bpm = sv.bpm;
      if (sv.key >= 0 && sv.key < 12) init.key = sv.key | 0;
      if (XRULES.some((r) => r.id === sv.rule)) init.rule = sv.rule;
      if (sv.repeat >= 0 && sv.repeat <= 999) init.repeat = sv.repeat | 0;
      if ([0, 4, 8, 16, 32].includes(sv.spc)) init.spc = sv.spc;
      if (sv.voice >= 0 && sv.voice <= 2) init.voice = sv.voice | 0;
      if (sv.drum >= -1 && sv.drum < SOUNDS.length) init.drum = sv.drum | 0;
    }
  } catch {}
}
const rs = (r: RItem) => [r.id, r.emph, r.hearts];
const ps = (p: PItem) => [p.id, p.inv, p.dens, p.hearts];
const st = makeStore(init, KEY, (s) => {
  const from = Math.max(0, s.history.length - 300);
  return { R: s.rhythms.map(rs), P: s.progs.map(ps), rEx: s.rEx, pEx: s.pEx, h: s.history.slice(from).map((e) => [rs(e.r), ps(e.p), e.src, e.hearts]), cur: Math.max(0, s.cur - from), bpm: s.bpm, key: s.key, rule: s.rule, repeat: s.repeat, spc: s.spc, voice: s.voice, drum: s.drum };
});
export const subscribe = st.subscribe;
export const getState = st.get;

const synth = new ChordSynth();
const drums = new Engine();
const cur = () => st.s.history[st.s.cur];
export const stepsPerChord = (e: Pair, spc: number) => spc || e.r.r.len;
export const accentAt = (r: RItem, i: number) => ((r.mask >> BigInt(r.r.len - 1 - i)) & 1n) === 1n;

function append(r: RItem, p: PItem, src: string) {
  st.s.history.push(mkPair(r, p, src));
  if (st.s.history.length > 1000) st.s.history.shift();
  st.s.cur = st.s.history.length - 1;
  st.s.hv++;
}
// The Next Track event. The rule is read now, never queued ahead.
// A pair's weight grows with the hearts on its rhythm, on its progression and on the pair itself.
function advance() {
  const { rhythms: R, progs: P, rule } = st.s;
  const c = cur();
  const PL = P.length;
  const rIdx = new Map(R.map((x, i) => [x.id, i]));
  const pIdx = new Map(P.map((x, i) => [x.id, i]));
  const heard = new Set<number>();
  const pairHearts = new Map<number, number>();
  for (const h of st.s.history) {
    const i = rIdx.get(h.r.id);
    const j = pIdx.get(h.p.id);
    if (i === undefined || j === undefined) continue;
    heard.add(i * PL + j);
    if (h.hearts) pairHearts.set(i * PL + j, (pairHearts.get(i * PL + j) || 0) + h.hearts);
  }
  const weight = (i: number, j: number) => (R[i].hearts + 1) * (P[j].hearts + 1) * ((pairHearts.get(i * PL + j) || 0) + 1);
  const ci = rIdx.get(c.r.id);
  const cj = pIdx.get(c.p.id);
  let ri = ci ?? -1;
  let pi = cj ?? -1;
  const draw = (skipHeard: boolean) => {
    let total = 0;
    let pick = -1;
    for (let i = 0; i < R.length; i++)
      for (let j = 0; j < PL; j++) {
        if (skipHeard && heard.has(i * PL + j)) continue;
        const w = weight(i, j);
        total += w;
        if (Math.random() * total < w) pick = i * PL + j;
      }
    return pick;
  };
  if (rule === 'rhythm') ri = (ri + 1) % R.length;
  else if (rule === 'chords') pi = (pi + 1) % PL;
  else if (rule === 'both') {
    ri = (ri + 1) % R.length;
    pi = (pi + 1) % PL;
  } else if (rule === 'all') {
    // Order: weight descending, then list position. Find the pair that follows the current one.
    const cw = ci !== undefined && cj !== undefined ? weight(ci, cj) : Infinity;
    const ck = ci !== undefined && cj !== undefined ? ci * PL + cj : -1;
    let best = -1, bw = -1, first = -1, fw = -1;
    for (let i = 0; i < R.length; i++)
      for (let j = 0; j < PL; j++) {
        const w = weight(i, j);
        const k = i * PL + j;
        if (w > fw) (fw = w), (first = k);
        if ((w < cw || (w === cw && k > ck)) && w > bw) (bw = w), (best = k);
      }
    const k = best >= 0 ? best : first;
    ri = Math.floor(k / PL);
    pi = k % PL;
  } else {
    let k = draw(rule === 'unheard');
    if (k < 0) k = draw(false);
    ri = Math.floor(k / PL);
    pi = k % PL;
  }
  append(R[Math.max(0, ri)], P[Math.max(0, pi)], XRULES.find((x) => x.id === rule)!.label);
  st.s.loop = 0;
}

const loop = new Loop({
  stepDur: () => 60 / st.s.bpm / 4,
  len: () => cur().p.chords.length * stepsPerChord(cur(), st.s.spc),
  onStep(pos, time) {
    const e = cur();
    const rp = pos % e.r.r.len;
    if (!getStep(e.r.r, rp)) return;
    const flat = e.r.mask === 0n;
    const acc = flat || accentAt(e.r, rp);
    const ci = Math.min(e.p.chords.length - 1, Math.floor(pos / stepsPerChord(e, st.s.spc)));
    synth.strike(voiceProg(e.p.chords, st.s.key, e.p.inv, e.p.dens)[ci], time, flat ? 0.8 : acc ? 1 : 0.42, st.s.voice);
    if (st.s.drum >= 0) drums.trigger(st.s.drum, time, acc);
  },
  onWrap() {
    st.s.loop++;
    if (st.s.repeat > 0 && st.s.loop >= st.s.repeat) advance();
    st.emit();
  },
  onShow(step) {
    if (step !== st.s.step) {
      st.s.step = step;
      st.emit();
    }
  },
  onStop: (t) => synth.release(t + 0.05),
  trackKey: () => st.s.cur,
});
function restart() {
  st.s.loop = 0;
  loop.restart();
}

export const actions = {
  toggle() {
    if (st.s.playing) {
      st.s.playing = false;
      st.s.step = -1;
      loop.stop();
    } else {
      drums.ensure();
      st.s.playing = true;
      st.s.loop = 0;
      loop.start();
    }
    st.emit();
  },
  next() {
    advance();
    restart();
    st.emit();
  },
  back: () => actions.jump(st.s.cur - 1),
  jump(i: number) {
    if (i < 0 || i >= st.s.history.length || i === st.s.cur) return;
    st.s.cur = i;
    restart();
    st.emit();
  },
  // Choosing an item by hand pairs it with the other side of the current pair.
  pick(r: RItem | null, p: PItem | null) {
    append(r || cur().r, p || cur().p, 'Pick');
    restart();
    st.emit();
  },
  loadRhythms(items: RItem[]) {
    st.s.rhythms = items;
    st.s.rEx = false;
    actions.pick(items[0], null);
  },
  loadProgs(items: PItem[]) {
    st.s.progs = items;
    st.s.pEx = false;
    actions.pick(null, items[0]);
  },
  addRhythm(r: RItem) {
    st.s.rhythms = st.s.rEx ? [r] : st.s.rhythms.filter((x) => x.id !== r.id).concat(r);
    st.s.rEx = false;
    actions.pick(r, null);
  },
  addProg(p: PItem) {
    st.s.progs = st.s.pEx ? [p] : st.s.progs.filter((x) => x.id !== p.id).concat(p);
    st.s.pEx = false;
    actions.pick(null, p);
  },
  heart(d: number) {
    const e = cur();
    st.s.history[st.s.cur] = { ...e, hearts: Math.max(0, e.hearts + d) };
    st.s.hv++;
    st.emit();
  },
  set(patch: Partial<Pick<XState, 'bpm' | 'key' | 'rule' | 'repeat' | 'spc' | 'voice' | 'drum'>>) {
    Object.assign(st.s, patch);
    st.s.bpm = Math.max(30, Math.min(300, Math.round(st.s.bpm)));
    if (st.s.drum >= 0) drums.ensure();
    st.emit();
  },
};
