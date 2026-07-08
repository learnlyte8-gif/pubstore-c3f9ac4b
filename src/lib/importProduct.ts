import { supabase } from "@/integrations/supabase/client";
import type { ImportedProduct } from "@/store/importJob";

type ImportProductResponse = {
  product?: ImportedProduct;
  error?: string;
};

async function readImportError(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return `Import failed (${response.status})`;

  try {
    const payload = JSON.parse(text) as { error?: string; message?: string };
    return payload.error || payload.message || `Import failed (${response.status})`;
  } catch {
    return text;
  }
}

export async function importProductFromUrl(url: string): Promise<ImportedProduct> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Please sign in again before importing.");
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-product`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${data.session.access_token}`,
      "x-client-info": "pubstore-import",
    },
    body: JSON.stringify({ url }),
  }).catch(() => {
    throw new Error("Could not reach the import service. Please try again.");
  });

  if (!response.ok) {
    throw new Error(await readImportError(response));
  }

  const payload = (await response.json().catch(() => null)) as ImportProductResponse | null;
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.product) throw new Error("Nothing returned");

  return payload.product;
}