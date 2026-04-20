import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  images: string[];
  alt: string;
}

export default function ProductGallery({ images, alt }: Props) {
  const [idx, setIdx] = useState(0);
  const safe = images.length ? images : [""];
  const prev = () => setIdx((i) => (i - 1 + safe.length) % safe.length);
  const next = () => setIdx((i) => (i + 1) % safe.length);

  return (
    <div className="relative">
      <div className="relative aspect-square bg-muted overflow-hidden">
        <img
          src={safe[idx]}
          alt={alt}
          className="w-full h-full object-cover"
        />
        {safe.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center hover:bg-background transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/85 backdrop-blur flex items-center justify-center hover:bg-background transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
              {idx + 1} / {safe.length}
            </span>
          </>
        )}
      </div>

      {safe.length > 1 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {safe.map((src, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Show image ${i + 1}`}
              className={`shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition ${
                idx === i ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
