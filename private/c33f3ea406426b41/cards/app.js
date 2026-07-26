// Minimal operator UI wiring the card-studio API routes together. This
// page is served at BASE/cards/, so API routes (siblings of BASE, not of
// this page) are reached via "../api/..." and "../blob/...".
import { renderCard } from "./renderer.js";
import { applyChromaKey } from "./chroma-key.js";
import { migrateCard } from "./migrate.js";

const imageCache = new Map();
function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
      }),
    );
  }
  return imageCache.get(src);
}

function imageToImageData(img) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function imageDataToCanvas(imageData) {
  const c = document.createElement("canvas");
  c.width = imageData.width;
  c.height = imageData.height;
  c.getContext("2d").putImageData(imageData, 0, 0);
  return c;
}

function assetHashToUrl(assetRef) {
  const hash = assetRef.startsWith("sha256:") ? assetRef.slice("sha256:".length) : assetRef;
  return `../blob/${hash}`;
}

async function apiFetch(path, opts) {
  const resp = await fetch(`../${path}`, opts);
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    const message = body?.error || `Request failed (${resp.status})`;
    const err = new Error(message);
    err.status = resp.status;
    throw err;
  }
  return body;
}

function setStatus(el, text, kind) {
  el.textContent = text || "";
  el.className = "status" + (kind ? ` ${kind}` : "");
}

// ---------- Tabs ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll("main").forEach((m) => m.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`${btn.dataset.view}-view`).classList.add("active");
  });
});

// ---------- Shared state ----------
let template = null;
let currentCard = null;
let gems = [];
let flavorEditedByHand = false;

const els = {
  cardList: document.getElementById("card-list"),
  editor: document.getElementById("editor"),
  newCardBtn: document.getElementById("new-card-btn"),
  title: document.getElementById("title-input"),
  portraitInstruction: document.getElementById("portrait-instruction"),
  portraitResolution: document.getElementById("portrait-resolution"),
  generatePortraitBtn: document.getElementById("generate-portrait-btn"),
  portraitStatus: document.getElementById("portrait-status"),
  flavorGuidance: document.getElementById("flavor-guidance"),
  flavorMaxChars: document.getElementById("flavor-max-chars"),
  generateFlavorBtn: document.getElementById("generate-flavor-btn"),
  flavorText: document.getElementById("flavor-text"),
  flavorStatus: document.getElementById("flavor-status"),
  gemSelect: document.getElementById("gem-select"),
  statsList: document.getElementById("stats-list"),
  addStatBtn: document.getElementById("add-stat-btn"),
  saveCardBtn: document.getElementById("save-card-btn"),
  saveStatus: document.getElementById("save-status"),
  canvas: document.getElementById("preview-canvas"),
};

// ---------- Card list ----------
async function refreshCardList() {
  const cards = await apiFetch("api/cards");
  els.cardList.innerHTML = "";
  for (const c of cards) {
    const row = document.createElement("div");
    row.className = "card-row" + (currentCard && currentCard.id === c.id ? " selected" : "");
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = c.title || "(untitled)";
    const d = document.createElement("div");
    d.className = "d";
    d.textContent = c.updated_at || "";
    row.append(t, d);
    row.addEventListener("click", () => selectCard(c.id));
    els.cardList.appendChild(row);
  }
}

async function selectCard(id) {
  currentCard = migrateCard(await apiFetch(`api/cards/${id}`));
  flavorEditedByHand = false;
  portraitRestartFromAsset = null;
  els.editor.style.display = "flex";
  renderForm();
  await refreshCardList();
  await renderPreview();
}

