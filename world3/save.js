// world3's remote save (docs/rung2.md, option b): a game with an `id` keeps its save record in the player's own
// Bluesky repo, through world2's save API (`/api/game/save`, CORS for this page with credentials). localStorage stays
// the working copy every frame (the client writes it); this only copies it up and down. Signed out, or for a game
// without an id, nothing here runs and the page is exactly as before.
//
// - Where: ?world2=<origin> (localhost, 127.0.0.1 or *.anthonybecker.me only), else the game file's `world`, else
//   https://world2.anthonybecker.me.
// - Signed in: GET /api/me with credentials answers a did (not anonymous). game_scope false: "sign in again".
// - On load: the newer `updatedAt` of the local copy (as the page opened) and the remote record wins. The remote one
//   is loaded through w3.load_record; the local one it replaces stays in localStorage as w3.game.<name>.replaced.
// - Writes: 3 s after a milestone (the client's `saved` event says so), within 60 s otherwise, at most one per 5 s,
//   and on pagehide / hidden with keepalive. Each write carries the CID last seen (swapRecord): a 409 answers the
//   current record, and the newer one wins (theirs is loaded; ours is written again on their CID).
// - The record is `{$type, game: {uri, sha256}, data, updatedAt}`: `data` is the game script's save(), without floats.
//   A record of the older shape (before game scripts: world2 answers `legacy: true`) is never loaded; the next write
//   replaces it on its CID.
// - w3.reset_game() (the client's `reset` event) deletes the remote save too.
// - After each write: window `w3game` {type: 'saved', where: 'bluesky', at}. window.w3page.save records what happened
//   (tools/play-keys.mjs reads it); flush() writes now.

const NSID = 'me.anthonybecker.game.save';
const DEFAULT_WORLD2 = 'https://world2.anthonybecker.me';
// world2 takes one write per 5 s per DID; a little more here, so a write never lands just inside its window
const GAP_MS = 5600;
const MILESTONE_MS = 3000;
const IDLE_MS = 60000;

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const parse = (t) => { try { const v = JSON.parse(t); return v && typeof v === 'object' ? v : null; } catch { return null; } };
const time = (r) => { const t = Date.parse(r?.updatedAt || ''); return Number.isFinite(t) ? t : -Infinity; };
/** A save record of this client's shape: {game, data, updatedAt}, data an object. */
const shaped = (r) => !!(r && typeof r === 'object' && r.data && typeof r.data === 'object' && !Array.isArray(r.data) && typeof r.updatedAt === 'string');

/** An origin the page may send the player's cookie to, or null. */
export function allowedOrigin(u) {
  try {
    const x = new URL(u);
    if (x.protocol === 'https:' && (x.hostname === 'anthonybecker.me' || x.hostname.endsWith('.anthonybecker.me'))) return x.origin;
    if (x.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(x.hostname)) return x.origin;
  } catch {}
  return null;
}

