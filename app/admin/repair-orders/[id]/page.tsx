import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { BasicDiagnosticButton } from "@/components/BasicDiagnosticButton";
import { requireOwner } from "@/lib/auth/owner";
import { signOutOwner } from "../../actions";
import {
  addRepairOrderJob,
  createEstimateSnapshot,
  recordPayment,
  removeJobItem,
  syncInvoice,
  updateEstimate,
  updateInvoicePaymentLink,
  updateLaborRate,
  updateRepairOrder,
} from "../actions";
import { addWorkspaceItem, saveLineAuthorization, saveWorkLine } from "./workspace-actions";

export const metadata = { title: "Repair Order", robots: { index: false, follow: false } };

const roStatuses = ["draft", "awaiting_authorization", "authorized", "in_progress", "waiting_parts", "completed", "invoiced", "paid", "closed", "cancelled"];
const authorizationStatuses = ["pending", "approved", "deferred", "declined"];
const estimateStatuses = ["draft", "sent", "partially_approved", "approved", "declined", "expired"];
const units = ["ea", "set", "kit", "qt", "gal", "L", "mL", "oz", "lb", "ft", "in", "bottle", "tube"];
const views = [
  ["work", "Work"],
  ["details", "RO Details"],
  ["approval", "Approval"],
  ["billing", "Billing"],
] as const;

type View = (typeof views)[number][0];

type RepairOrder = {
  id: string; ro_number: string; status: string; original_complaint: string; customer_instructions: string | null;
  estimate_choice: string; authorized_limit: number | null; estimate_authorization_note: string | null; parts_return_requested: boolean;
  odometer_in: number | null; odometer_out: number | null; promised_at: string | null; completed_at: string | null;
  tax_rate: number; labor_rate: number; shop_supplies_amount: number; shop_supplies_taxable: boolean; discount_amount: number;
  internal_notes: string | null; opened_at: string; updated_at: string;
  customers: { id: string; full_name: string; phone: string; email: string | null; company_name: string | null } | null;
  vehicles: { id: string; year: number | null; make: string; model: string; vin: string | null; mileage: number | null; license_plate: string | null; unit_number: string | null } | null;
};

type RoJob = {
  id: string; repair_order_id: string; line_number: number; title: string; customer_concern: string;
  technician_findings: string | null; recommended_action: string | null; correction_performed: string | null;
  authorization_status: string; work_status: string; authorized_amount: number | null; authorization_method: string | null;
  authorized_by_name: string | null; authorized_by_phone: string | null; authorized_at: string | null; deferred_reason: string | null;
};

type RoItem = {
  id: string; ro_job_id: string; item_type: string; description: string; part_number: string | null; part_condition: string | null;
  quantity: number; unit: string; unit_cost: number | null; unit_price: number; taxable: boolean;
};

type Estimate = {
  id: string; estimate_number: string; version: number; status: string; subtotal: number; taxable_subtotal: number; tax_amount: number; total: number;
  valid_until: string | null; customer_note: string | null; sent_at: string | null; authorized_at: string | null;
  authorization_method: string | null; authorized_by_name: string | null; authorization_note: string | null; created_at: string;
};

type EstimateJob = { estimate_id: string; line_number: number; title: string; description: string | null; amount: number; decision: string };
type Invoice = { id: string; invoice_number: string; status: string; subtotal: number; taxable_subtotal: number; tax_amount: number; total: number; amount_paid: number; balance_due: number; issued_at: string | null; due_at: string | null; payment_provider: string | null; hosted_payment_url: string | null; customer_note: string | null };
type Payment = { id: string; amount: number; method: string; status: string; provider: string | null; provider_reference: string | null; notes: string | null; received_at: string };
type Authorization = { id: string; ro_job_id: string | null; decision: string; authorized_amount: number | null; authorization_method: string; authorized_by_name: string; authorized_by_phone: string | null; employee_name: string | null; notes: string | null; authorized_at: string };

