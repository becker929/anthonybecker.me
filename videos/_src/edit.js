// The editor. It reads an edit decision list (edl.json, written by direct.mjs) and paints any frame of
// the film on one canvas: footage under camera moves, transitions, picture effects, data cards and
// words. Everything is a function of the frame number, so shoot.mjs can render frames in any order.

const EDL = await (await fetch('edl.json')).json();
const { w: W, h: H, fps: FPS } = EDL;
const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');
const layer = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const A = layer(), B = layer(), T = layer(), PREV = layer();
let prevFrame = -2;

// ---------------------------------------------------------------- footage

const cache = new Map();
function image(src) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }));
  }
  return cache.get(src);
}
/// The path of a source's frame at `sec` seconds in, held on its last frame.
function framePath(key, sec) {
  const s = EDL.sources[key];
  if (!s) return null;
  const i = Math.max(0, Math.min(s.n - 1, Math.floor(sec * FPS)));
  return `footage/${key}/${String(i + 1).padStart(4, '0')}.jpg`;
}

// ---------------------------------------------------------------- small tools

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const back = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const lerp = (a, b, t) => a + (b - a) * t;
function hash(n) { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; }

/// Draws `img` to cover the canvas, through a camera: zoom `z` about the source point (cx, cy) in 0..1,
/// rotated by `rot` radians.
function cover(c, img, z = 1, cx = 0.5, cy = 0.5, rot = 0, dx = 0, dy = 0) {
  const g = c.getContext('2d');
  if (!img) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return; }
  const s = Math.max(W / img.width, H / img.height) * z;
  const iw = img.width * s, ih = img.height * s;
  // Keep the chosen point centred, but never show past the source's edges.
  let x = W / 2 - cx * iw, y = H / 2 - cy * ih;
  x = Math.min(0, Math.max(W - iw, x)) + dx;
  y = Math.min(0, Math.max(H - ih, y)) + dy;
  g.save();
  g.translate(W / 2, H / 2); g.rotate(rot); g.translate(-W / 2, -H / 2);
  if (rot) { const k = 1 + Math.abs(rot) * 1.4; g.translate(W / 2, H / 2); g.scale(k, k); g.translate(-W / 2, -H / 2); }
  g.drawImage(img, x, y, iw, ih);
  g.restore();
}

