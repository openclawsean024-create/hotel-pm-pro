// components/dashboard/QuickActions.tsx — exactly 4 verbs from UI-SPEC §5
"use client";

import Link from "next/link";
import {
  IconCalendar,
  IconChart,
  IconSync,
  IconWrench,
} from "./icons";

const ACTIONS = [
  {
    href: "/dashboard/bookings",
    label: "新增訂房",
    hint: "建立新訂房",
    Icon: IconCalendar,
    tone: "ready" as const,
  },
  {
    href: "/dashboard/maintenance",
    label: "建立維修",
    hint: "派工單",
    Icon: IconWrench,
    tone: "info" as const,
  },
  {
    href: "/dashboard/ics",
    label: "ICS 同步",
    hint: "匯入外部行事曆",
    Icon: IconSync,
    tone: "pending" as const,
  },
  {
    href: "/dashboard/reports",
    label: "匯出月報",
    hint: "下載 PDF",
    Icon: IconChart,
    tone: "blocked" as const,
  },
];

export function QuickActions() {
  return (
    <section className="quick-actions" aria-label="快速動作">
      {ACTIONS.map(({ href, label, hint, Icon, tone }) => (
        <Link
          key={href}
          href={href}
          className={`quick-action tone-${tone}`}
          aria-label={`${label}：${hint}`}
        >
          <span className={`quick-action-icon tone-${tone}`} aria-hidden="true">
            <Icon />
          </span>
          <span className="quick-action-copy">
            <span className="quick-action-title">{label}</span>
            <span className="quick-action-hint">{hint}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
