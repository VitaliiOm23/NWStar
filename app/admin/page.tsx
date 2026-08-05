import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { signOutOwner, updateRequestStatus } from "./actions";

export const metadata = {
  title: "Owner Dashboard",
  robots: { index: false, follow: false },
};

const statuses = [
  "new",
  "contacted",
  "scheduled",
  "diagnosing",
  "waiting",
  "completed",
  "paid",
  "cancelled",
] as const;

type Status = (typeof statuses)[number];

type RequestRow = {
  id: string;
  status: Status;
  complaint: string;
  known_codes: string | null;
  prior_work: string | null;
  service_location: string;
  preferred_time: string | null;
  urgency: string | null;
  created_at: string;
  customers: {
    full_name: string;
    phone: string;
    email: string | null;
    company_name: string | null;
  } | null;
  vehicles: {
    year: number | null;
    make: string;
    model: string;
    vin: string | null;
    mileage: number | null;
    unit_number: string | null;
  } | null;
};

function label(status: Status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function AdminPage() {
  const { supabase, user } = await requireOwner();
  const { data, error } = await supabase
    .from("service_requests")
    .select(
      "id,status,complaint,known_codes,prior_work,service_location,preferred_time,urgency,created_at,customers(full_name,phone,email,company_name),vehicles(year,make,model,vin,mileage,unit_number)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const requests = (data || []) as unknown as RequestRow[];
  const counts = statuses.reduce<Record<Status, number>>((result, status) => {
    result[status] = requests.filter((item) => item.status === status).length;
    return result;
  }, {} as Record<Status, number>);

  return (
    <main className="admin-page">
      <div className="shell">
        <header className="admin-header">
          <div>
            <div className="eyebrow">Owner operations</div>
            <h1>Command center.</h1>
            <p className="section-copy">Live service requests and workflow status.</p>
          </div>
          <div className="admin-account">
            <span>{user.email}</span>
            <form action={signOutOwner}>
              <button className="button secondary" type="submit">Sign out</button>
            </form>
            <Link href="/">Public website →</Link>
          </div>
        </header>

        <section className="admin-stats">
          {statuses.slice(0, 7).map((status) => (
            <article className="admin-stat" key={status}>
              <span>{label(status)}</span>
              <strong>{counts[status]}</strong>
            </article>
          ))}
        </section>

        {error ? (
          <div className="form-error admin-error">
            The dashboard could not load. Confirm the Supabase schema and owner policies.
          </div>
        ) : null}

        {!error && requests.length === 0 ? (
          <section className="admin-empty">
            <div className="eyebrow">Pipeline clear</div>
            <h2>No service requests yet.</h2>
            <p>New public form submissions will appear here automatically.</p>
          </section>
        ) : null}

        <section className="request-list">
          {requests.map((request) => {
            const customer = request.customers;
            const vehicle = request.vehicles;
            const vehicleName = vehicle
              ? `${vehicle.year || ""} ${vehicle.make} ${vehicle.model}`.trim()
              : "Vehicle unavailable";

            return (
              <article className="request-card" key={request.id}>
                <div className="request-card-head">
                  <div>
                    <div className="eyebrow">
                      {new Date(request.created_at).toLocaleString("en-US", {
                        timeZone: "America/Los_Angeles",
                      })}
                    </div>
                    <h2>{vehicleName}</h2>
                    <p>{customer?.full_name || "Unknown customer"}</p>
                  </div>
                  <form action={updateRequestStatus} className="status-form">
                    <input type="hidden" name="requestId" value={request.id} />
                    <select name="nextStatus" defaultValue={request.status}>
                      {statuses.map((status) => (
                        <option value={status} key={status}>{label(status)}</option>
                      ))}
                    </select>
                    <button className="button secondary" type="submit">Update</button>
                  </form>
                </div>

                <div className="request-grid">
                  <div>
                    <strong>Phone</strong>
                    <p>{customer?.phone || "—"}</p>
                    <strong>Email</strong>
                    <p>{customer?.email || "—"}</p>
                    <strong>Company</strong>
                    <p>{customer?.company_name || "—"}</p>
                  </div>
                  <div>
                    <strong>VIN</strong>
                    <p>{vehicle?.vin || "—"}</p>
                    <strong>Mileage</strong>
                    <p>{vehicle?.mileage?.toLocaleString("en-US") || "—"}</p>
                    <strong>Location</strong>
                    <p>{request.service_location}</p>
                  </div>
                </div>

                <div className="request-notes">
                  <strong>Complaint</strong>
                  <p>{request.complaint}</p>
                  {request.known_codes ? <p><strong>Codes:</strong> {request.known_codes}</p> : null}
                  {request.prior_work ? <p><strong>Prior work:</strong> {request.prior_work}</p> : null}
                  {request.preferred_time ? <p><strong>Preferred time:</strong> {request.preferred_time}</p> : null}
                  {request.urgency ? <p><strong>Urgency:</strong> {request.urgency}</p> : null}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
