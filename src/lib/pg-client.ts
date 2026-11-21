// pg-client.ts — Direct pg 套件，繞過 Prisma 的 prepared statement
// Supabase Transaction pooler 不支援 server-side prepared statements (Prisma 預設行為)
// 用 pg + 簡單 query 解決 Register / Contact 等簡單操作
import { Pool, types } from "pg";

/**
 * 資料表的時間欄位是 Postgres `timestamp`（不含時區），Prisma 寫入的是 UTC。
 * pg 預設會把它當成「執行環境的本地時間」解析：在 UTC 的伺服器（Vercel）沒差，
 * 但在 Asia/Taipei 的開發機會差 8 小時，讓月份邊界與房況判斷出錯。
 * 這裡固定以 UTC 解析，結果不再依賴執行環境的時區。
 */
export function parseUtcTimestamp(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

types.setTypeParser(types.builtins.TIMESTAMP, parseUtcTimestamp);

const globalForPg = globalThis as unknown as {
  pg: Pool | undefined;
};

export const pgPool: Pool =
  globalForPg.pg ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pg = pgPool;

// Helper: 把 query 結果轉成物件
export async function pgQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pgPool.query(sql, params);
  return result.rows as T[];
}

// Helper: 單一 row
export async function pgQueryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await pgQuery<T>(sql, params);
  return rows[0] ?? null;
}

/** 查詢介面：可以是連線池（各自獨立的查詢）或同一個交易內的連線。 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
}

/**
 * 在同一條連線上以交易執行 fn：fn 正常結束才 COMMIT，拋錯（或程序中斷、連線斷掉）就 ROLLBACK。
 * 用於「先檢查再寫入」必須一起成功或一起失敗的情境（webhook 冪等佔位、訂房重疊檢查）。
 */
export async function withTransaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pgPool.connect();
  const db: Db = {
    query: async <R,>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as R[],
    queryOne: async <R,>(sql: string, params: unknown[] = []) =>
      ((await client.query(sql, params)).rows[0] as R | undefined) ?? null,
  };
  try {
    await client.query("BEGIN");
    const result = await fn(db);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // 連線已斷：Postgres 會自動放棄未提交的交易
    }
    throw err;
  } finally {
    client.release();
  }
}
