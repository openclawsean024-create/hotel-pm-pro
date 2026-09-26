// components/dashboard/Sidebar.tsx
// Desktop sidebar — graphite dark + orange active accent, i18n-ready nav
// Grouping: WORKSPACE / OPERATIONS / SYSTEM  (per docs/ui-redesign-review-2026-09-24.md)
// URL ?propertyId= remains the single source of truth for property scope.
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
import { dashboardCopy } from "./i18n";

type NavGroup = {
  heading: string;
  items: NavItem[];
};

type NavItem = {
  href: string;
  label: string;
  labelEn: string;
  Icon: typeof IconGrid;
  countKey?: "openCases" | "maintenance" | "ics"; // visual hint, optional
};

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "WORKSPACE",
    items: [
      { href: "/dashboard", label: "總覽", labelEn: "Overview", Icon: IconGrid },
      { href: "/dashboard/bookings", label: "訂房", labelEn: "Bookings", Icon: IconCalendar },
      { href: "/dashboard/tenants", label: "房客", labelEn: "Tenants", Icon: IconUser },
      { href: "/dashboard/properties", label: "物業", labelEn: "Properties", Icon: IconBuilding },
    ],
  },
  {
    heading: "OPERATIONS",
    items: [
      { href: "/dashboard/requirements", label: "需求單", labelEn: "Work orders", Icon: IconList },
      { href: "/dashboard/maintenance", label: "派工單", labelEn: "Maintenance", Icon: IconWrench },
      { href: "/dashboard/reports", label: "月報表", labelEn: "Reports", Icon: IconChart },
    ],
  },
  {
    heading: "AUTOMATE",
    items: [
      { href: "/dashboard/ics", label: "ICS 同步", labelEn: "ICS sync", Icon: IconSync },
    ],
  },
];

type PropertyOption = { id: string; name: string; roomType: string };

export function Sidebar({
  properties,
  activePropertyId,
  openCases,
}: {
  properties: PropertyOption[];
  activePropertyId: string | null;
  openCases?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const scopeLabel = useMemo(() => {
    if (!activePropertyId) return dashboardCopy.workspace.allProperties;
    const p = properties.find((x) => x.id === activePropertyId);
    return p?.name ?? dashboardCopy.workspace.unselected;
  }, [activePropertyId, properties]);

  function switchProperty(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("propertyId", id);
    else params.delete("propertyId");
    const qs = params.toString();
    router.push(`/dashboard${qs ? `?${qs}` : ""}`);
  }

  const t = dashboardCopy;

  return (
    <aside
      className="sidebar-desktop"
      aria-label={t.sidebar.ariaLabel}
      data-testid="dashboard-sidebar"
    >
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <IconBed />
        </div>
        <div>
          <div className="brand-name">Hotel PM Pro</div>
          <div className="brand-sub">{t.brand.sub}</div>
        </div>
      </div>

      <div className="workspace-card" aria-label={t.workspace.label}>
        <div className="workspace-top">
          <span>{t.workspace.scopeBadge}</span>
          <IconChevron />
        </div>
        <span className="workspace-name">{scopeLabel}</span>
        <span className="workspace-meta">
          {properties.length > 0
            ? `${properties.length} ${t.workspace.managedSingular}`
            : t.workspace.emptyHint}
        </span>
      </div>

      {properties.length > 0 && (
        <details
          className="property-list-collapsible"
          open={open}
          onToggle={(e) => {
            const details = e.currentTarget as HTMLDetailsElement;
            setOpen(details.open);
          }}
        >
          <summary className="property-list-summary">
            {t.workspace.chooseAction}
          </summary>
          <ul className="property-list-options">
            <li>
              <button
                type="button"
                className={`property-list-option ${!activePropertyId ? "active" : ""}`}
                onClick={() => switchProperty(null)}
              >
                {t.workspace.allProperties}
              </button>
            </li>
            {properties.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`property-list-option ${
                    activePropertyId === p.id ? "active" : ""
                  }`}
                  onClick={() => switchProperty(p.id)}
                >
                  <span>{p.name}</span>
                  <span className="property-list-meta">{p.roomType}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <nav className="sidebar-nav" aria-label={t.sidebar.navLabel}>
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.heading}>
            <div className="nav-label">{group.heading}</div>
            {group.items.map(({ href, label, labelEn, Icon, countKey }) => {
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
                  <span className="nav-label-side">
                    <span aria-hidden={false}>{label}</span>
                    <span
                      aria-label={`${label}, ${labelEn}`}
                      style={{
                        display: "block",
                        fontSize: 9,
                        fontWeight: 600,
                        color: "var(--canopy-graphite-muted)",
                        letterSpacing: 0.08,
                        marginTop: 1,
                      }}
                    >
                      {labelEn}
                    </span>
                  </span>
                  {countKey === "openCases" && openCases && openCases > 0 ? (
                    <span className="nav-count" aria-label={`${openCases} 件待辦`}>
                      {openCases}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot" aria-label={t.footer.ariaLabel}>
        <div className="sync-row">
          <span className="sync-dot" aria-hidden="true" />
          <span className="sync-label">{t.footer.servicesOk}</span>
        </div>
        <div className="tz-row">
          <span>{t.footer.tz}</span>
          <span className="demo-pill">{t.footer.demoBadge}</span>
        </div>
      </div>
    </aside>
  );
}
