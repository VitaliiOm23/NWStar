import { CtaBand, PublicShell } from "../../components/PublicShell";

const workflow = [
  "Request received and reviewed",
  "Vehicle, VIN and complaint recorded",
  "Scope and mobile access confirmed",
  "Testing and findings documented",
  "Repair direction communicated",
  "History retained for future service",
];

export default function FleetPage() {
  return (
    <PublicShell
      eyebrow="Fleet service"
      title="Organized diagnostics for vehicles that need to stay working."
      intro="Mobile support for delivery operators, contractors, commercial fleets and repair facilities that need clear triage, consistent records and a practical next step."
    >
      <section className="section">
        <div className="shell split">
          <div>
            <div className="eyebrow">Fleet workflow</div>
            <h2>One record from the first complaint through follow-up.</h2>
            <p className="section-copy">Each request can remain tied to the company, contact, vehicle, VIN, mileage, location, urgency, findings and job status.</p>
          </div>
          <div className="workflow">
            {workflow.map((item, index) => (
              <div className="workflow-row" key={item}>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section alt">
        <div className="shell grid-3">
          <article className="card"><div className="card-number">SCHEDULING</div><h3>Field support</h3><p>Coordinate diagnosis around vehicle location and operating needs when availability permits.</p></article>
          <article className="card"><div className="card-number">REPORTING</div><h3>Clear handoff</h3><p>Give management or the repair facility a concise record of the concern, testing and next action.</p></article>
          <article className="card"><div className="card-number">HISTORY</div><h3>Vehicle continuity</h3><p>Retain prior complaints and findings so repeat-vehicle decisions begin with context.</p></article>
        </div>
      </section>
      <CtaBand />
    </PublicShell>
  );
}
