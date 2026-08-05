import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { requireOwner } from "@/lib/auth/owner";
import { signOutOwner } from "../../actions";
import {
  addJobItem,
  addRepairOrderJob,
  createEstimateSnapshot,
  recordPayment,
  removeJobItem,
  syncInvoice,
  updateEstimate,
  updateInvoicePaymentLink,
  updateRepairOrder,
  updateRepairOrderJob,
} from "../actions";

export const metadata = {
  title: "Repair Order",
  robots: { index: false, follow: false },
};

type RepairOrder = {
  id: string;
  ro_number: string;
  service_request_id: string | null;
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
  shop_supplies_amount: number;
  shop_supplies_taxable: boolean;
  discount_amount: number;
  internal_notes: string | null;
  opened_at: string;
  updated_at: string;
  customers: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    company_name: string | null;
  } | null;
  vehicles: {
    id: string;
    year: number | null;
    make: string;
    model: string;
    vin: string | null;
    mileage: number | null;
    license_plate: string | null;
    unit_number: string | null;
  } | null;
};

type RoJob = {
  id: string;
  repair_order_id: string;
  line_number: number;
  title: string;
  customer_concern: string;
  technician_findings: string | null;
  recommended_action: string | null;
  correction_performed: string | null;
  authorization_status: string;
  authorized_amount: number | null;
  authorization_method: string | null;
  authorized_by_name: string | null;
  authorized_by_phone: string | null;
  authorized_at: string | null;
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
  unit_cost: number | null;
  unit_price: number;
  taxable: boolean;
};

type Estimate = {
  id: string;
  estimate_number: string;
  version: number;
  status: string;
  subtotal: number;
  taxable_subtotal: number;
  tax_amount: number;
  total: number;
  valid_until: string | null;
  customer_note: string | null;
  sent_at: string | null;
  authorized_at: string | null;
  authorization_method: string | null;
  authorized_by_name: string | null;
  authorization_note: string | null;
  created_at: string;
};

type EstimateJob = {
  estimate_id: string;
  line_number: number;
  title: string;
  description: string | null;
  amount: number;
  decision: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  taxable_subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  issued_at: string | null;
  due_at: string | null;
  payment_provider: string | null;
  hosted_payment_url: string | null;
  customer_note: string | null;
};

type Payment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  provider: string | null;
  provider_reference: string | null;
  notes: string | null;
  received_at: string;
};

type Authorization = {
  id: string;
  ro_job_id: string | null;
  decision: string;
  authorized_amount: number | null;
  authorization_method: string;
  authorized_by_name: string;
  authorized_by_phone: string | null;
  employee_name: string | null;
  notes: string | null;
  authorized_at: string;
};

const roStatuses = [
  "draft",
  "awaiting_authorization",
  "authorized",
  "in_progress",
  "waiting_parts",
  "completed",
  "invoiced",
  "paid",
  "closed",
  "cancelled",
];

const jobStatuses = ["pending", "approved", "deferred", "declined", "completed"];
const estimateStatuses = ["draft", "sent", "partially_approved", "approved", "declined", "expired"];

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function titleCase(value: string | null | undefined) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function extended(item: RoItem) {
  const total = Number(item.quantity) * Number(item.unit_price);
  return item.item_type === "discount" ? -Math.abs(total) : total;
}

