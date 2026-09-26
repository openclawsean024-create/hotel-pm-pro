// components/dashboard/OwnerSettlements.tsx
// Owner settlements summary (房東分帳). Synthesised client-side from the
// existing dashboard summary endpoint (property + revenue + occupancy data).
// This is a *prototype-scope* estimate: it does not write to any settlement
// ledger or call Stripe. Real settlement flows (dunning, owner approval,
// bank routing) are deliberately out of scope per PRD/SPEC §1.3.
"use client";

import Link from "next/link";
import {
  IconArrowUpRight,
  IconCheck,
  IconClock,
  IconAlertNew,
} from "./icons";
import { dashboardCopy } from "./i18n";

export type SettlementProperty = {
  id: string;
  name: string;
  ownerShare: number | null; // 0..1
  mtdRevenue: number | null; // NT$
  roomsCount: number;
};

type Readiness = "ready" | "pending" | "blocked";

function readinessFor(revenue: number | null, occupancy: number): Readiness {
  if (revenue == null) return "pending";
  if (revenue > 0 && occupancy >= 0.55) return "ready";
  if (revenue > 0 && occupancy >= 0.3) return "pending";
  return "blocked";
}

function fmtNTD(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "NTD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function OwnerSettlements({
  properties,
  totalMtd,
  occupancyBy,
}: {
  properties: SettlementProperty[];
  totalMtd: number;
  occupancyBy: Record<string, number>;
}) {
  const t = dashboardCopy.settlement;
  const rows = properties.map((p) => {
    const occ = occupancyBy[p.id] ?? 0;
    const sharePortion =
      p.ownerShare != null && p.mtdRevenue != null
        ? Math.round(p.mtdRevenue * p.ownerShare)
        : null;
    return {
      ...p,
      occupancy: occ,
      sharePortion,
      readiness: readinessFor(p.mtdRevenue, occ),
    };
  });

  const readyTotal = rows.reduce(
    (acc, r) => (r.readiness === "ready" && r.sharePortion != null ? acc + r.sharePortion : acc),
    0,
  );
  const pendingTotal = rows.reduce(
    (acc, r) => (r.readiness === "pending" && r.sharePortion != null ? acc + r.sharePortion : acc),
    0,
  );
  const totalShare = rows.reduce(
    (acc, r) => (r.sharePortion != null ? acc + r.sharePortion : acc),
    0,
  );

  const readyRatio = totalShare > 0 ? readyTotal / totalShare : 0;

  return (
    <section className="card settlement" aria-labelledby="hp-settlement-title">
      <header className="card-header">
        <div>
          <h2 id="hp-settlement-title" className="card-title">
            {t.title}
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                color: "var(--canopy-muted)",
                fontWeight: 600,
              }}
            >
              · {t.subtitle}
            </span>
          </h2>
          <p className="card-subtitle">{t.heroHint}</p>
        </div>
        <Link href="/dashboard/reports" className="link">
          {t.seeMonthlyReport} →
        </Link>
      </header>
      <div className="settlement-body">
        <div className="settlement-hero">
          <div className="settlement-label">{t.heroLabel}</div>
          <div className="settlement-value">
            {fmtNTD(totalShare)}
            <small>· NT$</small>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#cbd5e1",
              fontSize: 10,
              marginTop: 6,
            }}
          >
            <span style={{ opacity: 0.8 }}>MTD 總覽：</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800 }}>
              {fmtNTD(totalMtd)}
            </span>
          </div>
        </div>

        <div
          className="progress"
          aria-hidden={true}
          style={{ marginTop: 16 }}
        >
          <span style={{ width: `${Math.round(readyRatio * 100)}%` }} />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "var(--canopy-muted)",
            fontSize: 10,
            marginTop: 4,
          }}
        >
          <span>{t.progressLabel}</span>
          <span style={{ color: "var(--canopy-ink)", fontWeight: 800 }}>
            {Math.round(readyRatio * 100)}%
          </span>
        </div>

        <div role="table" aria-label={t.pendingBreakdownLabel} style={{ marginTop: 8 }}>
          <div
            role="row"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 0.7fr 0.7fr",
              padding: "8px 0",
              borderBottom: "1px solid var(--canopy-line)",
              color: "var(--canopy-muted-2)",
              fontSize: 9,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontWeight: 800,
            }}
          >
            <span>Property</span>
            <span style={{ textAlign: "right" }}>Share</span>
            <span style={{ textAlign: "right" }}>Status</span>
          </div>
          {rows.length === 0 && (
            <p className="muted" style={{ padding: "16px 0", margin: 0 }}>
              {dashboardCopy.propertyHealth.empty}
            </p>
          )}
          {rows.map((r) => (
            <div
              role="row"
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 0.7fr 0.7fr",
                padding: "10px 0",
                borderBottom: "1px solid #eef0ed",
                alignItems: "center",
                color: "var(--canopy-ink)",
                fontSize: 11,
              }}
            >
              <span>
                <strong style={{ display: "block", fontWeight: 800 }}>{r.name}</strong>
                <span style={{ color: "var(--canopy-muted)", fontSize: 9 }}>
                  {r.ownerShare != null
                    ? `${Math.round((r.ownerShare ?? 0) * 100)}% 給房東 · ${r.roomsCount} 房`
                    : `尚未設定房東分潤 · ${r.roomsCount} 房`}
                </span>
              </span>
              <span
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 800,
                  color: "var(--canopy-ink)",
                }}
              >
                {fmtNTD(r.sharePortion)}
              </span>
              <span
                style={{ textAlign: "right" }}
                className={`settlement-row ${r.readiness}`}
              >
                {r.readiness === "ready" && (
                  <span className="ready" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <IconCheck aria-hidden={true} /> {t.rowReady}
                  </span>
                )}
                {r.readiness === "pending" && (
                  <span className="pending" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <IconClock aria-hidden={true} /> {t.rowPending}
                  </span>
                )}
                {r.readiness === "blocked" && (
                  <span className="blocked" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <IconAlertNew aria-hidden={true} /> {t.rowBlocked}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
      <footer className="settlement-foot">
        <span>
          {t.rowPending}：{fmtNTD(pendingTotal)} · {t.rowReady}：{fmtNTD(readyTotal)}
        </span>
        <span className="settlement-copy-tag" aria-label="Prototype only">
          <IconArrowUpRight aria-hidden={true} /> prototype-scope
        </span>
      </footer>
    </section>
  );
}
