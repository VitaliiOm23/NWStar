import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/owner";
import { removeAssignment, saveAssignment } from "@/app/admin/people/actions";
import { addTrackedPart, convertPartRequest, updatePartRequestStatus, updateTrackedPart } from "../../team-actions";

export const metadata = { title: "RO Team & Parts", robots: { index: false, follow: false } };

const payMethods = [
  ["sold_hour", "Per sold hour"],
  ["actual_hour", "Per actual hour"],
  ["fixed", "Fixed per service"],
  ["labor_percent", "% labor revenue"],
  ["revenue_percent", "% service revenue"],
  ["manual", "Manual"],
  ["none", "No pay"],
] as const;
const units = ["ea", "set", "kit", "qt", "gal", "L", "mL", "oz", "lb", "ft", "in", "bottle", "tube"];
const partStatuses = ["requested", "sourced", "ordered", "received", "installed", "not_needed"];

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}
function titleCase(value: string | null | undefined) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
function qty(value: unknown) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

type Job = { id: string; repair_order_id: string; line_number: number; title: string; customer_concern: string; authorization_status: string; work_status: string };
type Worker = { id: string; display_name: string; worker_type: string; active: boolean; compensation_method: string; compensation_rate: number };
type Assignment = { id: string; ro_job_id: string; worker_id: string; credit_percent: number; sold_hours_credit: number | null; compensation_method: string; compensation_rate: number; manual_pay: number | null; pay_period_id: string | null; paid_at: string | null };
type Item = { id: string; ro_job_id: string; item_type: string; description: string; part_number: string | null; part_condition: string | null; quantity: number; unit: string; unit_cost: number | null; unit_price: number; taxable: boolean; source_part_request_id: string | null };
type PartRequest = { id: string; ro_job_id: string; description: string; part_number: string | null; quantity: number; unit: string; notes: string | null; status: string; converted_ro_item_id: string | null; created_at: string };
type TimeEntry = { id: string; ro_job_id: string; worker_id: string; started_at: string; ended_at: string | null };
type RO = { id: string; ro_number: string; status: string; customers: { full_name: string } | null; vehicles: { year: number | null; make: string; model: string; vin: string | null; unit_number: string | null } | null };

function earning(assignment: Assignment, laborRevenue: number, lineRevenue: number, soldHours: number, actualHours: number) {
  const credit = Number(assignment.credit_percent || 0) / 100;
  const soldCredit = assignment.sold_hours_credit == null ? soldHours * credit : Number(assignment.sold_hours_credit);
  const rate = Number(assignment.compensation_rate || 0);
  switch (assignment.compensation_method) {
    case "sold_hour": return soldCredit * rate;
    case "actual_hour": return actualHours * rate;
    case "fixed": return rate;
    case "labor_percent": return laborRevenue * credit * rate / 100;
    case "revenue_percent": return lineRevenue * credit * rate / 100;
    case "manual": return Number(assignment.manual_pay ?? rate);
    default: return 0;
  }
}

