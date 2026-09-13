/**
 * Renders a social-ad creative (square 1080x1080 or vertical 1080x1920) onto a
 * canvas from an ad row + template style, so admins can download a ready-to-post
 * image. Pure client-side — no extra dependencies.
 */

export type AdStyle = {
  bg?: string;
  accent?: string;
  text?: string;
  layout?:
    | "deal" | "clean" | "hook" | "sale" | "hero-five" | "staggered" | "marketplace" | "catalog"
    | "product-card" | "product-card-multi" | string;
};

/** Per-element nudges (canvas pixels) produced by the drag-and-drop editor. */
export type AdOffset = { dx: number; dy: number };
export type AdOffsets = Record<string, AdOffset>;

/** Elements an admin can drag on any template. */
export const AD_ELEMENTS = [
  { key: "art", label: "Images" },
  { key: "badge", label: "Badge" },
  { key: "headline", label: "Headline" },
  { key: "subhead", label: "Subhead" },
  { key: "price", label: "Price" },
  { key: "cta", label: "Button" },
  { key: "searchbar", label: "Search bar" },
  { key: "brand", label: "Brand" },
] as const;

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
  /** Drag-and-drop layout nudges, keyed by AD_ELEMENTS key. */
  offsets?: AdOffsets | null;
};


const FALLBACK_STYLE: Required<AdStyle> = {
  bg: "#0f172a",
  accent: "#22c55e",
  text: "#ffffff",
  layout: "deal",
};

const AD_FONT = "'TikTok Sans', Arial, sans-serif";

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
  ctx.font = `800 ${Math.round(h * 0.42)}px ${AD_FONT}`;
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
  ctx.font = `700 28px ${AD_FONT}`;
  const titleLines = wrap(ctx, opts.title, w - padX * 2, 1);
  ctx.fillText(titleLines[0] ?? "", x + padX, ty);
  ty += 34;

  if (opts.sub && ty + 26 <= rowTop - 6) {
    ctx.fillStyle = "rgba(15,23,42,0.6)";
    ctx.font = `500 22px ${AD_FONT}`;
    ctx.fillText(wrap(ctx, opts.sub, w - padX * 2, 1)[0] ?? "", x + padX, ty);
  }

  if (opts.price != null) {
    ctx.fillStyle = accent;
    ctx.font = `700 42px ${AD_FONT}`;
    ctx.fillText(money(opts.price), x + padX, rowTop + 6);
  }

  const label = (opts.cta ?? "BUY").toUpperCase();
  ctx.font = `700 24px ${AD_FONT}`;
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

/** Star rating row, used by the shop-card templates. */
function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, accent: string, label?: string) {
  ctx.save();
  ctx.fillStyle = "#f59e0b";
  ctx.font = `700 ${size}px ${AD_FONT}`;
  ctx.textBaseline = "top";
  ctx.fillText("★★★★★", x, y);
  const w = ctx.measureText("★★★★★").width;
  if (label) {
    ctx.fillStyle = "rgba(15,23,42,0.55)";
    ctx.font = `500 ${Math.round(size * 0.86)}px ${AD_FONT}`;
    ctx.fillText(label, x + w + 12, y + 2);
  }
  ctx.restore();
}

/**
 * A faithful copy of the shop's product card: white rounded card, square image,
 * badge, 2-line title, rating, price (with was-price) and a full-width buy button.
 */