/// Draws `img` fitted inside the rectangle (x, y, w, h), cropped to fill it.
function fill(g, img, x, y, w, h, cx = 0.5, cy = 0.5, z = 1) {
  if (!img) return;
  const s = Math.max(w / img.width, h / img.height) * z;
  const sw = w / s, sh = h / s;
  const sx = clamp(cx * img.width - sw / 2, 0, img.width - sw), sy = clamp(cy * img.height - sh / 2, 0, img.height - sh);
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// ---------------------------------------------------------------- shots

async function drawShot(c, shot, n) {
  const g = c.getContext('2d');
  g.save();
  g.filter = 'none';
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.fillStyle = shot.bg || '#000';
  g.fillRect(0, 0, W, H);
  const len = Math.max(1, shot.f1 - shot.f0);
  const t = clamp((n - shot.f0) / len);
  const sec = (n - shot.f0) / FPS;
  const speed = shot.speed ?? 1;
  const at = (k, extra = 0) => framePath(shot.src[k % shot.src.length], (shot.t0 ?? 0) + extra + (shot.kind === 'freeze' ? 0 : sec * speed));
  const m = shot.move || {};
  const z = lerp(m.z0 ?? 1, m.z1 ?? 1, ease(t));
  const cx = lerp(m.x0 ?? 0.5, m.x1 ?? 0.5, ease(t)), cy = lerp(m.y0 ?? 0.5, m.y1 ?? 0.5, ease(t));
  const kind = shot.kind;
  if (kind === 'split2' || kind === 'split3' || kind === 'grid4') {
    const k = kind === 'split2' ? 2 : kind === 'split3' ? 3 : 4;
    const imgs = await Promise.all([...Array(k).keys()].map((i) => image(at(i, i * 0.7))));
    const gap = Math.round(Math.min(W, H) * 0.006);
    const tall = H > W;
    for (let i = 0; i < k; i++) {
      let x, y, w, h;
      if (kind === 'grid4') { w = W / 2; h = H / 2; x = (i % 2) * w; y = Math.floor(i / 2) * h; }
      else if (tall) { w = W; h = H / k; x = 0; y = i * h; }
      else { w = W / k; h = H; x = i * w; y = 0; }
      // Panels arrive one after another.
      const arrive = easeOut(clamp(t * 6 - i * 0.6));
      g.save();
      g.globalAlpha = arrive;
      g.translate(tall ? 0 : (1 - arrive) * 60, tall ? (1 - arrive) * 60 : 0);
      fill(g, imgs[i], x + gap, y + gap, w - gap * 2, h - gap * 2, cx, cy, z);
      g.restore();
    }
  } else if (kind === 'pip') {
    const img = await image(at(0));
    g.filter = 'blur(28px) brightness(0.55)';
    fill(g, img, -40, -40, W + 80, H + 80);
    g.filter = 'none';
    const s = 0.62 + 0.04 * ease(t);
    const w = W * s, h = H * s;
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40;
    fill(g, img, (W - w) / 2, (H - h) / 2, w, h, cx, cy, z);
  } else if (kind === 'mirror') {
    const img = await image(at(0));
    g.save(); g.beginPath(); g.rect(0, 0, W / 2, H); g.clip();
    g.drawImage((await sub(img, z, cx, cy)), 0, 0); g.restore();
    g.save(); g.translate(W, 0); g.scale(-1, 1); g.beginPath(); g.rect(0, 0, W / 2, H); g.clip();
    g.drawImage((await sub(img, z, cx, cy)), 0, 0); g.restore();
  } else if (kind === 'freeze') {
    const img = await image(at(0));
    g.fillStyle = shot.field || '#ffb347'; g.fillRect(0, 0, W, H);
    const s = 0.74, w = W * s, h = H * s, wob = Math.sin(n * 0.4) * 0.01;
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.04 + wob); g.translate(-W / 2, -H / 2);
    g.fillStyle = '#fff'; g.fillRect((W - w) / 2 - 14, (H - h) / 2 - 14, w + 28, h + 28);
    fill(g, img, (W - w) / 2, (H - h) / 2, w, h, cx, cy, z);
    g.restore();
  } else {
    let zz = z, dx = 0, dy = 0, rot = 0;
    if (kind === 'dutch') rot = (m.rot ?? 0.07) * (1 - 0.3 * t);
    if (kind === 'handheld') { dx = (hash(n) - 0.5) * 14 + Math.sin(n * 0.17) * 10; dy = (hash(n + 7) - 0.5) * 10 + Math.cos(n * 0.13) * 8; zz *= 1.06; }
    if (kind === 'whip') { const k = clamp(sec / 0.22); dx = (1 - easeOut(k)) * W * 0.9 * (m.dir ?? 1); }
    if (kind === 'crash') zz *= lerp(1, m.punch ?? 1.6, back(clamp(sec / 0.18)));
    const img = await image(at(0));
    cover(c, img, zz, cx, cy, rot, dx, dy);
    if (kind === 'whip' && sec < 0.22) {
      g.globalAlpha = 0.5; g.filter = 'blur(18px)'; g.drawImage(c, 30, 0); g.filter = 'none'; g.globalAlpha = 1;
    }
  }
  g.restore();
  for (const fx of shot.fx || []) effect(c, fx, n, t);
}

/// A camera-moved copy of `img` the size of the canvas, for layouts that cut it up.
async function sub(img, z, cx, cy) { const c = layer(); cover(c, img, z, cx, cy); return c; }

// ---------------------------------------------------------------- effects

const noise = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; return c; })();
function grain(g, amount, n) {
  const ng = noise.getContext('2d');
  const d = ng.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * 31 + n * 977) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  ng.putImageData(d, 0, 0);
  g.save(); g.globalAlpha = amount; g.globalCompositeOperation = 'overlay';
  g.fillStyle = g.createPattern(noise, 'repeat'); g.fillRect(0, 0, W, H); g.restore();
}

