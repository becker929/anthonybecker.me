import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { PRULES, PRule, VOCABS, VocabId, QUALITIES, NOTES, IV_NAMES, INVERSIONS, DENSITIES, MAX_CHORDS, Chord, hasIv, romanName, absName, degreeName, qualityKey, parseProg, voiceProg, Mode } from './chords';
import { VOICES } from './synth';
import { buildZip, midiFile, MNote, PPQ } from './rhythm';
import { pItemJson, setJson } from './sets';
import { actions, getState, subscribe, PEntry } from './chordStore';
import { Stepper, Chips, Pick, Transport, HistoryCard, Toast, useFlash, REPEATS, loopText, saveFile, heartsText } from './ui';

const opt = <T extends { id: string; label: string }>(a: T[]) => a.map((x) => ({ v: x.id, l: x.label }));

function App() {
  const s = useSyncExternalStore(subscribe, getState);
  const [sel, setSel] = useState(0);
  const [text, setText] = useState('');
  const [msg, flash] = useFlash();
  const entry = s.history[s.cur];
  const n = entry.chords.length;
  const si = Math.min(sel, n - 1);
  const chord = entry.chords[si];
  const rule = PRULES.find((r) => r.id === s.rule)!;
  const vocab = VOCABS.find((r) => r.id === s.vocab)!;
  const voiced = voiceProg(entry.chords, s.key, entry.inv, entry.dens);
  const rows = useMemo(() => s.history.map((e) => ({ id: e.id, hearts: e.hearts, note: e.src })), [s.hv]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(entry.id);
      flash(`Copied ${entry.id}`);
    } catch {
      flash('Copy is blocked here. Select the ID text and copy it.');
    }
  };
  const loadText = () => {
    const cs = parseProg(text);
    if (!cs) return flash('That is not a progression ID. Enter one like 0891-9912-2912-7892.');
    actions.load(cs);
    setText('');
    flash(`Loaded ${cs.length} chords.`);
  };

  const midi = (entries: PEntry[], title: string) => {
    const notes: MNote[] = [];
    const marks: { t: number; text: string }[] = [];
    const per = s.beats * PPQ;
    let base = 0;
    for (const e of entries) {
      marks.push({ t: base, text: `${e.id} hearts=${e.hearts}` });
      voiceProg(e.chords, s.key, e.inv, e.dens).forEach((v, i) => {
        marks.push({ t: base + i * per, text: `${romanName(e.chords[i])} ${absName(e.chords[i], s.key)}` });
        for (const m of v) notes.push({ t: base + i * per, d: per - 10, ch: 0, n: m, v: 96 });
      });
      base += e.chords.length * per;
    }
    return midiFile(notes, marks, s.bpm, title, base);
  };
  const favorites = () => setJson('progression', { key: NOTES[s.key], mode: s.mode, bpm: s.bpm, beatsPerChord: s.beats }, s.history.map(pItemJson));
  const exportOne = () => {
    const base = 'cadence-' + entry.id;
    saveFile(`${base}.zip`, buildZip([{ name: `${base}.mid`, data: midi([entry], entry.id) }]), flash, `Saved ${base}.zip. Unzip it to get the .mid file.`);
  };
  const exportHistory = () => {
    const base = `cadence-history-${s.history.length}`;
    const w = Math.max(2, ...s.history.map((e) => e.id.length));
    const lines = s.history.map((e, i) => `${String(i + 1).padStart(4)}  ${e.id.padEnd(w)}  ${heartsText(e.hearts).padEnd(8)}  ${e.chords.map(romanName).join(' ')}`.trimEnd());
    const txt = `Cadence history: ${s.history.length} progressions, ${s.history.filter((e) => e.hearts).length} hearted, key of ${NOTES[s.key]} ${s.mode}\n\n${lines.join('\n')}\n`;
    saveFile(
      `${base}.zip`,
      buildZip([
        { name: `${base}.mid`, data: midi(s.history, `${s.history.length} progressions`) },
        { name: `${base}.txt`, data: new TextEncoder().encode(txt) },
        { name: `${base}.json`, data: favorites() },
      ]),
      flash,
      `Saved ${base}.zip with 3 files.`,
    );
  };

  return (
    <main className="app">
      <header className="top">
        <h1>Cadence</h1>
        <span className="where">
          Progression {s.cur + 1} of {s.history.length}
        </span>
      </header>

      <section className="card now" aria-label="Current progression">
        <button className="id small" onClick={copyId} title="Copy ID">
          {entry.id}
        </button>
        <p className="meta">
          <span>
            {n} {n === 1 ? 'chord' : 'chords'} in {NOTES[s.key]} {s.mode}
          </span>
          <span className="tag">{entry.src}</span>
          {entry.hearts > 0 ? (
            <button className="unheart" onClick={() => actions.heart(-1)}>
              Remove a heart
            </button>
          ) : null}
          <span className="loops">{loopText(s.playing, s.loop, s.repeat)}</span>
        </p>
        <div className="slots" role="group" aria-label="Chords">
          {entry.chords.map((c, i) => (
            <button
              key={i}
              className={'slot' + (i === si ? ' sel' : '') + (s.playing && i === s.step ? ' now' : '')}
              aria-pressed={i === si}
              onClick={() => {
                setSel(i);
                actions.audition(i);
              }}
            >
              <b>{romanName(c)}</b>
              <small>{absName(c, s.key)}</small>
            </button>
          ))}
        </div>
        <Transport canBack={s.cur > 0} playing={s.playing} hearts={entry.hearts} onBack={actions.back} onToggle={actions.toggle} onNext={actions.next} onHeart={() => actions.heart(1)} />
      </section>

      <section className="card" aria-label="Edit chord">
        <span className="lab">
          Chord {si + 1}: {romanName(chord)}, {absName(chord, s.key)}
        </span>
        <div className="six" role="radiogroup" aria-label="Root">
          {NOTES.map((_, r) => (
            <button key={r} role="radio" aria-checked={chord.root === r} className={'chip' + (chord.root === r ? ' sel' : '')} onClick={() => actions.setChord(si, { root: r, mask: chord.mask })}>
              {degreeName(r)}
            </button>
          ))}
        </div>
        <Pick
          id="qual"
          label="Chord type"
          value={qualityKey(chord)}
          options={[...(qualityKey(chord) ? [] : [{ v: '', l: 'Custom' }]), ...QUALITIES.map((q) => ({ v: q.key, l: q.key }))]}
          onChange={(k) => {
            const q = QUALITIES.find((x) => x.key === k);
            if (q) actions.setChord(si, { root: chord.root, mask: q.mask });
          }}
        />
        <div className="field">
          <span className="lab" id="ivlab">
            Notes above the root
          </span>
          <div className="six" role="group" aria-labelledby="ivlab">
            {IV_NAMES.map((nm, i) => (
              <button
                key={i}
                className={'cell iv' + (hasIv(chord, i) ? ' on' : '')}
                aria-pressed={hasIv(chord, i)}
                disabled={i === 0}
                onClick={() => actions.setChord(si, { root: chord.root, mask: chord.mask ^ (1 << (11 - i)) })}
              >
                {nm}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card" aria-label="Next progression rule">
        <Pick id="rule" label="Next progression" value={s.rule} options={opt(PRULES)} onChange={(v) => actions.set({ rule: v as PRule })} help={rule.help} />
        <Pick id="vocab" label="Chord vocabulary" value={s.vocab} options={opt(VOCABS)} onChange={(v) => actions.set({ vocab: v as VocabId })} help={vocab.help} />
        <Chips id="replab" label="Loops before next" options={REPEATS} value={s.repeat} onChange={(v) => actions.set({ repeat: v })} />
      </section>

      <section className="card" aria-label="Voicing">
        <Chips id="invlab" label="Inversion" options={INVERSIONS} value={entry.inv} onChange={(v) => actions.setVoicing({ inv: v })} />
        <Chips id="denslab" label="Density, notes per chord" options={DENSITIES} value={entry.dens} onChange={(v) => actions.setVoicing({ dens: v })} />
        <p className="help">
          Sounding now: {voiced[si].map((m) => NOTES[m % 12] + (Math.floor(m / 12) - 1)).join(' ')}. Smooth picks the inversion nearest the chord before. Low density drops the fifth first; high density doubles notes an octave up.
        </p>
        <Chips id="voicelab" label="Sound" options={VOICES} value={s.voice} onChange={(v) => actions.set({ voice: v })} />
      </section>

      <section className="card" aria-label="Key, tempo and length">
        <div className="pair">
          <Pick id="key" label="Key" value={s.key} options={NOTES.map((nm, i) => ({ v: i, l: nm }))} onChange={(v) => actions.set({ key: +v })} />
          <Chips id="modelab" label="Mode" options={[{ v: 'major', l: 'Major' }, { v: 'minor', l: 'Minor' }]} value={s.mode} onChange={(v) => actions.set({ mode: v as Mode })} />
        </div>
        <Stepper id="count" label="Chords" value={n} min={1} max={MAX_CHORDS} onChange={actions.setCount} />
        <Chips id="beatlab" label="Beats per chord" options={[1, 2, 4, 8].map((b) => ({ v: b, l: String(b) }))} value={s.beats} onChange={(v) => actions.set({ beats: v })} />
        <Stepper id="bpm" label="BPM" value={s.bpm} min={30} max={300} onChange={(b) => actions.set({ bpm: b })} />
      </section>

      <section className="card" aria-label="Load and export">
        <div className="field">
          <label htmlFor="load">Load a progression</label>
          <form
            className="loadrow"
            onSubmit={(e) => {
              e.preventDefault();
              loadText();
            }}
          >
            <input id="load" type="text" value={text} placeholder="0891-9912-2912-7892" autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => setText(e.target.value)} />
            <button className="btn" type="submit">
              Load
            </button>
          </form>
        </div>
        <div className="row2">
          <button className="btn" onClick={exportOne}>
            Export MIDI
          </button>
          <button className="btn" onClick={exportHistory}>
            Export history
          </button>
        </div>
        <p className="help">MIDI uses the current key, voicing and BPM. History export adds every progression with its hearts. Load that zip in the Pairing machine.</p>
      </section>

      <HistoryCard rows={rows} cur={s.cur} hv={s.hv} onJump={actions.jump} />
      <Toast msg={msg} />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