els.newCardBtn.addEventListener("click", async () => {
  const id = `card_${crypto.randomUUID()}`;
  const shell = {
    schema_version: 1,
    id,
    template_version: template.version,
    title: "",
    portrait: null,
    flavor: { text: "", source: "generated", prompt_version: null },
    gem: null,
    stats: [],
  };
  currentCard = await apiFetch(`api/cards/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(shell),
  });
  flavorEditedByHand = false;
  portraitRestartFromAsset = null;
  els.editor.style.display = "flex";
  renderForm();
  await refreshCardList();
  await renderPreview();
});

// ---------- Form <-> currentCard ----------
function renderForm() {
  els.title.value = currentCard.title || "";
  els.portraitInstruction.value = "";
  els.flavorGuidance.value = "";
  els.flavorText.value = currentCard.flavor?.text || "";
  els.gemSelect.value = currentCard.gem || "";
  renderStatsList();
  setStatus(els.portraitStatus, "", "");
  setStatus(els.flavorStatus, "", "");
  setStatus(els.saveStatus, "", "");
}

els.title.addEventListener("input", () => {
  currentCard.title = els.title.value;
});

function renderStatsList() {
  els.statsList.innerHTML = "";
  currentCard.stats.forEach((stat, i) => {
    const row = document.createElement("div");
    row.className = "stat-row";
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.placeholder = "Label";
    labelInput.value = stat.label ?? "";
    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "Value";
    valueInput.value = stat.value ?? "";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "secondary small";
    removeBtn.textContent = "×";
    row.append(labelInput, valueInput, removeBtn);
    labelInput.addEventListener("input", () => {
      currentCard.stats[i].label = labelInput.value;
      renderPreview();
    });
    valueInput.addEventListener("input", () => {
      currentCard.stats[i].value = valueInput.value;
      renderPreview();
    });
    removeBtn.addEventListener("click", () => {
      currentCard.stats.splice(i, 1);
      renderStatsList();
      renderPreview();
    });
    els.statsList.appendChild(row);
  });
}

els.addStatBtn.addEventListener("click", () => {
  currentCard.stats.push({ label: "", value: "" });
  renderStatsList();
  renderPreview();
});

els.gemSelect.addEventListener("change", () => {
  currentCard.gem = els.gemSelect.value || null;
  renderPreview();
});

els.flavorText.addEventListener("input", () => {
  flavorEditedByHand = true;
  renderPreview();
});

// ---------- Portrait generation ----------
// Set when a thread expires (409); the next click restarts a fresh thread
// seeded from the current art instead of continuing the dead one.
let portraitRestartFromAsset = null;

els.generatePortraitBtn.addEventListener("click", async () => {
  const instruction = els.portraitInstruction.value.trim();
  if (!instruction) return setStatus(els.portraitStatus, "Enter an instruction first.", "error");

  const isContinuing = !portraitRestartFromAsset && currentCard.portrait?.lineage?.length > 0;
  const body = {
    card_id: currentCard.id,
    instruction,
    resolution: els.portraitResolution.value,
  };
  if (portraitRestartFromAsset) {
    body.reference_asset = portraitRestartFromAsset;
  } else if (isContinuing) {
    body.previous_interaction_id = currentCard.portrait.interaction_id;
  }

  els.generatePortraitBtn.disabled = true;
  setStatus(els.portraitStatus, "Generating…", "busy");
  try {
    const result = await apiFetch("api/portrait", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Merge in just the fields this call is authoritative for — replacing
    // the whole card would silently discard any unsaved local edits (e.g.
    // a title change) to fields this call never touched.
    const updated = migrateCard(result.card);
    currentCard.portrait = updated.portrait;
    currentCard.updated_at = updated.updated_at;
    portraitRestartFromAsset = null;
    els.portraitInstruction.value = "";
    setStatus(els.portraitStatus, "Done.", "ok");
    await renderPreview();
    await refreshCardList();
  } catch (err) {
    if (err.status === 409) {
      portraitRestartFromAsset = currentCard.portrait.asset;
      setStatus(els.portraitStatus, `${err.message} Click Generate again to restart from the current art.`, "error");
    } else {
      setStatus(els.portraitStatus, err.message, "error");
    }
  } finally {
    els.generatePortraitBtn.disabled = false;
  }
});

// ---------- Flavor generation ----------
els.generateFlavorBtn.addEventListener("click", async () => {
  const guidance = els.flavorGuidance.value.trim();
  const maxChars = Number(els.flavorMaxChars.value) || 200;

  els.generateFlavorBtn.disabled = true;
  setStatus(els.flavorStatus, "Generating…", "busy");
  try {
    const result = await apiFetch("api/flavor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id: currentCard.id, guidance, max_chars: maxChars }),
    });
    const updated = migrateCard(result.card);
    currentCard.flavor = updated.flavor;
    currentCard.updated_at = updated.updated_at;
    els.flavorText.value = currentCard.flavor.text;
    flavorEditedByHand = false;
    setStatus(els.flavorStatus, result.truncated ? "Done (truncated to fit)." : "Done.", "ok");
    await renderPreview();
  } catch (err) {
    setStatus(els.flavorStatus, err.message, "error");
  } finally {
    els.generateFlavorBtn.disabled = false;
  }
});

// ---------- Save ----------
els.saveCardBtn.addEventListener("click", async () => {
  if (flavorEditedByHand) {
    currentCard.flavor = { ...currentCard.flavor, text: els.flavorText.value, source: "hand-written" };
  }
  setStatus(els.saveStatus, "Saving…", "busy");
  try {
    currentCard = await apiFetch(`api/cards/${currentCard.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentCard),
    });
    setStatus(els.saveStatus, "Saved.", "ok");
    await refreshCardList();
  } catch (err) {
    setStatus(els.saveStatus, err.message, "error");
  }
});

