import { useEffect, useState, useRef } from "react";
import { ClipboardCheck, Plus, Trash2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const sb = supabase as any;

export type InspectionReport = {
  id: string;
  supplier_id: string;
  title: string;
  inspector: string | null;
  report_date: string | null;
  document_url: string | null;
  cover_url: string | null;
  summary: string | null;
  verified: boolean;
};

export default function SupplierInspectionReports({
  supplierId,
  canManage,
}: {
  supplierId: string;
  canManage: boolean;
}) {
  const [items, setItems] = useState<InspectionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [inspector, setInspector] = useState("");
  const [summary, setSummary] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await sb
      .from("inspection_reports")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("report_date", { ascending: false, nullsFirst: false });
    setItems((data ?? []) as InspectionReport[]);
    setLoading(false);
  };

  useEffect(() => { if (supplierId) load(); }, [supplierId]);

  const submit = async () => {
    if (!title.trim()) return toast.error("Add a report title");
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in required");
      let documentUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${supplierId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("inspection-reports")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("inspection-reports").getPublicUrl(path);
        documentUrl = data.publicUrl;
      }
      const { error } = await sb.from("inspection_reports").insert({
        supplier_id: supplierId,
        title: title.trim(),
        inspector: inspector.trim() || null,
        summary: summary.trim() || null,
        report_date: reportDate || null,
        document_url: documentUrl,
      });
      if (error) throw error;
      toast.success("Inspection report added");
      setTitle(""); setInspector(""); setSummary(""); setReportDate(""); setFile(null); setAdding(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save report");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this inspection report?")) return;
    const { error } = await sb.from("inspection_reports").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((arr) => arr.filter((c) => c.id !== id));
  };

  if (loading) return <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>;

  return (
    <div className="space-y-3">
      {items.length === 0 && !adding && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No factory inspection reports yet.</p>
        </div>
      )}

      {items.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-card p-3 shadow-card flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold leading-tight">{r.title}</p>
              {r.verified && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground inline-flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> Verified
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {r.inspector ? `By ${r.inspector}` : "Inspector not disclosed"}
              {r.report_date && ` · ${new Date(r.report_date).toLocaleDateString()}`}
            </p>
            {r.summary && <p className="text-xs mt-1.5 leading-relaxed">{r.summary}</p>}
            <div className="flex items-center gap-2 mt-2">
              {r.document_url && (
                <a href={r.document_url} target="_blank" rel="noreferrer"
                  className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 hover:underline">
                  View full report <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {canManage && (
                <button onClick={() => remove(r.id)} className="ml-auto text-[11px] text-destructive inline-flex items-center gap-1 hover:underline">
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {canManage && !adding && (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4" /> Add inspection report
        </Button>
      )}

      {canManage && adding && (
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card space-y-2">
          <Input placeholder="Report title (e.g. Q1 2026 factory audit)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Inspector (e.g. SGS, Intertek)" value={inspector} onChange={(e) => setInspector(e.target.value)} />
          <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          <Textarea placeholder="Short summary of findings" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full text-left text-xs px-3 py-2 rounded-md border border-dashed border-border bg-background hover:bg-muted transition">
            {file ? `📎 ${file.name}` : "Upload PDF or image (optional)"}
          </button>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
            <Button variant="outline" onClick={() => { setAdding(false); setFile(null); setTitle(""); setInspector(""); setSummary(""); setReportDate(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
