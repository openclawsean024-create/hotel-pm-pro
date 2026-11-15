// lib/ics-booking.ts — ICS 事件轉訂房的共用規則（AC-007，FR-011）
import { createHash } from "node:crypto";

/** 由 (userId, ICS UID) 產生固定的 Booking id，讓同一個 UID 重複匯入時自然去重。 */
export function icsBookingId(userId: string, uid: string): string {
  return `ics_${createHash("sha256").update(`${userId}\n${uid}`).digest("hex").slice(0, 24)}`;
}
