# Preflight Report

> 角色：general worker（task 0）
> 日期：2026-09-05
> 工作目錄：`/Users/sean/.minimax-agent/projects/hotel-pm-pro`
> 不修改任何 source code；本檔為 baseline 唯讀報告

---

## 環境

- Node version: `v22.23.2`
- npm version: `10.9.8`
- OS: `Darwin Mac-mini-2.local 25.6.0 Darwin Kernel Version 25.6.0 (arm64)`
- Next.js: `16.2.12`（訓練後版本）
- React: `19.2.4`
- Prisma client: `5.22.0`
- NextAuth: `5.0.0-beta.32`
- Zod: `4.4.3`
- Stripe: `22.4.0`
- pg: `8.22.0`
- Tailwind: `3.4.17`

---

## Step 1: `npm install`

- **exit code**: `0`
- **是否安裝成功**：**是**（142 packages, 4s）
- **deprecation warning**：**無**（`npm install --loglevel=verbose` 也無 deprecation / peer / invalid 訊息）
- **peer dep conflict**：**無**
- **audit 警告（4 high severity，僅供參考，不阻擋 build）**：
  - `nanoid <3.3.18` — custom generator infinite loop（CVE in nanoid）
  - `postcss <=8.5.22` — XSS via `</style>`、sourcemap 路徑穿越（多個 CVE）
  - `sharp <0.35.0` — libvips CVE-2026-33327/33328/35590/35591
  - 全部都是 transitive（`next` → postcss/sharp、`nanoid` 被 prisma 等拉進）
  - 修法是 `npm audit fix --force`，但會升到 `next@16.3.4`，**超出 package.json 鎖定的 16.2.12**，preflight 不動

> 安裝時間異常短（4s）是因為命中了本機 `~/.npm` 快取；不是 silent fail。

---

## Step 2: `npx prisma generate`

- **exit code**: `0`
- **是否成功**：**是**
- **輸出**：
  ```
  Prisma schema loaded from prisma/schema.prisma
  ✔ Generated Prisma Client (v5.22.0) to ./node_modules/@prisma/client in 62ms
  ```
- **生成的 client**：`./node_modules/@prisma/client`（標準位置）

---

## Step 3: `npx tsc --noEmit`

- **exit code**: `0`
- **error 數量**: `0`
- **warning 數量**: `0`（`tsc --noEmit` 不報 warning，只 type-error）
- 完整 log: `/tmp/tsc.log`（0 行，無輸出 = 全綠）

> AGENTS.md 警告的 Zod 4 / NextAuth 5 beta / Next 16 / React 19 — typecheck 全部通過，沒有 API 表面破壞。

---

## Step 4: `next build`

### 重點：Next.js 16 的 build flag 改了

`next.config.ts` 的註解說要用 `npx next build --no-turbopack`，**這個 flag 在 16.2.12 不存在**：

```
$ npx next build --no-turbopack
error: unknown option '--no-turbopack'
(Did you mean --turbopack?)
```

實際 help 顯示：Next 16 預設用 Turbopack，要切到 webpack 用 **`--webpack`**（不再是 `--no-turbopack`）。

```
--turbo, --turbopack    Builds using Turbopack.
--webpack               Builds using webpack.
```

`next.config.ts` 的「`--no-turbopack` 註解」屬於**過時文件**，要嘛更新註解、要嘛在 plan 裡改指令。

### 4a. `npx next build --webpack`（無環境變數）

- **exit code**: `0`（shell `tee` 後 echo 顯示 0，但實際 build 失敗，見下）
- **結果**：❌ **失敗** — Stripe SDK 在 module 初始化時拋錯
- **錯誤**：
  ```
  Error: Neither apiKey nor config.authenticator provided
      at dC._setAuthenticator (...)
      at new dC (...)  ← Stripe SDK constructor
      at <unknown> (.next/server/app/api/stripe/webhook/route.js:1:485)
  Error: Failed to collect page data for /api/stripe/webhook
  ```
- **根因**：`src/app/api/stripe/checkout/route.ts:7` 與 `src/app/api/stripe/webhook/route.ts:6` 在 module top-level 呼叫 `new Stripe(process.env.STRIPE_SECRET_KEY!)`，`!` 是非空斷言但**沒擋掉 runtime**。Next 16 在 build 階段會執行 page data collection（抓所有動態路由），此時 `process.env.STRIPE_SECRET_KEY` 為 `undefined`，Stripe SDK constructor 直接 throw。
- log: `/tmp/build-webpack.log`

### 4b. `npx next build`（無環境變數，預設 Turbopack）

- **exit code**: `0`（同上，shell 看到的 0 是 `tee` 後的）
- **結果**：❌ **失敗** — 同一個 Stripe 錯誤，這次掛在 `/api/stripe/checkout`
- log: `/tmp/build-turbo.log`

