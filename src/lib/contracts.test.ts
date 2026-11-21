// AC-004 房客合約到期／逾期提醒測試
// 案例來源：hotel-pm `src/lib/domain.test.ts` 的「F-M2 住宿與合約」「parseDateStrict (F3 修正)」，
// 欄位改為主 repo 的 Tenant.endDate／status，斷言未放寬；另加「無 endDate」「今天到期」等邊界。
import { describe, expect, it } from "vitest";
import { calculateOverdueDays, getContractAlerts, parseDateStrict } from "@/lib/contracts";

const tenant = { id: "t1", name: "測試房客A", phone: "0900-000-001", endDate: "2026-12-31", status: "active" };

describe("AC-004 F-M2 住宿與合約（搬自 hotel-pm）", () => {
  it("AC-004 合約 30 天內到期產生 warning", () =>
    expect(getContractAlerts([tenant], new Date("2026-12-01"))).toEqual([
      { tenantId: "t1", message: "合約將於 30 天內到期", severity: "warning" },
    ]));

  it("AC-004 合約逾期會產生紅色警示", () =>
    expect(
      getContractAlerts([{ ...tenant, endDate: "2025-12-31" }], new Date("2026-01-10"))[0].severity,
    ).toBe("danger"));

  it("AC-004 逾期天數可計算", () =>
    expect(calculateOverdueDays("2026-07-01", new Date("2026-07-05"))).toBe(4));
});

describe("AC-004 parseDateStrict（搬自 hotel-pm「parseDateStrict (F3 修正)」）", () => {
  it("AC-004 合法 ISO 字串回 Date 物件", () => {
    expect(parseDateStrict("2026-07-10", "checkIn").toISOString()).toBe("2026-07-10T00:00:00.000Z");
  });
  it("AC-004 空字串會 throw", () => {
    expect(() => parseDateStrict("", "checkIn")).toThrow(/無效的日期欄位 checkIn/);
  });
  it("AC-004 亂碼會 throw", () => {
    expect(() => parseDateStrict("not-a-date", "checkIn")).toThrow(/無效的日期欄位 checkIn/);
  });
  it("AC-004 getContractAlerts 傳入無效 endDate 會 throw", () => {
    expect(() => getContractAlerts([{ id: "t-bad", endDate: "bad-date" }], new Date())).toThrow(/endDate/);
  });
  it("AC-004 接受 Date 物件；Invalid Date 會 throw", () => {
    expect(parseDateStrict(new Date("2026-07-10T00:00:00Z"), "d").toISOString()).toBe(
      "2026-07-10T00:00:00.000Z",
    );
    expect(() => parseDateStrict(new Date("x"), "d")).toThrow(/無效的日期欄位 d/);
  });
});

describe("AC-004 提醒邊界", () => {
  const now = new Date("2026-11-16T04:00:00Z"); // 台北 2026-11-16 12:00

  it("AC-004 無 endDate 不提醒", () => {
    expect(getContractAlerts([{ id: "t1", endDate: null }], now)).toEqual([]);
    expect(getContractAlerts([{ id: "t2" }], now)).toEqual([]);
    expect(getContractAlerts([{ id: "t3", endDate: "" }], now)).toEqual([]);
  });

  it("AC-004 今天到期顯示「合約今天到期」且為 warning", () =>
    expect(getContractAlerts([{ id: "t1", endDate: "2026-11-16" }], now)).toEqual([
      { tenantId: "t1", message: "合約今天到期", severity: "warning" },
    ]));

  it("AC-004 剛好 30 天後到期會提醒，31 天後不提醒", () => {
    expect(getContractAlerts([{ id: "t1", endDate: "2026-12-16" }], now)).toEqual([
      { tenantId: "t1", message: "合約將於 30 天內到期", severity: "warning" },
    ]);
    expect(getContractAlerts([{ id: "t1", endDate: "2026-12-17" }], now)).toEqual([]);
  });

  it("AC-004 昨天到期為逾期 1 天", () =>
    expect(getContractAlerts([{ id: "t1", endDate: "2026-11-15" }], now)).toEqual([
      { tenantId: "t1", message: "合約已逾期 1 天", severity: "danger" },
    ]));

  it("AC-004 明天到期為 1 天內到期（以台北日曆日計算，不受當下時刻影響）", () => {
    const lateNight = new Date("2026-11-16T15:59:00Z"); // 台北 2026-11-16 23:59
    expect(getContractAlerts([{ id: "t1", endDate: "2026-11-17" }], lateNight)).toEqual([
      { tenantId: "t1", message: "合約將於 1 天內到期", severity: "warning" },
    ]);
  });

  it("AC-004 台北已跨日但 UTC 尚未跨日時，以台北日期為準", () => {
    const taipeiNextDay = new Date("2026-11-16T16:30:00Z"); // 台北 2026-11-17 00:30
    expect(getContractAlerts([{ id: "t1", endDate: "2026-11-16" }], taipeiNextDay)).toEqual([
      { tenantId: "t1", message: "合約已逾期 1 天", severity: "danger" },
    ]);
  });

  it("AC-004 已退租（status = ended）的房客不提醒", () =>
    expect(getContractAlerts([{ id: "t1", endDate: "2026-01-01", status: "ended" }], now)).toEqual([]));

  it("AC-004 endDate 為資料庫回傳的 Date 物件也能判斷", () =>
    expect(
      getContractAlerts([{ id: "t1", endDate: new Date("2026-11-20T00:00:00Z"), status: "active" }], now),
    ).toEqual([{ tenantId: "t1", message: "合約將於 4 天內到期", severity: "warning" }]));

  it("AC-004 多位房客只回傳需要提醒者，順序與輸入一致", () => {
    const alerts = getContractAlerts(
      [
        { id: "a", endDate: "2027-06-30" },
        { id: "b", endDate: "2026-11-01" },
        { id: "c", endDate: null },
        { id: "d", endDate: "2026-11-30" },
      ],
      now,
    );
    expect(alerts.map((a) => [a.tenantId, a.severity])).toEqual([
      ["b", "danger"],
      ["d", "warning"],
    ]);
  });
});

describe("AC-004 calculateOverdueDays 邊界", () => {
  it("AC-004 尚未到期回 0", () =>
    expect(calculateOverdueDays("2026-07-10", new Date("2026-07-05"))).toBe(0));
  it("AC-004 當下等於到期時間回 0", () =>
    expect(calculateOverdueDays("2026-07-05", new Date("2026-07-05"))).toBe(0));
  it("AC-004 未滿一天回 0，滿一天回 1", () => {
    expect(calculateOverdueDays("2026-07-05", new Date("2026-07-05T23:59:59Z"))).toBe(0);
    expect(calculateOverdueDays("2026-07-05", new Date("2026-07-06T00:00:00Z"))).toBe(1);
  });
  it("AC-004 無效日期會 throw", () =>
    expect(() => calculateOverdueDays("bad", new Date())).toThrow(/dueDate/));
});
