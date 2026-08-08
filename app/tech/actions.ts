"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) || "").trim();
  return value || null;
}

export async function updateTechLine(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  const intent = text(formData, "intent") || "save";
  if (!repairOrderId || !jobId) return;

  const { supabase } = await requireOwner();
  const { data: existing, error: readError } = await supabase
    .from("ro_jobs")
    .select("authorization_status")
    .eq("id", jobId)
    .eq("repair_order_id", repairOrderId)
    .maybeSingle();

  if (readError || !existing) {
    console.error("tech line lookup failed", readError?.message);
    return;
  }

  const update: Record<string, string | null> = {
    technician_findings: text(formData, "technicianFindings"),
    correction_performed: text(formData, "correctionPerformed"),
  };

  if (intent === "complete" && ["approved", "completed"].includes(existing.authorization_status)) {
    update.authorization_status = "completed";
    update.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("ro_jobs")
    .update(update)
    .eq("id", jobId)
    .eq("repair_order_id", repairOrderId);

  if (error) {
    console.error("tech line update failed", error.message);
    return;
  }

  revalidatePath("/tech");
  revalidatePath(`/tech/repair-orders/${repairOrderId}`);
  revalidatePath(`/admin/repair-orders/${repairOrderId}`);
}
