import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Upload, CheckCircle2, Clock, AlertCircle, FileText, Home as HomeIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useVerification } from "@/hooks/useVerification";
import CircleSpinner from "@/components/CircleSpinner";

const sb = supabase as any;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export default function Verification() {
  const navigate = useNavigate();
  const { verification, status, loading, userId, refresh } = useVerification();
  const [idFile, setIdFile] = useState<File | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !userId) navigate("/auth?redirect=/verification");
  }, [loading, userId, navigate]);

  const validateFile = (f: File | null, label: string): boolean => {
    if (!f) { toast.error(`${label} is required`); return false; }
    if (!ACCEPTED.includes(f.type)) { toast.error(`${label}: use JPG, PNG, WEBP or PDF`); return false; }
    if (f.size > MAX_FILE_BYTES) { toast.error(`${label}: file must be under 8MB`); return false; }
    return true;
  };

  const upload = async (file: File, kind: "id" | "proof"): Promise<string> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("verifications").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    return path;
  };

  const submit = async () => {
    if (!validateFile(idFile, "ID card") || !validateFile(proofFile, "Proof of residency")) return;
    if (!userId) return;
    setSubmitting(true);
    try {
      const [idPath, proofPath] = await Promise.all([
        upload(idFile!, "id"),
        upload(proofFile!, "proof"),
      ]);
      const payload = {
        user_id: userId,
        id_card_url: idPath,
        proof_residency_url: proofPath,
        status: "pending",
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
        notes: null,
      };
      // Upsert: if a row exists (rejected), replace it; otherwise insert
      const { error } = await sb
        .from("user_verifications")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Documents submitted", { description: "A supplier will review your documents shortly." });
      setIdFile(null); setProofFile(null);
      refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Could not submit documents");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <CircleSpinner size={28} className="text-primary" />
      </div>
    );
  }

  return (
    <div className="">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/85 to-primary/60" />
        <div className="relative px-4 pt-4 pb-10 text-primary-foreground">
          <div className="flex items-center gap-2 mb-4">
            <Link to="/account" className="w-9 h-9 rounded-full bg-primary-foreground/15 backdrop-blur flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-base font-black tracking-tight">Identity verification</h1>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/20 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-4 h-4" />
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-90">Cash on delivery eligibility</p>
            </div>
            <p className="text-sm font-bold leading-tight">Verify your identity to unlock COD</p>
            <p className="text-[11px] opacity-80 mt-1">
              Upload a government ID and a proof of residency. A supplier will review and approve your account.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 relative z-10">
        <StatusCard status={status} notes={verification?.notes ?? null} />
      </div>

      {status !== "approved" && (
        <div className="px-4 mt-4 space-y-3">
          <UploadField
            icon={FileText}
            label="Government-issued ID"
            hint="National ID, passport or driver's licence (JPG, PNG, WEBP or PDF · max 8MB)"
            file={idFile}
            onChange={setIdFile}
          />
          <UploadField
            icon={HomeIcon}
            label="Proof of residency"
            hint="Recent utility bill or bank statement showing your address (max 8MB)"
            file={proofFile}
            onChange={setProofFile}
          />
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your documents are stored privately and are only visible to verified PUBSTORE suppliers
              for review. We never share them publicly.
            </p>
          </div>
        </div>
      )}

      {status !== "approved" && (
        <div className="fixed bottom-14 lg:bottom-0 inset-x-0 z-30 bg-background border-t border-border safe-bottom">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <Button
              onClick={submit}
              disabled={submitting || !idFile || !proofFile}
              className="w-full h-11 rounded-full bg-primary text-primary-foreground font-semibold"
            >
              {submitting ? (<><CircleSpinner size={16} className="mr-2" /> Submitting…</>) : (
                status === "pending" ? "Re-submit documents" : "Submit for review"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCard({ status, notes }: { status: "pending" | "approved" | "rejected" | "none"; notes: string | null }) {
  if (status === "approved") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3 shadow-card">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
        <div>
          <p className="text-sm font-black tracking-tight">You're verified</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Cash on delivery is now available at checkout.</p>
        </div>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 shadow-card">
        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div>
          <p className="text-sm font-black tracking-tight">Awaiting review</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">A supplier will review your documents soon. You'll be notified when approved.</p>
        </div>
      </div>
    );
  }
  if (status === "rejected") {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3 shadow-card">
        <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
        <div>
          <p className="text-sm font-black tracking-tight">Submission rejected</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{notes || "Please re-submit clearer documents."}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3 shadow-card">
      <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
      <div>
        <p className="text-sm font-black tracking-tight">Not verified yet</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Submit two documents to enable Cash on delivery.</p>
      </div>
    </div>
  );
}

function UploadField({
  icon: Icon, label, hint, file, onChange,
}: {
  icon: typeof FileText;
  label: string;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-card p-3 cursor-pointer hover:border-primary/50 transition">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black tracking-tight">{label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{hint}</p>
          {file && (
            <p className="mt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 truncate flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {file.name}
            </p>
          )}
        </div>
        <span className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Upload className="w-4 h-4 text-muted-foreground" />
        </span>
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
