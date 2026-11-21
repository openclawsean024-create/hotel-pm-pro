// lib/contracts.ts — 房客合約到期／逾期提醒（AC-004，FR-008）
//
// 來源：hotel-pm `src/lib/domain.ts` 的 `getContractAlerts`、`calculateOverdueDays`、
// `parseDateStrict`（合併清單 #4）。改寫重點：
//   - 欄位改用主 repo 的 `Tenant.endDate`（可為 null）與 `Tenant.status`。
//   - 沒有 endDate 的房客不提醒；`status = "ended"` 的房客不提醒。
//   - 天數以 Asia/Taipei 的日曆日計算，不受當下時刻影響。
// 只在站內顯示，不發送任何外部通知。
import { DAY_MS, diffCalendarDays, parseDateStrict, toTaipeiDateISO, type DateInput } from "@/lib/dates";

export { parseDateStrict };

export const CONTRACT_ALERT_WINDOW_DAYS = 30;

export interface ContractAlert {
  tenantId: string;
  message: string;
  severity: "warning" | "danger";
}

export interface ContractAlertTenant {
  id: string;
  endDate?: DateInput | null;
  status?: string | null;
}

export function getContractAlerts(tenants: ContractAlertTenant[], now: Date): ContractAlert[] {
  const alerts: ContractAlert[] = [];
  const today = toTaipeiDateISO(now, "now");
  for (const t of tenants) {
    if (t.endDate === null || t.endDate === undefined || t.endDate === "") continue;
    if (t.status === "ended") continue;
    const end = toTaipeiDateISO(t.endDate, "endDate");
    const daysLeft = diffCalendarDays(today, end);
    if (daysLeft < 0) {
      alerts.push({
        tenantId: t.id,
        message: `合約已逾期 ${Math.abs(daysLeft)} 天`,
        severity: "danger",
      });
    } else if (daysLeft === 0) {
      alerts.push({ tenantId: t.id, message: "合約今天到期", severity: "warning" });
    } else if (daysLeft <= CONTRACT_ALERT_WINDOW_DAYS) {
      alerts.push({
        tenantId: t.id,
        message: `合約將於 ${daysLeft} 天內到期`,
        severity: "warning",
      });
    }
  }
  return alerts;
}

/** 已逾期的完整天數；尚未到期回 0。 */
export function calculateOverdueDays(dueDate: DateInput, now: Date): number {
  const due = parseDateStrict(dueDate, "dueDate").getTime();
  const diff = now.getTime() - due;
  if (diff <= 0) return 0;
  return Math.floor(diff / DAY_MS);
}
