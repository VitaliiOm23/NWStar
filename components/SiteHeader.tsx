import Link from "next/link";

const links = [
  ["Services", "/services"],
  ["Mercedes", "/mercedes-diagnostics"],
  ["Fleet", "/fleet-services"],
  ["About", "/about"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
] as const;

export function SiteHeader() {
  return (
    <header className="nav">
      <div className="shell nav-inner">
        <Link className="brand" href="/" aria-label="NW Star Diagnostics home">
          <span className="brand-mark" aria-hidden="true" />
          <span>NW STAR <b>DIAGNOSTICS</b></span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          <Link href="/admin">Owner</Link>
        </nav>
        <Link className="nav-cta" href="/request-service">Request Service</Link>
      </div>
    </header>
  );
}
