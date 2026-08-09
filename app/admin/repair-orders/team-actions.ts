"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";

const partStatuses = new Set(["requested", "sourced", "ordered", "received", "installed", "not_needed"]);

function raw(formData: FormData, name: string) { return String(formData.get(name) || "").trim(); }
function text(formData: FormData, name: string) { return raw(formData, name) || null; }
function numberValue(formData: FormData, name: string) {
  const value = raw(formData, name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function refresh(repairOrderId: string) {
  revalidatePath(`/admin/repair-orders/${repairOrderId}`);
  revalidatePath(`/admin/repair-orders/${repairOrderId}/team`);
  revalidatePath("/admin/people");
  revalidatePath("/admin/pay");
  revalidatePath("/tech");
  revalidatePath(`/tech/repair-orders/${repairOrderId}`);
}

export async function updatePartRequestStatus(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const requestId = text(formData, "requestId");
  const requested = raw(formData, "status");
  if (!repairOrderId || !requestId || !partStatuses.has(requested)) return;
  const { supabase } = await requireOwner();
  const { error } = await supabase.from("ro_part_requests").update({ status: requested, updated_at: new Date().toISOString() }).eq("id", requestId).eq("repair_order_id", repairOrderId);
  if (error) console.error("part request status update failed", error.message);
  refresh(repairOrderId);
}

export async function convertPartRequest(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const requestId = text(formData, "requestId");
  if (!repairOrderId || !requestId) return;
  const { supabase } = await requireOwner();
  const { data: request, error: requestError } = await supabase
    .from("ro_part_requests")
    .select("id,ro_job_id,description,part_number,quantity,unit,converted_ro_item_id")
    .eq("id", requestId)
    .eq("repair_order_id", repairOrderId)
    .single();
  if (requestError || !request) return;

  const payload = {
    ro_job_id: request.ro_job_id,
    item_type: "part",
    description: raw(formData, "description") || request.description,
    part_number: text(formData, "partNumber") || request.part_number,
    part_condition: text(formData, "partCondition"),
    quantity: Math.max(0.001, numberValue(formData, "quantity") ?? Number(request.quantity || 1)),
    unit: raw(formData, "unit") || request.unit || "ea",
    unit_cost: numberValue(formData, "unitCost"),
    unit_price: Math.max(0, numberValue(formData, "unitPrice") || 0),
    taxable: formData.get("taxable") === "yes",
    source_part_request_id: request.id,
    updated_at: new Date().toISOString(),
  };

  let itemId = request.converted_ro_item_id as string | null;
  if (itemId) {
    const { error } = await supabase.from("ro_items").update(payload).eq("id", itemId);
    if (error) console.error("converted part update failed", error.message);
  } else {
    const { data: item, error } = await supabase.from("ro_items").insert(payload).select("id").single();
    if (error || !item) {
      console.error("part request conversion failed", error?.message);
      return;
    }
    itemId = item.id;
  }

  const nextStatus = raw(formData, "nextStatus");
  const { error: updateError } = await supabase.from("ro_part_requests").update({
    converted_ro_item_id: itemId,
    status: partStatuses.has(nextStatus) ? nextStatus : "sourced",
    updated_at: new Date().toISOString(),
  }).eq("id", requestId);
  if (updateError) console.error("part request conversion link failed", updateError.message);
  refresh(repairOrderId);
}

export async function addTrackedPart(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  if (!repairOrderId || !jobId) return;
  const { supabase } = await requireOwner();
  const { error } = await supabase.from("ro_items").insert({
    ro_job_id: jobId,
    item_type: "part",
    description: raw(formData, "description") || "Part",
    part_number: text(formData, "partNumber"),
    part_condition: text(formData, "partCondition"),
    quantity: Math.max(0.001, numberValue(formData, "quantity") ?? 1),
    unit: raw(formData, "unit") || "ea",
    unit_cost: numberValue(formData, "unitCost"),
    unit_price: Math.max(0, numberValue(formData, "unitPrice") || 0),
    taxable: formData.get("taxable") === "yes",
  });
  if (error) console.error("tracked part creation failed", error.message);
  refresh(repairOrderId);
}

export async function updateTrackedPart(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const itemId = text(formData, "itemId");
  if (!repairOrderId || !itemId) return;
  const { supabase } = await requireOwner();
  const { error } = await supabase.from("ro_items").update({
    description: raw(formData, "description") || "Part",
    part_number: text(formData, "partNumber"),
    part_condition: text(formData, "partCondition"),
    quantity: Math.max(0.001, numberValue(formData, "quantity") ?? 1),
    unit: raw(formData, "unit") || "ea",
    unit_cost: numberValue(formData, "unitCost"),
    unit_price: Math.max(0, numberValue(formData, "unitPrice") || 0),
    taxable: formData.get("taxable") === "yes",
    updated_at: new Date().toISOString(),
  }).eq("id", itemId);
  if (error) console.error("tracked part update failed", error.message);
  refresh(repairOrderId);
}
