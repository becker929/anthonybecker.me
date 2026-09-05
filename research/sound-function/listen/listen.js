// "Stage 2: ask producers" listening test. One pair of sounds at a time,
// in random order, with the A/B side shuffled per pair. Posts each answer
// right after the pair so a partial visit still counts. The session id is
// a plain in-memory value — never a cookie, never localStorage — so it
// disappears the moment the tab closes.

const JOBS = [
  { value: "kick", label: "kick" },
  { value: "rumble", label: "rumble" },
  { value: "hat", label: "hat" },
  { value: "clap", label: "clap" },
  { value: "hook", label: "hook" },
  { value: "space", label: "space" },
  { value: "not_sure", label: "not sure" },
];

const MORE_QUESTION = {
  kick: "Which one is more of a kick?",
  rumble: "Which one is more of a rumble?",
  hat: "Which one is more of a hat?",
  clap: "Which one is more of a clap?",
  hook: "Which one is more of a hook?",
  space: "Which one is more like space?",
};

const MAX_ELAPSED_MS = 10 * 60 * 1000;

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// One session id, kept only in this variable — never written to a cookie
// or to browser storage, and never sent anywhere but our own /api/listen.
const SESSION_ID = randomId();

const state = {
  pairs: [],
  index: 0,
  answered: 0,
  profile: { producer: null, years: null },
  pairStartedAt: 0,
  currentOrder: null, // "ab" or "ba"
};

const els = {};

function byId(id) {
  return document.getElementById(id);
}

function renderJobGroup(container, name) {
  container.innerHTML = "";
  for (const job of JOBS) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = job.value;
    label.appendChild(input);
    label.appendChild(document.createTextNode(" " + job.label));
    container.appendChild(label);
  }
}

function selectedValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : null;
}

function clearRadios(name) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
    el.checked = false;
  });
}

function postAnswer(payload) {
  try {
    fetch("/api/listen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // A failed post should never block the test from continuing.
  }
}

function showSection(name) {
  ["intro", "test", "done"].forEach((id) => {
    byId(id).hidden = id !== name;
  });
}

function currentPair() {
  return state.pairs[state.index];
}

function renderPair() {
  const pair = currentPair();
  if (!pair) {
    finish();
    return;
  }

  byId("progress-num").textContent = String(state.index + 1);
  byId("progress-total").textContent = String(state.pairs.length);

  // Shuffle which side (A/B) plays which file, per pair.
  state.currentOrder = Math.random() < 0.5 ? "ab" : "ba";
  const first = state.currentOrder === "ab" ? pair.a : pair.b;
  const second = state.currentOrder === "ab" ? pair.b : pair.a;

  els.playerA.pause();
  els.playerB.pause();
  els.playerA.src = first.file;
  els.playerB.src = second.file;
  els.playerA.load();
  els.playerB.load();

  clearRadios("jobA");
  clearRadios("jobB");
  clearRadios("more");
  byId("hint").hidden = true;

  byId("more-label").textContent = MORE_QUESTION[pair.job] || `Which one is more of a ${pair.job}?`;

  state.pairStartedAt = Date.now();
}

function handleNext(event) {
  event.preventDefault();

  const jobA = selectedValue("jobA");
  const jobB = selectedValue("jobB");
  const more = selectedValue("more");

  if (!jobA || !jobB || !more) {
    byId("hint").hidden = false;
    return;
  }

  const elapsed = Date.now() - state.pairStartedAt;
  const elapsedMs = Math.max(0, Math.min(MAX_ELAPSED_MS, elapsed));

  postAnswer({
    session: SESSION_ID,
    pair: currentPair().id,
    order: state.currentOrder,
    jobs: { a: jobA, b: jobB },
    more,
    elapsed_ms: elapsedMs,
    profile: state.profile,
  });

  state.answered += 1;
  state.index += 1;
  renderPair();
}

function handleStop() {
  finish();
}

function finish() {
  showSection("done");
  byId("done-count").textContent = `You answered ${state.answered} pair${state.answered === 1 ? "" : "s"}. Thank you.`;
}

function startTest(event) {
  event.preventDefault();

  const producer = selectedValue("producer");
  const yearsInput = byId("years").value.trim();
  const years = yearsInput === "" ? null : Number(yearsInput);
  state.profile = {
    producer: producer || null,
    years: Number.isFinite(years) ? years : null,
  };

  state.pairs = shuffle(state.pairs);
  state.index = 0;
  state.answered = 0;

  showSection("test");
  renderPair();
}

async function init() {
  els.playerA = byId("playerA");
  els.playerB = byId("playerB");

  renderJobGroup(document.querySelector('[data-job-group="jobA"]'), "jobA");
  renderJobGroup(document.querySelector('[data-job-group="jobB"]'), "jobB");

  byId("profile-form").addEventListener("submit", startTest);
  byId("pair-form").addEventListener("submit", handleNext);
  byId("btn-stop").addEventListener("click", handleStop);

  try {
    const res = await fetch("pairs.json");
    state.pairs = await res.json();
    byId("progress-total").textContent = String(state.pairs.length);
  } catch {
    byId("intro").innerHTML =
      "<p>Sorry, the test could not load. Please try again later.</p>";
  }
}

init();
