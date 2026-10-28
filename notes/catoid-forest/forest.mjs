// The Idea Forest (claude.ai/artifact/XABcb8p6Fcfo3VwUKDPjQK), run headless. The algorithm below is the
// artifact's own, unchanged: shapes with typed holes, the fits() rules, weighted draws with surprisal bits,
// cross / reshape / regrow / fresh seed, novelty 40% + chance 30% + taste 30%, top 12 of 24 survive, stars
// always, culls never, newcomers at most half similar, three per shape, three kids per parent.
// Only the lists are new: seeded from anthonybecker.me (its demos, research, notes and tools) and from the
// simcluster's catoid week (Bluesky, 27 October 2026). A `cat` hole and five catoid shapes were added.
//
//   node forest.mjs seed            new forest, prints it
//   node forest.mjs judge '{"star":[3,7],"cull":[1]}'   stars/culls, then the next generation, prints it
//   node forest.mjs show
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
const FILE = new URL('./state.json', import.meta.url); // run state, next to this script

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const pickIdx = (n) => Math.floor(rand() * n);

/* ---------- organons, seeded from anthonybecker.me + catoid week ---------- */
const MEDIA = [
  // the site's own forms
  "a solo chess puzzle|dig,act", "a card battler|dig,act", "a trading card|phys", "a 33-second demoscene demo|dig,snd",
  "a game played on its own skin|dig,act", "a shelf of things to open, with every juice switch|dig,snd,act",
  "a hoverbike ride|dig,act", "a core drilled from a Bluesky account|dig,soc", "a room in Room World|dig,soc",
  "a gallery hung by photographer bots|dig,soc", "a hard techno track|snd", "a role meter|dig,snd",
  "a listening test|dig,snd,soc", "a humming transcriber|dig,snd", "a note from Claude|txt",
  "a research report with a hypothesis register|txt,dig", "a corpus map|dig,txt", "an accession record|txt,dig",
  "a voice review on the commute|snd,act", "a /skrng render batch|snd,dig", "a knob sweep|dig,snd", "an RFC|txt",
  "a voxel build|dig", "an atproto lexicon|dig,txt", "an MP4 capture|dig,snd", "a map with fast travel|dig",
  "a disappearing-ink drawing|dig,act", "a tower of glass floors|dig,act", "a Bluesky bot|dig,txt,soc",
  // a few of the artifact's originals that the simcluster also makes
  "a poster|phys,txt", "a zine|phys,txt", "a field guide|phys,txt", "a museum label|phys,txt", "a short film|dig,snd",
  "a ritual|act,soc", "a game show|act,soc", "a protocol|txt,act", "a manifesto|txt", "a sculpture|phys",
  "a deck of cards|phys", "a lullaby|snd", "a browser extension|dig", "a chatbot|dig,txt", "a dance|act",
].map((s) => { const [text, t] = s.split("|"); return { text, traits: t.split(",") }; });