function money(value: unknown) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0)); }
function titleCase(value: string | null | undefined) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()); }
function dateTimeLocal(value: string | null) { if (!value) return ""; const d = new Date(value); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function extended(item: RoItem) { const total = Number(item.quantity) * Number(item.unit_price); return item.item_type === "discount" ? -Math.abs(total) : total; }
function qty(value: unknown) { const n = Number(value || 0); return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""); }
function itemLabel(item: RoItem) { if (item.item_type === "labor") return `${qty(item.quantity)} hr × ${money(item.unit_price)}`; return `${qty(item.quantity)} ${item.unit || "ea"} × ${money(item.unit_price)}`; }

export default async function RepairOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; line?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const requestedView = String(query.view || "work") as View;
  const view: View = views.some(([key]) => key === requestedView) ? requestedView : "work";
  const { supabase, user } = await requireOwner();

  const [{ data: roData, error: roError }, { data: jobsData }, { data: estimatesData }, { data: invoiceData }, { data: authorizationsData }] = await Promise.all([
    supabase.from("repair_orders").select("id,ro_number,status,original_complaint,customer_instructions,estimate_choice,authorized_limit,estimate_authorization_note,parts_return_requested,odometer_in,odometer_out,promised_at,completed_at,tax_rate,labor_rate,shop_supplies_amount,shop_supplies_taxable,discount_amount,internal_notes,opened_at,updated_at,customers(id,full_name,phone,email,company_name),vehicles(id,year,make,model,vin,mileage,license_plate,unit_number)").eq("id", id).maybeSingle(),
    supabase.from("ro_jobs").select("id,repair_order_id,line_number,title,customer_concern,technician_findings,recommended_action,correction_performed,authorization_status,work_status,authorized_amount,authorization_method,authorized_by_name,authorized_by_phone,authorized_at,deferred_reason").eq("repair_order_id", id).order("line_number"),
    supabase.from("estimates").select("*").eq("repair_order_id", id).order("version", { ascending: false }),
    supabase.from("invoices").select("*").eq("repair_order_id", id).maybeSingle(),
    supabase.from("ro_authorizations").select("*").eq("repair_order_id", id).order("authorized_at", { ascending: false }),
  ]);
  if (roError || !roData) notFound();

  const ro = roData as unknown as RepairOrder;
  const jobs = (jobsData || []) as RoJob[];
  const estimates = (estimatesData || []) as Estimate[];
  const invoice = invoiceData as Invoice | null;
  const authorizations = (authorizationsData || []) as Authorization[];
  const jobIds = jobs.map((job) => job.id);
  const estimateIds = estimates.map((estimate) => estimate.id);

  const [{ data: itemsData }, { data: estimateJobsData }, { data: paymentsData }] = await Promise.all([
    jobIds.length ? supabase.from("ro_items").select("id,ro_job_id,item_type,description,part_number,part_condition,quantity,unit,unit_cost,unit_price,taxable").in("ro_job_id", jobIds).order("created_at") : Promise.resolve({ data: [] }),
    estimateIds.length ? supabase.from("estimate_jobs").select("estimate_id,line_number,title,description,amount,decision").in("estimate_id", estimateIds).order("line_number") : Promise.resolve({ data: [] }),
    invoice ? supabase.from("payments").select("*").eq("invoice_id", invoice.id).order("received_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  const items = (itemsData || []) as RoItem[];
  const estimateJobs = (estimateJobsData || []) as EstimateJob[];
  const payments = (paymentsData || []) as Payment[];
  const itemsByJob = new Map<string, RoItem[]>();
  items.forEach((item) => itemsByJob.set(item.ro_job_id, [...(itemsByJob.get(item.ro_job_id) || []), item]));
  const jobTotals = new Map<string, { subtotal: number; taxable: number }>();
  jobs.forEach((job) => {
    const lineItems = itemsByJob.get(job.id) || [];
    jobTotals.set(job.id, {
      subtotal: lineItems.reduce((sum, item) => sum + extended(item), 0),
      taxable: lineItems.reduce((sum, item) => sum + (item.taxable ? extended(item) : 0), 0),
    });
  });

  const selected = jobs.find((job) => job.id === query.line) || jobs.find((job) => job.work_status !== "completed") || jobs[0] || null;
  const selectedItems = selected ? itemsByJob.get(selected.id) || [] : [];
  const selectedTotal = selected ? jobTotals.get(selected.id)?.subtotal || 0 : 0;
  const fullJobsSubtotal = jobs.reduce((sum, job) => sum + (jobTotals.get(job.id)?.subtotal || 0), 0);
  const approvedJobs = jobs.filter((job) => ["approved", "completed"].includes(job.authorization_status));
  const approvedJobsSubtotal = approvedJobs.reduce((sum, job) => sum + (jobTotals.get(job.id)?.subtotal || 0), 0);
  const approvedTaxable = approvedJobs.reduce((sum, job) => sum + (jobTotals.get(job.id)?.taxable || 0), 0);
  const estimateBeforeTax = fullJobsSubtotal + Number(ro.shop_supplies_amount || 0) - Number(ro.discount_amount || 0);
  const approvedBeforeTax = approvedJobsSubtotal + Number(ro.shop_supplies_amount || 0) - Number(ro.discount_amount || 0);
  const approvedTaxableWithSupplies = approvedTaxable + (ro.shop_supplies_taxable ? Number(ro.shop_supplies_amount || 0) : 0);
  const approvedTax = approvedTaxableWithSupplies * Number(ro.tax_rate || 0);
  const approvedTotal = approvedBeforeTax + approvedTax;
  const basicDiagnosticAdded = items.some((item) => item.item_type === "labor" && item.description === "Basic diagnostic");

  const customer = ro.customers;
  const vehicle = ro.vehicles;
  const vehicleName = vehicle ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim() : "Vehicle unavailable";

  return (
    <main className="admin-page ro-detail-page ro-workspace-page">
      <div className="shell ro-workspace-shell">
        <header className="ro-workspace-header">
          <div className="ro-workspace-title">
            <Link href="/admin/repair-orders">← Repair orders</Link>
            <div><span>{ro.ro_number}</span><h1>{vehicleName}</h1><p>{customer?.full_name || "Unknown customer"}{customer?.company_name ? ` · ${customer.company_name}` : ""}</p></div>
          </div>
          <div className="ro-workspace-header-actions">
            <span className={`status-pill status-${ro.status}`}>{titleCase(ro.status)}</span>
            <Link className="button secondary" href={`/admin/repair-orders/${ro.id}/customer`}>Customer portal</Link>
            <Link className="button secondary" href={`/admin/repair-orders/${ro.id}/print`} target="_blank">Print</Link>
            <form action={signOutOwner}><button className="button secondary" type="submit">Sign out</button></form>
          </div>
        </header>

        <AdminNav current="repair-orders" />

        <nav className="ro-workspace-tabs" aria-label="Repair order workspace">
          {views.map(([key, label]) => <Link key={key} className={view === key ? "active" : ""} href={`/admin/repair-orders/${id}?view=${key}${selected ? `&line=${selected.id}` : ""}`}>{label}</Link>)}
          <Link className="team-tab" href={`/admin/repair-orders/${id}/team`}>Team & Parts</Link>
        </nav>

        <section className="ro-workspace-summary">
          <div><span>Customer complaint</span><strong>{ro.original_complaint || "No complaint entered"}</strong></div>
          <div><span>Estimate</span><strong>{money(estimateBeforeTax)}</strong></div>
          <div><span>Approved</span><strong>{money(approvedTotal)}</strong></div>
          <div><span>Balance</span><strong>{invoice ? money(invoice.balance_due) : "Not invoiced"}</strong></div>
        </section>

        {view === "work" ? (
          <section className="ro-workspace-grid">
            <aside className="ro-line-rail">
              <div className="ro-line-rail-head"><div><span>Service lines</span><strong>{jobs.length}</strong></div><small>Open one line at a time</small></div>
              <nav>
                {jobs.map((job) => (
                  <Link key={job.id} className={selected?.id === job.id ? "active" : ""} href={`/admin/repair-orders/${id}?view=work&line=${job.id}`}>
                    <div><span>Line {job.line_number}</span><strong>{job.title || "Untitled service"}</strong></div>
                    <div><small>{titleCase(job.work_status || job.authorization_status)}</small><b>{money(jobTotals.get(job.id)?.subtotal || 0)}</b></div>
                  </Link>
                ))}
                {jobs.length === 0 ? <p className="admin-muted">No service lines yet.</p> : null}
              </nav>
              <details className="ro-add-line-simple" open={jobs.length === 0}>
                <summary>+ Add service line</summary>
                <form action={addRepairOrderJob}>
                  <input type="hidden" name="repairOrderId" value={id} />
                  <label>Title<input name="title" placeholder="Diagnose no-start" /></label>
                  <label>Concern<textarea name="customerConcern" placeholder="What is this line for?" /></label>
                  <button className="button" type="submit">Add line</button>
                </form>
              </details>
            </aside>

            <section className="ro-line-focus">
              {!selected ? (
                <div className="ro-workspace-empty"><h2>Add the first service line.</h2><p>The RO stays simple until there is actual work to track.</p></div>
              ) : (
                <>
                  <header className="ro-line-focus-head">
                    <div><span>Line {selected.line_number}</span><h2>{selected.title || "Untitled service"}</h2><p>{selected.customer_concern || "No concern entered."}</p></div>
                    <div><span className={`status-pill status-${selected.work_status}`}>{titleCase(selected.work_status)}</span><strong>{money(selectedTotal)}</strong></div>
                  </header>

                  <form action={saveWorkLine} className="ro-line-focus-form">
                    <input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="jobId" value={selected.id} />
                    <div className="ro-two-fields"><label>Service title<input name="title" defaultValue={selected.title} /></label><label>Customer concern<textarea name="customerConcern" defaultValue={selected.customer_concern} /></label></div>
                    <label>Findings / cause<textarea name="technicianFindings" defaultValue={selected.technician_findings || ""} placeholder="What was found?" /></label>
                    <label>Recommendation<textarea name="recommendedAction" defaultValue={selected.recommended_action || ""} placeholder="What should happen next?" /></label>
                    <label>Correction performed<textarea name="correctionPerformed" defaultValue={selected.correction_performed || ""} placeholder="What was actually done?" /></label>
                    <div className="ro-save-row"><button className="button" type="submit">Save work</button><span>Only these work fields are changed.</span></div>
                  </form>

                  <section className="ro-line-items-simple">
                    <div className="ro-section-bar"><div><span>Labor & parts</span><strong>{selectedItems.length} items</strong></div><b>{money(selectedTotal)}</b></div>
                    <div className="ro-items-simple-list">
                      {selectedItems.map((item) => (
                        <div key={item.id} className="ro-item-simple">
                          <span className="ro-item-type">{titleCase(item.item_type)}</span>
                          <div><strong>{item.description}</strong><small>{itemLabel(item)}{item.part_number ? ` · ${item.part_number}` : ""}</small></div>
                          <b>{money(extended(item))}</b>
                          <form action={removeJobItem}><input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="itemId" value={item.id} /><button className="text-button danger" type="submit">Remove</button></form>
                        </div>
                      ))}
                      {selectedItems.length === 0 ? <p className="admin-muted">No labor or parts added yet.</p> : null}
                    </div>

                    <div className="ro-add-items-row">
                      <details open={selectedItems.length === 0}>
                        <summary>+ Labor</summary>
                        <form action={addWorkspaceItem} className="ro-compact-entry">
                          <input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="jobId" value={selected.id} /><input type="hidden" name="itemType" value="labor" />
                          <label>Description<input name="description" placeholder="Diagnostic labor" /></label>
                          <label>Hours<input name="quantity" type="number" min="0.1" step="0.1" placeholder="1.0" /></label>
                          <div className="ro-rate-readout"><span>Rate</span><strong>{money(ro.labor_rate)}/hr</strong></div>
                          <button className="button secondary" type="submit">Add labor</button>
                        </form>
                      </details>
                      <details>
                        <summary>+ Part / fee</summary>
                        <form action={addWorkspaceItem} className="ro-compact-entry ro-part-entry">
                          <input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="jobId" value={selected.id} />
                          <label>Type<select name="itemType" defaultValue="part"><option value="part">Part</option><option value="fee">Fee</option><option value="sublet">Sublet</option><option value="discount">Discount</option></select></label>
                          <label>Description<input name="description" placeholder="Oil filter, seal, coolant…" /></label>
                          <label>Part #<input name="partNumber" /></label>
                          <label>Qty<input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" /></label>
                          <label>Unit<select name="unit" defaultValue="ea">{units.map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></label>
                          <label>Unit cost<input name="unitCost" type="number" min="0" step="0.01" /></label>
                          <label>Customer price<input name="unitPrice" type="number" min="0" step="0.01" /></label>
                          <label>Condition<select name="partCondition" defaultValue=""><option value="">Not set</option><option value="new_oem">New OEM</option><option value="new_aftermarket">New aftermarket</option><option value="rebuilt">Rebuilt</option><option value="used">Used</option><option value="customer_supplied">Customer supplied</option></select></label>
                          <label className="checkbox-label"><input type="checkbox" name="taxable" value="yes" defaultChecked /> Taxable</label>
                          <button className="button secondary" type="submit">Add item</button>
                        </form>
                      </details>
                    </div>
                  </section>
                </>
              )}
            </section>

            <aside className="ro-context-rail">
              <BasicDiagnosticButton repairOrderId={id} rate={Number(ro.labor_rate || 100)} added={basicDiagnosticAdded} />
              {selected ? (
                <div className="ro-context-card">
                  <span>Customer approval</span><strong>{titleCase(selected.authorization_status)}</strong><p>{money(selectedTotal)} on this line</p>
                  <Link href={`/admin/repair-orders/${id}?view=approval&line=${selected.id}`}>Review approval →</Link>
                </div>
              ) : null}
              <div className="ro-context-card">
                <span>Team & parts</span><strong>Assignments, time & sourcing</strong><p>Keep production/pay and requested-parts workflow out of the main RO.</p>
                <Link href={`/admin/repair-orders/${id}/team`}>Open Team & Parts →</Link>
              </div>
              <div className="ro-context-card">
                <span>Labor rate</span>
                <form action={updateLaborRate} className="ro-rate-form"><input type="hidden" name="repairOrderId" value={id} /><div><span>$</span><input name="laborRate" type="number" min="0" step="0.01" defaultValue={Number(ro.labor_rate || 100).toFixed(2)} /><span>/hr</span></div><button className="button secondary" type="submit">Update</button></form>
              </div>
            </aside>
          </section>
        ) : null}

        {view === "details" ? (
          <section className="ro-view-panel">
            <div className="ro-detail-cards">
              <article><span>Customer</span><h2>{customer?.full_name || "Unknown customer"}</h2><p>{customer?.company_name || ""}</p><p>{customer?.phone || "—"}</p><p>{customer?.email || "—"}</p></article>
              <article><span>Vehicle</span><h2>{vehicleName}</h2><p>VIN {vehicle?.vin || "—"}</p><p>Plate {vehicle?.license_plate || "—"} · Unit {vehicle?.unit_number || "—"}</p><p>Mileage {vehicle?.mileage?.toLocaleString() || "—"}</p></article>
            </div>
            <form action={updateRepairOrder} className="ro-details-form">
              <input type="hidden" name="repairOrderId" value={id} />
              <div className="ro-form-section"><div><h2>RO status & timing</h2><p>Operational details for this repair order.</p></div><div className="ro-form-grid">
                <label>Status<select name="status" defaultValue={ro.status}>{roStatuses.map((status) => <option value={status} key={status}>{titleCase(status)}</option>)}</select></label>
                <label>Promised<input name="promisedAt" type="datetime-local" defaultValue={dateTimeLocal(ro.promised_at)} /></label>
                <label>Odometer in<input name="odometerIn" type="number" min="0" defaultValue={ro.odometer_in ?? ""} /></label>
                <label>Odometer out<input name="odometerOut" type="number" min="0" defaultValue={ro.odometer_out ?? ""} /></label>
                <label>Completed<input name="completedAt" type="datetime-local" defaultValue={dateTimeLocal(ro.completed_at)} /></label>
              </div></div>
              <div className="ro-form-section"><div><h2>Customer request</h2><p>What came in and any instructions attached to it.</p></div><div className="ro-form-grid">
                <label className="full">Original complaint<textarea name="originalComplaint" defaultValue={ro.original_complaint} /></label>
                <label className="full">Customer instructions<textarea name="customerInstructions" defaultValue={ro.customer_instructions || ""} /></label>
                <label className="full">Internal notes<textarea name="internalNotes" defaultValue={ro.internal_notes || ""} /></label>
              </div></div>
              <div className="ro-form-section"><div><h2>Estimate & tax settings</h2><p>Keep these out of the daily work screen unless you need them.</p></div><div className="ro-form-grid">
                <label>Estimate selection<select name="estimateChoice" defaultValue={ro.estimate_choice}><option value="written_estimate">Written estimate required</option><option value="authorized_limit">Proceed up to authorized limit</option><option value="estimate_waived">Written estimate waived</option></select></label>
                <label>Authorized limit<input name="authorizedLimit" type="number" min="0" step="0.01" defaultValue={ro.authorized_limit ?? ""} /></label>
                <label>Sales tax %<input name="taxPercent" type="number" min="0" max="100" step="0.001" defaultValue={(Number(ro.tax_rate || 0) * 100).toFixed(3)} /></label>
                <label>Shop supplies<input name="shopSuppliesAmount" type="number" min="0" step="0.01" defaultValue={ro.shop_supplies_amount || 0} /></label>
                <label>RO discount<input name="discountAmount" type="number" min="0" step="0.01" defaultValue={ro.discount_amount || 0} /></label>
                <label className="full">Estimate / authorization note<textarea name="estimateAuthorizationNote" defaultValue={ro.estimate_authorization_note || ""} /></label>
                <label className="checkbox-label"><input type="checkbox" name="partsReturnRequested" value="yes" defaultChecked={ro.parts_return_requested} /> Customer requested replaced parts</label>
                <label className="checkbox-label"><input type="checkbox" name="shopSuppliesTaxable" value="yes" defaultChecked={ro.shop_supplies_taxable} /> Shop supplies taxable</label>
              </div></div>
              <div className="ro-save-row"><button className="button" type="submit">Save RO details</button></div>
            </form>
          </section>
        ) : null}

        {view === "approval" ? (
          <section className="ro-view-panel ro-approval-view">
            <header className="ro-view-heading"><div><span>Customer authorization</span><h2>Approve work line by line.</h2><p>Technical work stays on Work. This screen is only decisions, estimates and authorization history.</p></div><Link className="button secondary" href={`/admin/repair-orders/${id}/customer`}>Open customer portal</Link></header>
            <div className="ro-approval-grid">
              <div className="ro-approval-lines">
                {jobs.map((job) => {
                  const total = jobTotals.get(job.id)?.subtotal || 0;
                  return (
                    <article className={`ro-approval-card ${selected?.id === job.id ? "selected" : ""}`} key={job.id}>
                      <header><div><span>Line {job.line_number}</span><h3>{job.title || "Untitled service"}</h3><p>{job.recommended_action || job.customer_concern || "No recommendation entered."}</p></div><div><strong>{money(total)}</strong><span className={`status-pill status-${job.authorization_status}`}>{titleCase(job.authorization_status)}</span></div></header>
                      <form action={saveLineAuthorization} className="ro-authorization-form">
                        <input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="jobId" value={job.id} />
                        <label>Decision<select name="authorizationStatus" defaultValue={job.authorization_status === "completed" ? "approved" : job.authorization_status}>{authorizationStatuses.map((status) => <option value={status} key={status}>{titleCase(status)}</option>)}</select></label>
                        <label>Authorized amount<input name="authorizedAmount" type="number" min="0" step="0.01" defaultValue={job.authorized_amount ?? total.toFixed(2)} /></label>
                        <label>Method<select name="authorizationMethod" defaultValue={job.authorization_method || ""}><option value="">Not recorded</option><option value="written">Written</option><option value="phone">Phone</option><option value="text">Text</option><option value="email">Email</option><option value="in_person">In person</option><option value="online">Online</option></select></label>
                        <label>Authorized by<input name="authorizedByName" defaultValue={job.authorized_by_name || ""} /></label>
                        <label>Phone<input name="authorizedByPhone" type="tel" defaultValue={job.authorized_by_phone || customer?.phone || ""} /></label>
                        <label className="full">Deferred / declined reason<textarea name="deferredReason" defaultValue={job.deferred_reason || ""} /></label>
                        <label className="full">Authorization note<textarea name="authorizationNote" /></label>
                        <div className="full"><button className="button secondary" type="submit">Save decision</button></div>
                      </form>
                    </article>
                  );
                })}
              </div>

              <aside className="ro-estimate-rail">
                <article className="ro-context-card estimate-now"><span>Current estimate</span><strong>{money(estimateBeforeTax)}</strong><p>Before sales tax.</p><form action={createEstimateSnapshot}><input type="hidden" name="repairOrderId" value={id} /><button className="button" type="submit">Create estimate snapshot</button></form></article>
                {estimates.map((estimate) => (
                  <details className="ro-estimate-card" key={estimate.id}>
                    <summary><span><strong>{estimate.estimate_number}</strong><small>{titleCase(estimate.status)}</small></span><b>{money(estimate.total)}</b></summary>
                    <div className="ro-estimate-lines">{estimateJobs.filter((job) => job.estimate_id === estimate.id).map((job) => <div key={`${estimate.id}-${job.line_number}`}><span>Line {job.line_number} · {job.title}</span><b>{money(job.amount)}</b></div>)}</div>
                    <form action={updateEstimate} className="ro-estimate-form"><input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="estimateId" value={estimate.id} />
                      <label>Status<select name="status" defaultValue={estimate.status}>{estimateStatuses.map((status) => <option value={status} key={status}>{titleCase(status)}</option>)}</select></label>
                      <label>Valid until<input name="validUntil" type="date" defaultValue={estimate.valid_until || ""} /></label>
                      <label>Authorized by<input name="authorizedByName" defaultValue={estimate.authorized_by_name || ""} /></label>
                      <label>Method<input name="authorizationMethod" defaultValue={estimate.authorization_method || ""} /></label>
                      <label className="full">Customer note<textarea name="customerNote" defaultValue={estimate.customer_note || ""} /></label>
                      <label className="full">Authorization note<textarea name="authorizationNote" defaultValue={estimate.authorization_note || ""} /></label>
                      <div className="full"><button className="button secondary" type="submit">Update estimate</button></div>
                    </form>
                  </details>
                ))}
                <details className="ro-history-card"><summary>Authorization history · {authorizations.length}</summary><div>{authorizations.map((auth) => <div className="ro-history-row" key={auth.id}><span>{new Date(auth.authorized_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}</span><strong>{titleCase(auth.decision)} · {money(auth.authorized_amount)}</strong><small>{auth.authorized_by_name} · {titleCase(auth.authorization_method)}{auth.notes ? ` · ${auth.notes}` : ""}</small></div>)}</div></details>
              </aside>
            </div>
          </section>
        ) : null}

        {view === "billing" ? (
          <section className="ro-view-panel ro-billing-view">
            <header className="ro-view-heading"><div><span>Billing</span><h2>Invoice & payments.</h2><p>Only final money actions live here.</p></div></header>
            <div className="ro-billing-grid">
              <article className="ro-billing-summary">
                <div><span>Approved work</span><strong>{money(approvedBeforeTax)}</strong></div><div><span>Estimated tax</span><strong>{money(approvedTax)}</strong></div><div className="total"><span>Approved total</span><strong>{money(approvedTotal)}</strong></div>
                <form action={syncInvoice}><input type="hidden" name="repairOrderId" value={id} /><button className="button" type="submit">{invoice ? "Refresh invoice totals" : "Create invoice"}</button></form>
              </article>

              {invoice ? (
                <article className="ro-invoice-card">
                  <header><div><span>{invoice.invoice_number}</span><h2>{titleCase(invoice.status)}</h2></div><strong>{money(invoice.balance_due)} due</strong></header>
                  <div className="ro-invoice-numbers"><div><span>Total</span><b>{money(invoice.total)}</b></div><div><span>Paid</span><b>{money(invoice.amount_paid)}</b></div><div><span>Balance</span><b>{money(invoice.balance_due)}</b></div></div>
                  <details><summary>Payment link & due date</summary><form action={updateInvoicePaymentLink} className="ro-billing-form"><input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="invoiceId" value={invoice.id} />
                    <label>Provider<input name="paymentProvider" defaultValue={invoice.payment_provider || ""} /></label><label>Due<input name="dueAt" type="datetime-local" defaultValue={dateTimeLocal(invoice.due_at)} /></label><label className="full">Hosted payment URL<input name="hostedPaymentUrl" type="url" defaultValue={invoice.hosted_payment_url || ""} /></label><label className="full">Customer note<textarea name="customerNote" defaultValue={invoice.customer_note || ""} /></label><div className="full"><button className="button secondary" type="submit">Save payment details</button></div>
                  </form></details>
                  <details open={payments.length === 0 && Number(invoice.balance_due) > 0}><summary>Record payment / refund</summary><form action={recordPayment} className="ro-billing-form"><input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="invoiceId" value={invoice.id} />
                    <label>Amount<input name="amount" type="number" min="0.01" step="0.01" defaultValue={invoice.balance_due > 0 ? Number(invoice.balance_due).toFixed(2) : ""} /></label>
                    <label>Method<select name="method" defaultValue="card"><option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="zelle">Zelle</option><option value="ach">ACH</option><option value="bank_transfer">Bank transfer</option><option value="financing">Financing</option><option value="other">Other</option></select></label>
                    <label>Status<select name="status" defaultValue="succeeded"><option value="succeeded">Succeeded</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option><option value="void">Void</option></select></label>
                    <label>Provider<input name="provider" /></label><label>Reference<input name="providerReference" /></label><label className="full">Notes<textarea name="notes" /></label><div className="full"><button className="button secondary" type="submit">Record transaction</button></div>
                  </form></details>
                  <div className="ro-payment-history"><h3>Payment history</h3>{payments.length === 0 ? <p className="admin-muted">No payments recorded.</p> : payments.map((payment) => <div key={payment.id}><span>{new Date(payment.received_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}<small>{titleCase(payment.method)} · {titleCase(payment.status)}</small></span><strong>{money(payment.amount)}</strong></div>)}</div>
                </article>
              ) : <div className="ro-workspace-empty"><h2>No invoice yet.</h2><p>Create it only when approved work is ready for billing.</p></div>}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
