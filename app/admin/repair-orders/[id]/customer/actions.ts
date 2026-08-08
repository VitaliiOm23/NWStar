"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";

function text(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

function refresh(repairOrderId: string) {
  revalidatePath(`/admin/repair-orders/${repairOrderId}/customer`);
  revalidatePath(`/admin/repair-orders/${repairOrderId}`);
}

export async function createCustomerPortalLink(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  if (!repairOrderId) return;

  const { supabase, user } = await requireOwner();
  const { data: existing } = await supabase
    .from("customer_portal_links")
    .select("id,expires_at")
    .eq("repair_order_id", repairOrderId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingIsUsable = Boolean(
    existing && (!existing.expires_at || new Date(existing.expires_at).getTime() > Date.now())
  );

  if (!existingIsUsable) {
    if (existing?.id) {
      await supabase.from("customer_portal_links").update({ active: false }).eq("id", existing.id);
    }
    const { error } = await supabase.from("customer_portal_links").insert({
      repair_order_id: repairOrderId,
      created_by: user.id,
    });
    if (error) console.error("customer portal link creation failed", error.message);
  }

  refresh(repairOrderId);
}

export async function rotateCustomerPortalLink(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  if (!repairOrderId) return;

  const { supabase, user } = await requireOwner();
  const { error: revokeError } = await supabase
    .from("customer_portal_links")
    .update({ active: false })
    .eq("repair_order_id", repairOrderId)
    .eq("active", true);

  if (revokeError) {
    console.error("customer portal link rotation failed", revokeError.message);
    return;
  }

  const { error } = await supabase.from("customer_portal_links").insert({
    repair_order_id: repairOrderId,
    created_by: user.id,
  });
  if (error) console.error("customer portal link creation failed", error.message);
  refresh(repairOrderId);
}

export async function revokeCustomerPortalLink(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const linkId = text(formData, "linkId");
  if (!repairOrderId || !linkId) return;

  const { supabase } = await requireOwner();
  const { error } = await supabase
    .from("customer_portal_links")
    .update({ active: false })
    .eq("id", linkId)
    .eq("repair_order_id", repairOrderId);

  if (error) console.error("customer portal link revoke failed", error.message);
  refresh(repairOrderId);
}
