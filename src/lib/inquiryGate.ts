import { supabase } from "@/integrations/supabase/client";
import type { ChatAttachment } from "@/components/chat/AttachmentCard";

// Approvals expire after this window — buyer must re-inquire and get re-approval.
export const INQUIRY_APPROVAL_TTL_DAYS = 30;
export const INQUIRY_APPROVAL_TTL_MS = INQUIRY_APPROVAL_TTL_DAYS * 24 * 60 * 60 * 1000;

export type InquiryGateStatus = "approved" | "pending" | "declined" | "expired" | "none";

export function isApprovalExpired(decidedAt?: string | null) {
  if (!decidedAt) return false;
  return Date.now() - new Date(decidedAt).getTime() > INQUIRY_APPROVAL_TTL_MS;
}

// Inquiry status helper — "approved" only when decided within the TTL window.
export async function getInquiryStatus(buyerId: string, productId: string): Promise<InquiryGateStatus> {
  const { data } = await supabase
    .from("product_inquiries")
    .select("status, decided_at")
    .eq("buyer_id", buyerId)
    .eq("product_id", productId)
    .maybeSingle();
  const status = data?.status as "approved" | "pending" | "declined" | undefined;
  if (!status) return "none";
  if (status === "approved" && isApprovalExpired((data as any)?.decided_at)) return "expired";
  return status;
}

// Send a cart-unlock attachment card to the buyer in chat after the supplier approves.
export async function sendCartUnlockMessage(opts: {
  buyerId: string;
  supplierId: string;
  supplierOwnerId: string;
  productId: string;
}) {
  const { buyerId, supplierId, supplierOwnerId, productId } = opts;

  // Load product details
  const { data: p } = await supabase
    .from("products")
    .select("id,title,image,price,unit,moq")
    .eq("id", productId)
    .maybeSingle();
  if (!p) return;

  // Find or create conversation
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", buyerId)
    .eq("supplier_id", supplierId)
    .maybeSingle();
  let convId = existing?.id;
  if (!convId) {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ buyer_id: buyerId, supplier_id: supplierId })
      .select("id")
      .single();
    convId = created?.id;
  }
  if (!convId) return;

  const attachment: ChatAttachment = {
    kind: "cart-unlock",
    productId: p.id,
    title: (p as any).title ?? "Product",
    image: (p as any).image ?? "",
    price: (p as any).price ?? undefined,
    currency: "USD",
    unit: (p as any).unit ?? undefined,
    moq: (p as any).moq ?? 1,
  };

  const body = `✅ Inquiry approved — you can now add "${(p as any).title}" to your cart.`;

  await supabase.from("messages").insert({
    conversation_id: convId,
    sender_id: supplierOwnerId,
    body,
    attachment: attachment as any,
  });

  await supabase
    .from("conversations")
    .update({ last_message: body, last_message_at: new Date().toISOString() })
    .eq("id", convId);

  await supabase.from("notifications").insert({
    user_id: buyerId,
    type: "inquiry_approved",
    title: "Cart unlocked",
    body: `You can now add "${(p as any).title}" to your cart.`,
    link: `/messages?supplier=${supplierId}`,
  });
}
