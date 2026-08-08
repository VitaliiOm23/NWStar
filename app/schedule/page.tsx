import { PublicShell } from "@/components/PublicShell";
import { ServiceRequestForm } from "@/components/ServiceRequestForm";

export const metadata = {
  title: "Schedule Service",
  description: "Send your contact, vehicle, complaint, location and preferred timing directly to NW Star Diagnostics.",
};

export default function SchedulePage() {
  return (
    <PublicShell
      eyebrow="Schedule / vehicle intake"
      title="Send your vehicle information directly."
      intro="Open this page directly from a text or message. Add your contact details, vehicle, location, concern and preferred timing so the request is saved before scheduling."
    >
      <section className="section request-section">
        <div className="shell intake">
          <aside className="request-guide">
            <div className="eyebrow">Direct intake</div>
            <h2>Everything needed to start the RO correctly.</h2>
            <p>This form creates a saved customer, vehicle and service-request record. If the job moves forward, the same record can become the repair order, recommendations, approvals, invoice and payment history.</p>
            <ul className="check-list compact">
              <li>Name, phone and email</li>
              <li>Year, make, model and mileage</li>
              <li>Vehicle location and preferred timing</li>
              <li>Exact complaint or service requested</li>
              <li>Optional VIN, codes and prior repairs</li>
            </ul>
            <div className="request-next">
              <strong>Scheduling note</strong>
              <p>Submitting your information requests an appointment; the time is confirmed only after NW Star Diagnostics contacts you.</p>
            </div>
          </aside>
          <ServiceRequestForm
            submitLabel="Request Appointment"
            successTitle="Your vehicle information was submitted."
            successMessage="We will review the vehicle details and contact you to confirm scope, location and scheduling."
          />
        </div>
      </section>
    </PublicShell>
  );
}
