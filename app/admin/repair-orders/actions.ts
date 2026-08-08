"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/owner";

const roStatuses = new Set([
  "draft",
  "awaiting_authorization",
  "authorized",
  "in_progress",
  "waiting_parts",
  "completed",
  "invoiced",
  "paid",
  "closed",
  "cancelled",
]);

const jobStatuses = new Set(["pending", "approved", "deferred", "declined", "completed"]);
const itemTypes = new Set(["labor", "part", "fee", "sublet", "discount"]);
const estimateStatuses = new Set(["draft", "sent", "partially_approved", "approved", "declined", "expired"]);
const paymentMethods = new Set(["cash", "card", "check", "zelle", "ach", "bank_transfer", "financing", "other"]);
const paymentStatuses = new Set(["pending", "succeeded", "failed", "refunded", "void"]);

function rawText(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

function text(formData: FormData, name: string) {
  const value = rawText(formData, name);
  return value || null;
}

function numberValue(formData: FormData, name: string) {
  const value = rawText(formData, name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(formData: FormData, name: string) {
  const value = numberValue(formData, name);
  return value === null ? null : Math.round(value);
}

function revalidateRepairOrder(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/repair-orders");
  revalidatePath(`/admin/repair-orders/${id}`);
  revalidatePath(`/admin/repair-orders/${id}/print`);
  revalidatePath("/tech");
  revalidatePath(`/tech/repair-orders/${id}`);
}

export async function createRepairOrderFromRequest(formData: FormData) {
  const requestId = text(formData, "requestId");
  if (!requestId) return;

  const { supabase } = await requireOwner();
  const { data, error } = await supabase.rpc("create_repair_order_from_request", {
    p_request_id: requestId,
  });

  if (error || !data) {
    console.error("repair order creation failed", error?.message);
    return;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/repair-orders");
  revalidatePath("/tech");
  redirect(`/admin/repair-orders/${data}`);
}

export async function updateRepairOrder(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  if (!repairOrderId) return;

  const { supabase } = await requireOwner();
  const { data: existing, error: existingError } = await supabase
    .from("repair_orders")
    .select("status")
    .eq("id", repairOrderId)
    .single();

  if (existingError) {
    console.error("repair order lookup failed", existingError.message);
    return;
  }

  const requestedStatus = text(formData, "status");
  const status = requestedStatus && roStatuses.has(requestedStatus) ? requestedStatus : existing.status;
  const taxPercent = numberValue(formData, "taxPercent");

  const { error } = await supabase
    .from("repair_orders")
    .update({
      status,
      original_complaint: rawText(formData, "originalComplaint"),
      customer_instructions: text(formData, "customerInstructions"),
      estimate_choice: text(formData, "estimateChoice") || "written_estimate",
      authorized_limit: numberValue(formData, "authorizedLimit"),
      estimate_authorization_note: text(formData, "estimateAuthorizationNote"),
      parts_return_requested: formData.get("partsReturnRequested") === "yes",
      odometer_in: integerValue(formData, "odometerIn"),
      odometer_out: integerValue(formData, "odometerOut"),
      promised_at: text(formData, "promisedAt"),
      completed_at: text(formData, "completedAt"),
      tax_rate: taxPercent === null ? 0 : taxPercent / 100,
      shop_supplies_amount: numberValue(formData, "shopSuppliesAmount") || 0,
      shop_supplies_taxable: formData.get("shopSuppliesTaxable") === "yes",
      discount_amount: numberValue(formData, "discountAmount") || 0,
      internal_notes: text(formData, "internalNotes"),
    })
    .eq("id", repairOrderId);

  if (error) console.error("repair order update failed", error.message);
  revalidateRepairOrder(repairOrderId);
}

export async function updateLaborRate(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const laborRate = numberValue(formData, "laborRate");
  if (!repairOrderId || laborRate === null || laborRate < 0 || laborRate > 10000) return;

  const { supabase } = await requireOwner();
  const { error } = await supabase.from("repair_orders").update({ labor_rate: laborRate }).eq("id", repairOrderId);
  if (error) console.error("labor rate update failed", error.message);
  revalidateRepairOrder(repairOrderId);
}

export async function addRepairOrderJob(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  if (!repairOrderId) return;

  const { supabase } = await requireOwner();
  const { data: latest } = await supabase
    .from("ro_jobs")
    .select("line_number")
    .eq("repair_order_id", repairOrderId)
    .order("line_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lineNumber = (latest?.line_number || 0) + 1;
  const title = rawText(formData, "title") || `Service line ${lineNumber}`;
  const concern = rawText(formData, "customerConcern");

  const { error } = await supabase.from("ro_jobs").insert({
    repair_order_id: repairOrderId,
    line_number: lineNumber,
    title,
    customer_concern: concern,
    technician_findings: text(formData, "technicianFindings"),
    recommended_action: text(formData, "recommendedAction"),
    sort_order: lineNumber,
  });

  if (error) console.error("repair order job creation failed", error.message);
  revalidateRepairOrder(repairOrderId);
}

export async function updateRepairOrderJob(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  if (!repairOrderId || !jobId) return;

  const { supabase, user } = await requireOwner();
  const { data: existing, error: existingError } = await supabase
    .from("ro_jobs")
    .select("authorization_status,title,customer_concern")
    .eq("id", jobId)
    .single();

  if (existingError) {
    console.error("repair order job lookup failed", existingError.message);
    return;
  }

  const requestedStatus = text(formData, "authorizationStatus");
  const status = requestedStatus && jobStatuses.has(requestedStatus) ? requestedStatus : existing.authorization_status;
  const decisionMade = ["approved", "deferred", "declined", "completed"].includes(status);
  const authorizationMethod = text(formData, "authorizationMethod");
  const authorizedByName = text(formData, "authorizedByName");
  const authorizedAmount = numberValue(formData, "authorizedAmount");
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("ro_jobs")
    .update({
      title: rawText(formData, "title"),
      customer_concern: rawText(formData, "customerConcern"),
      technician_findings: text(formData, "technicianFindings"),
      recommended_action: text(formData, "recommendedAction"),
      correction_performed: text(formData, "correctionPerformed"),
      authorization_status: status,
      authorized_amount: authorizedAmount,
      authorization_method: authorizationMethod,
      authorized_by_name: authorizedByName,
      authorized_by_phone: text(formData, "authorizedByPhone"),
      authorized_at: decisionMade ? now : null,
      deferred_reason: text(formData, "deferredReason"),
      completed_at: status === "completed" ? now : null,
    })
    .eq("id", jobId);

  if (error) {
    console.error("repair order job update failed", error.message);
  } else if (existing.authorization_status !== status && decisionMade && authorizationMethod && authorizedByName) {
    const { error: authorizationError } = await supabase.from("ro_authorizations").insert({
      repair_order_id: repairOrderId,
      ro_job_id: jobId,
      decision: status,
      authorized_amount: authorizedAmount,
      authorization_method: authorizationMethod,
      authorized_by_name: authorizedByName,
      authorized_by_phone: text(formData, "authorizedByPhone"),
      employee_name: user.email || "Owner",
      notes: text(formData, "authorizationNote"),
      authorized_at: now,
    });
    if (authorizationError) console.error("authorization log failed", authorizationError.message);
  }

  revalidateRepairOrder(repairOrderId);
}

export async function addJobItem(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  const itemType = text(formData, "itemType");
  if (!repairOrderId || !jobId || !itemType || !itemTypes.has(itemType)) return;

  const { supabase } = await requireOwner();
  const description = rawText(formData, "description") || titleForItemType(itemType);
  const quantity = numberValue(formData, "quantity") ?? 1;
  if (quantity <= 0) return;

  let unitPrice = numberValue(formData, "unitPrice");
  if (itemType === "labor") {
    const { data: repairOrder, error: rateError } = await supabase
      .from("repair_orders")
      .select("labor_rate")
      .eq("id", repairOrderId)
      .single();

    if (rateError) {
      console.error("labor rate lookup failed", rateError.message);
      return;
    }

    unitPrice = Number(repairOrder?.labor_rate ?? 100);
  }

  if (unitPrice === null) unitPrice = 0;
  if (unitPrice < 0) return;

  const { error } = await supabase.from("ro_items").insert({
    ro_job_id: jobId,
    item_type: itemType,
    description,
    part_number: text(formData, "partNumber"),
    part_condition: text(formData, "partCondition"),
    quantity,
    unit_cost: numberValue(formData, "unitCost"),
    unit_price: unitPrice,
    taxable: formData.get("taxable") === "yes",
  });

  if (error) console.error("repair order item creation failed", error.message);
  revalidateRepairOrder(repairOrderId);
}

function titleForItemType(itemType: string) {
  if (itemType === "labor") return "Labor";
  if (itemType === "part") return "Part";
  if (itemType === "fee") return "Fee";
  if (itemType === "sublet") return "Sublet";
  if (itemType === "discount") return "Discount";
  return "RO item";
}

export async function removeJobItem(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const itemId = text(formData, "itemId");
  if (!repairOrderId || !itemId) return;

  const { supabase } = await requireOwner();
  const { error } = await supabase.from("ro_items").delete().eq("id", itemId);
  if (error) console.error("repair order item deletion failed", error.message);
  revalidateRepairOrder(repairOrderId);
}

export async function createEstimateSnapshot(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  if (!repairOrderId) return;

  const { supabase } = await requireOwner();
  const { error } = await supabase.rpc("create_estimate_snapshot", {
    p_repair_order_id: repairOrderId,
  });
  if (error) console.error("estimate snapshot failed", error.message);
  revalidateRepairOrder(repairOrderId);
}

export async function updateEstimate(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const estimateId = text(formData, "estimateId");
  const requestedStatus = text(formData, "status");
  if (!repairOrderId || !estimateId) return;

  const { supabase } = await requireOwner();
  const { data: existing, error: existingError } = await supabase.from("estimates").select("status").eq("id", estimateId).single();
  if (existingError) return;
  const status = requestedStatus && estimateStatuses.has(requestedStatus) ? requestedStatus : existing.status;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("estimates")
    .update({
      status,
      valid_until: text(formData, "validUntil"),
      customer_note: text(formData, "customerNote"),
      sent_at: status === "sent" ? now : undefined,
      authorized_at: ["approved", "partially_approved"].includes(status) ? now : undefined,
      authorization_method: text(formData, "authorizationMethod"),
      authorized_by_name: text(formData, "authorizedByName"),
      authorization_note: text(formData, "authorizationNote"),
    })
    .eq("id", estimateId);

  if (error) console.error("estimate update failed", error.message);
  revalidateRepairOrder(repairOrderId);
}

export async function syncInvoice(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  if (!repairOrderId) return;

  const { supabase } = await requireOwner();
  const { error } = await supabase.rpc("sync_repair_order_invoice", {
    p_repair_order_id: repairOrderId,
  });
  if (error) console.error("invoice sync failed", error.message);
  revalidateRepairOrder(repairOrderId);
}

export async function updateInvoicePaymentLink(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const invoiceId = text(formData, "invoiceId");
  if (!repairOrderId || !invoiceId) return;

  const { supabase } = await requireOwner();
  const { error } = await supabase
    .from("invoices")
    .update({
      payment_provider: text(formData, "paymentProvider"),
      hosted_payment_url: text(formData, "hostedPaymentUrl"),
      due_at: text(formData, "dueAt"),
      customer_note: text(formData, "customerNote"),
    })
    .eq("id", invoiceId);

  if (error) console.error("invoice payment link update failed", error.message);
  revalidateRepairOrder(repairOrderId);
}

export async function recordPayment(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const invoiceId = text(formData, "invoiceId");
  const amount = numberValue(formData, "amount");
  const method = text(formData, "method");
  const status = text(formData, "status") || "succeeded";

  if (!repairOrderId || !invoiceId || !amount || amount <= 0 || !method || !paymentMethods.has(method) || !paymentStatuses.has(status)) return;

  const { supabase } = await requireOwner();
  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    amount,
    method,
    status,
    provider: text(formData, "provider"),
    provider_reference: text(formData, "providerReference"),
    notes: text(formData, "notes"),
    received_at: text(formData, "receivedAt") || new Date().toISOString(),
  });

  if (error) console.error("payment recording failed", error.message);
  revalidateRepairOrder(repairOrderId);
}
