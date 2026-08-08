"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeUrlDiagnostic() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "URL missing";

  const trimmed = raw.trim();
  const startsHttps = trimmed.startsWith("https://");
  const startsHttp = trimmed.startsWith("http://");
  const hasOuterQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  const hasLeadingOrTrailingWhitespace = raw !== trimmed;
  const containsEquals = trimmed.includes("=");

  return [
    "URL present",
    `scheme=${startsHttps ? "https" : startsHttp ? "http" : "invalid"}`,
    `outerQuotes=${hasOuterQuotes ? "yes" : "no"}`,
    `edgeWhitespace=${hasLeadingOrTrailingWhitespace ? "yes" : "no"}`,
    `containsEquals=${containsEquals ? "yes" : "no"}`,
  ].join(", ");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/login?error=Enter%20your%20email%20and%20password.");
  }

  let authError: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    authError = error?.message || null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server configuration error";
    const diagnostic = safeUrlDiagnostic();
    redirect(
      `/login?error=Server%20configuration%3A%20${encodeURIComponent(message)}%20%7C%20${encodeURIComponent(diagnostic)}`
    );
  }

  if (authError) {
    redirect(`/login?error=Supabase%20Auth%3A%20${encodeURIComponent(authError)}`);
  }

  redirect("/admin");
}
