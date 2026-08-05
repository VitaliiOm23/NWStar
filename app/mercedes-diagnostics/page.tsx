import { CtaBand, PublicShell } from "../../components/PublicShell";

export default function MercedesPage() {
  return (
    <PublicShell
      eyebrow="Mercedes-Benz & Sprinter"
      title="Platform-focused diagnosis for complex vehicle systems."
      intro="Mercedes-Benz and Sprinter vehicles depend on closely connected control units. Useful diagnosis requires the complaint, fault context and system relationships to be considered together."
    >
      <section className="section">
        <div className="shell feature-grid">
          <article className="feature"><span>01</span><h2>Whole-vehicle context</h2><p>Review faults across available control units, occurrence data, mileage context and communication relationships before isolating the concern.</p></article>
          <article className="feature"><span>02</span><h2>Relevant testing</h2><p>Confirm powers, grounds, signal integrity, network behavior and component response instead of assuming the stored fault names the failed part.</p></article>
          <article className="feature"><span>03</span><h2>Clear findings</h2><p>Receive an explanation of what was checked, what the evidence supports and what should happen next.</p></article>
        </div>
      </section>
      <section className="section alt">
        <div className="shell split">
          <div>
            <div className="eyebrow">Systems covered</div>
            <h2>Passenger vehicles and Sprinter commercial platforms.</h2>
          </div>
          <ul className="check-list">
            <li>Engine, diesel and SCR or AdBlue systems</li>
            <li>Starting, charging and power distribution</li>
            <li>CAN and LIN network communication</li>
            <li>SRS, chassis, steering and driver-assistance faults</li>
            <li>Doors, steps, body electronics and convenience systems</li>
            <li>Supported calibrations, adaptations and teach-ins</li>
          </ul>
        </div>
      </section>
      <CtaBand />
    </PublicShell>
  );
}
