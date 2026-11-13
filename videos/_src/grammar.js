// The film grammar: everything a director may choose from, as plain data. The calm and short styles
// use fixed, restrained choices from here. The hype style draws a different set every time (see
// `drawHype`), and avoids the combinations the library used recently, so the cuts never settle into
// one look.

/// A small seeded random source, so a video can be made again exactly from its seed.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.range = (a, b) => a + (b - a) * next();
  next.int = (a, b) => Math.floor(a + (b - a + 1) * next());
  next.shuffle = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  /// Picks `n` different items, preferring ones not in `avoid`.
  next.some = (list, n, avoid = []) => {
    const fresh = next.shuffle(list.filter((x) => !avoid.includes(x)));
    const stale = next.shuffle(list.filter((x) => avoid.includes(x)));
    return [...fresh, ...stale].slice(0, n);
  };
  return next;
}

/// Fonts installed on this Mac, in families of character. Names are CSS font-family names.
export const FONTS = {
  serif: ['Didot', 'Baskerville', 'New York', 'Hoefler Text', 'Bodoni 72', 'Big Caslon'],
  sans: ['Avenir Next', 'Helvetica Neue', 'Futura', 'Gill Sans', 'Optima', 'Avenir Next Condensed'],
  display: ['Arial Black', 'Impact', 'Futura', 'Rockwell', 'Copperplate', 'Superclarendon', 'Phosphate', 'Silom', 'Krungthep'],
  hand: ['Marker Felt', 'Chalkboard SE', 'Chalkduster', 'Trattatello', 'Apple Chancery'],
  mono: ['Menlo', 'Courier New', 'American Typewriter'],
};

/// How a shot frames its footage. Each is a camera move over a still or moving source.
export const SHOTS = [
  'wide',        // the whole frame, a slow drift
  'push',        // a steady push in on a region
  'pull',        // starts close, pulls out
  'macro',       // very close on a detail, barely moving
  'dutch',       // tilted a few degrees, drifting
  'whip',        // a fast pan that lands on the subject
  'crash',       // a sudden zoom in on a beat
  'handheld',    // small wandering shake
  'split2',      // two sources side by side
  'split3',      // three strips
  'pip',         // a small inset over a blurred copy
  'grid4',       // four tiles, each a different moment
  'mirror',      // mirrored halves
  'freeze',      // a held frame, cut out like a sticker on a colour field
];

/// How one shot gives way to the next.
export const TRANSITIONS = [
  'cut', 'dissolve', 'dip-black', 'dip-white', 'flash', 'whip-left', 'whip-up', 'push-left',
  'slide-up', 'iris', 'wipe-diagonal', 'luma', 'glitch-slices', 'zoom-through', 'spin', 'blinds', 'pixel',
];

/// Picture effects laid over a shot.
export const EFFECTS = [
  'none', 'rgb-split', 'pixelate', 'posterize', 'scanlines', 'grain-heavy', 'halftone', 'duotone',
  'invert-flash', 'strobe', 'trails', 'vhs', 'bloom', 'high-contrast-bw', 'saturate', 'chroma-wobble',
];

/// How the edit decides when to cut.
export const CUT_METHODS = [
  'on-the-beat',      // every cut lands on a beat
  'on-the-bar',       // longer shots, cuts on the bar
  'accelerate',       // shots get shorter towards the drop
  'stutter',          // a shot repeats in tiny slices before moving on
  'jump',             // jump cuts inside one shot
  'match',            // consecutive shots share a position, so only the content changes
  'off-beat',         // cuts land half a beat late, for swing
];

/// How words come on screen.
export const CAPTIONS = [
  'stroke',           // heavy outlined caps
  'box',              // words on solid tags
  'type',             // typed out, letter by letter
  'kinetic',          // one word at a time, each in a new place and size
  'stamp',            // slammed on with a shake
  'ticker',           // a scrolling strip
  'label',            // small technical labels with leader lines
  'sticker',          // rotated cut-out stickers
];

/// Colour treatments for the whole film.
export const GRADES = [
  { name: 'neutral', filter: 'contrast(1.05)' },
  { name: 'warm', filter: 'sepia(0.25) saturate(1.2) contrast(1.08)' },
  { name: 'cold', filter: 'hue-rotate(-12deg) saturate(0.9) contrast(1.12) brightness(0.98)' },
  { name: 'bleach', filter: 'saturate(0.55) contrast(1.35)' },
  { name: 'punch', filter: 'saturate(1.6) contrast(1.25)' },
  { name: 'faded', filter: 'contrast(0.88) brightness(1.06) saturate(0.85)' },
  { name: 'mono', filter: 'grayscale(1) contrast(1.3)' },
  { name: 'acid', filter: 'hue-rotate(40deg) saturate(1.8) contrast(1.2)' },
];

/// Accent colours for text and cards, in pairs (main, second).
export const PALETTES = [
  ['#ffb347', '#6dffa0'], ['#ff3d6e', '#ffe14d'], ['#3df5ff', '#ff5ce1'], ['#f4f1ea', '#111111'],
  ['#c6ff3d', '#2b2bff'], ['#ff7a1a', '#1a1aff'], ['#ffffff', '#ff2a2a'], ['#ffd700', '#000000'],
];

/// Music for the hype style: the beat it rides.
export const BEATS = [
  { name: 'breakbeat', bpm: [128, 140] },
  { name: 'four-floor', bpm: [122, 132] },
  { name: 'half-time', bpm: [140, 160] },
  { name: 'jungle', bpm: [160, 174] },
  { name: 'boom-bap', bpm: [86, 96] },
  { name: 'gallop', bpm: [118, 126] },
];

/// The fingerprint of a hype film's choices, kept in the library so later films avoid them.
export function fingerprint(g) {
  return [g.font, g.captions, g.grade, g.cut, g.beat, ...g.transitions.slice(0, 3), ...g.effects.slice(0, 3), ...g.shots.slice(0, 4)];
}

/// Draws a fresh hype grammar. `recent` is a list of fingerprints of recent hype films; their choices
/// are used last.
export function drawHype(r, recent = []) {
  const used = new Set(recent.flat());
  const avoid = (list) => list.filter((x) => used.has(x));
  const families = r.some(['display', 'hand', 'mono', 'sans', 'serif'], 2);
  const fonts = [...FONTS[families[0]], ...FONTS[families[1]]];
  return {
    font: r.some(fonts, 1, avoid(fonts))[0],
    font2: r.pick(FONTS.mono),
    captions: r.some(CAPTIONS, 1, avoid(CAPTIONS))[0],
    grade: r.some(GRADES.map((g) => g.name), 1, avoid(GRADES.map((g) => g.name)))[0],
    cut: r.some(CUT_METHODS, 1, avoid(CUT_METHODS))[0],
    beat: r.some(BEATS.map((b) => b.name), 1, avoid(BEATS.map((b) => b.name)))[0],
    transitions: r.some(TRANSITIONS.filter((t) => t !== 'cut'), 4, avoid(TRANSITIONS)),
    effects: r.some(EFFECTS.filter((e) => e !== 'none'), 4, avoid(EFFECTS)),
    shots: r.some(SHOTS, 6, avoid(SHOTS)),
    palette: r.pick(PALETTES),
    letterbox: r() < 0.3,
    speedRamp: r() < 0.5,
  };
}
