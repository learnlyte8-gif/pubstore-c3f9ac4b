/**
 * Renders a social-ad creative (square 1080x1080 or vertical 1080x1920) onto a
 * canvas from an ad row + template style, so admins can download a ready-to-post
 * image. Pure client-side — no extra dependencies.
 */

export type AdStyle = {
  bg?: string;
  accent?: string;
  text?: string;
  layout?: "deal" | "clean" | "hook" | "sale" | string;
};

export type AdCreative = {
  headline?: string | null;
  subhead?: string | null;
  badge?: string | null;
  cta?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  imageUrl?: string | null;
  brand?: string;
  format?: "square" | "vertical";
  style?: AdStyle;
};

const FALLBACK_STYLE: Required<AdStyle> = {
  bg: "#0f172a",
  accent: "#22c55e",
  text: "#ffffff",
  layout: "deal",
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) return lines;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.min(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

const money = (n?: number | null) => (n == null ? "" : `$${Number(n).toFixed(2)}`);

/** Draws the creative and returns the canvas. */
export async function renderAdCreative(ad: AdCreative): Promise<HTMLCanvasElement> {
  const s = { ...FALLBACK_STYLE, ...(ad.style ?? {}) };
  const vertical = (ad.format ?? "square") === "vertical";
  const W = 1080;
  const H = vertical ? 1920 : 1080;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, s.bg);
  grad.addColorStop(1, s.layout === "clean" ? s.bg : shade(s.bg, s.layout === "sale" ? 0.45 : 0.25));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const img = ad.imageUrl ? await loadImage(ad.imageUrl) : null;

  const pad = 72;
  const light = s.layout === "clean";
  const textColor = s.text;
  const sub = light ? "rgba(15,23,42,0.68)" : "rgba(255,255,255,0.78)";

  if (vertical) {
    // Full-bleed photo with gradient scrims top and bottom
    if (img) drawCover(ctx, img, 0, 0, W, H);
    const top = ctx.createLinearGradient(0, 0, 0, 720);
    top.addColorStop(0, hexA(s.bg, 0.92));
    top.addColorStop(1, hexA(s.bg, 0));
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 720);
    const bot = ctx.createLinearGradient(0, H - 900, 0, H);
    bot.addColorStop(0, hexA(s.bg, 0));
    bot.addColorStop(1, hexA(s.bg, 0.96));
    ctx.fillStyle = bot;
    ctx.fillRect(0, H - 900, W, 900);
  } else if (img) {
    if (light) {
      ctx.fillStyle = "#f1f5f9";
      roundRect(ctx, pad, pad, W - pad * 2, 640, 40);
      ctx.fill();
      ctx.save();
      roundRect(ctx, pad, pad, W - pad * 2, 640, 40);
      ctx.clip();
      drawContain(ctx, img, pad, pad, W - pad * 2, 640);
      ctx.restore();
    } else {
      ctx.save();
      roundRect(ctx, pad, pad, W - pad * 2, 620, 40);
      ctx.clip();
      drawCover(ctx, img, pad, pad, W - pad * 2, 620);
      ctx.restore();
    }
  }

  // Badge
  if (ad.badge) {
    ctx.font = "800 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const tw = ctx.measureText(ad.badge.toUpperCase()).width;
    const bx = pad;
    const by = vertical ? 120 : pad + 28;
    ctx.fillStyle = s.accent;
    roundRect(ctx, bx, by, tw + 56, 76, 38);
    ctx.fill();
    ctx.fillStyle = "#0b1020";
    ctx.textBaseline = "middle";
    ctx.fillText(ad.badge.toUpperCase(), bx + 28, by + 39);
  }

  // Text block
  let y = vertical ? 240 : pad + 700;
  ctx.textBaseline = "top";

  ctx.fillStyle = textColor;
  ctx.font = "800 84px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const hl = wrap(ctx, (ad.headline ?? "").trim(), W - pad * 2, vertical ? 3 : 2);
  for (const line of hl) {
    ctx.fillText(line, pad, y);
    y += 96;
  }

  if (ad.subhead) {
    y += 12;
    ctx.fillStyle = sub;
    ctx.font = "500 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    for (const line of wrap(ctx, ad.subhead, W - pad * 2, 2)) {
      ctx.fillText(line, pad, y);
      y += 56;
    }
  }

  // Price row + CTA pinned near the bottom
  const baseY = vertical ? H - 470 : H - 250;

  if (ad.price != null) {
    ctx.fillStyle = s.accent;
    ctx.font = "800 96px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(money(ad.price), pad, baseY);
    const pw = ctx.measureText(money(ad.price)).width;
    if (ad.originalPrice && Number(ad.originalPrice) > Number(ad.price)) {
      ctx.fillStyle = sub;
      ctx.font = "600 52px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const ow = ctx.measureText(money(ad.originalPrice)).width;
      const ox = pad + pw + 32;
      ctx.fillText(money(ad.originalPrice), ox, baseY + 40);
      ctx.strokeStyle = sub;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ox, baseY + 68);
      ctx.lineTo(ox + ow, baseY + 68);
      ctx.stroke();
    }
  }

  if (ad.cta) {
    ctx.font = "800 46px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const cw = ctx.measureText(ad.cta).width + 88;
    const cx = W - pad - cw;
    const cy = baseY + 12;
    ctx.fillStyle = s.accent;
    roundRect(ctx, cx, cy, cw, 96, 48);
    ctx.fill();
    ctx.fillStyle = "#0b1020";
    ctx.textBaseline = "middle";
    ctx.fillText(ad.cta, cx + 44, cy + 50);
    ctx.textBaseline = "top";
  }

  // Brand footer
  ctx.fillStyle = light ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.65)";
  ctx.font = "800 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText((ad.brand ?? "PUBSTORE").toUpperCase(), pad, H - pad - 34);

  return canvas;
}

export async function adCreativeDataUrl(ad: AdCreative): Promise<string> {
  const canvas = await renderAdCreative(ad);
  return canvas.toDataURL("image/png");
}

export async function downloadAdCreative(ad: AdCreative, filename = "pubstore-ad.png") {
  const url = await adCreativeDataUrl(ad);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// --- tiny colour helpers -----------------------------------------------------

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function hexA(hex: string, alpha: number) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Lightens (positive) a hex colour toward white by `amount` (0-1). */
function shade(hex: string, amount: number) {
  const [r, g, b] = parseHex(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount * 0.35);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
