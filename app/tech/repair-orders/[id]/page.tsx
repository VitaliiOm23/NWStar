import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/owner";
import { signOutOwner } from "@/app/admin/actions";
import { updateTechLine } from "../../actions";

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

export default async function TechRepairOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ line?: string }>;
}) {
  const { id } = await params;
  const { line } = await searchParams;
  const { supabase, user } = await requireOwner();

  const [{ data: roData, error }, { data: jobData }, { data: itemData }] = await Promise.all([
    supabase
      .from("repair_orders")
      .select("id,ro_number,status,original_complaint,customer_instructions,odometer_in,promised_at,opened_at,customers(full_name,phone,company_name),vehicles(year,make,model,vin,mileage,license_plate,unit_number)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ro_jobs").select("id,repair_order_id,line_number,title,customer_concern,technician_findings,recommended_action,correction_performed,authorization_status,authorized_amount,deferred_reason").eq("repair_order_id", id).order("line_number"),
    supabase
      .from("ro_items")
      .select("id,ro_job_id,item_type,description,part_number,part_condition,quantity,unit_price,taxable")
      .in("ro_job_id", (await supabase.from("ro_jobs").select("id").eq("repair_order_id", id)).data?.map((job) => job.id) || ["00000000-0000-0000-0000-000000000000"]),
  ]);

  if (error || !roData) notFound();

  const ro = roData as unknown as RepairOrder;
  const jobs = (jobData || []) as Job[];
  const items = (itemData || []) as Item[];
  const selected = jobs.find((job) => job.id === line) || jobs.find((job) => job.authorization_status === "approved") || jobs[0] || null;
  const selectedItems = selected ? items.filter((item) => item.ro_job_id === selected.id) : [];
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
            <Link className="button secondary" href={`/admin/repair-orders/${ro.id}`}>Full RO</Link>
            <form action={signOutOwner}><button className="button secondary" type="submit">Sign out</button></form>
            <small>{user.email}</small>
          </div>
        </header>

        <section className="tech-ro-facts">
          <div><span>Customer concern</span><strong>{ro.original_complaint}</strong></div>
          <div><span>Promised</span><strong>{promisedLabel(ro.promised_at)}</strong></div>
          <div><span>Odometer</span><strong>{ro.odometer_in ?? vehicle?.mileage ?? "—"}</strong></div>
          <div><span>Unit / plate</span><strong>{vehicle?.unit_number || vehicle?.license_plate || "—"}</strong></div>
          <div><span>VIN</span><strong>{vehicle?.vin || "—"}</strong></div>
        </section>

        <section className="tech-service-workspace">
          <aside className="tech-service-sidebar">
            <div className="tech-sidebar-heading">
              <div><span>Service lines</span><strong>{jobs.length}</strong></div>
              <Link href={`/admin/repair-orders/${ro.id}`}>Manage lines +</Link>
            </div>
            <nav className="tech-service-list" aria-label="Repair order service lines">
              {jobs.map((job) => (
                <Link className={selected?.id === job.id ? "active" : ""} href={`/tech/repair-orders/${ro.id}?line=${job.id}`} key={job.id}>
                  <span className="tech-service-line-number">#{job.line_number}</span>
                  <div><strong>{job.title}</strong><small>{titleCase(job.authorization_status)}</small></div>
                  <b className={`tech-dot tech-dot-${job.authorization_status}`} />
                </Link>
              ))}
            </nav>
            {jobs.length === 0 ? <p className="tech-sidebar-empty">No service lines yet.</p> : null}
          </aside>

          <div className="tech-service-main">
            {!selected ? (
              <div className="tech-empty tech-empty-large">
                <h2>No service line selected</h2>
                <p>Add a line from the full RO, then it will appear here.</p>
                <Link className="button" href={`/admin/repair-orders/${ro.id}`}>Open full RO</Link>
              </div>
            ) : (
              <>
                <header className="tech-service-titlebar">
                  <div>
                    <span>Line {selected.line_number}</span>
                    <h2>{selected.title}</h2>
                    <p>{selected.customer_concern}</p>
                  </div>
                  <div>
                    <span className={`status-pill status-${selected.authorization_status}`}>{titleCase(selected.authorization_status)}</span>
                    <strong>{money(lineTotal)}</strong>
                    <small>{laborHours ? `${laborHours.toFixed(1)} labor hr` : "No labor entered"}</small>
                  </div>
                </header>

                {selected.authorization_status === "pending" ? <div className="tech-callout waiting">Waiting for customer authorization. Diagnosis notes can still be saved, but do not perform unapproved work.</div> : null}
                {selected.authorization_status === "declined" ? <div className="tech-callout blocked">Customer declined this service.</div> : null}
                {selected.authorization_status === "deferred" ? <div className="tech-callout waiting">Service deferred{selected.deferred_reason ? `: ${selected.deferred_reason}` : "."}</div> : null}

                <div className="tech-service-grid">
                  <section className="tech-work-card tech-work-card-primary">
                    <div className="tech-card-heading"><span>Technician work</span><strong>Cause + correction</strong></div>
                    <form action={updateTechLine} className="tech-work-form">
                      <input type="hidden" name="repairOrderId" value={ro.id} />
                      <input type="hidden" name="jobId" value={selected.id} />
                      <div className="field">
                        <label htmlFor="technicianFindings">Findings / cause</label>
                        <textarea id="technicianFindings" name="technicianFindings" defaultValue={selected.technician_findings || ""} placeholder="What you found, measurements, faults, root cause..." />
                      </div>
                      <div className="field">
                        <label htmlFor="correctionPerformed">Correction performed</label>
                        <textarea id="correctionPerformed" name="correctionPerformed" defaultValue={selected.correction_performed || ""} placeholder="What was repaired, replaced, programmed, tested..." />
                      </div>
                      <div className="tech-work-actions">
                        <button className="button secondary" name="intent" value="save" type="submit">Save notes</button>
                        <button className="button" name="intent" value="complete" type="submit" disabled={!canComplete || selected.authorization_status === "completed"}>
                          {selected.authorization_status === "completed" ? "Service completed" : "Mark service complete"}
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="tech-work-card">
                    <div className="tech-card-heading"><span>Service plan</span><strong>Recommendation</strong></div>
                    <div className="tech-readout">
                      <div><span>Customer requested</span><p>{selected.customer_concern || "—"}</p></div>
                      <div><span>Recommended action</span><p>{selected.recommended_action || "No recommendation entered yet."}</p></div>
                      <div><span>Authorized amount</span><p>{selected.authorized_amount === null ? "Not recorded" : money(selected.authorized_amount)}</p></div>
                    </div>
                  </section>
                </div>

                <section className="tech-work-card tech-items-card">
                  <div className="tech-card-heading"><span>Parts + labor</span><strong>{money(lineTotal)}</strong></div>
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
                  <Link className="tech-manage-link" href={`/admin/repair-orders/${ro.id}?line=${selected.id}`}>Add or edit labor/parts in full RO →</Link>
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
