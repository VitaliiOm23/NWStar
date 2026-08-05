import Link from "next/link";

const links = [
  ["Requests", "/admin"],
  ["Repair orders", "/admin/repair-orders"],
] as const;

export function AdminNav({ current }: { current: "requests" | "repair-orders" }) {
  return (
    <nav className="admin-nav" aria-label="Owner operations">
      {links.map(([label, href]) => {
        const active =
          (current === "requests" && href === "/admin") ||
          (current === "repair-orders" && href === "/admin/repair-orders");
        return (
          <Link className={active ? "active" : ""} href={href} key={href}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
