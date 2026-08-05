"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";

const allowedStatuses = new Set([
  "new",
  "contacted",
  "scheduled",
  "diagnosing",
  "waiting",
  "completed",
  "paid",
  "cancelled",
]);

export async function updateRequestStatus(formData: FormData) {
  const requestId = String(formData.get("requestId") || "");
  const nextStatus = String(formData.get("nextStatus") || "");

  if (!requestId || !allowedStatuses.has(nextStatus)) {
    return;
  }

  const { supabase } = await requireOwner();
  const { error } = await supabase
    .from("service_requests")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) {
    console.error("request status update failed", error.message);
    return;
  }

  revalidatePath("/admin");
}
