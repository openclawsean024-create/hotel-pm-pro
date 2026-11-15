// AC-005 訂房日期規則與重疊檢查測試
// 案例來源：hotel-pm `src/lib/domain.test.ts` 的「F-M3 訂房看板」、validateBooking 的日期規則、
// 「isBookingOverlapping 傳 garbage 日期會 throw」，欄位改為主 repo 的 checkIn／checkOut，斷言未放寬。
import { describe, expect, it } from "vitest";
import { findOverlappingBookings, isBookingOverlapping, validateBookingDates } from "@/lib/booking-rules";

const booking = { id: "b1", checkIn: "2026-07-10", checkOut: "2026-07-12", status: "confirmed" };

describe("AC-005 F-M3 訂房看板（搬自 hotel-pm）", () => {
  it("AC-005 識別重疊訂房", () =>
    expect(isBookingOverlapping(booking, { checkIn: "2026-07-11", checkOut: "2026-07-13" })).toBe(true));
  it("AC-005 相鄰日期不視為重疊", () =>
    expect(isBookingOverlapping(booking, { checkIn: "2026-07-12", checkOut: "2026-07-13" })).toBe(false));
  it("AC-005 傳入無效日期會 throw", () =>
    expect(() => isBookingOverlapping({ ...booking, checkIn: "xxx" }, booking)).toThrow(/a\.checkIn/));
});

describe("AC-005 重疊判斷邊界", () => {
  it("AC-005 相鄰（前一筆入住日 = 新訂房退房日）也不算重疊", () =>
    expect(isBookingOverlapping(booking, { checkIn: "2026-07-08", checkOut: "2026-07-10" })).toBe(false));
  it("AC-005 完全包含與被包含都算重疊", () => {
    expect(isBookingOverlapping(booking, { checkIn: "2026-07-01", checkOut: "2026-07-31" })).toBe(true);
    expect(
      isBookingOverlapping(
        { checkIn: "2026-07-01", checkOut: "2026-07-31" },
        { checkIn: "2026-07-10", checkOut: "2026-07-11" },
      ),
    ).toBe(true);
  });
  it("AC-005 完全相同的日期算重疊", () => expect(isBookingOverlapping(booking, booking)).toBe(true));
  it("AC-005 只重疊一晚也算重疊", () =>
    expect(isBookingOverlapping(booking, { checkIn: "2026-07-09", checkOut: "2026-07-11" })).toBe(true));
  it("AC-005 Date 物件與字串可以混用", () =>
    expect(
      isBookingOverlapping(
        { checkIn: new Date("2026-07-10T00:00:00Z"), checkOut: new Date("2026-07-12T00:00:00Z") },
        { checkIn: "2026-07-11", checkOut: "2026-07-13" },
      ),
    ).toBe(true));
  it("AC-005 第二筆的無效日期也會 throw", () =>
    expect(() => isBookingOverlapping(booking, { checkIn: "2026-07-11", checkOut: "nope" })).toThrow(
      /b\.checkOut/,
    ));
});

describe("AC-005 日期規則（搬自 hotel-pm validateBooking）", () => {
  it("AC-005 退房日晚於入住日通過", () =>
    expect(validateBookingDates("2026-07-10", "2026-07-12")).toEqual([]));
  it("AC-005 退房日等於入住日不通過", () =>
    expect(validateBookingDates("2026-07-10", "2026-07-10")).toContain("退房日期需晚於入住日期"));
  it("AC-005 退房日早於入住日不通過", () =>
    expect(validateBookingDates("2026-07-12", "2026-07-10")).toContain("退房日期需晚於入住日期"));
  it("AC-005 日期格式錯誤會回報對應欄位", () => {
    expect(validateBookingDates("abc", "2026-07-10")).toEqual(["入住日期格式錯誤"]);
    expect(validateBookingDates("2026-07-10", "abc")).toEqual(["退房日期格式錯誤"]);
  });
});

describe("AC-005 findOverlappingBookings", () => {
  const existing = [
    { id: "b1", checkIn: "2026-07-10", checkOut: "2026-07-12", status: "confirmed" },
    { id: "b2", checkIn: "2026-07-12", checkOut: "2026-07-15", status: "completed" },
    { id: "b3", checkIn: "2026-07-11", checkOut: "2026-07-13", status: "cancelled" },
  ];
  it("AC-005 回傳所有重疊且未取消的訂房", () =>
    expect(
      findOverlappingBookings({ checkIn: "2026-07-11", checkOut: "2026-07-13" }, existing).map((b) => b.id),
    ).toEqual(["b1", "b2"]));
  it("AC-005 已取消的訂房不佔用日期", () =>
    expect(
      findOverlappingBookings({ checkIn: "2026-07-11", checkOut: "2026-07-12" }, [existing[2]]),
    ).toEqual([]));
  it("AC-005 相鄰訂房不算重疊", () =>
    expect(findOverlappingBookings({ checkIn: "2026-07-15", checkOut: "2026-07-17" }, existing)).toEqual([]));
  it("AC-005 沒有既有訂房時回空陣列", () =>
    expect(findOverlappingBookings({ checkIn: "2026-07-11", checkOut: "2026-07-13" }, [])).toEqual([]));
});
