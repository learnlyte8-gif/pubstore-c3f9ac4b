import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type GoogleJob = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  description: string | null;
  posted_at: string | null;
  job_type: string | null;
  url: string;
};

async function searchGoogleJobs(query: string): Promise<GoogleJob[]> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Sign in to search jobs online");
  const { data, error } = await supabase.functions.invoke("omkar-google-jobs-search", {
    body: { query },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error(error.message || "Search failed");
  if (data?.error) throw new Error(data.error);
  return (data?.items ?? []) as GoogleJob[];
}

export default function GoogleJobsSearch() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data: items = [], isFetching, error } = useQuery({
    queryKey: ["google-jobs", submitted],
    queryFn: () => searchGoogleJobs(submitted),
    enabled: !!submitted,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-bold flex items-center gap-1.5">
          <Briefcase className="w-4 h-4" /> Find jobs online
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Search job postings from across the web, powered by Google Jobs.
        </p>
        <form
          className="flex gap-2 mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const v = q.trim();
            if (v) setSubmitted(v);
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. software engineer, accountant, driver"
            className="h-10"
          />
          <Button type="submit" className="h-10 gap-1.5" disabled={isFetching || !q.trim()}>
            <Search className="w-4 h-4" /> {isFetching ? "Searching…" : "Search"}
          </Button>
        </form>

        {error && (
          <p className="text-xs text-destructive mt-3">
            {error instanceof Error ? error.message : "Search failed"}
          </p>
        )}

        {submitted && !isFetching && !error && items.length === 0 && (
          <p className="text-xs text-muted-foreground mt-3">No online jobs found for “{submitted}”.</p>
        )}

        {items.length > 0 && (
          <div className="mt-4 divide-y divide-border">
            {items.map((j) => (
              <a
                key={j.id}
                href={j.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 py-3 group"
              >
                <div className="w-10 h-10 rounded-xl bg-muted grid place-items-center shrink-0">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold line-clamp-1 group-hover:underline">
                    {j.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {[j.company, j.location].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{j.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {j.salary && (
                      <span className="text-[11px] font-semibold text-foreground">{j.salary}</span>
                    )}
                    {j.job_type && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{j.job_type}</span>
                    )}
                    {j.posted_at && (
                      <span className="text-[11px] text-muted-foreground">{j.posted_at}</span>
                    )}
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
