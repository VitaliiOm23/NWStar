import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireOwner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const userEmail = user.email?.trim().toLowerCase();

  if (!ownerEmail) {
    throw new Error("OWNER_EMAIL is not configured.");
  }

  if (!userEmail || userEmail !== ownerEmail) {
    await supabase.auth.signOut();
    redirect("/login?error=This%20account%20is%20not%20authorized.");
  }

  return { supabase, user };
}
