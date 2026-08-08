import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const values = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = values.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = values.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
    const actualBuffer = Buffer.from(signature, "hex");
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

type StripeCheckoutSession = {
  id: string;
  payment_status?: string;
  amount_total?: number | null;
  metadata?: {
    invoice_id?: string;
    repair_order_id?: string;
    portal_token?: string;
  };
};

type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: StripeCheckoutSession };
};

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });

  const signature = request.headers.get("stripe-signature") || "";
  const rawBody = await request.text();
  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object;
  const invoiceId = session?.metadata?.invoice_id;
  const repairOrderId = session?.metadata?.repair_order_id;
  const portalToken = session?.metadata?.portal_token;
  const amount = Number(session?.amount_total || 0) / 100;

  if (!session?.id || !invoiceId || !repairOrderId || amount <= 0 || session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: "Database reconciliation is not configured." }, { status: 503 });

  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("provider", "stripe")
    .eq("provider_reference", session.id)
    .maybeSingle();

  if (!existing) {
    const { error: paymentError } = await supabase.from("payments").insert({
      invoice_id: invoiceId,
      amount,
      method: "card",
      status: "succeeded",
      provider: "stripe",
      provider_reference: session.id,
      notes: `Stripe Checkout ${event.type}`,
      received_at: new Date().toISOString(),
    });
    if (paymentError && paymentError.code !== "23505") {
      console.error("Stripe payment recording failed", paymentError.message);
      return NextResponse.json({ error: "Payment reconciliation failed." }, { status: 500 });
    }
  }

  await supabase.from("invoices").update({ payment_provider: "stripe" }).eq("id", invoiceId);

  if (portalToken) {
    const { data: portalLink } = await supabase
      .from("customer_portal_links")
      .select("id")
      .eq("token", portalToken)
      .maybeSingle();

    await supabase.from("customer_portal_events").insert({
      repair_order_id: repairOrderId,
      portal_link_id: portalLink?.id || null,
      invoice_id: invoiceId,
      event_type: "payment_succeeded",
      actor_type: "customer",
      channel: "stripe",
      metadata: { stripe_session_id: session.id, stripe_event_id: event.id, amount },
    });
  }

  return NextResponse.json({ received: true });
}
