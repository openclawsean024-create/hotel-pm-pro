// components/dashboard/MobileBottomNav.tsx — 4-tab bottom nav for <780px
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBed,
  IconCalendar,
  IconChart,
  IconList,
} from "./icons";

type Tab = { href: string; label: string; Icon: typeof IconBed };

const TABS: Tab[] = [
  { href: "/dashboard", label: "總覽", Icon: IconBed },
  { href: "/dashboard/bookings", label: "訂房", Icon: IconCalendar },
  { href: "/dashboard/requirements", label: "待辦", Icon: IconList },
  { href: "/dashboard/reports", label: "月報", Icon: IconChart },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="行動導覽"
      data-testid="dashboard-mobile-bottom-nav"
    >
      {TABS.map(({ href, label, Icon }) => {
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
