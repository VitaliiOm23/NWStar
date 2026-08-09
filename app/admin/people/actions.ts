"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const workerTypes = new Set(["employee", "contractor"]);
const payMethods = new Set(["none", "sold_hour", "actual_hour", "fixed", "labor_percent", "revenue_percent", "manual"]);

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
function refresh(repairOrderId?: string) {
  revalidatePath("/admin/people");
  revalidatePath("/admin/pay");
  revalidatePath("/admin/repair-orders");
  revalidatePath("/tech");
  if (repairOrderId) {
    revalidatePath(`/admin/repair-orders/${repairOrderId}`);
    revalidatePath(`/admin/repair-orders/${repairOrderId}/team`);
    revalidatePath(`/tech/repair-orders/${repairOrderId}`);
  }
}

export async function createWorker(formData: FormData) {
  const displayName = raw(formData, "displayName") || "Technician";
  const email = text(formData, "email")?.toLowerCase() || null;
  const temporaryPassword = raw(formData, "temporaryPassword");
  const requestedType = raw(formData, "workerType");
  const workerType = workerTypes.has(requestedType) ? requestedType : "contractor";
  const requestedMethod = raw(formData, "compensationMethod");
  const compensationMethod = payMethods.has(requestedMethod) ? requestedMethod : "sold_hour";
  const compensationRate = Math.max(0, numberValue(formData, "compensationRate") || 0);

  const { supabase } = await requireOwner();
  let userId: string | null = null;

  if (email && temporaryPassword) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      console.error("worker account creation unavailable: Supabase admin client is not configured");
      return;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error || !data.user) {
      console.error("worker auth account creation failed", error?.message);
      return;
    }
    userId = data.user.id;
  }

  const { data: worker, error: workerError } = await supabase
    .from("workers")
    .insert({
      user_id: userId,
      email,
      display_name: displayName,
      worker_type: workerType,
      active: true,
      compensation_method: compensationMethod,
      compensation_rate: compensationRate,
      notes: text(formData, "notes"),
    })
    .select("id")
    .single();

  if (workerError || !worker) {
    console.error("worker profile creation failed", workerError?.message);
    return;
  }

  if (userId) {
    const { error: techError } = await supabase.from("tech_users").upsert({
      user_id: userId,
      display_name: displayName,
      active: true,
    });
    if (techError) console.error("technician membership creation failed", techError.message);
  }

  refresh();
}

export async function updateWorker(formData: FormData) {
  const workerId = text(formData, "workerId");
  if (!workerId) return;
  const { supabase } = await requireOwner();
  const requestedType = raw(formData, "workerType");
  const requestedMethod = raw(formData, "compensationMethod");
  const active = formData.get("active") === "yes";

  const { data: worker, error } = await supabase
    .from("workers")
    .update({
      display_name: raw(formData, "displayName") || "Technician",
      email: text(formData, "email")?.toLowerCase() || null,
      worker_type: workerTypes.has(requestedType) ? requestedType : "contractor",
      active,
      compensation_method: payMethods.has(requestedMethod) ? requestedMethod : "sold_hour",
      compensation_rate: Math.max(0, numberValue(formData, "compensationRate") || 0),
      notes: text(formData, "notes"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", workerId)
    .select("user_id,display_name")
    .maybeSingle();
  if (error) {
    console.error("worker update failed", error.message);
    return;
  }
  if (worker?.user_id) {
    const { error: techError } = await supabase.from("tech_users").upsert({ user_id: worker.user_id, display_name: worker.display_name, active });
    if (techError) console.error("technician membership update failed", techError.message);
  }
  refresh();
}

export async function saveAssignment(formData: FormData) {
  const repairOrderId = text(formData, "repairOrderId");
  const jobId = text(formData, "jobId");
  const workerId = text(formData, "workerId");
  if (!jobId || !workerId) return;
  const { supabase } = await requireOwner();

  const { data: worker, error: workerError } = await supabase
    .from("workers")
    .select("compensation_method,compensation_rate")
    .eq("id", workerId)
    .single();
  if (workerError || !worker) return;

  const requestedMethod = raw(formData, "compensationMethod");
  const method = payMethods.has(requestedMethod) ? requestedMethod : worker.compensation_method;
  const rate = numberValue(formData, "compensationRate");
  const credit = Math.min(100, Math.max(0, numberValue(formData, "creditPercent") ?? 100));
  const soldHours = numberValue(formData, "soldHoursCredit");
  const manualPay = numberValue(formData, "manualPay");

  const { error } = await supabase.from("ro_job_assignments").upsert(
    {
      ro_job_id: jobId,
      worker_id: workerId,
      credit_percent: credit,
      sold_hours_credit: soldHours,
      compensation_method: method,
      compensation_rate: Math.max(0, rate ?? Number(worker.compensation_rate || 0)),
      manual_pay: manualPay,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ro_job_id,worker_id" }
  );
  if (error) console.error("assignment save failed", error.message);
  refresh(repairOrderId || undefined);
}

export async function removeAssignment(formData: FormData) {
  const assignmentId = text(formData, "assignmentId");
  const repairOrderId = text(formData, "repairOrderId");
  if (!assignmentId) return;
  const { supabase } = await requireOwner();
  const { data } = await supabase.from("ro_job_assignments").select("pay_period_id").eq("id", assignmentId).maybeSingle();
  if (data?.pay_period_id) return;
  const { error } = await supabase.from("ro_job_assignments").delete().eq("id", assignmentId);
  if (error) console.error("assignment removal failed", error.message);
  refresh(repairOrderId || undefined);
}
