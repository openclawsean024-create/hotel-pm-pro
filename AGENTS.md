<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — 民宿與包租代管 PMS（hotel-pm-pro）

## 1. 權威文件

- 規格：[`PRD/SPEC.md`](./PRD/SPEC.md) v4.0（FR、合併清單、法規與風險）。
- 目前里程碑：[`GOAL.md`](./GOAL.md)（只含 M1）。
- 驗證指令：[`SOP.md`](./SOP.md)；目前狀態：[`STATUS.md`](./STATUS.md)。
- 修改前先讀以上文件；任何實作都要能對應到 FR 或 AC 編號。

## 2. 專案結構

```
src/
  app/
    page.tsx, pricing/, faq/, terms/, privacy/, contact/   # 公開頁
    login/, register/（轉址到 /login）, checkout/           # 帳號與訂閱
    dashboard/                                              # 後台
      page.tsx（營運總覽）, properties/, tenants/, bookings/,
      ics/, requirements/, maintenance/, reports/
    api/
      auth/[...nextauth]/, auth/register/（目前回 410）
      properties/, tenants/, bookings/, requirements/, maintenance/（含 [id]/）
      ics/import/, reports/monthly/, dashboard/summary/
      stripe/checkout/, stripe/webhook/, contact/
    sitemap.ts, robots.ts
  components/
    AppNav.tsx, SessionProviderWrapper.tsx
    dashboard/   # 營運總覽元件（KPI、房況、時間軸、分帳卡、i18n 字典）
    landing/     # 首頁元件
  lib/
    auth.ts        # Auth.js v5 Credentials + JWT
    pg-client.ts   # 執行期資料存取（pg 參數化 SQL）
    prisma.ts      # Prisma client（目前執行期未使用）
    ics-parser.ts  # ICS 解析
  types/next-auth.d.ts
prisma/
  schema.prisma  # 資料表定義（以 prisma db push 套用；尚無 migration）
  seed.ts        # 假資料 seed
.github/workflows/ci.yml
```

M1 會新增 `src/lib/settlement.ts`、`csv.ts`、`contracts.ts`、`booking-rules.ts`、`occupancy.ts`、對應 `*.test.ts`、`tests/fixtures/`、`e2e/`、`vitest.config.ts`、`playwright.config.ts`（見 `GOAL.md`）。

## 3. 技術棧

| 項目 | 版本／說明 |
|---|---|
| 框架 | Next.js 16.2.12（App Router）、React 19.2.4、TypeScript 5 |
| 樣式 | Tailwind CSS v3 |
| 認證 | next-auth 5.0.0-beta.32（Credentials + bcryptjs，JWT session） |
| 資料庫 | Postgres（Supabase pooler）；執行期以 `pg` 直接查詢 |
| Schema | Prisma 5.22（只用於 schema 與 generate） |
| 金流 | Stripe 22.4（僅測試模式） |
| 驗證 | Zod 4 |
| 測試 | 尚未配置（M1 加入 Vitest 與 Playwright） |
| CI／部署 | GitHub Actions；Vercel |

## 4. 開發規則

1. **只用假資料**：測試、fixture、seed、截圖、文件、issue 一律使用明顯的假資料（例如 `demo@hotel-pm.test`、`測試房客A`、`0900-000-000`、`台北市測試路 XX 號`）。不得放入真實房客、房東、旅客或業者資料；不得把真實客戶的 ICS 連結寫進 repo。
2. **不得提交憑證**：`.env*`（`.env.example` 除外）不得提交；不得在程式、測試、文件、log 或 commit 訊息中出現真實的 `DATABASE_URL`、`AUTH_SECRET`、Stripe 金鑰（`sk_*`、`rk_*`）、`whsec_*`、Vercel token。測試用金鑰只能是明顯的假字串（例如 `sk_test_dummy_placeholder`）。
3. **Stripe 只用測試模式**：非 production 環境不得使用 `sk_live_` 金鑰；切換正式模式需 Sean 人審。
4. **測試不可為了通過而刪改斷言**：測試失敗時修正程式，不得刪除測試、放寬斷言、加 `skip`／`only`、或把 CI 改成 `continue-on-error`。確定是測試本身寫錯時，在 PR 說明原因並請 Sean 覆審。
5. **帳務規則**：金額以新台幣整數元計算；任何拆帳結果必須維持 `房東分潤 + 業者分潤 = 總收入`；修改拆帳或月報邏輯必須同時更新測試。
6. **多租戶隔離**：所有 SQL 都要以 `"userId" = $n` 限定，並使用參數化查詢；不得字串拼接使用者輸入。
7. **外部請求**：伺服器端抓取使用者提供的 URL 時，必須阻擋 localhost、私有與保留 IP。
8. **不宣稱未實作的功能**：README、方案頁、文件只描述程式實際有的行為。
9. **`hotel-pm` repo 只讀**：合併時在本 repo 重新實作或改寫；不得修改、封存、刪除或改名 `hotel-pm`。

## 5. Git 與審核

- 從 `main` 開分支，經 PR 合併；不得直接 push `main`、不得 `git push --force`。
- Commit 格式：`<type>(scope): <說明>（FR-xxx / AC-xxx）`。
- 以下變更需 Sean 人審：認證、授權、個資處理、資料庫 schema、金流、secrets、CI／部署設定。
- 完成一個 AC 時，把驗證指令與 exit code 記錄到 `STATUS.md`。
