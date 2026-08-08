import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "@/lib/supabase/config";

export function createSupabaseAdminClient() {
  const url = resolveSupabaseUrl();
  const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !secret) return null;

  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
