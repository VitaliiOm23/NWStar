import Link from "next/link";
import { requireTech } from "@/lib/auth/tech";
import { signOutOwner } from "@/app/admin/actions";

export const metadata = {
  title: "Tech View",
  robots: { index: false, follow: false },
};

type RepairOrderRow = {
  id: string;
  ro_number: string;
  status: string;
  original_complaint: string;
  promised_at: string | null;
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
    license_plate: string | null;
    unit_number: string | null;
  } | null;
};

type JobRow = {
  id: string;
  repair_order_id: string;
  line_number: number;
  title: string;
  customer_concern: string;
  authorization_status: string;
  technician_findings: string | null;
  correction_performed: string | null;
};

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function vehicleName(ro: RepairOrderRow) {
  const vehicle = ro.vehicles;
  return vehicle ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim() : "Vehicle unavailable";
}

function promisedLabel(value: string | null) {
  if (!value) return "No promised time";
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function TechQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter = "active", q = "" } = await searchParams;
  const { supabase, user, role, displayName } = await requireTech();

  const [{ data: roData, error }, { data: jobData }] = await Promise.all([
    supabase
      .from("repair_orders")
      .select("id,ro_number,status,original_complaint,promised_at,updated_at,customers(full_name,phone,company_name),vehicles(year,make,model,vin,license_plate,unit_number)")
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase
      .from("ro_jobs")
      .select("id,repair_order_id,line_number,title,customer_concern,authorization_status,technician_findings,correction_performed")
      .order("line_number"),
  ]);

  const repairOrders = (roData || []) as unknown as RepairOrderRow[];
  const jobs = (jobData || []) as JobRow[];
  const jobsByRo = new Map<string, JobRow[]>();
  for (const job of jobs) {
    const current = jobsByRo.get(job.repair_order_id) || [];
    current.push(job);
    jobsByRo.set(job.repair_order_id, current);
  }

  const activeStatuses = new Set(["draft", "awaiting_authorization", "authorized", "in_progress", "waiting_parts", "completed", "invoiced"]);
  const query = q.trim().toLowerCase();

  const matchesFilter = (ro: RepairOrderRow) => {
    if (filter === "all") return true;
    if (filter === "progress") return ["authorized", "in_progress"].includes(ro.status);
    if (filter === "waiting") return ["awaiting_authorization", "waiting_parts"].includes(ro.status);
    if (filter === "done") return ["completed", "invoiced", "paid", "closed"].includes(ro.status);
    return activeStatuses.has(ro.status);
  };

  const matchesSearch = (ro: RepairOrderRow) => {
    if (!query) return true;
    const roJobs = jobsByRo.get(ro.id) || [];
    const haystack = [
      ro.ro_number,
      ro.original_complaint,
      ro.customers?.full_name,
      ro.customers?.company_name,
      ro.vehicles?.make,
      ro.vehicles?.model,
      ro.vehicles?.vin,
      ro.vehicles?.license_plate,
      ro.vehicles?.unit_number,
      ...roJobs.flatMap((job) => [job.title, job.customer_concern]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  };

  const visible = repairOrders.filter((ro) => matchesFilter(ro) && matchesSearch(ro));
  const counts = {
    active: repairOrders.filter((ro) => activeStatuses.has(ro.status)).length,
    progress: repairOrders.filter((ro) => ["authorized", "in_progress"].includes(ro.status)).length,
    waiting: repairOrders.filter((ro) => ["awaiting_authorization", "waiting_parts"].includes(ro.status)).length,
    done: repairOrders.filter((ro) => ["completed", "invoiced", "paid", "closed"].includes(ro.status)).length,
    all: repairOrders.length,
  };

  const filters = [
    ["Active", "active", counts.active],
    ["In progress", "progress", counts.progress],
    ["Waiting", "waiting", counts.waiting],
    ["Completed", "done", counts.done],
    ["All", "all", counts.all],
  ] as const;

  return (
    <main className="tech-page">
      <div className="tech-shell">
        <header className="tech-header">
          <div>
            <div className="eyebrow">Technician workspace</div>
            <h1>Work Queue</h1>
            <p>Open an RO, move between assigned service lines, submit findings and recommendations, request parts, and complete approved work.</p>
          </div>
          <div className="tech-header-actions">
            <span>{displayName || user.email}</span>
            {role === "owner" ? <Link className="button secondary" href="/admin/repair-orders">Owner view</Link> : null}
            <form action={signOutOwner}><button className="button secondary" type="submit">Sign out</button></form>
          </div>
        </header>

        <form className="tech-search" action="/tech" method="get">
          <input type="hidden" name="filter" value={filter} />
          <input name="q" defaultValue={q} placeholder="Search RO, vehicle, VIN, customer, concern, service..." aria-label="Search work queue" />
          <button className="button" type="submit">Search</button>
        </form>

        <nav className="tech-filter-tabs" aria-label="Work queue filters">
          {filters.map(([label, value, count]) => (
            <Link className={filter === value ? "active" : ""} href={`/tech?filter=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`} key={value}>
              <span>{label}</span><b>{count}</b>
            </Link>
          ))}
        </nav>

        {error ? <div className="form-error">The technician queue could not load.</div> : null}

        <section className="tech-ro-list">
          {visible.length === 0 && !error ? <div className="tech-empty">No repair orders match this view.</div> : null}
          {visible.map((ro) => {
            const roJobs = jobsByRo.get(ro.id) || [];
            const firstOpen = roJobs.find((job) => job.authorization_status === "approved") || roJobs.find((job) => job.authorization_status === "pending") || roJobs[0];
            const doneCount = roJobs.filter((job) => job.authorization_status === "completed").length;
            const href = firstOpen ? `/tech/repair-orders/${ro.id}?line=${firstOpen.id}` : `/tech/repair-orders/${ro.id}`;

            return (
              <Link className="tech-ro-card" href={href} key={ro.id}>
                <div className="tech-ro-primary">
                  <div className="tech-ro-number-row">
                    <strong>{ro.ro_number}</strong>
                    <span className={`status-pill status-${ro.status}`}>{titleCase(ro.status)}</span>
                  </div>
                  <h2>{vehicleName(ro)}</h2>
                  <p>{ro.customers?.full_name || "Unknown customer"}{ro.customers?.company_name ? ` · ${ro.customers.company_name}` : ""}</p>
                  <small>{ro.vehicles?.unit_number ? `Unit ${ro.vehicles.unit_number}` : ro.vehicles?.license_plate ? `Plate ${ro.vehicles.license_plate}` : ro.vehicles?.vin ? `VIN ${ro.vehicles.vin}` : ""}</small>
                </div>

                <div className="tech-ro-services">
                  <div className="tech-ro-services-head"><span>Services</span><strong>{doneCount}/{roJobs.length} complete</strong></div>
                  {roJobs.slice(0, 4).map((job) => (
                    <div className="tech-ro-service-row" key={job.id}>
                      <span>#{job.line_number} {job.title || "Untitled service"}</span>
                      <b className={`tech-dot tech-dot-${job.authorization_status}`} title={titleCase(job.authorization_status)} />
                    </div>
                  ))}
                  {roJobs.length > 4 ? <small>+{roJobs.length - 4} more services</small> : null}
                </div>

                <div className="tech-ro-meta">
                  <span>Promised</span>
                  <strong>{promisedLabel(ro.promised_at)}</strong>
                  <span>Concern</span>
                  <p>{ro.original_complaint || "No concern entered"}</p>
                  <b className="tech-open-arrow">Open →</b>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
