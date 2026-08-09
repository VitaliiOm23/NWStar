"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) || "").trim();
  return value || null;
}
function refresh() {
  revalidatePath("/admin/pay");
  revalidatePath("/admin/people");
  revalidatePath("/tech/earnings");
}

export async function buildPayPeriod(formData: FormData) {
  const start = text(formData, "startDate");
  const end = text(formData, "endDate");
  if (!start || !end) return;
  const { supabase } = await requireOwner();
  const { error } = await supabase.rpc("owner_build_pay_period", {
    p_name: text(formData, "name"),
    p_start: start,
    p_end: end,
  });
  if (error) console.error("pay period creation failed", error.message);
  refresh();
}

export async function markPayPeriodPaid(formData: FormData) {
  const periodId = text(formData, "periodId");
  if (!periodId) return;
  const { supabase } = await requireOwner();
  const { error } = await supabase.rpc("owner_mark_pay_period_paid", { p_period: periodId });
  if (error) console.error("pay period payment failed", error.message);
  refresh();
}
