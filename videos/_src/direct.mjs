// The three directors. Each reads a subject's footage and narration and writes an edit decision list
// (<work>/<style>/edl.json) for the editor (edit.js) and the mixer (make.mjs).
//   node direct.mjs <work> <style> <seed> [recent-fingerprints.json]
//
//   calm   1920x1080, about a minute: a quiet documentary. Slow moves, long dissolves, a serif lower
//          third, data cards that count up, narration over soft pads.
//   hype   1920x1080, about half a minute: a DIY hype cut whose grammar (shot types, transitions,
//          effects, fonts, captions, grade, cut method, beat) is drawn fresh each time and steers away
//          from the library's recent films.
//   short  1080x1920, ten seconds: one idea, said and shown, big words, a progress bar.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { rng, drawHype, fingerprint, GRADES, BEATS } from './grammar.js';

const FPS = 30;

export async function direct(work, style, seed, recent = []) {
  const subject = JSON.parse(await readFile(join(work, 'subject.json'), 'utf8'));
  const side = style === 'short' ? 'v' : 'h';
  const sources = {};
  for (const d of await readdir(join(work, 'footage'))) {
    sources[d] = { n: (await readdir(join(work, 'footage', d))).filter((f) => f.endsWith('.jpg')).length };
  }
  // The shots filmed for this shape of frame, in the order the subject lists them.
  const keys = subject.shots.map((s) => `${s.key}-${side}`).filter((k) => sources[k]?.n);
  const lengthOf = (k) => sources[k].n / FPS;
  const vox = await readJSON(join(work, 'vox', `${style}.json`), []);
  const r = rng(seed);
  const edl = style === 'calm' ? calm(subject, keys, lengthOf, vox, r)
    : style === 'hype' ? hype(subject, keys, lengthOf, r, recent)
    : short(subject, keys, lengthOf, vox, r);
  Object.assign(edl, { style, fps: FPS, sources, seed, title: subject.title });
  await mkdir(join(work, style), { recursive: true });
  await writeFile(join(work, style, 'edl.json'), JSON.stringify(edl, null, 1));
  return edl;
}

async function readJSON(p, fallback) { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; } }
const f = (sec) => Math.round(sec * FPS);

/// A camera move for a quiet shot: a slow push, pull or drift toward one of a few framings.
function quietMove(r) {
  const kind = r.pick(['push', 'pull', 'drift', 'drift']);
  const x0 = r.range(0.35, 0.65), y0 = r.range(0.35, 0.6);
  if (kind === 'push') return { kind: 'push', move: { z0: 1.02, z1: r.range(1.12, 1.22), x0, y0, x1: x0 + r.range(-0.05, 0.05), y1: y0 } };
  if (kind === 'pull') return { kind: 'pull', move: { z0: r.range(1.15, 1.25), z1: 1.02, x0, y0, x1: 0.5, y1: 0.5 } };
  return { kind: 'wide', move: { z0: 1.08, z1: 1.1, x0: x0 - 0.06, y0, x1: x0 + 0.06, y1: y0 } };
}

// ---------------------------------------------------------------- calm

