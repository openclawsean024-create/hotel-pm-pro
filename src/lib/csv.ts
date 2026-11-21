// lib/csv.ts — CSV 產生（AC-003，FR-018）
// 來源：hotel-pm `src/lib/domain.ts` 的 `createCsv` / `escapeCsvField`（合併清單 #3），邏輯未改。

// 試算表公式注入防護：以 = + - @ Tab CR 開頭的文字會被 Excel 當成公式，前面加上 ' 讓它保持文字。
// 純數字（含負數，例如 -500）不加，才能維持數字格式。
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
function neutralizeFormula(value: string): string {
  return FORMULA_START.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
}

// RFC 4180：欄位含 , " \r \n 時用雙引號包起來，內部的 " 改成 ""
function escapeCsvField(raw: string): string {
  const value = neutralizeFormula(raw);
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** 以第一列的 key 當表頭；空陣列回傳空字串。 */
export function createCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvField(String(row[h] ?? ""))).join(","));
  }
  return lines.join("\n");
}
