// lib/booking-rules.ts — 訂房日期規則與重疊檢查（AC-005，FR-010）
//
// 來源：hotel-pm `src/lib/domain.ts` 的 `isBookingOverlapping`、`validateBooking` 的日期規則
// （合併清單 #5）。欄位改用主 repo 的 `checkIn`／`checkOut`／`status`。
import { parseDateStrict, type DateInput } from "@/lib/dates";

export interface BookingRange {
  checkIn: DateInput;
  checkOut: DateInput;
}

export interface ExistingBooking extends BookingRange {
  id: string;
  status?: string | null;
}

/** 日期規則：兩個日期都要有效，且退房日必須晚於入住日。回傳錯誤訊息陣列（空陣列＝通過）。 */
export function validateBookingDates(checkIn: DateInput, checkOut: DateInput): string[] {
  const errors: string[] = [];
  let start: number | null = null;
  let end: number | null = null;
  try {
    start = parseDateStrict(checkIn, "checkIn").getTime();
  } catch {
    errors.push("入住日期格式錯誤");
  }
  try {
    end = parseDateStrict(checkOut, "checkOut").getTime();
  } catch {
    errors.push("退房日期格式錯誤");
  }
  if (start !== null && end !== null && start >= end) {
    errors.push("退房日期需晚於入住日期");
  }
  return errors;
}

/** 兩筆訂房是否重疊。相鄰（a 的退房日 = b 的入住日）不算重疊。 */
export function isBookingOverlapping(a: BookingRange, b: BookingRange): boolean {
  const aStart = parseDateStrict(a.checkIn, "a.checkIn").getTime();
  const aEnd = parseDateStrict(a.checkOut, "a.checkOut").getTime();
  const bStart = parseDateStrict(b.checkIn, "b.checkIn").getTime();
  const bEnd = parseDateStrict(b.checkOut, "b.checkOut").getTime();
  return aStart < bEnd && bStart < aEnd;
}

/** 從既有訂房中找出與候選訂房重疊者；已取消（cancelled）的訂房不佔用日期。 */
export function findOverlappingBookings<T extends ExistingBooking>(
  candidate: BookingRange,
  existing: T[],
): T[] {
  return existing.filter(
    (b) => b.status !== "cancelled" && isBookingOverlapping(candidate, b),
  );
}
