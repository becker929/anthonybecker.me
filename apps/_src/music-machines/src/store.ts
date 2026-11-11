import { Rhythm, RuleId, RULES, EmphId, EMPHASIS, emphasisMask, nextRhythm, toId, parse, getStep, toggleStep, resize } from './rhythm';
import { Engine, SOUNDS } from './audio';

export type Entry = Rhythm & { id: string; src: string; hearts: number; emph: EmphId; mask: bigint };
export interface State {
  history: Entry[]; // append-only, never branches
  hv: number; // bumps when history changes
  cur: number;
  playing: boolean;
  bpm: number;
  rule: RuleId;
  repeat: number; // loops before the next rhythm; 0 = forever
  sound: number;
  rotateSound: boolean;
  loop: number; // loops finished on the current rhythm
  step: number; // playhead, -1 when stopped
}

const KEY = 'onset-machine-v1';
const MAX_HISTORY = 1000;
const mk = (r: Rhythm, src: string, emph: EmphId, hearts = 0): Entry => ({ len: r.len, v: r.v, id: toId(r), src, hearts, emph, mask: emphasisMask(emph, r.len) });

let state: State = {
  history: [mk(parse('16.9228')!, 'Seed', 'none')],
  hv: 0,
  cur: 0,
  playing: false,
  bpm: 108,
  rule: 'density',
  repeat: 4,
  sound: 2,
  rotateSound: false,
  loop: 0,
  step: -1,
};

try {
  const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (s && Array.isArray(s.h) && s.h.length) {
    const h: Entry[] = [];
    for (const [id, src, hearts, emph] of s.h) {
      const r = parse(id);
      if (r) h.push(mk(r, String(src), EMPHASIS.some((e) => e.id === emph) ? emph : 'none', hearts > 0 ? hearts | 0 : 0));
    }
    if (h.length) {
      state.history = h;
      state.cur = Math.max(0, Math.min(h.length - 1, s.cur | 0));
      if (s.bpm >= 30 && s.bpm <= 300) state.bpm = s.bpm;
      if (RULES.some((x) => x.id === s.rule)) state.rule = s.rule;
      if (s.repeat >= 0 && s.repeat <= 999) state.repeat = s.repeat | 0;
      if (s.sound >= 0 && s.sound < SOUNDS.length) state.sound = s.sound | 0;
      state.rotateSound = !!s.rotateSound;
    }
  }
} catch {}

const subs = new Set<() => void>();
let saveTimer: any = 0;
function emit() {
  state = { ...state };
  subs.forEach((f) => f());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const from = Math.max(0, state.history.length - 400);
      localStorage.setItem(
        KEY,
        JSON.stringify({
          h: state.history.slice(from).map((e) => [e.id, e.src, e.hearts, e.emph]),
          cur: Math.max(0, state.cur - from),
          bpm: state.bpm,
          rule: state.rule,
          repeat: state.repeat,
          sound: state.sound,
          rotateSound: state.rotateSound,
        }),
      );
    } catch {}
  }, 500);
}
export const subscribe = (f: () => void) => (subs.add(f), () => subs.delete(f));
export const getState = () => state;

// ---------- playback ----------
const engine = new Engine();
let timer: any = 0;
let raf = 0;
let nextTime = 0;
let pos = 0;
let shown: { time: number; step: number; cur: number }[] = [];

function restart() {
  pos = 0;
  state.loop = 0;
  shown = [];
  if (state.playing && engine.ctx) nextTime = engine.ctx.currentTime + 0.04;
}

// New rhythms keep the emphasis pattern of the rhythm they came from.
function append(r: Rhythm, src: string) {
  state.history.push(mk(r, src, state.history[state.cur].emph));
  if (state.history.length > MAX_HISTORY) state.history.shift();
  state.cur = state.history.length - 1;
  state.hv++;
}

