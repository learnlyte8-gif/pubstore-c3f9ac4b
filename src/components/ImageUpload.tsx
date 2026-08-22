import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ensureUploadIdentity } from "@/lib/uploadAuth";

type Props = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  bucket?: string;
  folder?: string;
  /** Aspect ratio class — e.g. aspect-video, aspect-square */
  aspect?: string;
  hint?: string;
};

/**
 * Reusable image picker that uploads to a public Supabase storage bucket
 * (default `service-media`) under the user's folder, then calls onChange
 * with the resulting public URL. Falls back to manual URL paste.
 */
export default function ImageUpload({
  value,
  onChange,
  label = "Cover image",
  bucket = "service-media",
  folder = "uploads",
  aspect = "aspect-video",
  hint = "JPG or PNG · up to 8 MB",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8 MB)");
      return;
    }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      toast.error("Sign in to upload");
      return;
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `image/${ext}`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(publicUrl);
    toast.success("Photo uploaded");
  };

  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="mt-1.5">
        {value ? (
          <div className={`relative ${aspect} rounded-xl overflow-hidden bg-muted border border-border group`}>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/85 backdrop-blur border border-border flex items-center justify-center shadow-card hover:bg-destructive hover:text-destructive-foreground transition"
              aria-label="Remove image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-2 right-2 h-7 px-3 rounded-full bg-background/85 backdrop-blur border border-border text-[10px] font-bold flex items-center gap-1 shadow-card"
            >
              <ImagePlus className="w-3 h-3" /> Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className={`w-full ${aspect} rounded-xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/40 transition flex flex-col items-center justify-center gap-1.5 text-muted-foreground`}
          >
            {busy ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : (
              <>
                <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <ImagePlus className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold">Tap to upload</span>
                <span className="text-[10px]">{hint}</span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste an image URL"
          className="w-full mt-1.5 h-9 px-3 rounded-lg border bg-background text-[11px]"
        />
      </div>
    </div>
  );
}
