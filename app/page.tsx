import Link from "next/link";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";

const services = [
  ["Mercedes-Benz diagnostics", "Warning lights, drivability concerns, control-unit faults, guided testing and system diagnosis.", "/mercedes-diagnostics"],
  ["Sprinter diagnostics", "No-start, SCR and AdBlue faults, electrical concerns, communication issues and fleet support.", "/mercedes-diagnostics"],
  ["Electrical diagnosis", "Power, ground, wiring, battery drain, network communication and intermittent electrical faults.", "/services"],
  ["Fleet support", "Mobile triage, organized vehicle records and clear next steps for commercial operators.", "/fleet-services"],
] as const;

const commonRequests = [
  { label: "No-start and intermittent starting concerns", concern: "No-start or intermittent starting concern" },
  { label: "Check-engine, ABS, SRS and warning messages", concern: "Warning light or dashboard message concern" },
  { label: "SCR, DEF and AdBlue system faults", concern: "SCR, DEF or AdBlue system concern" },
  { label: "CAN, LIN and control-unit communication issues", concern: "CAN, LIN or control-unit communication concern" },
  { label: "Parasitic draw, power and ground testing", concern: "Battery drain, power or ground concern" },
  { label: "Pre-repair diagnosis and post-repair verification", concern: "Pre-repair diagnosis or post-repair verification request" },
] as const;

export default function HomePage() {
  return (
    <main className="public-site">
      <SiteHeader />

      <section className="hero" id="top">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">Mercedes-Benz · Sprinter · Mobile diagnostics</div>
            <h1>Clear diagnosis before unnecessary repair.</h1>
            <p>Mobile diagnostic service for Mercedes-Benz passenger vehicles, Sprinter vans, electrical faults and fleet concerns throughout the greater Puget Sound region.</p>
            <div className="actions">
              <Link className="button" href="/request-service">Request Service</Link>
              <Link className="button secondary" href="/services">Review Services</Link>
            </div>
            <ul className="hero-checks" aria-label="Service advantages">
              <li>Vehicle details reviewed before scheduling</li>
              <li>Testing based on the complaint and evidence</li>
              <li>Findings explained with a practical next step</li>
            </ul>
          </div>

          <aside className="service-start-card" aria-label="How to start service">
            <div className="card-kicker">Fastest way to get started</div>
            <h2>Send the vehicle information first.</h2>
            <ol className="start-steps">
              <li><span>1</span><div><strong>Tell us the vehicle</strong><p>Year, model, mileage and VIN when available.</p></div></li>
              <li><span>2</span><div><strong>Describe the complaint</strong><p>Explain what happens, when it happens and what was already tried.</p></div></li>
              <li><span>3</span><div><strong>Confirm the location</strong><p>We review the request and contact you about scope and scheduling.</p></div></li>
            </ol>
            <Link className="text-link" href="/request-service">Open the service request →</Link>
          </aside>
        </div>
      </section>

      <section className="service-bar">
        <div className="shell service-bar-inner">
          <span>Based in Auburn</span>
          <span>Mobile service</span>
          <span>Mercedes & Sprinter focused</span>
          <span>Fleet requests welcome</span>
        </div>
      </section>

      <section className="section section-compact">
        <div className="shell">
          <div className="section-head">
            <div>
              <div className="eyebrow">Services</div>
              <h2>Common diagnostic work.</h2>
            </div>
            <p className="section-copy">Straightforward service categories make it easier to decide whether the job is a good fit before scheduling.</p>
          </div>
          <div className="service-list-grid">
            {services.map(([title, text, href]) => (
              <Link className="service-list-card" href={href} key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
                <span>View details →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="shell two-column-detail">
          <div>
            <div className="eyebrow">Typical requests</div>
            <h2>Problems we are commonly asked to evaluate.</h2>
            <p className="section-copy">Select the closest concern. The service request opens with that problem already filled in, and you can edit or add details before sending it.</p>
          </div>
          <ul className="plain-service-list concern-links">
            {commonRequests.map(({ label, concern }) => (
              <li key={label}>
                <Link href={`/request-service?concern=${encodeURIComponent(concern)}`}>
                  <span>{label}</span>
                  <strong>Start request →</strong>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="section-head narrow-head">
            <div>
              <div className="eyebrow">How service works</div>
              <h2>Organized from the first message.</h2>
            </div>
          </div>
          <div className="process-grid">
            <article><span>01</span><h3>Request reviewed</h3><p>Vehicle, complaint, location and previous work are reviewed before the visit is accepted.</p></article>
            <article><span>02</span><h3>Scope confirmed</h3><p>We clarify the concern, discuss access and determine whether mobile diagnosis is appropriate.</p></article>
            <article><span>03</span><h3>Vehicle tested</h3><p>The complaint is verified when possible and testing follows the most relevant system path.</p></article>
            <article><span>04</span><h3>Next step explained</h3><p>Findings, limitations and recommended action are documented in clear terms.</p></article>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="shell established-panel">
          <div>
            <div className="eyebrow">Professional operating standard</div>
            <h2>A specialist service should feel organized, not improvised.</h2>
          </div>
          <div className="established-points">
            <p><strong>Before arrival</strong><span>The complaint and vehicle information are reviewed so the visit starts with context.</span></p>
            <p><strong>During diagnosis</strong><span>Testing is tied to the symptom instead of replacing parts by assumption.</span></p>
            <p><strong>After testing</strong><span>You receive a practical explanation of what was found and what should happen next.</span></p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="shell cta-band-inner">
          <div>
            <div className="eyebrow">Need service?</div>
            <h2>Start with the vehicle and the complaint.</h2>
            <p>Send the details once. They stay attached to the request for review and follow-up.</p>
          </div>
          <Link className="button" href="/request-service">Request Service</Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
