// The renderer: one function that walks template.layers top-to-bottom and
// draws each. Deterministic and synchronous — every asset it touches must
// already be a decoded, drawable image in `assets`. It never fetches
// anything and never calls a model. Callers must await document.fonts.ready
// before calling this (see README.md) so text metrics are stable.
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
    case "stats": {
      // Power and rarity lead the block, ahead of whatever freeform stats an
      // operator added — they're the two fields the battler pool depends on,
      // so the card itself should say them rather than only the studio form.
      // Older (pre-battler) cards carry neither field; skip rather than print
      // "undefined". wrap-shrink on this slot already handles the variable
      // line count.
      const lines = [];
      if (typeof card.power === "number") lines.push(`POWER ${card.power}`);
      if (card.rarity) lines.push(card.rarity.toUpperCase());
      for (const s of card.stats) lines.push(`${s.label} ${s.value}`);
      return lines.join("\n");
    }
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

  // Cover-fit: scale to fill the aperture preserving aspect, centred, letting
  // the overflow crop. The frame's aperture is not the ratio art is generated
  // at (and older cards carry art from a different ratio again), so a plain
  // scale-to-fill would stretch faces. Cropping a little is the lesser evil,
  // and generation is pointed at a close ratio so there is little to crop.
  const iw = portrait.naturalWidth || portrait.width;
  const ih = portrait.naturalHeight || portrait.height;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  offCtx.drawImage(portrait, (w - dw) / 2, (h - dh) / 2, dw, dh);

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
  // valign "middle" centres the wrapped block in the rect. Slots that sit in
  // a painted bar (title, stats) need it: once fitShrink drops the size, a
  // top-aligned line rides the top edge of the bar instead of the centre.
  const drawY = layer.valign === "middle" ? y + (h - lines.length * lineHeight) / 2 : y;
  lines.forEach((line, i) => {
    ctx.fillText(line, drawX, drawY + i * lineHeight);
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
