import React, { memo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { RULES, RuleId, EMPHASIS, EmphId, getStep, onsets, toId, parse, parseMidi, unzipStored, writeMidi, buildZip, MAX_LEN } from './rhythm';
import { SOUNDS } from './audio';
import { actions, getState, subscribe, Entry } from './store';
import { rItemJson, setJson } from './sets';

const REPEATS = [0, 1, 2, 4, 8, 16, 32];
const LENGTHS = [8, 12, 16, 24, 32, 64, 128];

const Grid = memo(function Grid({ entry, step }: { entry: Entry; step: number }) {
  const cells = [];
  for (let i = 0; i < entry.len; i++) {
    const on = getStep(entry, i);
    const em = ((entry.mask >> BigInt(entry.len - 1 - i)) & 1n) === 1n;
    cells.push(
      <button
        key={i}
        className={'cell' + (on ? ' on' : '') + (i % 4 === 0 ? ' beat' : '') + (i === step ? ' now' : '') + (em ? ' em' : '')}
        aria-pressed={on}
        aria-label={`Step ${i + 1}${em ? ', emphasized' : ''}`}
        onClick={() => actions.toggleStep(i)}
      >
        {i % 16 === 0 ? <i>{i / 16 + 1}</i> : null}
      </button>,
    );
  }
  return (
    <div className={"grid" + (entry.mask ? " hasem" : "")} role="group" aria-label="Steps">
      {cells}
    </div>
  );
});

const HEART = '\u2665\uFE0E';
const emphLabel = (id: EmphId) => EMPHASIS.find((e) => e.id === id)!.label;

const History = memo(function History({ history, cur, only }: { history: Entry[]; cur: number; hv: number; only: boolean }) {
  const rows = [];
  for (let i = history.length - 1; i >= 0 && rows.length < 200; i--) {
    const e = history[i];
    if (only && !e.hearts) continue;
    rows.push(
      <li key={i}>
        <button className={'hrow' + (i === cur ? ' sel' : '')} aria-current={i === cur} onClick={() => actions.jump(i)}>
          <span className="hn">{i + 1}</span>
          <span className="hid">{e.id}</span>
          <span className="hsrc">
            {e.hearts > 0 ? (
              <b className="hh">
                {HEART} {e.hearts}
              </b>
            ) : null}
            <span>{e.emph === 'none' ? e.src : `${e.src} · ${emphLabel(e.emph)}`}</span>
          </span>
        </button>
      </li>,
    );
  }
  if (!rows.length) return <p className="help">No hearted rhythms yet.</p>;
  return <ol className="history">{rows}</ol>;
});

function emitHearts(from: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = from.getBoundingClientRect();
  for (let i = 0; i < 7; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    p.textContent = HEART;
    p.style.left = r.left + r.width / 2 + 'px';
    p.style.top = r.top + r.height / 2 + 'px';
    p.style.setProperty('--dx', Math.round(Math.random() * 140 - 70) + 'px');
    p.style.setProperty('--dy', -Math.round(60 + Math.random() * 110) + 'px');
    p.style.setProperty('--rot', Math.round(Math.random() * 80 - 40) + 'deg');
    p.style.setProperty('--sc', (0.8 + Math.random() * 1.1).toFixed(2));
    p.style.animationDelay = Math.round(Math.random() * 90) + 'ms';
    p.addEventListener('animationend', () => p.remove());
    document.body.appendChild(p);
  }
}

function Stepper({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <label htmlFor={id}>{label}</label>
      <div className="srow">
        <button className="btn sq" aria-label={`${label} down`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} />
        <button className="btn sq" aria-label={`${label} up`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
        <output htmlFor={id}>{value}</output>
      </div>
    </div>
  );
}

function toBase64(d: Uint8Array) {
  let s = '';
  d.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function App() {
  const s = useSyncExternalStore(subscribe, getState);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [only, setOnly] = useState(false);
  const msgTimer = useRef<any>(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const flash = (m: string) => {
    setMsg(m);
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(''), 4000);
  };

  const entry = s.history[s.cur];
  const rule = RULES.find((r) => r.id === s.rule)!;
  const count = onsets(entry);
  const emph = EMPHASIS.find((e) => e.id === entry.emph)!;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(entry.id);
      flash(`Copied ${entry.id}`);
    } catch {
      flash('Copy is blocked here. Select the ID text and copy it.');
    }
  };

  const loadText = () => {
    const r = parse(text);
    if (!r) return flash('That is not a rhythm. Enter an ID like 16.9228, or a pattern like x..x..x.');
    actions.load(r);
    setText('');
    flash(`Loaded ${r.len} steps.`);
  };

  const loadFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      let d: Uint8Array = new Uint8Array(await f.arrayBuffer());
      if (d[0] === 0x50 && d[1] === 0x4b) {
        const inner = unzipStored(d);
        if (!inner) return flash('Could not read that zip. Unzip it and open the .mid file.');
        d = inner;
      }
      const r = parseMidi(d);
      if (!r) return flash('That file is not a MIDI file.');
      actions.load(r);
      flash(`Loaded ${onsets(r)} onsets on ${r.len} steps from ${f.name}.`);
    } catch {
      flash('Could not read that file.');
    }
  };

  const historyJson = () => setJson('rhythm', { bpm: s.bpm, sound: SOUNDS[s.sound].label }, s.history.map(rItemJson));

  // One zip: the rhythm MIDI (emphasis as velocity), the emphasis map MIDI, and for history a readable list.
  const exportZip = async (entries: Entry[], base: string, list: boolean) => {
    const note = SOUNDS[s.sound].note;
    const items = entries.map((e) => ({ r: e, mask: e.mask, tag: list ? `hearts=${e.hearts}` : undefined }));
    const maps = entries.map((e) => ({ r: e, mask: e.mask, tag: `emphasis map ${toId({ len: e.len, v: e.mask })} ${emphLabel(e.emph)}` }));
    const what = entries.length === 1 ? entries[0].id : `${entries.length} rhythms`;
    const mid = writeMidi(items, s.bpm, note, false, what);
    const files = [
      { name: `${base}.mid`, data: mid },
      { name: `${base}-emphasis-map.mid`, data: writeMidi(maps, s.bpm, note, true, `Emphasis map, ${what}`) },
    ];
    if (list) {
      const enc = new TextEncoder();
      const w = Math.max(2, ...entries.map((e) => e.id.length));
      const lines = entries.map((e, i) => `${String(i + 1).padStart(4)}  ${e.id.padEnd(w)}  ${emphLabel(e.emph).padEnd(18)}  ${e.src.padEnd(12)}  ${e.hearts > 24 ? '\u2665 x' + e.hearts : '\u2665'.repeat(e.hearts)}`.trimEnd());
      const hearted = entries.filter((e) => e.hearts).length;
      files.push({
        name: `${base}.txt`,
        data: enc.encode(`Onset history: ${entries.length} rhythms, ${hearted} hearted, ${s.bpm} BPM\n\n${'   #'}  ${'ID'.padEnd(w)}  ${'Emphasis'.padEnd(18)}  ${'Source'.padEnd(12)}  Hearts\n${lines.join('\n')}\n`),
      });
      files.push({ name: `${base}.json`, data: historyJson() });
    }
    const zip = buildZip(files);
    const c = (window as any).claude;
    try {
      if (c?.use) {
        const dl = await c.use('downloads');
        if (dl) {
          await dl.save({ filename: `${base}.zip`, data: zip });
          flash(`Saved ${base}.zip with ${files.length} files.`);
        } else {
          await navigator.clipboard.writeText(toBase64(mid));
          flash('Downloads are off here. Copied the rhythm MIDI file as base64 text.');
        }
      } else {
        const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${base}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        flash(`Saved ${base}.zip`);
      }
    } catch (err: any) {
      flash(err?.code === 'declined' ? 'Export cancelled.' : 'Export failed. Try again.');
    }
  };

  return (
    <main className="app">
      <header className="top">
        <h1>Onset</h1>
        <span className="where">
          Rhythm {s.cur + 1} of {s.history.length}
        </span>
      </header>

      <section className="card now" aria-label="Current rhythm">
        <button className="id" onClick={copyId} title="Copy ID">
          {entry.id}
        </button>
        <p className="meta">
          <span>
            {count} {count === 1 ? 'onset' : 'onsets'} on {entry.len} steps
          </span>
          <span className="tag">{entry.src}</span>
          {entry.hearts > 0 ? (
            <button className="unheart" onClick={() => actions.heart(-1)}>
              Remove a heart
            </button>
          ) : null}
          <span className="loops">{s.playing ? (s.repeat ? `Loop ${Math.min(s.loop + 1, s.repeat)} of ${s.repeat}` : `Loop ${s.loop + 1}`) : 'Stopped'}</span>
        </p>
        <Grid entry={entry} step={s.playing ? s.step : -1} />
        <div className="transport">
          <button className="btn" disabled={s.cur === 0} onClick={actions.back}>
            Back
          </button>
          <button className={'btn play' + (s.playing ? ' on' : '')} onClick={actions.toggle}>
            {s.playing ? 'Stop' : 'Play'}
          </button>
          <button className="btn" onClick={actions.next}>
            Next
          </button>
          <button
            className={'btn heart' + (entry.hearts ? ' has' : '')}
            aria-label={`Heart this rhythm. ${entry.hearts} so far.`}
            onClick={(e) => {
              actions.heart(1);
              emitHearts(e.currentTarget);
            }}
          >
            <span aria-hidden="true">{HEART}</span>
            <small>{entry.hearts}</small>
          </button>
        </div>
      </section>

      <section className="card" aria-label="Next rhythm rule">
        <div className="field">
          <label htmlFor="rule">Next rhythm</label>
          <select id="rule" value={s.rule} onChange={(e) => actions.set({ rule: e.target.value as RuleId })}>
            {RULES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <p className="help">{rule.help}</p>
        </div>
        <div className="field">
          <span className="lab" id="replab">
            Loops before next
          </span>
          <div className="chips" role="radiogroup" aria-labelledby="replab">
            {REPEATS.map((n) => (
              <button key={n} role="radio" aria-checked={s.repeat === n} className={'chip' + (s.repeat === n ? ' sel' : '')} onClick={() => actions.set({ repeat: n })}>
                {n || '∞'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card" aria-label="Emphasis">
        <div className="field">
          <label htmlFor="emph">Emphasis</label>
          <select id="emph" value={entry.emph} onChange={(e) => actions.setEmph(e.target.value as EmphId)}>
            {EMPHASIS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          <p className="help">
            {emph.help} {entry.emph === 'none' ? '' : `Emphasized onsets play louder. Map ${toId({ len: entry.len, v: entry.mask })}.`}
          </p>
        </div>
      </section>

      <section className="card" aria-label="Tempo and length">
        <Stepper id="bpm" label="BPM" value={s.bpm} min={30} max={300} onChange={(n) => actions.set({ bpm: n })} />
        <Stepper id="len" label="Steps" value={entry.len} min={1} max={MAX_LEN} onChange={actions.setLen} />
        <div className="chips">
          {LENGTHS.map((n) => (
            <button key={n} className={'chip' + (entry.len === n ? ' sel' : '')} onClick={() => actions.setLen(n)}>
              {n}
            </button>
          ))}
          <button className="chip" onClick={actions.clear}>
            Clear
          </button>
        </div>
      </section>

      <section className="card" aria-label="Sound">
        <span className="lab" id="sndlab">
          Sound
        </span>
        <div className="sounds" role="radiogroup" aria-labelledby="sndlab">
          {SOUNDS.map((x, i) => (
            <button key={x.id} role="radio" aria-checked={s.sound === i} className={'chip' + (s.sound === i ? ' sel' : '')} onClick={() => actions.setSound(i)}>
              {x.label}
            </button>
          ))}
        </div>
        <label className="check" htmlFor="rot">
          <input id="rot" type="checkbox" checked={s.rotateSound} onChange={(e) => actions.set({ rotateSound: e.target.checked })} />
          Change sound with each new rhythm
        </label>
      </section>

      <section className="card" aria-label="Load and export">
        <div className="field">
          <label htmlFor="load">Load a rhythm</label>
          <form
            className="loadrow"
            onSubmit={(e) => {
              e.preventDefault();
              loadText();
            }}
          >
            <input id="load" type="text" value={text} placeholder="16.9228 or x..x..x." autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => setText(e.target.value)} />
            <button className="btn" type="submit">
              Load
            </button>
          </form>
        </div>
        <div className="row3">
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Open MIDI
          </button>
          <button className="btn" onClick={() => exportZip([entry], 'onset-' + entry.id.replace('.', '-'), false)}>
            Export MIDI
          </button>
          <button className="btn" onClick={() => exportZip(s.history, `onset-history-${s.history.length}`, true)}>
            Export history
          </button>
        </div>
        <input
          ref={fileRef}
          id="file"
          type="file"
          accept=".mid,.midi,.zip,audio/midi"
          hidden
          onChange={(e) => {
            loadFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <p className="help">Each export is a zip with the rhythm MIDI, where emphasis is velocity, and a separate emphasis map MIDI. History export adds every rhythm with its hearts. Load that zip in the Pairing machine.</p>
      </section>

      <section className="card" aria-label="History">
        <span className="lab">History, newest first</span>
        <label className="check" htmlFor="only">
          <input id="only" type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />
          Show hearted only
        </label>
        <History history={s.history} cur={s.cur} hv={s.hv} only={only} />
      </section>

      <div className={'toast' + (msg ? ' show' : '')} role="status" aria-live="polite">
        {msg}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
