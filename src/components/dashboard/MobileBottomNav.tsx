// components/dashboard/MobileBottomNav.tsx — 4-tab sticky bottom nav (≤780px)
// Reflects the new IA: Overview / Bookings / Maintenance / Reports.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconGrid,
  IconCalendar,
  IconWrench,
  IconChart,
} from "./icons";

type Tab = { href: string; label: string; labelEn: string; Icon: typeof IconGrid };

const TABS: Tab[] = [
  { href: "/dashboard", label: "總覽", labelEn: "Overview", Icon: IconGrid },
  { href: "/dashboard/bookings", label: "訂房", labelEn: "Bookings", Icon: IconCalendar },
  { href: "/dashboard/maintenance", label: "派工", labelEn: "Maintenance", Icon: IconWrench },
  { href: "/dashboard/reports", label: "月報", labelEn: "Reports", Icon: IconChart },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="行動導覽"
      data-testid="dashboard-mobile-bottom-nav"
    >
      {TABS.map(({ href, label, labelEn, Icon }) => {
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`mobile-bottom-tab ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
            aria-label={`${label}, ${labelEn}`}
          >
            <span className="mobile-bottom-tab-icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="mobile-bottom-tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
