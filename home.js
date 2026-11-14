// Shared rendering for the front page and the section indexes.
// Manifests are listed oldest first; everything here shows newest first.
const ARROW = '<svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5"/></svg>';
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function manifest(name) {
  const res = await fetch(`/${name}/manifest.json`);
  if (!res.ok) throw new Error(name);
  return (await res.json()).slice().reverse();
}

export function cards(items, { numbered = false } = {}) {
  return items.map((x) => `
    <a class="card" href="${esc(x.path)}">
      ${numbered ? `<span class="num">#${esc(x.number)}</span>` : ''}
      <span class="t">${esc(x.title)}${ARROW}</span>
      ${x.description ? `<span class="d">${esc(x.description)}</span>` : ''}
    </a>`).join('');
}

export function rows(items, { numbered = false } = {}) {
  return items.map((x) => `
    <li><a class="row" href="${esc(x.path)}">
      <span class="t">${numbered ? `<span class="n">#${esc(x.number)}</span>` : ''}${esc(x.title)}</span>${ARROW}
      ${x.description ? `<span class="d">${esc(x.description)}</span>` : ''}
    </a></li>`).join('');
}

export async function fill(id, name, render, { limit, count } = {}) {
  const el = document.getElementById(id);
  try {
    const items = await manifest(name);
    el.innerHTML = items.length ? render(limit ? items.slice(0, limit) : items) : '<li class="empty">Nothing yet.</li>';
    if (count) for (const c of document.querySelectorAll(`[data-count="${name}"]`)) c.textContent = items.length;
    return items;
  } catch {
    el.innerHTML = `<li class="error">Couldn't load ${esc(name)}.</li>`;
  }
}

export function themeToggle() {
  const root = document.documentElement;
  try { const t = localStorage.getItem('theme'); if (t) root.dataset.theme = t; } catch {}
  const btn = document.querySelector('.theme');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const next = (root.dataset.theme || (dark ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
  });
}
