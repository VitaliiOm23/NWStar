import Link from "next/link";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";

const services = [
  ["Mercedes & Sprinter", "Factory-focused fault analysis, guided testing and system-level diagnostics for passenger and commercial platforms.", "/mercedes-diagnostics"],
  ["Electrical & Network", "No-start, CAN communication, parasitic draw, sensor circuits, power, ground and wiring diagnosis.", "/services"],
  ["Fleet Support", "Mobile triage, clear reporting and organized vehicle history for fleets that need reduced downtime.", "/fleet-services"],
] as const;

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <section className="hero" id="top">
        <div className="shell hero-grid">
          <div>
            <div className="eyebrow">Mobile diagnostics · Greater Puget Sound</div>
            <h1>Precision diagnosis.<br/><span className="accent-text">Less downtime.</span></h1>
            <p>Mobile Mercedes-Benz, Sprinter, electrical and fleet diagnostics built around disciplined testing, clear findings and professional documentation.</p>
            <div className="actions"><Link className="button" href="/request-service">Request Service</Link><Link className="button secondary" href="/services">View Capabilities</Link></div>
            <div className="hero-proof"><span>Factory-focused workflow</span><span>Mobile field support</span><span>Evidence-based findings</span></div>
          </div>
          <aside className="telemetry" aria-label="Service highlights">
            <div className="telemetry-head"><div className="eyebrow">Diagnostic telemetry</div><span className="live-dot">ACTIVE</span></div>
            <div className="metric"><span>Primary platform</span><strong>MB / SPR</strong></div>
            <div className="metric"><span>Service model</span><strong>Mobile</strong></div>
            <div className="metric"><span>Method</span><strong>Test → Prove</strong></div>
            <div className="metric"><span>Operations</span><strong>Fleet-ready</strong></div>
          </aside>
        </div>
      </section>

      <section className="signal-strip"><div className="shell signal-grid"><span>NO-START</span><span>CAN / LIN</span><span>SCR / ADBLUE</span><span>ELECTRICAL</span><span>CODING</span><span>FLEET TRIAGE</span></div></section>

      <section className="section">
        <div className="shell"><div className="section-head"><div><div className="eyebrow">Core capabilities</div><h2>Diagnostics without guesswork.</h2></div><p className="section-copy">Every job begins with the complaint, full vehicle context and measured evidence—not parts replacement by assumption.</p></div>
          <div className="grid-3">{services.map(([title,text,href],index)=><Link className="card service-card" href={href} key={title}><div className="card-number">0{index+1}</div><h3>{title}</h3><p>{text}</p><span className="card-link">Explore service →</span></Link>)}</div>
        </div>
      </section>

      <section className="section alt">
        <div className="shell split"><div><div className="eyebrow">Diagnostic method</div><h2>A repeatable process from symptom to next step.</h2></div><div className="workflow"><div className="workflow-row"><strong>01</strong><span>Confirm the complaint and operating conditions</span></div><div className="workflow-row"><strong>02</strong><span>Review full-system faults, history and context</span></div><div className="workflow-row"><strong>03</strong><span>Build and execute the most relevant test plan</span></div><div className="workflow-row"><strong>04</strong><span>Document evidence, limits and recommended action</span></div></div></div>
      </section>

      <section className="section">
        <div className="shell fleet-banner"><div><div className="eyebrow">Fleet operations</div><h2>Built for vehicles that need to stay working.</h2><p>Organized requests, VIN-level history, urgency, findings and job status—designed for delivery operators, contractors and repair partners.</p><Link className="button secondary" href="/fleet-services">Explore Fleet Support</Link></div><div className="status-stack"><div><span>NEW REQUEST</span><b>TRIAGE</b></div><div><span>VEHICLE</span><b>DIAGNOSING</b></div><div><span>FINDINGS</span><b>DOCUMENTED</b></div><div><span>NEXT STEP</span><b>AUTHORIZED</b></div></div></div>
      </section>

      <section className="cta-band"><div className="shell cta-band-inner"><div><div className="eyebrow">Have a vehicle problem?</div><h2>Send the details before the visit.</h2><p>Year, model, VIN, mileage, location, symptoms and recent repair history help make the first visit more productive.</p></div><Link className="button" href="/request-service">Start Service Request</Link></div></section>
      <SiteFooter />
    </main>
  );
}
