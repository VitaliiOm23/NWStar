import { redirect } from "next/navigation";
import { getWorkingSupabaseServerClient } from "@/lib/supabase/server";

export async function requireOwner() {
  let session:
    | Awaited<ReturnType<typeof getWorkingSupabaseServerClient>>
    | null = null;

  try {
    session = await getWorkingSupabaseServerClient();
  } catch (error) {
    console.error(
      "Supabase owner client setup failed",
      error instanceof Error ? error.message : error
    );
    redirect(
      "/login?error=Supabase%20configuration%20is%20not%20valid%20for%20owner%20access."
    );
  }

  const { supabase, user } = session;

  if (!user) {
    redirect("/login");
  }

  const { data: isOwner, error } = await supabase.rpc("is_owner");

  if (error) {
    console.error("owner authorization check failed", error.message);
    await supabase.auth.signOut();
    redirect(
      "/login?error=Owner%20access%20is%20not%20configured%20in%20the%20database."
    );
  }

  if (!isOwner) {
    await supabase.auth.signOut();
    redirect(
      "/login?error=This%20account%20is%20not%20authorized%20for%20owner%20access."
    );
  }

  return { supabase, user };
}
