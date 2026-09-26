// components/dashboard/KpiStrip.tsx — KPI grid (today's pulse + monthly)
"use client";

import Link from "next/link";
import {
  IconArrowDown,
  IconBed,
  IconCalendar,
  IconChart,
  IconWrench,
} from "./icons";
import type { DashboardSummary } from "./types";

type Props = {
  kpi: DashboardSummary["kpi"];
  loading?: boolean;
};

export function KpiStrip({ kpi, loading }: Props) {
  return (
    <section className="kpi-grid" aria-label="關鍵指標">
      <KpiCard
        label="今日入住"
        value={String(kpi.checkInsToday)}
        ariaLabel={`今日入住 ${kpi.checkInsToday} 筆`}
        href="/dashboard/bookings"
        tone="ready"
        icon={IconBed}
        hint="今日 check-in 預計筆數"
        loading={!!loading}
      />
      <KpiCard
        label="今日退房"
        value={String(kpi.checkOutsToday)}
        ariaLabel={`今日退房 ${kpi.checkOutsToday} 筆`}
        href="/dashboard/bookings"
        tone="info"
        icon={IconArrowDown}
        hint="今日 check-out 預計筆數"
        loading={!!loading}
      />
      <KpiCard
        label="本月營收"
        value={`NT$ ${(kpi.revenueMonth ?? 0).toLocaleString("zh-TW")}`}
        ariaLabel={`本月營收，新台幣 ${(kpi.revenueMonth ?? 0).toLocaleString("zh-TW")} 元`}
        href="/dashboard/reports"
        tone="pending"
        icon={IconChart}
        hint="本月份 NT$ 合計"
        loading={!!loading}
      />
      <KpiCard
        label="待處理案件"
        value={String(kpi.openCases)}
        ariaLabel={`待處理案件 ${kpi.openCases} 件`}
        href="/dashboard/requirements"
        tone="blocked"
        icon={IconWrench}
        hint="需求單 + 派工單"
        loading={!!loading}
      />
    </section>
  );
}

function KpiCard({
  label,
  value,
  ariaLabel,
  href,
  tone,
  icon: Icon,
  hint,
  loading,
}: {
  label: string;
  value: string;
  ariaLabel: string;
  href: string;
  tone: "orange" | "violet" | "green" | "blue" | "yellow" | "red" | "ready" | "pending" | "blocked" | "info";
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  hint: string;
  loading: boolean;
}) {
  if (loading) {
    return <div className="skeleton-card" aria-hidden={true} />;
  }
  return (
    <Link
      href={href}
      className="kpi-card"
      aria-label={ariaLabel}
    >
      <div className="kpi-top">
        <span style={{ fontWeight: 800, color: "var(--canopy-ink)", fontSize: 11 }}>
          {label}
        </span>
        <span className={`kpi-icon tone-${tone}`} aria-hidden={true}>
          <Icon />
        </span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        <IconCalendar aria-hidden={true} />
        <span>{hint}</span>
      </div>
    </Link>
  );
}
