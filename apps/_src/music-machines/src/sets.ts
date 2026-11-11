// The history list every machine writes into its history zip, and the pairing machine reads.
import { Rhythm, EmphId, EMPHASIS, emphasisMask, parse, getStep, toId, unzipAll } from './rhythm';
import { Chord, parseProg, progId, romanName } from './chords';

export const FORMAT = 'machine-set';
export interface RItem { id: string; r: Rhythm; emph: EmphId; mask: bigint; hearts: number }
export interface PItem { id: string; chords: Chord[]; inv: number; dens: number; hearts: number }

export const mkR = (r: Rhythm, emph: EmphId, hearts: number): RItem => ({ id: toId(r), r, emph, mask: emphasisMask(emph, r.len), hearts });
export const mkP = (chords: Chord[], inv: number, dens: number, hearts: number): PItem => ({ id: progId(chords), chords, inv, dens, hearts });

export const rItemJson = (e: { id: string; len: number; v: bigint; emph: EmphId; hearts: number; src?: string }) => ({
  id: e.id,
  hearts: e.hearts,
  emphasis: e.emph,
  emphasisMap: toId({ len: e.len, v: emphasisMask(e.emph, e.len) }),
  pattern: Array.from({ length: e.len }, (_, k) => (getStep(e, k) ? 'x' : '.')).join(''),
  ...(e.src ? { source: e.src } : {}),
});
export const pItemJson = (e: { id: string; chords: Chord[]; inv: number; dens: number; hearts: number; src?: string }) => ({
  id: e.id,
  hearts: e.hearts,
  inversion: e.inv,
  density: e.dens,
  chords: e.chords.map(romanName).join(' '),
  ...(e.src ? { source: e.src } : {}),
});
export const setJson = (type: 'rhythm' | 'progression' | 'pair', extra: object, items: object[]) =>
  new TextEncoder().encode(JSON.stringify({ format: FORMAT, version: 1, type, ...extra, items }, null, 1));

export type Loaded = { type: 'rhythm'; items: RItem[]; note: string } | { type: 'progression'; items: PItem[]; note: string } | { error: string };

// Reads the history .zip a machine exports (or the .json inside it). Duplicate IDs merge and their hearts add up.
// Everything loads, most hearts first.
export function readSet(d: Uint8Array): Loaded {
  let doc: any;
  try {
    if (d[0] === 0x50 && d[1] === 0x4b) {
      const f = unzipAll(d).find((x) => x.name.endsWith('.json'));
      if (!f) return { error: 'That zip is not a history export. Use Export history in Onset or Cadence.' };
      d = f.data;
    }
    doc = JSON.parse(new TextDecoder().decode(d));
  } catch {
    return { error: 'Could not read that file. Choose a history .zip from Onset or Cadence.' };
  }
  // Onset histories exported before the shared format: a bare list under "rhythms", emphasis stored by label.
  if (doc && !doc.format && Array.isArray(doc.rhythms)) doc = { format: FORMAT, type: 'rhythm', items: doc.rhythms };
  if (!doc || doc.format !== FORMAT || !Array.isArray(doc.items)) return { error: 'That file is not a history export from these machines.' };
  if (doc.type !== 'rhythm' && doc.type !== 'progression') return { error: 'Load an Onset or Cadence history here, not a Pairing history.' };
  const merged = new Map<string, any>();
  for (const it of doc.items) {
    if (!it || typeof it.id !== 'string') continue;
    const h = it.hearts > 0 ? it.hearts | 0 : 0;
    const have = merged.get(it.id);
    if (have) have.hearts += h;
    else merged.set(it.id, { ...it, hearts: h });
  }
  const all = [...merged.values()].sort((x, y) => y.hearts - x.hearts);
  const note = `${all.filter((x) => x.hearts > 0).length} hearted`;
  if (doc.type === 'rhythm') {
    const items: RItem[] = [];
    for (const it of all) {
      const r = parse(it.id);
      if (r) items.push(mkR(r, (EMPHASIS.find((e) => e.id === it.emphasis || e.label === it.emphasis) || EMPHASIS[0]).id, it.hearts));
    }
    return items.length ? { type: 'rhythm', items, note } : { error: 'That file has no readable rhythms.' };
  }
  const items: PItem[] = [];
  for (const it of all) {
    const cs = parseProg(it.id);
    if (cs) items.push(mkP(cs, it.inversion >= -1 && it.inversion <= 3 ? it.inversion | 0 : -1, it.density >= 0 && it.density <= 6 ? it.density | 0 : 0, it.hearts));
  }
  return items.length ? { type: 'progression', items, note } : { error: 'That file has no readable progressions.' };
}
