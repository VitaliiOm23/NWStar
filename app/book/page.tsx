import { PublicShell } from "../../components/PublicShell";
import { ServiceRequestForm } from "../../components/ServiceRequestForm";

type BookPageProps = {
  searchParams: Promise<{ concern?: string }>;
};

export const metadata = {
  title: "Schedule Service | NW Star Diagnostics",
  description: "Send your contact and vehicle information directly to NW Star Diagnostics for service review and scheduling.",
};

export default async function BookPage({ searchParams }: BookPageProps) {
  const { concern } = await searchParams;
  const initialComplaint = typeof concern === "string" ? concern.slice(0, 300) : "";

  return (
    <PublicShell
      eyebrow="Schedule service"
      title="Send your vehicle information."
      intro="This direct intake form goes straight to NW Star Diagnostics. Add your contact information, vehicle details, what the vehicle needs, and your preferred timing."
    >
      <section className="section request-section">
        <div className="shell intake">
          <aside className="request-guide">
            <div className="eyebrow">Direct vehicle intake</div>
            <h2>One form keeps the whole job organized.</h2>
            <p>Your information is saved with the vehicle request so it can become the repair order, recommendations, approvals, invoice, and payment record without re-entering the same details.</p>
            <ul className="check-list compact">
              <li>Your name, phone, and email</li>
              <li>Year, make, model, VIN, and mileage when available</li>
              <li>Vehicle location and preferred timing</li>
              <li>The exact complaint or service requested</li>
              <li>Fault codes and previous work when known</li>
            </ul>
            <div className="request-next">
              <strong>Scheduling</strong>
              <p>Submitting this form requests an appointment; it does not automatically confirm a time. NW Star Diagnostics reviews the vehicle and contacts you to confirm scope, location, and scheduling.</p>
            </div>
          </aside>
          <ServiceRequestForm initialComplaint={initialComplaint} submitLabel="Request Appointment" successTitle="Your vehicle information was submitted." successMessage="We will review the vehicle details and contact you to confirm scope, location, and scheduling." />
        </div>
      </section>
    </PublicShell>
  );
}
