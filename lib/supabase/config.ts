const FALLBACK_SUPABASE_URL = "https://hloycmcsdcxgzsvbnvif.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_boVylxX5khHOhOutEL_9Aw_S0qmDAZa";

function normalizeSupabaseUrl(value?: string | null) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return null;

  if (/^[a-z0-9]{20}$/i.test(raw)) {
    return `https://${raw}.supabase.co`;
  }

  if (/^[a-z0-9-]+\.supabase\.co$/i.test(raw)) {
    return `https://${raw}`;
  }

  try {
    const parsed = new URL(raw);
    if (!new Set(["http:", "https:"]).has(parsed.protocol)) return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function resolveSupabaseUrl(rawValue = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  return normalizeSupabaseUrl(rawValue) || normalizeSupabaseUrl(FALLBACK_SUPABASE_URL);
}

export function getSupabasePublicConfig() {
  const url = resolveSupabaseUrl();
  const key = [
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    FALLBACK_SUPABASE_PUBLISHABLE_KEY,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean);

  return url && key ? { url, key } : null;
}
