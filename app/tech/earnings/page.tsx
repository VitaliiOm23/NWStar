import Link from "next/link";
import { requireTech } from "@/lib/auth/tech";
import { signOutOwner } from "@/app/admin/actions";

export const metadata = { title: "My Earnings", robots: { index: false, follow: false } };

function money(value: unknown) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0)); }
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()); }

type EarningRow = {
  assignmentId: string; roNumber: string; lineNumber: number; title: string; workStatus: string; completedAt: string | null;
  soldHours: number; actualHours: number; earnings: number; payStatus: string; payPeriodName: string | null;
};
type Summary = { pendingEarnings: number; paidEarnings: number; soldHours: number; actualHours: number; completedLines: number; rows: EarningRow[] };

export default async function TechEarningsPage() {
  const { supabase, role, displayName } = await requireTech();
  const { data, error } = await supabase.rpc("tech_my_earnings");
  const summary = (data || { pendingEarnings: 0, paidEarnings: 0, soldHours: 0, actualHours: 0, completedLines: 0, rows: [] }) as Summary;

  return (
    <main className="tech-page tech-earnings-page">
      <div className="tech-shell">
        <header className="tech-header">
          <div><div className="eyebrow">Technician workspace</div><h1>My Earnings</h1><p>Production and pay credit from the service lines assigned to you.</p></div>
          <div className="tech-header-actions"><span>{displayName}</span><Link className="button secondary" href="/tech">Work queue</Link>{role === "owner" ? <Link className="button secondary" href="/admin/people">Owner production</Link> : null}<form action={signOutOwner}><button className="button secondary" type="submit">Sign out</button></form></div>
        </header>

        {error ? <div className="form-error">Earnings could not be loaded.</div> : null}
        <section className="tech-earnings-summary">
          <article className="accent"><span>Pending</span><strong>{money(summary.pendingEarnings)}</strong></article>
          <article><span>Paid</span><strong>{money(summary.paidEarnings)}</strong></article>
          <article><span>Sold hours credit</span><strong>{Number(summary.soldHours || 0).toFixed(1)}</strong></article>
          <article><span>Actual hours</span><strong>{Number(summary.actualHours || 0).toFixed(1)}</strong></article>
          <article><span>Completed services</span><strong>{summary.completedLines || 0}</strong></article>
        </section>

        <section className="tech-earnings-list">
          <div className="tech-earnings-head"><span>RO / Service</span><span>Sold</span><span>Actual</span><span>Pay</span><span>Status</span></div>
          {summary.rows?.length ? summary.rows.map((row) => (
            <div className="tech-earning-row" key={row.assignmentId}>
              <div><strong>{row.roNumber} · Line {row.lineNumber}</strong><span>{row.title || "Service"}</span></div>
              <span>{Number(row.soldHours || 0).toFixed(1)} hr</span>
              <span>{Number(row.actualHours || 0).toFixed(1)} hr</span>
              <strong>{money(row.earnings)}</strong>
              <div><span className={`status-pill status-${row.payStatus}`}>{titleCase(row.payStatus)}</span>{row.payPeriodName ? <small>{row.payPeriodName}</small> : null}</div>
            </div>
          )) : <div className="tech-empty">No assigned production yet.</div>}
        </section>
      </div>
    </main>
  );
}
