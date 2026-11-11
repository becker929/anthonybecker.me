import { writeFileSync } from 'node:fs';
import { parseProg, progId, nextProg, PRULES, vocabMasks, voiceChord, voiceProg, romanName, absName, diatonic, Chord, ivs, QUALITIES } from './src/chords';
import { midiFile, buildZip, unzipAll, parse } from './src/rhythm';
import { readSet, setJson, rItemJson, pItemJson, mkP } from './src/sets';
import { emphasisMask } from './src/rhythm';
const ok = (c: boolean, m: string) => { if (!c) throw new Error('FAIL ' + m); console.log('ok', m); };
const seed = parseProg('0891-9912-2912-7892')!;
ok(progId(seed) === '0891-9912-2912-7892', 'id round trip');
ok(seed.map(romanName).join(' ') === 'Imaj7 vi7 ii7 V7', 'roman names: ' + seed.map(romanName).join(' '));
ok(seed.map((c) => absName(c, 5)).join(' ') === 'Fmaj7 Dm7 Gm7 C7', 'names in F');
ok(parseProg('0090') === null && parseProg('c890') === null && parseProg('') === null, 'rejects bad ids');
ok(new Set(QUALITIES.map((q) => q.mask)).size === QUALITIES.length, 'chord types are distinct');
ok(vocabMasks('jazz').length * 12 === 312 && vocabMasks('all').length === 2048, 'vocabulary sizes');
ok([0,1,2,3,4,5,6].map((d) => romanName(diatonic(d, 3, 'major'))).join(' ') === 'I ii iii IV V vi vii°', 'diatonic triads');
ok([0,1,2,3,4,5,6].map((d) => romanName(diatonic(d, 4, 'major'))).join(' ') === 'Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7', 'diatonic sevenths');
const cyc = (start: Chord[], rule: any, vocab: any) => { const seen = new Set<string>(); let c = start; while (!seen.has(progId(c))) { seen.add(progId(c)); c = nextProg(c, rule, vocab, 'major'); } return { n: seen.size, closes: progId(c) === progId(start) }; };
let c = cyc(parseProg('0890-0890')!, 'count', 'triads'); ok(c.n === 48 * 48 && c.closes, 'count visits all 2304 two-chord triad progressions');
c = cyc(parseProg('0890-0890-0890')!, 'diatonic', 'triads'); ok(c.n === 343 && c.closes, 'count in key visits 7^3');
c = cyc([{ root: 0, mask: 0x800 }], 'count', 'all'); ok(c.n === 24576 && c.closes, 'count visits all 24576 chords');
c = cyc(parseProg('7892')!, 'fourthsC', 'sevenths'); ok(c.n === 12, 'chromatic fourths passes 12 roots');
c = cyc(parseProg('0891')!, 'fourths', 'sevenths'); ok(c.n === 7, 'in-key fourths passes 7 degrees');
ok(nextProg(parseProg('2912-7892')!, 'fourths', 'sevenths', 'major').map(romanName).join(' ') === 'V7 Imaj7', 'ii V goes to V I');
for (const r of PRULES) { let p = seed; for (let i = 0; i < 300; i++) { p = nextProg(p, r.id, 'jazz', 'minor'); if (p.length !== 4 || !parseProg(progId(p))) throw new Error('bad output from ' + r.id); } }
ok(true, 'all rules keep valid progressions over 300 steps');
{ const seen = new Set<number>(); let p: Chord[] = [{ root: 0, mask: 0x890 }]; for (let i = 0; i < 60000; i++) { p = nextProg(p, 'voice', 'all', 'major'); seen.add(p[0].mask); } ok(seen.size > 900, 'move one voice wanders widely: ' + seen.size + ' sets'); }
// voicing
const C7 = parseProg('0892')![0];
ok(voiceChord(C7, 0, 0, 0, null).join() === '48,52,55,58', 'root position');
ok(voiceChord(C7, 0, 1, 0, null).join() === '52,55,58,60', 'first inversion');
ok(voiceChord(C7, 0, 0, 2, null).join() === '48,52', 'density 2 keeps root and third');
ok(voiceChord(C7, 0, 0, 3, null).join() === '48,52,58', 'density 3 drops the fifth');
ok(voiceChord(C7, 0, 0, 6, null).join() === '48,52,55,58,60,64', 'density 6 doubles');
{ const v = voiceProg(seed, 0, -1, 0); let move = 0; for (let i = 1; i < 4; i++) move += Math.abs(v[i].reduce((a, b) => a + b) / 4 - v[i - 1].reduce((a, b) => a + b) / 4); const rp = voiceProg(seed, 0, 0, 0); let m2 = 0; for (let i = 1; i < 4; i++) m2 += Math.abs(rp[i].reduce((a, b) => a + b) / 4 - rp[i - 1].reduce((a, b) => a + b) / 4); ok(move < m2, `smooth voicing moves less (${move.toFixed(1)} vs ${m2.toFixed(1)})`); console.log(v.map((x) => x.join(',')).join(' | ')); }
for (const q of vocabMasks('all').filter((_, i) => i % 37 === 0)) for (const d of [0, 2, 4, 6]) for (const inv of [-1, 0, 3]) { const v = voiceChord({ root: 3, mask: q }, 7, inv, d, [50, 55, 60]); if (!v.length || v.some((x) => x < 36 || x > 100) || v.some((x, i) => i && x <= v[i - 1])) throw new Error('bad voicing ' + q + ' ' + v); }
ok(true, 'voicings stay ordered and in range');
// sets
const rdoc = setJson('rhythm', { bpm: 100 }, [{ ...parse('16.9228')!, id: '16.9228', emph: 'back', hearts: 2 }, { ...parse('16.9228')!, id: '16.9228', emph: 'back', hearts: 1 }, { ...parse('16.8888')!, id: '16.8888', emph: 'none', hearts: 0 }].map(rItemJson as any));
let L: any = readSet(rdoc); ok(L.type === 'rhythm' && L.items.length === 2 && L.items[0].hearts === 3 && L.items[1].hearts === 0 && L.items[0].mask === emphasisMask('back', 16), 'rhythm history merges duplicates, keeps all, most hearts first');
const pdoc = setJson('progression', {}, [mkP(seed, 2, 3, 0), mkP(parseProg('0890')!, -1, 0, 4)].map(pItemJson));
L = readSet(buildZip([{ name: 'a.mid', data: new Uint8Array([1]) }, { name: 'h.json', data: pdoc }])); ok(L.type === 'progression' && L.items.length === 2 && L.items[0].hearts === 4 && L.items[1].inv === 2 && L.items[1].dens === 3, 'progression history loads from a history zip');
ok('error' in readSet(new TextEncoder().encode('{"a":1}')) && 'error' in readSet(new Uint8Array([1, 2, 3])), 'rejects other files');
ok(unzipAll(buildZip([{ name: 'a', data: new Uint8Array([1, 2]) }, { name: 'b.txt', data: new Uint8Array([3]) }])).map((f) => f.name + f.data.length).join() === 'a2,b.txt1', 'unzip all');
// midi
const notes = voiceProg(seed, 0, -1, 0).flatMap((v, i) => v.map((n) => ({ t: i * 1920, d: 1910, ch: 0, n, v: 96 })));
writeFileSync('/tmp/chords.mid', midiFile(notes, seed.map((c, i) => ({ t: i * 1920, text: romanName(c) + ' ø♭°' })), 96, 'Imaj7 test', 4 * 1920));
console.log('all passed');
