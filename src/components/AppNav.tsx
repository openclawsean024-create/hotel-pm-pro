// components/AppNav.tsx — Dashboard 內部導航（F-M1~F-M6 子頁面）
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "總覽", icon: "📊" },
  { href: "/dashboard/properties", label: "物業", icon: "🏘️" },
  { href: "/dashboard/tenants", label: "房客", icon: "👥" },
  { href: "/dashboard/bookings", label: "訂房", icon: "📅" },
  { href: "/dashboard/ics", label: "ICS 同步", icon: "🔄" },
  { href: "/dashboard/reports", label: "月報表", icon: "📈" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-[var(--border)] mb-6 overflow-x-auto">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 text-sm whitespace-nowrap ${
              active
                ? "border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span className="mr-1">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
