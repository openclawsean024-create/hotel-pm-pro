// AC-002 拆帳引擎測試
// 案例來源：hotel-pm `src/lib/domain.test.ts` 的「F-M6 報表與拆帳」與「拆帳 ownerRatio 範圍驗證」，
// 改寫成主 repo 欄位（ownerRatio 0–1 → ownerShare 0–100 整數），斷言強度不變；另加四捨五入邊界。
import { describe, expect, it } from "vitest";
import { calculateBreakdown, ownerShareToRatio } from "@/lib/settlement";
import { buildMonthlyReport } from "@/lib/monthly-report";

describe("AC-002 F-M6 報表與拆帳（搬自 hotel-pm）", () => {
  it("AC-002 固定比例拆帳", () =>
    expect(
      calculateBreakdown({ income: 100000, expenses: 20000, rule: { type: "ratio", ownerShare: 70 } }),
    ).toEqual({ netIncome: 80000, ownerShare: 56000, operatorShare: 24000, checksum: 80000 }));

  it("AC-002 固定金額拆帳", () =>
    expect(
      calculateBreakdown({ income: 100000, expenses: 20000, rule: { type: "fixed", ownerAmount: 25000 } }),
    ).toEqual({ netIncome: 80000, ownerShare: 25000, operatorShare: 55000, checksum: 80000 }));

  it("AC-002 階梯式租金拆帳", () =>
    expect(
      calculateBreakdown({
        income: 60000,
        expenses: 10000,
        rule: {
          type: "tiered",
          tiers: [
            { until: 30000, ownerShare: 60 },
            { until: Infinity, ownerShare: 70 },
          ],
        },
      }),
    ).toEqual({ netIncome: 50000, ownerShare: 35000, operatorShare: 15000, checksum: 50000 }));

  it("AC-002 拆帳雙重驗算總和相等", () => {
    const r = calculateBreakdown({ income: 50000, expenses: 5000, rule: { type: "ratio", ownerShare: 50 } });
    expect(r.ownerShare + r.operatorShare).toBe(r.checksum);
  });

  it("AC-002 生成月報表（月報使用拆帳引擎）", () => {
    const report = buildMonthlyReport({
      month: "2026-07",
      properties: [{ id: "p1", name: "測試物業A", monthlyRent: 0, ownerShare: 70 }],
      bookings: [
        {
          id: "b1",
          propertyId: "p1",
          guestName: "測試旅客A",
          checkIn: "2026-07-10",
          checkOut: "2026-07-12",
          channel: "manual",
          totalPrice: 6000,
          status: "completed",
        },
      ],
    });
    expect(report.properties[0]).toMatchObject({ propertyId: "p1", totalIncome: 6000 });
    expect(report.properties[0].ownerShareAmount).toBe(4200);
    expect(report.properties[0].operatorShare).toBe(1800);
  });

  it("AC-002 負支出不得讓報表通過", () =>
    expect(() =>
      calculateBreakdown({ income: 100, expenses: -1, rule: { type: "ratio", ownerShare: 50 } }),
    ).toThrow("支出不可為負數"));
});

describe("AC-002 拆帳 ownerShare 範圍驗證（搬自 hotel-pm「拆帳 ownerRatio 範圍驗證」）", () => {
  it("AC-002 比例 > 100 會 throw", () => {
    expect(() =>
      calculateBreakdown({ income: 1000, expenses: 0, rule: { type: "ratio", ownerShare: 150 } }),
    ).toThrow(/ownerShare 必須是 0~100 的整數/);
  });
  it("AC-002 比例 < 0 會 throw", () => {
    expect(() =>
      calculateBreakdown({ income: 1000, expenses: 0, rule: { type: "ratio", ownerShare: -10 } }),
    ).toThrow(/ownerShare 必須是 0~100 的整數/);
  });
  it("AC-002 比例 = 0 邊界值合法", () => {
    expect(() =>
      calculateBreakdown({ income: 1000, expenses: 0, rule: { type: "ratio", ownerShare: 0 } }),
    ).not.toThrow();
  });
  it("AC-002 tiered 任一階的 ownerShare 超出範圍會 throw", () => {
    expect(() =>
      calculateBreakdown({
        income: 60000,
        expenses: 10000,
        rule: {
          type: "tiered",
          tiers: [
            { until: 30000, ownerShare: 60 },
            { until: Infinity, ownerShare: 150 },
          ],
        },
      }),
    ).toThrow(/ownerShare 必須是 0~100 的整數/);
  });
});

