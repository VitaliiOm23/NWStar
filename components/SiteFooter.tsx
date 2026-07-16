import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div>
          <div className="brand footer-brand"><span className="brand-mark" aria-hidden="true" /><span>NW STAR <b>DIAGNOSTICS</b></span></div>
          <p>Mobile Mercedes-Benz, Sprinter, electrical and fleet diagnostics across the greater Puget Sound region.</p>
        </div>
        <div className="footer-links">
          <Link href="/services">Services</Link>
          <Link href="/request-service">Request Service</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
      <div className="shell legal-line">© {new Date().getFullYear()} NW Star Diagnostics LLC. Independent automotive diagnostics provider. Not affiliated with Mercedes-Benz Group AG or the Mercedes-AMG PETRONAS Formula One Team.</div>
    </footer>
  );
}
