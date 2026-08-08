import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireOwner } from "@/lib/auth/owner";
import { money, titleCase } from "@/lib/customer-portal";

export const metadata = {
  title: "Finance",
  robots: { index: false, follow: false },
};

type ItemRow = {
  item_type: string;
  quantity: number;
  unit_cost: number | null;
  unit_price: number;
  ro_jobs: {
    repair_order_id: string;
    authorization_status: string;
  } | null;
};

type InvoiceRow = {
  id: string;
  repair_order_id: string;
  invoice_number: string;
  status: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  issued_at: string | null;
  repair_orders: {
    ro_number: string;
    customers: { full_name: string } | null;
    vehicles: { year: number | null; make: string; model: string } | null;
  } | null;
};

type PaymentRow = {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  provider: string | null;
  received_at: string;
  invoices: { invoice_number: string; repair_order_id: string } | null;
};

function extended(item: ItemRow, field: "unit_price" | "unit_cost") {
  const unit = field === "unit_price" ? Number(item.unit_price || 0) : Number(item.unit_cost || 0);
  const amount = Number(item.quantity || 0) * unit;
  return item.item_type === "discount" ? -Math.abs(amount) : amount;
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export default async function FinancePage() {
  const { supabase } = await requireOwner();

  const [
    { data: itemData, error: itemError },
    { data: invoiceData, error: invoiceError },
    { data: paymentData, error: paymentError },
  ] = await Promise.all([
    supabase
      .from("ro_items")
      .select("item_type,quantity,unit_cost,unit_price,ro_jobs(repair_order_id,authorization_status)"),
    supabase
      .from("invoices")
      .select("id,repair_order_id,invoice_number,status,total,amount_paid,balance_due,issued_at,repair_orders(ro_number,customers(full_name),vehicles(year,make,model))")
      .order("issued_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id,invoice_id,amount,method,provider,received_at,invoices(invoice_number,repair_order_id)")
      .eq("status", "succeeded")
      .order("received_at", { ascending: false })
      .limit(100),
  ]);

  const items = (itemData || []) as unknown as ItemRow[];
  const invoices = (invoiceData || []) as unknown as InvoiceRow[];
  const payments = (paymentData || []) as unknown as PaymentRow[];
  const approvedItems = items.filter((item) => item.ro_jobs && ["approved", "completed"].includes(item.ro_jobs.authorization_status));

  const parts = approvedItems.filter((item) => item.item_type === "part");
  const labor = approvedItems.filter((item) => item.item_type === "labor");
  const fees = approvedItems.filter((item) => ["fee", "sublet"].includes(item.item_type));
  const discounts = approvedItems.filter((item) => item.item_type === "discount");

  const partsRevenue = parts.reduce((sum, item) => sum + extended(item, "unit_price"), 0);
  const partsCost = parts.reduce((sum, item) => sum + extended(item, "unit_cost"), 0);
  const laborRevenue = labor.reduce((sum, item) => sum + extended(item, "unit_price"), 0);
  const laborCost = labor.reduce((sum, item) => sum + extended(item, "unit_cost"), 0);
  const otherRevenue = fees.reduce((sum, item) => sum + extended(item, "unit_price"), 0);
  const discountTotal = Math.abs(discounts.reduce((sum, item) => sum + extended(item, "unit_price"), 0));
  const approvedLineRevenue = approvedItems.reduce((sum, item) => sum + extended(item, "unit_price"), 0);
  const recordedCost = approvedItems
    .filter((item) => item.item_type !== "discount")
    .reduce((sum, item) => sum + extended(item, "unit_cost"), 0);
  const recordedGrossProfit = approvedLineRevenue - recordedCost;

  const invoiced = invoices.filter((invoice) => invoice.status !== "void").reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const collected = invoices.filter((invoice) => invoice.status !== "void").reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0);
  const receivable = invoices.filter((invoice) => invoice.status !== "void").reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0);
  const openInvoices = invoices.filter((invoice) => Number(invoice.balance_due || 0) > 0 && invoice.status !== "void").length;

  return (
    <main className="admin-page finance-page">
      <div className="shell">
        <header className="admin-header compact-admin-header">
          <div>
            <div className="eyebrow">Owner operations</div>
            <h1>Finance</h1>
            <p className="section-copy">Parts, labor, recorded cost, invoiced revenue, collected payments, and outstanding balances from the repair-order ledger.</p>
          </div>
          <Link className="button secondary" href="/admin/repair-orders">Repair orders</Link>
        </header>

        <AdminNav current="finance" />

        {(itemError || invoiceError || paymentError) ? (
          <div className="form-error admin-error">Some finance records could not load. Verify the repair-order migrations and database permissions.</div>
        ) : null}

        <section className="finance-kpi-grid">
          <article className="finance-kpi primary"><span>Collected revenue</span><strong>{money(collected)}</strong><small>Successful/recorded invoice payments</small></article>
          <article className="finance-kpi"><span>Accounts receivable</span><strong>{money(receivable)}</strong><small>{openInvoices} open invoice{openInvoices === 1 ? "" : "s"}</small></article>
          <article className="finance-kpi"><span>Total invoiced</span><strong>{money(invoiced)}</strong><small>Non-void invoices</small></article>
          <article className="finance-kpi"><span>Approved line revenue</span><strong>{money(approvedLineRevenue)}</strong><small>Approved/completed RO items</small></article>
          <article className="finance-kpi"><span>Recorded gross profit</span><strong>{money(recordedGrossProfit)}</strong><small>Approved line revenue minus entered costs</small></article>
          <article className="finance-kpi"><span>Recorded cost</span><strong>{money(recordedCost)}</strong><small>Only costs entered on RO items</small></article>
        </section>

        <section className="finance-breakdown-grid">
          <article className="admin-panel finance-breakdown-card">
            <div className="panel-label">Parts</div>
            <h2>{money(partsRevenue)}</h2>
            <div className="finance-pairs">
              <span>Cost <strong>{money(partsCost)}</strong></span>
              <span>Gross profit <strong>{money(partsRevenue - partsCost)}</strong></span>
              <span>Margin <strong>{partsRevenue > 0 ? `${(((partsRevenue - partsCost) / partsRevenue) * 100).toFixed(1)}%` : "—"}</strong></span>
            </div>
          </article>
          <article className="admin-panel finance-breakdown-card">
            <div className="panel-label">Labor</div>
            <h2>{money(laborRevenue)}</h2>
            <div className="finance-pairs">
              <span>Recorded labor cost <strong>{money(laborCost)}</strong></span>
              <span>Gross profit <strong>{money(laborRevenue - laborCost)}</strong></span>
              <span>Margin <strong>{laborRevenue > 0 ? `${(((laborRevenue - laborCost) / laborRevenue) * 100).toFixed(1)}%` : "—"}</strong></span>
            </div>
          </article>
          <article className="admin-panel finance-breakdown-card">
            <div className="panel-label">Other / discounts</div>
            <h2>{money(otherRevenue)}</h2>
            <div className="finance-pairs">
              <span>Fees + sublet <strong>{money(otherRevenue)}</strong></span>
              <span>Discounts <strong>-{money(discountTotal)}</strong></span>
              <span>Net effect <strong>{money(otherRevenue - discountTotal)}</strong></span>
            </div>
          </article>
        </section>

        <section className="admin-panel finance-table-panel">
          <div className="ro-section-heading">
            <div><div className="panel-label">Invoices</div><h2>Revenue and receivables</h2></div>
            <strong>{invoices.length} invoices</strong>
          </div>
          <div className="finance-table-wrap">
            <div className="finance-table finance-table-head"><span>RO / Invoice</span><span>Customer / Vehicle</span><span>Status</span><span>Total</span><span>Paid</span><span>Balance</span></div>
            {invoices.map((invoice) => {
              const ro = invoice.repair_orders;
              const vehicle = ro?.vehicles;
              return (
                <Link className="finance-table finance-table-row" href={`/admin/repair-orders/${invoice.repair_order_id}`} key={invoice.id}>
                  <span><strong>{ro?.ro_number || "RO"}</strong><small>{invoice.invoice_number} · {dateLabel(invoice.issued_at)}</small></span>
                  <span><strong>{ro?.customers?.full_name || "Customer"}</strong><small>{vehicle ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim() : ""}</small></span>
                  <span>{titleCase(invoice.status)}</span>
                  <span>{money(invoice.total)}</span>
                  <span>{money(invoice.amount_paid)}</span>
                  <span><strong>{money(invoice.balance_due)}</strong></span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="admin-panel finance-table-panel">
          <div className="ro-section-heading">
            <div><div className="panel-label">Payments</div><h2>Recent successful payments</h2></div>
            <strong>{payments.length} shown</strong>
          </div>
          <div className="payment-ledger-list">
            {payments.length ? payments.map((payment) => (
              <div className="payment-ledger-row" key={payment.id}>
                <div><strong>{money(payment.amount)}</strong><span>{payment.invoices?.invoice_number || "Invoice"}</span></div>
                <div><span>{titleCase(payment.method)}{payment.provider ? ` · ${titleCase(payment.provider)}` : ""}</span><strong>{dateLabel(payment.received_at)}</strong></div>
              </div>
            )) : <p className="admin-muted">No successful payments recorded yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
