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
      intro="Use this link when NW Star Diagnostics asks for your information. Add your contact details, vehicle, location, concern and preferred timing so everything is saved before scheduling."
    >
      <section className="section request-section">
        <div className="shell intake">
          <aside className="request-guide">
            <div className="eyebrow">Direct intake</div>
            <h2>Everything needed to start the RO correctly.</h2>
            <p>This form creates a saved customer, vehicle and service-request record. It is designed to be opened directly from a text message instead of making you navigate through the website first.</p>
            <ul className="check-list compact">
              <li>Name, phone and email</li>
              <li>Year, make, model and mileage</li>
              <li>Vehicle location and preferred timing</li>
              <li>Exact complaint or warning message</li>
              <li>Optional VIN, codes and prior repairs</li>
            </ul>
            <div className="request-next">
              <strong>Scheduling note</strong>
              <p>Submitting your information requests an appointment; the time is confirmed only after NW Star Diagnostics contacts you.</p>
            </div>
          </aside>
          <ServiceRequestForm />
        </div>
      </section>
    </PublicShell>
  );
}
