import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireTech() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: isOwner, error: ownerError }, { data: worker, error: workerError }] = await Promise.all([
    supabase.rpc("is_owner"),
    supabase
      .from("workers")
      .select("id,display_name,worker_type,active,compensation_method,compensation_rate")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (ownerError) console.error("technician owner authorization check failed", ownerError.message);
  if (workerError) console.error("worker profile lookup failed", workerError.message);

  if (isOwner) {
    return {
      supabase,
      user,
      role: "owner" as const,
      workerId: worker?.id || null,
      displayName: worker?.display_name || user.email || "Owner",
    };
  }

  const { data: tech, error: techError } = await supabase
    .from("tech_users")
    .select("display_name,active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (techError || !tech?.active || !worker?.active) {
    if (techError) console.error("technician authorization check failed", techError.message);
    await supabase.auth.signOut();
    redirect("/login?error=This%20account%20is%20not%20authorized%20for%20technician%20access.");
  }

  return {
    supabase,
    user,
    role: "tech" as const,
    workerId: worker.id,
    displayName: worker.display_name || tech.display_name || user.email || "Technician",
  };
}