function effect(c, fx, n, t) {
  const g = c.getContext('2d');
  const copy = () => { const k = layer(); k.getContext('2d').drawImage(c, 0, 0); return k; };
  g.save();
  switch (fx) {
    case 'rgb-split': {
      const k = copy(), off = 6 + 10 * Math.abs(Math.sin(n * 0.7));
      g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      for (const [col, dx] of [['#f00', -off], ['#0f0', 0], ['#00f', off]]) {
        const ch = layer(), cg = ch.getContext('2d');
        cg.drawImage(k, 0, 0); cg.globalCompositeOperation = 'multiply'; cg.fillStyle = col; cg.fillRect(0, 0, W, H);
        g.drawImage(ch, dx, 0);
      }
      break;
    }
    case 'pixelate': case 'posterize': {
      const k = copy(), s = fx === 'pixelate' ? 0.035 + 0.02 * Math.sin(n * 0.3) : 0.25;
      const small = document.createElement('canvas'); small.width = Math.max(8, W * s); small.height = Math.max(8, H * s);
      small.getContext('2d').drawImage(k, 0, 0, small.width, small.height);
      g.imageSmoothingEnabled = false; g.drawImage(small, 0, 0, W, H);
      if (fx === 'posterize') { g.globalCompositeOperation = 'source-over'; g.filter = 'contrast(2.2) saturate(1.8)'; g.drawImage(c, 0, 0); }
      break;
    }
    case 'scanlines': case 'vhs': {
      g.globalAlpha = 0.22; g.fillStyle = '#000';
      for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
      if (fx === 'vhs') {
        g.globalAlpha = 1;
        const k = copy(), band = (n * 7) % H;
        g.drawImage(k, 0, band, W, 40, 12 * Math.sin(n), band, W, 40);
        g.globalAlpha = 0.12; g.globalCompositeOperation = 'screen'; g.drawImage(k, 5, 0); g.globalCompositeOperation = 'source-over';
        grain(g, 0.25, n);
      }
      break;
    }
    case 'grain-heavy': grain(g, 0.45, n); break;
    case 'halftone': {
      const k = copy(); const kg = k.getContext('2d'); const step = Math.round(Math.min(W, H) / 90);
      const d = kg.getImageData(0, 0, W, H).data;
      g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, W, H); g.fillStyle = '#111';
      for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
        const i = (Math.floor(y) * W + Math.floor(x)) * 4; const v = 1 - (d[i] + d[i + 1] + d[i + 2]) / 765;
        g.beginPath(); g.arc(x, y, (step / 2) * Math.sqrt(v) * 1.15, 0, 7); g.fill();
      }
      break;
    }
    case 'duotone': {
      const k = copy(); g.filter = 'grayscale(1) contrast(1.4)'; g.drawImage(k, 0, 0); g.filter = 'none';
      g.globalCompositeOperation = 'multiply'; g.fillStyle = EDL.palette?.[0] || '#ffb347'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'screen'; g.fillStyle = EDL.palette?.[1] ? EDL.palette[1] + '55' : '#2b2bff55'; g.fillRect(0, 0, W, H);
      break;
    }
    case 'invert-flash': if (hash(n >> 2) < 0.18) { g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); } break;
    case 'strobe': if ((n >> 1) % 3 === 0) { g.globalAlpha = 0.5; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); } break;
    case 'trails': if (prevFrame === n - 1) { g.globalAlpha = 0.45; g.globalCompositeOperation = 'lighten'; g.drawImage(PREV, 0, 0); } break;
    case 'bloom': { const k = copy(); g.filter = 'blur(24px) brightness(1.3)'; g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.55; g.drawImage(k, 0, 0); break; }
    case 'high-contrast-bw': { const k = copy(); g.filter = 'grayscale(1) contrast(1.9) brightness(1.05)'; g.drawImage(k, 0, 0); break; }
    case 'saturate': { const k = copy(); g.filter = 'saturate(2.1) contrast(1.15)'; g.drawImage(k, 0, 0); break; }
    case 'chroma-wobble': { const k = copy(); g.filter = `hue-rotate(${Math.sin(n * 0.2) * 60}deg) saturate(1.5)`; g.drawImage(k, 0, 0); break; }
  }
  g.restore();
}

