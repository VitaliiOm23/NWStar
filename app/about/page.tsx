import { CtaBand, PublicShell } from "../../components/PublicShell";

export default function AboutPage() {
  return (
    <PublicShell
      eyebrow="About NW Star"
      title="A disciplined approach to mobile diagnostics."
      intro="NW Star Diagnostics is organized around careful intake, relevant testing, clear communication and practical next steps for owners and fleets."
    >
      <section className="section">
        <div className="shell split">
          <div>
            <div className="eyebrow">Operating standard</div>
            <h2>Complaint. Context. Test. Conclusion.</h2>
          </div>
          <div className="prose">
            <p>Every job starts with what the driver or operator actually experienced. Vehicle history, operating conditions and the available fault picture are reviewed before a test direction is chosen.</p>
            <p>The purpose is not to hand over the longest scan report. The purpose is to identify the evidence that matters, explain what remains uncertain and provide a useful repair direction.</p>
            <p>Requests, vehicles and findings are kept organized so follow-up work does not begin from zero each time.</p>
            <p>NW Star Diagnostics is an independent company and is not a Mercedes-Benz dealer or affiliated with Mercedes-Benz Group AG.</p>
          </div>
        </div>
      </section>
      <section className="section alt">
        <div className="shell grid-3">
          <article className="card"><div className="card-number">01</div><h3>Preparation</h3><p>Review the vehicle, complaint and prior work before the visit whenever possible.</p></article>
          <article className="card"><div className="card-number">02</div><h3>Evidence</h3><p>Use measured data and system information to support the repair direction.</p></article>
          <article className="card"><div className="card-number">03</div><h3>Continuity</h3><p>Keep customer, vehicle and request history organized for efficient follow-up.</p></article>
        </div>
      </section>
      <CtaBand />
    </PublicShell>
  );
}