export function remoteSave({ name, params, page }) {
  const KEY = `w3.game.${name}`;
  // the local copy as the page opened, before this session played (the load rule compares this one)
  const atLoad = shaped(parse(store.get(KEY))) ? parse(store.get(KEY)) : null;
  const rec = (page.save = { base: null, id: null, signedIn: false, handle: null, did: null, scope: null, cid: null, synced: null, requests: [], adopted: 0, conflicts: 0, wrote: 0, state: 'off', error: null });
  let file = null, sha = null, timer = 0, due = Infinity, last = 0, busy = false, again = false, stopped = false, me = null;
  let fileReady, clientReady;
  const fileP = new Promise((r) => (fileReady = r));
  const clientP = new Promise((r) => (clientReady = r));

  const api = (path) => `${rec.base}${path}`;
  async function call(method, path, body, extra = {}) {
    const init = { method, credentials: 'include', headers: {}, ...extra };
    // a cookie write must be JSON from an allowed Origin (world2's CSRF rule), so every write says JSON
    if (method !== 'GET') init.headers['content-type'] = 'application/json';
    if (body !== undefined) init.body = JSON.stringify(body);
    const entry = { method, path, at: Date.now(), status: 0 };
    rec.requests.push(entry);
    try {
      const r = await fetch(api(path), init);
      entry.status = r.status;
      let data = null;
      try { data = await r.json(); } catch {}
      return { status: r.status, data };
    } catch (e) {
      entry.error = String(e?.message || e);
      return { status: 0, data: null };
    }
  }

  // ---- the control: a person icon; its panel signs in (handle + Sign in), or shows who and the record's link
  const ui = (() => {
    const box = $('acct'), btn = $('me'), panel = $('mepanel'), who = $('mewho'), form = $('meform'), input = $('mehandle'),
      go = $('mego'), link = $('merecord'), saved = $('saved'), err = $('meerr');
    let savedTimer = 0;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      panel.classList.toggle('hide');
      if (!panel.classList.contains('hide') && !rec.signedIn) input.focus({ preventScroll: true });
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const h = (input.value || rec.handle || '').trim().replace(/^@/, '');
      if (!h) { input.focus(); return; }
      store.set('w3.handle', h);
      location.href = api(`/oauth/login?handle=${encodeURIComponent(h)}&return=${encodeURIComponent(location.href)}`);
    });
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) panel.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    return {
      show() {
        box.classList.remove('hide');
        const again = rec.signedIn && rec.scope === false;
        btn.classList.toggle('in', rec.signedIn);
        btn.classList.toggle('warn', again);
        const label = rec.signedIn ? (again ? `@${rec.handle}: sign in again to save` : `@${rec.handle}`) : 'Sign in to save';
        btn.title = label;
        btn.setAttribute('aria-label', label);
        who.textContent = rec.signedIn ? `@${rec.handle}` : '';
        who.classList.toggle('hide', !rec.signedIn);
        form.classList.toggle('hide', rec.signedIn && !again);
        input.classList.toggle('hide', again);
        if (!input.value) input.value = rec.handle || store.get('w3.handle') || '';
        go.textContent = again ? 'Sign in again' : 'Sign in';
        const url = rec.signedIn && rec.id ? recordUrl() : null;
        link.classList.toggle('hide', !url);
        if (url) { link.href = url; link.textContent = url; }
      },
      error(text) {
        err.textContent = String(text).slice(0, 160);
        err.classList.remove('hide');
        panel.classList.remove('hide');
      },
      saved() {
        saved.classList.remove('hide');
        saved.classList.add('show');
        clearTimeout(savedTimer);
        savedTimer = setTimeout(() => saved.classList.remove('show'), 1800);
      },
    };
  })();

  function recordUrl() {
    if (me?.pds) return `${me.pds.replace(/\/$/, '')}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(rec.did)}&collection=${NSID}&rkey=${encodeURIComponent(rec.id)}`;
    return api(`/api/game/save?id=${encodeURIComponent(rec.id)}`);
  }

  function remember() { store.set(`${KEY}.sync`, JSON.stringify({ did: rec.did, cid: rec.cid, synced: rec.synced })); }

  function local() {
    const r = window.w3?.game_record?.();
    if (!r || !r.updatedAt) return null;
    if (sha) r.game = { ...(r.game || {}), sha256: sha };
    return r;
  }

  function adopt(remote, cid) {
    const mine = local() || atLoad;
    if (mine) store.set(`${KEY}.replaced`, JSON.stringify(mine));
    window.w3.load_record(remote);
    rec.cid = cid;
    rec.synced = remote.updatedAt;
    rec.adopted++;
    remember();
  }

  function schedule(ms) {
    if (stopped || !rec.signedIn) return;
    const at = Math.max(Date.now() + ms, last + GAP_MS);
    if (at >= due) return;
    due = at;
    clearTimeout(timer);
    timer = setTimeout(() => { due = Infinity; push(); }, at - Date.now());
  }

  async function push() {
    if (stopped || !rec.signedIn) return;
    if (busy) { again = true; return; }
    const r = local();
    if (!r || r.updatedAt === rec.synced) return;
    if (Date.now() - last < GAP_MS) { schedule(0); return; }
    busy = true;
    last = Date.now();
    try {
      const res = await call('PUT', '/api/game/save', { id: rec.id, record: r, swap: rec.cid ?? null });
      if (res.status === 200 || res.status === 201) {
        rec.cid = res.data?.cid ?? rec.cid;
        rec.synced = r.updatedAt;
        rec.wrote++;
        remember();
        const at = new Date().toISOString();
        dispatchEvent(new CustomEvent('w3game', { detail: { type: 'saved', where: 'bluesky', at } }));
        ui.saved();
      } else if (res.status === 409) {
        rec.conflicts++;
        const theirs = res.data?.record;
        if (!res.data?.legacy && shaped(theirs) && time(theirs) > time(r)) adopt(theirs, res.data.cid ?? null);
        else { rec.cid = theirs ? res.data.cid ?? null : null; again = true; }
      } else if (res.status === 429) {
        schedule(Math.max(GAP_MS, (Number(res.data?.retry_in_s) || 5) * 1000));
      } else if (res.status === 403 && res.data?.error === 'rescope') {
        rec.scope = false; stopped = true; ui.show();
      } else if (res.status === 401 || (res.status === 403 && res.data?.error === 'login_required')) {
        rec.signedIn = false; ui.show();
      } else {
        rec.error = `PUT ${res.status} ${res.data?.error || ''}`.trim();
        schedule(IDLE_MS);
      }
    } finally {
      busy = false;
      if (again) { again = false; schedule(0); }
    }
  }

  // the page going away: write what is not yet written, keepalive (no answer is read)
  function leaving() {
    if (!rec.signedIn || stopped) return;
    const r = local();
    if (!r || r.updatedAt === rec.synced) return;
    rec.requests.push({ method: 'PUT', path: '/api/game/save', at: Date.now(), keepalive: true });
    try {
      fetch(api('/api/game/save'), { method: 'PUT', credentials: 'include', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: rec.id, record: r, swap: rec.cid ?? null }) }).catch(() => {});
    } catch {}
  }
  addEventListener('pagehide', leaving);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leaving(); });

  addEventListener('w3game', (e) => {
    const d = e.detail || {};
    if (!rec.signedIn) return;
    if (d.type === 'saved' && d.where === 'local') schedule(d.milestone ? MILESTONE_MS : IDLE_MS);
    else if (d.type === 'reset') {
      clearTimeout(timer); due = Infinity;
      rec.synced = null;
      last = Date.now(); // a delete counts against world2's write rate too
      call('DELETE', `/api/game/save?id=${encodeURIComponent(rec.id)}`).then((res) => { if (res.status < 300 || res.status === 404) { rec.cid = null; remember(); } });
    }
  });

  // a login that could not start comes back here with login_error: shown once in the panel, then dropped from the URL
  const loginError = params.get('login_error');
  if (loginError) {
    const u = new URL(location.href);
    u.searchParams.delete('login_error');
    history.replaceState(history.state, '', u.href);
  }

  async function start() {
    const [f] = await Promise.all([fileP, clientP]);
    if (!f?.id) return; // no id: localStorage only, as rung 1
    rec.id = f.id;
    rec.base = allowedOrigin(params.get('world2') || '') || allowedOrigin(f.world || '') || DEFAULT_WORLD2;
    rec.state = 'checking';
    ui.show();
    if (loginError) ui.error(loginError);
    const m = await call('GET', '/api/me');
    me = m.status === 200 ? m.data : null;
    if (!me?.did || me.anonymous) { rec.state = 'signed out'; ui.show(); return; }
    Object.assign(rec, { signedIn: true, did: me.did, handle: me.handle || me.did, scope: me.game_scope ?? null });
    const kept = parse(store.get(`${KEY}.sync`));
    if (kept?.did === me.did) { rec.cid = kept.cid ?? null; }
    ui.show();
    const g = await call('GET', `/api/game/save?id=${encodeURIComponent(rec.id)}`);
    const mine = local() || atLoad;
    if (g.status === 200 && g.data?.record && (g.data.legacy || !shaped(g.data.record))) {
      // a save of the older shape (before game scripts; world2 flags it legacy): not loaded; ours replaces it on its CID
      rec.cid = g.data.cid ?? null;
      if (mine) schedule(0);
    } else if (g.status === 200 && g.data?.record) {
      rec.cid = g.data.cid ?? null;
      const theirs = g.data.record;
      if (!mine || time(theirs) > time(mine)) adopt(theirs, rec.cid);
      else if (time(theirs) === time(mine)) { rec.synced = mine.updatedAt; remember(); }
      else schedule(0);
    } else if (g.status === 404) {
      rec.cid = null;
      if (mine) schedule(0);
    } else {
      rec.error = `GET ${g.status}`;
    }
    rec.state = 'on';
  }
  start().catch((e) => { rec.error = String(e?.message || e); });

  return (page.saveApi = {
    /** The game file as fetched: its id and world, and its bytes' SHA-256. */
    file(f, bytes) {
      file = f;
      if (bytes && crypto?.subtle) crypto.subtle.digest('SHA-256', bytes).then((h) => { sha = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join(''); }).catch(() => {}).finally(() => fileReady(file));
      else fileReady(file);
    },
    /** The client is up (w3.ready) with its game loaded. */
    ready() { clientReady(); },
    flush() { due = Infinity; clearTimeout(timer); last = 0; return push(); },
  });
}
