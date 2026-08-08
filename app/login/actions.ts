"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/login?error=Enter%20your%20email%20and%20password.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !authData.user) {
    const message = encodeURIComponent(error?.message || "Unknown Supabase authentication error");
    redirect(`/login?error=Supabase%20Auth%3A%20${message}`);
  }

  const { data: isOwner } = await supabase.rpc("is_owner");
  if (isOwner) redirect("/admin");

  const { data: tech } = await supabase
    .from("tech_users")
    .select("active")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (tech?.active) redirect("/tech");

  await supabase.auth.signOut();
  redirect("/login?error=This%20account%20is%20not%20authorized%20for%20owner%20or%20technician%20access.");
}
