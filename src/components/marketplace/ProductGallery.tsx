import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

interface Props {
  images: string[];
  alt: string;
  videoUrl?: string | null;
}

type Slide =
  | { kind: "video"; src: string; embed?: string; poster?: string }
  | { kind: "image"; src: string };

/** Turn a YouTube/Vimeo URL into an embeddable iframe URL. Returns null for direct video files. */
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&mute=1&loop=1&playlist=${v}&modestbranding=1&rel=0`;
    }
    if (host === "youtu.be") {
      const v = u.pathname.slice(1);
      if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&mute=1&loop=1&playlist=${v}&modestbranding=1&rel=0`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1&loop=1&background=1`;
    }
    return null;
  } catch {
    return null;
  }
}

export default function ProductGallery({ images, alt, videoUrl }: Props) {
  const slides = useMemo<Slide[]>(() => {
    const imgs = (images ?? []).filter(Boolean);
    const list: Slide[] = imgs.map((src) => ({ kind: "image", src }));
    if (videoUrl) {
      const embed = toEmbedUrl(videoUrl);
      list.unshift({
        kind: "video",
        src: videoUrl,
        embed: embed ?? undefined,
        poster: imgs[0],
      });
    }
    return list.length ? list : [{ kind: "image", src: "" }];
  }, [images, videoUrl]);

  const [idx, setIdx] = useState(0);
  const prev = () => setIdx((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIdx((i) => (i + 1) % slides.length);
  const current = slides[Math.min(idx, slides.length - 1)];

  return (
    <div className="relative">
      <div className="relative aspect-square bg-muted overflow-hidden">
        {current.kind === "video" ? (
          current.embed ? (
            <iframe
              key={current.src}
              src={current.embed}
              title={`${alt} video`}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              key={current.src}
              src={current.src}
              poster={current.poster || undefined}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              controls
            />
          )
        ) : (
          <img
            src={current.src}
            alt={alt}
            className="w-full h-full object-cover"
          />
        )}
        {slides.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center hover:bg-background transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center hover:bg-background transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
              {idx + 1} / {slides.length}
            </span>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Show ${s.kind} ${i + 1}`}
              className={`relative shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition ${
                idx === i ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {s.kind === "video" ? (
                <>
                  {s.poster ? (
                    <img src={s.poster} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-foreground/80" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                    <Play className="w-4 h-4 fill-current" />
                  </span>
                </>
              ) : (
                <img src={s.src} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