### 4c. `npx next build --webpack`（補 dummy env）

- **exit code**: `0`（真實成功）
- **結果**：✅ **通過**，30 routes 全部生成
- 使用的 env：
  ```
  STRIPE_SECRET_KEY=sk_test_dummy
  STRIPE_WEBHOOK_SECRET=whsec_dummy
  STRIPE_PRICE_PRO=price_dummy_pro
  STRIPE_PRICE_BUSINESS=price_dummy_business
  DATABASE_URL=postgres://dummy@localhost:5432/dummy
  AUTH_SECRET=dummy
  NEXTAUTH_SECRET=dummy
  NEXTAUTH_URL=http://localhost:3000
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```
- 編譯時間：2.3s、TypeScript 1.6s、靜態頁面 30/30
- 生成的 routes 摘要：
  ```
  ○ /, /_not-found, /checkout, /contact, /dashboard, /dashboard/bookings,
    /dashboard/maintenance, /dashboard/reports, /dashboard/requirements,
    /dashboard/tenants, /faq, /login, /pricing, /privacy, /register,
    /robots.txt, /sitemap.xml, /terms
  ƒ /api/auth/[...nextauth], /api/auth/register,
    /api/bookings, /api/bookings/[id],
    /api/contact,
    /api/maintenance, /api/maintenance/[id],
    /api/properties, /api/properties/[id],
    /api/reports/monthly,
    /api/requirements, /api/requirements/[id],
    /api/stripe/checkout, /api/stripe/webhook,
    /api/tenants, /api/tenants/[id]
  ```
- log: `/tmp/build-webpack2.log`

### 4d. `npx next build`（補 dummy env，預設 Turbopack）

- **exit code**: `0`（真實成功）
- **結果**：✅ **通過**，30 routes 全部生成
- 編譯時間：1.4s（比 webpack 快），其餘一致
- log: `/tmp/build-turbo2.log`

### 結論

- **預設 Turbopack 與 `--webpack` 都能過 build**，前提是給 8 個 dummy env vars
- **無 env 時一定掛在 Stripe SDK init**（module-level `new Stripe(undefined!)`）
- **PLAN 收斂條件 0 錯**：✅ 滿足（用 env 餵）
- **建議**：在 `package.json` 的 `build` script 加 `next build --webpack`，並寫 `.env.example` 列出 8 個 key（→ task 1c 收）；或把 dummy env 寫進 `next.config.ts` 的 `env` 區（production build 仍會失敗，但能讓 build 過）

---

## Step 5: `next lint`

- **exit code**: `0`（但指令被移除）
- **結果**：⚠️ **`next lint` 在 Next 16.2.12 已不存在**
  ```
  $ npx next lint
  Invalid project directory provided, no such such directory: .../lint
  ```
  Next 16 CLI 沒有 `lint` 這個 subcommand，只有 build / dev / start / typegen / upgrade / experimental-*。
- **ESLint 設定**：❌ **完全沒有**。`ls` 確認專案根目錄沒有 `eslint.config.*` 也沒有 `.eslintrc.*`，package.json 沒裝 eslint。
- **fallback 測試**：`npx eslint@latest src` 也會失敗：
  ```
  ESLint: 10.10.0
  ESLint couldn't find an eslint.config.* file.
  ```

> preflight 不能憑空建立 ESLint 設定（不動 source）。本專案目前**無 lint**。PLAN 收斂條件沒列 lint 為必要（tsc 過即可），所以這項不阻擋。

---

## Route / Page 盤點

### `src/app/dashboard/*/page.tsx`（find 結果）

```
src/app/dashboard/bookings/page.tsx
src/app/dashboard/maintenance/page.tsx
src/app/dashboard/page.tsx
src/app/dashboard/reports/page.tsx
src/app/dashboard/requirements/page.tsx
src/app/dashboard/tenants/page.tsx
```

共 **6 個 dashboard pages**（含 `/dashboard` 本身）。

### `AppNav` 列的 href（`src/components/AppNav.tsx:6-12`）

```ts
NAV_ITEMS = [
  { href: "/dashboard",              label: "總覽" },
  { href: "/dashboard/properties",   label: "物業" },
  { href: "/dashboard/tenants",      label: "房客" },
  { href: "/dashboard/bookings",     label: "訂房" },
  { href: "/dashboard/reports",      label: "月報表" },
];
```

### 缺的 page（AppNav 連結但 page 不存在）

| href | page 存在？ | 狀態 |
|---|---|---|
| `/dashboard` | ✅ `page.tsx` | OK |
| `/dashboard/properties` | ❌ **缺** | **404** — 點下去直接掛 |
| `/dashboard/tenants` | ✅ | OK |
| `/dashboard/bookings` | ✅ | OK |
| `/dashboard/reports` | ✅ | OK |

