/**
 * Client-side ad video renderer: hero product on top, a marquee of the other
 * product images sliding right-to-left underneath, PUBSTORE search bar on top.
 * Recorded straight off a canvas with MediaRecorder — no dependencies.
 */

import {
  drawClippedImage,
  drawProductCard,
  drawSearchBar,
  hexA,
  loadAdImages,
  money,
  roundRect,
  shade,
  type AdCreative,
} from "./adCreative";

export type AdVideoOptions = { seconds?: number; fps?: number };

const FALLBACK = { bg: "#0f172a", accent: "#22c55e", text: "#ffffff" };

function pickMime() {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export function canRecordAdVideo() {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
}

export async function renderAdVideo(ad: AdCreative, opts: AdVideoOptions = {}): Promise<Blob> {
  if (!canRecordAdVideo()) throw new Error("This browser cannot record video — try Chrome.");

  const seconds = opts.seconds ?? 8;
  const fps = opts.fps ?? 30;
  const vertical = (ad.format ?? "square") === "vertical";
  const W = 1080;
  const H = vertical ? 1920 : 1080;
  const s = { ...FALLBACK, ...(ad.style ?? {}) };

  const images = await loadAdImages(ad, 6);
  if (images.length === 0) throw new Error("This ad has no product images to animate.");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const pad = 64;
  const barH = 104;
  const barY = 44;
  const contentTop = barY + barH + 28;
  const heroH = vertical ? 900 : 470;
  const stripTop = contentTop + heroH + 34;
  const cardW = 300;
  const cardH = vertical ? 470 : 330;
  const gap = 22;
  const tiles = images.length >= 3 ? images : [...images, ...images, ...images].slice(0, 3);
  const loopW = tiles.length * (cardW + gap);
  const speed = 110; // px per second, right -> left

  const drawFrame = (t: number) => {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, s.bg);
    grad.addColorStop(1, shade(s.bg, 0.3));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Hero — gentle Ken Burns zoom
    const zoom = 1 + 0.04 * (0.5 - Math.cos((t / seconds) * Math.PI * 2) / 2);
    const hw = (W - pad * 2) * zoom;
    const hh = heroH * zoom;
    ctx.save();
    roundRect(ctx, pad, contentTop, W - pad * 2, heroH, 34);
    ctx.clip();
    drawClippedImage(ctx, images[0], pad - (hw - (W - pad * 2)) / 2, contentTop - (hh - heroH) / 2, hw, hh, 0);
    const scrim = ctx.createLinearGradient(0, contentTop + heroH - 320, 0, contentTop + heroH);
    scrim.addColorStop(0, hexA(s.bg, 0));
    scrim.addColorStop(1, hexA(s.bg, 0.9));
    ctx.fillStyle = scrim;
    ctx.fillRect(pad, contentTop + heroH - 320, W - pad * 2, 320);
    ctx.restore();

    // Hero copy
    ctx.textBaseline = "top";
    const reveal = Math.min(1, t / 0.6);
    ctx.globalAlpha = reveal;
    ctx.fillStyle = s.text;
    ctx.font = "800 66px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText((ad.headline ?? "").slice(0, 34), pad + 30, contentTop + heroH - 210);
    if (ad.subhead) {
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.font = "500 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(ad.subhead.slice(0, 46), pad + 30, contentTop + heroH - 128);
    }
    ctx.globalAlpha = 1;

    if (ad.price != null) {
      ctx.fillStyle = s.accent;
      ctx.font = "800 74px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(money(ad.price), pad + 30, contentTop + heroH - 78);
    }
    if (ad.cta) {
      const label = ad.cta.toUpperCase();
      ctx.font = "800 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const bw = ctx.measureText(label).width + 68;
      const pulse = 1 + 0.03 * Math.sin(t * 4);
      const bh = 78 * pulse;
      const bx = W - pad - 30 - bw;
      const by = contentTop + heroH - 96;
      ctx.fillStyle = s.accent;
      roundRect(ctx, bx, by, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = "#0b1020";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bx + 34, by + bh / 2 + 1);
      ctx.textBaseline = "top";
    }

    // Marquee strip
    ctx.save();
    roundRect(ctx, 0, stripTop - 16, W, cardH + 60, 0);
    ctx.clip();
    const offset = (t * speed) % loopW;
    for (let rep = 0; rep < Math.ceil(W / loopW) + 2; rep++) {
      tiles.forEach((tile, i) => {
        const x = rep * loopW + i * (cardW + gap) - offset;
        if (x > W || x < -cardW) return;
        drawProductCard(ctx, {
          img: tile,
          x,
          y: stripTop,
          w: cardW,
          h: cardH,
          title: (ad.headline ?? "Pubstore pick").slice(0, 20),
          sub: (ad.subhead ?? "In stock · ships fast").slice(0, 24),
          price: ad.price,
          accent: s.accent,
          cta: "BUY",
        });
      });
    }
    ctx.restore();

    drawSearchBar(ctx, pad, barY, W - pad * 2, barH, s.accent);

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "800 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText((ad.brand ?? "PUBSTORE").toUpperCase(), pad, H - pad - 34);
  };

  drawFrame(0);
  const stream = canvas.captureStream(fps);
  const mime = pickMime();
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || "video/webm" }));
  });

  recorder.start(200);
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      if (t >= seconds) return resolve();
      drawFrame(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  return done;
}

export async function downloadAdVideo(ad: AdCreative, filename = "pubstore-ad.webm", opts?: AdVideoOptions) {
  const blob = await renderAdVideo(ad, opts);
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.(webm|mp4)$/i, "") + `.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
