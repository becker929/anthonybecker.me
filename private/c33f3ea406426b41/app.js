const slots = [0, 1].map((i) => ({
  el: document.getElementById(`slot-${i}`),
  input: document.getElementById(`file-${i}`),
  hint: document.querySelector(`#slot-${i} .hint`),
  data: null, // { mimeType, data }
}));

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

slots.forEach((slot) => {
  slot.input.addEventListener("change", async () => {
    const file = slot.input.files[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    slot.data = { mimeType: file.type, data: base64 };
    let img = slot.el.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      slot.el.insertBefore(img, slot.el.firstChild);
    }
    img.src = `data:${file.type};base64,${base64}`;
    slot.hint.style.display = "none";
    slot.el.classList.add("filled");
  });

  slot.el.querySelector(".clear").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    slot.data = null;
    slot.input.value = "";
    const img = slot.el.querySelector("img");
    if (img) img.remove();
    slot.hint.style.display = "";
    slot.el.classList.remove("filled");
  });
});

const promptEl = document.getElementById("prompt");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const generateBtn = document.getElementById("generate-btn");

function setStatus(text, kind) {
  statusEl.textContent = text || "";
  statusEl.className = "status" + (kind ? ` ${kind}` : "");
}

generateBtn.addEventListener("click", async () => {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    setStatus("Enter a prompt first.", "error");
    return;
  }

  const images = slots.filter((s) => s.data).map((s) => s.data);

  generateBtn.disabled = true;
  setStatus("Generating…", "busy");
  resultEl.innerHTML = "";

  try {
    const resp = await fetch("api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, images }),
    });
    const body = await resp.json();
    if (!resp.ok) {
      setStatus(body.error || `Request failed (${resp.status}).`, "error");
      return;
    }
    setStatus("Done. Right-click the image to save it.", "");
    const img = document.createElement("img");
    img.src = `data:${body.mimeType};base64,${body.data}`;
    img.alt = prompt;
    resultEl.appendChild(img);
  } catch (err) {
    setStatus(`Error: ${err.message}`, "error");
  } finally {
    generateBtn.disabled = false;
  }
});