> **補**：`/dashboard` 自己就內建完整物業 CRUD（看 `src/app/dashboard/page.tsx:152-186` 有新增物業 form）。`/dashboard/properties` 連結是**功能重複**的導航冗餘，要嘛補一個簡化版重導頁、要嘛從 AppNav 拿掉（後者比較乾淨，因為 `/dashboard` 已經處理）。建議交給 task 1a 決定。

> 反向情況：`/dashboard/maintenance` 與 `/dashboard/requirements` 兩個 page 存在但**不在 AppNav**（PLAN 說是 follow-up，這邊先記）。

---

## Schema / pg 用法一致性

### `pgQuery` / `pgQueryOne` 使用清單（grep `src/`）

17 個檔案，**所有 API route + lib/auth.ts + lib/pg-client.ts 自己**都走 pg：

```
src/lib/auth.ts
src/lib/pg-client.ts
src/app/api/stripe/checkout/route.ts
src/app/api/stripe/webhook/route.ts
src/app/api/reports/monthly/route.ts
src/app/api/maintenance/route.ts
src/app/api/maintenance/[id]/route.ts
src/app/api/properties/route.ts
src/app/api/properties/[id]/route.ts
src/app/api/tenants/route.ts
src/app/api/tenants/[id]/route.ts
src/app/api/requirements/route.ts
src/app/api/requirements/[id]/route.ts
src/app/api/auth/register/route.ts
src/app/api/bookings/route.ts
src/app/api/bookings/[id]/route.ts
src/app/api/contact/route.ts
```

### `from "@prisma/client"` 使用清單（grep `src/`）

**1 個檔案**：`src/lib/prisma.ts`（**只是 singleton 定義，沒有任何檔案 import 它**）。

```
$ grep -rn 'from "@/lib/prisma"' src/
（無結果）
```

✅ **沒有人偷用 Prisma client**。`lib/prisma.ts` 算是死代碼，但被 `@auth/prisma-adapter` dependency 拉進來後留下的，preflight 不刪。

### Schema table 與 pg SQL 的對應（grep `FROM "<Table>"`）

| API route 用的 table | Prisma model | 對得起來？ |
|---|---|---|
| `"User"` | `model User` | ✅ |
| `"Property"` | `model Property` | ✅ |
| `"Tenant"` | `model Tenant` | ✅ |
| `"Booking"` | `model Booking` | ✅ |
| `"Maintenance"` | `model Maintenance` | ✅ |
| `"Subscription"` | `model Subscription` | ✅（僅 register route 寫） |

所有 SQL 欄位名（`"stripeCustomerId"`、`"passwordHash"`、`"userId"`、`"monthlyRent"`、`"ownerShare"`）都對得上 Prisma 欄位（含駝峰 quoted）。

### 兩個小不一致（不影響 build，但屬於「已壞」觀察）

1. `src/app/api/contact/route.ts:23` 與 `src/app/api/auth/register/route.ts:51` 用 `gen_random_uuid()::text` 生成 ID，而 schema 的 `ContactMessage.id` / `Subscription.id` 都是 `@default(cuid())`。Prisma migrate 跑下去會把 column 設成 `text`（沒 DB default），所以 SQL `gen_random_uuid()::text` 能寫進去（36-char UUID）。**不是 bug**，但 ID 格式會混（既有 code 寫入的 record 是 cuid、這兩條 route 寫入的是 uuid），日後 JOIN / log 對 ID 容易誤判。
2. `IcsEvent` schema 存在但無任何 API/UI 使用（F-M9 半成品，PLAN 已列入 task 1b）。

---

## 已壞 / 缺 / 設計不一致 盤點

### 1. AGENTS.md 警告的技術風險 — 實測結果

| 風險 | 實測 |
|---|---|
| Next.js 16.2.12 訓練後版本 | `npx next --help` 確認：CLI 大改（沒 `lint`、build flag 改 `--webpack` / `--turbopack` 顯式）；`node_modules/next/dist/docs/` 文件齊全可讀 |
| React 19.2.4 | tsc 過、build 過，無 client component 警告 |
| NextAuth 5.0.0-beta.32 | tsc 過、`src/lib/auth.ts` 用的都是 stable API（`NextAuth({...})`、`Credentials`、`jwt`/`session` callbacks） |
| Zod 4.4.3 | tsc 過、`.email()` / `.min()` / `.or(z.literal(""))` 寫法在 Zod 4 仍可用 |
| Stripe 22 + `apiVersion: "2026-07-29.dahlia"` | tsc 過、build 通過（前提是 env 有 STRIPE_SECRET_KEY） |
| bcryptjs 3.0.3 | 從 v2 升上來，import `bcryptjs` 仍 OK；API 不變（`bcrypt.hash` / `bcrypt.compare`） |