const DOMAINS = [
  // anthonybecker.me
  "a sidechain pump", "stem separation", "a reference corpus", "a measurement that turned out bent", "a mixing session",
  "a museum accession desk", "a drill core's beds of rock", "solo chess where every move captures",
  "a snake playing on its own skin", "game juice", "a demoscene party", "a virus-busting arena", "a Bluesky firehose",
  "a visitor's room decaying", "photographer NPCs", "an automatic mixing engineer", "the commute listening loop",
  "a hypothesis register", "a hard techno warehouse", "an Ableton Live set", "a humming benchmark",
  "a count of the year's video games", "melodic space", "Gunkel's ideonomy", "a knob that lied",
  // catoid week
  "QWOP", "Chernoff faces", "SDF sculpting with capsules", "an ISO standard", "herding", "a Commodore 64",
  "the Cats of ATProto maze", "a giant crow that hunts the player", "category theory", "a Fluoddity slime colony",
  "the Simcluster Museum", "a quadruped avatar rig", "a cat show", "a vet's microchip registry",
];
const MATERIALS = [
  "signed distance fields", "voxels", "separated stems", "WGSL", "Bluesky records", "textmode characters",
  "glass floors", "rock beds", "capsules and smooth unions", "whiskers", "fur noise", "old receipts", "paper", "string",
];
const TWISTS = [
  { text: "turned inside out" }, { text: "scaled up to a whole city" }, { text: "that lasts one second" },
  { text: "made anonymously" }, { text: "with its most important part removed" }, { text: "where the flaw is the feature" },
  { text: "that decays on purpose" }, { text: "that only works in pairs" }, { text: "that strangers must finish" },
  { text: "done in total silence", conf: ["snd"] }, { text: "that gets worse the more you use it" },
  { text: "where every move takes a piece" }, { text: "that plays itself until you take the keys", req: ["dig", "act"] },
  { text: "measured until the ruler breaks" }, { text: "with every parameter on its own key" },
  { text: "photographed by bots" }, { text: "with a giant crow circling" }, { text: "that has nine lives" },
];
/* Gunkel's subdivisions of ideonomy, as in the artifact. */
const THEMES = [
  "abilities", "alternatives", "ambiguities", "analogies", "anomalies", "assumptions", "beliefs", "causes",
  "chains", "chances", "changes", "clusters", "conflicts", "connections", "cycles", "decisions", "defects",
  "differences", "errors", "excuses", "expectations", "experiments", "extremes", "flows", "games", "goals",
  "hierarchies", "histories", "illusions", "inversions", "leftovers", "limitations", "metaphors", "needs",
  "networks", "niches", "opportunities", "opposites", "origins", "paradoxes", "paths", "patterns",
  "perspectives", "plans", "predictions", "preparations", "problems", "questions", "recursions",
  "relaxations", "resources", "roles", "rules", "shortcuts", "simplicities", "spectrums", "stories",
  "strategies", "surprises", "uncertainties", "uses", "values", "wants", "wholes",
  "acts", "appearances", "beauties", "behaviors", "capacities", "combinations", "complexities", "controls",
  "definitions", "descriptions", "discoveries", "distributions", "domains", "effects", "elements", "emergents",
  "equilibriums", "evaluations", "examples", "first principles", "forms", "functions", "geneses",
  "groups", "identities", "images", "impossibilities", "instruments", "interpretations", "inventions", "languages",
  "laws", "levels", "measurements", "mechanisms", "methods", "models", "motions", "orders", "perfections",
  "possibilities", "practices", "processes", "proofs", "purposes", "representations", "self-effects", "series",
  "simulations", "spaces", "states", "transformations", "types", "ultimates", "virtuals", "works",
];
const PEOPLE = [
  "norvid", "an SDF sculptor", "a simcluster lurker", "a photographer bot", "a hard techno producer", "a Claude agent",
  "a cat", "a museum guard", "a C64 coder", "a beginner", "an expert", "a stranger", "a skeptic", "a child",
  "a commuter", "a night-shift nurse", "a vet", "a translator",
];
const STATES = ["bored", "in a hurry", "lost", "celebrating", "starting over", "procrastinating", "curious", "doomscrolling"];
const MOMENTS = ["at 3 a.m.", "on a long train ride", "during a power outage", "on catoid week's last day", "between two meetings"];
const GOALS = ["remember something", "show off a little", "make a decision", "fall asleep", "meet people", "learn one thing"];
const CATS = [
  "torso length", "Hot-dog-kitty-to-Jimothy axis", "ear shape", "whiskers",
  "fur grooming direction", "nine lives", "sitting pose", "tail", "face", "gait", "loaf mode",
  "leg count", "purr", "slow blink", "box capacity",
].map((t) => ({ text: t }));
const P = (text, extra) => ({ text, ...extra });
const CONSTRAINTS = [
  { text: "in fewer than {x} words", params: ["10", "25", "50", "100"].map((t) => P(t)), req: ["txt"] },
  { text: "built in {x}", params: ["30 minutes", "one hour", "one afternoon", "a weekend"].map((t) => P(t)) },
  { text: "with no more than {x} parts", params: ["2", "3", "4", "5"].map((t) => P(t)) },
  { text: "using only {x}", params: ["one color", "two colors", "black and white"].map((t) => P(t)), req: ["phys", "dig"] },
  { text: "that takes {x} to experience", params: ["10 seconds", "33 seconds", "five minutes", "a full week"].map((t) => P(t)) },
  { text: "involving exactly {x}", params: ["two people", "eight bots", "one person and a stranger", "the whole simcluster"].map((t) => P(t)) },
  { text: "without {x}", params: [P("words", { conf: ["txt"] }), P("screens", { conf: ["dig"] }), P("sound", { conf: ["snd"] }), P("asking permission"), P("a server")] },
  { text: "that works {x}", params: ["offline", "with one hand", "in the dark", "on a phone"].map((t) => P(t)) },
  { text: "repeated {x}", params: ["every day of catoid week", "every Sunday", "once a year"].map((t) => P(t)) },
];

