"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/login?error=Enter%20your%20email%20and%20password.");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const message = encodeURIComponent(error.message || "Unknown Supabase authentication error");
      redirect(`/login?error=Supabase%20Auth%3A%20${message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server configuration error";
    redirect(`/login?error=Server%20configuration%3A%20${encodeURIComponent(message)}`);
  }

  redirect("/admin");
}
