const pipeline = [
  ["New requests", "0"],
  ["Contacted", "0"],
  ["Scheduled", "0"],
  ["Diagnosing", "0"],
  ["Completed", "0"],
];

export default function AdminPreviewPage() {
  return (
    <main className="section">
      <div className="shell">
        <div className="eyebrow">Owner operations</div>
        <h1 style={{ fontSize: "clamp(44px, 7vw, 76px)" }}>Command center.</h1>
        <p className="section-copy">
          This route is the dashboard foundation. Authentication, Supabase records and role protection will be connected next. Until then, no customer information is displayed or accepted.
        </p>

        <div className="grid-3" style={{ marginTop: 40 }}>
          {pipeline.map(([label, value], index) => (
            <article className="card" key={label}>
              <div className="card-number">0{index + 1}</div>
              <h3>{label}</h3>
              <p style={{ fontSize: 44, color: "var(--text)", margin: 0 }}>{value}</p>
            </article>
          ))}
          <article className="card">
            <div className="card-number">SECURITY</div>
            <h3>Login required</h3>
            <p>Owner-only access with row-level database policies and private file storage.</p>
          </article>
        </div>

        <div className="actions">
          <a className="button secondary" href="/">Return to website</a>
        </div>
      </div>
    </main>
  );
}