/* ---------- grammar (the artifact's, plus five catoid shapes) ---------- */
const SITUATIONS = [
  ...STATES.map((t) => ({ text: `who is ${t}` })),
  ...MOMENTS.map((t) => ({ text: t })),
  ...GOALS.map((t) => ({ text: `who wants to ${t}` })),
];
const POOLS = {
  medium: MEDIA,
  domain: DOMAINS.map((t) => ({ text: t })),
  theme: THEMES.map((t) => ({ text: t })),
  material: MATERIALS.map((t) => ({ text: t, req: ["phys", "dig"] })),
  twist: TWISTS,
  person: PEOPLE.map((t) => ({ text: t })),
  sit: SITUATIONS,
  con: CONSTRAINTS,
  cat: CATS,
};
const SHAPES = [
  "Can {domain} have {theme}?",
  "Can {medium} have {theme}?",
  "What are the {theme} of {medium}?",
  "Where do {theme} hide in {domain}?",
  "What is {domain} without its {theme}?",
  "{medium} made of {material}.",
  "{medium} {twist}.",
  "{domain} {twist}.",
  "{medium}, run like {domain}.",
  "{medium} crossed with {medium2}.",
  "{medium} {con}.",
  "{medium} for {person} {sit}.",
  "{medium} for {person}, {con}.",
  "{domain}, but for {person}.",
  "What would {person} {sit} put in {medium}?",
  "The {theme} of {domain}, as {medium}.",
  "{theme} of {theme2}, as {medium}.",
  "Teach {theme} with {medium}.",
  "Map the {theme} of {person} {sit}.",
  "Combine {domain} and {domain2} into {medium}.",
  // catoid shapes
  "A catoid version of {medium}, where its {cat} is the control.",
  "{medium} about the {theme} of a catoid's {cat}.",
  "{domain}, but every part is a catoid's {cat}.",
  "{medium}, made catoid, {twist}.",
  "A catoid's {cat} and {cat2}, run like {domain}.",
].map((tpl, i) => {
  const ids = [...tpl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  if (ids.includes("con")) ids.push("param");
  const rank = (id) => (id === "medium" ? 0 : id === "param" || id === "sit" || id === "theme2" ? 2 : 1);
  return { id: `s${i + 1}`, tpl, holes: ids.slice().sort((a, b) => rank(a) - rank(b)), shown: ids };
});
const SHAPE = Object.fromEntries(SHAPES.map((s) => [s.id, s]));
const typeOf = (id) => (id === "param" ? "param" : id.replace(/2$/, ""));
const PARENT = { sit: "person", param: "con", theme2: "theme" };
const optionsFor = (id, a) => (id === "param" ? (a.con ? a.con.params : []) : POOLS[typeOf(id)]);

function fits(shape, a) {
  const S = SHAPE[shape], m = a.medium, hasMedium = S.holes.includes("medium");
  for (const id of ["twist", "material", "con", "param"]) {
    const o = a[id];
    if (!o) continue;
    if (o.req && (!hasMedium || (m && !o.req.some((t) => m.traits.includes(t))))) return false;
    if (o.conf && m && o.conf.some((t) => m.traits.includes(t))) return false;
  }
  if (m && a.medium2 && (a.medium2.text === m.text || a.medium2.traits.every((t) => m.traits.includes(t)))) return false;
  if (a.theme && a.theme2 && a.theme.text === a.theme2.text) return false;
  if (a.domain && a.domain2 && a.domain.text === a.domain2.text) return false;
  if (a.cat && a.cat2 && a.cat.text === a.cat2.text) return false;
  if (a.con && a.param && !a.con.params.some((p) => p.text === a.param.text)) return false;
  return true;
}
function wDraw(list, W, keyOf = (o) => o.text) {
  const ws = list.map((o) => W[keyOf(o)] ?? 1);
  const tot = ws.reduce((x, y) => x + y, 0);
  let r = rand() * tot;
  for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return { o: list[i], b: -Math.log2(ws[i] / tot) }; }
  return { o: list[list.length - 1], b: -Math.log2(ws[list.length - 1] / tot) };
}
function assemble(shape, keep, W) {
  const a = {}, bits = {};
  for (const id of SHAPE[shape].holes) {
    const inherited = (keep[id] || []).filter((c) => fits(shape, { ...a, [id]: c.o }));
    if (inherited.length) { const c = inherited[pickIdx(inherited.length)]; a[id] = c.o; bits[id] = c.b; continue; }
    const ok = optionsFor(id, a).filter((o) => fits(shape, { ...a, [id]: o }));
    if (!ok.length) return null;
    const d = wDraw(ok, W);
    a[id] = d.o; bits[id] = d.b;
  }
  return { shape, nodes: a, bits };
}
function drawShape(W, exclude) {
  const d = wDraw(SHAPES.filter((s) => s.id !== exclude), W, (s) => `shape:${s.id}`);
  return { shape: d.o.id, b: d.b };
}
const offer = (t, skip = new Set()) => { const k = {}; Object.keys(t.nodes).forEach((id) => { if (!skip.has(id)) k[id] = [{ o: t.nodes[id], b: t.bits[id] }]; }); return k; };
const withShapeBits = (r, b) => r && { ...r, bits: { ...r.bits, shape: b } };
function fresh(W) { const s = drawShape(W); return withShapeBits(assemble(s.shape, {}, W), s.b); }
function reshape(A, W) { const s = drawShape(W, A.shape); const r = withShapeBits(assemble(s.shape, offer(A), W), s.b); return r && { ...r, how: `reshaped from #${A.id}`, parents: [A.id] }; }
function reroll(A, W) {
  const ids = SHAPE[A.shape].holes.filter((id) => !PARENT[id]);
  const n = Math.max(1, Math.ceil(ids.length / 2));
  const pick = new Set();
  while (pick.size < n) pick.add(ids[pickIdx(ids.length)]);
  SHAPE[A.shape].holes.forEach((id) => { if (PARENT[id] && pick.has(PARENT[id])) pick.add(id); });
  const r = assemble(A.shape, offer(A, pick), W);
  return r && { ...r, bits: { ...r.bits, shape: A.bits.shape }, how: `regrown from #${A.id}`, parents: [A.id] };
}
function cross(A, B, W) {
  const base = rand() < 0.5 ? A : B;
  const keep = {};
  [A, B].forEach((t) => Object.keys(t.nodes).forEach((id) => { (keep[id] = keep[id] || []).push({ o: t.nodes[id], b: t.bits[id] }); }));
  const r = assemble(base.shape, keep, W);
  return r && { ...r, bits: { ...r.bits, shape: base.bits.shape }, how: `cross of #${A.id} × #${B.id}`, parents: [A.id, B.id] };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const conText = (a) => a.con.text.replace("{x}", a.param.text);
const render = (t) => cap(SHAPE[t.shape].tpl.replace(/\{(\w+)\}/g, (_, id) => (id === "con" ? conText(t.nodes) : t.nodes[id].text)));
const itemKeys = (t) => [`shape:${t.shape}`, ...Object.keys(t.nodes).map((id) => `${typeOf(id)}:${t.nodes[id].text}`)];

const POP = 24, KEEP = 12, MAX_SIM = 0.5, MAX_PER_SHAPE = 3, MAX_KIDS = 3;
function similarity(a, b) { const A = new Set(itemKeys(a)), B = new Set(itemKeys(b)); let i = 0; A.forEach((x) => { if (B.has(x)) i++; }); return i / (A.size + B.size - i); }
const farEnough = (t, forest) => forest.every((u) => similarity(t, u) <= MAX_SIM);
const shapeRoom = (t, forest) => forest.filter((u) => u.shape === t.shape).length < MAX_PER_SHAPE;
function measure(forest, W) {
  const nov = forest.map((t, i) => { if (forest.length < 2) return 1; let s = 0; forest.forEach((u, j) => { if (i !== j) s += 1 - similarity(t, u); }); return s / (forest.length - 1); });
  const chance = forest.map((t) => { const v = Object.values(t.bits); return v.reduce((x, y) => x + y, 0) / v.length; });
  const taste = forest.map((t) => { const k = itemKeys(t).map((x) => x.startsWith("shape:") ? x : x.split(":").slice(1).join(":")); return k.reduce((s, x) => s + Math.log2(W[x] ?? 1), 0) / k.length; });
  const norm = (arr) => { const lo = Math.min(...arr), hi = Math.max(...arr); return arr.map((v) => (hi - lo < 1e-9 ? 0.5 : (v - lo) / (hi - lo))); };
  const nn = norm(nov), nc = norm(chance), nt = norm(taste);
  const scored = forest.map((t, i) => ({ ...t, m: { nov: nov[i], chance: chance[i], taste: taste[i], score: 0.4 * nn[i] + 0.3 * nc[i] + 0.3 * nt[i] } }));
  scored.sort((a, b) => b.m.score - a.m.score);
  const surv = new Set(scored.filter((t) => t.star).map((t) => t.id));
  for (const t of scored) { if (surv.size >= KEEP) break; if (!t.star && !t.strike) surv.add(t.id); }
  return { ranked: scored, surv };
}
function nextGeneration(state) {
  const { ranked, surv } = measure(state.forest, state.W);
  const parents = ranked.filter((t) => surv.has(t.id)).map((t) => { const { m, ...rest } = t; return { ...rest, born: false }; });
  const out = [...parents], kids = {};
  let id = state.nextId, tries = 0;
  const admit = (c) => c && fits(c.shape, c.nodes) && farEnough(c, out) && shapeRoom(c, out);
  while (out.length < POP && tries++ < 3000) {
    const pool = parents.filter((t) => (kids[t.id] || 0) < MAX_KIDS);
    const r = rand();
    let c;
    if (pool.length >= 2 && r < 0.25) { const i = pickIdx(pool.length); let j = pickIdx(pool.length - 1); if (j >= i) j++; c = cross(pool[i], pool[j], state.W); }
    else if (pool.length && r < 0.45) c = reshape(pool[pickIdx(pool.length)], state.W);
    else if (pool.length && r < 0.6) c = reroll(pool[pickIdx(pool.length)], state.W);
    else { const f = fresh(state.W); c = f && { ...f, how: "fresh seed", parents: [] }; }
    if (!admit(c)) continue;
    c.parents.forEach((p) => { kids[p] = (kids[p] || 0) + 1; });
    out.push({ id: id++, shape: c.shape, nodes: c.nodes, bits: c.bits, how: c.how, gen: state.gen + 1, star: false, strike: false, born: true });
  }
  while (out.length < POP) {
    const c = fresh(state.W);
    if (!c || (!(farEnough(c, out) && shapeRoom(c, out)) && tries++ < 6000)) continue;
    out.push({ id: id++, shape: c.shape, nodes: c.nodes, bits: c.bits, how: "fresh seed", gen: state.gen + 1, star: false, strike: false, born: true });
  }
  return { ...state, forest: out, gen: state.gen + 1, nextId: id };
}
function seedForest(W = {}) {
  const forest = []; let id = 1, tries = 0;
  while (forest.length < POP) {
    const c = fresh(W);
    if (!c || (!(farEnough(c, forest) && shapeRoom(c, forest)) && tries++ < 4000)) continue;
    forest.push({ id: id++, shape: c.shape, nodes: c.nodes, bits: c.bits, how: "fresh seed", gen: 1, star: false, strike: false, born: true });
  }
  return { forest, gen: 1, nextId: id, W, log: [] };
}
/* Stars and culls teach the forest (the artifact's judge(), applied per id). */
function judge(s, id, field) {
  const W = { ...s.W };
  const nudge = (t, f, on) => {
    const factor = f === "star" ? 1.3 : 0.75;
    [`shape:${t.shape}`, ...Object.values(t.nodes).map((o) => o.text)].forEach((key) => { W[key] = Math.min(4, Math.max(0.2, (W[key] ?? 1) * (on ? factor : 1 / factor))); });
  };
  const forest = s.forest.map((t) => {
    if (t.id !== id) return t;
    const n = { ...t }, other = field === "star" ? "strike" : "star";
    if (!n[field] && n[other]) { nudge(n, other, false); n[other] = false; }
    n[field] = !n[field];
    nudge(n, field, n[field]);
    return n;
  });
  return { ...s, forest, W };
}

function show(s) {
  const { ranked, surv } = measure(s.forest, s.W);
  console.log(`Gen ${s.gen} · ${new Set(s.forest.map((t) => t.shape)).size} shapes`);
  for (const [i, t] of ranked.entries()) console.log(`${String(i + 1).padStart(2)} ${surv.has(t.id) ? ' ' : '✗'}${t.star ? '★' : ' '} #${t.id} [${t.m.score.toFixed(2)}] ${render(t)}   (${t.how})`);
}
const [cmd, arg] = process.argv.slice(2);
let s = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : null;
if (cmd === 'seed') s = seedForest();
if (cmd === 'judge') {
  const j = JSON.parse(arg);
  for (const id of j.star || []) s = judge(s, id, 'star');
  for (const id of j.cull || []) s = judge(s, id, 'strike');
  s.log.push({ gen: s.gen, stars: (j.star || []).map((id) => render(s.forest.find((t) => t.id === id))), culls: (j.cull || []).map((id) => render(s.forest.find((t) => t.id === id))) });
  s = nextGeneration(s);
}
if (cmd === 'final') {
  const { ranked } = measure(s.forest, s.W);
  writeFileSync(new URL('./final.json', import.meta.url), JSON.stringify({ gen: s.gen, log: s.log, ranked: ranked.map((t) => ({ id: t.id, idea: render(t), star: t.star, how: t.how, score: t.m.score })), W: s.W }, null, 1));
}
writeFileSync(FILE, JSON.stringify(s));
show(s);
