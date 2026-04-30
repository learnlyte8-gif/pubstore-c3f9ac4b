import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per image
const ALLOWED = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;

function safeExt(file: File): string {
  const fromName = (file.name.split(".").pop() || "").toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  const fromType = (file.type.split("/").pop() || "jpg").toLowerCase();
  return fromType === "jpeg" ? "jpg" : fromType;
}

export type UploadResult = {
  urls: string[];
  failed: { name: string; reason: string }[];
};

/**
 * Upload product images to the public `product-images` bucket under the
 * authenticated user's folder. Validates size + MIME, runs uploads in
 * parallel, and reports per-file failures instead of aborting the batch.
 */
export async function uploadProductImages(
  files: File[],
  opts: { userId: string; folder?: string } = { userId: "" }
): Promise<UploadResult> {
  const { userId, folder = "products" } = opts;
  if (!userId) return { urls: [], failed: files.map((f) => ({ name: f.name, reason: "Not signed in" })) };

  const tasks = files.map(async (file): Promise<{ url?: string; error?: string; name: string }> => {
    if (file.size === 0) return { name: file.name, error: "Empty file" };
    if (file.size > MAX_BYTES) return { name: file.name, error: `Too large (max 10 MB)` };
    if (file.type && !ALLOWED.test(file.type)) return { name: file.name, error: "Unsupported image type" };

    const ext = safeExt(file);
    const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || `image/${ext}`,
      });
    if (error) return { name: file.name, error: error.message };
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return { name: file.name, url: data.publicUrl };
  });

  const settled = await Promise.all(tasks);
  const urls: string[] = [];
  const failed: { name: string; reason: string }[] = [];
  for (const r of settled) {
    if (r.url) urls.push(r.url);
    else failed.push({ name: r.name, reason: r.error || "Upload failed" });
  }
  return { urls, failed };
}
