// The lab's browser side: upload items file by file, list them, show reports.
const API = "/lab/api";
const $ = (s) => document.querySelector(s);
const fmtBytes = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.round(n / 1e3) + " kB");
const fmtWhen = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

async function api(path, init = {}) {
  const res = await fetch(API + path, { credentials: "same-origin", ...init });
  if (res.status === 401) { location.reload(); throw new Error("signed out"); }
  const ct = res.headers.get("Content-Type") || "";
  const body = ct.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error(body && body.error ? body.error : `HTTP ${res.status}`);
  return body;
}

// ---- upload -------------------------------------------------------------------
$("#upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget; const data = new FormData(form);
  const files = [...form.elements.files.files];
  const status = $("#upload-status"); const progress = $("#progress");
  if (!files.length) { status.textContent = "Choose at least one file."; return; }
  if (data.get("kind") !== "multitrack" && files.length > 1) { status.textContent = "Only a multitrack item takes several files."; return; }
  $("#go").disabled = true; progress.innerHTML = ""; status.textContent = "Creating item…";
  try {
    const item = await api("/items", { method: "POST", body: JSON.stringify({ kind: data.get("kind"), title: data.get("title"), notes: data.get("notes") }) });
    for (const f of files) {
      const li = document.createElement("li"); li.innerHTML = `<span>${f.name}</span><span>${fmtBytes(f.size)} · sending</span>`; progress.append(li);
      const name = f.name.replace(/[^A-Za-z0-9 ._()\-]/g, "_").replace(/^[^A-Za-z0-9]+/, "").slice(0, 120) || "file.wav";
      await api(`/items/${item.id}/files/${encodeURIComponent(name)}`, { method: "PUT", headers: { "Content-Type": f.type || "application/octet-stream", "Content-Length": String(f.size) }, body: f });
      li.lastElementChild.textContent = `${fmtBytes(f.size)} · stored`;
    }
    await api(`/items/${item.id}/finish`, { method: "POST" });
    status.textContent = "Uploaded. The runner will pick it up.";
    form.reset(); await loadItems();
  } catch (err) {
    status.textContent = "Upload failed: " + err.message;
  } finally { $("#go").disabled = false; }
});

// ---- list ---------------------------------------------------------------------
let items = [];
async function loadItems() {
  const list = $("#item-list");
  try {
    items = (await api("/items")).items;
  } catch (err) { list.innerHTML = `<li class="empty">Could not load: ${err.message}</li>`; return; }
  if (!items.length) { list.innerHTML = '<li class="empty">Nothing yet. Upload something above.</li>'; return; }
  list.innerHTML = items.map((it) => `
    <li data-id="${it.id}">
      <span class="kind">${it.kind}</span>
      <span><b>${esc(it.title || it.files.map((f) => f.name).join(", ") || it.id)}</b><br><span class="when">${fmtWhen(it.created)} · ${it.files.length} file${it.files.length === 1 ? "" : "s"}</span></span>
      <span class="badge ${it.status}">${it.status}</span>
    </li>`).join("");
}
$("#item-list").addEventListener("click", (e) => { const li = e.target.closest("li[data-id]"); if (li) showItem(li.dataset.id); });
$("#refresh").addEventListener("click", loadItems);

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// ---- detail -------------------------------------------------------------------
let current = null;
async function showItem(id) {
  const it = await api(`/items/${id}`); current = it;
  $("#detail").hidden = false;
  $("#detail-title").textContent = it.title || it.id;
  $("#detail-meta").textContent = `${it.kind} · ${it.status} · uploaded ${fmtWhen(it.created)}${it.analysed ? " · analysed " + fmtWhen(it.analysed) : ""}${it.notes ? " · " + it.notes : ""}`;
  $("#detail-files").innerHTML = it.files.map((f) => `<div><span class="note">${esc(f.name)} · ${fmtBytes(f.size)}</span><audio controls preload="none" src="${API}/items/${it.id}/files/${encodeURIComponent(f.name)}"></audio></div>`).join("");
  $("#detail-report").innerHTML = it.error ? `<pre class="err">${esc(it.error)}</pre>` : "";
  if (it.report) renderReport(it, it.report);
  else if (!it.error) $("#detail-report").innerHTML = `<p class="hint">No report yet. Status: ${it.status}.</p>`;
  $("#detail").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderReport(it, r) {
  const out = [];
  out.push(`<p class="headline">${esc(r.headline)}</p>`);
  if (r.rows && r.rows.length) out.push(rowsTable(r.rows));
  for (const sec of r.sections || []) {
    out.push(`<h3>${esc(sec.title)}</h3>`);
    if (sec.text) out.push(`<p class="note">${esc(sec.text)}</p>`);
    if (sec.rows && sec.rows.length) out.push(rowsTable(sec.rows));
    if (sec.table) out.push(genericTable(sec.table));
    if (sec.grid) out.push(`<canvas class="grid" data-grid='${JSON.stringify(sec.grid)}' width="960" height="360"></canvas>`);
    for (const a of sec.images || []) out.push(`<img class="artifact" alt="${esc(a)}" src="${API}/items/${it.id}/artifacts/${encodeURIComponent(a)}">`);
  }
  $("#detail-report").innerHTML += out.join("");
  document.querySelectorAll("canvas.grid").forEach(drawGrid);
}

function rowsTable(rows) {
  return `<table class="report"><thead><tr><th>measure</th><th>value</th><th>reference</th><th>note</th></tr></thead><tbody>` +
    rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${fmt(r.value)}${r.unit ? " " + esc(r.unit) : ""}</td><td class="num">${r.ref === undefined || r.ref === null ? "" : fmt(r.ref) + (r.unit ? " " + esc(r.unit) : "")}</td><td class="note">${esc(r.note || "")}</td></tr>`).join("") + `</tbody></table>`;
}
function genericTable(t) {
  return `<table class="report"><thead><tr>${t.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>` +
    t.rows.map((row) => `<tr>${row.map((v) => `<td class="${typeof v === "number" ? "num" : ""}">${fmt(v)}</td>`).join("")}</tr>`).join("") + `</tbody></table>`;
}
function fmt(v) { if (v === null || v === undefined) return "–"; if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1); return esc(v); }

function drawGrid(c) {
  const g = JSON.parse(c.dataset.grid); const ctx = c.getContext("2d");
  const rows = g.length, cols = g[0].length, cw = c.width / cols, ch = c.height / rows;
  const max = Math.max(...g.flat(), 1e-9);
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const v = g[r][k] / max; ctx.fillStyle = `rgba(69,224,232,${0.08 + 0.92 * v})`;
    ctx.fillRect(k * cw + 1, r * ch + 1, cw - 2, ch - 2);
  }
  ctx.fillStyle = "#e6e9ef"; ctx.font = "16px system-ui";
  ["sub", "low", "lo-mid", "mid", "high", "air"].forEach((n, i) => ctx.fillText(n, 6, i * ch + 20));
  for (let k = 0; k < cols; k += 4) ctx.fillText(String(k / 4 + 1), k * cw + 6, c.height - 8);
}

$("#close").addEventListener("click", () => { $("#detail").hidden = true; current = null; });
$("#delete").addEventListener("click", async () => {
  if (!current || !confirm("Delete this item, its files and its report?")) return;
  await api(`/items/${current.id}`, { method: "DELETE" }); $("#detail").hidden = true; current = null; await loadItems();
});
$("#requeue").addEventListener("click", async () => {
  if (!current) return;
  await api(`/items/${current.id}`, { method: "PATCH", body: JSON.stringify({ status: "pending", error: null }) }); await showItem(current.id); await loadItems();
});

loadItems();
