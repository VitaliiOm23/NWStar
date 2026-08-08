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

function getSupabaseConfig() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const url = isValidHttpUrl(configuredUrl)
    ? (configuredUrl as string)
    : FALLBACK_SUPABASE_URL;

  // Prefer the legacy anon key when both are present. The current Vercel
  // publishable-key value is being rejected by this Supabase project, while
  // an existing anon key may still be valid during the key migration.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!key) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return { url, key };
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();

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
