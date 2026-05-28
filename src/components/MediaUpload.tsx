import { useRef, useState } from "react";
import { ImagePlus, Loader2, X, Film, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  images: string[];
  video?: string | null;
  onChange: (next: { images: string[]; video: string | null }) => void;
  maxImages?: number;
  bucket?: string;
  folder?: string;
  label?: string;
  hint?: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 MB
const IMAGE_MIME = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;
const VIDEO_MIME = /^video\/(mp4|webm|quicktime|mov|x-m4v)$/i;

/**
 * Reusable multi-image (up to N) + single-video uploader. Uploads each file
 * to a public Supabase storage bucket under the signed-in user's folder and
 * returns the resulting public URLs via onChange. Falls back gracefully on
 * partial failures so a single bad file doesn't kill the batch.
 */
export default function MediaUpload({
  images,
  video = null,
  onChange,
  maxImages = 6,
  bucket = "restaurant-media",
  folder = "uploads",
  label = "Photos & video",
  hint = "Up to 6 photos · 1 video (60 MB)",
}: Props) {
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [vidBusy, setVidBusy] = useState(false);

  const uploadOne = async (file: File, kind: "image" | "video"): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in to upload"); return null; }
    const ext = (file.name.split(".").pop() || (kind === "video" ? "mp4" : "jpg")).toLowerCase();
    const path = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || (kind === "video" ? `video/${ext}` : `image/${ext}`),
    });
    if (error) { toast.error(error.message); return null; }
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const handleImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) { toast.error(`Max ${maxImages} photos`); return; }
    const list = Array.from(files).slice(0, remaining);
    setBusy(true);
    const next: string[] = [...images];
    for (const f of list) {
      if (f.size > MAX_IMAGE_BYTES) { toast.error(`${f.name}: too large (max 10 MB)`); continue; }
      if (f.type && !IMAGE_MIME.test(f.type)) { toast.error(`${f.name}: unsupported type`); continue; }
      const url = await uploadOne(f, "image");
      if (url) next.push(url);
    }
    setBusy(false);
    onChange({ images: next, video });
  };

  const handleVideo = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_VIDEO_BYTES) { toast.error("Video too large (max 60 MB)"); return; }
    if (file.type && !VIDEO_MIME.test(file.type)) { toast.error("Unsupported video type"); return; }
    setVidBusy(true);
    const url = await uploadOne(file, "video");
    setVidBusy(false);
    if (url) onChange({ images, video: url });
  };

  const removeImage = (i: number) => {
    const next = images.filter((_, idx) => idx !== i);
    onChange({ images: next, video });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          <div key={url + i} className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border group">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/85 backdrop-blur border border-border flex items-center justify-center shadow-card hover:bg-destructive hover:text-destructive-foreground transition"
              aria-label="Remove"
            >
              <X className="w-3 h-3" />
            </button>
            {i === 0 && (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full bg-background/85 backdrop-blur text-[9px] font-bold">
                Cover
              </span>
            )}
          </div>
        ))}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => imgRef.current?.click()}
            disabled={busy}
            className="aspect-square rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/40 transition flex flex-col items-center justify-center gap-1 text-muted-foreground"
          >
            {busy ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <>
                <ImagePlus className="w-5 h-5" />
                <span className="text-[10px] font-bold">Add photo</span>
                <span className="text-[9px]">{images.length}/{maxImages}</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={imgRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handleImages(e.target.files); e.target.value = ""; }}
      />

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Video (optional)
        </label>
        <div className="mt-1.5">
          {video ? (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-border">
              <video src={video} className="w-full h-full object-cover" controls playsInline preload="metadata" />
              <button
                type="button"
                onClick={() => onChange({ images, video: null })}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/85 backdrop-blur border border-border flex items-center justify-center shadow-card hover:bg-destructive hover:text-destructive-foreground transition"
                aria-label="Remove video"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => vidRef.current?.click()}
                className="absolute bottom-2 right-2 h-7 px-3 rounded-full bg-background/85 backdrop-blur border border-border text-[10px] font-bold flex items-center gap-1 shadow-card"
              >
                <Film className="w-3 h-3" /> Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => vidRef.current?.click()}
              disabled={vidBusy}
              className="w-full aspect-video rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/40 transition flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
            >
              {vidBusy ? (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              ) : (
                <>
                  <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Play className="w-5 h-5 fill-current" />
                  </span>
                  <span className="text-xs font-bold">Tap to add a video</span>
                  <span className="text-[10px]">MP4 / WEBM · up to 60 MB</span>
                </>
              )}
            </button>
          )}
          <input
            ref={vidRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideo(f); e.target.value = ""; }}
          />
        </div>
      </div>
    </div>
  );
}