describe("AC-002 ownerShare（0–100 整數）明確轉換", () => {
  it("AC-002 ownerShareToRatio 把百分比轉成 0–1", () => {
    expect(ownerShareToRatio(0)).toBe(0);
    expect(ownerShareToRatio(70)).toBe(0.7);
    expect(ownerShareToRatio(100)).toBe(1);
  });
  it("AC-002 把 0–1 小數誤當百分比傳入會被擋下", () => {
    expect(() => ownerShareToRatio(0.7)).toThrow(/ownerShare 必須是 0~100 的整數/);
    expect(() =>
      calculateBreakdown({ income: 1000, expenses: 0, rule: { type: "ratio", ownerShare: 0.7 } }),
    ).toThrow(/ownerShare 必須是 0~100 的整數/);
  });
  it("AC-002 NaN、Infinity、超過 100 都會 throw", () => {
    for (const bad of [NaN, Infinity, -Infinity, 101, -1, 99.5]) {
      expect(() => ownerShareToRatio(bad)).toThrow(/ownerShare 必須是 0~100 的整數/);
    }
  });
  it("AC-002 比例 = 100 全數給房東", () => {
    expect(
      calculateBreakdown({ income: 1234, expenses: 0, rule: { type: "ratio", ownerShare: 100 } }),
    ).toEqual({ netIncome: 1234, ownerShare: 1234, operatorShare: 0, checksum: 1234 });
  });
});

describe("AC-002 輸入驗證", () => {
  it("AC-002 負收入會 throw", () =>
    expect(() =>
      calculateBreakdown({ income: -1, expenses: 0, rule: { type: "ratio", ownerShare: 50 } }),
    ).toThrow("收入不可為負數"));
  it("AC-002 非整數金額會 throw（金額一律為整數元）", () => {
    expect(() =>
      calculateBreakdown({ income: 100.5, expenses: 0, rule: { type: "ratio", ownerShare: 50 } }),
    ).toThrow(/收入必須是整數元/);
    expect(() =>
      calculateBreakdown({ income: 100, expenses: 0.5, rule: { type: "ratio", ownerShare: 50 } }),
    ).toThrow(/支出必須是整數元/);
    expect(() =>
      calculateBreakdown({ income: 100, expenses: 0, rule: { type: "fixed", ownerAmount: 10.5 } }),
    ).toThrow(/固定金額必須是整數元/);
  });
  it("AC-002 固定金額為負會 throw", () =>
    expect(() =>
      calculateBreakdown({ income: 100, expenses: 0, rule: { type: "fixed", ownerAmount: -1 } }),
    ).toThrow("固定金額不可為負數"));
  it("AC-002 階梯規則沒有任何一階會 throw", () =>
    expect(() =>
      calculateBreakdown({ income: 100, expenses: 0, rule: { type: "tiered", tiers: [] } }),
    ).toThrow("階梯規則至少需要一階"));
});

