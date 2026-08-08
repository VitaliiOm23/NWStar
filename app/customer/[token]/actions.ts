"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createPublicSupabaseClient, isPortalToken } from "@/lib/customer-portal";

function text(formData: FormData, name: string) {
  return String(formData.get(name) || "").trim();
}

export async function decideCustomerJob(formData: FormData) {
  const token = text(formData, "token");
  const jobId = text(formData, "jobId");
  const decision = text(formData, "decision");
  const name = text(formData, "name");
  const contact = text(formData, "contact");
  const note = text(formData, "note");

  if (!isPortalToken(token) || !isPortalToken(jobId)) return;
  if (!new Set(["approved", "deferred"]).has(decision)) return;
  if (name.length < 2) return;

  const supabase = createPublicSupabaseClient();
  if (!supabase) redirect(`/customer/${token}?error=config`);

  const { error } = await supabase.rpc("decide_customer_job", {
    p_token: token,
    p_job_id: jobId,
    p_decision: decision,
    p_name: name,
    p_contact: contact || null,
    p_note: note || null,
  });

  if (error) {
    console.error("customer authorization failed", error.message);
    redirect(`/customer/${token}?error=decision`);
  }

  revalidatePath(`/customer/${token}`);
  redirect(`/customer/${token}?saved=${decision}`);
}
