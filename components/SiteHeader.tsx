import Link from "next/link";

const links = [
  ["Services", "/services"],
  ["Mercedes & Sprinter", "/mercedes-diagnostics"],
  ["Fleet", "/fleet-services"],
  ["About", "/about"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
] as const;

export function SiteHeader() {
  return (
    <>
      <div className="site-utility">
        <div className="shell utility-inner">
          <span>Mobile diagnostics based in Auburn, Washington</span>
          <span>Serving the greater Puget Sound region</span>
        </div>
      </div>
      <header className="nav">
        <div className="shell nav-inner">
          <Link className="brand" href="/" aria-label="NW Star Diagnostics home">
            <span className="brand-mark" aria-hidden="true">N</span>
            <span className="brand-copy"><strong>NW STAR</strong><small>DIAGNOSTICS</small></span>
          </Link>
          <nav className="nav-links" aria-label="Primary navigation">
            {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </nav>
          <Link className="nav-cta" href="/schedule">Schedule Service</Link>
        </div>
      </header>
      <div className="mobile-actions" aria-label="Quick actions">
        <Link href="/services">Services</Link>
        <Link className="primary" href="/schedule">Schedule Service</Link>
      </div>
    </>
  );
}
