import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireOwner } from "@/lib/auth/owner";
import { createWorker, removeAssignment, saveAssignment, updateWorker } from "./actions";

export const metadata = { title: "People & Production", robots: { index: false, follow: false } };

const payMethods = [
  ["sold_hour", "Per sold hour"],
  ["actual_hour", "Per actual hour"],
  ["fixed", "Fixed per service"],
  ["labor_percent", "% of labor revenue"],
  ["revenue_percent", "% of service revenue"],
  ["manual", "Manual amount"],
  ["none", "No technician pay"],
] as const;

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}
function hours(value: unknown) { return Number(value || 0).toFixed(1); }
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()); }

type Worker = {
  id: string; user_id: string | null; email: string | null; display_name: string; worker_type: string; active: boolean;
  compensation_method: string; compensation_rate: number; notes: string | null;
};
type Metric = Worker & {
  assignment_count: number; completed_lines: number; production_revenue: number; parts_cost: number; sold_hours: number; actual_hours: number;
  earnings_total: number; pending_earnings: number; paid_earnings: number; company_contribution: number;
};
type Job = { id: string; repair_order_id: string; line_number: number; title: string; work_status: string; authorization_status: string; };
type RepairOrder = { id: string; ro_number: string; vehicles: { year: number | null; make: string; model: string; unit_number: string | null } | null; };
type Assignment = { id: string; ro_job_id: string; worker_id: string; credit_percent: number; sold_hours_credit: number | null; compensation_method: string; compensation_rate: number; manual_pay: number | null; pay_period_id: string | null; };

