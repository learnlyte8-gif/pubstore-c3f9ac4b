import { useEffect, useState } from "react";
import { FileText, Download, ImageOff, Play } from "lucide-react";
import { signedChatUrl, humanSize } from "@/lib/chatUpload";

export type ChatMediaAttachmentData = {
  kind: "image" | "video" | "file";
  path: string;
  name?: string;
  mime?: string;
  size?: number;
};

export default function ChatMediaAttachment({
  attachment,
  mine,
}: {
  attachment: ChatMediaAttachmentData;
  mine: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    signedChatUrl(attachment.path).then((u) => {
      if (!alive) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [attachment.path]);

  const surface = mine
    ? "bg-white/12 border-white/20 text-primary-foreground"
    : "bg-card border-border/60 text-foreground";

  if (attachment.kind === "image") {
    return (
      <div className="w-[230px] rounded-2xl overflow-hidden bg-muted/40 border border-border/40">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer">
            <img
              src={url}
              alt={attachment.name ?? "Shared photo"}
              loading="lazy"
              className="w-full max-h-[320px] object-cover"
            />
          </a>
        ) : (
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            {failed ? <ImageOff className="w-5 h-5" /> : <span className="text-[11px]">Loading…</span>}
          </div>
        )}
      </div>
    );
  }

  if (attachment.kind === "video") {
    return (
      <div className="w-[230px] rounded-2xl overflow-hidden bg-black border border-border/40">
        {url ? (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[320px] object-cover"
          />
        ) : (
          <div className="h-40 flex items-center justify-center text-white/70">
            {failed ? <ImageOff className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </div>
        )}
      </div>
    );
  }

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 w-[250px] p-2.5 rounded-2xl border ${surface} active:scale-[0.98] transition-transform`}
    >
      <span className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 opacity-70" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold truncate">
          {attachment.name ?? "Document"}
        </span>
        <span className="block text-[11px] opacity-70">
          {typeof attachment.size === "number" ? humanSize(attachment.size) : "File"}
        </span>
      </span>
      <Download className="w-4 h-4 opacity-70 shrink-0" />
    </a>
  );
}
