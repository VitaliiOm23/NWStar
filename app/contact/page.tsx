import Link from "next/link";
import { PublicShell } from "../../components/PublicShell";

export default function ContactPage() {
  return (
    <PublicShell
      eyebrow="Contact"
      title="The service request is the fastest starting point."
      intro="Send the vehicle, location and complaint together so the request can be reviewed without repeating the same information across several messages."
    >
      <section className="section">
        <div className="shell contact-grid">
          <div className="contact-card">
            <div className="eyebrow">Service area</div>
            <h2>Greater Puget Sound</h2>
            <p>Based in Auburn and serving Kent, Federal Way, Tacoma, Seattle and surrounding areas. Travel availability and charges depend on location and job type.</p>
          </div>
          <div className="contact-card">
            <div className="eyebrow">Service requests</div>
            <h2>Send the details once.</h2>
            <p>Include the vehicle, current location, exact symptoms and recent repair history. VIN and fault codes help when available but are not required to start.</p>
            <Link className="button" href="/request-service">Request Service</Link>
          </div>
        </div>
      </section>
      <section className="section alt">
        <div className="shell split">
          <div>
            <div className="eyebrow">Before the appointment</div>
            <h2>Help make the first visit productive.</h2>
          </div>
          <ul className="check-list">
            <li>Keep keys and vehicle access available</li>
            <li>Do not clear fault codes before the visit</li>
            <li>Provide prior invoices or scan reports when available</li>
            <li>Explain when and how the complaint occurs</li>
            <li>Ensure safe access to the vehicle and battery</li>
          </ul>
        </div>
      </section>
    </PublicShell>
  );
}
