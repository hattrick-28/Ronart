"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Sot" },
  { href: "/admin/calendar", label: "Kalendari" },
  { href: "/admin/bookings", label: "Rezervimet" },
  { href: "/admin/bookings/new", label: "Rezervim i ri" },
  { href: "/admin/guests", label: "Mysafirët" },
];
const OWNER = [
  { href: "/admin/prices", label: "Çmimet" },
  { href: "/admin/reports", label: "Raportet" },
  { href: "/admin/settings", label: "Cilësimet" },
];

export function AdminNav({ owner }: { owner: boolean }) {
  const path = usePathname();
  const items = owner ? [...ITEMS, ...OWNER] : ITEMS;
  const active = (href: string) =>
    href === "/admin" ? path === "/admin" : href === "/admin/bookings" ? path.startsWith("/admin/bookings") && path !== "/admin/bookings/new" : path.startsWith(href);
  return (
    <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-1 px-1">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active(i.href) ? "page" : undefined}
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            active(i.href) ? "bg-milk text-wall-deep" : "text-milk/80 hover:text-milk hover:bg-white/10"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
