// components/dashboard/PropertyPerformance.tsx — per-property MTD revenue + occupancy
"use client";

import Link from "next/link";
import type { PropertyPerformance } from "./types";

export function PropertyPerformanceList({
  rows,
}: {
  rows: PropertyPerformance[];
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">物業表現</h3>
          <p className="card-subtitle">本月營收 + 入住率</p>
        </div>
        <Link href="/dashboard/reports" className="btn-quiet">
          查看月報表
        </Link>
      </div>
      <div className="card-body">
        {rows.length === 0 ? (
          <p className="muted">尚未建立任何物業。</p>
        ) : (
          <ul className="property-list" aria-label="各物業本月表現">
            {rows.map((r) => (
              <li className="property-row" key={r.id}>
                <div>
                  <div className="property-row-title">{r.name}</div>
                  <div className="property-row-meta">入住率 {r.occupancy}%</div>
                  <div
                    className="progress"
                    aria-label={`入住率 ${r.occupancy}%`}
                  >
                    <span style={{ width: `${Math.max(0, Math.min(100, r.occupancy))}%` }} />
                  </div>
                </div>
                <div className="property-value tabular-nums">
                  NT$ {r.mtdRevenue.toLocaleString("zh-TW")}
                  <span>本月</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
