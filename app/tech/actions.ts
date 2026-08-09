"use server";

import { revalidatePath } from "next/cache";
import { requireTech } from "@/lib/auth/tech";

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) || "").trim();
  return value || null;
}

function refreshTechRepairOrder(repairOrderId: string) {
  revalidatePath("/tech");
  revalidatePath("/tech/earnings");
  revalidatePath(`/tech/repair-orders/${repairOrderId}`);
  revalidatePath(`/admin/repair-orders/${repairOrderId}`);
  revalidatePath(`/admin/repair-orders/${repairOrderId}/team`);
  revalidatePath("/admin/people");
}

export async function updateTechLine(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  const intent = text(formData, "intent") || "save";
  if (!repairOrderId || !jobId) return;

  const { supabase } = await requireTech();
  const { error } = await supabase.rpc("tech_update_ro_job", {
    p_repair_order_id: repairOrderId,
    p_job_id: jobId,
    p_findings: text(formData, "technicianFindings"),
    p_recommendation: text(formData, "recommendedAction"),
    p_correction: text(formData, "correctionPerformed"),
    p_complete: intent === "complete",
  });

  if (error) {
    console.error("tech line update failed", error.message);
    return;
  }

  refreshTechRepairOrder(repairOrderId);
}

export async function submitTechParts(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  if (!repairOrderId || !jobId) return;
  let parts: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(String(formData.get("partsJson") || "[]"));
    if (Array.isArray(parsed)) parts = parsed.filter((part) => String(part?.description || "").trim()).slice(0, 50);
  } catch {
    return;
  }
  if (parts.length === 0) return;

  const { supabase } = await requireTech();
  const { error } = await supabase.rpc("tech_submit_part_requests_v2", {
    p_repair_order_id: repairOrderId,
    p_job_id: jobId,
    p_items: parts,
  });
  if (error) {
    console.error("tech structured part request submission failed", error.message);
    return;
  }
  refreshTechRepairOrder(repairOrderId);
}

export async function startTechTimer(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  if (!repairOrderId || !jobId) return;
  const { supabase } = await requireTech();
  const { error } = await supabase.rpc("tech_start_timer", { p_job_id: jobId });
  if (error) console.error("technician timer start failed", error.message);
  refreshTechRepairOrder(repairOrderId);
}

export async function stopTechTimer(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  if (!repairOrderId || !jobId) return;
  const { supabase } = await requireTech();
  const { error } = await supabase.rpc("tech_stop_timer", { p_job_id: jobId });
  if (error) console.error("technician timer stop failed", error.message);
  refreshTechRepairOrder(repairOrderId);
}