export default async function PeoplePage() {
  const { supabase, user } = await requireOwner();
  const [{ data: summaryData }, { data: workerData }, { data: jobData }, { data: roData }, { data: assignmentData }] = await Promise.all([
    supabase.rpc("owner_workforce_summary"),
    supabase.from("workers").select("id,user_id,email,display_name,worker_type,active,compensation_method,compensation_rate,notes").order("worker_type").order("display_name"),
    supabase.from("ro_jobs").select("id,repair_order_id,line_number,title,work_status,authorization_status").neq("work_status", "completed").order("created_at", { ascending: false }).limit(150),
    supabase.from("repair_orders").select("id,ro_number,vehicles(year,make,model,unit_number)").order("opened_at", { ascending: false }).limit(150),
    supabase.from("ro_job_assignments").select("id,ro_job_id,worker_id,credit_percent,sold_hours_credit,compensation_method,compensation_rate,manual_pay,pay_period_id"),
  ]);

  const workers = (workerData || []) as Worker[];
  const metrics = ((summaryData as { workers?: Metric[] } | null)?.workers || []) as Metric[];
  const totals = (summaryData as { totals?: Record<string, number> } | null)?.totals || {};
  const jobs = (jobData || []) as Job[];
  const repairOrders = (roData || []) as unknown as RepairOrder[];
  const assignments = (assignmentData || []) as Assignment[];
  const roMap = new Map(repairOrders.map((ro) => [ro.id, ro]));
  const metricMap = new Map(metrics.map((metric) => [metric.id, metric]));
  const activeWorkers = workers.filter((worker) => worker.active);

  return (
    <main className="admin-page workforce-page">
      <div className="shell">
        <header className="admin-header compact-admin-header">
          <div><div className="eyebrow">Owner operations</div><h1>People & Production</h1><p className="section-copy">Track who performed each service, what they earned, and what the work contributed to NW Star.</p></div>
          <div className="admin-account"><span>{user.email}</span><Link href="/tech">Tech view →</Link></div>
        </header>
        <AdminNav current="people" />

        <section className="workforce-summary-grid">
          <article><span>Production revenue</span><strong>{money(totals.productionRevenue)}</strong></article>
          <article><span>Direct parts cost</span><strong>{money(totals.partsCost)}</strong></article>
          <article><span>Technician pay</span><strong>{money(totals.technicianPay)}</strong></article>
          <article><span>Pending pay</span><strong>{money(totals.pendingPay)}</strong></article>
          <article className="accent"><span>NW Star contribution</span><strong>{money(totals.companyContribution)}</strong></article>
        </section>

        <section className="workforce-two-column">
          <article className="admin-panel">
            <div className="panel-label">Add person</div>
            <h2>Worker or technician</h2>
            <p className="admin-muted">Email + temporary password creates a Tech View login. Leave both blank to track someone without a login yet.</p>
            <form action={createWorker} className="admin-form-grid">
              <div className="field"><label>Name</label><input name="displayName" placeholder="John Smith" /></div>
              <div className="field"><label>Type</label><select name="workerType" defaultValue="contractor"><option value="contractor">Contractor</option><option value="employee">Employee</option></select></div>
              <div className="field"><label>Email</label><input name="email" type="email" /></div>
              <div className="field"><label>Temporary password</label><input name="temporaryPassword" type="password" minLength={8} /></div>
              <div className="field"><label>Default pay method</label><select name="compensationMethod" defaultValue="sold_hour">{payMethods.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="field"><label>Default rate</label><input name="compensationRate" type="number" min="0" step="0.01" placeholder="40" /></div>
              <div className="field full"><label>Notes</label><textarea name="notes" /></div>
              <div className="field full"><button className="button" type="submit">Add person</button></div>
            </form>
          </article>

          <article className="admin-panel workforce-pay-explainer">
            <div className="panel-label">How the numbers work</div>
            <h2>Customer revenue → worker pay → company contribution</h2>
            <p><strong>Production revenue</strong><span>The share of RO line revenue credited to that person.</span></p>
            <p><strong>Worker earnings</strong><span>Calculated from the worker's pay rule or line-specific override.</span></p>
            <p><strong>NW Star contribution</strong><span>Production revenue minus direct part cost and that worker's earnings, before overhead and taxes.</span></p>
            <Link className="button secondary" href="/admin/pay">Open pay periods</Link>
          </article>
        </section>

        <div className="ro-section-heading"><div><div className="eyebrow">Team</div><h2>Worker performance</h2></div><span>{workers.length} people</span></div>
        <section className="worker-card-grid">
          {workers.map((worker) => {
            const metric = metricMap.get(worker.id);
            return (
              <article className={`admin-panel worker-card ${worker.active ? "" : "inactive"}`} key={worker.id}>
                <header><div><span className="panel-label">{titleCase(worker.worker_type)}</span><h2>{worker.display_name}</h2><small>{worker.email || (worker.user_id ? "Login linked" : "No login")}</small></div><span className={`status-pill status-${worker.active ? "completed" : "cancelled"}`}>{worker.active ? "Active" : "Inactive"}</span></header>
                <div className="worker-metrics">
                  <div><span>Revenue produced</span><strong>{money(metric?.production_revenue)}</strong></div>
                  <div><span>Earnings</span><strong>{money(metric?.earnings_total)}</strong></div>
                  <div><span>Pending</span><strong>{money(metric?.pending_earnings)}</strong></div>
                  <div><span>Parts cost</span><strong>{money(metric?.parts_cost)}</strong></div>
                  <div><span>Sold / actual</span><strong>{hours(metric?.sold_hours)} / {hours(metric?.actual_hours)} hr</strong></div>
                  <div><span>NW Star contribution</span><strong>{money(metric?.company_contribution)}</strong></div>
                </div>
                {worker.worker_type !== "owner" ? (
                  <details className="inline-disclosure">
                    <summary>Edit person and pay rule</summary>
                    <form action={updateWorker} className="admin-form-grid compact-item-form">
                      <input type="hidden" name="workerId" value={worker.id} />
                      <div className="field"><label>Name</label><input name="displayName" defaultValue={worker.display_name} /></div>
                      <div className="field"><label>Email</label><input name="email" type="email" defaultValue={worker.email || ""} /></div>
                      <div className="field"><label>Type</label><select name="workerType" defaultValue={worker.worker_type}><option value="contractor">Contractor</option><option value="employee">Employee</option></select></div>
                      <div className="field"><label>Pay method</label><select name="compensationMethod" defaultValue={worker.compensation_method}>{payMethods.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                      <div className="field"><label>Rate</label><input name="compensationRate" type="number" min="0" step="0.01" defaultValue={worker.compensation_rate} /></div>
                      <label className="checkbox-label"><input type="checkbox" name="active" value="yes" defaultChecked={worker.active} /> Active</label>
                      <div className="field full"><label>Notes</label><textarea name="notes" defaultValue={worker.notes || ""} /></div>
                      <div className="field full"><button className="button secondary" type="submit">Save person</button></div>
                    </form>
                  </details>
                ) : null}
              </article>
            );
          })}
        </section>

        <div className="ro-section-heading"><div><div className="eyebrow">Assignment board</div><h2>Open service lines</h2></div><span>{jobs.length} open lines</span></div>
        <section className="assignment-board">
          {jobs.map((job) => {
            const ro = roMap.get(job.repair_order_id);
            const jobAssignments = assignments.filter((assignment) => assignment.ro_job_id === job.id);
            const usedCredit = jobAssignments.reduce((sum, assignment) => sum + Number(assignment.credit_percent || 0), 0);
            const vehicle = ro?.vehicles ? `${ro.vehicles.year || ""} ${ro.vehicles.make} ${ro.vehicles.model}`.trim() : "Vehicle";
            return (
              <article className="admin-panel assignment-row" key={job.id}>
                <div className="assignment-title"><div><Link href={`/admin/repair-orders/${job.repair_order_id}/team`}><strong>{ro?.ro_number || "RO"} · Line {job.line_number}</strong></Link><h3>{job.title || "Untitled service"}</h3><small>{vehicle}{ro?.vehicles?.unit_number ? ` · Unit ${ro.vehicles.unit_number}` : ""}</small></div><span className={`status-pill status-${job.work_status}`}>{titleCase(job.work_status)}</span></div>
                <div className="assignment-chips">
                  {jobAssignments.map((assignment) => {
                    const worker = workers.find((item) => item.id === assignment.worker_id);
                    return <span key={assignment.id}>{worker?.display_name || "Worker"} · {Number(assignment.credit_percent).toFixed(0)}%</span>;
                  })}
                  {jobAssignments.length === 0 ? <span>Unassigned</span> : null}
                </div>
                <details className="inline-disclosure">
                  <summary>{jobAssignments.length ? "Add / update assignment" : "Assign technician"} · {Math.max(0,100-usedCredit).toFixed(0)}% credit available</summary>
                  <form action={saveAssignment} className="admin-form-grid compact-item-form">
                    <input type="hidden" name="repairOrderId" value={job.repair_order_id} />
                    <input type="hidden" name="jobId" value={job.id} />
                    <div className="field"><label>Person</label><select name="workerId" defaultValue=""> <option value="" disabled>Select</option>{activeWorkers.map((worker) => <option key={worker.id} value={worker.id}>{worker.display_name}</option>)}</select></div>
                    <div className="field"><label>Production credit %</label><input name="creditPercent" type="number" min="0" max="100" step="0.1" defaultValue={Math.max(0,100-usedCredit)} /></div>
                    <div className="field"><label>Sold hours credit override</label><input name="soldHoursCredit" type="number" min="0" step="0.1" placeholder="Auto from labor" /></div>
                    <div className="field"><label>Pay method override</label><select name="compensationMethod" defaultValue=""><option value="">Use worker default</option>{payMethods.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                    <div className="field"><label>Rate override</label><input name="compensationRate" type="number" min="0" step="0.01" /></div>
                    <div className="field"><label>Manual pay</label><input name="manualPay" type="number" min="0" step="0.01" /></div>
                    <div className="field full"><button className="button secondary" type="submit">Save assignment</button></div>
                  </form>
                  {jobAssignments.map((assignment) => (
                    <form action={removeAssignment} key={assignment.id} className="assignment-remove-row"><input type="hidden" name="assignmentId" value={assignment.id} /><input type="hidden" name="repairOrderId" value={job.repair_order_id} /><span>{workers.find((w)=>w.id===assignment.worker_id)?.display_name || "Worker"} · {assignment.credit_percent}%</span><button type="submit" className="text-button danger" disabled={Boolean(assignment.pay_period_id)}>Remove</button></form>
                  ))}
                </details>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
