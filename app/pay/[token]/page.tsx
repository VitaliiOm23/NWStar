import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/PublicShell";
import { loadCustomerPortal, money, titleCase } from "@/lib/customer-portal";

export const metadata = {
  title: "Pay Invoice | NW Star Diagnostics",
  robots: { index: false, follow: false },
};

export default async function PayInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await loadCustomerPortal(token);
  if (!portal) notFound();

  const { invoice, repair_order: ro, vehicle, customer } = portal;
  if (!invoice) {
    return (
      <PublicShell eyebrow={`${ro.ro_number} · Payment`} title="Invoice not ready yet." intro="The repair order is available, but an invoice has not been issued yet.">
        <section className="section customer-portal-section"><div className="shell payment-shell"><Link className="button secondary" href={`/customer/${token}`}>Back to repair order</Link></div></section>
      </PublicShell>
    );
  }

  const balance = Number(invoice.balance_due || 0);
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const externalReady = Boolean(invoice.hosted_payment_url);
  const vehicleName = `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim();

  return (
    <PublicShell
      eyebrow={`${invoice.invoice_number} · Secure payment`}
      title={balance > 0 ? `Balance due ${money(balance)}` : "Invoice paid."}
      intro={`${customer.full_name} · ${vehicleName} · ${titleCase(invoice.status)}`}
    >
      <section className="section customer-portal-section">
        <div className="shell payment-shell">
          <article className="payment-card">
            <div className="payment-invoice-head">
              <div>
                <span>Invoice</span>
                <strong>{invoice.invoice_number}</strong>
                <p>Repair order {ro.ro_number}</p>
              </div>
              <div className="payment-balance"><span>Balance due</span><strong>{money(balance)}</strong></div>
            </div>

            <div className="payment-breakdown">
              <span>Subtotal <strong>{money(invoice.subtotal)}</strong></span>
              <span>Tax <strong>{money(invoice.tax_amount)}</strong></span>
              <span>Total <strong>{money(invoice.total)}</strong></span>
              <span>Already paid <strong>{money(invoice.amount_paid)}</strong></span>
            </div>

            {invoice.customer_note ? <p className="portal-muted">{invoice.customer_note}</p> : null}

            {balance <= 0 ? (
              <div className="portal-notice success-panel">This invoice has no balance due.</div>
            ) : stripeReady ? (
              <form action="/api/payments/checkout" method="post" className="payment-action-form">
                <input type="hidden" name="token" value={token} />
                <button className="button" type="submit">Pay {money(balance)} securely</button>
                <p>Card payment is processed by Stripe. NW Star Diagnostics does not receive or store your full card number.</p>
              </form>
            ) : externalReady ? (
              <div className="payment-action-form">
                <a className="button" href={invoice.hosted_payment_url || "#"} rel="noreferrer">Continue to secure payment</a>
                <p>Payment opens the secure checkout link attached to this invoice.</p>
              </div>
            ) : (
              <div className="portal-notice">
                Online payment is not enabled for this invoice yet. Contact NW Star Diagnostics for payment instructions.
              </div>
            )}

            <div className="payment-footer-actions">
              <Link className="button secondary" href={`/customer/${token}`}>Back to repair order</Link>
            </div>
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