// The Next Track event. The rule is read now, never queued ahead.
function advance() {
  const label = RULES.find((x) => x.id === state.rule)!.label;
  append(nextRhythm(state.history[state.cur], state.rule), label);
  if (state.rotateSound) state.sound = (state.sound + 1) % SOUNDS.length;
  state.loop = 0;
}

function tick() {
  const ctx = engine.ctx!;
  let changed = false;
  while (nextTime < ctx.currentTime + 0.1) {
    const r = state.history[state.cur];
    if (pos >= r.len) pos = 0;
    if (getStep(r, pos)) engine.trigger(state.sound, nextTime, r.mask === 0n || ((r.mask >> BigInt(r.len - 1 - pos)) & 1n) === 1n);
    shown.push({ time: nextTime, step: pos, cur: state.cur });
    pos++;
    nextTime += 60 / state.bpm / 4;
    if (pos >= r.len) {
      pos = 0;
      state.loop++;
      if (state.repeat > 0 && state.loop >= state.repeat) advance();
      changed = true;
    }
  }
  if (changed) emit();
}

function frame() {
  if (!state.playing || !engine.ctx) return;
  const now = engine.ctx.currentTime;
  let step = state.step;
  while (shown.length && shown[0].time <= now) {
    const e = shown.shift()!;
    step = e.cur === state.cur ? e.step : -1;
  }
  if (step !== state.step) {
    state.step = step;
    emit();
  }
  raf = requestAnimationFrame(frame);
}

export const actions = {
  toggle() {
    if (state.playing) {
      state.playing = false;
      state.step = -1;
      clearInterval(timer);
      cancelAnimationFrame(raf);
    } else {
      const ctx = engine.ensure();
      state.playing = true;
      restart();
      nextTime = ctx.currentTime + 0.06;
      timer = setInterval(tick, 25);
      raf = requestAnimationFrame(frame);
    }
    emit();
  },
  next() {
    advance();
    restart();
    emit();
  },
  back() {
    if (state.cur > 0) actions.jump(state.cur - 1);
  },
  jump(i: number) {
    if (i < 0 || i >= state.history.length || i === state.cur) return;
    state.cur = i;
    restart();
    emit();
  },
  // Hand edits make a new rhythm at the end of history. Consecutive edits update that one entry,
  // unless it already has hearts: a hearted rhythm is never overwritten.
  edit(r: Rhythm) {
    const tail = state.history.length - 1;
    const t = state.history[tail];
    if (state.cur === tail && t.src === 'Edit' && t.hearts === 0) {
      state.history[tail] = mk(r, 'Edit', t.emph);
      state.hv++;
    } else append(r, 'Edit');
    emit();
  },
  toggleStep: (i: number) => actions.edit(toggleStep(state.history[state.cur], i)),
  setLen(len: number) {
    const r = state.history[state.cur];
    const nr = resize(r, len);
    if (nr !== r) actions.edit(nr);
  },
  clear: () => actions.edit({ len: state.history[state.cur].len, v: 0n }),
  load(r: Rhythm) {
    append(r, 'Load');
    restart();
    emit();
  },
  heart(d: number) {
    const e = state.history[state.cur];
    state.history[state.cur] = { ...e, hearts: Math.max(0, e.hearts + d) };
    state.hv++;
    emit();
  },
  // Emphasis is a layer on the entry: changing it does not make a new rhythm.
  setEmph(emph: EmphId) {
    const e = state.history[state.cur];
    state.history[state.cur] = mk(e, e.src, emph, e.hearts);
    state.hv++;
    emit();
  },
  set(patch: Partial<Pick<State, 'bpm' | 'rule' | 'repeat' | 'rotateSound'>>) {
    Object.assign(state, patch);
    state.bpm = Math.max(30, Math.min(300, Math.round(state.bpm)));
    emit();
  },
  setSound(i: number) {
    state.sound = i;
    if (!state.playing) {
      const ctx = engine.ensure();
      engine.trigger(i, ctx.currentTime + 0.01, true);
    }
    emit();
  },
};