// ---------- Live preview ----------
async function buildAssets() {
  const assets = new Map();
  for (const layer of template.layers) {
    if (layer.type === "image") {
      assets.set(layer.src, await loadImage(`fixtures/${layer.src}`));
    }
    if (layer.type === "portrait") {
      assets.set(layer.mask, await loadImage(`fixtures/${layer.mask}`));
    }
  }

  assets.set(
    "portrait",
    currentCard.portrait?.asset
      ? await loadImage(assetHashToUrl(currentCard.portrait.asset))
      : await loadImage("fixtures/portrait_placeholder.png"),
  );

  if (currentCard.gem) {
    const gem = gems.find((g) => g.id === currentCard.gem);
    if (gem) {
      const rawImg = await loadImage(assetHashToUrl(`sha256:${gem.raw_hash}`));
      const imageData = imageToImageData(rawImg);
      applyChromaKey(imageData, {
        keyColor: gem.key_color,
        threshold: gem.mask_params.threshold,
        edgeSoftness: gem.mask_params.edgeSoftness,
        despill: gem.mask_params.despill,
      });
      assets.set("gem", imageDataToCanvas(imageData));
    } else {
      assets.set("gem", await loadImage("fixtures/gem_placeholder.png"));
    }
  } else {
    assets.set("gem", await loadImage("fixtures/gem_placeholder.png"));
  }

  return assets;
}

async function renderPreview() {
  if (!template || !currentCard) return;
  await document.fonts.ready;
  const assets = await buildAssets();
  const ctx = els.canvas.getContext("2d");
  renderCard(ctx, template, currentCard, assets);
}

// ---------- Gems tab ----------
const gemEls = {
  name: document.getElementById("gem-name-input"),
  palette: document.getElementById("gem-palette-input"),
  instruction: document.getElementById("gem-instruction-input"),
  generateBtn: document.getElementById("generate-gem-btn"),
  createStatus: document.getElementById("gem-create-status"),
  list: document.getElementById("gem-list"),
  detailPanel: document.getElementById("gem-detail-panel"),
  rawPreview: document.getElementById("gem-raw-preview"),
  maskedPreview: document.getElementById("gem-masked-preview"),
  threshold: document.getElementById("mask-threshold"),
  thresholdVal: document.getElementById("mask-threshold-val"),
  edge: document.getElementById("mask-edge"),
  edgeVal: document.getElementById("mask-edge-val"),
  despill: document.getElementById("mask-despill"),
  despillVal: document.getElementById("mask-despill-val"),
  saveMaskBtn: document.getElementById("save-mask-btn"),
  approveBtn: document.getElementById("approve-gem-btn"),
  detailStatus: document.getElementById("gem-detail-status"),
};

let selectedGem = null;
let selectedGemRawImageData = null;

async function refreshGemList() {
  gems = await apiFetch("api/gems");

  els.gemSelect.innerHTML = '<option value="">(none)</option>';
  for (const g of gems.filter((g) => g.approved)) {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name;
    els.gemSelect.appendChild(opt);
  }
  if (currentCard) els.gemSelect.value = currentCard.gem || "";

  gemEls.list.innerHTML = "";
  for (const g of gems) {
    const row = document.createElement("div");
    row.className = "gem-row";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = g.name;
    const badge = document.createElement("span");
    badge.className = "badge" + (g.approved ? " approved" : "");
    badge.textContent = g.approved ? "approved" : "candidate";
    row.append(nameSpan, badge);
    row.addEventListener("click", () => selectGemForTuning(g));
    gemEls.list.appendChild(row);
  }
}

