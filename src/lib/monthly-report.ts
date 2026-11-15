// lib/monthly-report.ts — 月報計算（AC-003，FR-016／FR-018）
//
// 收入規則（寫入測試，修改時必須同步更新測試）：
//   1. 每個物業的當月收入 = 月租金 + 當月「已完成（completed）」訂房的 totalPrice 總和。
//   2. 已取消（cancelled）與尚未完成（confirmed）的訂房不計入收入與筆數。
//      來源：hotel-pm `calculateMonthlyReport`「排除已取消訂房」的規則（合併清單 #7）。
//   3. 訂房歸屬月份以「入住日」落在哪個 Asia/Taipei 月份決定；跨月訂房整筆算在入住月。
//   4. 拆帳使用 `settlement.ts` 的比例規則，支出目前固定為 0（主 repo 尚無支出資料）。
import { isInTaipeiMonth, toTaipeiDateISO, type DateInput } from "@/lib/dates";
import { calculateBreakdown } from "@/lib/settlement";

export interface ReportPropertyInput {
  id: string;
  name: string;
  monthlyRent: number;
  /** 0–100 整數百分比 */
  ownerShare: number;
}

export interface ReportBookingInput {
  id: string;
  propertyId: string;
  guestName: string;
  checkIn: DateInput;
  checkOut: DateInput;
  channel: string;
  totalPrice: number;
  status: string;
}

export interface MonthlyReportProperty {
  propertyId: string;
  propertyName: string;
  monthlyRent: number;
  ownerSharePercent: number;
  bookingRevenue: number;
  bookingCount: number;
  totalIncome: number;
  ownerShareAmount: number;
  operatorShare: number;
  bookings: Array<{
    id: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    channel: string;
    totalPrice: number;
  }>;
}

export interface MonthlyReport {
  month: string;
  properties: MonthlyReportProperty[];
  summary: {
    totalRevenue: number;
    totalOwnerShare: number;
    totalOperatorShare: number;
    propertyCount: number;
  };
}

/** 這筆訂房是否計入指定月份的月報收入。 */
export function isBookingCountedInMonth(
  booking: Pick<ReportBookingInput, "status" | "checkIn">,
  month: string,
): boolean {
  return booking.status === "completed" && isInTaipeiMonth(booking.checkIn, month, "checkIn");
}

export function buildMonthlyReport(params: {
  month: string;
  properties: ReportPropertyInput[];
  bookings: ReportBookingInput[];
}): MonthlyReport {
  const { month, properties, bookings } = params;
  const counted = bookings.filter((b) => isBookingCountedInMonth(b, month));

  const rows: MonthlyReportProperty[] = properties.map((p) => {
    const propBookings = counted.filter((b) => b.propertyId === p.id);
    const bookingRevenue = propBookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const totalIncome = p.monthlyRent + bookingRevenue;
    let breakdown;
    try {
      breakdown = calculateBreakdown({
        income: totalIncome,
        expenses: 0,
        rule: { type: "ratio", ownerShare: p.ownerShare },
      });
    } catch (err) {
      throw new MonthlyReportError(
        `物業「${p.name}」的拆帳資料無效：${err instanceof Error ? err.message : "未知錯誤"}`,
      );
    }
    return {
      propertyId: p.id,
      propertyName: p.name,
      monthlyRent: p.monthlyRent,
      ownerSharePercent: p.ownerShare,
      bookingRevenue,
      bookingCount: propBookings.length,
      totalIncome,
      ownerShareAmount: breakdown.ownerShare,
      operatorShare: breakdown.operatorShare,
      bookings: propBookings.map((b) => ({
        id: b.id,
        guestName: b.guestName,
        checkIn: toTaipeiDateISO(b.checkIn, "checkIn"),
        checkOut: toTaipeiDateISO(b.checkOut, "checkOut"),
        channel: b.channel,
        totalPrice: b.totalPrice,
      })),
    };
  });

  return {
    month,
    properties: rows,
    summary: {
      totalRevenue: rows.reduce((s, r) => s + r.totalIncome, 0),
      totalOwnerShare: rows.reduce((s, r) => s + r.ownerShareAmount, 0),
      totalOperatorShare: rows.reduce((s, r) => s + r.operatorShare, 0),
      propertyCount: rows.length,
    },
  };
}

export class MonthlyReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonthlyReportError";
  }
}

/** 月報轉成 CSV 用的列（每物業一列 + 最後一列合計）。 */
export function monthlyReportToCsvRows(report: MonthlyReport): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = report.properties.map((p) => ({
    月份: report.month,
    物業: p.propertyName,
    月租金: p.monthlyRent,
    訂房筆數: p.bookingCount,
    訂房收入: p.bookingRevenue,
    總收入: p.totalIncome,
    "房東分潤比例(%)": p.ownerSharePercent,
    房東分潤: p.ownerShareAmount,
    業者分潤: p.operatorShare,
  }));
  rows.push({
    月份: report.month,
    物業: "合計",
    月租金: report.properties.reduce((s, p) => s + p.monthlyRent, 0),
    訂房筆數: report.properties.reduce((s, p) => s + p.bookingCount, 0),
    訂房收入: report.properties.reduce((s, p) => s + p.bookingRevenue, 0),
    總收入: report.summary.totalRevenue,
    "房東分潤比例(%)": "",
    房東分潤: report.summary.totalOwnerShare,
    業者分潤: report.summary.totalOperatorShare,
  });
  return rows;
}
