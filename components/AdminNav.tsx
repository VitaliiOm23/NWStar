import Link from "next/link";

const links = [
  ["Requests", "/admin", "requests"],
  ["Repair orders", "/admin/repair-orders", "repair-orders"],
  ["Tech view", "/tech", "tech"],
  ["Finance", "/admin/finance", "finance"],
] as const;

type AdminSection = (typeof links)[number][2];

export function AdminNav({ current }: { current: AdminSection }) {
  return (
    <nav className="admin-nav" aria-label="Owner operations">
      {links.map(([label, href, section]) => (
        <Link className={current === section ? "active" : ""} href={href} key={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
