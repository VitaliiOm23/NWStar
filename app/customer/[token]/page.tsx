import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/PublicShell";
import { loadCustomerPortal, money, titleCase } from "@/lib/customer-portal";
import { decideCustomerJob } from "./actions";

export const metadata = {
  title: "Repair Order Review | NW Star Diagnostics",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function CustomerRepairOrderPage({ params, searchParams }: PageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const portal = await loadCustomerPortal(token);
  if (!portal) notFound();

  const { repair_order: ro, customer, vehicle, jobs, estimate, invoice } = portal;
  const vehicleName = `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim();
  const pendingJobs = jobs.filter((job) => job.authorization_status === "pending").length;
  const approvedJobs = jobs.filter((job) => ["approved", "completed"].includes(job.authorization_status)).length;
  const deferredJobs = jobs.filter((job) => ["deferred", "declined"].includes(job.authorization_status)).length;

  return (
    <PublicShell
      eyebrow={`${ro.ro_number} · Customer review`}
      title={vehicleName}
      intro={`Review the findings and recommendations for ${customer.full_name}. Each line can be approved or deferred separately, and every decision is saved to the repair order.`}
    >
      <section className="section customer-portal-section">
        <div className="shell customer-portal-shell">
          {query.saved ? (
            <div className="portal-notice success-panel" role="status">
              Decision saved: {titleCase(query.saved)}. The repair order has been updated.
            </div>
          ) : null}
          {query.error ? (
            <div className="portal-notice form-error" role="alert">
              The decision could not be saved. Please review the form or contact NW Star Diagnostics.
            </div>
          ) : null}

          <div className="customer-summary-grid">
            <article className="portal-summary-card">
              <span>Repair order</span>
              <strong>{ro.ro_number}</strong>
              <p>Status: {titleCase(ro.status)}</p>
              <p>Opened: {dateLabel(ro.opened_at)}</p>
            </article>
            <article className="portal-summary-card">
              <span>Vehicle</span>
              <strong>{vehicleName}</strong>
              <p>VIN: {vehicle.vin || "—"}</p>
              <p>Mileage: {ro.odometer_in || vehicle.mileage || "—"}</p>
            </article>
            <article className="portal-summary-card">
              <span>Decisions</span>
              <strong>{approvedJobs} approved</strong>
              <p>{pendingJobs} pending · {deferredJobs} deferred</p>
              <p>{estimate ? `Estimate ${estimate.estimate_number}` : "Estimate not issued yet"}</p>
            </article>
            <article className="portal-summary-card financial-card">
              <span>Current amount</span>
              <strong>{invoice ? money(invoice.balance_due) : estimate ? money(estimate.total) : "Pending"}</strong>
              <p>{invoice ? `Invoice ${invoice.invoice_number}` : "Based on the latest estimate"}</p>
              {invoice && Number(invoice.balance_due) > 0 ? (
                <Link className="button" href={`/pay/${token}`}>Pay invoice</Link>
              ) : null}
            </article>
          </div>

          <article className="portal-complaint-card">
            <span>Original complaint</span>
            <p>{ro.original_complaint}</p>
          </article>

          {estimate?.customer_note ? (
            <article className="portal-complaint-card">
              <span>Estimate note</span>
              <p>{estimate.customer_note}</p>
            </article>
          ) : null}

          <div className="portal-section-heading">
            <div>
              <div className="eyebrow">Recommendations</div>
              <h2>Review each repair-order line.</h2>
            </div>
            <p>Approve only the work you want performed now. Deferred lines stay on the vehicle record for future follow-up.</p>
          </div>

          <div className="customer-job-list">
            {jobs.map((job) => {
              const locked = job.authorization_status === "completed";
              const decided = job.authorization_status !== "pending";
              return (
                <article className="customer-job-card" key={job.id}>
                  <header className="customer-job-header">
                    <div>
                      <div className="line-number">Line {job.line_number}</div>
                      <h3>{job.title}</h3>
                    </div>
                    <div className="customer-line-total">
                      <strong>{money(job.amount)}</strong>
                      <span className={`portal-status status-${job.authorization_status}`}>
                        {titleCase(job.authorization_status)}
                      </span>
                    </div>
                  </header>

                  <div className="customer-story-grid">
                    <div><span>Customer concern</span><p>{job.customer_concern}</p></div>
                    <div><span>Technician findings</span><p>{job.technician_findings || "Findings have not been entered yet."}</p></div>
                    <div><span>Recommendation</span><p>{job.recommended_action || "Recommendation has not been entered yet."}</p></div>
                    {job.correction_performed ? <div><span>Work performed</span><p>{job.correction_performed}</p></div> : null}
                  </div>

                  <div className="customer-items-block">
                    <div className="customer-items-heading">
                      <strong>Parts, labor and charges</strong>
                      <span>{money(job.amount)}</span>
                    </div>
                    {job.items.length ? (
                      <div className="customer-items-list">
                        {job.items.map((item) => (
                          <div className="customer-item-row" key={item.id}>
                            <div>
                              <span>{titleCase(item.item_type)}</span>
                              <strong>{item.description}</strong>
                              {item.part_number ? <small>Part # {item.part_number}{item.part_condition ? ` · ${item.part_condition}` : ""}</small> : null}
                            </div>
                            <div className="customer-item-price">
                              <span>{Number(item.quantity)} × {money(item.unit_price)}</span>
                              <strong>{money(item.extended)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="portal-muted">Pricing/parts have not been added to this line yet.</p>
                    )}
                  </div>

                  {locked ? (
                    <div className="portal-locked">This line is completed and its authorization is locked.</div>
                  ) : (
                    <form action={decideCustomerJob} className="customer-decision-form">
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="jobId" value={job.id} />
                      <div className="field">
                        <label htmlFor={`name-${job.id}`}>Name confirming decision *</label>
                        <input id={`name-${job.id}`} name="name" required minLength={2} maxLength={100} defaultValue={customer.full_name} />
                      </div>
                      <div className="field">
                        <label htmlFor={`contact-${job.id}`}>Phone or email</label>
                        <input id={`contact-${job.id}`} name="contact" maxLength={160} defaultValue={customer.phone || customer.email || ""} />
                      </div>
                      <div className="field full">
                        <label htmlFor={`note-${job.id}`}>Note {decided ? "or reason for changing the decision" : "(optional)"}</label>
                        <textarea id={`note-${job.id}`} name="note" maxLength={1000} defaultValue={job.deferred_reason || ""} />
                      </div>
                      <div className="customer-decision-actions">
                        <button className="button" type="submit" name="decision" value="approved">Approve line</button>
                        <button className="button secondary" type="submit" name="decision" value="deferred">Defer line</button>
                      </div>
                      <p className="authorization-copy">Submitting records your name, decision, time, line number and current line amount on this repair order.</p>
                    </form>
                  )}
                </article>
              );
            })}
          </div>

          {invoice ? (
            <section className="portal-invoice-summary">
              <div>
                <div className="eyebrow">Invoice</div>
                <h2>{invoice.invoice_number}</h2>
                <p>{invoice.customer_note || "Payment history and balance are retained with this repair order."}</p>
              </div>
              <div className="portal-invoice-numbers">
                <span>Subtotal <strong>{money(invoice.subtotal)}</strong></span>
                <span>Tax <strong>{money(invoice.tax_amount)}</strong></span>
                <span>Paid <strong>{money(invoice.amount_paid)}</strong></span>
                <span className="balance">Balance due <strong>{money(invoice.balance_due)}</strong></span>
                {Number(invoice.balance_due) > 0 ? <Link className="button" href={`/pay/${token}`}>Open payment page</Link> : null}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </PublicShell>
  );
}
