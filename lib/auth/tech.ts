import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireTech() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: isOwner, error: ownerError } = await supabase.rpc("is_owner");
  if (ownerError) {
    console.error("technician owner authorization check failed", ownerError.message);
  }

  if (isOwner) {
    return { supabase, user, role: "owner" as const, displayName: user.email || "Owner" };
  }

  const { data: tech, error: techError } = await supabase
    .from("tech_users")
    .select("display_name,active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (techError || !tech?.active) {
    if (techError) console.error("technician authorization check failed", techError.message);
    await supabase.auth.signOut();
    redirect("/login?error=This%20account%20is%20not%20authorized%20for%20technician%20access.");
  }

  return {
    supabase,
    user,
    role: "tech" as const,
    displayName: tech.display_name || user.email || "Technician",
  };
}
