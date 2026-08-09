import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTech } from "@/lib/auth/tech";
import { signOutOwner } from "@/app/admin/actions";
import { startTechTimer, stopTechTimer, updateTechLine } from "../../actions";
import { TechPartsForm } from "@/components/TechPartsForm";

export const metadata = { title: "Tech RO", robots: { index: false, follow: false } };

type RepairOrder = {
  id: string; ro_number: string; status: string; original_complaint: string; customer_instructions: string | null; odometer_in: number | null; promised_at: string | null;
  customers: { full_name: string; phone: string; company_name: string | null } | null;
  vehicles: { year: number | null; make: string; model: string; vin: string | null; mileage: number | null; license_plate: string | null; unit_number: string | null } | null;
};
type Job = {
  id: string; repair_order_id: string; line_number: number; title: string; customer_concern: string; technician_findings: string | null;
  recommended_action: string | null; correction_performed: string | null; authorization_status: string; work_status: string; deferred_reason: string | null;
};
type PartRequest = { id: string; ro_job_id: string; description: string; part_number: string | null; quantity: number; unit: string; notes: string | null; status: string; created_at: string; };
type TimeEntry = { id: string; ro_job_id: string; worker_id: string; started_at: string; ended_at: string | null; };

function titleCase(value: string | null | undefined) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function promisedLabel(value: string | null) { return value ? new Date(value).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not set"; }
function submittedLabel(value: string) { return new Date(value).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function qty(value: number) { return Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""); }

export default async function TechRepairOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ line?: string }> }) {
  const { id } = await params;
  const { line } = await searchParams;
  const { supabase, user, role, displayName, workerId } = await requireTech();
  const [{ data: roData, error }, { data: jobData }, { data: partRequestData }] = await Promise.all([
    supabase.from("repair_orders").select("id,ro_number,status,original_complaint,customer_instructions,odometer_in,promised_at,customers(full_name,phone,company_name),vehicles(year,make,model,vin,mileage,license_plate,unit_number)").eq("id", id).maybeSingle(),
    supabase.from("ro_jobs").select("id,repair_order_id,line_number,title,customer_concern,technician_findings,recommended_action,correction_performed,authorization_status,work_status,deferred_reason").eq("repair_order_id", id).order("line_number"),
    supabase.from("ro_part_requests").select("id,ro_job_id,description,part_number,quantity,unit,notes,status,created_at").eq("repair_order_id", id).order("created_at", { ascending: false }),
  ]);
  if (error || !roData) notFound();

  const ro = roData as unknown as RepairOrder;
  const jobs = (jobData || []) as Job[];
  const partRequests = (partRequestData || []) as PartRequest[];
  const selected = jobs.find((job) => job.id === line) || jobs.find((job) => ["ready", "in_progress", "diagnosing", "recommendation_ready"].includes(job.work_status)) || jobs[0] || null;
  const selectedPartRequests = selected ? partRequests.filter((part) => part.ro_job_id === selected.id) : [];
  const { data: timeData } = workerId && selected ? await supabase.from("technician_time_entries").select("id,ro_job_id,worker_id,started_at,ended_at").eq("ro_job_id", selected.id).eq("worker_id", workerId).order("started_at") : { data: [] };
  const timeEntries = (timeData || []) as TimeEntry[];
  const now = Date.now();
  const actualHours = timeEntries.reduce((sum, entry) => sum + ((entry.ended_at ? new Date(entry.ended_at).getTime() : now) - new Date(entry.started_at).getTime()) / 3600000, 0);
  const activeTimer = timeEntries.find((entry) => !entry.ended_at) || null;
  const customer = ro.customers;
  const vehicle = ro.vehicles;
  const vehicleName = vehicle ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim() : "Vehicle unavailable";
  const canComplete = selected ? ["approved", "completed"].includes(selected.authorization_status) && selected.work_status !== "completed" : false;

  return (
    <main className="tech-page tech-ro-page">
      <div className="tech-shell tech-shell-wide">
        <header className="tech-ro-header">
          <div className="tech-ro-header-main"><Link className="tech-back" href="/tech">← Work queue</Link><div><div className="eyebrow">{ro.ro_number}</div><h1>{vehicleName}</h1><p>{customer?.full_name || "Customer"}{customer?.company_name ? ` · ${customer.company_name}` : ""}</p></div></div>
          <div className="tech-header-actions"><Link className="button secondary" href="/tech/earnings">My earnings</Link>{role === "owner" ? <Link className="button secondary" href={`/admin/repair-orders/${ro.id}`}>Full RO</Link> : null}<form action={signOutOwner}><button className="button secondary" type="submit">Sign out</button></form><small>{displayName || user.email}</small></div>
        </header>

        <section className="tech-ro-facts">
          <div><span>Customer concern</span><strong>{ro.original_complaint || "—"}</strong></div>
          <div><span>Promised</span><strong>{promisedLabel(ro.promised_at)}</strong></div>
          <div><span>Odometer</span><strong>{ro.odometer_in ?? vehicle?.mileage ?? "—"}</strong></div>
          <div><span>Unit / plate</span><strong>{vehicle?.unit_number || vehicle?.license_plate || "—"}</strong></div>
          <div><span>VIN</span><strong>{vehicle?.vin || "—"}</strong></div>
        </section>

        <section className="tech-service-workspace">
          <aside className="tech-service-sidebar">
            <div className="tech-sidebar-heading"><div><span>Assigned service lines</span><strong>{jobs.length}</strong></div><small>Owner controls assignments</small></div>
            <nav className="tech-service-list" aria-label="Repair order service lines">{jobs.map((job) => <Link className={selected?.id === job.id ? "active" : ""} href={`/tech/repair-orders/${ro.id}?line=${job.id}`} key={job.id}><span className="tech-service-line-number">#{job.line_number}</span><div><strong>{job.title || "Untitled service"}</strong><small>{titleCase(job.work_status)}</small></div><b className={`tech-dot tech-dot-${job.work_status}`} /></Link>)}</nav>
            {jobs.length === 0 ? <p className="tech-sidebar-empty">No service lines are assigned to you.</p> : null}
          </aside>

          <div className="tech-service-main">
            {!selected ? <div className="tech-empty tech-empty-large"><h2>No assigned service line</h2><p>The owner needs to assign work before it appears here.</p></div> : <>
              <header className="tech-service-titlebar"><div><span>Line {selected.line_number}</span><h2>{selected.title || "Untitled service"}</h2><p>{selected.customer_concern || "No customer concern entered."}</p></div><div><span className={`status-pill status-${selected.authorization_status}`}>{titleCase(selected.authorization_status)}</span><strong>{titleCase(selected.work_status)}</strong><small>{actualHours.toFixed(1)} actual hr</small></div></header>

              {selected.authorization_status === "pending" ? <div className="tech-callout waiting">Diagnosis and recommendations can be documented. Do not perform unapproved repair work.</div> : null}
              {selected.authorization_status === "declined" ? <div className="tech-callout blocked">Customer declined this service.</div> : null}
              {selected.authorization_status === "deferred" ? <div className="tech-callout waiting">Service deferred{selected.deferred_reason ? `: ${selected.deferred_reason}` : "."}</div> : null}

              <div className="tech-service-grid tech-service-grid-workflow">
                <section className="tech-work-card tech-work-card-primary">
                  <div className="tech-card-heading"><span>Technician work</span><strong>Diagnosis → recommendation → correction</strong></div>
                  <form action={updateTechLine} className="tech-work-form">
                    <input type="hidden" name="repairOrderId" value={ro.id} /><input type="hidden" name="jobId" value={selected.id} />
                    <div className="field"><label htmlFor="technicianFindings">Findings / cause</label><textarea id="technicianFindings" name="technicianFindings" defaultValue={selected.technician_findings || ""} placeholder="What you found, measurements, faults, root cause..." /></div>
                    <div className="field"><label htmlFor="recommendedAction">Recommendation</label><textarea id="recommendedAction" name="recommendedAction" defaultValue={selected.recommended_action || ""} placeholder="What should be repaired, replaced, programmed, tested, or inspected next..." /></div>
                    <div className="field"><label htmlFor="correctionPerformed">Correction performed</label><textarea id="correctionPerformed" name="correctionPerformed" defaultValue={selected.correction_performed || ""} placeholder="What was actually repaired, replaced, programmed, or tested..." /></div>
                    <div className="tech-work-actions"><button className="button secondary" name="intent" value="save" type="submit">Save work</button><button className="button" name="intent" value="complete" type="submit" disabled={!canComplete}>{selected.work_status === "completed" ? "Service completed" : "Complete service"}</button></div>
                  </form>
                </section>

                <section className="tech-work-card tech-time-card">
                  <div className="tech-card-heading"><span>Actual time</span><strong>{actualHours.toFixed(1)} hr</strong></div>
                  <div className={`tech-timer-state ${activeTimer ? "running" : ""}`}><strong>{activeTimer ? "Timer running" : "Timer stopped"}</strong><span>{activeTimer ? `Started ${submittedLabel(activeTimer.started_at)}` : "Start when you begin active work on this service."}</span></div>
                  {activeTimer ? <form action={stopTechTimer}><input type="hidden" name="repairOrderId" value={ro.id} /><input type="hidden" name="jobId" value={selected.id} /><button className="button" type="submit">Stop timer</button></form> : <form action={startTechTimer}><input type="hidden" name="repairOrderId" value={ro.id} /><input type="hidden" name="jobId" value={selected.id} /><button className="button" type="submit" disabled={selected.work_status === "completed"}>Start timer</button></form>}
                  <p className="tech-muted">Actual time is internal production tracking. It does not change what the customer is billed.</p>
                </section>
              </div>

              <section className="tech-work-card tech-parts-request-card">
                <div className="tech-card-heading"><span>Parts / materials needed</span><strong>{selectedPartRequests.length} submitted</strong></div>
                <p className="tech-muted">Use quantity + unit for repeat items and fluids: 4 ea seals, 6 qt oil, 2 bottles cleaner, 1 kit.</p>
                <TechPartsForm repairOrderId={ro.id} jobId={selected.id} />
                <div className="tech-parts-request-list">{selectedPartRequests.length === 0 ? <p className="tech-muted">No parts requested yet.</p> : selectedPartRequests.map((part) => <div className="tech-parts-request-row" key={part.id}><div><strong>{qty(part.quantity)} {part.unit} · {part.description}</strong><small>{part.part_number ? `${part.part_number} · ` : ""}{part.notes ? `${part.notes} · ` : ""}{submittedLabel(part.created_at)}</small></div><span className={`status-pill status-${part.status}`}>{titleCase(part.status)}</span></div>)}</div>
              </section>
            </>}
          </div>
        </section>
      </div>
    </main>
  );
}
