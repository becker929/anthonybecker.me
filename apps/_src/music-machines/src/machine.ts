import { audioCtx } from './audio';

// Shared state container: mutate `s`, then call emit(). Saves a snapshot to this browser.
export function makeStore<S extends object>(init: S, key: string, snapshot: (s: S) => unknown) {
  const subs = new Set<() => void>();
  let timer: any = 0;
  const st = {
    s: init,
    emit() {
      st.s = { ...st.s };
      subs.forEach((f) => f());
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(snapshot(st.s)));
        } catch {}
      }, 500);
    },
    subscribe: (f: () => void) => (subs.add(f), () => subs.delete(f)),
    get: () => st.s,
  };
  return st;
}
export function loadSaved(key: string): any {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

// Lookahead scheduler for a looping track. The track is read fresh at every step, never queued.
export class Loop {
  playing = false;
  private timer: any = 0;
  private raf = 0;
  private nextTime = 0;
  private pos = 0;
  private shown: { time: number; step: number; key: number }[] = [];
  constructor(
    private o: {
      stepDur: () => number; // seconds
      len: () => number; // steps in one loop
      onStep: (pos: number, time: number) => void;
      onWrap: () => void; // a loop just finished; may switch track
      onShow: (step: number) => void; // playhead for the UI
      onStop: (time: number) => void;
      trackKey: () => number;
    },
  ) {}
  start() {
    const ctx = audioCtx();
    this.playing = true;
    this.pos = 0;
    this.shown = [];
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.tick(), 25);
    this.raf = requestAnimationFrame(this.frame);
  }
  stop() {
    this.playing = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    this.o.onStop(audioCtx().currentTime);
  }
  restart() {
    this.pos = 0;
    this.shown = [];
    if (this.playing) this.nextTime = audioCtx().currentTime + 0.04;
  }
  private tick() {
    const ctx = audioCtx();
    while (this.nextTime < ctx.currentTime + 0.1) {
      if (this.pos >= this.o.len()) this.pos = 0;
      this.o.onStep(this.pos, this.nextTime);
      this.shown.push({ time: this.nextTime, step: this.pos, key: this.o.trackKey() });
      this.pos++;
      this.nextTime += this.o.stepDur();
      if (this.pos >= this.o.len()) {
        this.pos = 0;
        this.o.onWrap();
      }
    }
  }
  private frame = () => {
    if (!this.playing) return;
    const now = audioCtx().currentTime;
    let step: number | null = null;
    while (this.shown.length && this.shown[0].time <= now) {
      const e = this.shown.shift()!;
      step = e.key === this.o.trackKey() ? e.step : -1;
    }
    if (step !== null) this.o.onShow(step);
    this.raf = requestAnimationFrame(this.frame);
  };
}