// ---------------------------------------------------------------- transitions

/// Mixes the outgoing picture `a` into the incoming `b` at progress p (0..1), onto the main canvas.
function mix(type, a, b, p, n) {
  const q = ease(p);
  ctx.save();
  switch (type) {
    case 'dissolve': ctx.drawImage(a, 0, 0); ctx.globalAlpha = q; ctx.drawImage(b, 0, 0); break;
    case 'dip-black': case 'dip-white':
      ctx.drawImage(p < 0.5 ? a : b, 0, 0);
      ctx.globalAlpha = 1 - Math.abs(p - 0.5) * 2; ctx.fillStyle = type === 'dip-black' ? '#000' : '#fff'; ctx.fillRect(0, 0, W, H); break;
    case 'flash': ctx.drawImage(p < 0.3 ? a : b, 0, 0); ctx.globalAlpha = clamp(1 - Math.abs(p - 0.3) * 3); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); break;
    case 'whip-left': case 'push-left': {
      const x = -q * W;
      if (type === 'whip-left') ctx.filter = `blur(${Math.sin(p * Math.PI) * 30}px)`;
      ctx.drawImage(a, x, 0); ctx.drawImage(b, x + W, 0); break;
    }
    case 'whip-up': case 'slide-up': {
      const y = -q * H;
      if (type === 'whip-up') ctx.filter = `blur(${Math.sin(p * Math.PI) * 30}px)`;
      ctx.drawImage(a, 0, y); ctx.drawImage(b, 0, y + H); break;
    }
    case 'iris': {
      ctx.drawImage(a, 0, 0); ctx.beginPath(); ctx.arc(W / 2, H / 2, q * Math.hypot(W, H) / 2, 0, 7); ctx.clip(); ctx.drawImage(b, 0, 0); break;
    }
    case 'wipe-diagonal': {
      ctx.drawImage(a, 0, 0); ctx.beginPath(); const e = q * (W + H) * 1.05;
      ctx.moveTo(0, 0); ctx.lineTo(e, 0); ctx.lineTo(e - H, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip(); ctx.drawImage(b, 0, 0); break;
    }
    case 'luma': {
      // The incoming picture shows through its own bright parts first.
      ctx.drawImage(a, 0, 0);
      const k = layer(), kg = k.getContext('2d');
      kg.drawImage(b, 0, 0); kg.globalCompositeOperation = 'destination-in'; kg.filter = `grayscale(1) contrast(4) brightness(${0.2 + q * 1.6})`; kg.drawImage(b, 0, 0);
      ctx.drawImage(k, 0, 0); if (p > 0.8) { ctx.globalAlpha = (p - 0.8) * 5; ctx.drawImage(b, 0, 0); } break;
    }
    case 'glitch-slices': {
      ctx.drawImage(a, 0, 0);
      const rows = 14;
      for (let i = 0; i < rows; i++) {
        if (hash(i * 13 + Math.floor(p * 9)) < q) {
          const y = (i / rows) * H, h = H / rows, dx = (hash(i + n) - 0.5) * 120 * (1 - q);
          ctx.drawImage(b, 0, y, W, h, dx, y, W, h);
        }
      }
      break;
    }
    case 'zoom-through': {
      const s = 1 + q * 3; ctx.globalAlpha = 1 - q;
      ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); ctx.drawImage(a, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = q; const s2 = 0.6 + 0.4 * q;
      ctx.translate(W / 2, H / 2); ctx.scale(s2, s2); ctx.translate(-W / 2, -H / 2); ctx.drawImage(b, 0, 0); break;
    }
    case 'spin': {
      const k = p < 0.5 ? a : b, r = (p < 0.5 ? q : q - 1) * Math.PI * 0.5;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2); ctx.rotate(r); ctx.scale(1 + Math.abs(r), 1 + Math.abs(r)); ctx.translate(-W / 2, -H / 2);
      ctx.filter = `blur(${Math.sin(p * Math.PI) * 14}px)`; ctx.drawImage(k, 0, 0); break;
    }
    case 'blinds': {
      ctx.drawImage(a, 0, 0); const k = 10, bw = W / k;
      for (let i = 0; i < k; i++) { const w = bw * clamp(q * 1.6 - i * 0.06); ctx.drawImage(b, i * bw, 0, w, H, i * bw, 0, w, H); }
      break;
    }
    case 'pixel': {
      const k = p < 0.5 ? a : b, s = Math.max(0.01, 1 - Math.sin(p * Math.PI) * 0.985);
      const small = document.createElement('canvas'); small.width = Math.max(4, W * s); small.height = Math.max(4, H * s);
      small.getContext('2d').drawImage(k, 0, 0, small.width, small.height);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, W, H); break;
    }
    default: ctx.drawImage(b, 0, 0);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- data cards