function calm(subject, keys, lengthOf, vox, r) {
  const W = 1920, H = 1080;
  const shots = [], words = [], cards = [], audio = { vox: [] };
  const font = r.pick(['Baskerville', 'Didot', 'New York', 'Hoefler Text', 'Big Caslon']);
  const accent = r.pick(['#e8c27a', '#a9d6c4', '#d9b8a0', '#c9d3e6']);
  let t = 0, k = 0;
  const seen = {};
  const shot = (dur) => {
    const key = keys[k++ % keys.length];
    const q = quietMove(r);
    const used = (seen[key] = (seen[key] ?? -1) + 1);
    shots.push({ src: [key], f0: f(t), f1: f(t + dur), t0: Math.max(0, Math.min(lengthOf(key) - dur * 0.85, used * dur * 0.85)), speed: 0.85, ...q, tin: shots.length ? { type: 'dissolve', n: f(1.2) } : undefined });
  };
  // Opening: the title over the first picture, rising out of black.
  shot(6);
  cards.push({ f0: f(0.8), f1: f(5.6), kind: 'title', text: subject.title, sub: subject.when || '', font, accent, scrim: false, size: 92 });
  t = 6;
  // Data cards come between lines, at a calm pace.
  const facts = subject.facts || [];
  const stat = facts.find((x) => typeof x.value === 'number');
  const plan = [];
  vox.forEach((line, i) => {
    plan.push({ line, i });
    if (i === 1 && stat) plan.push({ card: { kind: 'stat', value: stat.value, unit: stat.unit || '', label: stat.label } });
    // Bars only say something when the numbers are of one kind and size; otherwise a second number card.
    const nums = facts.filter((x) => typeof x.value === 'number');
    const bars = subject.bars || nums;
    const spread = Math.max(...bars.map((x) => x.value)) / Math.max(1, Math.min(...bars.map((x) => x.value)));
    if (i === 3 && bars.length > 2 && spread < 25) plan.push({ card: { kind: 'bars', title: subject.barsTitle || 'By the numbers', rows: bars.slice(0, 6).map((x) => ({ label: x.label, value: x.value })) } });
    else if (i === 3 && nums[1]) plan.push({ card: { kind: 'stat', value: nums[1].value, unit: nums[1].unit || '', label: nums[1].label } });
    if (i === vox.length - 2 && subject.timeline?.length) plan.push({ card: { kind: 'timeline', title: subject.timelineTitle || 'How it came together', points: subject.timeline.slice(0, 6) } });
  });
  for (const p of plan) {
    if (p.card) {
      const dur = 5.5;
      shot(dur);
      cards.push({ f0: f(t + 0.4), f1: f(t + dur - 0.2), font, accent, ...p.card });
      t += dur;
      continue;
    }
    const dur = p.line.seconds + 1.6;
    shot(dur);
    audio.vox.push({ file: p.line.file, at: t + 0.6 });
    // Quiet subtitles, as on a documentary with the sound low.
    words.push({ f0: f(t + 0.6), f1: f(t + 0.6 + p.line.seconds + 0.3), text: p.line.text, style: 'subtitle', font: 'Avenir Next', size: 34, y: 0.9 });
    if (p.i === 0 && subject.lower) words.push({ f0: f(t + 0.3), f1: f(t + dur), text: subject.site || subject.short_title || '', sub: subject.lower, style: 'lower', font, size: 54, accent });
    t += dur;
  }
  // Close on the site's name.
  shot(5);
  cards.push({ f0: f(t + 0.6), f1: f(t + 5), kind: 'title', text: subject.site || 'anthonybecker.me', sub: subject.closing || 'made on a Mac mini', font, accent, size: 72 });
  t += 5;
  const frames = f(t);
  return {
    w: W, h: H, frames, shots, words, cards, palette: [accent, '#f4f1ea'],
    grade: 'contrast(1.04) saturate(0.9) brightness(0.97)',
    overlays: [{ kind: 'vignette', f0: 0, f1: frames, amount: 0.5 }, { kind: 'grain', f0: 0, f1: frames, amount: 0.05 }, { kind: 'letterbox', f0: 0, f1: frames, amount: 0.055 }, { kind: 'fade-in', f0: 0, f1: f(1.5) }, { kind: 'fade-out', f0: frames - f(2), f1: frames }],
    audio: { ...audio, music: { mood: 'calm', seconds: t, seed: r.int(1, 1e9) }, duck: true },
  };
}

// ---------------------------------------------------------------- hype

