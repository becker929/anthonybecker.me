// The renderer: one function that walks template.layers top-to-bottom and
// draws each. Deterministic and synchronous — every asset it touches must
// already be a decoded, drawable image in `assets`. It never fetches
// anything and never calls a model. Callers must await document.fonts.ready
// before calling this (see cards/README notes) so text metrics are stable.
import { fitShrink, fitWrapShrink } from "./fit-text.js";

// assets keys:
//   layer.src (for type "image")   -> drawable
//   layer.mask (for type "portrait") -> drawable
//   "portrait"                      -> drawable (this card's art)
//   "gem"                           -> drawable (this card's gem art)
function getAsset(assets, key) {
  const asset = assets.get(key);
  if (!asset) throw new Error(`Missing asset for "${key}".`);
  return asset;
}

function resolveSlotText(card, slot) {
  switch (slot) {
    case "title":
      return card.title;
    case "flavor":
      return card.flavor.text;
    case "stats":
      return card.stats.map((s) => `${s.label} ${s.value}`).join("\n");
    default:
      throw new Error(`Unknown text slot "${slot}".`);
  }
}

function drawImageLayer(ctx, layer, template, assets) {
  const [w, h] = template.canvas;
  ctx.drawImage(getAsset(assets, layer.src), 0, 0, w, h);
}

function drawPortraitLayer(ctx, layer, assets) {
  const [x, y, w, h] = layer.rect;
  const portrait = getAsset(assets, "portrait");
  const mask = getAsset(assets, layer.mask);

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const offCtx = off.getContext("2d");
  // Aperture is fixed 3:4 and art is generated at that exact ratio (§6), so
  // fitting is a plain scale-to-fill — no cropping logic needed here.
  offCtx.drawImage(portrait, 0, 0, w, h);
  offCtx.globalCompositeOperation = "destination-in";
  offCtx.drawImage(mask, 0, 0, w, h);

  ctx.drawImage(off, x, y);
}

function drawGemLayer(ctx, layer, assets) {
  const [x, y, w, h] = layer.rect;
  ctx.drawImage(getAsset(assets, "gem"), x, y, w, h);
}

function drawTextLayer(ctx, layer, card) {
  const [x, y, w, h] = layer.rect;
  const text = resolveSlotText(card, layer.slot);
  const measure = (s, size) => {
    ctx.font = `${size}px "${layer.font}"`;
    return ctx.measureText(s).width;
  };

  const fitArgs = { text, measure, maxWidth: w, startSize: layer.size, minSize: layer.min };
  const { size, lines } =
    layer.fit === "shrink"
      ? fitShrink(fitArgs)
      : fitWrapShrink({ ...fitArgs, maxHeight: h });

  const lineHeight = size * 1.2;
  const align = layer.align || "left";
  ctx.font = `${size}px "${layer.font}"`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = layer.color || "#000";

  const drawX = align === "right" ? x + w : align === "center" ? x + w / 2 : x;
  lines.forEach((line, i) => {
    ctx.fillText(line, drawX, y + i * lineHeight);
  });
}

export function renderCard(ctx, template, card, assets) {
  const [w, h] = template.canvas;
  ctx.clearRect(0, 0, w, h);

  for (const layer of template.layers) {
    switch (layer.type) {
      case "image":
        drawImageLayer(ctx, layer, template, assets);
        break;
      case "portrait":
        drawPortraitLayer(ctx, layer, assets);
        break;
      case "gem":
        drawGemLayer(ctx, layer, assets);
        break;
      case "text":
        drawTextLayer(ctx, layer, card);
        break;
      default:
        throw new Error(`Unknown layer type "${layer.type}".`);
    }
  }
}
