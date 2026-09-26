// components/dashboard/AlertStrip.tsx — legacy alert strip (kept for safety in
// case downstream pages still import it). The new dashboard render composes
// an OperationalPulse inline in DashboardClient instead.
"use client";

import Link from "next/link";
import { IconAlert } from "./icons";

export function AlertStrip({
  cleaning,
  maintenance,
  openCases,
}: {
  cleaning: number;
  maintenance: number;
  openCases: number;
}) {
  if (cleaning === 0 && maintenance === 0 && openCases === 0) return null;

  const parts: string[] = [];
  if (cleaning > 0) parts.push(`${cleaning} 間待清潔`);
  if (maintenance > 0) parts.push(`${maintenance} 間維修中`);
  if (openCases > 0) parts.push(`${openCases} 件待處理案件`);

  return (
    <div className="alert-strip" role="status" aria-live="polite">
      <span
        className="pulse-item"
        aria-hidden="true"
        style={{ display: "flex", alignItems: "center", padding: "0 13px", background: "var(--canopy-panel)" }}
      >
        <span className="pulse-dot" aria-hidden="true" />
      </span>
      <div className="pulse-item" style={{ background: "var(--canopy-panel)" }}>
        <div className="pulse-label" style={{ color: "var(--canopy-muted)" }}>
          <span className="pulse-dot red" aria-hidden="true" /> 待辦
        </div>
        <div className="pulse-title">{parts.join(" · ")}</div>
      </div>
      <div className="pulse-item" style={{ background: "var(--canopy-panel)" }} />
      <div className="pulse-item" style={{ background: "var(--canopy-panel)", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 17px" }}>
        <Link href="/dashboard/maintenance" className="link">
          前往派工單 →
        </Link>
      </div>
    </div>
  );
}
