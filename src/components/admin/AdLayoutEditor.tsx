import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { AD_ELEMENTS, adCreativeDataUrl, type AdCreative, type AdOffsets } from "@/lib/adCreative";
import { Button } from "@/components/ui/button";

/** Where each element normally sits, as a fraction of the creative — used to place the drag handles. */
const ANCHORS: Record<string, { x: number; y: number }> = {
  searchbar: { x: 0.06, y: 0.035 },
  badge: { x: 0.06, y: 0.14 },
  art: { x: 0.44, y: 0.4 },
  headline: { x: 0.06, y: 0.62 },
  subhead: { x: 0.06, y: 0.71 },
  price: { x: 0.06, y: 0.86 },
  cta: { x: 0.66, y: 0.86 },
  brand: { x: 0.06, y: 0.955 },
};

type Props = {
  creative: AdCreative;
  offsets: AdOffsets;
  onChange: (next: AdOffsets) => void;
};

/**
 * Drag-and-drop layout editor: the rendered creative sits underneath, and every
 * element gets a handle the admin can drag anywhere. Works on every template.
 */
export default function AdLayoutEditor({ creative, offsets, onChange }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [active, setActive] = useState<string | null>(null);

  const vertical = (creative.format ?? "square") === "vertical";
  const canvasW = 1080;
  const canvasH = vertical ? 1920 : 1080;

  const withOffsets = useMemo(() => ({ ...creative, offsets }), [creative, offsets]);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    const t = setTimeout(() => {
      adCreativeDataUrl(withOffsets)
        .then((url) => { if (alive) { setPreview(url); setBusy(false); } })
        .catch(() => { if (alive) setBusy(false); });
    }, 120);
    return () => { alive = false; clearTimeout(t); };
  }, [withOffsets]);

  const startDrag = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const scale = canvasW / rect.width;
    const start = { x: e.clientX, y: e.clientY };
    const base = offsets[key] ?? { dx: 0, dy: 0 };
    setActive(key);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      onChange({
        ...offsets,
        [key]: {
          dx: Math.round(base.dx + (ev.clientX - start.x) * scale),
          dy: Math.round(base.dy + (ev.clientY - start.y) * scale),
        },
      });
    };
    const up = () => {
      setActive(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="space-y-2">
      <div
        ref={boxRef}
        className="relative w-full max-w-[420px] mx-auto rounded-xl overflow-hidden border bg-muted select-none touch-none"
        style={{ aspectRatio: `${canvasW} / ${canvasH}` }}
      >
        {preview && <img src={preview} alt="Ad layout preview" className="absolute inset-0 w-full h-full" draggable={false} />}
        {busy && (
          <span className="absolute top-2 right-2 rounded-full bg-background/80 p-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </span>
        )}
        {AD_ELEMENTS.map((el) => {
          const anchor = ANCHORS[el.key] ?? { x: 0.5, y: 0.5 };
          const o = offsets[el.key] ?? { dx: 0, dy: 0 };
          const left = (anchor.x * canvasW + o.dx) / canvasW * 100;
          const topPct = (anchor.y * canvasH + o.dy) / canvasH * 100;
          return (
            <button
              key={el.key}
              onPointerDown={startDrag(el.key)}
              style={{ left: `${left}%`, top: `${topPct}%` }}
              className={`absolute -translate-y-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow cursor-grab active:cursor-grabbing ${
                active === el.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background/90 border-border text-foreground hover:bg-background"
              }`}
              title={`Drag ${el.label}`}
            >
              {el.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => onChange({})}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset layout
        </Button>
        <span className="text-[11px] text-muted-foreground">Drag any chip to move that part of the ad.</span>
      </div>
    </div>
  );
}
