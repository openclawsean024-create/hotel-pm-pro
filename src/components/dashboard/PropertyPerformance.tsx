// components/dashboard/PropertyPerformance.tsx — Portfolio health (per-property MTD revenue + occupancy)
"use client";

import Link from "next/link";
import type { PropertyPerformance as PropertyPerformanceType } from "./types";

type Props = {
  items: PropertyPerformanceType[];
  loading?: boolean;
};

function fmtNTD(value: number): string {
  return `NT$ ${value.toLocaleString("zh-TW")}`;
}

export function PropertyPerformance({ items, loading }: Props) {
  return (
    <section className="card" aria-labelledby="prop-perf-title">
      <header className="card-header">
        <div>
          <h2 id="prop-perf-title" className="card-title">
            Portfolio health · 物業體質
          </h2>
          <p className="card-subtitle">本月營收 + 入住率</p>
        </div>
        <Link href="/dashboard/reports" className="link">
          查看月報表 →
        </Link>
      </header>
      <div className="card-body">
        {loading ? (
          <div className="skeleton-card tall" aria-hidden={true} />
        ) : items.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            尚未建立任何物業。
          </p>
        ) : (
          <ul className="property-list">
            {items.map((p) => {
              const occPct = Math.max(0, Math.min(100, p.occupancy ?? 0));
              return (
                <li className="property-row" key={p.id}>
                  <div>
                    <div className="property-row-title">{p.name}</div>
                    <div className="property-row-meta">本月 MTD · {p.id.slice(0, 6)}</div>
                    <div className="progress" aria-hidden={true}>
                      <span style={{ width: `${occPct}%` }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--canopy-muted)", fontSize: 10, marginTop: 4 }}>
                      <span>入住率</span>
                      <span className={`status-text ${occPct >= 60 ? "good" : "warn"}`}>
                        {occPct}%
                      </span>
                    </div>
                  </div>
                  <div className="property-value">
                    {fmtNTD(p.mtdRevenue ?? 0)}
                    <span>MTD 營收</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
