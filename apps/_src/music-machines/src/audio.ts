// Twelve unpitched hits, synthesized sample by sample: a sharp click, a short body, a noise tail.
export const SOUNDS = [
  { id: 'tick', label: 'Tick', note: 80 },
  { id: 'clave', label: 'Clave', note: 75 },
  { id: 'block', label: 'Block', note: 76 },
  { id: 'knock', label: 'Knock', note: 77 },
  { id: 'rim', label: 'Rim', note: 37 },
  { id: 'clap', label: 'Clap', note: 39 },
  { id: 'pop', label: 'Pop', note: 62 },
  { id: 'thump', label: 'Thump', note: 36 },
  { id: 'snare', label: 'Snare', note: 38 },
  { id: 'hat', label: 'Hat', note: 42 },
  { id: 'sizzle', label: 'Sizzle', note: 70 },
  { id: 'tin', label: 'Tin', note: 56 },
] as const;

type FType = 'lp' | 'hp' | 'bp';

function noise(n: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  let s = seed | 0 || 1;
  for (let i = 0; i < n; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    out[i] = ((s >>> 0) / 2147483648) - 1;
  }
  return out;
}

function biquad(x: Float32Array, type: FType, f: number, q: number, sr: number): Float32Array {
  const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr;
  const cs = Math.cos(w);
  const al = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (type === 'lp') {
    b1 = 1 - cs;
    b0 = b2 = b1 / 2;
  } else if (type === 'hp') {
    b1 = -(1 + cs);
    b0 = b2 = (1 + cs) / 2;
  } else {
    b0 = al;
    b1 = 0;
    b2 = -al;
  }
  const a0 = 1 + al;
  const a1 = -2 * cs;
  const a2 = 1 - al;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

interface Voice {
  out: Float32Array;
  sr: number;
  seed: number;
}

// Decaying sine. `ratio` > 1 starts the pitch high and lets it fall to f over `sweep` seconds.
function partial(v: Voice, f: number, decay: number, gain: number, ratio = 1, sweep = 0.005) {
  let ph = 0;
  for (let i = 0; i < v.out.length; i++) {
    const t = i / v.sr;
    ph += (2 * Math.PI * f * (1 + (ratio - 1) * Math.exp(-t / sweep))) / v.sr;
    v.out[i] += Math.sin(ph) * gain * Math.exp(-t / decay);
  }
}

// Filtered noise with an instant attack. The filter runs first so the edge stays sharp.
function burst(v: Voice, type: FType, f: number, q: number, decay: number, gain: number, delay = 0) {
  const src = biquad(noise(v.out.length, 7919 * ++v.seed), type, f, q, v.sr);
  const d = Math.floor(delay * v.sr);
  for (let i = d; i < v.out.length; i++) v.out[i] += src[i] * gain * Math.exp(-(i - d) / v.sr / decay);
}

export function render(id: string, sr: number): Float32Array {
  const dur: Record<string, number> = { tick: 0.06, clave: 0.2, block: 0.25, knock: 0.3, rim: 0.2, clap: 0.4, pop: 0.2, thump: 0.5, snare: 0.45, hat: 0.2, sizzle: 0.8, tin: 0.5 };
  const n = Math.floor(dur[id] * sr);
  const v: Voice = { out: new Float32Array(n), sr, seed: id.length + id.charCodeAt(0) };
  let drive = 1.6;
  switch (id) {
    case 'tick':
      burst(v, 'hp', 4000, 0.7, 0.003, 1);
      partial(v, 3800, 0.004, 0.5);
      break;
    case 'clave':
      partial(v, 2480, 0.03, 1);
      partial(v, 6845, 0.012, 0.22);
      burst(v, 'bp', 3000, 1, 0.0015, 0.7);
      break;
    case 'block':
      partial(v, 930, 0.04, 1, 1.2, 0.004);
      partial(v, 1510, 0.022, 0.4);
      burst(v, 'bp', 1900, 1.5, 0.006, 0.9);
      break;
    case 'knock':
      partial(v, 235, 0.055, 1, 1.6, 0.008);
      partial(v, 395, 0.03, 0.45);
      burst(v, 'lp', 900, 0.7, 0.008, 1.2);
      burst(v, 'hp', 2500, 0.7, 0.0012, 0.3);
      break;
    case 'rim':
      partial(v, 480, 0.028, 0.6);
      partial(v, 790, 0.022, 0.5);
      partial(v, 1720, 0.018, 0.5);
      burst(v, 'bp', 3300, 1.2, 0.01, 1.4);
      drive = 2.4;
      break;
    case 'clap':
      burst(v, 'bp', 1500, 1.3, 0.004, 1.6);
      burst(v, 'bp', 1700, 1.3, 0.004, 1.4, 0.008);
      burst(v, 'bp', 1400, 1.1, 0.06, 2, 0.017);
      burst(v, 'hp', 5000, 0.7, 0.03, 0.25, 0.017);
      break;
    case 'pop':
      partial(v, 540, 0.028, 1, 0.42, 0.012);
      burst(v, 'hp', 2000, 0.7, 0.001, 0.35);
      break;
    case 'thump':
      partial(v, 68, 0.13, 1, 3.2, 0.022);
      burst(v, 'lp', 1500, 0.7, 0.004, 0.9);
      drive = 2.8;
      break;
    case 'snare':
      partial(v, 190, 0.045, 0.7, 1.3, 0.006);
      partial(v, 335, 0.03, 0.35);
      burst(v, 'hp', 1800, 0.7, 0.075, 0.7);
      burst(v, 'bp', 5000, 1, 0.02, 0.6);
      break;
    case 'hat': {
      const sq = new Float32Array(n);
      for (const f of [2053, 3044, 3696, 5227, 5400, 8000]) {
        for (let i = 0; i < n; i++) sq[i] += Math.sin((2 * Math.PI * f * i) / sr) > 0 ? 0.3 : -0.3;
      }
      const m = biquad(biquad(sq, 'bp', 9000, 1, sr), 'hp', 7000, 0.7, sr);
      for (let i = 0; i < n; i++) v.out[i] += m[i] * 2 * Math.exp(-i / sr / 0.03);
      burst(v, 'hp', 8000, 0.7, 0.022, 0.8);
      break;
    }
    case 'sizzle': {
      const src = biquad(biquad(noise(n, 4242), 'bp', 7500, 0.6, sr), 'hp', 4500, 0.7, sr);
      const jit = biquad(noise(n, 99), 'lp', 40, 0.7, sr);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        ph += (2 * Math.PI * (85 + 400 * jit[i])) / sr;
        v.out[i] += src[i] * Math.exp(-t / 0.16) * (0.7 + 0.3 * Math.sin(ph));
      }
      burst(v, 'hp', 3000, 0.7, 0.002, 0.8);
      break;
    }
    case 'tin':
      partial(v, 1180, 0.07, 1);
      partial(v, 1870, 0.09, 0.6);
      partial(v, 2740, 0.06, 0.5);
      partial(v, 3530, 0.045, 0.4);
      partial(v, 4420, 0.03, 0.3);
      burst(v, 'hp', 3000, 0.7, 0.002, 0.8);
      break;
  }
  // Normalize, saturate gently (glues the layers), then fade the tail to zero.
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(v.out[i]));
  const norm = Math.tanh(drive);
  const fade = Math.floor(0.008 * sr);
  for (let i = 0; i < n; i++) {
    let s = (Math.tanh((v.out[i] / peak) * drive) / norm) * 0.85;
    if (i > n - fade) s *= (n - i) / fade;
    v.out[i] = s;
  }
  return v.out;
}

