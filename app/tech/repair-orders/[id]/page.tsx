import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTech } from "@/lib/auth/tech";
import { signOutOwner } from "@/app/admin/actions";
import { submitTechParts, updateTechLine } from "../../actions";

export const metadata = {
  title: "Tech RO",
  robots: { index: false, follow: false },
};

type RepairOrder = {
  id: string;
  ro_number: string;
  status: string;
  original_complaint: string;
  customer_instructions: string | null;
  odometer_in: number | null;
  promised_at: string | null;
  opened_at: string;
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
    mileage: number | null;
    license_plate: string | null;
    unit_number: string | null;
  } | null;
};

type Job = {
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
  deferred_reason: string | null;
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

type PartRequest = {
  id: string;
  ro_job_id: string;
  description: string;
  status: string;
  created_at: string;
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

function promisedLabel(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function submittedLabel(value: string) {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function TechRepairOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ line?: string }>;
}) {
  const { id } = await params;
  const { line } = await searchParams;
  const { supabase, user, role, displayName } = await requireTech();

  const jobIdsResult = await supabase.from("ro_jobs").select("id").eq("repair_order_id", id);
  const jobIds = jobIdsResult.data?.map((job) => job.id) || ["00000000-0000-0000-0000-000000000000"];

  const [
    { data: roData, error },
    { data: jobData },
    { data: itemData },
    { data: partRequestData },
  ] = await Promise.all([
    supabase
      .from("repair_orders")
      .select("id,ro_number,status,original_complaint,customer_instructions,odometer_in,promised_at,opened_at,customers(full_name,phone,company_name),vehicles(year,make,model,vin,mileage,license_plate,unit_number)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("ro_jobs")
      .select("id,repair_order_id,line_number,title,customer_concern,technician_findings,recommended_action,correction_performed,authorization_status,authorized_amount,deferred_reason")
      .eq("repair_order_id", id)
      .order("line_number"),
    supabase
      .from("ro_items")
      .select("id,ro_job_id,item_type,description,part_number,part_condition,quantity,unit_price,taxable")
      .in("ro_job_id", jobIds),
    supabase
      .from("ro_part_requests")
      .select("id,ro_job_id,description,status,created_at")
      .eq("repair_order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (error || !roData) notFound();

  const ro = roData as unknown as RepairOrder;
  const jobs = (jobData || []) as Job[];
  const items = (itemData || []) as Item[];
  const partRequests = (partRequestData || []) as PartRequest[];
  const selected = jobs.find((job) => job.id === line) || jobs.find((job) => job.authorization_status === "approved") || jobs[0] || null;
  const selectedItems = selected ? items.filter((item) => item.ro_job_id === selected.id) : [];
  const selectedPartRequests = selected ? partRequests.filter((item) => item.ro_job_id === selected.id) : [];
  const lineTotal = selectedItems.reduce((sum, item) => sum + extended(item), 0);
  const laborHours = selectedItems.filter((item) => item.item_type === "labor").reduce((sum, item) => sum + Number(item.quantity), 0);
  const customer = ro.customers;
  const vehicle = ro.vehicles;
  const vehicleName = vehicle ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim() : "Vehicle unavailable";
  const canComplete = selected ? ["approved", "completed"].includes(selected.authorization_status) : false;

  return (
    <main className="tech-page tech-ro-page">
      <div className="tech-shell tech-shell-wide">
        <header className="tech-ro-header">
          <div className="tech-ro-header-main">
            <Link className="tech-back" href="/tech">← Work queue</Link>
            <div>
              <div className="eyebrow">{ro.ro_number}</div>
              <h1>{vehicleName}</h1>
              <p>{customer?.full_name || "Unknown customer"}{customer?.company_name ? ` · ${customer.company_name}` : ""}</p>
            </div>
          </div>
          <div className="tech-header-actions">
            <span className={`status-pill status-${ro.status}`}>{titleCase(ro.status)}</span>
            {role === "owner" ? <Link className="button secondary" href={`/admin/repair-orders/${ro.id}`}>Full RO</Link> : null}
            <form action={signOutOwner}><button className="button secondary" type="submit">Sign out</button></form>
            <small>{displayName || user.email}</small>
          </div>
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
            <div className="tech-sidebar-heading">
              <div><span>Service lines</span><strong>{jobs.length}</strong></div>
              <small>Owner-controlled list</small>
            </div>
            <nav className="tech-service-list" aria-label="Repair order service lines">
              {jobs.map((job) => (
                <Link className={selected?.id === job.id ? "active" : ""} href={`/tech/repair-orders/${ro.id}?line=${job.id}`} key={job.id}>
                  <span className="tech-service-line-number">#{job.line_number}</span>
                  <div><strong>{job.title || "Untitled service"}</strong><small>{titleCase(job.authorization_status)}</small></div>
                  <b className={`tech-dot tech-dot-${job.authorization_status}`} />
                </Link>
              ))}
            </nav>
            {jobs.length === 0 ? <p className="tech-sidebar-empty">No service lines have been added by the owner yet.</p> : null}
          </aside>

          <div className="tech-service-main">
            {!selected ? (
              <div className="tech-empty tech-empty-large">
                <h2>No service line available</h2>
                <p>The owner needs to add a service line before technician work can begin.</p>
                {role === "owner" ? <Link className="button" href={`/admin/repair-orders/${ro.id}`}>Open full RO</Link> : null}
              </div>
            ) : (
              <>
                <header className="tech-service-titlebar">
                  <div>
                    <span>Line {selected.line_number}</span>
                    <h2>{selected.title || "Untitled service"}</h2>
                    <p>{selected.customer_concern || "No customer concern entered."}</p>
                  </div>
                  <div>
                    <span className={`status-pill status-${selected.authorization_status}`}>{titleCase(selected.authorization_status)}</span>
                    <strong>{money(lineTotal)}</strong>
                    <small>{laborHours ? `${laborHours.toFixed(1)} labor hr` : "No labor entered"}</small>
                  </div>
                </header>

                {selected.authorization_status === "pending" ? <div className="tech-callout waiting">Waiting for customer authorization. Save diagnosis and recommendations, but do not perform unapproved repair work.</div> : null}
                {selected.authorization_status === "declined" ? <div className="tech-callout blocked">Customer declined this service. Notes and parts requests can still be documented.</div> : null}
                {selected.authorization_status === "deferred" ? <div className="tech-callout waiting">Service deferred{selected.deferred_reason ? `: ${selected.deferred_reason}` : "."}</div> : null}

                <div className="tech-service-grid tech-service-grid-workflow">
                  <section className="tech-work-card tech-work-card-primary">
                    <div className="tech-card-heading"><span>Technician work</span><strong>Diagnosis → recommendation → correction</strong></div>
                    <form action={updateTechLine} className="tech-work-form">
                      <input type="hidden" name="repairOrderId" value={ro.id} />
                      <input type="hidden" name="jobId" value={selected.id} />
                      <div className="field">
                        <label htmlFor="technicianFindings">Findings / cause</label>
                        <textarea id="technicianFindings" name="technicianFindings" defaultValue={selected.technician_findings || ""} placeholder="What you found, measurements, faults, root cause..." />
                      </div>
                      <div className="field">
                        <label htmlFor="recommendedAction">Recommendation</label>
                        <textarea id="recommendedAction" name="recommendedAction" defaultValue={selected.recommended_action || ""} placeholder="What should be repaired, replaced, programmed, tested, or inspected next..." />
                      </div>
                      <div className="field">
                        <label htmlFor="correctionPerformed">Correction performed</label>
                        <textarea id="correctionPerformed" name="correctionPerformed" defaultValue={selected.correction_performed || ""} placeholder="What was actually repaired, replaced, programmed, tested..." />
                      </div>
                      <div className="tech-work-actions">
                        <button className="button secondary" name="intent" value="save" type="submit">Save work</button>
                        <button className="button" name="intent" value="complete" type="submit" disabled={!canComplete || selected.authorization_status === "completed"}>
                          {selected.authorization_status === "completed" ? "Service completed" : "Complete service"}
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="tech-work-card tech-parts-request-card">
                    <div className="tech-card-heading"><span>Parts needed</span><strong>{selectedPartRequests.length} submitted</strong></div>
                    <p className="tech-muted">Add one part per line. This is a request list only; it does not change customer pricing or the invoice.</p>
                    <form action={submitTechParts} className="tech-parts-request-form">
                      <input type="hidden" name="repairOrderId" value={ro.id} />
                      <input type="hidden" name="jobId" value={selected.id} />
                      <div className="field">
                        <label htmlFor="partsList">Parts list</label>
                        <textarea id="partsList" name="partsList" placeholder={"Glow plug\nIntake manifold gasket\nCoolant hose"} />
                      </div>
                      <button className="button secondary" type="submit">Submit parts needed</button>
                    </form>
                    <div className="tech-parts-request-list">
                      {selectedPartRequests.length === 0 ? <p className="tech-muted">No parts requested yet.</p> : null}
                      {selectedPartRequests.map((part) => (
                        <div className="tech-parts-request-row" key={part.id}>
                          <div><strong>{part.description}</strong><small>{submittedLabel(part.created_at)}</small></div>
                          <span className={`status-pill status-${part.status}`}>{titleCase(part.status)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="tech-work-card tech-items-card">
                  <div className="tech-card-heading"><span>RO labor + priced parts</span><strong>{money(lineTotal)}</strong></div>
                  <p className="tech-muted">Read-only in Tech View. Pricing, labor entries, and billable parts are controlled by the owner.</p>
                  {selectedItems.length === 0 ? <p className="tech-muted">No labor, parts, fees, or sublet items entered on this service.</p> : null}
                  <div className="tech-item-list">
                    {selectedItems.map((item) => (
                      <div className="tech-item-row" key={item.id}>
                        <span className="tech-item-type">{titleCase(item.item_type)}</span>
                        <div>
                          <strong>{item.description}</strong>
                          <small>
                            {item.item_type === "labor"
                              ? `${Number(item.quantity).toFixed(1)} hr × ${money(item.unit_price)}/hr`
                              : `${Number(item.quantity)} × ${money(item.unit_price)}`}
                            {item.part_number ? ` · ${item.part_number}` : ""}
                            {item.part_condition ? ` · ${titleCase(item.part_condition)}` : ""}
                          </small>
                        </div>
                        <strong>{money(extended(item))}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
