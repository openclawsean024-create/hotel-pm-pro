// components/dashboard/ContractAlerts.tsx — 總覽提醒區：合約 30 天內到期／已逾期（AC-004，FR-008）
// 只在站內顯示，不發送 Email、LINE 或任何外部通知。
import Link from "next/link";
import type { ContractAlertItem } from "./types";

export function ContractAlerts({ alerts }: { alerts: ContractAlertItem[] }) {
  if (alerts.length === 0) return null;
  const overdue = alerts.filter((a) => a.severity === "danger").length;
  const expiring = alerts.length - overdue;

  return (
    <section
      className="card"
      aria-labelledby="contract-alerts-title"
      data-testid="contract-alerts"
      style={{ marginBottom: 18 }}
    >
      <header className="card-header">
        <div>
          <h2 id="contract-alerts-title" className="card-title">
            合約提醒
          </h2>
          <p className="card-subtitle">
            {overdue > 0 ? `${overdue} 份已逾期` : null}
            {overdue > 0 && expiring > 0 ? " · " : null}
            {expiring > 0 ? `${expiring} 份 30 天內到期` : null}
          </p>
        </div>
        <Link href="/dashboard/tenants" className="link">
          前往房客頁 →
        </Link>
      </header>
      <ul style={{ listStyle: "none", margin: 0, padding: "0 17px 14px" }}>
        {alerts.map((a) => (
          <li
            key={a.tenantId}
            data-severity={a.severity}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "baseline",
              padding: "8px 0",
              borderTop: "1px solid var(--canopy-line)",
              fontSize: 13,
            }}
          >
            <span
              style={{
                fontWeight: 800,
                color: a.severity === "danger" ? "var(--canopy-red)" : "var(--canopy-orange)",
                minWidth: 132,
              }}
            >
              {a.message}
            </span>
            <span style={{ color: "var(--canopy-ink)" }}>{a.tenantName}</span>
            <span style={{ color: "var(--canopy-muted)" }}>
              {a.propertyName}
              {a.endDate ? ` · 到期日 ${a.endDate}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