// One audio context for the page, so drums and chords share a clock. Call from a tap.
let shared: AudioContext | null = null;
export function audioCtx(): AudioContext {
  if (!shared) {
    try {
      (navigator as any).audioSession.type = 'playback'; // play through the iPhone silent switch
    } catch {}
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    shared = new AC({ latencyHint: 'interactive' });
  }
  if (shared!.state !== 'running') shared!.resume().catch(() => {});
  return shared!;
}

export class Engine {
  ctx: AudioContext | null = null;
  private buffers: AudioBuffer[] = [];
  private bus!: GainNode;
  private prev: { src: AudioBufferSourceNode; g: GainNode } | null = null;

  // Call from a tap. Creates the audio graph on first use.
  ensure(): AudioContext {
    const ctx = audioCtx();
    if (!this.ctx) {
      this.ctx = ctx;
      for (const s of SOUNDS) {
        const data = render(s.id, ctx.sampleRate);
        const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
        buf.getChannelData(0).set(data);
        this.buffers.push(buf);
      }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.09;
      const soften = ctx.createBiquadFilter();
      soften.type = 'highshelf';
      soften.frequency.value = 9000;
      soften.gain.value = -3;
      const out = ctx.createGain();
      out.gain.value = 0.9;
      this.bus = ctx.createGain();
      this.bus.connect(comp).connect(soften).connect(out).connect(ctx.destination);
    }
    return ctx;
  }

  // Monophonic: the new hit chokes the previous one.
  trigger(sound: number, time: number, accent: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = Math.max(time, ctx.currentTime);
    if (this.prev) {
      const p = this.prev;
      p.g.gain.setValueAtTime(p.g.gain.value, t);
      p.g.gain.linearRampToValueAtTime(0, t + 0.004);
      try {
        p.src.stop(t + 0.01);
      } catch {}
    }
    const src = ctx.createBufferSource();
    src.buffer = this.buffers[sound];
    src.playbackRate.value = 0.994 + Math.random() * 0.012; // tiny variation, like a real stick
    const g = ctx.createGain();
    g.gain.value = (accent ? 1 : 0.36) * (0.9 + Math.random() * 0.1);
    src.connect(g).connect(this.bus);
    src.start(t);
    this.prev = { src, g };
  }
}
