import Link from "next/link";
import { notFound } from "next/navigation";
import { BasicDiagnosticButton } from "@/components/BasicDiagnosticButton";
import { RoJobAccordion, RoJobAccordionItem } from "@/components/RoJobAccordion";
import { requireOwner } from "@/lib/auth/owner";
import {
  addRepairOrderJob,
  recordPayment,
  removeJobItem,
  syncInvoice,
  updateLaborRate,
  updateRepairOrder,
} from "../actions";
import { addWorkspaceItem, saveLineAuthorization, saveWorkLine } from "./workspace-actions";

export const metadata = { title: "Repair Order", robots: { index: false, follow: false } };

const roStatuses = ["draft", "awaiting_authorization", "authorized", "in_progress", "waiting_parts", "completed", "invoiced", "paid", "closed", "cancelled"];
const authorizationStatuses = ["pending", "approved", "deferred", "declined"];
const units = ["ea", "set", "kit", "qt", "gal", "L", "mL", "oz", "lb", "ft", "in", "bottle", "tube"];

type RepairOrder = {
  id: string;
  ro_number: string;
  status: string;
  original_complaint: string;
  customer_instructions: string | null;
  estimate_choice: string;
  authorized_limit: number | null;
  estimate_authorization_note: string | null;
  parts_return_requested: boolean;
  odometer_in: number | null;
  odometer_out: number | null;
  promised_at: string | null;
  completed_at: string | null;
  tax_rate: number;
  labor_rate: number;
  shop_supplies_amount: number;
  shop_supplies_taxable: boolean;
  discount_amount: number;
  internal_notes: string | null;
  customers: { id: string; full_name: string; phone: string; email: string | null; company_name: string | null } | null;
  vehicles: { id: string; year: number | null; make: string; model: string; vin: string | null; mileage: number | null; license_plate: string | null; unit_number: string | null } | null;
};

type RoJob = {
  id: string;
  line_number: number;
  title: string;
  customer_concern: string;
  technician_findings: string | null;
  recommended_action: string | null;
  correction_performed: string | null;
  authorization_status: string;
  work_status: string;
  authorized_amount: number | null;
  authorization_method: string | null;
  authorized_by_name: string | null;
  authorized_by_phone: string | null;
  deferred_reason: string | null;
};

