// components/AppNav.tsx — Dashboard 內部導航（F-M1~F-M6 子頁面）
// AC §A2: 加入「需求單」與「派工單」,並以群組（營運 / 管理 / 財務 / 自動化）組織。
// 既有 hrefs / active 邏輯保持相容。
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "營運",
    items: [
      { href: "/dashboard", label: "總覽", icon: "📊" },
    ],
  },
  {
    heading: "管理",
    items: [
      { href: "/dashboard/bookings", label: "訂房", icon: "📅" },
      { href: "/dashboard/tenants", label: "房客", icon: "👥" },
      { href: "/dashboard/properties", label: "物業", icon: "🏘️" },
      { href: "/dashboard/requirements", label: "需求單", icon: "📝" },
      { href: "/dashboard/maintenance", label: "派工單", icon: "🛠️" },
    ],
  },
  {
    heading: "財務",
    items: [
      { href: "/dashboard/reports", label: "月報表", icon: "📈" },
    ],
  },
  {
    heading: "自動化",
    items: [
      { href: "/dashboard/ics", label: "ICS 同步", icon: "🔄" },
    ],
  },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-[var(--border)] mb-6 overflow-x-auto" aria-label="主導覽">
      <div className="flex gap-1 min-w-max">
        {NAV_GROUPS.flatMap((group) => [
          <span
            key={`h-${group.heading}`}
            className="px-2 py-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center"
          >
            {group.heading}
          </span>,
          ...group.items.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 text-sm whitespace-nowrap ${
                  active
                    ? "border-b-2 border-[var(--accent)] text-[var(--accent)] font-medium"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="mr-1" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          }),
        ])}
      </div>
    </nav>
  );
}