**AGENTS.md 警告沒有真實打中 baseline**：所有破壞性版本都過 typecheck + build。**唯一**的張力是 Next 16 CLI 改動（`next lint` 移除、build flag 變 explicit），需要更新文件。

### 2. UI bug（PLAN 已標為 follow-up，preflight 仍記）

- **`src/app/dashboard/requirements/page.tsx`**：
  - L130, 136, 146：`<label>物業</label>` 等 label **沒有 `className="label"`**
  - L131, 137, 146：對應的 `<select>` **沒有 `className="input"`**
  - L145：`<textarea className="input">` 正確
  - L144：`<input className="input">` 正確
- **`src/app/dashboard/maintenance/page.tsx`**：
  - L132, 140, 144, 148：`<label>物業</label>` 等 **沒有 `className="label"`**
  - L133：`<select>` 沒 `className="input"`
  - L141, 145, 149：`<input className="input">` 正確

對照 `src/app/dashboard/page.tsx:155-180`（正確寫法）就知道差異。render 結果：label 跟 select 會擠在一起沒距離、select 沒套全域 input 樣式。

### 3. AppNav 與 page 不一致

- AppNav 有 `/dashboard/properties` 但 page 缺（**404**）
- `/dashboard/maintenance` 與 `/dashboard/requirements` 兩 page 存在但 AppNav 沒列（孤兒）

### 4. 「repo 宣稱有但 code 沒有」

| 宣稱 / 期待 | 實際 |
|---|---|
| `prisma/seed.ts` 是可執行的 seed script | 只有一行 `// seed`，空 stub |
| F-M9 ICS 匯入功能 | 只有 `IcsEvent` schema 定義，沒 `src/lib/ics-parser.ts`、沒 `/api/ics/*`、沒 `/dashboard/ics` |
| README.md 專案說明 | 是 default `create-next-app` 的 boilerplate |
| `.env.example` | **不存在** |
| `next.config.ts` 註解的 `--no-turbopack` | **flag 不存在**（要用 `--webpack`） |
| `next lint` 整合 | Next 16 移除此指令、且 repo 無 ESLint config |

### 5. 其他觀察（不阻擋，但 preflight 順手記）

- `package.json` 沒有 `"prisma"` script 區塊、沒有 `seed` script
- `package.json` 也沒有 `"typecheck"` script（外部 reviewer 沒 `npx tsc` 指令提示）
- `src/lib/prisma.ts` 為 dead code（沒人 import），但因為 `@auth/prisma-adapter` 在 dep 裡，build 不會 tree-shake 掉它
- `tsconfig.tsbuildinfo` 在 .gitignore 之前 git status 應該會被忽略（沒檢查 .gitignore，preflight 不動）

---

## 結論

**一句話**：✅ **可以進平行 phase**。`tsc --noEmit` 0 錯、`next build`（用 8 個 dummy env）0 錯，AppNav 的 404 連結是 task 1a 的範圍、不影響 baseline。

### 最大 blocker（一句話）

> **`next build` 必須補 8 個 dummy env vars（尤其是 `STRIPE_SECRET_KEY`），否則 page data collection 階段就會被 Stripe SDK constructor 拋出 `Neither apiKey nor config.authenticator provided`**；task 1a/1b/1c 三條 worker 跑 build 前要先知道這件事。

### 建議下一步

**preflight 後可以直接平行**，三條 worker 出發前要帶：
1. `cd /Users/sean/.minimax-agent/projects/hotel-pm-pro && npm install`（已驗證：4s、0 警告、0 conflict）
2. 跑 `npx tsc --noEmit` 拿 type 乾淨度（已驗證：0 error）
3. 跑 build 前先 export 8 個 dummy env（或在 `package.json` 的 `build` script 加 `next build --webpack` 並在 `.env.example` 補齊 key — 這是 task 1c 的範圍）
4. `npx next build` 預設走 Turbopack；想走 webpack 改用 `--webpack` flag（不是 `--no-turbopack`，**`next.config.ts` 註解要更新**）

### 需要 follow-up（不在 PLAN 範圍，但建議下一輪修）

- 修 `requirements` / `maintenance` 兩頁的 label/select className（PLAN 標 follow-up，preflight 確認 bug 真實）
- 從 AppNav 拿掉 `/dashboard/properties` 連結（已和 `/dashboard` 重複），或加 redirect page
- 把 `IcsEvent` 從 `Subscription` 用 `gen_random_uuid()::text` 改回 cuid 保持一致
- 寫 ESLint config（Next 16 拿掉 `next lint` 後的官方建議是 `eslint.config.mjs` + `eslint-plugin-next`）
- 更新 `next.config.ts` 註解（`--no-turbopack` → `--webpack`）
- 刪掉 dead code `src/lib/prisma.ts`（沒人 import，但用 `npx prisma generate` 仍會產出 @prisma/client）