export default async function ROTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOwner();
  const { data: jobIdsData } = await supabase.from("ro_jobs").select("id").eq("repair_order_id", id);
  const jobIds = jobIdsData?.map((row) => row.id) || ["00000000-0000-0000-0000-000000000000"];

  const [
    { data: roData },
    { data: jobsData },
    { data: workersData },
    { data: assignmentsData },
    { data: itemsData },
    { data: requestsData },
    { data: timeData },
  ] = await Promise.all([
    supabase.from("repair_orders").select("id,ro_number,status,customers(full_name),vehicles(year,make,model,vin,unit_number)").eq("id", id).maybeSingle(),
    supabase.from("ro_jobs").select("id,repair_order_id,line_number,title,customer_concern,authorization_status,work_status").eq("repair_order_id", id).order("line_number"),
    supabase.from("workers").select("id,display_name,worker_type,active,compensation_method,compensation_rate").order("display_name"),
    supabase.from("ro_job_assignments").select("id,ro_job_id,worker_id,credit_percent,sold_hours_credit,compensation_method,compensation_rate,manual_pay,pay_period_id,paid_at").in("ro_job_id", jobIds),
    supabase.from("ro_items").select("id,ro_job_id,item_type,description,part_number,part_condition,quantity,unit,unit_cost,unit_price,taxable,source_part_request_id").in("ro_job_id", jobIds),
    supabase.from("ro_part_requests").select("id,ro_job_id,description,part_number,quantity,unit,notes,status,converted_ro_item_id,created_at").eq("repair_order_id", id).order("created_at", { ascending: false }),
    supabase.from("technician_time_entries").select("id,ro_job_id,worker_id,started_at,ended_at").in("ro_job_id", jobIds),
  ]);

  if (!roData) notFound();
  const ro = roData as unknown as RO;
  const jobs = (jobsData || []) as Job[];
  const workers = (workersData || []) as Worker[];
  const assignments = (assignmentsData || []) as Assignment[];
  const items = (itemsData || []) as Item[];
  const requests = (requestsData || []) as PartRequest[];
  const timeEntries = (timeData || []) as TimeEntry[];
  const activeWorkers = workers.filter((worker) => worker.active);
  const vehicle = ro.vehicles ? `${ro.vehicles.year || ""} ${ro.vehicles.make} ${ro.vehicles.model}`.trim() : "Vehicle";

  return (
    <main className="admin-page workforce-page ro-team-page">
      <div className="shell">
        <header className="admin-header compact-admin-header">
          <div>
            <div className="eyebrow">{ro.ro_number} · Team & Parts</div>
            <h1>{vehicle}</h1>
            <p className="section-copy">{ro.customers?.full_name || "Customer"} · production, actual time, technician pay, and quantity-aware parts.</p>
          </div>
          <div className="admin-account">
            <Link className="button secondary" href={`/admin/repair-orders/${id}`}>← Full RO</Link>
            <Link href="/admin/people">People & production →</Link>
          </div>
        </header>

        <section className="ro-team-legend admin-panel">
          <div><strong>Production credit</strong><span>Split a service across multiple people, for example 70/30.</span></div>
          <div><strong>Sold vs actual</strong><span>Sold hours come from customer labor. Actual hours come from technician timers.</span></div>
          <div><strong>Parts</strong><span>Track 4 seals, 6 qt oil, 2 bottles, 1 kit, or any other quantity/unit combination.</span></div>
        </section>

        <section className="ro-team-lines">
          {jobs.map((job) => {
            const lineItems = items.filter((item) => item.ro_job_id === job.id);
            const laborRevenue = lineItems.filter((item) => item.item_type === "labor").reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
            const soldHours = lineItems.filter((item) => item.item_type === "labor").reduce((sum, item) => sum + Number(item.quantity), 0);
            const lineRevenue = lineItems.reduce((sum, item) => sum + (item.item_type === "discount" ? -Math.abs(Number(item.quantity) * Number(item.unit_price)) : Number(item.quantity) * Number(item.unit_price)), 0);
            const partsCost = lineItems.filter((item) => item.item_type === "part").reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_cost || 0), 0);
            const lineAssignments = assignments.filter((assignment) => assignment.ro_job_id === job.id);
            const lineRequests = requests.filter((request) => request.ro_job_id === job.id);
            const pricedParts = lineItems.filter((item) => item.item_type === "part");
            const usedCredit = lineAssignments.reduce((sum, assignment) => sum + Number(assignment.credit_percent || 0), 0);

            return (
              <article className="admin-panel ro-team-line" key={job.id}>
                <header className="ro-team-line-head">
                  <div><span className="ro-line-number">Line {job.line_number}</span><h2>{job.title || "Untitled service"}</h2><p>{job.customer_concern || "No concern entered"}</p></div>
                  <div><span className={`status-pill status-${job.work_status}`}>{titleCase(job.work_status)}</span><strong>{money(lineRevenue)}</strong></div>
                </header>

                <div className="line-production-strip">
                  <div><span>Revenue</span><strong>{money(lineRevenue)}</strong></div>
                  <div><span>Sold labor</span><strong>{soldHours.toFixed(1)} hr</strong></div>
                  <div><span>Parts cost</span><strong>{money(partsCost)}</strong></div>
                  <div><span>Credit available</span><strong>{Math.max(0, 100 - usedCredit).toFixed(0)}%</strong></div>
                </div>

                <div className="ro-team-columns">
                  <section>
                    <div className="tech-card-heading"><span>People</span><strong>{lineAssignments.length}</strong></div>
                    {lineAssignments.length === 0 ? <p className="admin-muted">Unassigned. A technician cannot see this line until assigned.</p> : null}

                    {lineAssignments.map((assignment) => {
                      const worker = workers.find((item) => item.id === assignment.worker_id);
                      const entries = timeEntries.filter((entry) => entry.ro_job_id === job.id && entry.worker_id === assignment.worker_id);
                      const actualHours = entries.reduce((sum, entry) => sum + (new Date(entry.ended_at || new Date().toISOString()).getTime() - new Date(entry.started_at).getTime()) / 3600000, 0);
                      const workerPay = earning(assignment, laborRevenue, lineRevenue, soldHours, actualHours);
                      const production = lineRevenue * Number(assignment.credit_percent) / 100;
                      const allocatedPartsCost = partsCost * Number(assignment.credit_percent) / 100;
                      const contribution = production - allocatedPartsCost - workerPay;
                      const locked = Boolean(assignment.pay_period_id);

                      return (
                        <details className="assignment-detail" key={assignment.id} open={lineAssignments.length === 1}>
                          <summary>
                            <span><strong>{worker?.display_name || "Worker"}</strong><small>{assignment.credit_percent}% · {actualHours.toFixed(1)} actual hr</small></span>
                            <span><b>{money(workerPay)} pay</b><small>{money(contribution)} NW Star contribution</small></span>
                          </summary>
                          <form action={saveAssignment} className="admin-form-grid compact-item-form">
                            <input type="hidden" name="repairOrderId" value={id} />
                            <input type="hidden" name="jobId" value={job.id} />
                            <input type="hidden" name="workerId" value={assignment.worker_id} />
                            <div className="field"><label>Production %</label><input name="creditPercent" type="number" min="0" max="100" step="0.1" defaultValue={assignment.credit_percent} disabled={locked} /></div>
                            <div className="field"><label>Sold hrs override</label><input name="soldHoursCredit" type="number" min="0" step="0.1" defaultValue={assignment.sold_hours_credit ?? ""} placeholder="Auto" disabled={locked} /></div>
                            <div className="field"><label>Pay method</label><select name="compensationMethod" defaultValue={assignment.compensation_method} disabled={locked}>{payMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                            <div className="field"><label>Rate</label><input name="compensationRate" type="number" min="0" step="0.01" defaultValue={assignment.compensation_rate} disabled={locked} /></div>
                            <div className="field"><label>Manual pay</label><input name="manualPay" type="number" min="0" step="0.01" defaultValue={assignment.manual_pay ?? ""} disabled={locked} /></div>
                            <div className="field"><label>Calculated pay</label><div className="calculated-field">{money(workerPay)}</div></div>
                            {locked ? <p className="admin-muted field full">Locked in a pay period.</p> : <div className="field full"><button className="button secondary" type="submit">Update assignment</button></div>}
                          </form>
                          {!locked ? (
                            <form action={removeAssignment} className="assignment-remove-row">
                              <input type="hidden" name="assignmentId" value={assignment.id} /><input type="hidden" name="repairOrderId" value={id} />
                              <span>Remove {worker?.display_name || "worker"}</span><button className="text-button danger" type="submit">Remove</button>
                            </form>
                          ) : null}
                        </details>
                      );
                    })}

                    <details className="inline-disclosure" open={lineAssignments.length === 0}>
                      <summary>+ Assign person · {Math.max(0, 100 - usedCredit).toFixed(0)}% available</summary>
                      <form action={saveAssignment} className="admin-form-grid compact-item-form">
                        <input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="jobId" value={job.id} />
                        <div className="field"><label>Person</label><select name="workerId" defaultValue=""><option value="" disabled>Select</option>{activeWorkers.filter((worker) => !lineAssignments.some((a) => a.worker_id === worker.id)).map((worker) => <option key={worker.id} value={worker.id}>{worker.display_name}</option>)}</select></div>
                        <div className="field"><label>Production %</label><input name="creditPercent" type="number" min="0" max="100" step="0.1" defaultValue={Math.max(0, 100 - usedCredit)} /></div>
                        <div className="field"><label>Sold hrs override</label><input name="soldHoursCredit" type="number" min="0" step="0.1" placeholder="Auto" /></div>
                        <div className="field"><label>Pay method override</label><select name="compensationMethod" defaultValue=""><option value="">Worker default</option>{payMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                        <div className="field"><label>Rate override</label><input name="compensationRate" type="number" min="0" step="0.01" /></div>
                        <div className="field"><label>Manual pay</label><input name="manualPay" type="number" min="0" step="0.01" /></div>
                        <div className="field full"><button className="button secondary" type="submit">Assign</button></div>
                      </form>
                    </details>
                  </section>

                  <section>
                    <div className="tech-card-heading"><span>Requested parts / materials</span><strong>{lineRequests.length}</strong></div>
                    {lineRequests.length === 0 ? <p className="admin-muted">No technician parts requests.</p> : null}
                    {lineRequests.map((request) => (
                      <details className="part-request-owner" key={request.id} open={request.status === "requested"}>
                        <summary>
                          <span><strong>{qty(request.quantity)} {request.unit} · {request.description}</strong><small>{request.part_number || "No part #"}{request.notes ? ` · ${request.notes}` : ""}</small></span>
                          <span className={`status-pill status-${request.status}`}>{titleCase(request.status)}</span>
                        </summary>
                        <form action={updatePartRequestStatus} className="inline-status-form">
                          <input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="requestId" value={request.id} />
                          <select name="status" defaultValue={request.status}>{partStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select>
                          <button className="button secondary" type="submit">Update</button>
                        </form>
                        <form action={convertPartRequest} className="admin-form-grid compact-item-form">
                          <input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="requestId" value={request.id} />
                          <div className="field"><label>Description</label><input name="description" defaultValue={request.description} /></div>
                          <div className="field"><label>Part #</label><input name="partNumber" defaultValue={request.part_number || ""} /></div>
                          <div className="field"><label>Qty</label><input name="quantity" type="number" min="0.001" step="0.001" defaultValue={request.quantity} /></div>
                          <div className="field"><label>Unit</label><select name="unit" defaultValue={request.unit || "ea"}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div>
                          <div className="field"><label>Unit cost</label><input name="unitCost" type="number" min="0" step="0.01" /></div>
                          <div className="field"><label>Customer unit price</label><input name="unitPrice" type="number" min="0" step="0.01" /></div>
                          <div className="field"><label>Condition</label><select name="partCondition" defaultValue="new_oem"><option value="new_oem">New OEM</option><option value="new_aftermarket">New aftermarket</option><option value="rebuilt">Rebuilt</option><option value="used">Used</option><option value="customer_supplied">Customer supplied</option></select></div>
                          <div className="field"><label>Next status</label><select name="nextStatus" defaultValue="sourced"><option value="sourced">Sourced</option><option value="ordered">Ordered</option><option value="received">Received</option></select></div>
                          <label className="checkbox-label"><input type="checkbox" name="taxable" value="yes" defaultChecked /> Taxable</label>
                          <div className="field full"><button className="button secondary" type="submit">{request.converted_ro_item_id ? "Update priced part" : "Convert to priced part"}</button></div>
                        </form>
                      </details>
                    ))}
                  </section>
                </div>

                <details className="line-section" open={pricedParts.length > 0}>
                  <summary><span>Billable / tracked parts</span><small>{pricedParts.length} part line{pricedParts.length === 1 ? "" : "s"}</small></summary>
                  <div className="tracked-parts-grid">
                    {pricedParts.map((part) => (
                      <form action={updateTrackedPart} className="tracked-part-card" key={part.id}>
                        <input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="itemId" value={part.id} />
                        <div className="tracked-part-title"><strong>{qty(part.quantity)} {part.unit} · {part.description}</strong><span>{money(Number(part.quantity) * Number(part.unit_price))}</span></div>
                        <div className="admin-form-grid compact-item-form">
                          <div className="field"><label>Description</label><input name="description" defaultValue={part.description} /></div>
                          <div className="field"><label>Part #</label><input name="partNumber" defaultValue={part.part_number || ""} /></div>
                          <div className="field"><label>Qty</label><input name="quantity" type="number" min="0.001" step="0.001" defaultValue={part.quantity} /></div>
                          <div className="field"><label>Unit</label><select name="unit" defaultValue={part.unit || "ea"}>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div>
                          <div className="field"><label>Unit cost</label><input name="unitCost" type="number" min="0" step="0.01" defaultValue={part.unit_cost ?? ""} /></div>
                          <div className="field"><label>Unit price</label><input name="unitPrice" type="number" min="0" step="0.01" defaultValue={part.unit_price} /></div>
                          <div className="field"><label>Condition</label><select name="partCondition" defaultValue={part.part_condition || ""}><option value="">Not set</option><option value="new_oem">New OEM</option><option value="new_aftermarket">New aftermarket</option><option value="rebuilt">Rebuilt</option><option value="used">Used</option><option value="customer_supplied">Customer supplied</option></select></div>
                          <label className="checkbox-label"><input type="checkbox" name="taxable" value="yes" defaultChecked={part.taxable} /> Taxable</label>
                          <div className="field full"><button className="button secondary" type="submit">Save part</button></div>
                        </div>
                      </form>
                    ))}
                  </div>

                  <details className="inline-disclosure">
                    <summary>+ Add part directly</summary>
                    <form action={addTrackedPart} className="admin-form-grid compact-item-form">
                      <input type="hidden" name="repairOrderId" value={id} /><input type="hidden" name="jobId" value={job.id} />
                      <div className="field"><label>Description</label><input name="description" placeholder="Oil filter seal" /></div>
                      <div className="field"><label>Part #</label><input name="partNumber" /></div>
                      <div className="field"><label>Qty</label><input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" /></div>
                      <div className="field"><label>Unit</label><select name="unit" defaultValue="ea">{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div>
                      <div className="field"><label>Unit cost</label><input name="unitCost" type="number" min="0" step="0.01" /></div>
                      <div className="field"><label>Unit price</label><input name="unitPrice" type="number" min="0" step="0.01" /></div>
                      <div className="field"><label>Condition</label><select name="partCondition" defaultValue="new_oem"><option value="new_oem">New OEM</option><option value="new_aftermarket">New aftermarket</option><option value="rebuilt">Rebuilt</option><option value="used">Used</option><option value="customer_supplied">Customer supplied</option></select></div>
                      <label className="checkbox-label"><input type="checkbox" name="taxable" value="yes" defaultChecked /> Taxable</label>
                      <div className="field full"><button className="button secondary" type="submit">Add tracked part</button></div>
                    </form>
                  </details>
                </details>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
