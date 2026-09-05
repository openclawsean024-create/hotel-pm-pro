// prisma/seed.ts — hotel-pm-pro demo data seeder
//
// 用 pg 直連（與 src/lib/pg-client.ts 一致），不用 Prisma client
// Idempotent：跑第二次不會 error，已存在的 demo user 不會重複建
//
// 觸發：
//   1. `npx prisma db seed`        — 透過 package.json 的 prisma.seed 設定
//   2. `npm run seed`              — 直接跑（package.json scripts）
//   3. `npx tsx prisma/seed.ts`    — 手動跑
//   4. `npx tsx prisma/seed.ts --dry-run`  — 只印 SQL 不執行（debug 用）

import { Pool } from "pg";
import bcrypt from "bcryptjs";

// ========== Env check ==========

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Add it to .env or run:");
  console.error("   export DATABASE_URL=postgresql://user:pass@host:5432/db");
  process.exit(1);
}

const isDryRun = process.argv.includes("--dry-run");

// ========== pg connection ==========
// 用獨立 Pool（不 import @/lib/pg-client，避免 Next alias 在 tsx 環境下解析失敗）
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
});

async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (isDryRun) {
    console.log(`[dry-run] SQL: ${sql.replace(/\s+/g, " ").trim()}`);
    if (params.length) console.log(`[dry-run] PARAMS: ${JSON.stringify(params)}`);
    return [];
  }
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

// ========== Helpers ==========

const cuid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

// 計算明天日期（YYYY-MM-DD，避免時區漂移，用本地時間）
const tomorrow = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

// ========== Main ==========

