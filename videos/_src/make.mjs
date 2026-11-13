// Makes a subject's three videos, from footage to MP4s.
//   node make.mjs <work> [styles...]        styles default to: calm hype short
//
// <work>/subject.json must exist (see README.md). The steps, each skipped if its output is there:
//   footage   capture.mjs films every shot, wide and tall
//   voice     narrate.py speaks the calm and short narration (Kokoro, zpkt's voice package)
//   edit      direct.mjs writes each style's edit; the hype edit steers away from recent films
//   frames    shoot.mjs paints every frame in Chrome
//   sound     music.mjs renders the music; ffmpeg lays the voice over it, ducking the music
//   video     ffmpeg encodes <work>/<style>/<style>.mp4 and a poster
import { existsSync } from 'node:fs';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { direct } from './direct.mjs';
import { render, writeWav } from './music.mjs';

const HERE = import.meta.dirname;
const WORK = resolve(process.argv[2]);
const STYLES = process.argv.slice(3).length ? process.argv.slice(3) : ['calm', 'hype', 'short'];
const VOICE = `${process.env.HOME}/Desktop/zpkt/contrib/voice/.venv/bin/python`;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const subject = JSON.parse(await readFile(join(WORK, 'subject.json'), 'utf8'));
// A remake keeps its first seed, so the same films come out unless the subject sets a new one.
const before = existsSync(join(WORK, 'made.json')) ? JSON.parse(await readFile(join(WORK, 'made.json'), 'utf8')) : {};
const seed = subject.seed ?? before.seed ?? (Date.now() % 1e9);

if (!existsSync(join(WORK, 'footage'))) run('node', [join(HERE, 'capture.mjs'), WORK]);
for (const style of ['calm', 'short']) {
  if (STYLES.includes(style) && !existsSync(join(WORK, 'vox', `${style}.json`))) {
    run(VOICE, [join(HERE, 'narrate.py'), WORK, style], { cwd: `${process.env.HOME}/Desktop/zpkt/contrib/voice` });
  }
}
const recent = existsSync(join(WORK, 'recent.json')) ? JSON.parse(await readFile(join(WORK, 'recent.json'), 'utf8')) : [];
const made = {};
for (const [i, style] of STYLES.entries()) {
  const dir = join(WORK, style);
  const edl = await direct(WORK, style, seed + i * 7919, recent);
  await rm(join(dir, 'out'), { recursive: true, force: true });
  run('node', [join(HERE, 'shoot.mjs'), WORK, style]);
  // Music, then the voice laid over it.
  const m = edl.audio.music;
  writeWav(join(dir, 'music.wav'), render({ mood: m.mood, seconds: m.seconds + 0.5, seed: m.seed, beat: m.beat, bpm: m.bpm }));
  const inputs = ['-i', join(dir, 'music.wav')];
  const parts = [];
  edl.audio.vox.forEach((v, k) => {
    inputs.push('-i', join(WORK, 'vox', v.file));
    parts.push(`[${k + 1}:a]aresample=48000,adelay=${Math.round(v.at * 1000)}|${Math.round(v.at * 1000)},pan=stereo|c0=c0|c1=c0[v${k}]`);
  });
  let graph;
  if (parts.length) {
    const voices = edl.audio.vox.map((_, k) => `[v${k}]`).join('');
    graph = `${parts.join(';')};${voices}amix=inputs=${parts.length}:normalize=0,volume=1.6,asplit=2[vox][key];`
      + `[0:a]volume=${edl.style === 'calm' ? 0.55 : 0.7}[mus];[key]apad[keyp];[mus][keyp]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[ducked];`
      + `[ducked][vox]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  } else graph = '[0:a]loudnorm=I=-14:TP=-1.5:LRA=11[out]';
  run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[out]', '-ar', '48000', '-t', String(edl.frames / edl.fps), join(dir, 'mix.wav')]);
  const mp4 = join(dir, `${style}.mp4`);
  run('ffmpeg', ['-v', 'error', '-y', '-framerate', String(edl.fps), '-i', join(dir, 'out', '%04d.jpg'), '-i', join(dir, 'mix.wav'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', mp4]);
  // The poster: a frame a third of the way in, where the film has found its feet.
  const poster = join(dir, `${style}.jpg`);
  run('ffmpeg', ['-v', 'error', '-y', '-i', join(dir, 'out', `${String(Math.floor(edl.frames / 3)).padStart(4, '0')}.jpg`), '-vf', `scale=${edl.w > edl.h ? 960 : 540}:-2`, '-q:v', '4', poster]);
  made[style] = { mp4, poster, seconds: +(edl.frames / edl.fps).toFixed(2), w: edl.w, h: edl.h, fingerprint: edl.fingerprint, grammar: edl.grammar };
  console.log('made', mp4);
}
await writeFile(join(WORK, 'made.json'), JSON.stringify({ seed, made }, null, 1));
