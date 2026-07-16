import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30),
  email: z.union([z.string().trim().email().max(160), z.literal("")]).optional(),
  companyName: z.string().trim().max(120).optional().default(""),
  year: z.union([z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1), z.literal("")]).optional(),
  make: z.string().trim().min(2).max(60),
  model: z.string().trim().min(1).max(80),
  vin: z.union([z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/), z.literal("")]).optional(),
  mileage: z.union([z.coerce.number().int().min(0).max(3000000), z.literal("")]).optional(),
  unitNumber: z.string().trim().max(40).optional().default(""),
  serviceLocation: z.string().trim().min(2).max(240),
  preferredTime: z.string().trim().max(120).optional().default(""),
  urgency: z.enum(["normal", "vehicle-down", "fleet-priority"]),
  complaint: z.string().trim().min(10).max(4000),
  knownCodes: z.string().trim().max(2000).optional().default(""),
  priorWork: z.string().trim().max(3000).optional().default(""),
  website: z.string().max(0).optional().default(""),
  consent: z.literal("yes"),
});

const attempts = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((time) => now - time < 15 * 60 * 1000);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > 5;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the required fields and vehicle information." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Service intake is not configured yet." }, { status: 503 });

  const data = parsed.data;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: result, error } = await supabase.rpc("submit_service_request", {
    p_full_name: data.fullName,
    p_phone: data.phone,
    p_email: data.email || null,
    p_company_name: data.companyName || null,
    p_year: data.year === "" || data.year === undefined ? null : data.year,
    p_make: data.make,
    p_model: data.model,
    p_vin: data.vin || null,
    p_mileage: data.mileage === "" || data.mileage === undefined ? null : data.mileage,
    p_unit_number: data.unitNumber || null,
    p_complaint: data.complaint,
    p_known_codes: data.knownCodes || null,
    p_prior_work: data.priorWork || null,
    p_service_location: data.serviceLocation,
    p_preferred_time: data.preferredTime || null,
    p_urgency: data.urgency,
  });

  if (error) {
    console.error("service request submission failed", error.message);
    return NextResponse.json({ error: "The request could not be saved. Please call or try again shortly." }, { status: 500 });
  }

  return NextResponse.json({ reference: result });
}
