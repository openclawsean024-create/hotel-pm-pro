// test-utils/mock-db.ts — route handler 測試用的假資料層
// 用法：在測試檔 `vi.mock("@/lib/pg-client")` 之後，以 `installSqlRouter` 依 SQL 內容回傳假資料，
// 並記錄每一次查詢（SQL 與參數），讓測試可以斷言「有沒有以 userId 限定」「有沒有寫入」。
import { vi, type Mock } from "vitest";

export interface SqlRule {
  /** 以 SQL 文字比對；第一個符合的規則勝出 */
  match: RegExp;
  /** 回傳的列；可為函式（收到參數與 SQL） */
  rows: unknown[] | ((params: unknown[], sql: string) => unknown[] | Promise<unknown[]>);
}

export interface SqlCall {
  sql: string;
  params: unknown[];
}

export interface SqlRouter {
  calls: SqlCall[];
  /** 找出 SQL 符合 pattern 的呼叫 */
  find(pattern: RegExp): SqlCall[];
}

type PgModule = { pgQuery: unknown; pgQueryOne: unknown };

export function installSqlRouter(pg: PgModule, rules: SqlRule[]): SqlRouter {
  const calls: SqlCall[] = [];
  const run = async (sql: string, params: unknown[] = []): Promise<unknown[]> => {
    calls.push({ sql, params });
    for (const rule of rules) {
      if (rule.match.test(sql)) {
        return typeof rule.rows === "function" ? await rule.rows(params, sql) : rule.rows;
      }
    }
    return [];
  };
  (pg.pgQuery as Mock).mockImplementation(run);
  (pg.pgQueryOne as Mock).mockImplementation(async (sql: string, params: unknown[] = []) => {
    const rows = await run(sql, params);
    return rows[0] ?? null;
  });
  return {
    calls,
    find: (pattern) => calls.filter((c) => pattern.test(c.sql)),
  };
}

/** 假的登入狀態（明顯的假資料）。 */
export const TEST_USER = { id: "user-test-1", email: "demo@hotel-pm.test", name: "測試業者A" };

export function mockSession(auth: unknown, user: { id: string; email?: string; name?: string } | null): void {
  (auth as Mock).mockResolvedValue(user ? { user } : null);
}

export function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const routeParams = (id: string) => ({ params: Promise.resolve({ id }) });

export { vi };
