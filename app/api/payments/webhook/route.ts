import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveSupabaseUrl } from "@/lib/supabase/config";

export const runtime = "nodejs";

const SIGNATURE_TOLERANCE_SECONDS = 300;

type StripeCheckoutSession = {
  id: string;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string | null;
  payment_intent?: string | null;
  payment_method_types?: string[] | null;
  customer_details?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  metadata?: Record<string, string> | null;
};

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: StripeCheckoutSession };
};

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const values = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = values.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = values.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return signatures.some((signature) => secureEqual(expected, signature));
}

function paymentMethod(session: StripeCheckoutSession) {
  const type = session.payment_method_types?.[0] || "other";
  if (type === "card") return "card";
  if (type === "us_bank_account") return "ach";
  if (type.includes("bank")) return "bank_transfer";
  return "other";
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = resolveSupabaseUrl();
  if (!webhookSecret || !supabaseSecret || !supabaseUrl) {
    console.error("Stripe webhook server secrets are not configured");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  if (!verifyStripeSignature(payload, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") return NextResponse.json({ received: true });

  const invoiceId = session.metadata?.invoice_id;
  const repairOrderId = session.metadata?.repair_order_id;
  const portalToken = session.metadata?.portal_token;
  const amount = Number(session.amount_total || 0) / 100;
  if (!invoiceId || !repairOrderId || !portalToken || amount <= 0) {
    console.error("Stripe checkout session is missing NW Star metadata", session.id);
    return NextResponse.json({ error: "Missing payment metadata." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const providerReference = session.payment_intent || session.id;
  const { data: existingPayment, error: lookupError } = await supabase
    .from("payments")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_reference", providerReference)
    .maybeSingle();

  if (lookupError) {
    console.error("Stripe payment lookup failed", lookupError.message);
    return NextResponse.json({ error: "Payment lookup failed." }, { status: 500 });
  }

  if (!existingPayment) {
    const { error: paymentError } = await supabase.from("payments").insert({
      invoice_id: invoiceId,
      amount,
      method: paymentMethod(session),
      status: "succeeded",
      provider: "stripe",
      provider_reference: providerReference,
      notes: `Stripe Checkout ${session.id}`,
      received_at: new Date(event.created * 1000).toISOString(),
    });

    if (paymentError) {
      console.error("Stripe payment reconciliation failed", paymentError.message);
      return NextResponse.json({ error: "Payment reconciliation failed." }, { status: 500 });
    }

    const [{ data: portalLink }, actorName, actorContact] = await Promise.all([
      supabase.from("customer_portal_links").select("id").eq("token", portalToken).maybeSingle(),
      Promise.resolve(session.customer_details?.name || null),
      Promise.resolve(session.customer_details?.email || session.customer_details?.phone || null),
    ]);

    const { error: eventError } = await supabase.from("customer_portal_events").insert({
      repair_order_id: repairOrderId,
      portal_link_id: portalLink?.id || null,
      invoice_id: invoiceId,
      event_type: "payment_succeeded",
      actor_type: "customer",
      actor_name: actorName,
      actor_contact: actorContact,
      channel: "web",
      metadata: {
        stripe_event_id: event.id,
        checkout_session_id: session.id,
        provider_reference: providerReference,
        amount,
        currency: session.currency || "usd",
      },
    });
    if (eventError) console.error("Payment portal event logging failed", eventError.message);
  }

  return NextResponse.json({ received: true });
}