function card(c, n) {
  const t = clamp((n - c.f0) / Math.max(1, c.f1 - c.f0));
  const fade = clamp(Math.min((n - c.f0) / 12, (c.f1 - n) / 12));
  const S = Math.min(W, H) / 1080;
  const font = c.font || 'Avenir Next';
  const ink = c.ink || '#f4f1ea', accent = c.accent || '#e8c27a';
  ctx.save();
  ctx.globalAlpha = fade;
  if (c.scrim !== false) { ctx.fillStyle = `rgba(6,8,10,${0.55 * fade})`; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = fade; }
  const grow = easeOut(clamp(t * 2.2));
  if (c.kind === 'title') {
    ctx.fillStyle = ink; ctx.textAlign = 'center';
    ctx.font = `${c.weight || 400} ${Math.round(c.size || 86 * S)}px "${font}"`;
    ctx.fillText(c.text, W / 2, H / 2 + 10 * (1 - grow));
    if (c.sub) { ctx.font = `400 ${Math.round(30 * S)}px "${c.subfont || 'Avenir Next'}"`; ctx.fillStyle = accent; ctx.letterSpacing = '6px'; ctx.fillText(c.sub.toUpperCase(), W / 2, H / 2 + 70 * S); }
  } else if (c.kind === 'stat') {
    // A number counting up, with what it counts underneath.
    const v = Math.round((c.value ?? 0) * easeOut(clamp(t * 1.6)));
    ctx.fillStyle = accent; ctx.textAlign = 'center';
    ctx.font = `300 ${Math.round(220 * S)}px "${font}"`; ctx.fillText(v.toLocaleString('en') + (c.unit || ''), W / 2, H / 2 + 40 * S);
    ctx.fillStyle = ink; ctx.font = `400 ${Math.round(34 * S)}px "Avenir Next"`; ctx.letterSpacing = '5px';
    ctx.fillText((c.label || '').toUpperCase(), W / 2, H / 2 + 120 * S);
  } else if (c.kind === 'bars') {
    const rows = c.rows || [], max = Math.max(1, ...rows.map((r) => r.value));
    const bw = W * 0.56, x0 = (W - bw) / 2 + W * 0.08, rh = Math.min(70 * S, (H * 0.6) / Math.max(1, rows.length));
    const y0 = H / 2 - (rows.length * rh) / 2;
    ctx.fillStyle = ink; ctx.font = `400 ${Math.round(30 * S)}px "${font}"`; ctx.textAlign = 'left';
    if (c.title) ctx.fillText(c.title, (W - bw) / 2 - W * 0.04, y0 - rh * 0.7);
    rows.forEach((r, i) => {
      const k = easeOut(clamp(t * 2.5 - i * 0.12));
      const y = y0 + i * rh;
      ctx.globalAlpha = fade;
      ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.font = `400 ${Math.round(24 * S)}px "Avenir Next"`;
      ctx.fillText(r.label, x0 - 18 * S, y + rh * 0.62);
      ctx.fillStyle = accent; ctx.fillRect(x0, y + rh * 0.2, (bw - W * 0.08) * (r.value / max) * k, rh * 0.6);
      ctx.fillStyle = ink; ctx.textAlign = 'left';
      ctx.fillText(Math.round(r.value * k).toLocaleString('en'), x0 + (bw - W * 0.08) * (r.value / max) * k + 12 * S, y + rh * 0.62);
    });
  } else if (c.kind === 'timeline') {
    const pts = c.points || [], x0 = W * 0.12, x1 = W * 0.88, y = H * 0.55;
    ctx.strokeStyle = ink; ctx.globalAlpha = fade * 0.5; ctx.lineWidth = 2 * S;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, easeOut(clamp(t * 1.8))), y); ctx.stroke();
    ctx.globalAlpha = fade;
    if (c.title) { ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.font = `400 ${Math.round(40 * S)}px "${font}"`; ctx.fillText(c.title, W / 2, H * 0.3); }
    pts.forEach((p, i) => {
      const k = easeOut(clamp(t * 2.2 - (i / Math.max(1, pts.length)) * 1.2));
      const x = lerp(x0, x1, pts.length < 2 ? 0.5 : i / (pts.length - 1));
      ctx.globalAlpha = fade * k;
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x, y, 9 * S, 0, 7); ctx.fill();
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.font = `400 ${Math.round(22 * S)}px "Avenir Next"`;
      const up = i % 2 === 0 ? -1 : 1;
      wrap(p.label, x, y + up * 46 * S, 230 * S, 28 * S, up < 0);
      ctx.fillStyle = accent; ctx.font = `600 ${Math.round(18 * S)}px "Menlo"`; ctx.fillText(p.when || '', x, y - up * 30 * S);
    });
  } else if (c.kind === 'list') {
    ctx.textAlign = 'left'; const items = c.items || [];
    const lh = 64 * S, y0 = H / 2 - (items.length * lh) / 2;
    if (c.title) { ctx.fillStyle = accent; ctx.font = `400 ${Math.round(30 * S)}px "Avenir Next"`; ctx.letterSpacing = '5px'; ctx.fillText(c.title.toUpperCase(), W * 0.14, y0 - lh); ctx.letterSpacing = '0px'; }
    items.forEach((it, i) => {
      const k = easeOut(clamp(t * 2.4 - i * 0.18));
      ctx.globalAlpha = fade * k; ctx.fillStyle = ink; ctx.font = `400 ${Math.round(44 * S)}px "${font}"`;
      ctx.fillText(it, W * 0.14 + (1 - k) * 30, y0 + i * lh);
    });
  }
  ctx.restore();
}

