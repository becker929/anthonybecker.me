// The films' music, rendered offline to a 48 kHz stereo WAV. Three moods:
//   calm   slow chords on soft pads with a few bell notes, for the documentary
//   hype   a beat (breakbeat, four-floor, half-time, jungle, boom-bap or gallop) with bass and stabs
//   short  a ten-second hype loop with a riser into a hit
// Everything is seeded, so a film can be remade exactly.
//   node music.mjs <out.wav> <mood> <seconds> <seed> [beat] [bpm]
import { writeFileSync } from 'node:fs';
import { rng } from './grammar.js';

const SR = 48000;

export function render({ mood, seconds, seed, beat = 'breakbeat', bpm = 128 }) {
  const r = rng(seed);
  const n = Math.ceil(seconds * SR);
  const L = new Float32Array(n), R = new Float32Array(n), verb = new Float32Array(n);
  const add = (buf, i, v) => { if (i >= 0 && i < n) buf[i] += v; };
  const note = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const root = r.pick([45, 47, 48, 50, 52, 53]);
  // Minor-ish progressions, in scale degrees as semitones from the root.
  const prog = r.pick([[0, 8, 3, 10], [0, 5, 8, 7], [0, 3, 8, 10], [0, 10, 8, 7], [0, 8, 5, 7]]);
  const minor = [0, 3, 7], major = [0, 4, 7];
  const chord = (deg) => ([0, 5, 7].includes(deg) ? minor : major).map((x) => root + deg + x);

  if (mood === 'calm') {
    const bar = r.range(4.5, 6.5);
    for (let b = 0; b * bar < seconds + bar; b++) {
      const t0 = b * bar, notes = chord(prog[b % prog.length]).map((m) => m + 12);
      for (const [k, m] of notes.entries()) pad(t0, bar * 1.25, note(m), 0.05, k);
      pad(t0, bar * 1.25, note(notes[0] - 12), 0.04, 9);
      // A few bell notes, sparse and soft.
      for (let j = 0; j < 3; j++) if (r() < 0.6) bell(t0 + r.range(0.3, bar - 0.5), note(r.pick(notes) + 12 + r.pick([0, 12])), 0.05);
    }
  } else {
    const spb = 60 / bpm, steps = Math.ceil(seconds / (spb / 4)) + 16;
    const kickAt = { 'breakbeat': [0, 10], 'four-floor': [0, 4, 8, 12], 'half-time': [0, 11], 'jungle': [0, 10, 13], 'boom-bap': [0, 7, 10], 'gallop': [0, 3, 8, 11] }[beat] || [0, 8];
    const snareAt = { 'half-time': [8], 'jungle': [4, 12, 15] }[beat] || [4, 12];
    const swing = beat === 'boom-bap' ? 0.12 : beat === 'gallop' ? 0.08 : 0;
    const riser = mood === 'short' ? seconds - 1.6 : -1;
    for (let s = 0; s < steps; s++) {
      const t = s * (spb / 4) + (s % 2 ? swing * spb / 4 : 0);
      if (t > seconds) break;
      const st = s % 16, bar = Math.floor(s / 16);
      if (riser > 0 && t > riser && t < seconds - 0.4) continue;
      if (kickAt.includes(st)) kick(t, 0.9);
      if (snareAt.includes(st)) snare(t, 0.5);
      if (beat !== 'boom-bap' || st % 4 === 2) hat(t, st % 4 === 2 ? 0.16 : 0.08, st % 4 === 2 && beat === 'four-floor');
      if (beat === 'jungle' && r() < 0.18) snare(t, 0.18);
      // Bass on the root of the bar's chord, on the kick.
      if (kickAt.includes(st)) bass(t, spb * 1.5, note(chord(prog[bar % prog.length])[0] - 12), 0.32);
      // Stabs on the off-beats of every other bar.
      if (bar % 2 === 1 && (st === 6 || st === 14)) for (const m of chord(prog[bar % prog.length])) stab(t, note(m + 12), 0.07);
    }
    if (riser > 0) { sweep(riser, seconds - riser - 0.35, 0.22); kick(seconds - 0.35, 1); for (const m of chord(prog[0])) stab(seconds - 0.35, note(m + 12), 0.12); }
  }

  // A plain reverb: four combs into two allpasses, fed from the `verb` send.
  const wet = reverb(verb, mood === 'calm' ? 0.86 : 0.7);
  let peak = 0;
  for (let i = 0; i < n; i++) { L[i] += wet[i]; R[i] += wet[(i + 211) % n]; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  // Fade in and out, and a soft limit.
  const fi = Math.floor(SR * (mood === 'calm' ? 2.5 : 0.02)), fo = Math.floor(SR * (mood === 'calm' ? 3 : 0.4));
  const g = 0.8 / Math.max(peak, 1e-6);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / fi, (n - i) / fo);
    L[i] = Math.tanh(L[i] * g * 1.2) * env * 0.85; R[i] = Math.tanh(R[i] * g * 1.2) * env * 0.85;
  }
  return { L, R, SR };

  function pad(t0, dur, f, amp, k) {
    const i0 = Math.floor(t0 * SR), len = Math.floor(dur * SR);
    let lp = 0;
    const det = [0.997, 1, 1.004];
    for (let j = 0; j < len; j++) {
      const t = j / SR, env = Math.min(1, t / 1.6) * Math.min(1, (dur - t) / 1.8);
      let v = 0;
      for (const d of det) v += ((t * f * d) % 1) * 2 - 1;
      lp += (v / 3 - lp) * 0.035; // dark, soft
      const s = lp * amp * env, pan = 0.5 + 0.3 * Math.sin(k + t * 0.2);
      add(L, i0 + j, s * (1 - pan)); add(R, i0 + j, s * pan); add(verb, i0 + j, s * 0.6);
    }
  }
  function bell(t0, f, amp) {
    const i0 = Math.floor(t0 * SR), len = SR * 3;
    for (let j = 0; j < len; j++) { const t = j / SR; const v = Math.sin(2 * Math.PI * f * t + 1.5 * Math.sin(2 * Math.PI * f * 3.5 * t) * Math.exp(-t * 3)) * Math.exp(-t * 1.6) * amp; add(L, i0 + j, v * 0.7); add(R, i0 + j, v); add(verb, i0 + j, v * 1.2); }
  }
  function kick(t0, amp) {
    const i0 = Math.floor(t0 * SR); let ph = 0;
    for (let j = 0; j < SR * 0.45; j++) { const t = j / SR; ph += (48 + 110 * Math.exp(-t * 28)) / SR; const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7) * amp; add(L, i0 + j, v); add(R, i0 + j, v); }
  }
  function snare(t0, amp) {
    const i0 = Math.floor(t0 * SR); let hp = 0, prev = 0;
    for (let j = 0; j < SR * 0.25; j++) { const t = j / SR, w = r() * 2 - 1; hp = 0.85 * (hp + w - prev); prev = w; const v = (hp * Math.exp(-t * 16) + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30) * 0.5) * amp; add(L, i0 + j, v); add(R, i0 + j, v); add(verb, i0 + j, v * 0.3); }
  }
  function hat(t0, amp, open) {
    const i0 = Math.floor(t0 * SR); let hp = 0, prev = 0; const d = open ? 9 : 45;
    for (let j = 0; j < SR * (open ? 0.3 : 0.06); j++) { const t = j / SR, w = r() * 2 - 1; hp = 0.6 * (hp + w - prev); prev = w; const v = hp * Math.exp(-t * d) * amp; add(L, i0 + j, v * 0.8); add(R, i0 + j, v); }
  }
  function bass(t0, dur, f, amp) {
    const i0 = Math.floor(t0 * SR); let lp = 0;
    for (let j = 0; j < SR * dur; j++) { const t = j / SR, saw = ((t * f) % 1) * 2 - 1; lp += (saw - lp) * (0.02 + 0.1 * Math.exp(-t * 12)); const v = Math.tanh(lp * 2.2) * amp * Math.min(1, (dur - t) / 0.05); add(L, i0 + j, v); add(R, i0 + j, v); }
  }
  function stab(t0, f, amp) {
    const i0 = Math.floor(t0 * SR); let lp = 0;
    for (let j = 0; j < SR * 0.35; j++) { const t = j / SR; let v = 0; for (const d of [0.995, 1.005]) v += ((t * f * d) % 1) * 2 - 1; lp += (v - lp) * (0.05 + 0.4 * Math.exp(-t * 14)); const s = lp * amp * Math.exp(-t * 7); add(L, i0 + j, s); add(R, i0 + j, s * 0.9); add(verb, i0 + j, s * 0.7); }
  }
  function sweep(t0, dur, amp) {
    const i0 = Math.floor(t0 * SR); let bp = 0, prev = 0;
    for (let j = 0; j < SR * dur; j++) { const t = j / SR, k = t / dur, w = r() * 2 - 1; bp += (w - bp) * (0.02 + 0.6 * k * k); const v = (bp - prev * 0.5) * amp * k * k; prev = bp; add(L, i0 + j, v); add(R, i0 + j, v); }
  }
}

function reverb(x, fb) {
  const n = x.length, out = new Float32Array(n);
  for (const d of [1557, 1617, 1491, 1422]) {
    const buf = new Float32Array(d); let k = 0, lp = 0;
    for (let i = 0; i < n; i++) { const y = buf[k]; lp += (y - lp) * 0.3; buf[k] = x[i] + lp * fb; out[i] += y * 0.25; k = (k + 1) % d; }
  }
  for (const d of [225, 556]) {
    const buf = new Float32Array(d); let k = 0;
    for (let i = 0; i < n; i++) { const y = buf[k]; const v = out[i]; buf[k] = v + y * 0.5; out[i] = y - v * 0.5; k = (k + 1) % d; }
  }
  return out;
}

export function writeWav(path, { L, R, SR }) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  writeFileSync(path, buf);
}

if (process.argv[1] === import.meta.filename) {
  const [out, mood, seconds, seed, beat, bpm] = process.argv.slice(2);
  writeWav(out, render({ mood, seconds: Number(seconds), seed: Number(seed), beat, bpm: Number(bpm) || 128 }));
}
