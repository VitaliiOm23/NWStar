import { PublicShell } from "../../components/PublicShell";
import { ServiceRequestForm } from "../../components/ServiceRequestForm";

export default function RequestServicePage() {
  return (
    <PublicShell
      eyebrow="Request service"
      title="Tell us what the vehicle is doing."
      intro="Start with the contact, vehicle, location and complaint. Codes, VIN and previous repair history can be added when available."
    >
      <section className="section request-section">
        <div className="shell intake">
          <aside className="request-guide">
            <div className="eyebrow">Before you submit</div>
            <h2>Keep it simple and specific.</h2>
            <p>Good information helps determine whether mobile diagnosis is appropriate and what should be prepared before arrival.</p>
            <ul className="check-list compact">
              <li>Describe the exact symptom or warning message</li>
              <li>Say when the problem happens</li>
              <li>Include the current vehicle location</li>
              <li>Mention recent repairs or parts replacement</li>
              <li>Do not clear fault codes before the visit</li>
            </ul>
            <div className="request-next">
              <strong>What happens next</strong>
              <p>The request is reviewed first. We contact you to clarify the concern, confirm the scope and discuss scheduling. Submitting the form does not create a confirmed appointment.</p>
            </div>
          </aside>
          <ServiceRequestForm />
        </div>
      </section>
    </PublicShell>
  );
}
