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

describe("AC-003 CSV 試算表公式注入防護", () => {
  it("AC-003 以 = + - @ 開頭的文字前面加上 '，Excel 不會當成公式執行", () => {
    const csv = createCsv([
      { name: '=HYPERLINK("http://x.example.test","y")' },
      { name: "+cmd|' /C calc'!A0" },
      { name: "-測試" },
      { name: "@SUM(A1)" },
      { name: "\t=1+1" },
    ]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe(`"'=HYPERLINK(""http://x.example.test"",""y"")"`);
    expect(lines[2]).toBe("'+cmd|' /C calc'!A0");
    expect(lines[3]).toBe("'-測試");
    expect(lines[4]).toBe("'@SUM(A1)");
    expect(lines[5]).toBe("'\t=1+1");
  });

  it("AC-003 負數與一般數字維持原樣（仍是數字）", () => {
    expect(createCsv([{ amount: -500 }, { amount: "-1234.5" }, { amount: 36000 }])).toBe("amount\n-500\n-1234.5\n36000");
  });
});
