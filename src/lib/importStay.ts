import { supabase } from "@/integrations/supabase/client";

export type ImportedStay = {
  title: string;
  kind: string;
  description: string;
  images: string[];
  city: string | null;
  country: string | null;
  price_per_night: number | null;
  currency: string | null;
  bedrooms: number | null;
  beds: number | null;
  baths: number | null;
  guests: number | null;
  amenities: string[];
  rating: number | null;
  review_count: number | null;
  superhost: boolean;
  source: string;
  source_url: string;
  source_id: string | null;
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

export async function importStayFromUrl(url: string): Promise<ImportedStay> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Please sign in again before importing.");
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-stay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${data.session.access_token}`,
      "x-client-info": "pubstore-import-stay",
    },
    body: JSON.stringify({ url }),
  }).catch(() => {
    throw new Error("Could not reach the import service. Please try again.");
  });

  if (!response.ok) throw new Error(await readImportError(response));

  const payload = (await response.json().catch(() => null)) as { stay?: ImportedStay; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.stay) throw new Error("Nothing returned");
  return payload.stay;
}
