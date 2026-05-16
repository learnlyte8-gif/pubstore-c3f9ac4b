import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  supplierId: string;
  buyerId: string | null;
  onSent: () => void;
};

export default function InquiryGateDialog({
  open, onClose, productId, productTitle, supplierId, buyerId, onSent,
}: Props) {
  const navigate = useNavigate();
  const [msg, setMsg] = useState(
    `Hi, before placing an order I'd like to confirm specs, packaging, lead time, and sample availability for "${productTitle}". Thanks.`
  );
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!buyerId) {
      navigate("/auth");
      return;
    }
    if (!msg.trim()) return;
    setSending(true);
    try {
      // Record the inquiry (pending supplier approval)
      const { error: invErr } = await supabase.from("product_inquiries").upsert(
        { buyer_id: buyerId, product_id: productId, supplier_id: supplierId, message: msg, product_title: productTitle, status: "pending", decided_at: null, decided_by: null },
        { onConflict: "buyer_id,product_id" }
      );
      if (invErr) throw invErr;

      // Find or create conversation
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("buyer_id", buyerId)
        .eq("supplier_id", supplierId)
        .maybeSingle();
      let convId = existing?.id;
      if (!convId) {
        const { data: created, error: cErr } = await supabase
          .from("conversations")
          .insert({ buyer_id: buyerId, supplier_id: supplierId, last_message: msg, last_message_at: new Date().toISOString() })
          .select("id")
          .single();
        if (cErr) throw cErr;
        convId = created.id;
      } else {
        await supabase
          .from("conversations")
          .update({ last_message: msg, last_message_at: new Date().toISOString() })
          .eq("id", convId);
      }

      await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: buyerId,
        body: msg,
      });

      toast.success("Inquiry sent. Waiting for supplier approval to unlock checkout.");
      onSent();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send inquiry");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Inquire before ordering
          </DialogTitle>
          <DialogDescription>
            Trade Assurance requires the supplier to review and approve your request before you can
            add this product to cart. They'll confirm specs, MOQ, packaging and lead time, then unlock checkout.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={5}
          className="text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={send} disabled={sending || !msg.trim()} className="gap-1.5">
            <Send className="w-4 h-4" /> {sending ? "Sending…" : "Send inquiry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
