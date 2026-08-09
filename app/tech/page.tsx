import Link from "next/link";
import { requireTech } from "@/lib/auth/tech";
import { signOutOwner } from "@/app/admin/actions";

export const metadata = { title: "Tech View", robots: { index: false, follow: false } };

type RepairOrderRow = {
  id: string; ro_number: string; status: string; original_complaint: string; promised_at: string | null; updated_at: string;
  customers: { full_name: string; phone: string; company_name: string | null } | null;
  vehicles: { year: number | null; make: string; model: string; vin: string | null; license_plate: string | null; unit_number: string | null } | null;
};
type JobRow = {
  id: string; repair_order_id: string; line_number: number; title: string; customer_concern: string;
  authorization_status: string; work_status: string; technician_findings: string | null; correction_performed: string | null;
};

function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function vehicleName(ro: RepairOrderRow) { const v = ro.vehicles; return v ? `${v.year || ""} ${v.make} ${v.model}`.trim() : "Vehicle unavailable"; }
function promisedLabel(value: string | null) { return value ? new Date(value).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No promised time"; }

export default async function TechQueuePage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  const { filter = "ready", q = "" } = await searchParams;
  const { supabase, user, role, displayName } = await requireTech();
  const [{ data: roData, error }, { data: jobData }] = await Promise.all([
    supabase.from("repair_orders").select("id,ro_number,status,original_complaint,promised_at,updated_at,customers(full_name,phone,company_name),vehicles(year,make,model,vin,license_plate,unit_number)").order("updated_at", { ascending: false }).limit(250),
    supabase.from("ro_jobs").select("id,repair_order_id,line_number,title,customer_concern,authorization_status,work_status,technician_findings,correction_performed").order("line_number"),
  ]);
  const repairOrders = (roData || []) as unknown as RepairOrderRow[];
  const jobs = (jobData || []) as JobRow[];
  const jobsByRo = new Map<string, JobRow[]>();
  for (const job of jobs) { const current = jobsByRo.get(job.repair_order_id) || []; current.push(job); jobsByRo.set(job.repair_order_id, current); }
  const query = q.trim().toLowerCase();

  const jobBucket = (job: JobRow) => {
    if (job.work_status === "completed") return "done";
    if (["waiting_parts", "blocked"].includes(job.work_status) || ["pending", "deferred", "declined"].includes(job.authorization_status)) return "waiting";
    return "ready";
  };
  const roBucket = (ro: RepairOrderRow) => {
    const roJobs = jobsByRo.get(ro.id) || [];
    if (roJobs.some((job) => jobBucket(job) === "ready")) return "ready";
    if (roJobs.some((job) => jobBucket(job) === "waiting")) return "waiting";
    return "done";
  };
  const matchesSearch = (ro: RepairOrderRow) => {
    if (!query) return true;
    const roJobs = jobsByRo.get(ro.id) || [];
    return [ro.ro_number, ro.original_complaint, ro.customers?.full_name, ro.customers?.company_name, ro.vehicles?.make, ro.vehicles?.model, ro.vehicles?.vin, ro.vehicles?.license_plate, ro.vehicles?.unit_number, ...roJobs.flatMap((job) => [job.title, job.customer_concern])].filter(Boolean).join(" ").toLowerCase().includes(query);
  };
  const visible = repairOrders.filter((ro) => (filter === "all" || roBucket(ro) === filter) && matchesSearch(ro));
  const counts = { ready: repairOrders.filter((ro) => roBucket(ro) === "ready").length, waiting: repairOrders.filter((ro) => roBucket(ro) === "waiting").length, done: repairOrders.filter((ro) => roBucket(ro) === "done").length, all: repairOrders.length };
  const filters = [["Ready", "ready", counts.ready], ["Waiting", "waiting", counts.waiting], ["Done", "done", counts.done], ["All", "all", counts.all]] as const;

  return (
    <main className="tech-page">
      <div className="tech-shell">
        <header className="tech-header">
          <div><div className="eyebrow">Technician workspace</div><h1>Work Queue</h1><p>Your assigned service lines: work them, document them, request parts, and complete approved work.</p></div>
          <div className="tech-header-actions"><span>{displayName || user.email}</span><Link className="button secondary" href="/tech/earnings">My earnings</Link>{role === "owner" ? <Link className="button secondary" href="/admin/repair-orders">Owner view</Link> : null}<form action={signOutOwner}><button className="button secondary" type="submit">Sign out</button></form></div>
        </header>

        <form className="tech-search" action="/tech" method="get"><input type="hidden" name="filter" value={filter} /><input name="q" defaultValue={q} placeholder="Search RO, vehicle, VIN, concern, service..." aria-label="Search work queue" /><button className="button" type="submit">Search</button></form>
        <nav className="tech-filter-tabs" aria-label="Work queue filters">{filters.map(([label, value, count]) => <Link className={filter === value ? "active" : ""} href={`/tech?filter=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`} key={value}><span>{label}</span><b>{count}</b></Link>)}</nav>
        {error ? <div className="form-error">The technician queue could not load.</div> : null}

        <section className="tech-ro-list">
          {visible.length === 0 && !error ? <div className="tech-empty">No repair orders match this view.</div> : null}
          {visible.map((ro) => {
            const roJobs = jobsByRo.get(ro.id) || [];
            const firstOpen = roJobs.find((job) => jobBucket(job) === "ready") || roJobs.find((job) => jobBucket(job) === "waiting") || roJobs[0];
            const doneCount = roJobs.filter((job) => job.work_status === "completed").length;
            const href = firstOpen ? `/tech/repair-orders/${ro.id}?line=${firstOpen.id}` : `/tech/repair-orders/${ro.id}`;
            return (
              <Link className="tech-ro-card" href={href} key={ro.id}>
                <div className="tech-ro-primary"><div className="tech-ro-number-row"><strong>{ro.ro_number}</strong><span className={`status-pill status-${roBucket(ro)}`}>{titleCase(roBucket(ro))}</span></div><h2>{vehicleName(ro)}</h2><p>{ro.customers?.full_name || "Customer"}{ro.customers?.company_name ? ` · ${ro.customers.company_name}` : ""}</p><small>{ro.vehicles?.unit_number ? `Unit ${ro.vehicles.unit_number}` : ro.vehicles?.license_plate ? `Plate ${ro.vehicles.license_plate}` : ro.vehicles?.vin ? `VIN ${ro.vehicles.vin}` : ""}</small></div>
                <div className="tech-ro-services"><div className="tech-ro-services-head"><span>Assigned services</span><strong>{doneCount}/{roJobs.length} complete</strong></div>{roJobs.slice(0, 4).map((job) => <div className="tech-ro-service-row" key={job.id}><span>#{job.line_number} {job.title || "Untitled service"}</span><b className={`tech-dot tech-dot-${job.work_status}`} title={titleCase(job.work_status)} /></div>)}{roJobs.length > 4 ? <small>+{roJobs.length - 4} more services</small> : null}</div>
                <div className="tech-ro-meta"><span>Promised</span><strong>{promisedLabel(ro.promised_at)}</strong><span>Concern</span><p>{ro.original_complaint || "No concern entered"}</p><b className="tech-open-arrow">Open →</b></div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
