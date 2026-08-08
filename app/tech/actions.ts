"use server";

import { revalidatePath } from "next/cache";
import { requireTech } from "@/lib/auth/tech";

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) || "").trim();
  return value || null;
}

function refreshTechRepairOrder(repairOrderId: string) {
  revalidatePath("/tech");
  revalidatePath(`/tech/repair-orders/${repairOrderId}`);
  revalidatePath(`/admin/repair-orders/${repairOrderId}`);
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
  const partsList = String(formData.get("partsList") || "");
  if (!repairOrderId || !jobId) return;

  const parts = partsList
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (parts.length === 0) return;

  const { supabase } = await requireTech();
  const { error } = await supabase.rpc("tech_submit_part_requests", {
    p_repair_order_id: repairOrderId,
    p_job_id: jobId,
    p_parts: parts,
  });

  if (error) {
    console.error("tech part request submission failed", error.message);
    return;
  }

  refreshTechRepairOrder(repairOrderId);
}
