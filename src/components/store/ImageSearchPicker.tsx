import { useState } from "react";
import { Search, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  /** Product title, used as the default description to search with. */
  defaultQuery?: string;
  /** Images already attached, so found ones can show as added. */
  selected: string[];
  /** Called with the image URL when the user picks / unpicks a result. */
  onToggle: (url: string) => void;
};

export default function ImageSearchPicker({ defaultQuery = "", selected, onToggle }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    const q = (query.trim() || defaultQuery.trim()).trim();
    if (q.length < 3) { toast.error("Describe the image first (at least 3 characters)"); return; }
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("product-image-search", {
        body: { queries: [{ query: q }], limit: 8 },
      });
      if (error) throw error;
      const found: string[] = data?.results?.[0]?.images ?? [];
      setResults(found);
      if (!found.length) toast.error("No photos found — try a different description");
    } catch (err: any) {
      toast.error(err?.message ?? "Image search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Find photos automatically
      </p>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
          placeholder={defaultQuery ? `Describe the photo (e.g. ${defaultQuery.slice(0, 28)})` : "Describe the photo you want"}
          className="flex-1 h-10 rounded-xl border bg-background px-3 text-sm"
        />
        <Button type="button" className="h-10" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-1">Search</span>
        </Button>
      </div>

      {results.length > 0 && (
        <>
          <p className="text-[11px] text-muted-foreground mt-2">Tap a photo to add it to this product.</p>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {results.map((url) => {
              const on = selected.includes(url);
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => onToggle(url)}
                  className={`relative aspect-square rounded-lg overflow-hidden bg-muted ring-2 ${on ? "ring-primary" : "ring-transparent"}`}
                >
                  <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  {on && (
                    <span className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                      <Check className="w-5 h-5 text-primary-foreground" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {searched && !loading && results.length === 0 && (
        <p className="text-[11px] text-muted-foreground mt-2">No photos yet — try more detail, like brand, colour or material.</p>
      )}
    </div>
  );
}
