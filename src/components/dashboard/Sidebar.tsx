// components/dashboard/Sidebar.tsx — desktop sidebar with grouped nav + property switcher
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  IconBed,
  IconBuilding,
  IconCalendar,
  IconChart,
  IconChevron,
  IconGrid,
  IconList,
  IconSync,
  IconUser,
  IconWrench,
} from "./icons";

type NavGroup = {
  heading: string;
  items: { href: string; label: string; Icon: typeof IconGrid }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "營運",
    items: [{ href: "/dashboard", label: "總覽", Icon: IconGrid }],
  },
  {
    heading: "管理",
    items: [
      { href: "/dashboard/bookings", label: "訂房", Icon: IconCalendar },
      { href: "/dashboard/tenants", label: "房客", Icon: IconUser },
      { href: "/dashboard/properties", label: "物業", Icon: IconBuilding },
      { href: "/dashboard/requirements", label: "需求單", Icon: IconList },
      { href: "/dashboard/maintenance", label: "派工單", Icon: IconWrench },
    ],
  },
  {
    heading: "財務",
    items: [{ href: "/dashboard/reports", label: "月報表", Icon: IconChart }],
  },
  {
    heading: "自動化",
    items: [{ href: "/dashboard/ics", label: "ICS 同步", Icon: IconSync }],
  },
];

type PropertyOption = { id: string; name: string; roomType: string };

export function Sidebar({
  properties,
  activePropertyId,
}: {
  properties: PropertyOption[];
  activePropertyId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const scopeLabel = useMemo(() => {
    if (!activePropertyId) return "全部物業";
    const p = properties.find((x) => x.id === activePropertyId);
    return p?.name ?? "未選擇";
  }, [activePropertyId, properties]);

  function switchProperty(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("propertyId", id);
    else params.delete("propertyId");
    const qs = params.toString();
    router.push(`/dashboard${qs ? `?${qs}` : ""}`);
  }

  return (
    <aside
      className="sidebar-desktop"
      aria-label="側邊欄"
      data-testid="dashboard-sidebar"
    >
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <IconBed />
        </div>
        <div>
          <div className="brand-name">民宿管家</div>
          <div className="brand-sub">Hotel PM Pro · 商業版</div>
        </div>
      </div>

      <button
        type="button"
        className="property-switcher"
        onClick={() => setOpen((v) => !v)}
        aria-label="切換物業範圍"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="property-avatar" aria-hidden="true">
          {activePropertyId ? "物" : "全"}
        </span>
        <span className="property-copy">
          <span className="property-label">目前管理範圍</span>
          <span className="property-name">{scopeLabel}</span>
        </span>
        <IconChevron />
      </button>

      {properties.length > 0 && (
        <details
          className="property-list-collapsible"
          open={open}
          onToggle={(e) => {
            const details = e.currentTarget as HTMLDetailsElement;
            setOpen(details.open);
          }}
        >
          <summary className="property-list-summary">選擇物業</summary>
          <ul className="property-list-options">
            <li>
              <button
                type="button"
                className={`property-list-option ${!activePropertyId ? "active" : ""}`}
                onClick={() => switchProperty(null)}
              >
                全部物業
              </button>
            </li>
            {properties.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`property-list-option ${activePropertyId === p.id ? "active" : ""}`}
                  onClick={() => switchProperty(p.id)}
                >
                  {p.name}
                  <span className="property-list-meta">{p.roomType}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <nav className="sidebar-nav" aria-label="主導覽">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.heading}>
            <div className="nav-heading">{group.heading}</div>
            {group.items.map(({ href, label, Icon }) => {
              const active =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-item ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
