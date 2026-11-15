// lib/csv.ts — CSV 產生（AC-003，FR-018）
// 來源：hotel-pm `src/lib/domain.ts` 的 `createCsv` / `escapeCsvField`（合併清單 #3），邏輯未改。

// RFC 4180：欄位含 , " \r \n 時用雙引號包起來，內部的 " 改成 ""
function escapeCsvField(value: string): string {
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
