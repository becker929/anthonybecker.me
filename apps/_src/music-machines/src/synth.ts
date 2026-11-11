import { audioCtx } from './audio';

export const VOICES = [
  { v: 0, l: 'Keys' },
  { v: 1, l: 'Pluck' },
  { v: 2, l: 'Pad' },
];
// [oscillator, second oscillator, second ratio, second gain, attack s, decay time constant s, filter start Hz, filter end Hz, filter time constant s]
const P: [OscillatorType, OscillatorType, number, number, number, number, number, number, number][] = [
  ['triangle', 'sine', 2, 0.22, 0.004, 0.9, 3200, 1400, 0.25],
  ['sawtooth', 'sawtooth', 1.004, 0.8, 0.002, 0.3, 5200, 600, 0.09],
  ['sawtooth', 'sawtooth', 0.995, 0.9, 0.05, 5, 1500, 1100, 0.5],
];

type Note = { oscs: OscillatorNode[]; g: GainNode };

// Plays one chord at a time: each strike releases the chord before it.
export class ChordSynth {
  private bus: GainNode | null = null;
  private live: Note[] = [];

  private out(ctx: AudioContext): GainNode {
    if (!this.bus) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 3;
      comp.attack.value = 0.006;
      comp.release.value = 0.15;
      this.bus = ctx.createGain();
      this.bus.gain.value = 0.9;
      this.bus.connect(comp).connect(ctx.destination);
    }
    return this.bus;
  }

  release(time: number) {
    for (const n of this.live) {
      n.g.gain.setTargetAtTime(0, time, 0.02);
      for (const o of n.oscs) {
        try {
          o.stop(time + 0.2);
        } catch {}
      }
    }
    this.live = [];
  }

  strike(notes: number[], time: number, level: number, voice: number) {
    const ctx = audioCtx();
    const bus = this.out(ctx);
    const t = Math.max(time, ctx.currentTime);
    this.release(t);
    const [w1, w2, ratio, g2, attack, decay, f0, f1, ft] = P[voice] || P[0];
    const peak = (level * 0.3) / Math.sqrt(Math.max(1, notes.length));
    for (const m of notes) {
      const f = 440 * Math.pow(2, (m - 69) / 12);
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.Q.value = 0.7;
      filt.frequency.setValueAtTime(f0, t);
      filt.frequency.setTargetAtTime(f1, t, ft);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.setTargetAtTime(0, t + attack, decay);
      const o1 = ctx.createOscillator();
      o1.type = w1;
      o1.frequency.value = f;
      const o2 = ctx.createOscillator();
      o2.type = w2;
      o2.frequency.value = f * ratio;
      const m2 = ctx.createGain();
      m2.gain.value = g2;
      o1.connect(filt);
      o2.connect(m2).connect(filt);
      filt.connect(g).connect(bus);
      o1.start(t);
      o2.start(t);
      o1.stop(t + 12);
      o2.stop(t + 12);
      this.live.push({ oscs: [o1, o2], g });
    }
  }
}
