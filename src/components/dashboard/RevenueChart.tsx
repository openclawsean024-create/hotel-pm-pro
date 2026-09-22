// components/dashboard/RevenueChart.tsx — 6-month bar chart (CSS only)
"use client";

import Link from "next/link";

export function RevenueChart({
  series,
}: {
  series: { month: string; total: number }[];
}) {
  const current = series[series.length - 1];
  const max = Math.max(1, ...series.map((s) => s.total));
  const grandTotal = series.reduce((s, m) => s + m.total, 0);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">營收趨勢</h3>
          <p className="card-subtitle">最近 6 個月（含本月）</p>
        </div>
        <Link href="/dashboard/reports" className="btn-quiet">
          查看月報表
        </Link>
      </div>
      <div className="card-body">
        <div className="chart-area" aria-label="月營收長條圖">
          <div className="chart">
            {series.map((s) => {
              const heightPct = Math.round((s.total / max) * 100);
              const isCurrent = s.month === current?.month;
              return (
                <div className="bar-group" key={s.month}>
                  <div
                    className={`bar ${isCurrent ? "current" : ""}`}
                    style={{ height: `${Math.max(2, heightPct)}%` }}
                    title={`${s.month} NT$${s.total.toLocaleString("zh-TW")}`}
                    aria-label={`${s.month} 營收 NT$${s.total.toLocaleString("zh-TW")}`}
                  />
                  <span className="bar-label">{s.month.slice(5)}月</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="chart-note">
          <div>
            本月營收{" "}
            <strong className="tabular-nums">
              NT$ {(current?.total ?? 0).toLocaleString("zh-TW")}
            </strong>
          </div>
          <span className="chart-legend">6 個月總計 NT$ {grandTotal.toLocaleString("zh-TW")}</span>
        </div>
      </div>
    </div>
  );
}
