import { useEffect, useState, useRef } from "react";
import { Award, Plus, Trash2, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const sb = supabase as any;

export type Certification = {
  id: string;
  supplier_id: string;
  title: string;
  issuer: string | null;
  document_url: string | null;
  issued_at: string | null;
  expires_at: string | null;
  verified: boolean;
};

export default function SupplierCertifications({
  supplierId,
  canManage,
}: {
  supplierId: string;
  canManage: boolean;
}) {
  const [items, setItems] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await sb
      .from("supplier_certifications")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Certification[]);
    setLoading(false);
  };

  useEffect(() => { if (supplierId) load(); }, [supplierId]);

  const submit = async () => {
    if (!title.trim()) return toast.error("Add a certification title");
    setSaving(true);
    try {
      let documentUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${supplierId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("supplier-certs")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("supplier-certs").getPublicUrl(path);
        documentUrl = data.publicUrl;
      }
      const { error } = await sb.from("supplier_certifications").insert({
        supplier_id: supplierId,
        title: title.trim(),
        issuer: issuer.trim() || null,
        document_url: documentUrl,
      });
      if (error) throw error;
      toast.success("Certification added");
      setTitle(""); setIssuer(""); setFile(null); setAdding(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save certification");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this certification?")) return;
    const { error } = await sb.from("supplier_certifications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems((arr) => arr.filter((c) => c.id !== id));
  };

  if (loading) return <p className="text-center text-sm text-muted-foreground py-8"><CircleSpinner size={28} /></p>;

  return (
    <div className="space-y-3">
      {items.length === 0 && !adding && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Award className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No certifications listed yet.</p>
        </div>
      )}

      {items.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-card p-3 shadow-card flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold leading-tight">{c.title}</p>
              {c.verified && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                  Verified
                </span>
              )}
            </div>
            {c.issuer && <p className="text-[11px] text-muted-foreground mt-0.5">Issued by {c.issuer}</p>}
            {c.expires_at && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Expires {new Date(c.expires_at).toLocaleDateString()}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {c.document_url && (
                <a
                  href={c.document_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-primary inline-flex items-center gap-1 hover:underline"
                >
                  View document <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {canManage && (
                <button
                  onClick={() => remove(c.id)}
                  className="ml-auto text-[11px] text-destructive inline-flex items-center gap-1 hover:underline"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {canManage && !adding && (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4" /> Add certification
        </Button>
      )}

      {canManage && adding && (
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card space-y-2">
          <Input placeholder="e.g. ISO 9001:2015" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Issuer (e.g. SGS, Bureau Veritas)" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full text-left text-xs px-3 py-2 rounded-md border border-dashed border-border bg-background hover:bg-muted transition"
          >
            {file ? `📎 ${file.name}` : "Upload certificate image or PDF (optional)"}
          </button>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
            <Button variant="outline" onClick={() => { setAdding(false); setFile(null); setTitle(""); setIssuer(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
