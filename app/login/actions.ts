"use server";

import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getSupabasePublicKeyCandidates,
  isInvalidApiKeyError,
} from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/login?error=Enter%20your%20email%20and%20password.");
  }

  const keys = getSupabasePublicKeyCandidates();

  if (keys.length === 0) {
    redirect("/login?error=Owner%20login%20is%20not%20configured%20with%20a%20Supabase%20public%20API%20key.");
  }

  for (const key of keys) {
    let errorMessage: string | null = null;

    try {
      const supabase = await createSupabaseServerClient(key);
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (!error) {
        redirect("/admin");
      }

      if (isInvalidApiKeyError(error)) {
        continue;
      }

      errorMessage = error.message || "Unknown Supabase authentication error";
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Unknown server configuration error";
    }

    if (errorMessage) {
      const normalized = errorMessage.toLowerCase();

      if (normalized.includes("email not confirmed")) {
        redirect("/login?error=Your%20owner%20email%20has%20not%20been%20confirmed%20in%20Supabase.");
      }

      if (normalized.includes("invalid login credentials")) {
        redirect("/login?error=Invalid%20email%20or%20password.");
      }

      redirect(`/login?error=Supabase%20Auth%3A%20${encodeURIComponent(errorMessage)}`);
    }
  }

  redirect(
    "/login?error=Supabase%20rejected%20every%20public%20API%20key%20available%20to%20this%20deployment.%20The%20Vercel%20key%20must%20come%20from%20this%20Supabase%20project."
  );
}