describe("AC-002 四捨五入邊界（整數元，.5 進位，尾差由業者吸收）", () => {
  it("AC-002 1001 元 × 50% = 500.5 → 房東 501、業者 500", () =>
    expect(
      calculateBreakdown({ income: 1001, expenses: 0, rule: { type: "ratio", ownerShare: 50 } }),
    ).toEqual({ netIncome: 1001, ownerShare: 501, operatorShare: 500, checksum: 1001 }));

  it("AC-002 1 元 × 50% = 0.5 → 房東 1、業者 0", () =>
    expect(
      calculateBreakdown({ income: 1, expenses: 0, rule: { type: "ratio", ownerShare: 50 } }),
    ).toEqual({ netIncome: 1, ownerShare: 1, operatorShare: 0, checksum: 1 }));

  it("AC-002 333 元 × 33% = 109.89 → 房東 110、業者 223", () =>
    expect(
      calculateBreakdown({ income: 333, expenses: 0, rule: { type: "ratio", ownerShare: 33 } }),
    ).toEqual({ netIncome: 333, ownerShare: 110, operatorShare: 223, checksum: 333 }));

  it("AC-002 10 元 × 15% = 1.5 → 房東 2；10 元 × 14% = 1.4 → 房東 1", () => {
    expect(
      calculateBreakdown({ income: 10, expenses: 0, rule: { type: "ratio", ownerShare: 15 } }).ownerShare,
    ).toBe(2);
    expect(
      calculateBreakdown({ income: 10, expenses: 0, rule: { type: "ratio", ownerShare: 14 } }).ownerShare,
    ).toBe(1);
  });

  it("AC-002 浮點陷阱：80000 × 70% 精確等於 56000（不出現 55999 或 56001）", () =>
    expect(
      calculateBreakdown({ income: 80000, expenses: 0, rule: { type: "ratio", ownerShare: 70 } }).ownerShare,
    ).toBe(56000));

  it("AC-002 淨收入為 0 時兩邊都是 0（不是 -0）", () => {
    const r = calculateBreakdown({ income: 500, expenses: 500, rule: { type: "ratio", ownerShare: 70 } });
    expect(r).toEqual({ netIncome: 0, ownerShare: 0, operatorShare: 0, checksum: 0 });
    expect(Object.is(r.ownerShare, -0)).toBe(false);
  });

  it("AC-002 淨收入為負（支出大於收入）時依比例分攤虧損，四捨五入對稱", () =>
    expect(
      calculateBreakdown({ income: 0, expenses: 1001, rule: { type: "ratio", ownerShare: 50 } }),
    ).toEqual({ netIncome: -1001, ownerShare: -501, operatorShare: -500, checksum: -1001 }));

  it("AC-002 固定金額超過淨收入時房東最多拿到淨收入", () =>
    expect(
      calculateBreakdown({ income: 10000, expenses: 0, rule: { type: "fixed", ownerAmount: 25000 } }),
    ).toEqual({ netIncome: 10000, ownerShare: 10000, operatorShare: 0, checksum: 10000 }));

  it("AC-002 階梯：淨收入剛好等於上限套用該階；超過所有上限套用最後一階", () => {
    const tiers = [
      { until: 30000, ownerShare: 60 },
      { until: 60000, ownerShare: 70 },
    ];
    expect(
      calculateBreakdown({ income: 30000, expenses: 0, rule: { type: "tiered", tiers } }).ownerShare,
    ).toBe(18000);
    expect(
      calculateBreakdown({ income: 30001, expenses: 0, rule: { type: "tiered", tiers } }).ownerShare,
    ).toBe(21001); // 30001 × 70% = 21000.7 → 21001
    expect(
      calculateBreakdown({ income: 90000, expenses: 0, rule: { type: "tiered", tiers } }).ownerShare,
    ).toBe(63000);
  });

  it("AC-002 階梯順序打亂時結果相同", () => {
    const a = calculateBreakdown({
      income: 50000,
      expenses: 0,
      rule: { type: "tiered", tiers: [{ until: Infinity, ownerShare: 70 }, { until: 30000, ownerShare: 60 }] },
    });
    expect(a.ownerShare).toBe(35000);
  });
});

describe("AC-002 帳務不變式：房東 + 業者 = 淨收入，且金額皆為整數", () => {
  it("AC-002 掃過多種金額、比例與規則，0 例外", () => {
    const incomes = [0, 1, 2, 3, 7, 99, 100, 101, 333, 999, 1001, 12345, 49999, 50001, 80000, 1234567];
    const expenses = [0, 1, 50, 333, 20000];
    let checked = 0;
    for (const income of incomes) {
      for (const expense of expenses) {
        for (let share = 0; share <= 100; share++) {
          const rules = [
            { type: "ratio" as const, ownerShare: share },
            { type: "fixed" as const, ownerAmount: share * 137 },
            {
              type: "tiered" as const,
              tiers: [
                { until: 1000, ownerShare: share },
                { until: Infinity, ownerShare: 100 - share },
              ],
            },
          ];
          for (const rule of rules) {
            const r = calculateBreakdown({ income, expenses: expense, rule });
            expect(r.ownerShare + r.operatorShare).toBe(r.netIncome);
            expect(r.checksum).toBe(r.netIncome);
            expect(Number.isInteger(r.ownerShare)).toBe(true);
            expect(Number.isInteger(r.operatorShare)).toBe(true);
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(incomes.length * expenses.length * 101 * 3);
  });
});
