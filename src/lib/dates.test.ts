// AC-003 月份邊界用的日期工具測試（Asia/Taipei）
import { describe, expect, it } from "vitest";
import {
  diffCalendarDays,
  isInTaipeiMonth,
  isValidMonth,
  nextMonth,
  shiftDateISO,
  taipeiMonthRangeUtc,
  taipeiTodayISO,
  toTaipeiDateISO,
} from "@/lib/dates";
import { parseUtcTimestamp } from "@/lib/pg-client";

describe("AC-003 Asia/Taipei 日期工具", () => {
  it("AC-003 toTaipeiDateISO：UTC 16:00 之後算台北的隔天", () => {
    expect(toTaipeiDateISO("2026-07-10T00:00:00Z")).toBe("2026-07-10");
    expect(toTaipeiDateISO("2026-07-10T15:59:59Z")).toBe("2026-07-10");
    expect(toTaipeiDateISO("2026-07-10T16:00:00Z")).toBe("2026-07-11");
    expect(toTaipeiDateISO(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });

  it("AC-003 taipeiTodayISO 以台北日期為準", () => {
    expect(taipeiTodayISO(new Date("2026-11-15T16:30:00Z"))).toBe("2026-11-16");
  });

  it("AC-003 taipeiMonthRangeUtc：月初 00:00（台北）= 前一天 16:00Z", () => {
    const r = taipeiMonthRangeUtc("2026-07");
    expect(r.start.toISOString()).toBe("2026-06-30T16:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-07-31T16:00:00.000Z");
  });

  it("AC-003 taipeiMonthRangeUtc：2 月（非閏年）與跨年", () => {
    expect(taipeiMonthRangeUtc("2026-02").end.toISOString()).toBe("2026-02-28T16:00:00.000Z");
    expect(taipeiMonthRangeUtc("2028-02").end.toISOString()).toBe("2028-02-29T16:00:00.000Z");
    expect(taipeiMonthRangeUtc("2026-01").start.toISOString()).toBe("2025-12-31T16:00:00.000Z");
  });

  it("AC-003 isInTaipeiMonth 區間為左閉右開", () => {
    expect(isInTaipeiMonth("2026-06-30T16:00:00Z", "2026-07")).toBe(true);
    expect(isInTaipeiMonth("2026-06-30T15:59:59.999Z", "2026-07")).toBe(false);
    expect(isInTaipeiMonth("2026-07-31T15:59:59.999Z", "2026-07")).toBe(true);
    expect(isInTaipeiMonth("2026-07-31T16:00:00Z", "2026-07")).toBe(false);
  });

  it("AC-003 isValidMonth 只接受 YYYY-MM（01–12）", () => {
    expect(isValidMonth("2026-07")).toBe(true);
    for (const bad of ["2026-7", "2026-13", "2026-00", "26-07", "2026-07-01", ""]) {
      expect(isValidMonth(bad)).toBe(false);
    }
  });

  it("AC-003 nextMonth 與 shiftDateISO、diffCalendarDays", () => {
    expect(nextMonth("2026-07")).toBe("2026-08");
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(() => nextMonth("2026-13")).toThrow(/YYYY-MM/);
    expect(shiftDateISO("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDateISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffCalendarDays("2026-11-16", "2026-12-16")).toBe(30);
    expect(diffCalendarDays("2026-11-16", "2026-11-15")).toBe(-1);
  });

  it("AC-003 資料庫 timestamp 一律以 UTC 解析，不受執行環境時區影響", () => {
    expect(parseUtcTimestamp("2026-07-10 00:00:00").toISOString()).toBe("2026-07-10T00:00:00.000Z");
    expect(parseUtcTimestamp("2026-06-30 16:00:00.123").toISOString()).toBe("2026-06-30T16:00:00.123Z");
  });
});
