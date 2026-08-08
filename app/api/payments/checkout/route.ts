import { NextRequest, NextResponse } from "next/server";
import { isPortalToken, loadCustomerPortal } from "@/lib/customer-portal";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const token = String(formData.get("token") || "").trim();
  if (!isPortalToken(token)) return NextResponse.json({ error: "Invalid payment link." }, { status: 400 });

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) return NextResponse.json({ error: "Card payment is not configured." }, { status: 503 });

  const portal = await loadCustomerPortal(token);
  if (!portal?.invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const { invoice, repair_order: ro, customer } = portal;
  const balanceCents = Math.round(Number(invoice.balance_due || 0) * 100);
  if (balanceCents <= 0) return NextResponse.redirect(new URL(`/pay/${token}`, request.url), 303);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${origin}/pay/${token}?paid=1&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${origin}/pay/${token}?cancelled=1`);
  body.set("client_reference_id", invoice.id);
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(balanceCents));
  body.set("line_items[0][price_data][product_data][name]", `NW Star Diagnostics · ${invoice.invoice_number}`);
  body.set("line_items[0][price_data][product_data][description]", `Repair order ${ro.ro_number}`);
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[invoice_id]", invoice.id);
  body.set("metadata[repair_order_id]", ro.id);
  body.set("metadata[portal_token]", token);
  if (customer.email) body.set("customer_email", customer.email);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const session = (await stripeResponse.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!stripeResponse.ok || !session.url) {
    console.error("Stripe Checkout session creation failed", session.error?.message || stripeResponse.statusText);
    return NextResponse.json({ error: "Unable to start secure checkout." }, { status: 502 });
  }

  return NextResponse.redirect(session.url, 303);
}
