import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/owner";

export const metadata = {
  title: "Print Repair Order",
  robots: { index: false, follow: false },
};

type Item = {
  id: string;
  ro_job_id: string;
  item_type: string;
  description: string;
  part_number: string | null;
  part_condition: string | null;
  quantity: number;
  unit_price: number;
  taxable: boolean;
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function titleCase(value: string | null | undefined) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extended(item: Item) {
  const amount = Number(item.quantity) * Number(item.unit_price);
  return item.item_type === "discount" ? -Math.abs(amount) : amount;
}

export default async function PrintRepairOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOwner();

  const { data: ro } = await supabase
    .from("repair_orders")
    .select("*,customers(*),vehicles(*)")
    .eq("id", id)
    .maybeSingle();
  if (!ro) notFound();

  const { data: jobs } = await supabase.from("ro_jobs").select("*").eq("repair_order_id", id).order("line_number");
  const jobIds = (jobs || []).map((job) => job.id);
  const { data: items } = jobIds.length
    ? await supabase.from("ro_items").select("*").in("ro_job_id", jobIds).order("created_at")
    : { data: [] };
  const { data: invoice } = await supabase.from("invoices").select("*").eq("repair_order_id", id).maybeSingle();
  const { data: payments } = invoice
    ? await supabase.from("payments").select("*").eq("invoice_id", invoice.id).order("received_at")
    : { data: [] };

  const customer = Array.isArray(ro.customers) ? ro.customers[0] : ro.customers;
  const vehicle = Array.isArray(ro.vehicles) ? ro.vehicles[0] : ro.vehicles;
  const lineItems = (items || []) as Item[];
  const itemsByJob = new Map<string, Item[]>();
  lineItems.forEach((item) => itemsByJob.set(item.ro_job_id, [...(itemsByJob.get(item.ro_job_id) || []), item]));

  return (
    <main className="print-ro">
      <header className="print-ro-header">
        <div>
          <strong>NW STAR DIAGNOSTICS</strong>
          <span>Mobile Mercedes-Benz, Sprinter, electrical and fleet diagnostics</span>
        </div>
        <div>
          <h1>{ro.ro_number}</h1>
          <span>Opened {new Date(ro.opened_at).toLocaleDateString("en-US")}</span>
          <span>Status: {titleCase(ro.status)}</span>
        </div>
      </header>

      <section className="print-info-grid">
        <div><h2>Customer</h2><p>{customer?.full_name}</p><p>{customer?.company_name}</p><p>{customer?.phone}</p><p>{customer?.email}</p></div>
        <div><h2>Vehicle</h2><p>{vehicle?.year} {vehicle?.make} {vehicle?.model}</p><p>VIN: {vehicle?.vin || "—"}</p><p>Plate: {vehicle?.license_plate || "—"}</p><p>Odometer in/out: {ro.odometer_in || "—"} / {ro.odometer_out || "—"}</p></div>
        <div><h2>Authorization</h2><p>{titleCase(ro.estimate_choice)}</p><p>Authorized limit: {ro.authorized_limit !== null ? money(ro.authorized_limit) : "—"}</p><p>Return parts: {ro.parts_return_requested ? "Requested" : "Not requested"}</p><p>Promised: {ro.promised_at ? new Date(ro.promised_at).toLocaleString("en-US") : "—"}</p></div>
      </section>

      <section className="print-complaint"><h2>Customer complaint</h2><p>{ro.original_complaint}</p>{ro.customer_instructions ? <><h3>Customer instructions</h3><p>{ro.customer_instructions}</p></> : null}</section>

      <section className="print-jobs">
        {(jobs || []).map((job) => {
          const jobItems = itemsByJob.get(job.id) || [];
          const jobTotal = jobItems.reduce((sum, item) => sum + extended(item), 0);
          return (
            <article className="print-job" key={job.id}>
              <header><h2>Line {job.line_number}: {job.title}</h2><strong>{titleCase(job.authorization_status)} · {money(jobTotal)}</strong></header>
              <div className="print-cause-correction">
                <div><h3>Concern</h3><p>{job.customer_concern}</p></div>
                <div><h3>Findings / cause</h3><p>{job.technician_findings || "Not recorded"}</p></div>
                <div><h3>Recommended</h3><p>{job.recommended_action || "None recorded"}</p></div>
                <div><h3>Correction</h3><p>{job.correction_performed || "Not completed"}</p></div>
              </div>
              <table><thead><tr><th>Type</th><th>Description / part number</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>{jobItems.map((item) => <tr key={item.id}><td>{titleCase(item.item_type)}</td><td>{item.description}{item.part_number ? ` · ${item.part_number}` : ""}{item.part_condition ? ` · ${titleCase(item.part_condition)}` : ""}</td><td>{Number(item.quantity)}</td><td>{money(item.unit_price)}</td><td>{money(extended(item))}</td></tr>)}</tbody></table>
              {job.authorized_by_name ? <p className="print-authorization">Authorized by {job.authorized_by_name} via {job.authorization_method || "recorded authorization"}{job.authorized_amount !== null ? ` up to ${money(job.authorized_amount)}` : ""}{job.authorized_at ? ` on ${new Date(job.authorized_at).toLocaleString("en-US")}` : ""}.</p> : null}
              {job.deferred_reason ? <p className="print-deferred"><strong>Deferred/declined:</strong> {job.deferred_reason}</p> : null}
            </article>
          );
        })}
      </section>

      {invoice ? (
        <section className="print-invoice">
          <div><h2>{invoice.invoice_number}</h2><p>Status: {titleCase(invoice.status)}</p></div>
          <div className="print-totals"><p><span>Subtotal</span><strong>{money(invoice.subtotal)}</strong></p><p><span>Sales tax</span><strong>{money(invoice.tax_amount)}</strong></p><p><span>Total</span><strong>{money(invoice.total)}</strong></p><p><span>Paid</span><strong>{money(invoice.amount_paid)}</strong></p><p className="grand-total"><span>Balance due</span><strong>{money(invoice.balance_due)}</strong></p></div>
          {(payments || []).length ? <div className="print-payments"><h3>Payments</h3>{(payments || []).map((payment) => <p key={payment.id}><span>{new Date(payment.received_at).toLocaleDateString("en-US")} · {titleCase(payment.method)} · {titleCase(payment.status)}</span><strong>{money(payment.amount)}</strong></p>)}</div> : null}
        </section>
      ) : null}

      <footer className="print-ro-footer">
        <p>Customer authorization and estimate records are retained with this repair order. Additional work exceeding an authorized estimate must be separately approved when required.</p>
        <div><span>Customer signature: ______________________________</span><span>Date: __________________</span></div>
      </footer>
    </main>
  );
}