/// Writes `text` centred on x, wrapped to `max` px, going up from y if `upward`.
function wrap(text, x, y, max, lh, upward) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const w of words) { const tryLine = line ? line + ' ' + w : w; if (ctx.measureText(tryLine).width > max && line) { lines.push(line); line = w; } else line = tryLine; }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, upward ? y - (lines.length - 1 - i) * lh : y + i * lh));
}

// ---------------------------------------------------------------- words

function words(c, n) {
  const S = Math.min(W, H) / 1080;
  const t = (n - c.f0) / Math.max(1, c.f1 - c.f0);
  const sec = (n - c.f0) / FPS;
  const fade = clamp(Math.min(sec / 0.25, (c.f1 - n) / FPS / 0.2));
  const size = Math.round((c.size || 64) * S);
  const font = `${c.weight || 800} ${size}px "${c.font || 'Arial Black'}"`;
  const x = (c.x ?? 0.5) * W, y = (c.y ?? 0.8) * H;
  const ink = c.ink || '#fff', accent = c.accent || '#ffb347';
  ctx.save();
  ctx.font = font; ctx.textAlign = c.align || 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const text = c.upper ? c.text.toUpperCase() : c.text;
  switch (c.style) {
    case 'lower': {
      // A documentary lower third: a thin rule, a name, a quiet line under it.
      ctx.globalAlpha = fade; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const lx = W * 0.07, ly = H * 0.83;
      ctx.fillStyle = accent; ctx.fillRect(lx, ly - size * 1.05, 70 * S * easeOut(clamp(sec / 0.8)), 2 * S);
      ctx.fillStyle = ink; ctx.font = `400 ${size}px "${c.font || 'Baskerville'}"`; ctx.fillText(text, lx, ly);
      if (c.sub) { ctx.font = `400 ${Math.round(size * 0.42)}px "Avenir Next"`; ctx.letterSpacing = '4px'; ctx.fillStyle = 'rgba(244,241,234,.75)'; ctx.fillText(c.sub.toUpperCase(), lx, ly + size * 0.75); }
      break;
    }
    case 'subtitle': {
      ctx.globalAlpha = fade; ctx.font = `400 ${size}px "${c.font || 'Avenir Next'}"`;
      ctx.fillStyle = 'rgba(0,0,0,.42)'; const tw = ctx.measureText(text).width;
      ctx.fillRect(x - tw / 2 - 18 * S, y - size * 0.75, tw + 36 * S, size * 1.5);
      ctx.fillStyle = ink; ctx.fillText(text, x, y);
      break;
    }
    case 'stroke': {
      const k = back(clamp(sec / 0.22));
      ctx.translate(x, y); ctx.scale(k, k);
      ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#000'; ctx.strokeText(text, 0, 0);
      ctx.fillStyle = ink; ctx.fillText(text, 0, 0);
      break;
    }
    case 'box': {
      const tw = ctx.measureText(text).width, k = easeOut(clamp(sec / 0.15));
      ctx.translate(x, y); ctx.rotate(c.rot || 0);
      ctx.fillStyle = accent; ctx.fillRect(-tw / 2 - 20 * S, -size * 0.68, (tw + 40 * S) * k, size * 1.36);
      ctx.fillStyle = c.boxInk || '#000'; if (k > 0.6) ctx.fillText(text, 0, 2 * S);
      break;
    }
    case 'type': {
      const shown = text.slice(0, Math.floor(sec * 28));
      ctx.textAlign = 'left'; ctx.font = `600 ${size}px "${c.font || 'Menlo'}"`;
      const tw = ctx.measureText(text).width; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - tw / 2 - 16 * S, y - size * 0.7, tw + 32 * S, size * 1.4);
      ctx.fillStyle = accent; ctx.fillText(shown + ((n >> 3) % 2 ? '_' : ' '), x - tw / 2, y);
      break;
    }
    case 'kinetic': {
      // One word at a time, each somewhere new.
      const ws = text.split(' '), per = Math.max(1, (c.f1 - c.f0) / ws.length), i = Math.min(ws.length - 1, Math.floor((n - c.f0) / per));
      const r = hash(i * 97 + c.f0);
      const s = (0.8 + r * 1.2) * back(clamp(((n - c.f0) % per) / 6));
      ctx.translate(lerp(W * 0.25, W * 0.75, hash(i * 7 + c.f0)), lerp(H * 0.3, H * 0.75, hash(i * 11 + c.f0)));
      ctx.rotate((r - 0.5) * 0.3); ctx.scale(s, s);
      ctx.lineWidth = size * 0.18; ctx.strokeStyle = '#000'; ctx.strokeText(ws[i], 0, 0);
      ctx.fillStyle = i % 2 ? accent : ink; ctx.fillText(ws[i], 0, 0);
      break;
    }
    case 'stamp': {
      const k = clamp(sec / 0.1), shake = sec < 0.3 ? (hash(n) - 0.5) * 16 * S : 0;
      ctx.translate(x + shake, y + shake); ctx.rotate(-0.05); ctx.scale(lerp(2.4, 1, easeOut(k)), lerp(2.4, 1, easeOut(k)));
      ctx.globalAlpha = k; ctx.strokeStyle = accent; ctx.lineWidth = 8 * S; const tw = ctx.measureText(text).width;
      ctx.strokeRect(-tw / 2 - 24 * S, -size * 0.8, tw + 48 * S, size * 1.6); ctx.fillStyle = accent; ctx.fillText(text, 0, 4 * S);
      break;
    }
    case 'ticker': {
      ctx.fillStyle = accent; ctx.fillRect(0, y - size * 0.75, W, size * 1.5);
      ctx.fillStyle = '#000'; ctx.textAlign = 'left'; const tw = ctx.measureText(text + '   //   ').width;
      let sx = -((sec * 260 * S) % tw); while (sx < W) { ctx.fillText(text + '   //   ', sx, y + 2 * S); sx += tw; }
      break;
    }
    case 'label': {
      ctx.globalAlpha = fade; ctx.font = `500 ${Math.round(size * 0.6)}px "${c.font || 'Menlo'}"`; ctx.textAlign = 'left';
      const tx = c.tx ?? x / W - 0.12, ty = c.ty ?? y / H - 0.1;
      ctx.strokeStyle = accent; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(x, y, 7 * S, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx * W, ty * H); ctx.lineTo(tx * W + 30 * S, ty * H); ctx.stroke();
      ctx.fillStyle = ink; ctx.fillText(text, tx * W + 40 * S, ty * H);
      break;
    }
    case 'sticker': {
      const k = back(clamp(sec / 0.2)); ctx.translate(x, y); ctx.rotate(c.rot ?? -0.08); ctx.scale(k, k);
      const tw = ctx.measureText(text).width; ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.roundRect(-tw / 2 - 26 * S, -size * 0.85, tw + 52 * S, size * 1.7, 22 * S); ctx.fill();
      ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(-tw / 2 - 18 * S, -size * 0.7, tw + 36 * S, size * 1.4, 16 * S); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillText(text, 0, 2 * S);
      break;
    }
    default: { ctx.globalAlpha = fade; ctx.fillStyle = ink; ctx.fillText(text, x, y); }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the frame

const GRADE = EDL.grade || 'none';

window.render = async (n) => {
  const shots = EDL.shots;
  const i = shots.findIndex((s) => n >= s.f0 && n < s.f1);
  const shot = shots[i] ?? shots[shots.length - 1];
  await drawShot(A, shot, n);
  const tin = shot.tin;
  const into = n - shot.f0;
  ctx.save(); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  if (tin && tin.type !== 'cut' && i > 0 && into < tin.n) {
    // The outgoing shot carries on running under the transition.
    await drawShot(B, { ...shots[i - 1], f1: shots[i - 1].f1 + tin.n }, n);
    mix(tin.type, B, A, (into + 1) / (tin.n + 1), n);
  } else ctx.drawImage(A, 0, 0);
  ctx.restore();
  // The grade colours the picture only, not the words and cards laid over it.
  if (GRADE !== 'none') { T.getContext('2d').drawImage(canvas, 0, 0); ctx.save(); ctx.filter = GRADE; ctx.drawImage(T, 0, 0); ctx.restore(); }
  for (const o of EDL.overlays || []) if (n >= o.f0 && n < o.f1) overlay(o, n);
  for (const c of EDL.cards || []) if (n >= c.f0 && n < c.f1) card(c, n);
  for (const c of EDL.words || []) if (n >= c.f0 && n < c.f1) words(c, n);
  PREV.getContext('2d').drawImage(canvas, 0, 0);
  prevFrame = n;
};

function overlay(o, n) {
  ctx.save();
  if (o.kind === 'vignette') {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${o.amount ?? 0.55})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (o.kind === 'grain') grain(ctx, o.amount ?? 0.08, n);
  else if (o.kind === 'letterbox') { const b = H * (o.amount ?? 0.1); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b); }
  else if (o.kind === 'fade-in') { ctx.fillStyle = `rgba(0,0,0,${1 - clamp((n - o.f0) / Math.max(1, o.f1 - o.f0))})`; ctx.fillRect(0, 0, W, H); }
  else if (o.kind === 'fade-out') { ctx.fillStyle = `rgba(0,0,0,${clamp((n - o.f0) / Math.max(1, o.f1 - o.f0))})`; ctx.fillRect(0, 0, W, H); }
  else if (o.kind === 'progress') { ctx.fillStyle = o.color || '#fff'; ctx.fillRect(0, H - 8, W * (n / EDL.frames), 8); }
  ctx.restore();
}

await document.fonts.ready;
window.ready = true;
