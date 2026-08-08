import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { requireOwner } from "@/lib/auth/owner";
import { money, titleCase } from "@/lib/customer-portal";
import { createCustomerPortalLink, revokeCustomerPortalLink, rotateCustomerPortalLink } from "./actions";

export const metadata = {
  title: "Customer Links",
  robots: { index: false, follow: false },
};

type RepairOrder = {
  id: string;
  ro_number: string;
  status: string;
  customers: { full_name: string; phone: string; email: string | null } | null;
  vehicles: { year: number | null; make: string; model: string } | null;
};

type PortalLink = {
  id: string;
  token: string;
  active: boolean;
  expires_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
};

type PortalEvent = {
  id: string;
  event_type: string;
  actor_name: string | null;
  actor_contact: string | null;
  channel: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Invoice = {
  invoice_number: string;
  status: string;
  total: number;
  amount_paid: number;
  balance_due: number;
};

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function CustomerWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOwner();

  const [
    { data: roData, error: roError },
    { data: linkData },
    { data: eventData },
    { data: invoiceData },
  ] = await Promise.all([
    supabase
      .from("repair_orders")
      .select("id,ro_number,status,customers(full_name,phone,email),vehicles(year,make,model)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("customer_portal_links")
      .select("id,token,active,expires_at,last_viewed_at,created_at")
      .eq("repair_order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_portal_events")
      .select("id,event_type,actor_name,actor_contact,channel,metadata,created_at")
      .eq("repair_order_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("invoices")
      .select("invoice_number,status,total,amount_paid,balance_due")
      .eq("repair_order_id", id)
      .maybeSingle(),
  ]);

  if (roError || !roData) notFound();

  const ro = roData as unknown as RepairOrder;
  const links = (linkData || []) as PortalLink[];
  const events = (eventData || []) as PortalEvent[];
  const invoice = invoiceData as Invoice | null;
  const activeLink = links.find((link) => link.active && (!link.expires_at || new Date(link.expires_at) > new Date())) || null;
  const customer = ro.customers;
  const vehicle = ro.vehicles;
  const vehicleName = vehicle ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim() : "Vehicle";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://nw-star.vercel.app").replace(/\/$/, "");
  const customerUrl = activeLink ? `${siteUrl}/customer/${activeLink.token}` : "";
  const paymentUrl = activeLink ? `${siteUrl}/pay/${activeLink.token}` : "";
  const message = activeLink
    ? `NW Star Diagnostics: review ${ro.ro_number} for your ${vehicleName}, including recommendations and line-by-line approval: ${customerUrl}`
    : "";
  const paymentMessage = activeLink && invoice
    ? `NW Star Diagnostics: ${invoice.invoice_number} has a balance of ${money(invoice.balance_due)}. Secure payment link: ${paymentUrl}`
    : "";
  const smsHref = customer?.phone && activeLink ? `sms:${customer.phone}?&body=${encodeURIComponent(message)}` : null;
  const mailHref = customer?.email && activeLink
    ? `mailto:${customer.email}?subject=${encodeURIComponent(`${ro.ro_number} recommendations from NW Star Diagnostics`)}&body=${encodeURIComponent(message)}`
    : null;
  const paymentSmsHref = customer?.phone && activeLink && invoice ? `sms:${customer.phone}?&body=${encodeURIComponent(paymentMessage)}` : null;
  const paymentMailHref = customer?.email && activeLink && invoice
    ? `mailto:${customer.email}?subject=${encodeURIComponent(`${invoice.invoice_number} payment link`)}&body=${encodeURIComponent(paymentMessage)}`
    : null;

  return (
    <main className="admin-page customer-workspace-page">
      <div className="shell">
        <header className="admin-header compact-admin-header">
          <div>
            <div className="eyebrow">{ro.ro_number} · Customer workspace</div>
            <h1>{customer?.full_name || "Customer"}</h1>
            <p className="section-copy">Share recommendations, collect line-by-line decisions, send payment, and retain the customer activity trail.</p>
          </div>
          <div className="admin-account-actions">
            <Link className="button secondary" href={`/admin/repair-orders/${ro.id}`}>Open RO</Link>
            <Link className="button secondary" href="/admin/repair-orders">All ROs</Link>
          </div>
        </header>

        <AdminNav current="repair-orders" />

        <section className="share-summary-grid">
          <article className="admin-panel">
            <div className="panel-label">Customer</div>
            <h2>{customer?.full_name || "—"}</h2>
            <p>{customer?.phone || "—"}</p>
            <p>{customer?.email || "—"}</p>
          </article>
          <article className="admin-panel">
            <div className="panel-label">Vehicle / RO</div>
            <h2>{vehicleName}</h2>
            <p>{ro.ro_number}</p>
            <p>{titleCase(ro.status)}</p>
          </article>
          <article className="admin-panel">
            <div className="panel-label">Invoice</div>
            <h2>{invoice ? money(invoice.balance_due) : "Not issued"}</h2>
            <p>{invoice ? `${invoice.invoice_number} · ${titleCase(invoice.status)}` : "Create/sync the invoice from the RO when ready."}</p>
            {invoice ? <p>{money(invoice.amount_paid)} paid of {money(invoice.total)}</p> : null}
          </article>
        </section>

        <section className="admin-panel share-link-panel">
          <div className="ro-section-heading">
            <div>
              <div className="panel-label">Customer review link</div>
              <h2>Recommendations + approvals</h2>
              <p>One private link gives the customer the current RO lines, stories, parts/labor pricing, and Approve/Defer controls.</p>
            </div>
            {activeLink ? <span className="status-pill status-authorized">Active</span> : <span className="status-pill">Not generated</span>}
          </div>

          {!activeLink ? (
            <form action={createCustomerPortalLink}>
              <input type="hidden" name="repairOrderId" value={ro.id} />
              <button className="button" type="submit">Generate customer link</button>
            </form>
          ) : (
            <>
              <div className="share-url-box">
                <code>{customerUrl}</code>
                <CopyLinkButton value={customerUrl} label="Copy customer link" />
              </div>
              <div className="share-actions">
                {smsHref ? <a className="button" href={smsHref}>Text recommendations</a> : null}
                {mailHref ? <a className="button secondary" href={mailHref}>Email recommendations</a> : null}
                <a className="button secondary" href={customerUrl} target="_blank" rel="noreferrer">Preview as customer</a>
              </div>
              <div className="share-meta">
                <span>Created {dateTime(activeLink.created_at)}</span>
                <span>Last opened {dateTime(activeLink.last_viewed_at)}</span>
              </div>
              <div className="share-danger-actions">
                <form action={rotateCustomerPortalLink}>
                  <input type="hidden" name="repairOrderId" value={ro.id} />
                  <button className="button secondary" type="submit">Rotate link</button>
                </form>
                <form action={revokeCustomerPortalLink}>
                  <input type="hidden" name="repairOrderId" value={ro.id} />
                  <input type="hidden" name="linkId" value={activeLink.id} />
                  <button className="button secondary" type="submit">Revoke link</button>
                </form>
              </div>
            </>
          )}
        </section>

        <section className="admin-panel share-link-panel">
          <div className="ro-section-heading">
            <div>
              <div className="panel-label">Payment link</div>
              <h2>Invoice payment</h2>
              <p>The payment page uses the same private customer token but only exposes invoice/payment information for this RO.</p>
            </div>
            {invoice ? <strong>{money(invoice.balance_due)}</strong> : null}
          </div>

          {activeLink && invoice ? (
            <>
              <div className="share-url-box">
                <code>{paymentUrl}</code>
                <CopyLinkButton value={paymentUrl} label="Copy payment link" />
              </div>
              <div className="share-actions">
                {paymentSmsHref ? <a className="button" href={paymentSmsHref}>Text payment link</a> : null}
                {paymentMailHref ? <a className="button secondary" href={paymentMailHref}>Email payment link</a> : null}
                <a className="button secondary" href={paymentUrl} target="_blank" rel="noreferrer">Preview payment page</a>
              </div>
            </>
          ) : (
            <p className="admin-muted">{!activeLink ? "Generate the customer link first." : "Create/sync the invoice from the RO first."}</p>
          )}
        </section>

        <section className="admin-panel">
          <div className="ro-section-heading">
            <div>
              <div className="panel-label">Audit trail</div>
              <h2>Customer activity</h2>
              <p>Portal opens, line decisions, and Stripe payment events are time-stamped here.</p>
            </div>
            <strong>{events.length} events</strong>
          </div>
          <div className="customer-event-list">
            {events.length ? events.map((event) => (
              <div className="customer-event-row" key={event.id}>
                <div>
                  <strong>{titleCase(event.event_type)}</strong>
                  <span>{event.actor_name || "Customer"}{event.actor_contact ? ` · ${event.actor_contact}` : ""}</span>
                </div>
                <div>
                  <span>{event.channel ? titleCase(event.channel) : "Web"}</span>
                  <strong>{dateTime(event.created_at)}</strong>
                </div>
              </div>
            )) : <p className="admin-muted">No customer activity yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
