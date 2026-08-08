import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const optionalInteger = (min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "string") {
      const cleaned = value.trim().replace(/[,\s]/g, "");
      if (!cleaned) return undefined;
      if (/^\d+$/.test(cleaned)) return Number(cleaned);
    }
    return value;
  }, z.number().int().min(min).max(max).optional());

const optionalEmail = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z.string().trim().email().max(160).optional());

const optionalVin = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const cleaned = value.trim().toUpperCase().replace(/\s/g, "");
    return cleaned || undefined;
  }
  return value;
}, z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/).optional());

const requestSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30),
  email: optionalEmail,
  companyName: z.string().trim().max(120).optional().default(""),
  year: optionalInteger(1950, new Date().getFullYear() + 1),
  make: z.string().trim().min(2).max(60),
  model: z.string().trim().min(1).max(80),
  vin: optionalVin,
  mileage: optionalInteger(0, 3000000),
  unitNumber: z.string().trim().max(40).optional().default(""),
  serviceLocation: z.string().trim().min(2).max(240),
  preferredTime: z.string().trim().max(120).optional().default(""),
  urgency: z.enum(["normal", "vehicle-down", "fleet-priority"]),
  complaint: z.string().trim().min(1).max(4000),
  knownCodes: z.string().trim().max(2000).optional().default(""),
  priorWork: z.string().trim().max(3000).optional().default(""),
  website: z.string().max(0).optional().default(""),
  consent: z.literal("yes"),
});

function validationMessage(error: z.ZodError) {
  const issue = error.issues[0];
  const field = String(issue?.path?.[0] || "");

  const messages: Record<string, string> = {
    fullName: "Please enter your name.",
    phone: "Please enter a valid phone number with at least 7 digits.",
    email: "Please enter a valid email address or leave it blank.",
    year: `Please enter a valid 4-digit vehicle year between 1950 and ${new Date().getFullYear() + 1}, or leave it blank.`,
    make: "Please enter the vehicle make.",
    model: "Please enter the vehicle model.",
    vin: "VIN is optional. If entered, it must be a valid 17-character VIN.",
    mileage: "Please enter mileage as a number (commas are okay), or leave it blank.",
    serviceLocation: "Please enter the vehicle location.",
    urgency: "Please select the vehicle status.",
    complaint: "Please enter the vehicle concern.",
    consent: "Please check the contact authorization box before submitting.",
    website: "Unable to submit this request.",
  };

  return {
    error: messages[field] || "Please check the highlighted information and try again.",
    field: field || undefined,
  };
}

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
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(validationMessage(parsed.error), { status: 400 });
  }

  const config = getSupabasePublicConfig();
  if (!config) return NextResponse.json({ error: "Service intake is not configured yet." }, { status: 503 });

  const data = parsed.data;
  const supabase = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: result, error } = await supabase.rpc("submit_service_request", {
    p_full_name: data.fullName,
    p_phone: data.phone,
    p_email: data.email || null,
    p_company_name: data.companyName || null,
    p_year: data.year ?? null,
    p_make: data.make,
    p_model: data.model,
    p_vin: data.vin || null,
    p_mileage: data.mileage ?? null,
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
