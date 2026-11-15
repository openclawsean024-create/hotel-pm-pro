// AC-003 CSV 匯出測試
// 案例來源：hotel-pm `src/lib/domain.test.ts` 的「CSV 跳脫 (RFC 4180)」與其他 createCsv 案例，斷言未放寬。
import { describe, expect, it } from "vitest";
import { createCsv } from "@/lib/csv";

describe("AC-003 CSV 跳脫 (RFC 4180)（搬自 hotel-pm）", () => {
  it("AC-003 欄位含逗號會自動加雙引號", () =>
    expect(createCsv([{ address: "台北,大安", rent: 1000 }])).toBe('address,rent\n"台北,大安",1000'));
  it("AC-003 欄位含雙引號會 escape 成兩個", () =>
    expect(createCsv([{ note: 'A "B" C' }])).toBe('note\n"A ""B"" C"'));
  it("AC-003 欄位含換行會自動加雙引號", () =>
    expect(createCsv([{ note: "line1\nline2" }])).toBe('note\n"line1\nline2"'));
  it("AC-003 欄位無特殊字元時維持原樣", () =>
    expect(createCsv([{ property: "p1", status: "pending" }])).toBe("property,status\np1,pending"));
  it("AC-003 輸出匯出資料為 CSV（含表頭）", () =>
    expect(createCsv([{ name: "測試房客A", rent: 30000 }])).toContain("name,rent"));
});

describe("AC-003 CSV 其他邊界", () => {
  it("AC-003 空陣列回傳空字串", () => expect(createCsv([])).toBe(""));
  it("AC-003 欄位含 CR 也會加雙引號", () =>
    expect(createCsv([{ note: "a\rb" }])).toBe('note\n"a\rb"'));
  it("AC-003 表頭本身含逗號也會跳脫", () =>
    expect(createCsv([{ "金額,元": 1 }])).toBe('"金額,元"\n1'));
  it("AC-003 null 與 undefined 輸出為空欄位", () =>
    expect(createCsv([{ a: null, b: undefined, c: 0 }])).toBe("a,b,c\n,,0"));
  it("AC-003 多列依第一列的欄位順序輸出", () =>
    expect(
      createCsv([
        { 物業: "測試物業A", 金額: 100 },
        { 金額: 200, 物業: "測試物業B" },
      ]),
    ).toBe("物業,金額\n測試物業A,100\n測試物業B,200"));
  it("AC-003 同時含逗號、雙引號、換行", () =>
    expect(createCsv([{ note: '他說 "好",\n明天見' }])).toBe('note\n"他說 ""好"",\n明天見"'));
});
