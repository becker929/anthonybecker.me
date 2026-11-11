import React, { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { getStep, parse, buildZip, midiFile, MNote, STEP } from './rhythm';
import { NOTES, romanName, absName, parseProg, voiceProg } from './chords';
import { VOICES } from './synth';
import { SOUNDS } from './audio';
import { readSet, mkR, mkP, rItemJson, pItemJson, setJson } from './sets';
import { actions, getState, subscribe, XRULES, XRule, Pair, stepsPerChord, accentAt } from './comboStore';
import { Stepper, Chips, Pick, Transport, HistoryCard, Toast, useFlash, REPEATS, loopText, saveFile, heartsText, HEART } from './ui';

const SPC = [
  { v: 4, l: '4' },
  { v: 8, l: '8' },
  { v: 16, l: '16' },
  { v: 32, l: '32' },
  { v: 0, l: 'Rhythm length' },
];

function App() {
  const s = useSyncExternalStore(subscribe, getState);
  const [text, setText] = useState('');
  const [msg, flash] = useFlash();
  const fileRef = useRef<HTMLInputElement>(null);
  const e = s.history[s.cur];
  const rule = XRULES.find((r) => r.id === s.rule)!;
  const per = stepsPerChord(e, s.spc);
  const rpos = s.playing && s.step >= 0 ? s.step % e.r.r.len : -1;
  const cpos = s.playing && s.step >= 0 ? Math.floor(s.step / per) : -1;
  const heard = useMemo(() => {
    const rs = new Set(s.rhythms.map((r) => r.id));
    const ps = new Set(s.progs.map((p) => p.id));
    return new Set(s.history.filter((h) => rs.has(h.r.id) && ps.has(h.p.id)).map((h) => h.id)).size;
  }, [s.hv, s.rhythms, s.progs]);
  const rows = useMemo(() => s.history.map((h) => ({ id: h.id, hearts: h.hearts, note: h.src })), [s.hv]);

  const loadFile = async (f: File | undefined) => {
    if (!f) return;
    const res = readSet(new Uint8Array(await f.arrayBuffer()));
    if ('error' in res) return flash(res.error);
    if (res.type === 'rhythm') {
      actions.loadRhythms(res.items);
      flash(`Loaded ${res.items.length} rhythms, ${res.note}.`);
    } else {
      actions.loadProgs(res.items);
      flash(`Loaded ${res.items.length} progressions, ${res.note}.`);
    }
  };
  const addText = () => {
    const r = parse(text);
    const p = r ? null : parseProg(text);
    if (r) actions.addRhythm(mkR(r, 'none', 0));
    else if (p) actions.addProg(mkP(p, -1, 0, 0));
    else return flash('Enter a rhythm ID like 16.9228 or a progression ID like 0891-7892.');
    setText('');
    flash(r ? 'Added the rhythm.' : 'Added the progression.');
  };

  const midi = (pairs: Pair[], title: string) => {
    const notes: MNote[] = [];
    const marks: { t: number; text: string }[] = [];
    let base = 0;
    for (const x of pairs) {
      const sp = stepsPerChord(x, s.spc);
      const total = x.p.chords.length * sp;
      const voiced = voiceProg(x.p.chords, s.key, x.p.inv, x.p.dens);
      marks.push({ t: base, text: `${x.id} hearts=${x.hearts}` });
      const hits: number[] = [];
      for (let i = 0; i < total; i++) if (getStep(x.r.r, i % x.r.r.len)) hits.push(i);
      hits.forEach((i, k) => {
        const rp = i % x.r.r.len;
        const v = x.r.mask === 0n ? 100 : accentAt(x.r, rp) ? 120 : 60;
        const d = Math.min(((hits[k + 1] ?? total) - i) * STEP - 10, 4 * 480);
        for (const m of voiced[Math.floor(i / sp)]) notes.push({ t: base + i * STEP, d, ch: 0, n: m, v });
        if (s.drum >= 0) notes.push({ t: base + i * STEP, d: STEP / 2, ch: 9, n: SOUNDS[s.drum].note, v });
      });
      base += total * STEP;
    }
    return midiFile(notes, marks, s.bpm, title, base);
  };
  const favorites = () =>
    setJson(
      'pair',
      { key: NOTES[s.key], bpm: s.bpm, stepsPerChord: s.spc || 'rhythm length' },
      s.history.map((x) => ({ id: x.id, hearts: x.hearts, source: x.src, rhythm: rItemJson({ id: x.r.id, len: x.r.r.len, v: x.r.r.v, emph: x.r.emph, hearts: x.r.hearts }), progression: pItemJson(x.p) })),
    );
  const fname = (x: Pair) => 'pair-' + x.r.id.replace('.', '-') + '_' + x.p.id;
  const exportOne = () => saveFile(`${fname(e)}.zip`, buildZip([{ name: `${fname(e)}.mid`, data: midi([e], e.id) }]), flash, `Saved ${fname(e)}.zip. Unzip it to get the .mid file.`);
  const exportHistory = () => {
    const base = `pairing-history-${s.history.length}`;
    const lines = s.history.map((x, i) => `${String(i + 1).padStart(4)}  ${heartsText(x.hearts).padEnd(8)}  ${x.id}  ${x.p.chords.map(romanName).join(' ')}`.trimEnd());
    const txt = `Pairing history: ${s.history.length} pairs, ${s.history.filter((x) => x.hearts).length} hearted, key of ${NOTES[s.key]}, ${s.bpm} BPM\n\n${lines.join('\n')}\n`;
    saveFile(`${base}.zip`, buildZip([{ name: `${base}.mid`, data: midi(s.history, `${s.history.length} pairs`) }, { name: `${base}.txt`, data: new TextEncoder().encode(txt) }, { name: `${base}.json`, data: favorites() }]), flash, `Saved ${base}.zip with 3 files.`);
  };

  return (
    <main className="app">
      <header className="top">
        <h1>Pairing</h1>
        <span className="where">
          Pair {s.cur + 1} of {s.history.length}
        </span>
      </header>

      <section className="card now" aria-label="Current pair">
        <div className="id small">
          {e.r.id}
          <br />
          {e.p.id}
        </div>
        <p className="meta">
          <span className="tag">{e.src}</span>
          {e.hearts > 0 ? (
            <button className="unheart" onClick={() => actions.heart(-1)}>
              Remove a heart
            </button>
          ) : null}
          <span className="loops">{loopText(s.playing, s.loop, s.repeat)}</span>
        </p>
        <div className={'grid' + (e.r.mask ? ' hasem' : '')} aria-label="Rhythm">
          {Array.from({ length: e.r.r.len }, (_, i) => (
            <div key={i} className={'cell' + (getStep(e.r.r, i) ? ' on' : '') + (i % 4 === 0 ? ' beat' : '') + (i === rpos ? ' now' : '') + (accentAt(e.r, i) ? ' em' : '')} />
          ))}
        </div>
        <div className="slots" aria-label="Chords">
          {e.p.chords.map((c, i) => (
            <div key={i} className={'slot' + (i === cpos ? ' now' : '')}>
              <b>{romanName(c)}</b>
              <small>{absName(c, s.key)}</small>
            </div>
          ))}
        </div>
        <Transport canBack={s.cur > 0} playing={s.playing} hearts={e.hearts} onBack={actions.back} onToggle={actions.toggle} onNext={actions.next} onHeart={() => actions.heart(1)} />
      </section>

      <section className="card" aria-label="Next pair rule">
        <Pick id="rule" label="Next pair" value={s.rule} options={XRULES.map((r) => ({ v: r.id, l: r.label }))} onChange={(v) => actions.set({ rule: v as XRule })} help={rule.help} />
        <p className="help">
          {s.rhythms.length} rhythms × {s.progs.length} progressions = {s.rhythms.length * s.progs.length} pairs. {heard} heard so far.
        </p>
        <Chips id="replab" label="Loops before next" options={REPEATS} value={s.repeat} onChange={(v) => actions.set({ repeat: v })} />
      </section>

      <section className="card" aria-label="Favorites">
        <span className="lab">
          Rhythms ({s.rhythms.length}){s.rEx ? ', examples' : s.rhythms.length > 60 ? ', top 60 shown' : ''}
        </span>
        <div className="setlist">
          {s.rhythms.slice(0, 60).map((r) => (
            <button key={r.id} className={'chip set' + (r.id === e.r.id ? ' sel' : '')} onClick={() => actions.pick(r, null)}>
              <span className="mono">{r.id}</span>
              <span>
                {HEART} {r.hearts}
              </span>
            </button>
          ))}
        </div>
        <span className="lab">
          Progressions ({s.progs.length}){s.pEx ? ', examples' : s.progs.length > 60 ? ', top 60 shown' : ''}
        </span>
        <div className="setlist">
          {s.progs.slice(0, 60).map((p) => (
            <button key={p.id} className={'chip set' + (p.id === e.p.id ? ' sel' : '')} onClick={() => actions.pick(null, p)}>
              <span>{p.chords.map(romanName).join(' ')}</span>
              <span>
                {HEART} {p.hearts}
              </span>
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Load a history file
        </button>
        <input
          ref={fileRef}
          id="file"
          type="file"
          accept=".json,.zip,application/json,application/zip"
          hidden
          onChange={(ev) => {
            loadFile(ev.target.files?.[0]);
            ev.target.value = '';
          }}
        />
        <p className="help">Load the history zip from Onset, then the one from Cadence. Each replaces its side. Every entry loads, and more hearts means more turns.</p>
        <div className="field">
          <label htmlFor="add">Add one by ID</label>
          <form
            className="loadrow"
            onSubmit={(ev) => {
              ev.preventDefault();
              addText();
            }}
          >
            <input id="add" type="text" value={text} placeholder="16.9228 or 0891-7892" autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(ev) => setText(ev.target.value)} />
            <button className="btn" type="submit">
              Add
            </button>
          </form>
        </div>
      </section>

      <section className="card" aria-label="Playback">
        <Chips id="spclab" label="Steps per chord" options={SPC} value={s.spc} onChange={(v) => actions.set({ spc: v })} />
        <p className="help">Every onset strikes the current chord. Emphasized onsets play louder. The rhythm repeats under each chord.</p>
        <div className="pair">
          <Pick id="key" label="Key" value={s.key} options={NOTES.map((nm, i) => ({ v: i, l: nm }))} onChange={(v) => actions.set({ key: +v })} />
          <Pick id="drum" label="Drum layer" value={s.drum} options={[{ v: -1, l: 'None' }, ...SOUNDS.map((x, i) => ({ v: i, l: x.label }))]} onChange={(v) => actions.set({ drum: +v })} />
        </div>
        <Chips id="voicelab" label="Chord sound" options={VOICES} value={s.voice} onChange={(v) => actions.set({ voice: v })} />
        <Stepper id="bpm" label="BPM" value={s.bpm} min={30} max={300} onChange={(b) => actions.set({ bpm: b })} />
      </section>

      <section className="card" aria-label="Export">
        <div className="row2">
          <button className="btn" onClick={exportOne}>
            Export MIDI
          </button>
          <button className="btn" onClick={exportHistory}>
            Export history
          </button>
        </div>
        <p className="help">MIDI holds the chords with emphasis as velocity, plus the drum layer on channel 10 when it is on.</p>
      </section>

      <HistoryCard rows={rows} cur={s.cur} hv={s.hv} onJump={actions.jump} />
      <Toast msg={msg} />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
