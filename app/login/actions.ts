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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes("email not confirmed")) {
      redirect("/login?error=Your%20Supabase%20owner%20email%20has%20not%20been%20confirmed.");
    }

    redirect("/login?error=Invalid%20email%20or%20password.%20Use%20the%20owner%20account%20created%20under%20Supabase%20Authentication%20%3E%20Users.");
  }

  redirect("/admin");
}
