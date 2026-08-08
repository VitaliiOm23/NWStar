import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

const SUPABASE_PROJECT_URL = "https://hloycmcsdcxgzsvbnvif.supabase.co";
const SUPABASE_PROJECT_PUBLISHABLE_KEY = "sb_publishable_boVylxX5khHOhOutEL_9Aw_S0qmDAZa";

export function getSupabaseUrl() {
  return SUPABASE_PROJECT_URL;
}

export function getSupabasePublicKeyCandidates() {
  const candidates = [
    SUPABASE_PROJECT_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

export function isInvalidApiKeyError(error: { message?: string } | null | undefined) {
  return Boolean(error?.message?.toLowerCase().includes("invalid api key"));
}

export async function createSupabaseServerClient(keyOverride?: string) {
  const cookieStore = await cookies();
  const url = getSupabaseUrl();
  const key = keyOverride?.trim() || getSupabasePublicKeyCandidates()[0];

  if (!key) {
    throw new Error("Supabase public API key is unavailable.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies.
        }
      },
    },
  });
}

export async function getWorkingSupabaseServerClient() {
  const keys = getSupabasePublicKeyCandidates();

  for (const key of keys) {
    const supabase = await createSupabaseServerClient(key);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (isInvalidApiKeyError(error)) {
      continue;
    }

    return { supabase, user, authError: error };
  }

  throw new Error("Supabase rejected every available public API key.");
}
