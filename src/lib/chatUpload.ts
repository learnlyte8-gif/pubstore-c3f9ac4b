import { supabase } from "@/integrations/supabase/client";

export const CHAT_BUCKET = "chat-media";

export const MAX_CHAT_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_CHAT_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_CHAT_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export type ChatMediaKind = "image" | "video" | "file";

export function kindForFile(file: File): ChatMediaKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

export function maxBytesFor(kind: ChatMediaKind) {
  return kind === "image"
    ? MAX_CHAT_IMAGE_BYTES
    : kind === "video"
    ? MAX_CHAT_VIDEO_BYTES
    : MAX_CHAT_FILE_BYTES;
}

export function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Uploads one chat file into the private chat-media bucket and returns its storage path. */
export async function uploadChatFile(opts: {
  file: File;
  userId: string;
  conversationId: string;
}): Promise<{ path: string; kind: ChatMediaKind } | { error: string }> {
  const { file, userId, conversationId } = opts;
  const kind = kindForFile(file);
  const limit = maxBytesFor(kind);
  if (file.size > limit) {
    return { error: `${file.name} is too large (max ${humanSize(limit)})` };
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-60) || "file";
  const path = `${userId}/${conversationId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${safeName}`;
  const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) {
    return {
      error: /row-level security/i.test(error.message)
        ? "Upload blocked — sign in again and retry."
        : error.message,
    };
  }
  return { path, kind };
}

const signedCache = new Map<string, { url: string; expires: number }>();

/** Signed URL for a private chat-media object, cached in memory. */
export async function signedChatUrl(path: string, expiresInSeconds = 60 * 60 * 24 * 7) {
  const hit = signedCache.get(path);
  if (hit && hit.expires > Date.now() + 60_000) return hit.url;
  const { data, error } = await supabase.storage
    .from(CHAT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  signedCache.set(path, {
    url: data.signedUrl,
    expires: Date.now() + expiresInSeconds * 1000,
  });
  return data.signedUrl;
}
