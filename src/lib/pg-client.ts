// pg-client.ts — Direct pg 套件，繞過 Prisma 的 prepared statement
// Supabase Transaction pooler 不支援 server-side prepared statements (Prisma 預設行為)
// 用 pg + 簡單 query 解決 Register / Contact 等簡單操作
import { Pool } from "pg";

const globalForPg = globalThis as unknown as {
  pg: Pool | undefined;
};

export const pgPool =
  globalForPg.pg ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pg = pgPool;

// Helper: 把 query 結果轉成物件
export async function pgQuery<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const result = await pgPool.query(sql, params);
  return result.rows as T[];
}

// Helper: 單一 row
export async function pgQueryOne<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const rows = await pgQuery<T>(sql, params);
  return rows[0] ?? null;
}
