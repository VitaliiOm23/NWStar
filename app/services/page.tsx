import Link from "next/link";
import { CtaBand, PublicShell } from "../../components/PublicShell";

const services = [
  ["Whole-vehicle scanning", "Full-system scans, fault-context review, freeze-frame interpretation and test planning tied to the complaint."],
  ["No-start and no-crank", "Battery, starter command, authorization, network, module and power-distribution diagnosis."],
  ["Electrical diagnosis", "Voltage drop, open and short circuits, sensor references, grounds, parasitic draw and intermittent faults."],
  ["CAN and module communication", "Network relationship review, communication-loss diagnosis and module power and ground verification."],
  ["Sprinter systems", "Diesel, SCR and AdBlue, body, door, step, restraint, chassis and commercial-vehicle system diagnosis."],
  ["Coding and adaptations", "Supported teach-ins, calibrations, adaptations and configuration work when proper access is available."],
  ["Pre-purchase diagnostics", "Electronic system scan and findings review before a customer or fleet acquires a vehicle."],
  ["Fleet triage", "Priority fault isolation, documented next steps and coordination with the fleet or repair facility."],
  ["Second-opinion diagnosis", "Independent review when previous repairs or parts replacement did not resolve the complaint."],
] as const;

export default function ServicesPage() {
  return (
    <PublicShell
      eyebrow="Services"
      title="Diagnostic services with a clear purpose."
      intro="The service is structured to help owners, repair facilities and fleets decide what should be tested, repaired or verified next."
    >
      <section className="section">
        <div className="shell grid-3">
          {services.map(([title, text], index) => (
            <Link
              className="card"
              href={`/request-service?concern=${encodeURIComponent(title)}`}
              key={title}
              aria-label={`Start a service request for ${title}`}
            >
              <div className="card-number">{String(index + 1).padStart(2, "0")}</div>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="card-link">Start request →</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section alt">
        <div className="shell split">
          <div>
            <div className="eyebrow">Scope and limitations</div>
            <h2>Findings are separated from assumptions.</h2>
          </div>
          <div className="prose">
            <p>Diagnosis identifies the most defensible cause and repair direction supported by the available evidence. Some faults require additional teardown, repair access, dealer-only authorization or a follow-up visit.</p>
            <p>Coding and programming services are performed only when the vehicle, tooling, authorization and technical conditions support the work.</p>
          </div>
        </div>
      </section>
      <CtaBand />
    </PublicShell>
  );
}
