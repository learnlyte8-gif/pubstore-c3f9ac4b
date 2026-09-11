/**
 * Renders a social-ad creative (square 1080x1080 or vertical 1080x1920) onto a
 * canvas from an ad row + template style, so admins can download a ready-to-post
 * image. Pure client-side — no extra dependencies.
 */

export type AdStyle = {
  bg?: string;
  accent?: string;
  text?: string;
  layout?: "deal" | "clean" | "hook" | "sale" | "hero-five" | "staggered" | "marketplace" | "catalog" | string;
};

export type AdCreative = {
  headline?: string | null;
  subhead?: string | null;
  badge?: string | null;
  cta?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
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

export const SEARCH_BAR_TEXT = "Pubstore.app";

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function uniqueUrls(ad: Pick<AdCreative, "imageUrl" | "imageUrls">, max = 6) {
  return Array.from(new Set([...(ad.imageUrls ?? []), ad.imageUrl].filter((u): u is string => Boolean(u)))).slice(0, max);
}

export async function loadAdImages(ad: Pick<AdCreative, "imageUrl" | "imageUrls">, max = 6) {
  const urls = uniqueUrls(ad, max);
  return (await Promise.all(urls.map(loadImage))).filter((i): i is HTMLImageElement => i !== null);
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

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.save();
  roundRect(ctx, x, y, w, h, 0);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.min(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export function drawClippedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 28,
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  drawCover(ctx, img, x, y, w, h);
  ctx.restore();
}

export const money = (n?: number | null) => (n == null ? "" : `$${Number(n).toFixed(2)}`);

/** White pill search bar with the PUBSTORE web address — brand cue on every creative. */
export function drawSearchBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 6;
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, (h - 6) / 2);
  ctx.stroke();
  ctx.restore();

  // little bag glyph
  const bx = x + h * 0.34;
  const by = y + h / 2;
  ctx.save();
  ctx.fillStyle = accent;
  roundRect(ctx, bx - 22, by - 18, 44, 40, 12);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(bx, by - 18, 14, Math.PI, 0);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ea580c";
  ctx.font = `800 ${Math.round(h * 0.42)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.fillText(SEARCH_BAR_TEXT, bx + 42, by + 2);
  ctx.restore();

  // search circle
  const cr = h * 0.36;
  const cx = x + w - h * 0.5;
  ctx.save();
  ctx.fillStyle = "#1d4ed8";
  ctx.beginPath();
  ctx.arc(cx, by, cr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx - 4, by - 4, cr * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + cr * 0.14, by + cr * 0.14);
  ctx.lineTo(cx + cr * 0.5, by + cr * 0.5);
  ctx.stroke();
  ctx.restore();
}

/** A white marketplace-style product card (image, title, sub, price, BUY). */
export function drawProductCard(
  ctx: CanvasRenderingContext2D,
  opts: {
    img?: HTMLImageElement | null;
    x: number; y: number; w: number; h: number;
    title: string; sub?: string; price?: number | null; accent: string; cta?: string;
  },
) {
  const { x, y, w, h, accent } = opts;
  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.18)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.restore();

  const imgH = h * 0.48;
  if (opts.img) {
    ctx.save();
    roundRect(ctx, x, y, w, imgH, 18);
    ctx.clip();
    drawCover(ctx, opts.img, x, y, w, imgH);
    ctx.restore();
  } else {
    ctx.fillStyle = "#e2e8f0";
    roundRect(ctx, x, y, w, imgH, 18);
    ctx.fill();
  }

  const padX = 18;
  const rowTop = y + h - 66; // price + BUY row, always the lowest block
  let ty = y + imgH + 16;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#0f172a";
  ctx.font = "800 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const titleLines = wrap(ctx, opts.title, w - padX * 2, 1);
  ctx.fillText(titleLines[0] ?? "", x + padX, ty);
  ty += 34;

  if (opts.sub && ty + 26 <= rowTop - 6) {
    ctx.fillStyle = "rgba(15,23,42,0.6)";
    ctx.font = "500 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(wrap(ctx, opts.sub, w - padX * 2, 1)[0] ?? "", x + padX, ty);
  }

  if (opts.price != null) {
    ctx.fillStyle = accent;
    ctx.font = "800 42px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(money(opts.price), x + padX, rowTop + 6);
  }

  const label = (opts.cta ?? "BUY").toUpperCase();
  ctx.font = "800 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const bw = ctx.measureText(label).width + 40;
  const bh = 48;
  ctx.fillStyle = accent;
  roundRect(ctx, x + w - padX - bw, y + h - bh - 22, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w - padX - bw + 20, y + h - bh - 22 + bh / 2 + 1);
  ctx.textBaseline = "top";
}

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

  const images = await loadAdImages(ad, 6);
  const img = images[0] ?? null;

  const pad = 64;
  const light = s.layout === "clean";
  const textColor = s.text;
  const sub = light ? "rgba(15,23,42,0.68)" : "rgba(255,255,255,0.78)";

  // Brand search bar, always on top
  const barH = 104;
  const barY = 44;
  const contentTop = barY + barH + 28;

  const galleryLayout = s.layout === "hero-five" || s.layout === "staggered" || s.layout === "marketplace";
  const catalog = s.layout === "catalog";
  let textBottom = contentTop;

  if (catalog) {
    // Dark headline band, then a grid of marketplace product cards
    const bandH = vertical ? 300 : 240;
    ctx.fillStyle = hexA("#0b1020", 0.92);
    roundRect(ctx, pad, contentTop, W - pad * 2, bandH, 24);
    ctx.fill();
    ctx.textBaseline = "top";
    let by = contentTop + 30;
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 62px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    for (const line of wrap(ctx, (ad.headline ?? "").trim().toUpperCase(), W - pad * 2 - 60, 2)) {
      ctx.fillText(line, pad + 30, by);
      by += 70;
    }
    if (ad.subhead) {
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "500 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      for (const line of wrap(ctx, ad.subhead, W - pad * 2 - 60, 2)) {
        ctx.fillText(line, pad + 30, by);
        by += 42;
      }
    }

    const gridTop = contentTop + bandH + 26;
    const gap = 20;
    const cols = 2;
    const rows = vertical ? 3 : 2;
    const cardW = (W - pad * 2 - gap) / cols;
    const cardH = (H - gridTop - pad - 70 - gap * (rows - 1)) / rows;
    for (let i = 0; i < cols * rows; i++) {
      const tile = images.length ? images[i % images.length] : null;
      drawProductCard(ctx, {
        img: tile,
        x: pad + (i % cols) * (cardW + gap),
        y: gridTop + Math.floor(i / cols) * (cardH + gap),
        w: cardW,
        h: cardH,
        title: (ad.headline ?? "Pubstore pick").slice(0, 26),
        sub: (ad.subhead ?? "").slice(0, 30),
        price: ad.price,
        accent: s.accent,
        cta: ad.cta ?? "BUY",
      });
    }

    drawSearchBar(ctx, pad, barY, W - pad * 2, barH, s.accent);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "800 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText((ad.brand ?? "PUBSTORE").toUpperCase(), pad, H - pad - 4);
    return canvas;
  }

  if (s.layout === "hero-five" && images.length) {
    const heroHeight = vertical ? 860 : 430;
    drawClippedImage(ctx, images[0], pad, contentTop, W - pad * 2, heroHeight, 34);
    const thumbY = contentTop + heroHeight + 18;
    const thumbGap = 12;
    const thumbW = (W - pad * 2 - thumbGap * 4) / 5;
    const thumbH = vertical ? 210 : 120;
    for (let i = 0; i < 5; i++) {
      const thumb = images[i + 1] ?? images[(i + 1) % images.length];
      if (thumb) drawClippedImage(ctx, thumb, pad + i * (thumbW + thumbGap), thumbY, thumbW, thumbH, 18);
    }
    textBottom = thumbY + thumbH + 28;
  } else if (s.layout === "staggered" && images.length) {
    const gap = 18;
    const colW = (W - pad * 2 - gap) / 2;
    const leftHeights = vertical ? [620, 470] : [330, 250];
    const rightHeights = vertical ? [440, 650] : [240, 340];
    let leftY = contentTop;
    let rightY = contentTop + (vertical ? 80 : 48);
    leftHeights.forEach((height, i) => {
      const tile = images[(i * 2) % images.length];
      if (tile) drawClippedImage(ctx, tile, pad, leftY, colW, height, 30);
      leftY += height + gap;
    });
    rightHeights.forEach((height, i) => {
      const tile = images[(i * 2 + 1) % images.length];
      if (tile) drawClippedImage(ctx, tile, pad + colW + gap, rightY, colW, height, 30);
      rightY += height + gap;
    });
    textBottom = Math.max(leftY, rightY) + 10;
  } else if (s.layout === "marketplace" && images.length) {
    const gridTop = contentTop + (vertical ? 300 : 210);
    const gridHeight = vertical ? 900 : 470;
    const gap = 14;
    const cellW = (W - pad * 2 - gap) / 2;
    const cellH = (gridHeight - gap) / 2;
    for (let i = 0; i < 4; i++) {
      const tile = images[i % images.length];
      if (tile) drawClippedImage(ctx, tile, pad + (i % 2) * (cellW + gap), gridTop + Math.floor(i / 2) * (cellH + gap), cellW, cellH, 22);
    }
    textBottom = contentTop;
  } else if (vertical) {
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
    textBottom = contentTop + 60;
  } else if (img) {
    const boxH = 520;
    if (light) {
      ctx.fillStyle = "#f1f5f9";
      roundRect(ctx, pad, contentTop, W - pad * 2, boxH, 40);
      ctx.fill();
      ctx.save();
      roundRect(ctx, pad, contentTop, W - pad * 2, boxH, 40);
      ctx.clip();
      drawContain(ctx, img, pad, contentTop, W - pad * 2, boxH);
      ctx.restore();
    } else {
      drawClippedImage(ctx, img, pad, contentTop, W - pad * 2, boxH, 40);
    }
    textBottom = contentTop + boxH + 28;
  }

  // Badge
  if (ad.badge) {
    ctx.font = "800 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const tw = ctx.measureText(ad.badge.toUpperCase()).width;
    const bx = pad;
    const by = contentTop + 20;
    ctx.fillStyle = s.accent;
    roundRect(ctx, bx, by, tw + 56, 76, 38);
    ctx.fill();
    ctx.fillStyle = "#0b1020";
    ctx.textBaseline = "middle";
    ctx.fillText(ad.badge.toUpperCase(), bx + 28, by + 39);
  }

  // Text block
  let y = vertical ? Math.max(contentTop + 80, 240) : textBottom;
  if (s.layout === "marketplace") y = contentTop;
  ctx.textBaseline = "top";

  ctx.fillStyle = textColor;
  ctx.font = "800 78px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const hl = wrap(ctx, (ad.headline ?? "").trim(), W - pad * 2, vertical ? 3 : 2);
  for (const line of hl) {
    ctx.fillText(line, pad, y);
    y += 90;
  }

  if (ad.subhead) {
    y += 10;
    ctx.fillStyle = sub;
    ctx.font = "500 42px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    for (const line of wrap(ctx, ad.subhead, W - pad * 2, 2)) {
      ctx.fillText(line, pad, y);
      y += 54;
    }
  }

  // Price row + CTA — never overlapping the copy above
  const rowH = 100;
  const preferred = vertical ? H - 470 : H - 250;
  const baseY = Math.min(Math.max(preferred, y + 32), H - pad - 60 - rowH);

  if (ad.price != null) {
    ctx.fillStyle = s.accent;
    ctx.font = "800 92px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(money(ad.price), pad, baseY);
    const pw = ctx.measureText(money(ad.price)).width;
    if (ad.originalPrice && Number(ad.originalPrice) > Number(ad.price)) {
      ctx.fillStyle = sub;
      ctx.font = "600 50px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const ow = ctx.measureText(money(ad.originalPrice)).width;
      const ox = pad + pw + 32;
      ctx.fillText(money(ad.originalPrice), ox, baseY + 38);
      ctx.strokeStyle = sub;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ox, baseY + 64);
      ctx.lineTo(ox + ow, baseY + 64);
      ctx.stroke();
    }
  }

  if (ad.cta) {
    ctx.font = "800 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const cw = ctx.measureText(ad.cta).width + 88;
    const cx = W - pad - cw;
    const cy = baseY + 6;
    ctx.fillStyle = s.accent;
    roundRect(ctx, cx, cy, cw, 92, 46);
    ctx.fill();
    ctx.fillStyle = "#0b1020";
    ctx.textBaseline = "middle";
    ctx.fillText(ad.cta, cx + 44, cy + 48);
    ctx.textBaseline = "top";
  }

  if (galleryLayout) {
    ctx.strokeStyle = hexA(s.accent, 0.5);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pad, H - pad - 54);
    ctx.lineTo(W - pad, H - pad - 54);
    ctx.stroke();
  }

  drawSearchBar(ctx, pad, barY, W - pad * 2, barH, s.accent);

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

export function hexA(hex: string, alpha: number) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Lightens (positive) a hex colour toward white by `amount` (0-1). */
export function shade(hex: string, amount: number) {
  const [r, g, b] = parseHex(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount * 0.35);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
