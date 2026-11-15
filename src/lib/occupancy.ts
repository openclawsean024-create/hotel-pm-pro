// lib/occupancy.ts — 入住率（AC-009，FR-020）
//
// 來源：hotel-pm `src/lib/domain.ts` 的 `getOccupancyRate`（合併清單 #6）。
// 改寫重點：欄位改用主 repo 的 `checkIn`／`checkOut`；新增 `unitCount`，
// 讓多物業（每物業視為 1 個可售單位）可以算出 0–1 的整體入住率。
import { DAY_MS, parseDateStrict, type DateInput } from "@/lib/dates";

export interface OccupancyBooking {
  checkIn: DateInput;
  checkOut: DateInput;
  status?: string | null;
}

/**
 * 入住率 = 區間內已售晚數 ÷（區間天數 × 可售單位數），回傳 0–1。
 * - 區間為 [rangeStart, rangeEnd)，以天為單位。
 * - 已取消的訂房不計。
 * - 同一單位重疊的訂房會被重複計算；結果上限為 1。
 */
export function getOccupancyRate(
  bookings: OccupancyBooking[],
  rangeStart: DateInput,
  rangeEnd: DateInput,
  unitCount = 1,
): number {
  const rangeStartMs = parseDateStrict(rangeStart, "rangeStart").getTime();
  const rangeEndMs = parseDateStrict(rangeEnd, "rangeEnd").getTime();
  if (!Number.isInteger(unitCount) || unitCount < 1) {
    throw new Error(`unitCount 必須是正整數，收到: ${unitCount}`);
  }
  const totalDays = Math.max(1, Math.floor((rangeEndMs - rangeStartMs) / DAY_MS));
  let occupiedDays = 0;
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const bStart = Math.max(parseDateStrict(b.checkIn, "b.checkIn").getTime(), rangeStartMs);
    const bEnd = Math.min(parseDateStrict(b.checkOut, "b.checkOut").getTime(), rangeEndMs);
    occupiedDays += Math.max(0, Math.floor((bEnd - bStart) / DAY_MS));
  }
  return Math.min(1, occupiedDays / (totalDays * unitCount));
}
