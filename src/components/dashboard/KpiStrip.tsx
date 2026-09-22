// components/dashboard/KpiStrip.tsx — 4 KPI cards, each is a Link to filtered list
"use client";

import Link from "next/link";
import {
  IconArrowDown,
  IconBed,
  IconCalendar,
  IconChart,
  IconWrench,
} from "./icons";

type Kpi = {
  label: string;
  value: string;
  ariaLabel: string;
  href: string;
  tone: "ready" | "info" | "pending" | "blocked";
  icon: typeof IconCalendar;
  hint?: string;
};

export function KpiStrip({
  checkInsToday,
  checkOutsToday,
  revenueMonth,
  openCases,
}: {
  checkInsToday: number;
  checkOutsToday: number;
  revenueMonth: number;
  openCases: number;
}) {
  const cards: Kpi[] = [
    {
      label: "今日入住",
      value: String(checkInsToday),
      ariaLabel: `今日入住 ${checkInsToday} 筆`,
      href: "/dashboard/bookings",
      tone: "ready",
      icon: IconBed,
      hint: "比對今日 check-in",
    },
    {
      label: "今日退房",
      value: String(checkOutsToday),
      ariaLabel: `今日退房 ${checkOutsToday} 筆`,
      href: "/dashboard/bookings",
      tone: "info",
      icon: IconArrowDown,
      hint: "比對今日 check-out",
    },
    {
      label: "本月營收",
      value: `NT$ ${revenueMonth.toLocaleString("zh-TW")}`,
      ariaLabel: `本月營收，新台幣 ${revenueMonth.toLocaleString("zh-TW")} 元`,
      href: "/dashboard/reports",
      tone: "pending",
      icon: IconChart,
      hint: "本月份營收合計",
    },
    {
      label: "待處理案件",
      value: String(openCases),
      ariaLabel: `待處理案件 ${openCases} 件`,
      href: "/dashboard/requirements",
      tone: "blocked",
      icon: IconWrench,
      hint: "需求單 + 派工單",
    },
  ];

  return (
    <section className="kpi-grid" aria-label="關鍵指標">
      {cards.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className={`kpi-card tone-${c.tone}`}
          aria-label={c.ariaLabel}
        >
          <div className="kpi-top">
            <span>{c.label}</span>
            <span className={`kpi-icon tone-${c.tone}`} aria-hidden="true">
              <c.icon />
            </span>
          </div>
          <div className="kpi-value tabular-nums">{c.value}</div>
          <div className="kpi-foot">
            <IconCalendar width={12} height={12} aria-hidden={true} />
            <span>{c.hint}</span>
          </div>
        </Link>
      ))}
    </section>
  );
}