export default async function RepairOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireOwner();

  const [
    { data: roData, error: roError },
    { data: jobsData },
    { data: itemsData },
    { data: estimatesData },
    { data: estimateJobsData },
    { data: invoiceData },
    { data: authorizationsData },
  ] = await Promise.all([
    supabase
      .from("repair_orders")
      .select(
        "id,ro_number,service_request_id,status,original_complaint,customer_instructions,estimate_choice,authorized_limit,estimate_authorization_note,parts_return_requested,odometer_in,odometer_out,promised_at,completed_at,tax_rate,shop_supplies_amount,shop_supplies_taxable,discount_amount,internal_notes,opened_at,updated_at,customers(id,full_name,phone,email,company_name),vehicles(id,year,make,model,vin,mileage,license_plate,unit_number)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ro_jobs").select("*").eq("repair_order_id", id).order("line_number"),
    supabase
      .from("ro_items")
      .select("id,ro_job_id,item_type,description,part_number,part_condition,quantity,unit_cost,unit_price,taxable,created_at")
      .in(
        "ro_job_id",
        (
          await supabase.from("ro_jobs").select("id").eq("repair_order_id", id)
        ).data?.map((job) => job.id) || ["00000000-0000-0000-0000-000000000000"]
      )
      .order("created_at"),
    supabase.from("estimates").select("*").eq("repair_order_id", id).order("version", { ascending: false }),
    supabase
      .from("estimate_jobs")
      .select("estimate_id,line_number,title,description,amount,decision")
      .in(
        "estimate_id",
        (
          await supabase.from("estimates").select("id").eq("repair_order_id", id)
        ).data?.map((estimate) => estimate.id) || ["00000000-0000-0000-0000-000000000000"]
      )
      .order("line_number"),
    supabase.from("invoices").select("*").eq("repair_order_id", id).maybeSingle(),
    supabase.from("ro_authorizations").select("*").eq("repair_order_id", id).order("authorized_at", { ascending: false }),
  ]);

  if (roError || !roData) notFound();

  const ro = roData as unknown as RepairOrder;
  const jobs = (jobsData || []) as RoJob[];
  const items = (itemsData || []) as RoItem[];
  const estimates = (estimatesData || []) as Estimate[];
  const estimateJobs = (estimateJobsData || []) as EstimateJob[];
  const invoice = invoiceData as Invoice | null;
  const authorizations = (authorizationsData || []) as Authorization[];

  const { data: paymentData } = invoice
    ? await supabase.from("payments").select("*").eq("invoice_id", invoice.id).order("received_at", { ascending: false })
    : { data: [] };
  const payments = (paymentData || []) as Payment[];

  const itemsByJob = new Map<string, RoItem[]>();
  items.forEach((item) => {
    const current = itemsByJob.get(item.ro_job_id) || [];
    current.push(item);
    itemsByJob.set(item.ro_job_id, current);
  });

  const jobTotals = new Map<string, { subtotal: number; taxable: number }>();
  jobs.forEach((job) => {
    const jobItems = itemsByJob.get(job.id) || [];
    jobTotals.set(job.id, {
      subtotal: jobItems.reduce((sum, item) => sum + extended(item), 0),
      taxable: jobItems.reduce((sum, item) => sum + (item.taxable ? extended(item) : 0), 0),
    });
  });

  const fullJobsSubtotal = jobs.reduce((sum, job) => sum + (jobTotals.get(job.id)?.subtotal || 0), 0);
  const approvedJobs = jobs.filter((job) => ["approved", "completed"].includes(job.authorization_status));
  const approvedJobsSubtotal = approvedJobs.reduce((sum, job) => sum + (jobTotals.get(job.id)?.subtotal || 0), 0);
  const approvedTaxable = approvedJobs.reduce((sum, job) => sum + (jobTotals.get(job.id)?.taxable || 0), 0);
  const estimateBeforeTax = fullJobsSubtotal + Number(ro.shop_supplies_amount || 0) - Number(ro.discount_amount || 0);
  const approvedBeforeTax = approvedJobsSubtotal + Number(ro.shop_supplies_amount || 0) - Number(ro.discount_amount || 0);
  const approvedTaxableWithSupplies = approvedTaxable + (ro.shop_supplies_taxable ? Number(ro.shop_supplies_amount || 0) : 0);
  const approvedTax = approvedTaxableWithSupplies * Number(ro.tax_rate || 0);
  const approvedTotal = approvedBeforeTax + approvedTax;

  const customer = ro.customers;
  const vehicle = ro.vehicles;
  const vehicleName = vehicle ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim() : "Vehicle unavailable";

  return (
    <main className="admin-page ro-detail-page">
      <div className="shell">
        <header className="admin-header compact-admin-header">
          <div>
            <div className="eyebrow">{ro.ro_number}</div>
            <h1>{vehicleName}</h1>
            <p className="section-copy">
              {customer?.full_name || "Unknown customer"} · {titleCase(ro.status)}
            </p>
          </div>
          <div className="admin-account">
            <span>{user.email}</span>
            <div className="admin-account-actions">
              <Link className="button secondary" href={`/admin/repair-orders/${ro.id}/print`} target="_blank">Print RO</Link>
              <form action={signOutOwner}><button className="button secondary" type="submit">Sign out</button></form>
            </div>
            <Link href="/">Public website →</Link>
          </div>
        </header>

        <AdminNav current="repair-orders" />

        <section className="ro-topbar">
          <Link href="/admin/repair-orders">← All repair orders</Link>
          <span className={`status-pill status-${ro.status}`}>{titleCase(ro.status)}</span>
        </section>

        <section className="ro-overview-grid">
          <article className="admin-panel">
            <div className="panel-label">Customer</div>
            <h2>{customer?.full_name || "Unknown customer"}</h2>
            <p>{customer?.company_name || ""}</p>
            <p><a href={`tel:${customer?.phone || ""}`}>{customer?.phone || "—"}</a></p>
            <p>{customer?.email || "—"}</p>
          </article>
          <article className="admin-panel">
            <div className="panel-label">Vehicle</div>
            <h2>{vehicleName}</h2>
            <p>VIN: {vehicle?.vin || "—"}</p>
            <p>Plate: {vehicle?.license_plate || "—"}</p>
            <p>Unit: {vehicle?.unit_number || "—"}</p>
          </article>
          <article className="admin-panel financial-panel">
            <div className="panel-label">Current approved total</div>
            <h2>{money(approvedTotal)}</h2>
            <p>Estimate before tax: {money(estimateBeforeTax)}</p>
            <p>Invoice balance: {invoice ? money(invoice.balance_due) : "Not invoiced"}</p>
          </article>
        </section>

        <section className="admin-panel complaint-panel">
          <div className="panel-label">Original customer complaint</div>
          <p>{ro.original_complaint}</p>
        </section>

        <details className="admin-disclosure" open>
          <summary>Repair order details and legal authorization record</summary>
          <form action={updateRepairOrder} className="admin-form-grid">
            <input type="hidden" name="repairOrderId" value={ro.id} />
            <div className="field"><label htmlFor="status">RO status</label><select id="status" name="status" defaultValue={ro.status}>{roStatuses.map((status) => <option value={status} key={status}>{titleCase(status)}</option>)}</select></div>
            <div className="field"><label htmlFor="estimateChoice">Estimate selection</label><select id="estimateChoice" name="estimateChoice" defaultValue={ro.estimate_choice}><option value="written_estimate">Written estimate required</option><option value="authorized_limit">Proceed up to authorized limit</option><option value="estimate_waived">Written estimate waived</option></select></div>
            <div className="field"><label htmlFor="authorizedLimit">Authorized limit</label><input id="authorizedLimit" name="authorizedLimit" type="number" min="0" step="0.01" defaultValue={ro.authorized_limit ?? ""} /></div>
            <div className="field"><label htmlFor="taxPercent">Sales-tax rate (%)</label><input id="taxPercent" name="taxPercent" type="number" min="0" max="100" step="0.001" defaultValue={(Number(ro.tax_rate || 0) * 100).toFixed(3)} /></div>
            <div className="field"><label htmlFor="odometerIn">Odometer in</label><input id="odometerIn" name="odometerIn" type="number" min="0" defaultValue={ro.odometer_in ?? ""} /></div>
            <div className="field"><label htmlFor="odometerOut">Odometer out</label><input id="odometerOut" name="odometerOut" type="number" min="0" defaultValue={ro.odometer_out ?? ""} /></div>
            <div className="field"><label htmlFor="promisedAt">Promised time</label><input id="promisedAt" name="promisedAt" type="datetime-local" defaultValue={dateTimeLocal(ro.promised_at)} /></div>
            <div className="field"><label htmlFor="completedAt">Completed time</label><input id="completedAt" name="completedAt" type="datetime-local" defaultValue={dateTimeLocal(ro.completed_at)} /></div>
            <div className="field"><label htmlFor="shopSuppliesAmount">Shop supplies / fees</label><input id="shopSuppliesAmount" name="shopSuppliesAmount" type="number" min="0" step="0.01" defaultValue={ro.shop_supplies_amount || 0} /></div>
            <div className="field"><label htmlFor="discountAmount">RO discount</label><input id="discountAmount" name="discountAmount" type="number" min="0" step="0.01" defaultValue={ro.discount_amount || 0} /></div>
            <div className="field full"><label htmlFor="originalComplaint">Original complaint</label><textarea id="originalComplaint" name="originalComplaint" defaultValue={ro.original_complaint} required /></div>
            <div className="field full"><label htmlFor="customerInstructions">Customer instructions / requested work</label><textarea id="customerInstructions" name="customerInstructions" defaultValue={ro.customer_instructions || ""} /></div>
            <div className="field full"><label htmlFor="estimateAuthorizationNote">Estimate or authorization note</label><textarea id="estimateAuthorizationNote" name="estimateAuthorizationNote" defaultValue={ro.estimate_authorization_note || ""} placeholder="Date, time, authorization method, customer name, and authorized amount when applicable." /></div>
            <div className="field full"><label htmlFor="internalNotes">Internal notes</label><textarea id="internalNotes" name="internalNotes" defaultValue={ro.internal_notes || ""} /></div>
            <label className="checkbox-label"><input type="checkbox" name="partsReturnRequested" value="yes" defaultChecked={ro.parts_return_requested} /> Customer requested replaced parts returned or shown</label>
            <label className="checkbox-label"><input type="checkbox" name="shopSuppliesTaxable" value="yes" defaultChecked={ro.shop_supplies_taxable} /> Shop supplies are taxable</label>
            <div className="field full"><button className="button" type="submit">Save repair order</button></div>
          </form>
        </details>

        <section className="ro-section-heading">
          <div><div className="eyebrow">Jobs and recommendations</div><h2>Repair-order lines</h2></div>
          <span>{jobs.length} job{jobs.length === 1 ? "" : "s"}</span>
        </section>

        <section className="ro-jobs">
          {jobs.map((job) => {
            const jobItems = itemsByJob.get(job.id) || [];
            const totals = jobTotals.get(job.id) || { subtotal: 0, taxable: 0 };
            return (
              <article className="ro-job-card" key={job.id}>
                <header className="ro-job-head">
                  <div>
                    <span className="ro-line-number">Line {job.line_number}</span>
                    <h2>{job.title}</h2>
                  </div>
                  <div className="ro-job-total">
                    <span className={`status-pill status-${job.authorization_status}`}>{titleCase(job.authorization_status)}</span>
                    <strong>{money(totals.subtotal)}</strong>
                  </div>
                </header>

                <form action={updateRepairOrderJob} className="admin-form-grid ro-job-form">
                  <input type="hidden" name="repairOrderId" value={ro.id} />
                  <input type="hidden" name="jobId" value={job.id} />
                  <div className="field"><label>Job title</label><input name="title" defaultValue={job.title} required /></div>
                  <div className="field"><label>Customer decision</label><select name="authorizationStatus" defaultValue={job.authorization_status}>{jobStatuses.map((status) => <option value={status} key={status}>{titleCase(status)}</option>)}</select></div>
                  <div className="field full"><label>Customer concern / requested job</label><textarea name="customerConcern" defaultValue={job.customer_concern} required /></div>
                  <div className="field full"><label>Technician findings / cause</label><textarea name="technicianFindings" defaultValue={job.technician_findings || ""} /></div>
                  <div className="field full"><label>Recommended work</label><textarea name="recommendedAction" defaultValue={job.recommended_action || ""} /></div>
                  <div className="field full"><label>Correction performed</label><textarea name="correctionPerformed" defaultValue={job.correction_performed || ""} /></div>
                  <div className="field"><label>Authorized amount</label><input name="authorizedAmount" type="number" min="0" step="0.01" defaultValue={job.authorized_amount ?? totals.subtotal.toFixed(2)} /></div>
                  <div className="field"><label>Authorization method</label><select name="authorizationMethod" defaultValue={job.authorization_method || ""}><option value="">Not recorded</option><option value="written">Written</option><option value="phone">Phone</option><option value="text">Text message</option><option value="email">Email</option><option value="in_person">In person</option><option value="online">Online</option></select></div>
                  <div className="field"><label>Authorized by</label><input name="authorizedByName" defaultValue={job.authorized_by_name || ""} placeholder="Customer or designee name" /></div>
                  <div className="field"><label>Authorizer phone</label><input name="authorizedByPhone" type="tel" defaultValue={job.authorized_by_phone || customer?.phone || ""} /></div>
                  <div className="field full"><label>Deferred / declined reason</label><textarea name="deferredReason" defaultValue={job.deferred_reason || ""} /></div>
                  <div className="field full"><label>Authorization note</label><textarea name="authorizationNote" placeholder="Any limit, added work, date/time context, or exact wording from the customer." /></div>
                  <div className="field full"><button className="button secondary" type="submit">Save job line</button></div>
                </form>

                <div className="ro-items-table">
                  <div className="ro-items-head"><span>Type / Description</span><span>Qty</span><span>Unit</span><span>Total</span><span /></div>
                  {jobItems.length === 0 ? <p className="empty-line-items">No labor, parts, or fees added.</p> : null}
                  {jobItems.map((item) => (
                    <div className="ro-item-row" key={item.id}>
                      <span><strong>{titleCase(item.item_type)}</strong><small>{item.description}{item.part_number ? ` · ${item.part_number}` : ""}{item.part_condition ? ` · ${titleCase(item.part_condition)}` : ""}{item.taxable ? " · Taxable" : ""}</small></span>
                      <span>{Number(item.quantity).toFixed(item.item_type === "labor" ? 2 : 0)}</span>
                      <span>{money(item.unit_price)}</span>
                      <span><strong>{money(extended(item))}</strong></span>
                      <form action={removeJobItem}><input type="hidden" name="repairOrderId" value={ro.id} /><input type="hidden" name="itemId" value={item.id} /><button className="text-button danger" type="submit">Remove</button></form>
                    </div>
                  ))}
                </div>

                <details className="inline-disclosure">
                  <summary>Add labor, part, fee, sublet, or discount</summary>
                  <form action={addJobItem} className="admin-form-grid item-entry-form">
                    <input type="hidden" name="repairOrderId" value={ro.id} />
                    <input type="hidden" name="jobId" value={job.id} />
                    <div className="field"><label>Item type</label><select name="itemType" defaultValue="labor"><option value="labor">Labor</option><option value="part">Part</option><option value="fee">Fee / shop supply</option><option value="sublet">Sublet</option><option value="discount">Line discount</option></select></div>
                    <div className="field"><label>Description</label><input name="description" required /></div>
                    <div className="field"><label>Part number</label><input name="partNumber" /></div>
                    <div className="field"><label>Part condition</label><select name="partCondition" defaultValue=""><option value="">Not applicable</option><option value="new_oem">New OEM</option><option value="new_aftermarket">New aftermarket</option><option value="rebuilt">Rebuilt</option><option value="used">Used</option><option value="customer_supplied">Customer supplied</option></select></div>
                    <div className="field"><label>Quantity / hours</label><input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required /></div>
                    <div className="field"><label>Unit price / labor rate</label><input name="unitPrice" type="number" min="0" step="0.01" required /></div>
                    <div className="field"><label>Internal unit cost</label><input name="unitCost" type="number" min="0" step="0.01" /></div>
                    <label className="checkbox-label"><input type="checkbox" name="taxable" value="yes" defaultChecked /> Taxable</label>
                    <div className="field full"><button className="button secondary" type="submit">Add line item</button></div>
                  </form>
                </details>
              </article>
            );
          })}
        </section>

        <details className="admin-disclosure add-job-disclosure" open={jobs.length === 0}>
          <summary>Add another RO job line</summary>
          <form action={addRepairOrderJob} className="admin-form-grid">
            <input type="hidden" name="repairOrderId" value={ro.id} />
            <div className="field"><label>Job title</label><input name="title" placeholder="Example: Diagnose no-crank condition" required /></div>
            <div className="field full"><label>Customer concern / requested job</label><textarea name="customerConcern" required /></div>
            <div className="field full"><label>Initial findings</label><textarea name="technicianFindings" /></div>
            <div className="field full"><label>Recommendation</label><textarea name="recommendedAction" /></div>
            <div className="field full"><button className="button" type="submit">Add job line</button></div>
          </form>
        </details>

        <section className="ro-financial-workspace">
          <div className="financial-column">
            <div className="ro-section-heading"><div><div className="eyebrow">Customer authorization</div><h2>Estimates</h2></div></div>
            <article className="admin-panel estimate-summary-panel">
              <div className="financial-line"><span>All job lines</span><strong>{money(fullJobsSubtotal)}</strong></div>
              <div className="financial-line"><span>Shop supplies / fees</span><strong>{money(ro.shop_supplies_amount)}</strong></div>
              <div className="financial-line"><span>RO discount</span><strong>−{money(ro.discount_amount)}</strong></div>
              <div className="financial-line total"><span>Current estimate before tax</span><strong>{money(estimateBeforeTax)}</strong></div>
              <form action={createEstimateSnapshot}><input type="hidden" name="repairOrderId" value={ro.id} /><button className="button" type="submit">Create estimate snapshot</button></form>
            </article>

            {estimates.map((estimate) => (
              <details className="admin-disclosure estimate-card" key={estimate.id}>
                <summary><span>{estimate.estimate_number}</span><strong>{money(estimate.total)} · {titleCase(estimate.status)}</strong></summary>
                <div className="estimate-job-snapshot">
                  {estimateJobs.filter((job) => job.estimate_id === estimate.id).map((job) => (
                    <div key={`${estimate.id}-${job.line_number}`}><span>Line {job.line_number}: {job.title}</span><strong>{money(job.amount)} · {titleCase(job.decision)}</strong></div>
                  ))}
                </div>
                <form action={updateEstimate} className="admin-form-grid">
                  <input type="hidden" name="repairOrderId" value={ro.id} />
                  <input type="hidden" name="estimateId" value={estimate.id} />
                  <div className="field"><label>Status</label><select name="status" defaultValue={estimate.status}>{estimateStatuses.map((status) => <option value={status} key={status}>{titleCase(status)}</option>)}</select></div>
                  <div className="field"><label>Valid until</label><input name="validUntil" type="date" defaultValue={estimate.valid_until || ""} /></div>
                  <div className="field"><label>Authorization method</label><input name="authorizationMethod" defaultValue={estimate.authorization_method || ""} /></div>
                  <div className="field"><label>Authorized by</label><input name="authorizedByName" defaultValue={estimate.authorized_by_name || ""} /></div>
                  <div className="field full"><label>Customer-facing note</label><textarea name="customerNote" defaultValue={estimate.customer_note || ""} /></div>
                  <div className="field full"><label>Authorization note</label><textarea name="authorizationNote" defaultValue={estimate.authorization_note || ""} /></div>
                  <div className="field full"><button className="button secondary" type="submit">Update estimate record</button></div>
                </form>
              </details>
            ))}
          </div>

          <div className="financial-column">
            <div className="ro-section-heading"><div><div className="eyebrow">Final billing</div><h2>Invoice and payments</h2></div></div>
            <article className="admin-panel invoice-panel">
              <div className="financial-line"><span>Approved work before tax</span><strong>{money(approvedBeforeTax)}</strong></div>
              <div className="financial-line"><span>Estimated tax</span><strong>{money(approvedTax)}</strong></div>
              <div className="financial-line total"><span>Approved total</span><strong>{money(approvedTotal)}</strong></div>
              <form action={syncInvoice}><input type="hidden" name="repairOrderId" value={ro.id} /><button className="button" type="submit">{invoice ? "Refresh invoice totals" : "Create invoice from approved work"}</button></form>
            </article>

            {invoice ? (
              <article className="admin-panel invoice-record">
                <header><div><div className="panel-label">{invoice.invoice_number}</div><h2>{titleCase(invoice.status)}</h2></div><strong>{money(invoice.balance_due)} due</strong></header>
                <div className="financial-line"><span>Subtotal</span><strong>{money(invoice.subtotal)}</strong></div>
                <div className="financial-line"><span>Tax</span><strong>{money(invoice.tax_amount)}</strong></div>
                <div className="financial-line"><span>Total</span><strong>{money(invoice.total)}</strong></div>
                <div className="financial-line"><span>Paid</span><strong>{money(invoice.amount_paid)}</strong></div>
                <div className="financial-line total"><span>Balance due</span><strong>{money(invoice.balance_due)}</strong></div>

                <details className="inline-disclosure">
                  <summary>Hosted payment link and due date</summary>
                  <form action={updateInvoicePaymentLink} className="admin-form-grid">
                    <input type="hidden" name="repairOrderId" value={ro.id} />
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <div className="field"><label>Payment provider</label><input name="paymentProvider" defaultValue={invoice.payment_provider || ""} placeholder="Stripe, Square, Chase, other" /></div>
                    <div className="field"><label>Due date / time</label><input name="dueAt" type="datetime-local" defaultValue={dateTimeLocal(invoice.due_at)} /></div>
                    <div className="field full"><label>Hosted payment URL</label><input name="hostedPaymentUrl" type="url" defaultValue={invoice.hosted_payment_url || ""} /></div>
                    <div className="field full"><label>Invoice note</label><textarea name="customerNote" defaultValue={invoice.customer_note || ""} /></div>
                    <div className="field full"><button className="button secondary" type="submit">Save payment details</button></div>
                  </form>
                  {invoice.hosted_payment_url ? <a className="button secondary" href={invoice.hosted_payment_url} target="_blank" rel="noreferrer">Open payment page</a> : null}
                </details>

                <details className="inline-disclosure" open={payments.length === 0 && invoice.balance_due > 0}>
                  <summary>Record a payment or refund</summary>
                  <form action={recordPayment} className="admin-form-grid">
                    <input type="hidden" name="repairOrderId" value={ro.id} />
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <div className="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" defaultValue={invoice.balance_due > 0 ? Number(invoice.balance_due).toFixed(2) : ""} required /></div>
                    <div className="field"><label>Method</label><select name="method" defaultValue="card"><option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="zelle">Zelle</option><option value="ach">ACH</option><option value="bank_transfer">Bank transfer</option><option value="financing">Financing</option><option value="other">Other</option></select></div>
                    <div className="field"><label>Status</label><select name="status" defaultValue="succeeded"><option value="succeeded">Succeeded</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option><option value="void">Void</option></select></div>
                    <div className="field"><label>Received at</label><input name="receivedAt" type="datetime-local" /></div>
                    <div className="field"><label>Provider</label><input name="provider" placeholder="Square, Stripe, Chase, cash" /></div>
                    <div className="field"><label>Reference</label><input name="providerReference" placeholder="Receipt, check, or transaction ID" /></div>
                    <div className="field full"><label>Payment note</label><textarea name="notes" /></div>
                    <div className="field full"><button className="button" type="submit">Record payment</button></div>
                  </form>
                </details>

                <div className="payment-history">
                  <h3>Payment history</h3>
                  {payments.length === 0 ? <p>No payments recorded.</p> : null}
                  {payments.map((payment) => (
                    <div key={payment.id}><span>{new Date(payment.received_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}<small>{titleCase(payment.method)} · {titleCase(payment.status)}{payment.provider_reference ? ` · ${payment.provider_reference}` : ""}</small></span><strong>{payment.status === "refunded" ? "−" : ""}{money(payment.amount)}</strong></div>
                  ))}
                </div>
              </article>
            ) : null}
          </div>
        </section>

        <section className="admin-panel authorization-history">
          <div className="ro-section-heading"><div><div className="eyebrow">Audit trail</div><h2>Customer authorizations</h2></div></div>
          {authorizations.length === 0 ? <p>No line-level authorization decisions have been logged yet.</p> : null}
          {authorizations.map((authorization) => {
            const job = jobs.find((item) => item.id === authorization.ro_job_id);
            return (
              <div className="authorization-row" key={authorization.id}>
                <span><strong>{job ? `Line ${job.line_number}: ${job.title}` : "Repair order"}</strong><small>{new Date(authorization.authorized_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} · {authorization.authorization_method} · recorded by {authorization.employee_name || "owner"}</small></span>
                <span>{titleCase(authorization.decision)}{authorization.authorized_amount !== null ? ` · ${money(authorization.authorized_amount)}` : ""}<small>{authorization.authorized_by_name}{authorization.authorized_by_phone ? ` · ${authorization.authorized_by_phone}` : ""}</small></span>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
