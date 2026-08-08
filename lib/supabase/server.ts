import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

const FALLBACK_SUPABASE_URL = "https://vmahxncctgjqvlabplpy.supabase.co";

function isValidHttpUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getSupabaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return isValidHttpUrl(configuredUrl)
    ? (configuredUrl as string)
    : FALLBACK_SUPABASE_URL;
}

export function getSupabasePublicKeyCandidates() {
  const candidates = [
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
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
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
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

  if (keys.length === 0) {
    throw new Error("No Supabase public API key is configured.");
  }

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

  throw new Error("Supabase rejected every configured public API key.");
}
