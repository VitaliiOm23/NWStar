import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div>
          <div className="brand footer-brand">
            <span className="brand-mark" aria-hidden="true">N</span>
            <span className="brand-copy"><strong>NW STAR</strong><small>DIAGNOSTICS</small></span>
          </div>
          <p>Mobile Mercedes-Benz, Sprinter, electrical and fleet diagnostics based in Auburn and serving the greater Puget Sound region.</p>
        </div>
        <div className="footer-column">
          <strong>Service</strong>
          <Link href="/services">All Services</Link>
          <Link href="/mercedes-diagnostics">Mercedes & Sprinter</Link>
          <Link href="/fleet-services">Fleet Support</Link>
          <Link href="/request-service">Request Service</Link>
        </div>
        <div className="footer-column">
          <strong>Company</strong>
          <Link href="/about">About</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </div>
      <div className="shell legal-line">
        <span>© {new Date().getFullYear()} NW Star Diagnostics LLC.</span>
        <span>Independent automotive diagnostics provider. Not affiliated with Mercedes-Benz Group AG.</span>
      </div>
    </footer>
  );
}
