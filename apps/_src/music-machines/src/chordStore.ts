import { Chord, PRule, PRULES, VocabId, VOCABS, Mode, nextProg, progId, parseProg, voiceProg, voiceChord, MAX_CHORDS } from './chords';
import { ChordSynth } from './synth';
import { audioCtx } from './audio';
import { Loop, makeStore, loadSaved } from './machine';

export interface PEntry { chords: Chord[]; id: string; src: string; hearts: number; inv: number; dens: number }
export interface CState {
  history: PEntry[];
  hv: number;
  cur: number;
  playing: boolean;
  bpm: number;
  key: number;
  mode: Mode;
  rule: PRule;
  vocab: VocabId;
  repeat: number;
  beats: number; // beats per chord
  voice: number;
  loop: number;
  step: number;
}
const KEY = 'cadence-machine-v1';
const mk = (chords: Chord[], src: string, inv: number, dens: number, hearts = 0): PEntry => ({ chords, id: progId(chords), src, hearts, inv, dens });

const init: CState = {
  history: [mk(parseProg('0891-9912-2912-7892')!, 'Seed', -1, 0)],
  hv: 0, cur: 0, playing: false, bpm: 96, key: 0, mode: 'major', rule: 'fourths', vocab: 'sevenths', repeat: 2, beats: 4, voice: 0, loop: 0, step: -1,
};
const sv = loadSaved(KEY);
if (sv && Array.isArray(sv.h)) {
  const h: PEntry[] = [];
  for (const [id, src, hearts, inv, dens] of sv.h) {
    const cs = parseProg(String(id));
    if (cs) h.push(mk(cs, String(src), inv >= -1 && inv <= 3 ? inv | 0 : -1, dens >= 0 && dens <= 6 ? dens | 0 : 0, hearts > 0 ? hearts | 0 : 0));
  }
  if (h.length) {
    init.history = h;
    init.cur = Math.max(0, Math.min(h.length - 1, sv.cur | 0));
    if (sv.bpm >= 30 && sv.bpm <= 300) init.bpm = sv.bpm;
    if (sv.key >= 0 && sv.key < 12) init.key = sv.key | 0;
    if (sv.mode === 'minor') init.mode = 'minor';
    if (PRULES.some((r) => r.id === sv.rule)) init.rule = sv.rule;
    if (VOCABS.some((r) => r.id === sv.vocab)) init.vocab = sv.vocab;
    if (sv.repeat >= 0 && sv.repeat <= 999) init.repeat = sv.repeat | 0;
    if ([1, 2, 4, 8].includes(sv.beats)) init.beats = sv.beats;
    if (sv.voice >= 0 && sv.voice <= 2) init.voice = sv.voice | 0;
  }
}

const st = makeStore(init, KEY, (s) => {
  const from = Math.max(0, s.history.length - 400);
  return { h: s.history.slice(from).map((e) => [e.id, e.src, e.hearts, e.inv, e.dens]), cur: Math.max(0, s.cur - from), bpm: s.bpm, key: s.key, mode: s.mode, rule: s.rule, vocab: s.vocab, repeat: s.repeat, beats: s.beats, voice: s.voice };
});
export const subscribe = st.subscribe;
export const getState = st.get;

const synth = new ChordSynth();
const curEntry = () => st.s.history[st.s.cur];

function append(chords: Chord[], src: string) {
  const e = curEntry();
  st.s.history.push(mk(chords, src, e.inv, e.dens));
  if (st.s.history.length > 1000) st.s.history.shift();
  st.s.cur = st.s.history.length - 1;
  st.s.hv++;
}
// The Next Track event. The rule is read now, never queued ahead.
function advance() {
  append(nextProg(curEntry().chords, st.s.rule, st.s.vocab, st.s.mode), PRULES.find((r) => r.id === st.s.rule)!.label);
  st.s.loop = 0;
}

const loop = new Loop({
  stepDur: () => (st.s.beats * 60) / st.s.bpm,
  len: () => curEntry().chords.length,
  onStep(pos, time) {
    const e = curEntry();
    synth.strike(voiceProg(e.chords, st.s.key, e.inv, e.dens)[pos], time, 0.9, st.s.voice);
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
  onStop: (t) => synth.release(t),
  trackKey: () => st.s.cur,
});
function restart() {
  st.s.loop = 0;
  loop.restart();
}
function audition(i: number) {
  if (st.s.playing) return;
  const e = curEntry();
  const t = audioCtx().currentTime + 0.01;
  synth.strike(voiceChord(e.chords[i], st.s.key, Math.max(0, e.inv), e.dens, null), t, 0.9, st.s.voice);
  synth.release(t + 1.2);
}

export const actions = {
  toggle() {
    if (st.s.playing) {
      st.s.playing = false;
      st.s.step = -1;
      loop.stop();
    } else {
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
  back() {
    actions.jump(st.s.cur - 1);
  },
  jump(i: number) {
    if (i < 0 || i >= st.s.history.length || i === st.s.cur) return;
    st.s.cur = i;
    restart();
    st.emit();
  },
  // Hand edits make a new progression at the end of history. Consecutive edits update that entry
  // unless it has hearts.
  edit(chords: Chord[]) {
    const tail = st.s.history.length - 1;
    const t = st.s.history[tail];
    if (st.s.cur === tail && t.src === 'Edit' && t.hearts === 0) {
      st.s.history[tail] = mk(chords, 'Edit', t.inv, t.dens);
      st.s.hv++;
    } else append(chords, 'Edit');
    st.emit();
  },
  setChord(i: number, c: Chord) {
    actions.edit(curEntry().chords.map((x, j) => (j === i ? c : x)));
    audition(i);
  },
  audition,
  setCount(n: number) {
    const cs = curEntry().chords;
    n = Math.max(1, Math.min(MAX_CHORDS, n));
    if (n === cs.length) return;
    actions.edit(n < cs.length ? cs.slice(0, n) : cs.concat(Array.from({ length: n - cs.length }, () => cs[cs.length - 1])));
  },
  load(chords: Chord[]) {
    append(chords, 'Load');
    restart();
    st.emit();
  },
  heart(d: number) {
    const e = curEntry();
    st.s.history[st.s.cur] = { ...e, hearts: Math.max(0, e.hearts + d) };
    st.s.hv++;
    st.emit();
  },
  // Inversion and density are layers on the entry, like emphasis: changing them makes no new progression.
  setVoicing(patch: { inv?: number; dens?: number }) {
    st.s.history[st.s.cur] = { ...curEntry(), ...patch };
    st.s.hv++;
    st.emit();
  },
  set(patch: Partial<Pick<CState, 'bpm' | 'key' | 'mode' | 'rule' | 'vocab' | 'repeat' | 'beats' | 'voice'>>) {
    Object.assign(st.s, patch);
    st.s.bpm = Math.max(30, Math.min(300, Math.round(st.s.bpm)));
    st.emit();
  },
};