export function drawShopCard(
  ctx: CanvasRenderingContext2D,
  opts: {
    img?: HTMLImageElement | null;
    x: number; y: number; w: number; h: number;
    title: string; sub?: string | null; badge?: string | null;
    price?: number | null; originalPrice?: number | null;
    accent: string; cta?: string | null; compact?: boolean;
  },
) {
  const { x, y, w, h, accent } = opts;
  const k = opts.compact ? w / 480 : w / 900; // scale type with the card width
  const pad = Math.round(26 * k * (opts.compact ? 1 : 1));

  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.22)";
  ctx.shadowBlur = 30 * k;
  ctx.shadowOffsetY = 10 * k;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 34 * k);
  ctx.fill();
  ctx.restore();

  const btnH = Math.round(84 * k);
  const copyH = Math.round(190 * k);
  const imgH = Math.max(80, h - copyH - btnH - pad * 2);

  if (opts.img) {
    ctx.save();
    roundRect(ctx, x + pad, y + pad, w - pad * 2, imgH, 26 * k);
    ctx.clip();
    drawCover(ctx, opts.img, x + pad, y + pad, w - pad * 2, imgH);
    ctx.restore();
  } else {
    ctx.fillStyle = "#e2e8f0";
    roundRect(ctx, x + pad, y + pad, w - pad * 2, imgH, 26 * k);
    ctx.fill();
  }

  if (opts.badge) {
    ctx.save();
    ctx.font = `800 ${Math.round(30 * k)}px ${AD_FONT}`;
    const label = opts.badge.toUpperCase();
    const bw = ctx.measureText(label).width + 34 * k;
    const bh = 52 * k;
    ctx.fillStyle = accent;
    roundRect(ctx, x + pad + 18 * k, y + pad + 18 * k, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + pad + 18 * k + 17 * k, y + pad + 18 * k + bh / 2 + 1);
    ctx.restore();
  }

  let ty = y + pad + imgH + Math.round(22 * k);
  ctx.textBaseline = "top";
  ctx.fillStyle = "#0f172a";
  const titleSize = Math.round(40 * k);
  ctx.font = `700 ${titleSize}px ${AD_FONT}`;
  for (const line of wrap(ctx, opts.title, w - pad * 2, 2)) {
    ctx.fillText(line, x + pad, ty);
    ty += titleSize * 1.2;
  }

  drawStars(ctx, x + pad, ty + 4 * k, Math.round(30 * k), accent, opts.sub ?? "Free delivery");
  ty += Math.round(52 * k);

  if (opts.price != null) {
    const priceSize = Math.round(58 * k);
    ctx.fillStyle = "#0f172a";
    ctx.font = `800 ${priceSize}px ${AD_FONT}`;
    ctx.fillText(money(opts.price), x + pad, ty);
    const pw = ctx.measureText(money(opts.price)).width;
    if (opts.originalPrice && Number(opts.originalPrice) > Number(opts.price)) {
      const os = Math.round(34 * k);
      ctx.fillStyle = "rgba(15,23,42,0.5)";
      ctx.font = `600 ${os}px ${AD_FONT}`;
      const ox = x + pad + pw + 18 * k;
      const oy = ty + priceSize - os - 4;
      ctx.fillText(money(opts.originalPrice), ox, oy);
      const ow = ctx.measureText(money(opts.originalPrice)).width;
      ctx.strokeStyle = "rgba(15,23,42,0.5)";
      ctx.lineWidth = Math.max(2, 4 * k);
      ctx.beginPath();
      ctx.moveTo(ox, oy + os * 0.58);
      ctx.lineTo(ox + ow, oy + os * 0.58);
      ctx.stroke();
    }
  }

  const label = (opts.cta ?? "Add to cart").toUpperCase();
  const by = y + h - pad - btnH;
  ctx.fillStyle = accent;
  roundRect(ctx, x + pad, by, w - pad * 2, btnH, btnH / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(36 * k)}px ${AD_FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, by + btnH / 2 + 1);
  ctx.textAlign = "left";
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
  let overlayCopy = false; // true only for the full-bleed vertical photo layout
  // Price + CTA row is anchored above the footer; nothing else may enter this band.
  const rowH = 100;
  const rowTop = H - pad - 60 - rowH;
  const marketplaceReserve = vertical ? 380 : 300;

  // Drag-and-drop nudges from the editor: every element can be moved freely.
  const off = (key: string) => ad.offsets?.[key] ?? { dx: 0, dy: 0 };
  const at = (key: string, fn: () => void) => {
    const o = off(key);
    ctx.save();
    ctx.translate(o.dx, o.dy);
    try { fn(); } finally { ctx.restore(); }
  };
  const brandFooter = (colour: string) =>
    at("brand", () => {
      ctx.fillStyle = colour;
      ctx.font = `700 38px ${AD_FONT}`;
      ctx.textBaseline = "top";
      ctx.fillText((ad.brand ?? "PUBSTORE").toUpperCase(), pad, H - pad - 34);
    });
  const searchBar = () => at("searchbar", () => drawSearchBar(ctx, pad, barY, W - pad * 2, barH, s.accent));

  // --- Shop-card templates: pixel-for-pixel like the store's product cards ---
  if (s.layout === "product-card" || s.layout === "product-card-multi") {
    const multi = s.layout === "product-card-multi";
    const headline = (ad.headline ?? "").trim();

    let top = contentTop;
    if (multi) {
      at("headline", () => {
        ctx.textBaseline = "top";
        ctx.fillStyle = s.text;
        ctx.font = `800 ${vertical ? 72 : 60}px ${AD_FONT}`;
        let hy = contentTop;
        for (const line of wrap(ctx, headline, W - pad * 2, 2)) {
          ctx.fillText(line, pad, hy);
          hy += (vertical ? 72 : 60) * 1.16;
        }
      });
      ctx.font = `800 ${vertical ? 72 : 60}px ${AD_FONT}`;
      top = contentTop + wrap(ctx, headline, W - pad * 2, 2).length * (vertical ? 72 : 60) * 1.16 + 8;
      if (ad.subhead) {
        at("subhead", () => {
          ctx.fillStyle = sub;
          ctx.font = `500 34px ${AD_FONT}`;
          ctx.fillText(wrap(ctx, ad.subhead!, W - pad * 2, 1)[0] ?? "", pad, top);
        });
        top += 50;
      }
      top += 14;

      const gap = 22;
      const cols = 2;
      const rows = vertical ? 3 : 2;
      const cardW = (W - pad * 2 - gap) / cols;
      const cardH = (H - top - pad - 60 - gap * (rows - 1)) / rows;
      at("art", () => {
        for (let i = 0; i < cols * rows; i++) {
          drawShopCard(ctx, {
            img: images.length ? images[i % images.length] : null,
            x: pad + (i % cols) * (cardW + gap),
            y: top + Math.floor(i / cols) * (cardH + gap),
            w: cardW,
            h: cardH,
            title: headline || "Pubstore pick",
            sub: ad.subhead,
            badge: i === 0 ? ad.badge : null,
            price: ad.price,
            originalPrice: ad.originalPrice,
            accent: s.accent,
            cta: ad.cta ?? "Add to cart",
            compact: true,
          });
        }
      });
    } else {
      const cardW = W - pad * 2;
      const cardH = Math.min(H - top - pad - 80, vertical ? 1420 : 860);
      at("art", () => {
        drawShopCard(ctx, {
          img: images[0] ?? null,
          x: pad,
          y: top + (vertical ? 40 : 0),
          w: cardW,
          h: cardH,
          title: headline || "Pubstore pick",
          sub: ad.subhead,
          badge: ad.badge,
          price: ad.price,
          originalPrice: ad.originalPrice,
          accent: s.accent,
          cta: ad.cta ?? "Add to cart",
        });
      });
    }

    searchBar();
    brandFooter(isLightBg(s.bg) ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.7)");
    return canvas;
  }

  if (catalog) {
    // Dark headline band, then a grid of marketplace product cards
    const bandH = vertical ? 300 : 240;
    ctx.fillStyle = hexA("#0b1020", 0.92);
    roundRect(ctx, pad, contentTop, W - pad * 2, bandH, 24);
    ctx.fill();
    ctx.textBaseline = "top";
    let by = contentTop + 30;
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 62px ${AD_FONT}`;
    for (const line of wrap(ctx, (ad.headline ?? "").trim().toUpperCase(), W - pad * 2 - 60, 2)) {
      ctx.fillText(line, pad + 30, by);
      by += 70;
    }
    if (ad.subhead) {
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = `500 34px ${AD_FONT}`;
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
    at("art", () => {
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
    });

    searchBar();
    brandFooter("rgba(255,255,255,0.8)");
    return canvas;
  }

  // Gallery artwork must stop here so headline, subhead, price and CTA all fit below it.
  const artworkMaxY = rowTop - (vertical ? 260 : 200);

  const artOffset = off("art");
  ctx.save();
  ctx.translate(artOffset.dx, artOffset.dy);

  if (s.layout === "hero-five" && images.length) {
    const thumbGap = 12;
    const thumbW = (W - pad * 2 - thumbGap * 4) / 5;
    let heroHeight = vertical ? 860 : 430;
    let thumbH = vertical ? 210 : 120;
    const total = heroHeight + 18 + thumbH;
    const room = artworkMaxY - contentTop;
    if (total > room) {
      const k = room / total;
      heroHeight = Math.round(heroHeight * k);
      thumbH = Math.round(thumbH * k);
    }
    drawClippedImage(ctx, images[0], pad, contentTop, W - pad * 2, heroHeight, 34);
    const thumbY = contentTop + heroHeight + 18;
    for (let i = 0; i < 5; i++) {
      const thumb = images[i + 1] ?? images[(i + 1) % images.length];
      if (thumb) drawClippedImage(ctx, thumb, pad + i * (thumbW + thumbGap), thumbY, thumbW, thumbH, 18);
    }
    textBottom = thumbY + thumbH + 28;
  } else if (s.layout === "staggered" && images.length) {
    const gap = 18;
    const colW = (W - pad * 2 - gap) / 2;
    const offset = vertical ? 80 : 48;
    let leftHeights = vertical ? [620, 470] : [330, 250];
    let rightHeights = vertical ? [440, 650] : [240, 340];
    const tallest = Math.max(
      leftHeights.reduce((a, b) => a + b, 0) + gap,
      offset + rightHeights.reduce((a, b) => a + b, 0) + gap,
    );
    const room = artworkMaxY - contentTop;
    if (tallest > room) {
      const k = room / tallest;
      leftHeights = leftHeights.map((h) => Math.round(h * k));
      rightHeights = rightHeights.map((h) => Math.round(h * k));
    }
    let leftY = contentTop;
    let rightY = contentTop + offset;
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
    const gridTop = contentTop + marketplaceReserve;
    const gridHeight = Math.max(240, rowTop - gridTop - 28);
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
    overlayCopy = true;
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

  ctx.restore();

  // Copy area: starts under the artwork, and must end before the price/CTA row
  const marketplace = s.layout === "marketplace";
  let copyTop = marketplace ? contentTop : overlayCopy ? Math.max(contentTop + 80, 240) : textBottom;
  const copyMaxY = marketplace ? contentTop + marketplaceReserve - 20 : rowTop - 24;

  // Badge — above the copy for marketplace (no artwork behind it), over the artwork elsewhere
  if (ad.badge) {
    ctx.font = `700 40px ${AD_FONT}`;
    const tw = ctx.measureText(ad.badge.toUpperCase()).width;
    const by = marketplace ? contentTop : contentTop + 20;
    at("badge", () => {
      ctx.fillStyle = s.accent;
      roundRect(ctx, pad, by, tw + 56, 76, 38);
      ctx.fill();
      ctx.fillStyle = "#0b1020";
      ctx.textBaseline = "middle";
      ctx.font = `700 40px ${AD_FONT}`;
      ctx.fillText(ad.badge!.toUpperCase(), pad + 28, by + 39);
    });
    if (marketplace) copyTop = by + 76 + 18;
  }

  ctx.textBaseline = "top";
  const budget = Math.max(0, copyMaxY - copyTop);
  const maxHeadlineLines = vertical ? 3 : 2;

  // Pick the largest headline/subhead sizing that fits the remaining space.
  let hlSize = 0;
  let hlLines: string[] = [];
  let subLines: string[] = [];
  let subSize = 0;
  const headline = (ad.headline ?? "").trim();
  for (const size of [78, 66, 56, 46, 38]) {
    ctx.font = `800 ${size}px ${AD_FONT}`;
    const lines = headline ? wrap(ctx, headline, W - pad * 2, maxHeadlineLines) : [];
    const hlHeight = lines.length * size * 1.16;
    let sSize = 0;
    let sLines: string[] = [];
    if (ad.subhead) {
      for (const cand of [42, 36, 30]) {
        ctx.font = `500 ${cand}px ${AD_FONT}`;
        const cl = wrap(ctx, ad.subhead, W - pad * 2, 2);
        if (hlHeight + 12 + cl.length * cand * 1.3 <= budget) { sSize = cand; sLines = cl; break; }
      }
    }
    if (hlHeight + (sSize ? 12 + sLines.length * sSize * 1.3 : 0) <= budget || size === 38) {
      hlSize = size;
      hlLines = lines;
      subSize = sSize;
      subLines = sLines;
      break;
    }
  }

  let y = copyTop;
  at("headline", () => {
    ctx.fillStyle = textColor;
    ctx.font = `800 ${hlSize}px ${AD_FONT}`;
    let hy = y;
    for (const line of hlLines) {
      if (hy + hlSize * 1.16 > copyMaxY + hlSize * 0.2) break;
      ctx.fillText(line, pad, hy);
      hy += hlSize * 1.16;
    }
  });
  y += hlLines.length * hlSize * 1.16;

  if (subSize && subLines.length) {
    y += 12;
    at("subhead", () => {
      ctx.fillStyle = sub;
      ctx.font = `500 ${subSize}px ${AD_FONT}`;
      let sy = y;
      for (const line of subLines) {
        if (sy + subSize * 1.3 > copyMaxY + subSize * 0.3) break;
        ctx.fillText(line, pad, sy);
        sy += subSize * 1.3;
      }
    });
  }

  const baseY = rowTop;

  if (ad.price != null) {
    at("price", () => {
      ctx.fillStyle = s.accent;
      ctx.font = `800 92px ${AD_FONT}`;
      ctx.fillText(money(ad.price), pad, baseY);
      const pw = ctx.measureText(money(ad.price)).width;
      if (ad.originalPrice && Number(ad.originalPrice) > Number(ad.price)) {
        ctx.fillStyle = sub;
        ctx.font = `600 50px ${AD_FONT}`;
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
    });
  }

  if (ad.cta) {
    at("cta", () => {
      ctx.font = `700 44px ${AD_FONT}`;
      const cw = ctx.measureText(ad.cta!).width + 88;
      const cx = W - pad - cw;
      const cy = baseY + 6;
      ctx.fillStyle = s.accent;
      roundRect(ctx, cx, cy, cw, 92, 46);
      ctx.fill();
      ctx.fillStyle = "#0b1020";
      ctx.textBaseline = "middle";
      ctx.fillText(ad.cta!, cx + 44, cy + 48);
      ctx.textBaseline = "top";
    });
  }

  if (galleryLayout) {
    ctx.strokeStyle = hexA(s.accent, 0.5);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pad, H - pad - 54);
    ctx.lineTo(W - pad, H - pad - 54);
    ctx.stroke();
  }

  searchBar();
  brandFooter(light ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.65)");

  return canvas;
}

/** True when a hex background is light enough to need dark text. */
function isLightBg(hex: string) {
  const [r, g, b] = parseHex(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
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
