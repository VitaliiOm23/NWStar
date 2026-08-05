import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireOwner } from "@/lib/auth/owner";
import { signOutOwner } from "../actions";

export const metadata = {
  title: "Repair Orders",
  robots: { index: false, follow: false },
};

type RepairOrderRow = {
  id: string;
  ro_number: string;
  status: string;
  original_complaint: string;
  opened_at: string;
  updated_at: string;
  customers: {
    full_name: string;
    phone: string;
    company_name: string | null;
  } | null;
  vehicles: {
    year: number | null;
    make: string;
    model: string;
    vin: string | null;
    unit_number: string | null;
  } | null;
};

type InvoiceRow = {
  repair_order_id: string;
  status: string;
  total: number;
  amount_paid: number;
  balance_due: number;
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function RepairOrdersPage() {
  const { supabase, user } = await requireOwner();
  const [{ data, error }, { data: invoiceData }] = await Promise.all([
    supabase
      .from("repair_orders")
      .select(
        "id,ro_number,status,original_complaint,opened_at,updated_at,customers(full_name,phone,company_name),vehicles(year,make,model,vin,unit_number)"
      )
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase
      .from("invoices")
      .select("repair_order_id,status,total,amount_paid,balance_due"),
  ]);

  const repairOrders = (data || []) as unknown as RepairOrderRow[];
  const invoices = (invoiceData || []) as InvoiceRow[];
  const invoiceByRo = new Map(invoices.map((invoice) => [invoice.repair_order_id, invoice]));

  const openCount = repairOrders.filter((ro) => !["paid", "closed", "cancelled"].includes(ro.status)).length;
  const awaitingCount = repairOrders.filter((ro) => ro.status === "awaiting_authorization").length;
  const inProgressCount = repairOrders.filter((ro) => ["authorized", "in_progress", "waiting_parts"].includes(ro.status)).length;
  const totalReceivable = invoices.reduce((sum, invoice) => sum + Number(invoice.balance_due || 0), 0);

  return (
    <main className="admin-page">
      <div className="shell">
        <header className="admin-header compact-admin-header">
          <div>
            <div className="eyebrow">Owner operations</div>
            <h1>Repair orders</h1>
            <p className="section-copy">Customer concerns, job lines, authorizations, estimates, invoices, and payments.</p>
          </div>
          <div className="admin-account">
            <span>{user.email}</span>
            <form action={signOutOwner}>
              <button className="button secondary" type="submit">Sign out</button>
            </form>
            <Link href="/">Public website →</Link>
          </div>
        </header>

        <AdminNav current="repair-orders" />

        <section className="admin-stats ro-summary-stats">
          <article className="admin-stat"><span>Open ROs</span><strong>{openCount}</strong></article>
          <article className="admin-stat"><span>Awaiting approval</span><strong>{awaitingCount}</strong></article>
          <article className="admin-stat"><span>In progress</span><strong>{inProgressCount}</strong></article>
          <article className="admin-stat"><span>Accounts receivable</span><strong className="money-stat">{money(totalReceivable)}</strong></article>
        </section>

        {error ? (
          <div className="form-error admin-error">
            Repair orders could not load. Run the repair-order migration in Supabase first.
          </div>
        ) : null}

        {!error && repairOrders.length === 0 ? (
          <section className="admin-empty">
            <div className="eyebrow">No repair orders</div>
            <h2>Convert a service request into the first RO.</h2>
            <p>Open Requests and select Create repair order.</p>
            <Link className="button" href="/admin">Open requests</Link>
          </section>
        ) : null}

        <section className="ro-table-wrap" aria-label="Repair orders">
          <div className="ro-table ro-table-head">
            <span>RO / Vehicle</span>
            <span>Customer</span>
            <span>Status</span>
            <span>Invoice</span>
            <span>Balance</span>
          </div>
          {repairOrders.map((ro) => {
            const customer = ro.customers;
            const vehicle = ro.vehicles;
            const invoice = invoiceByRo.get(ro.id);
            const vehicleName = vehicle
              ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim()
              : "Vehicle unavailable";

            return (
              <Link className="ro-table ro-table-row" href={`/admin/repair-orders/${ro.id}`} key={ro.id}>
                <span>
                  <strong>{ro.ro_number}</strong>
                  <small>{vehicleName}</small>
                  <small>{vehicle?.vin ? `VIN ${vehicle.vin}` : vehicle?.unit_number ? `Unit ${vehicle.unit_number}` : ""}</small>
                </span>
                <span>
                  <strong>{customer?.full_name || "Unknown customer"}</strong>
                  <small>{customer?.company_name || customer?.phone || ""}</small>
                </span>
                <span><b className={`status-pill status-${ro.status}`}>{titleCase(ro.status)}</b></span>
                <span>{invoice ? titleCase(invoice.status) : "Not created"}</span>
                <span><strong>{invoice ? money(invoice.balance_due) : "—"}</strong></span>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
