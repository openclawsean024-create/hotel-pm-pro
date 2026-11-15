// lib/room-state.ts — 房況判斷（AC-009 缺陷 2，FR-020）
//
// 舊版先篩出「退房日 > 今天」的訂房，再判斷「退房日 = 今天」，所以 checkout_today 永遠不會出現；
// 而且對資料庫回傳的 Date 物件做 String().slice(0, 10)，拿到的不是 YYYY-MM-DD。
// 這裡的輸入一律是已轉成 Asia/Taipei 日曆日期（YYYY-MM-DD）的訂房。

export type RoomState = "empty" | "occupied" | "checkout_today" | "cleaning" | "maintenance";

export interface RoomStateBooking {
  propertyId: string;
  /** YYYY-MM-DD（Asia/Taipei） */
  checkIn: string;
  /** YYYY-MM-DD（Asia/Taipei） */
  checkOut: string;
}

/**
 * 判斷順序：
 *   1. 有進行中的維修 → maintenance
 *   2. 有訂房今天退房 → checkout_today（即使同日有下一組入住，也先顯示待退房／待整理）
 *   3. 今晚有人住（入住日 ≤ 今天 < 退房日）→ occupied
 *   4. 昨天退房且今天沒有人入住 → cleaning
 *   5. 其他 → empty
 * 傳入的訂房不應包含已取消者。
 */
export function deriveRoomState(
  propertyId: string,
  todayStr: string,
  yesterdayStr: string,
  bookings: RoomStateBooking[],
  activeMaint: Set<string>,
): RoomState {
  if (activeMaint.has(propertyId)) return "maintenance";

  const mine = bookings.filter((b) => b.propertyId === propertyId);

  if (mine.some((b) => b.checkOut === todayStr && b.checkIn < todayStr)) return "checkout_today";
  if (mine.some((b) => b.checkIn <= todayStr && b.checkOut > todayStr)) return "occupied";

  const yesterdaysCheckout = mine.some((b) => b.checkOut === yesterdayStr);
  const todayCheckin = mine.some((b) => b.checkIn === todayStr);
  if (yesterdaysCheckout && !todayCheckin) return "cleaning";

  return "empty";
}
