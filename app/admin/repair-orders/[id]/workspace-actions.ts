"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";

const authorizationStatuses = new Set(["pending", "approved", "deferred", "declined"]);
const itemTypes = new Set(["labor", "part", "fee", "sublet", "discount"]);

function raw(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}
function text(formData: FormData, name: string) {
  return raw(formData, name) || null;
}
function numberValue(formData: FormData, name: string) {
  const value = raw(formData, name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function refresh(id: string) {
  revalidatePath("/admin/repair-orders");
  revalidatePath(`/admin/repair-orders/${id}`);
  revalidatePath(`/admin/repair-orders/${id}/team`);
  revalidatePath(`/admin/repair-orders/${id}/customer`);
  revalidatePath("/tech");
  revalidatePath(`/tech/repair-orders/${id}`);
}

export async function saveWorkLine(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  if (!repairOrderId || !jobId) return;

  const { supabase } = await requireOwner();
  const { error } = await supabase
    .from("ro_jobs")
    .update({
      title: raw(formData, "title"),
      customer_concern: raw(formData, "customerConcern"),
      technician_findings: text(formData, "technicianFindings"),
      recommended_action: text(formData, "recommendedAction"),
      correction_performed: text(formData, "correctionPerformed"),
    })
    .eq("id", jobId)
    .eq("repair_order_id", repairOrderId);

  if (error) console.error("RO workspace line save failed", error.message);
  refresh(repairOrderId);
}

export async function saveLineAuthorization(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  if (!repairOrderId || !jobId) return;

  const { supabase, user } = await requireOwner();
  const { data: existing, error: lookupError } = await supabase
    .from("ro_jobs")
    .select("authorization_status,authorized_at")
    .eq("id", jobId)
    .eq("repair_order_id", repairOrderId)
    .single();
  if (lookupError || !existing) return;

  const requested = raw(formData, "authorizationStatus");
  const status = authorizationStatuses.has(requested) ? requested : existing.authorization_status;
  const authorizedAmount = numberValue(formData, "authorizedAmount");
  const authorizationMethod = text(formData, "authorizationMethod");
  const authorizedByName = text(formData, "authorizedByName");
  const authorizedByPhone = text(formData, "authorizedByPhone");
  const decisionMade = ["approved", "deferred", "declined"].includes(status);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("ro_jobs")
    .update({
      authorization_status: status,
      authorized_amount: authorizedAmount,
      authorization_method: authorizationMethod,
      authorized_by_name: authorizedByName,
      authorized_by_phone: authorizedByPhone,
      authorized_at: decisionMade ? now : null,
      deferred_reason: text(formData, "deferredReason"),
    })
    .eq("id", jobId)
    .eq("repair_order_id", repairOrderId);

  if (!error && existing.authorization_status !== status && decisionMade && authorizationMethod && authorizedByName) {
    const { error: logError } = await supabase.from("ro_authorizations").insert({
      repair_order_id: repairOrderId,
      ro_job_id: jobId,
      decision: status,
      authorized_amount: authorizedAmount,
      authorization_method: authorizationMethod,
      authorized_by_name: authorizedByName,
      authorized_by_phone: authorizedByPhone,
      employee_name: user.email || "Owner",
      notes: text(formData, "authorizationNote"),
      authorized_at: now,
    });
    if (logError) console.error("RO workspace authorization log failed", logError.message);
  }

  if (error) console.error("RO workspace authorization save failed", error.message);
  refresh(repairOrderId);
}

export async function addWorkspaceItem(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  const itemType = raw(formData, "itemType");
  if (!repairOrderId || !jobId || !itemTypes.has(itemType)) return;

  const quantity = numberValue(formData, "quantity") ?? 1;
  if (quantity <= 0) return;

  const { supabase } = await requireOwner();
  let unitPrice = numberValue(formData, "unitPrice");
  let unit = raw(formData, "unit") || "ea";

  if (itemType === "labor") {
    const { data: ro, error: rateError } = await supabase
      .from("repair_orders")
      .select("labor_rate")
      .eq("id", repairOrderId)
      .single();
    if (rateError || !ro) return;
    unitPrice = Number(ro.labor_rate || 100);
    unit = "hr";
  }

  if (unitPrice === null) unitPrice = 0;
  if (unitPrice < 0) return;

  const { error } = await supabase.from("ro_items").insert({
    ro_job_id: jobId,
    item_type: itemType,
    description: raw(formData, "description") || (itemType === "labor" ? "Labor" : itemType === "part" ? "Part" : "RO item"),
    part_number: text(formData, "partNumber"),
    part_condition: text(formData, "partCondition"),
    quantity,
    unit,
    unit_cost: numberValue(formData, "unitCost"),
    unit_price: unitPrice,
    taxable: formData.get("taxable") === "yes",
  });

  if (error) console.error("RO workspace item add failed", error.message);
  refresh(repairOrderId);
}