function hype(subject, keys, lengthOf, r, recent) {
  const W = 1920, H = 1080;
  const g = drawHype(r, recent);
  const beat = BEATS.find((b) => b.name === g.beat);
  const bpm = Math.round(r.range(...beat.bpm));
  const spb = 60 / bpm;
  const bars = r.pick([12, 14, 16]);
  const total = bars * 4 * spb;
  // Where the cuts fall, by the cut method.
  const cuts = [0];
  let at = 0, b = 0;
  while (at < total - spb) {
    let len;
    switch (g.cut) {
      case 'on-the-beat': len = spb * r.pick([1, 2, 2, 4]); break;
      case 'on-the-bar': len = spb * 4 * r.pick([1, 1, 2]); break;
      case 'accelerate': len = spb * Math.max(0.5, 4 - (at / total) * 3.5); break;
      case 'stutter': len = r() < 0.25 ? spb / 4 : spb * 2; break;
      case 'jump': len = spb * r.pick([0.5, 1, 1, 2]); break;
      case 'match': len = spb * 2; break;
      case 'off-beat': len = spb * (b++ === 0 ? 1.5 : r.pick([1, 2])); break;
      default: len = spb * 2;
    }
    at = Math.min(total, at + len);
    cuts.push(at);
  }
  if (cuts[cuts.length - 1] < total) cuts.push(total);
  const shots = [];
  let k = 0;
  const palette = g.palette;
  for (let i = 0; i < cuts.length - 1; i++) {
    const dur = cuts[i + 1] - cuts[i];
    const kind = g.shots[i % g.shots.length];
    const stutter = g.cut === 'stutter' && dur < spb;
    const key = stutter && shots.length ? shots[shots.length - 1].src[0] : keys[k++ % keys.length];
    const srcs = kind.startsWith('split') || kind === 'grid4' ? [0, 1, 2, 3].map((j) => keys[(k + j) % keys.length]) : [key];
    const x = r.range(0.25, 0.75), y = r.range(0.3, 0.7);
    const move = {
      z0: kind === 'macro' ? 2.4 : kind === 'pull' ? 1.6 : 1.0, z1: kind === 'macro' ? 2.6 : kind === 'push' ? 1.5 : 1.04,
      x0: x, y0: y, x1: g.cut === 'match' ? x : x + r.range(-0.1, 0.1), y1: y, rot: r.range(-0.12, 0.12) || 0.08, dir: r() < 0.5 ? 1 : -1, punch: r.range(1.4, 2.1),
    };
    const fx = r() < 0.55 ? [r.pick(g.effects)] : [];
    const tt = i > 0 && r() < 0.45 ? r.pick(g.transitions) : 'cut';
    shots.push({
      src: srcs, f0: f(cuts[i]), f1: f(cuts[i + 1]), kind, move, fx,
      t0: stutter ? shots[shots.length - 1]?.t0 ?? 0 : Math.max(0, lengthOf(srcs[0]) - dur - 0.2) * r(),
      speed: g.speedRamp ? r.pick([0.5, 1, 1, 1.8]) : 1,
      field: palette[i % 2],
      tin: tt === 'cut' ? undefined : { type: tt, n: Math.max(4, Math.min(f(dur) - 2, f(spb / 2))) },
    });
  }
  // Words: the subject's hype lines, in the drawn caption style, on the beat.
  const lines = subject.captions?.hype?.length ? subject.captions.hype : [subject.title];
  const words = [];
  const per = total / (lines.length + 1);
  lines.forEach((text, i) => {
    const t0 = Math.round(((i + 0.5) * per) / spb) * spb;
    words.push({
      f0: f(t0), f1: f(Math.min(total - 0.2, t0 + Math.max(spb * 4, per * 0.8))), text, style: g.captions, font: g.font,
      size: g.captions === 'label' ? 52 : g.captions === 'ticker' ? 46 : g.captions === 'card' ? 120 : 92, upper: !['type', 'label'].includes(g.captions),
      x: 0.5, y: g.captions === 'ticker' ? 0.88 : r.pick([0.22, 0.5, 0.78]), accent: palette[0], ink: '#fff', rot: r.range(-0.08, 0.08),
    });
  });
  // The last bar: the title and the site, slammed on.
  words.push({ f0: f(total - spb * 4), f1: f(total), text: subject.short_title || subject.title, style: 'stamp', font: g.font, size: 110, upper: true, x: 0.5, y: 0.45, accent: palette[0] });
  words.push({ f0: f(total - spb * 3), f1: f(total), text: subject.site || 'anthonybecker.me', style: 'plain', font: g.font2, weight: 700, size: 64, x: 0.5, y: 0.68, ink: '#ffffff' });
  const frames = f(total);
  const overlays = [{ kind: 'grain', f0: 0, f1: frames, amount: 0.07 }];
  if (g.letterbox) overlays.push({ kind: 'letterbox', f0: 0, f1: frames, amount: 0.09 });
  return {
    w: W, h: H, frames, shots, words, cards: [], palette, grade: GRADES.find((x) => x.name === g.grade).filter, overlays,
    grammar: g, fingerprint: fingerprint(g),
    audio: { vox: [], music: { mood: 'hype', seconds: total, seed: r.int(1, 1e9), beat: g.beat, bpm } },
  };
}

