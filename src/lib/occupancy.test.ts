// AC-009 入住率測試
// 案例來源：hotel-pm `src/lib/domain.test.ts`「計算房源入住率」「getOccupancyRate 傳 garbage range 會 throw」，
// 欄位改為主 repo 的 checkIn／checkOut，斷言未放寬。
import { describe, expect, it } from "vitest";
import { getOccupancyRate } from "@/lib/occupancy";

const booking = { checkIn: "2026-07-10", checkOut: "2026-07-12", status: "confirmed" };

describe("AC-009 getOccupancyRate（搬自 hotel-pm）", () => {
  it("AC-009 計算房源入住率", () =>
    expect(getOccupancyRate([booking], "2026-07-01", "2026-07-31")).toBeCloseTo(2 / 31));
  it("AC-009 無效的區間會 throw", () =>
    expect(() => getOccupancyRate([], "bad", "2026-07-31")).toThrow(/rangeStart/));
});

describe("AC-009 getOccupancyRate 邊界", () => {
  it("AC-009 沒有訂房時為 0", () => expect(getOccupancyRate([], "2026-07-01", "2026-08-01")).toBe(0));
  it("AC-009 整個 7 月（31 晚）都有人住為 1", () =>
    expect(
      getOccupancyRate([{ checkIn: "2026-07-01", checkOut: "2026-08-01" }], "2026-07-01", "2026-08-01"),
    ).toBe(1));
  it("AC-009 已取消的訂房不計", () =>
    expect(
      getOccupancyRate([{ ...booking, status: "cancelled" }], "2026-07-01", "2026-08-01"),
    ).toBe(0));
  it("AC-009 跨月訂房只計區間內的晚數", () =>
    // 7/30–8/3 共 4 晚，其中 7/30、7/31 兩晚落在 7 月
    expect(
      getOccupancyRate([{ checkIn: "2026-07-30", checkOut: "2026-08-03" }], "2026-07-01", "2026-08-01"),
    ).toBe(2 / 31));
  it("AC-009 區間外的訂房不計", () =>
    expect(
      getOccupancyRate([{ checkIn: "2026-06-01", checkOut: "2026-06-05" }], "2026-07-01", "2026-08-01"),
    ).toBe(0));
  it("AC-009 多個單位：2 個物業、其中 1 個住滿 → 0.5", () =>
    expect(
      getOccupancyRate([{ checkIn: "2026-07-01", checkOut: "2026-08-01" }], "2026-07-01", "2026-08-01", 2),
    ).toBe(0.5));
  it("AC-009 單日區間：今晚有人住為 1、今天退房為 0", () => {
    expect(
      getOccupancyRate([{ checkIn: "2026-07-10", checkOut: "2026-07-12" }], "2026-07-11", "2026-07-12"),
    ).toBe(1);
    expect(
      getOccupancyRate([{ checkIn: "2026-07-10", checkOut: "2026-07-12" }], "2026-07-12", "2026-07-13"),
    ).toBe(0);
  });
  it("AC-009 重疊訂房重複計算時上限為 1", () =>
    expect(
      getOccupancyRate(
        [
          { checkIn: "2026-07-01", checkOut: "2026-08-01" },
          { checkIn: "2026-07-01", checkOut: "2026-08-01" },
        ],
        "2026-07-01",
        "2026-08-01",
      ),
    ).toBe(1));
  it("AC-009 unitCount 必須是正整數", () => {
    expect(() => getOccupancyRate([], "2026-07-01", "2026-08-01", 0)).toThrow(/unitCount/);
    expect(() => getOccupancyRate([], "2026-07-01", "2026-08-01", 1.5)).toThrow(/unitCount/);
  });
  it("AC-009 訂房的無效日期會 throw", () =>
    expect(() =>
      getOccupancyRate([{ checkIn: "bad", checkOut: "2026-07-12" }], "2026-07-01", "2026-08-01"),
    ).toThrow(/b\.checkIn/));
});