type RoItem = {
  id: string;
  ro_job_id: string;
  item_type: string;
  description: string;
  part_number: string | null;
  part_condition: string | null;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  unit_price: number;
  taxable: boolean;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  provider_reference: string | null;
  notes: string | null;
  received_at: string;
};

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function titleCase(value: string | null | undefined) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function dateTimeLocal(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function extended(item: RoItem) {
  const total = Number(item.quantity) * Number(item.unit_price);
  return item.item_type === "discount" ? -Math.abs(total) : total;
}

function qty(value: unknown) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function itemLabel(item: RoItem) {
  return item.item_type === "labor"
    ? `${qty(item.quantity)} hr × ${money(item.unit_price)}`
    : `${qty(item.quantity)} ${item.unit || "ea"} × ${money(item.unit_price)}`;
}

export default async function RepairOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOwner();

  const [{ data: roData, error: roError }, { data: jobsData }, { data: invoiceData }] = await Promise.all([
    supabase
      .from("repair_orders")
      .select("id,ro_number,status,original_complaint,customer_instructions,estimate_choice,authorized_limit,estimate_authorization_note,parts_return_requested,odometer_in,odometer_out,promised_at,completed_at,tax_rate,labor_rate,shop_supplies_amount,shop_supplies_taxable,discount_amount,internal_notes,customers(id,full_name,phone,email,company_name),vehicles(id,year,make,model,vin,mileage,license_plate,unit_number)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("ro_jobs")
      .select("id,line_number,title,customer_concern,technician_findings,recommended_action,correction_performed,authorization_status,work_status,authorized_amount,authorization_method,authorized_by_name,authorized_by_phone,deferred_reason")
      .eq("repair_order_id", id)
      .order("line_number"),
    supabase.from("invoices").select("id,invoice_number,status,subtotal,tax_amount,total,amount_paid,balance_due").eq("repair_order_id", id).maybeSingle(),
  ]);

  if (roError || !roData) notFound();

  const ro = roData as unknown as RepairOrder;
  const jobs = (jobsData || []) as RoJob[];
  const invoice = invoiceData as Invoice | null;
  const jobIds = jobs.map((job) => job.id);

  const [{ data: itemsData }, { data: paymentsData }] = await Promise.all([
    jobIds.length
      ? supabase.from("ro_items").select("id,ro_job_id,item_type,description,part_number,part_condition,quantity,unit,unit_cost,unit_price,taxable").in("ro_job_id", jobIds).order("created_at")
      : Promise.resolve({ data: [] }),
    invoice
      ? supabase.from("payments").select("id,amount,method,status,provider_reference,notes,received_at").eq("invoice_id", invoice.id).order("received_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const items = (itemsData || []) as RoItem[];
  const payments = (paymentsData || []) as Payment[];
  const itemsByJob = new Map<string, RoItem[]>();
  items.forEach((item) => itemsByJob.set(item.ro_job_id, [...(itemsByJob.get(item.ro_job_id) || []), item]));

  const jobTotals = new Map<string, { subtotal: number; taxable: number }>();
  jobs.forEach((job) => {
    const jobItems = itemsByJob.get(job.id) || [];
    jobTotals.set(job.id, {
      subtotal: jobItems.reduce((sum, item) => sum + extended(item), 0),
      taxable: jobItems.reduce((sum, item) => sum + (item.taxable ? extended(item) : 0), 0),
    });
  });

  const estimateBeforeTax = jobs.reduce((sum, job) => sum + (jobTotals.get(job.id)?.subtotal || 0), 0) + Number(ro.shop_supplies_amount || 0) - Number(ro.discount_amount || 0);
  const approvedJobs = jobs.filter((job) => ["approved", "completed"].includes(job.authorization_status));
  const approvedSubtotal = approvedJobs.reduce((sum, job) => sum + (jobTotals.get(job.id)?.subtotal || 0), 0) + Number(ro.shop_supplies_amount || 0) - Number(ro.discount_amount || 0);
  const approvedTaxable = approvedJobs.reduce((sum, job) => sum + (jobTotals.get(job.id)?.taxable || 0), 0) + (ro.shop_supplies_taxable ? Number(ro.shop_supplies_amount || 0) : 0);
  const approvedTotal = approvedSubtotal + approvedTaxable * Number(ro.tax_rate || 0);
  const basicDiagnosticAdded = items.some((item) => item.item_type === "labor" && item.description === "Basic diagnostic");

  const customer = ro.customers;
  const vehicle = ro.vehicles;
  const vehicleName = vehicle ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim() : "Vehicle unavailable";

  return (
    <main className="admin-page ro-simple-page">
      <div className="shell ro-simple-shell">
        <header className="ro-simple-header">
          <div className="ro-simple-title">
            <Link href="/admin/repair-orders">← Repair orders</Link>
            <span>{ro.ro_number}</span>
            <h1>{vehicleName}</h1>
            <p>{customer?.full_name || "Unknown customer"}{customer?.company_name ? ` · ${customer.company_name}` : ""}</p>
          </div>
          <div className="ro-simple-header-actions">
            <span className={`status-pill status-${ro.status}`}>{titleCase(ro.status)}</span>
            <Link className="button ro-customer-primary" href={`/admin/repair-orders/${id}/customer`}>
              Customer Portal
              <small>Send approval / payment</small>
            </Link>
            <details className="ro-more-menu">
              <summary>More</summary>
              <div>
                <Link href={`/admin/repair-orders/${id}/team`}>Team & Parts</Link>
                <Link href={`/admin/repair-orders/${id}/print`} target="_blank">Print RO</Link>
              </div>
            </details>
          </div>
        </header>

        <section className="ro-simple-summary">
          <div className="complaint"><span>Customer complaint</span><strong>{ro.original_complaint || "No complaint entered"}</strong></div>
          <div><span>RO total</span><strong>{money(estimateBeforeTax)}</strong></div>
          <div><span>Approved</span><strong>{money(approvedTotal)}</strong></div>
          <div><span>Balance</span><strong>{invoice ? money(invoice.balance_due) : "—"}</strong></div>
        </section>

        <section className="ro-jobs-section">
          <div className="ro-jobs-heading">
            <div><span>Work</span><h2>Jobs</h2><p>Click a job to open it. Opening another job closes the first one.</p></div>
            <div className="ro-jobs-heading-actions">
              <BasicDiagnosticButton repairOrderId={id} rate={Number(ro.labor_rate || 100)} added={basicDiagnosticAdded} />
              <details className="ro-add-job">
                <summary>+ Add Job</summary>
                <form action={addRepairOrderJob}>
                  <input type="hidden" name="repairOrderId" value={id} />
                  <label>Job name<input name="title" placeholder="Diagnose no-start" /></label>
                  <label>Concern<textarea name="customerConcern" placeholder="What does the customer want checked or repaired?" /></label>
                  <button className="button" type="submit">Add Job</button>
                </form>
              </details>
            </div>
          </div>

          {jobs.length ? (
            <RoJobAccordion>
              <div className="ro-job-accordion-list">
                {jobs.map((job) => {
                  const jobItems = itemsByJob.get(job.id) || [];
                  const total = jobTotals.get(job.id)?.subtotal || 0;
                  return (
                    <RoJobAccordionItem
                      key={job.id}
                      id={job.id}
                      summary={
                        <>
                          <div className="ro-job-summary-number">{job.line_number}</div>
                          <div className="ro-job-summary-main">
                            <strong>{job.title || "Untitled job"}</strong>
                            <span>{job.customer_concern || "No concern entered"}</span>
                          </div>
                          <div className="ro-job-summary-status">
                            <span>{titleCase(job.work_status || "new")}</span>
                            <span className={`status-pill status-${job.authorization_status}`}>{titleCase(job.authorization_status)}</span>
                          </div>
                          <b>{money(total)}</b>
                        </>
                      }
                    >
                      <div className="ro-job-edit-layout">
                        <section className="ro-job-main-edit">
                          <form action={saveWorkLine} className="ro-job-work-form">
                            <input type="hidden" name="repairOrderId" value={id} />
                            <input type="hidden" name="jobId" value={job.id} />
                            <div className="ro-job-basic-fields">
                              <label>Job name<input name="title" defaultValue={job.title} /></label>
                              <label>Customer concern<textarea name="customerConcern" defaultValue={job.customer_concern} /></label>
                            </div>
                            <div className="ro-job-story-fields">
                              <label><span>1 · Findings / cause</span><textarea name="technicianFindings" defaultValue={job.technician_findings || ""} placeholder="What did you find?" /></label>
                              <label><span>2 · Recommendation</span><textarea name="recommendedAction" defaultValue={job.recommended_action || ""} placeholder="What should be done?" /></label>
                              <label><span>3 · Work performed</span><textarea name="correctionPerformed" defaultValue={job.correction_performed || ""} placeholder="What was actually completed?" /></label>
                            </div>
                            <div className="ro-inline-save"><button className="button" type="submit">Save Job</button></div>
                          </form>

                          <section className="ro-job-pricing">
                            <header><div><span>4 · Pricing</span><strong>Labor & parts</strong></div><b>{money(total)}</b></header>
                            <div className="ro-job-items-list">
                              {jobItems.map((item) => (
                                <div className="ro-job-item" key={item.id}>
                                  <span>{titleCase(item.item_type)}</span>
                                  <div><strong>{item.description}</strong><small>{itemLabel(item)}{item.part_number ? ` · #${item.part_number}` : ""}</small></div>
                                  <b>{money(extended(item))}</b>
                                  <form action={removeJobItem}>
                                    <input type="hidden" name="repairOrderId" value={id} />
                                    <input type="hidden" name="itemId" value={item.id} />
                                    <button className="text-button danger" type="submit">Remove</button>
                                  </form>
                                </div>
                              ))}
                              {!jobItems.length ? <p className="admin-muted">No labor or parts yet.</p> : null}
                            </div>
                            <div className="ro-job-add-price">
                              <details>
                                <summary>+ Labor</summary>
                                <form action={addWorkspaceItem}>
                                  <input type="hidden" name="repairOrderId" value={id} />
                                  <input type="hidden" name="jobId" value={job.id} />
                                  <input type="hidden" name="itemType" value="labor" />
                                  <label>Description<input name="description" placeholder="Diagnostic labor" /></label>
                                  <label>Hours<input name="quantity" type="number" min="0.1" step="0.1" placeholder="1.0" /></label>
                                  <div className="ro-fixed-rate"><span>Rate</span><strong>{money(ro.labor_rate)}/hr</strong></div>
                                  <button className="button secondary" type="submit">Add</button>
                                </form>
                              </details>
                              <details>
                                <summary>+ Part / charge</summary>
                                <form action={addWorkspaceItem} className="ro-part-quick-form">
                                  <input type="hidden" name="repairOrderId" value={id} />
                                  <input type="hidden" name="jobId" value={job.id} />
                                  <label>Type<select name="itemType" defaultValue="part"><option value="part">Part</option><option value="fee">Fee</option><option value="sublet">Sublet</option><option value="discount">Discount</option></select></label>
                                  <label>Description<input name="description" placeholder="Seal, oil, filter…" /></label>
                                  <label>Qty<input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" /></label>
                                  <label>Unit<select name="unit" defaultValue="ea">{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
                                  <label>Part #<input name="partNumber" /></label>
                                  <label>Unit cost<input name="unitCost" type="number" min="0" step="0.01" /></label>
                                  <label>Customer price<input name="unitPrice" type="number" min="0" step="0.01" /></label>
                                  <label>Condition<select name="partCondition" defaultValue=""><option value="">—</option><option value="new_oem">New OEM</option><option value="new_aftermarket">New aftermarket</option><option value="rebuilt">Rebuilt</option><option value="used">Used</option><option value="customer_supplied">Customer supplied</option></select></label>
                                  <label className="checkbox-label"><input type="checkbox" name="taxable" value="yes" defaultChecked /> Taxable</label>
                                  <button className="button secondary" type="submit">Add</button>
                                </form>
                              </details>
                            </div>
                          </section>
                        </section>

                        <aside className="ro-job-side-edit">
                          <section className="ro-job-approval-box">
                            <div className="ro-job-side-title"><span>Approval</span><strong>{titleCase(job.authorization_status)}</strong></div>
                            <form action={saveLineAuthorization}>
                              <input type="hidden" name="repairOrderId" value={id} />
                              <input type="hidden" name="jobId" value={job.id} />
                              <label>Decision<select name="authorizationStatus" defaultValue={job.authorization_status === "completed" ? "approved" : job.authorization_status}>{authorizationStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
                              <label>Authorized amount<input name="authorizedAmount" type="number" min="0" step="0.01" defaultValue={job.authorized_amount ?? total.toFixed(2)} /></label>
                              <details>
                                <summary>Manual approval details</summary>
                                <label>Method<select name="authorizationMethod" defaultValue={job.authorization_method || ""}><option value="">Not recorded</option><option value="written">Written</option><option value="phone">Phone</option><option value="text">Text</option><option value="email">Email</option><option value="in_person">In person</option><option value="online">Online</option></select></label>
                                <label>Authorized by<input name="authorizedByName" defaultValue={job.authorized_by_name || ""} /></label>
                                <label>Phone<input name="authorizedByPhone" type="tel" defaultValue={job.authorized_by_phone || customer?.phone || ""} /></label>
                                <label>Reason / note<textarea name="deferredReason" defaultValue={job.deferred_reason || ""} /></label>
                                <input type="hidden" name="authorizationNote" value="" />
                              </details>
                              <button className="button secondary" type="submit">Save Approval</button>
                            </form>
                            <Link className="button ro-send-customer" href={`/admin/repair-orders/${id}/customer`}>Send Approval Request</Link>
                          </section>
                          <Link className="ro-team-link" href={`/admin/repair-orders/${id}/team`}>Assignments, time & requested parts →</Link>
                        </aside>
                      </div>
                    </RoJobAccordionItem>
                  );
                })}
              </div>
            </RoJobAccordion>
          ) : (
            <div className="ro-no-jobs">No jobs yet. Add the first job above.</div>
          )}
        </section>

        <section className="ro-secondary-folds">
          <details className="ro-secondary-fold">
            <summary><span>RO Details</span><small>Customer, vehicle, status, timing, tax and notes</small></summary>
            <div className="ro-secondary-body">
              <div className="ro-customer-vehicle-grid">
                <article><span>Customer</span><strong>{customer?.full_name || "—"}</strong><p>{customer?.phone || "—"}<br />{customer?.email || "—"}</p></article>
                <article><span>Vehicle</span><strong>{vehicleName}</strong><p>VIN {vehicle?.vin || "—"}<br />Plate {vehicle?.license_plate || "—"} · Unit {vehicle?.unit_number || "—"}</p></article>
              </div>
              <form action={updateRepairOrder} className="ro-secondary-form">
                <input type="hidden" name="repairOrderId" value={id} />
                <label>Status<select name="status" defaultValue={ro.status}>{roStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
                <label>Promised<input name="promisedAt" type="datetime-local" defaultValue={dateTimeLocal(ro.promised_at)} /></label>
                <label>Odometer in<input name="odometerIn" type="number" min="0" defaultValue={ro.odometer_in ?? ""} /></label>
                <label>Odometer out<input name="odometerOut" type="number" min="0" defaultValue={ro.odometer_out ?? ""} /></label>
                <label>Completed<input name="completedAt" type="datetime-local" defaultValue={dateTimeLocal(ro.completed_at)} /></label>
                <label>Estimate rule<select name="estimateChoice" defaultValue={ro.estimate_choice}><option value="written_estimate">Written estimate</option><option value="authorized_limit">Authorized limit</option><option value="estimate_waived">Estimate waived</option></select></label>
                <label>Authorized limit<input name="authorizedLimit" type="number" min="0" step="0.01" defaultValue={ro.authorized_limit ?? ""} /></label>
                <label>Sales tax %<input name="taxPercent" type="number" min="0" max="100" step="0.001" defaultValue={(Number(ro.tax_rate || 0) * 100).toFixed(3)} /></label>
                <label>Shop supplies<input name="shopSuppliesAmount" type="number" min="0" step="0.01" defaultValue={ro.shop_supplies_amount || 0} /></label>
                <label>RO discount<input name="discountAmount" type="number" min="0" step="0.01" defaultValue={ro.discount_amount || 0} /></label>
                <label className="full">Original complaint<textarea name="originalComplaint" defaultValue={ro.original_complaint} /></label>
                <label className="full">Customer instructions<textarea name="customerInstructions" defaultValue={ro.customer_instructions || ""} /></label>
                <label className="full">Estimate / authorization note<textarea name="estimateAuthorizationNote" defaultValue={ro.estimate_authorization_note || ""} /></label>
                <label className="full">Internal notes<textarea name="internalNotes" defaultValue={ro.internal_notes || ""} /></label>
                <label className="checkbox-label"><input type="checkbox" name="partsReturnRequested" value="yes" defaultChecked={ro.parts_return_requested} /> Return replaced parts</label>
                <label className="checkbox-label"><input type="checkbox" name="shopSuppliesTaxable" value="yes" defaultChecked={ro.shop_supplies_taxable} /> Shop supplies taxable</label>
                <div className="full ro-secondary-save"><button className="button" type="submit">Save RO Details</button></div>
              </form>
              <form action={updateLaborRate} className="ro-labor-rate-inline">
                <input type="hidden" name="repairOrderId" value={id} />
                <label>Labor rate <span>$</span><input name="laborRate" type="number" min="0" step="0.01" defaultValue={Number(ro.labor_rate || 100).toFixed(2)} /><span>/hr</span></label>
                <button className="button secondary" type="submit">Update</button>
              </form>
            </div>
          </details>

          <details className="ro-secondary-fold">
            <summary><span>Billing</span><small>{invoice ? `${invoice.invoice_number} · ${money(invoice.balance_due)} due` : "No invoice yet"}</small></summary>
            <div className="ro-secondary-body ro-billing-simple">
              <div className="ro-billing-numbers">
                <div><span>Approved work</span><strong>{money(approvedTotal)}</strong></div>
                <div><span>Paid</span><strong>{invoice ? money(invoice.amount_paid) : money(0)}</strong></div>
                <div><span>Balance</span><strong>{invoice ? money(invoice.balance_due) : "—"}</strong></div>
              </div>
              <div className="ro-billing-actions">
                <form action={syncInvoice}><input type="hidden" name="repairOrderId" value={id} /><button className="button" type="submit">{invoice ? "Refresh Invoice" : "Create Invoice"}</button></form>
                <Link className="button secondary" href={`/admin/repair-orders/${id}/customer`}>{invoice ? "Send Payment Request" : "Open Customer Portal"}</Link>
              </div>
              {invoice ? (
                <>
                  <div className="ro-invoice-summary-line"><strong>{invoice.invoice_number}</strong><span>{titleCase(invoice.status)}</span><b>{money(invoice.total)}</b></div>
                  <details className="ro-manual-payment">
                    <summary>Record manual payment</summary>
                    <form action={recordPayment}>
                      <input type="hidden" name="repairOrderId" value={id} />
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <input type="hidden" name="status" value="succeeded" />
                      <label>Amount<input name="amount" type="number" min="0.01" step="0.01" /></label>
                      <label>Method<select name="method" defaultValue="cash"><option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="zelle">Zelle</option><option value="ach">ACH</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label>
                      <label>Reference<input name="providerReference" /></label>
                      <label>Notes<input name="notes" /></label>
                      <button className="button secondary" type="submit">Record Payment</button>
                    </form>
                  </details>
                  {payments.length ? <div className="ro-payment-mini-history">{payments.map((payment) => <div key={payment.id}><span>{new Date(payment.received_at).toLocaleDateString("en-US")}</span><strong>{money(payment.amount)} · {titleCase(payment.method)}</strong></div>)}</div> : null}
                </>
              ) : null}
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
