const services = [
  {
    title: "Mercedes & Sprinter Diagnostics",
    text: "Factory-focused fault analysis, guided testing and system-level diagnostics for Mercedes-Benz and Sprinter platforms.",
  },
  {
    title: "Electrical & Network Diagnosis",
    text: "CAN communication faults, no-start conditions, parasitic draw, sensor circuits, wiring and module communication testing.",
  },
  {
    title: "Fleet Support",
    text: "Mobile diagnostics for contractors, delivery fleets and commercial operators who need reduced downtime and clear reporting.",
  },
];

export default function HomePage() {
  return (
    <main>
      <header className="nav">
        <div className="shell nav-inner">
          <a className="brand" href="#top" aria-label="NW Star Diagnostics home">
            <span className="brand-mark" aria-hidden="true" />
            <span>NW STAR DIAGNOSTICS</span>
          </a>
          <nav className="nav-links" aria-label="Primary navigation">
            <a href="#services">Services</a>
            <a href="#fleet">Fleet</a>
            <a href="#request">Request Service</a>
            <a href="/admin">Owner Login</a>
          </nav>
          <a className="nav-cta" href="#request">Request Diagnosis</a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="shell hero-grid">
          <div>
            <div className="eyebrow">Mobile diagnostics · Greater Puget Sound</div>
            <h1>Precision diagnosis. Less downtime.</h1>
            <p>
              Mobile Mercedes-Benz, Sprinter, electrical and fleet diagnostics built around disciplined testing, clear findings and professional documentation.
            </p>
            <div className="actions">
              <a className="button" href="#request">Request Service</a>
              <a className="button secondary" href="#services">View Capabilities</a>
            </div>
          </div>

          <aside className="telemetry" aria-label="Service highlights">
            <div className="eyebrow">Diagnostic telemetry</div>
            <div className="metric">
              <span>Primary focus</span>
              <strong>MB</strong>
            </div>
            <div className="metric">
              <span>Service model</span>
              <strong>Mobile</strong>
            </div>
            <div className="metric">
              <span>Workflow</span>
              <strong>Test → Prove</strong>
            </div>
            <div className="metric">
              <span>Coverage</span>
              <strong>Fleet</strong>
            </div>
          </aside>
        </div>
      </section>

      <section className="section" id="services">
        <div className="shell">
          <div className="section-head">
            <div>
              <div className="eyebrow">Capabilities</div>
              <h2>Diagnostics without guesswork.</h2>
            </div>
            <p className="section-copy">
              The launch service menu is intentionally focused. Every job begins with the complaint, vehicle history and measured evidence—not parts replacement by assumption.
            </p>
          </div>
          <div className="grid-3">
            {services.map((service, index) => (
              <article className="card" key={service.title}>
                <div className="card-number">0{index + 1}</div>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="fleet">
        <div className="shell intake">
          <div>
            <div className="eyebrow">Fleet operations</div>
            <h2>Built for vehicles that need to stay working.</h2>
            <p className="section-copy">
              Fleet requests will be tracked by company, contact, vehicle, VIN, complaint, location, urgency, diagnostic findings and job status. The private dashboard will keep customer and vehicle history organized in one place.
            </p>
          </div>
          <div className="card">
            <div className="card-number">WORKFLOW</div>
            <h3>New request → contacted → scheduled → diagnosing → completed → paid</h3>
            <p>
              Each stage will be searchable and tied to internal notes, uploaded files, estimates and diagnostic reports.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="request">
        <div className="shell intake">
          <div>
            <div className="eyebrow">Customer intake</div>
            <h2>Tell us what the vehicle is doing.</h2>
            <p className="section-copy">
              This first interface establishes the exact customer information the secure database will store. Submission handling and uploads will be connected during the Supabase phase.
            </p>
          </div>

          <form className="form">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Customer name</label>
                <input id="name" name="name" autoComplete="name" required />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" required />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="company">Company / fleet</label>
                <input id="company" name="company" />
              </div>
              <div className="field">
                <label htmlFor="vehicle">Year / make / model</label>
                <input id="vehicle" name="vehicle" required />
              </div>
              <div className="field">
                <label htmlFor="vin">VIN</label>
                <input id="vin" name="vin" maxLength={17} />
              </div>
              <div className="field">
                <label htmlFor="mileage">Mileage</label>
                <input id="mileage" name="mileage" inputMode="numeric" />
              </div>
              <div className="field">
                <label htmlFor="location">Vehicle location</label>
                <input id="location" name="location" required />
              </div>
              <div className="field full">
                <label htmlFor="complaint">Customer complaint / symptoms</label>
                <textarea id="complaint" name="complaint" required />
              </div>
              <div className="field full">
                <label htmlFor="codes">Known fault codes or prior work</label>
                <textarea id="codes" name="codes" />
              </div>
              <div className="field full">
                <button className="button" type="button">Database connection coming next</button>
                <p className="notice">
                  Do not enter sensitive information yet. The form will become active only after secure database policies, validation and notification delivery are configured.
                </p>
              </div>
            </div>
          </form>
        </div>
      </section>

      <footer className="footer">
        <div className="shell">
          © {new Date().getFullYear()} NW Star Diagnostics LLC. Independent automotive diagnostics provider. Not affiliated with Mercedes-Benz Group AG or the Mercedes-AMG PETRONAS Formula One Team.
        </div>
      </footer>
    </main>
  );
}
