// The agent panel: Claude Code jobs on the Mac, called from this page.
//
// POST /api/rpc {method, params} with the same key as the voice review.
// The site forwards the call to the Mac's harness over the socket the Mac
// keeps open (src/rig.js, zpkt/lib/harness), and answers when the Mac does.
//
//   ping        is the Mac connected?
//   ask         a short read-only answer, synchronously (up to two minutes)
//   feedback    start a job that reads this batch's answers and acts on them
//   jobs        the recent jobs; job_status one job and its last steps
//
// The voice review calls window.skrngAgent.fromFeedback() when it ends, so a
// finished review starts a job without a tap.

const KEY_STORE = "skrng.key";
const POLL_MS = 10000;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function key() {
  try { return localStorage.getItem(KEY_STORE) || ""; } catch { return ""; }
}

export async function rpc(method, params = {}, timeoutMs) {
  const k = key();
  if (!k) return { error: "No key on this device. Open the page once with your key link." };
  try {
    const res = await fetch("/api/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
      body: JSON.stringify(timeoutMs ? { method, params, timeout_ms: timeoutMs } : { method, params }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error || `HTTP ${res.status}`, status: res.status };
    return body;
  } catch {
    return { error: "Offline." };
  }
}

const when = (t) => (t ? new Date(t * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const mins = (j) => (j.started ? Math.max(1, Math.round(((j.finished || Date.now() / 1000) - j.started) / 60)) : 0);
const LABEL = { queued: "waiting", running: "running", done: "done", failed: "failed" };

function start(page) {
  const panel = $("agent");
  const status = $("ag-status");
  const list = $("ag-jobs");
  const bFeedback = $("ag-feedback");
  const askForm = $("ag-ask");
  const askInput = $("ag-q");
  const answer = $("ag-answer");
  let timer = null;
  let open = new Set(); // job ids whose detail is shown

  panel.hidden = false;

  async function ping() {
    if (!key()) { status.textContent = "No key on this device: open the page once with your key link to use the agent."; return false; }
    const r = await rpc("ping");
    if (r.error) { status.textContent = r.status === 503 ? "The Mac is offline. Jobs start when it reconnects; your answers are kept on the site." : r.error; return false; }
    const { running, queued } = r.result;
    status.textContent = `The Mac is online${running ? ", running a job" : ""}${queued ? `, ${queued} waiting` : ""}.`;
    return true;
  }

  function render(jobs) {
    if (!jobs.length) { list.innerHTML = '<li class="empty">No jobs yet.</li>'; return; }
    list.innerHTML = jobs.map((j) => `
      <li data-id="${esc(j.id)}" class="job ${esc(j.status)}">
        <button type="button" class="job-row" aria-expanded="${open.has(j.id)}">
          <span class="job-state">${esc(LABEL[j.status] || j.status)}</span>
          <span class="job-title">${esc(j.title)}</span>
          <span class="job-when">${esc(when(j.started || j.created))}${j.started ? ` · ${mins(j)} min` : ""}</span>
        </button>
        <div class="job-detail" ${open.has(j.id) ? "" : "hidden"}>
          ${j.result ? `<p class="job-result">${esc(j.result)}</p>` : ""}
          ${j.error ? `<p class="job-error">${esc(j.error)}</p>` : ""}
          ${j.session_id ? `<p class="job-resume">Continue it on the Mac: <code>cd ~/Desktop &amp;&amp; claude --resume ${esc(j.session_id)}</code></p>` : ""}
          <ol class="job-steps"></ol>
        </div>
      </li>`).join("");
    list.querySelectorAll("li.job").forEach((li) => {
      if (open.has(li.dataset.id)) steps(li);
      li.querySelector(".job-row").addEventListener("click", () => {
        const d = li.querySelector(".job-detail");
        d.hidden = !d.hidden;
        li.querySelector(".job-row").setAttribute("aria-expanded", String(!d.hidden));
        if (d.hidden) open.delete(li.dataset.id); else { open.add(li.dataset.id); steps(li); }
      });
    });
  }

  async function steps(li) {
    const r = await rpc("job_status", { id: li.dataset.id, tail: 12 });
    if (r.error) return;
    li.querySelector(".job-steps").innerHTML = r.result.events.map((e) =>
      e.tool ? `<li><b>${esc(e.tool)}</b> ${esc(e.input)}</li>` : `<li>${esc(e.text)}</li>`).join("");
  }

  async function refresh() {
    clearTimeout(timer);
    const online = await ping();
    if (online) {
      const r = await rpc("jobs", { n: 8 });
      if (!r.error) {
        render(r.result.jobs);
        if (r.result.jobs.some((j) => j.status === "running" || j.status === "queued")) {
          timer = setTimeout(() => { if (!document.hidden) refresh(); }, POLL_MS);
        }
      }
    }
    bFeedback.disabled = !online;
    askForm.querySelector("button").disabled = !online;
  }

  async function fromFeedback(batch, session) {
    const r = await rpc("feedback", { batch, session });
    if (r.error) return { ok: false, text: r.status === 503 ? "The Mac is offline, so no job started. Your answers are saved." : `No job started: ${r.error}` };
    refresh();
    return { ok: true, id: r.result.job_id, text: r.result.deduplicated ? "A job for this batch is already waiting." : "Sent to the agent. You will get a notification when it starts and when it is done." };
  }

  bFeedback.addEventListener("click", async () => {
    bFeedback.disabled = true;
    const r = await fromFeedback(page.n, "button");
    status.textContent = r.text;
    bFeedback.disabled = false;
  });

  askForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = askInput.value.trim();
    if (!q) return;
    const b = askForm.querySelector("button");
    b.disabled = true;
    answer.hidden = false;
    answer.textContent = "Asking the Mac…";
    const r = await rpc("ask", { prompt: `About /skrng batch ${page.n}: ${q}` });
    answer.textContent = r.error ? r.error : r.result.answer;
    b.disabled = false;
  });

  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  window.skrngAgent = { fromFeedback, refresh, rpc };
  refresh();
}

if (window.skrngPage) start(window.skrngPage);
else window.addEventListener("skrng:ready", (e) => start(e.detail), { once: true });
