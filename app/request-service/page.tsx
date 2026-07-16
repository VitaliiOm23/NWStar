import { PublicShell } from "../../components/PublicShell";
import { ServiceRequestForm } from "../../components/ServiceRequestForm";

export default function RequestServicePage() {
  return (
    <PublicShell
      eyebrow="Request service"
      title="Give us the full complaint before the visit."
      intro="Complete information makes remote triage, tool preparation and scheduling more accurate. Submissions are stored as new service requests for owner review."
    >
      <section className="section">
        <div className="shell intake">
          <div>
            <div className="eyebrow">Information needed</div>
            <h2>Customer, vehicle, location and symptoms.</h2>
            <p className="section-copy">A complete description helps separate a scan request from a real diagnostic plan before arrival.</p>
            <ul className="check-list compact">
              <li>Contact and company information</li>
              <li>VIN, mileage and vehicle details</li>
              <li>Exact symptoms and operating conditions</li>
              <li>Known codes and previous repair attempts</li>
              <li>Preferred timing and vehicle location</li>
            </ul>
            <div className="info-panel">
              <div className="card-number">WHAT HAPPENS NEXT</div>
              <p>We review the request, clarify anything missing, confirm whether mobile diagnosis is appropriate and then schedule the visit. Submission does not guarantee immediate availability.</p>
            </div>
          </div>
          <ServiceRequestForm />
        </div>
      </section>
    </PublicShell>
  );
}
