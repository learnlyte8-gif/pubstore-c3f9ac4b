import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VerificationStatus = "pending" | "approved" | "rejected" | "none";

export type VerificationRow = {
  id: string;
  user_id: string;
  id_card_url: string;
  proof_residency_url: string;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

const sb = supabase as any;

export function useVerification() {
  const [verification, setVerification] = useState<VerificationRow | null>(null);
  const [status, setStatus] = useState<VerificationStatus>("none");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) { setVerification(null); setStatus("none"); setLoading(false); return; }
    const { data } = await sb
      .from("user_verifications")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setVerification(data as VerificationRow);
      setStatus(data.status);
    } else {
      setVerification(null);
      setStatus("none");
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { verification, status, loading, userId, refresh, isApproved: status === "approved" };
}
