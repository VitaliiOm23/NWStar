import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireOwner } from "@/lib/auth/owner";
import { buildPayPeriod, markPayPeriodPaid } from "./actions";

export const metadata = { title: "Technician Pay", robots: { index: false, follow: false } };

function money(value: unknown) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0)); }
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()); }
function dateLabel(value: string | null) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }

type Period = { id: string; name: string; start_date: string; end_date: string; status: string; paid_at: string | null; created_at: string; };
type Entry = { id: string; pay_period_id: string; worker_id: string; ro_job_id: string; production_revenue: number; parts_cost: number; sold_hours: number; actual_hours: number; earnings_amount: number; company_contribution: number; paid_at: string | null; };
type Worker = { id: string; display_name: string; worker_type: string; };
type Job = { id: string; line_number: number; title: string; repair_order_id: string; };
type RO = { id: string; ro_number: string; };

export default async function PayPage() {
  const { supabase, user } = await requireOwner();
  const [{ data: periodsData }, { data: entriesData }, { data: workersData }, { data: jobsData }, { data: roData }, { data: summaryData }] = await Promise.all([
    supabase.from("pay_periods").select("id,name,start_date,end_date,status,paid_at,created_at").order("start_date", { ascending: false }),
    supabase.from("pay_period_entries").select("id,pay_period_id,worker_id,ro_job_id,production_revenue,parts_cost,sold_hours,actual_hours,earnings_amount,company_contribution,paid_at"),
    supabase.from("workers").select("id,display_name,worker_type"),
    supabase.from("ro_jobs").select("id,line_number,title,repair_order_id"),
    supabase.from("repair_orders").select("id,ro_number"),
    supabase.rpc("owner_workforce_summary"),
  ]);
  const periods = (periodsData || []) as Period[];
  const entries = (entriesData || []) as Entry[];
  const workers = (workersData || []) as Worker[];
  const jobs = (jobsData || []) as Job[];
  const ros = (roData || []) as RO[];
  const workerMap = new Map(workers.map((item) => [item.id, item]));
  const jobMap = new Map(jobs.map((item) => [item.id, item]));
  const roMap = new Map(ros.map((item) => [item.id, item]));
  const pendingPay = Number((summaryData as { totals?: { pendingPay?: number } } | null)?.totals?.pendingPay || 0);

  return (
    <main className="admin-page workforce-page">
      <div className="shell">
        <header className="admin-header compact-admin-header">
          <div><div className="eyebrow">Owner operations</div><h1>Technician Pay</h1><p className="section-copy">Lock completed work into a pay period, review each worker's exact earnings, then mark the period paid.</p></div>
          <div className="admin-account"><span>{user.email}</span><Link href="/admin/people">People & production →</Link></div>
        </header>
        <AdminNav current="pay" />

        <section className="workforce-summary-grid pay-summary-grid">
          <article className="accent"><span>Unpaid completed work</span><strong>{money(pendingPay)}</strong></article>
          <article><span>Pay periods</span><strong>{periods.length}</strong></article>
          <article><span>Paid periods</span><strong>{periods.filter((p) => p.status === "paid").length}</strong></article>
        </section>

        <section className="workforce-two-column">
          <article className="admin-panel">
            <div className="panel-label">Create pay period</div>
            <h2>Snapshot completed work</h2>
            <p className="admin-muted">Only completed, unpaid technician assignments whose completion date falls inside this range are included.</p>
            <form action={buildPayPeriod} className="admin-form-grid">
              <div className="field full"><label>Name</label><input name="name" placeholder="Aug 1–15" /></div>
              <div className="field"><label>Start date</label><input name="startDate" type="date" /></div>
              <div className="field"><label>End date</label><input name="endDate" type="date" /></div>
              <div className="field full"><button className="button" type="submit">Build pay period</button></div>
            </form>
          </article>
          <article className="admin-panel workforce-pay-explainer">
            <div className="panel-label">Pay lock</div>
            <h2>Paid work stays historically correct.</h2>
            <p><strong>Before pay period</strong><span>Earnings update as sold hours, actual time, prices and assignments change.</span></p>
            <p><strong>Inside pay period</strong><span>Revenue credit, direct parts cost, technician earnings and company contribution are snapshotted.</span></p>
            <p><strong>After marked paid</strong><span>The assignment is locked to that payout so it cannot be paid twice.</span></p>
          </article>
        </section>

        <div className="ro-section-heading"><div><div className="eyebrow">History</div><h2>Pay periods</h2></div></div>
        <section className="pay-period-list">
          {periods.length === 0 ? <article className="admin-panel"><p className="admin-muted">No pay periods yet.</p></article> : null}
          {periods.map((period) => {
            const periodEntries = entries.filter((entry) => entry.pay_period_id === period.id);
            const workerIds = [...new Set(periodEntries.map((entry) => entry.worker_id))];
            const totalPay = periodEntries.reduce((sum, entry) => sum + Number(entry.earnings_amount), 0);
            const production = periodEntries.reduce((sum, entry) => sum + Number(entry.production_revenue), 0);
            const contribution = periodEntries.reduce((sum, entry) => sum + Number(entry.company_contribution), 0);
            return (
              <details className="admin-disclosure pay-period-card" key={period.id} open={period.status !== "paid"}>
                <summary><span><strong>{period.name}</strong><small>{dateLabel(period.start_date)} – {dateLabel(period.end_date)}</small></span><span><b>{money(totalPay)}</b><small>{titleCase(period.status)}</small></span></summary>
                <div className="pay-period-summary">
                  <div><span>Production</span><strong>{money(production)}</strong></div>
                  <div><span>Technician pay</span><strong>{money(totalPay)}</strong></div>
                  <div><span>NW Star contribution</span><strong>{money(contribution)}</strong></div>
                  <div><span>Assignments</span><strong>{periodEntries.length}</strong></div>
                </div>
                {workerIds.map((workerId) => {
                  const worker = workerMap.get(workerId);
                  const workerEntries = periodEntries.filter((entry) => entry.worker_id === workerId);
                  const workerPay = workerEntries.reduce((sum, entry) => sum + Number(entry.earnings_amount), 0);
                  return (
                    <div className="pay-worker-block" key={workerId}>
                      <header><strong>{worker?.display_name || "Worker"}</strong><span>{money(workerPay)}</span></header>
                      {workerEntries.map((entry) => {
                        const job = jobMap.get(entry.ro_job_id);
                        const ro = job ? roMap.get(job.repair_order_id) : null;
                        return (
                          <div className="pay-entry-row" key={entry.id}>
                            <span>{ro?.ro_number || "RO"} · Line {job?.line_number || "—"} · {job?.title || "Service"}</span>
                            <span>{Number(entry.sold_hours).toFixed(1)} sold / {Number(entry.actual_hours).toFixed(1)} actual hr</span>
                            <strong>{money(entry.earnings_amount)}</strong>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {period.status !== "paid" ? <form action={markPayPeriodPaid}><input type="hidden" name="periodId" value={period.id} /><button className="button" type="submit" disabled={periodEntries.length === 0}>Mark {money(totalPay)} paid</button></form> : <p className="admin-muted">Paid {period.paid_at ? new Date(period.paid_at).toLocaleString("en-US") : ""}</p>}
              </details>
            );
          })}
        </section>
      </div>
    </main>
  );
}