async function selectGemForTuning(gem) {
  selectedGem = gem;
  gemEls.detailPanel.style.display = "block";
  gemEls.rawPreview.src = assetHashToUrl(`sha256:${gem.raw_hash}`);
  gemEls.threshold.value = gem.mask_params.threshold;
  gemEls.edge.value = gem.mask_params.edgeSoftness;
  gemEls.despill.value = gem.mask_params.despill;
  updateSliderLabels();
  setStatus(gemEls.detailStatus, "", "");

  const img = await loadImage(assetHashToUrl(`sha256:${gem.raw_hash}`));
  selectedGemRawImageData = imageToImageData(img);
  renderMaskedPreview();
}

function updateSliderLabels() {
  gemEls.thresholdVal.textContent = gemEls.threshold.value;
  gemEls.edgeVal.textContent = gemEls.edge.value;
  gemEls.despillVal.textContent = gemEls.despill.value;
}

function renderMaskedPreview() {
  if (!selectedGemRawImageData) return;
  const copy = new ImageData(
    new Uint8ClampedArray(selectedGemRawImageData.data),
    selectedGemRawImageData.width,
    selectedGemRawImageData.height,
  );
  applyChromaKey(copy, {
    keyColor: selectedGem.key_color,
    threshold: Number(gemEls.threshold.value),
    edgeSoftness: Number(gemEls.edge.value),
    despill: Number(gemEls.despill.value),
  });
  gemEls.maskedPreview.getContext("2d").putImageData(copy, 0, 0);
}

[gemEls.threshold, gemEls.edge, gemEls.despill].forEach((input) => {
  input.addEventListener("input", () => {
    updateSliderLabels();
    renderMaskedPreview();
  });
});

gemEls.generateBtn.addEventListener("click", async () => {
  const name = gemEls.name.value.trim();
  const palette = gemEls.palette.value.split(",").map((s) => s.trim()).filter(Boolean);
  const instruction = gemEls.instruction.value.trim();
  if (!name && !instruction && palette.length === 0) {
    return setStatus(gemEls.createStatus, "Give at least a name, a palette, or a description — the rest will be filled in.", "error");
  }

  gemEls.generateBtn.disabled = true;
  setStatus(gemEls.createStatus, "Generating…", "busy");
  try {
    const result = await apiFetch("api/gems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, palette, instruction }),
    });
    setStatus(gemEls.createStatus, "Done. Tune and approve it below.", "ok");
    await refreshGemList();
    await selectGemForTuning(result.gem);
  } catch (err) {
    setStatus(gemEls.createStatus, err.message, "error");
  } finally {
    gemEls.generateBtn.disabled = false;
  }
});

gemEls.saveMaskBtn.addEventListener("click", async () => {
  setStatus(gemEls.detailStatus, "Saving…", "busy");
  try {
    const result = await apiFetch(`api/gems/${selectedGem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mask_params: {
          threshold: Number(gemEls.threshold.value),
          edgeSoftness: Number(gemEls.edge.value),
          despill: Number(gemEls.despill.value),
        },
      }),
    });
    selectedGem = result.gem;
    setStatus(gemEls.detailStatus, "Saved.", "ok");
    await refreshGemList();
  } catch (err) {
    setStatus(gemEls.detailStatus, err.message, "error");
  }
});

gemEls.approveBtn.addEventListener("click", async () => {
  try {
    const result = await apiFetch(`api/gems/${selectedGem.id}/approve`, { method: "POST" });
    selectedGem = result.gem;
    setStatus(gemEls.detailStatus, "Approved.", "ok");
    await refreshGemList();
    if (currentCard) await renderPreview();
  } catch (err) {
    setStatus(gemEls.detailStatus, err.message, "error");
  }
});

// ---------- Boot ----------
async function init() {
  template = await (await fetch("fixtures/template.json")).json();
  els.newCardBtn.disabled = false;
  await refreshCardList();
  await refreshGemList();
}
init();