async function main() {
  console.log("🌱 hotel-pm-pro seed starting...");
  if (isDryRun) console.log("⚠️  DRY-RUN mode: no rows will be written\n");

  // ---- Idempotency check：demo user 已存在就整批跳過 ----
  const existing = await query<{ id: string }>(
    `SELECT id FROM "User" WHERE email = $1 LIMIT 1`,
    ["demo@hotel-pm.test"]
  );
  if (existing.length > 0) {
    console.log(`✓ demo user already exists (id=${existing[0].id}) — seed skipped.`);
    console.log("   若要重建：先 DELETE FROM \"User\" WHERE email='demo@hotel-pm.test' 再跑。");
    await pool.end();
    process.exit(0);
  }

  // ---- 1. User ----
  const userId = cuid();
  const passwordHash = await bcrypt.hash("Password123!", 10);

  await query(
    `INSERT INTO "User" (id, email, name, "passwordHash", tier, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'pro', NOW(), NOW())`,
    [userId, "demo@hotel-pm.test", "示範民宿老闆", passwordHash]
  );

  // ---- 2. Subscription (pro / active) ----
  const subscriptionId = cuid();
  await query(
    `INSERT INTO "Subscription"
       (id, "userId", "stripeSubscriptionId", "stripePriceId", "stripeCurrentPeriodEnd",
        plan, status, "cancelAtPeriodEnd", "createdAt", "updatedAt")
     VALUES ($1, $2, NULL, NULL, NULL, 'pro', 'active', false, NOW(), NOW())`,
    [subscriptionId, userId]
  );

  // ---- 3. Properties (2) ----
  const propertyZhongshanId = cuid();
  await query(
    `INSERT INTO "Property"
       (id, "userId", name, address, "roomType", area, "monthlyRent", "ownerShare", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [
      propertyZhongshanId,
      userId,
      "台北中山套房",
      "台北市中山區中山北路二段 XX 號",
      "整層",
      28,
      45000,
      80,
    ]
  );

  const propertyFengjiaId = cuid();
  await query(
    `INSERT INTO "Property"
       (id, "userId", name, address, "roomType", area, "monthlyRent", "ownerShare", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
    [
      propertyFengjiaId,
      userId,
      "台中逢甲雅房",
      "台中市西屯區文華路 XX 號",
      "雅房",
      10,
      18000,
      70,
    ]
  );

  // ---- 4. Tenants (1 per property) ----
  const tenantZhongshanId = cuid();
  await query(
    `INSERT INTO "Tenant"
       (id, "userId", "propertyId", name, phone, email, "startDate", "endDate",
        "monthlyRent", deposit, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '3 months', NULL, $7, $8, 'active', NOW(), NOW())`,
    [
      tenantZhongshanId,
      userId,
      propertyZhongshanId,
      "王小明",
      "0912345678",
      null,
      45000,
      90000,
    ]
  );

  const tenantFengjiaId = cuid();
  await query(
    `INSERT INTO "Tenant"
       (id, "userId", "propertyId", name, phone, email, "startDate", "endDate",
        "monthlyRent", deposit, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '2 months', NULL, $7, $8, 'active', NOW(), NOW())`,
    [
      tenantFengjiaId,
      userId,
      propertyFengjiaId,
      "李小華",
      "0923456789",
      null,
      18000,
      36000,
    ]
  );

  // ---- 5. Bookings (4) ----
  // 中山：陳先生 2026-12-20 ~ 2026-12-22 NT$6800
  await query(
    `INSERT INTO "Booking"
       (id, "userId", "propertyId", "guestName", "checkIn", "checkOut", channel, "totalPrice", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::date, $6::date, 'manual', $7, 'confirmed', NOW(), NOW())`,
    [cuid(), userId, propertyZhongshanId, "陳先生", "2026-12-20", "2026-12-22", 6800]
  );

  // 中山：林小姐 2026-12-31 ~ 2027-01-02 NT$7200
  await query(
    `INSERT INTO "Booking"
       (id, "userId", "propertyId", "guestName", "checkIn", "checkOut", channel, "totalPrice", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::date, $6::date, 'manual', $7, 'confirmed', NOW(), NOW())`,
    [cuid(), userId, propertyZhongshanId, "林小姐", "2026-12-31", "2027-01-02", 7200]
  );

  // 逢甲：張先生 2026-12-25 ~ 2026-12-27 NT$4200
  await query(
    `INSERT INTO "Booking"
       (id, "userId", "propertyId", "guestName", "checkIn", "checkOut", channel, "totalPrice", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::date, $6::date, 'manual', $7, 'confirmed', NOW(), NOW())`,
    [cuid(), userId, propertyFengjiaId, "張先生", "2026-12-25", "2026-12-27", 4200]
  );

  // 逢甲：黃小姐 2027-01-15 ~ 2027-01-17 NT$4200
  await query(
    `INSERT INTO "Booking"
       (id, "userId", "propertyId", "guestName", "checkIn", "checkOut", channel, "totalPrice", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::date, $6::date, 'manual', $7, 'confirmed', NOW(), NOW())`,
    [cuid(), userId, propertyFengjiaId, "黃小姐", "2027-01-15", "2027-01-17", 4200]
  );

  // ---- 6. Requirements (2) ----
  // 中山：repair, 冷氣不冷, high, open
  await query(
    `INSERT INTO "Requirement"
       (id, "userId", "propertyId", "tenantId", "bookingId", category, title, description,
        priority, status, "resolvedAt", notes, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NULL, 'repair', $5, $6, 'high', 'open', NULL, NULL, NOW(), NOW())`,
    [
      cuid(),
      userId,
      propertyZhongshanId,
      tenantZhongshanId,
      "冷氣不冷",
      "房客反映中山套房主臥冷氣吹不冷，壓縮機有異音。",
    ]
  );

  // 逢甲：cleaning_note, 退房後浴巾未更換, normal, resolved
  await query(
    `INSERT INTO "Requirement"
       (id, "userId", "propertyId", "tenantId", "bookingId", category, title, description,
        priority, status, "resolvedAt", notes, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NULL, 'cleaning_note', $5, $6, 'normal', 'resolved', NOW() - INTERVAL '1 day', $7, NOW() - INTERVAL '2 days', NOW())`,
    [
      cuid(),
      userId,
      propertyFengjiaId,
      tenantFengjiaId,
      "退房後浴巾未更換",
      "逢甲雅房上一位房客退房後，浴室浴巾未更換。",
      "已於退房當日下午 3 點補上新浴巾。",
    ]
  );

  // ---- 7. Maintenance (1) ----
  // 中山：冷氣維修，明天開始，pending
  const startDate = tomorrow();
  await query(
    `INSERT INTO "Maintenance"
       (id, "userId", "propertyId", "requirementId", "vendorName", "vendorPhone", "vendorEmail",
        title, description, "estimatedCost", "actualCost", "startDate", "endDate", "completedAt",
        status, notes, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NULL, $4, $5, NULL, $6, $7, $8, 0, $9::date, NULL, NULL, 'pending', NULL, NOW(), NOW())`,
    [
      cuid(),
      userId,
      propertyZhongshanId,
      "水電行阿明師傅",
      "0987654321",
      "冷氣維修",
      "中山套房主臥冷氣壓縮機異音維修，預估換電容 + 清洗。",
      2500,
      startDate,
    ]
  );

  console.log("\n✅ Seeded: 1 user / 2 properties / 2 tenants / 4 bookings / 2 requirements / 1 maintenance");
  console.log("   Login: demo@hotel-pm.test / Password123!");
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  await pool.end();
  process.exit(1);
});
