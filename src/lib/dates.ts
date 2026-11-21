// lib/dates.ts — 日期工具（Asia/Taipei 為帳務與營運的基準時區）
//
// 資料庫欄位是 Postgres `timestamp`（不含時區，內容為 UTC）。台灣不實施日光節約，
// 所以 Asia/Taipei 固定為 UTC+8，可以用固定位移計算，不依賴執行環境的時區設定。

export const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type DateInput = Date | string;

/**
 * 嚴格日期解析：無效值會拋錯，避免 NaN 進入帳務或提醒計算。
 * 來源：hotel-pm `src/lib/domain.ts` `parseDateStrict`（合併清單 #4），改為同時接受 Date。
 */
export function parseDateStrict(value: DateInput, fieldName: string): Date {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`無效的日期欄位 ${fieldName}: ${JSON.stringify(value)}`);
  }
  return d;
}

/** 把時間點轉成 Asia/Taipei 的日曆日期字串 YYYY-MM-DD。 */
export function toTaipeiDateISO(value: DateInput, fieldName = "date"): string {
  const d = parseDateStrict(value, fieldName);
  return new Date(d.getTime() + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

export function taipeiTodayISO(now: Date = new Date()): string {
  return toTaipeiDateISO(now, "now");
}

/** YYYY-MM-DD 加減天數（純日曆運算）。 */
export function shiftDateISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** 兩個 YYYY-MM-DD 之間相差的日曆天數（to - from）。 */
export function diffCalendarDays(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(month: string): boolean {
  return MONTH_RE.test(month);
}

export function nextMonth(month: string): string {
  const m = MONTH_RE.exec(month);
  if (!m) throw new Error(`月份格式必須為 YYYY-MM，收到: ${JSON.stringify(month)}`);
  const y = Number(m[1]);
  const mm = Number(m[2]);
  return mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
}

/**
 * Asia/Taipei 月份的 UTC 區間 [start, end)。
 * 例：2026-07 → start = 2026-06-30T16:00:00.000Z、end = 2026-07-31T16:00:00.000Z。
 */
export function taipeiMonthRangeUtc(month: string): { start: Date; end: Date } {
  const m = MONTH_RE.exec(month);
  if (!m) throw new Error(`月份格式必須為 YYYY-MM，收到: ${JSON.stringify(month)}`);
  const y = Number(m[1]);
  const mm = Number(m[2]);
  return {
    start: new Date(Date.UTC(y, mm - 1, 1) - TAIPEI_OFFSET_MS),
    end: new Date(Date.UTC(y, mm, 1) - TAIPEI_OFFSET_MS),
  };
}

/** 時間點是否落在 Asia/Taipei 的指定月份內。 */
export function isInTaipeiMonth(value: DateInput, month: string, fieldName = "date"): boolean {
  const t = parseDateStrict(value, fieldName).getTime();
  const { start, end } = taipeiMonthRangeUtc(month);
  return t >= start.getTime() && t < end.getTime();
}

/** Asia/Taipei 某一天 00:00 對應的 UTC 時間（ISO 字串），用於 SQL 的日界線參數。 */
export function taipeiDayStartUtcISO(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00+08:00`).toISOString();
}