// ---------------------------------------------------------------- short

function short(subject, keys, lengthOf, vox, r) {
  const W = 1080, H = 1920, total = 10;
  const accent = r.pick(['#ffe14d', '#6dffa0', '#ff5ce1', '#3df5ff', '#ffb347']);
  const font = r.pick(['Arial Black', 'Futura', 'Impact', 'Avenir Next Condensed', 'Rockwell']);
  const n = Math.min(4, Math.max(3, keys.length));
  const shots = [];
  for (let i = 0; i < n; i++) {
    const key = keys[i % keys.length], dur = total / n;
    shots.push({
      src: [key], f0: f(i * dur), f1: f((i + 1) * dur), kind: i === 0 ? 'crash' : r.pick(['push', 'handheld', 'whip', 'wide']),
      move: { z0: 1, z1: 1.18, x0: 0.5, y0: r.range(0.4, 0.6), x1: 0.5, y1: 0.5, dir: 1, punch: 1.5 }, t0: Math.max(0, lengthOf(key) - dur) * r(),
      tin: i ? { type: r.pick(['flash', 'whip-up', 'zoom-through', 'glitch-slices']), n: 6 } : undefined,
    });
  }
  const words = [];
  // The hook first: two or three words, huge.
  words.push({ f0: 0, f1: f(2.4), text: subject.hook || subject.short_title || subject.title, style: 'box', font, size: 104, upper: true, y: 0.2, accent, boxInk: '#000' });
  const audio = { vox: [] };
  let t = 0.9;
  for (const line of vox) {
    audio.vox.push({ file: line.file, at: t });
    words.push({ f0: f(t), f1: f(Math.min(total - 1.7, t + line.seconds + 0.2)), text: line.text, style: 'phrases', font, size: 88, upper: true, accent });
    t += line.seconds + 0.25;
    if (t > total - 1.5) break;
  }
  words.push({ f0: f(total - 1.6), f1: f(total), text: subject.site || 'anthonybecker.me', style: 'card', font, size: 64, accent });
  const frames = f(total);
  return {
    w: W, h: H, frames, shots, words, cards: [], palette: [accent, '#ffffff'], grade: 'saturate(1.25) contrast(1.1)',
    overlays: [{ kind: 'progress', f0: 0, f1: frames, color: accent }, { kind: 'grain', f0: 0, f1: frames, amount: 0.05 }],
    audio: { ...audio, music: { mood: 'short', seconds: total, seed: r.int(1, 1e9), beat: r.pick(['four-floor', 'breakbeat', 'half-time']), bpm: r.int(120, 140) }, duck: true },
  };
}

if (process.argv[1] === import.meta.filename) {
  const [work, style, seed, recentPath] = process.argv.slice(2);
  const recent = recentPath ? JSON.parse(await readFile(recentPath, 'utf8')) : [];
  const edl = await direct(resolve(work), style, Number(seed) || 1, recent);
  console.log(style, edl.frames, 'frames', edl.grammar ? JSON.stringify(edl.fingerprint) : '');
}
