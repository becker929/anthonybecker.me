import React, { memo, useRef, useState } from 'react';

export const HEART = '♥︎';
export const REPEATS = [0, 1, 2, 4, 8, 16, 32].map((n) => ({ v: n, l: n ? String(n) : '∞' }));

export function emitHearts(from: HTMLElement) {
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

export function useFlash(): [string, (m: string) => void] {
  const [msg, setMsg] = useState('');
  const timer = useRef<any>(0);
  return [
    msg,
    (m: string) => {
      setMsg(m);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(''), 4500);
    },
  ];
}
export const Toast = ({ msg }: { msg: string }) => (
  <div className={'toast' + (msg ? ' show' : '')} role="status" aria-live="polite">
    {msg}
  </div>
);

export function Stepper({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
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

export function Chips<T extends string | number>({ id, label, options, value, onChange, cls }: { id: string; label: string; options: { v: T; l: string }[]; value: T; onChange: (v: T) => void; cls?: string }) {
  return (
    <div className="field">
      <span className="lab" id={id}>
        {label}
      </span>
      <div className={cls || 'chips'} role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button key={String(o.v)} role="radio" aria-checked={o.v === value} className={'chip' + (o.v === value ? ' sel' : '')} onClick={() => onChange(o.v)}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Pick<T extends string | number>({ id, label, options, value, onChange, help }: { id: string; label: string; options: { v: T; l: string }[]; value: T; onChange: (v: string) => void; help?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={String(o.v)} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      {help ? <p className="help">{help}</p> : null}
    </div>
  );
}

export function Transport({ canBack, playing, hearts, onBack, onToggle, onNext, onHeart }: { canBack: boolean; playing: boolean; hearts: number; onBack: () => void; onToggle: () => void; onNext: () => void; onHeart: () => void }) {
  return (
    <div className="transport">
      <button className="btn" disabled={!canBack} onClick={onBack}>
        Back
      </button>
      <button className={'btn play' + (playing ? ' on' : '')} onClick={onToggle}>
        {playing ? 'Stop' : 'Play'}
      </button>
      <button className="btn" onClick={onNext}>
        Next
      </button>
      <button
        className={'btn heart' + (hearts ? ' has' : '')}
        aria-label={`Heart this. ${hearts} so far.`}
        onClick={(e) => {
          onHeart();
          emitHearts(e.currentTarget);
        }}
      >
        <span aria-hidden="true">{HEART}</span>
        <small>{hearts}</small>
      </button>
    </div>
  );
}

export const loopText = (playing: boolean, loop: number, repeat: number) => (playing ? (repeat ? `Loop ${Math.min(loop + 1, repeat)} of ${repeat}` : `Loop ${loop + 1}`) : 'Stopped');

export interface HRow { id: string; hearts: number; note: string }
export const HistoryCard = memo(function HistoryCard({ rows, cur, onJump }: { rows: HRow[]; cur: number; hv: number; onJump: (i: number) => void }) {
  const [only, setOnly] = useState(false);
  const out = [];
  for (let i = rows.length - 1; i >= 0 && out.length < 200; i--) {
    const e = rows[i];
    if (only && !e.hearts) continue;
    out.push(
      <li key={i}>
        <button className={'hrow' + (i === cur ? ' sel' : '')} aria-current={i === cur} onClick={() => onJump(i)}>
          <span className="hn">{i + 1}</span>
          <span className="hid">{e.id}</span>
          <span className="hsrc">
            {e.hearts > 0 ? (
              <b className="hh">
                {HEART} {e.hearts}
              </b>
            ) : null}
            <span>{e.note}</span>
          </span>
        </button>
      </li>,
    );
  }
  return (
    <section className="card" aria-label="History">
      <span className="lab">History, newest first</span>
      <label className="check" htmlFor="only">
        <input id="only" type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />
        Show hearted only
      </label>
      {out.length ? <ol className="history">{out}</ol> : <p className="help">Nothing hearted yet.</p>}
    </section>
  );
});

export const heartsText = (n: number) => (n > 24 ? '♥ x' + n : '♥'.repeat(n));

function toBase64(d: Uint8Array) {
  let s = '';
  d.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

// Saves through the viewer's download prompt. Falls back to the clipboard where downloads are off.
export async function saveFile(filename: string, data: Uint8Array, flash: (m: string) => void, done: string) {
  const c = (window as any).claude;
  try {
    if (c?.use) {
      const dl = await c.use('downloads');
      if (dl) {
        await dl.save({ filename, data });
        flash(done);
      } else {
        const text = filename.endsWith('.json');
        await navigator.clipboard.writeText(text ? new TextDecoder().decode(data) : toBase64(data));
        flash(text ? 'Downloads are off here. Copied the file contents instead.' : 'Downloads are off here. Copied the file as base64 text.');
      }
    } else {
      const url = URL.createObjectURL(new Blob([data as BlobPart]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      flash(done);
    }
  } catch (err: any) {
    flash(err?.code === 'declined' ? 'Export cancelled.' : 'Export failed. Try again.');
  }
}
