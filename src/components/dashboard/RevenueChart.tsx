// components/dashboard/RevenueChart.tsx — Revenue trend (last 6 months)
"use client";

import Link from "next/link";

type Series = { month: string; total: number };
type Props = { series: Series[]; loading?: boolean };

function fmtNTD(value: number): string {
  return `NT$ ${value.toLocaleString("zh-TW")}`;
}

export function RevenueChart({ series, loading }: Props) {
  const currentMonth = series.at(-1)?.month ?? "";
  const max = Math.max(1, ...series.map((s) => s.total));
  const sixMonthTotal = series.reduce((acc, s) => acc + s.total, 0);
  const currentMonthValue = series.at(-1)?.total ?? 0;

  return (
    <section className="card chart-area" aria-labelledby="chart-title">
      <header className="card-header">
        <div>
          <h2 id="chart-title" className="card-title">
            營收趨勢 · Revenue trend
          </h2>
          <p className="card-subtitle">最近 6 個月（含本月）</p>
        </div>
        <Link href="/dashboard/reports" className="link">
          查看月報表 →
        </Link>
      </header>
      <div className="card-body" style={{ minHeight: 200 }}>
        {loading ? (
          <div className="skeleton-card tall" aria-hidden={true} />
        ) : series.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            本期沒有營收資料。
          </p>
        ) : (
          <>
            <div className="chart" role="img" aria-label={`最近 6 個月營收走勢，最高 ${fmtNTD(max)}`}>
              {series.map((s) => {
                const h = Math.max(4, Math.round((s.total / max) * 120));
                const isCurrent = s.month === currentMonth;
                return (
                  <div
                    className="bar-group"
                    key={s.month}
                    title={`${s.month}：${fmtNTD(s.total)}`}
                  >
                    <div
                      className={`bar ${isCurrent ? "current" : ""}`}
                      style={{ height: `${h}px` }}
                      aria-hidden={true}
                    />
                    <span className="bar-label">{s.month}</span>
                  </div>
                );
              })}
            </div>
            <div className="chart-note" aria-live="polite">
              <div>
                <div style={{ color: "var(--canopy-muted)", fontSize: 10 }}>本月營收</div>
                <strong>{fmtNTD(currentMonthValue)}</strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "var(--canopy-muted)", fontSize: 10 }}>6 個月總計</div>
                <strong>{fmtNTD(sixMonthTotal)}</strong>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
