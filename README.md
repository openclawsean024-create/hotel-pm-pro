# 民宿管家 hotel-pm

> **台灣民宿 / 包租代管專用 PMS** — 物業、房客、訂房、月報與房東拆帳。
>
> 本 README 只描述程式目前實際有的行為；規格與里程碑見 [`PRD/SPEC.md`](PRD/SPEC.md)、[`GOAL.md`](GOAL.md)，目前狀態見 [`STATUS.md`](STATUS.md)。

民宿管家是為台灣小型民宿業者、包租代管公司設計的雲端物業管理系統（PMS, Property Management System）。整合物業、房客、訂房、需求、維修、月報表於一站，並以 Stripe 訂閱制提供 Free / Pro / Business 三種方案。

---

## Features

| 功能 | 說明 |
|---|---|
| 🏘️ **物業管理** | 地址、房型、坪數、月租金、房東分潤比例一站管理 |
| 👥 **房客 CRM** | 租約期間、聯絡方式、押金；合約 30 天內到期與已逾期的站內提醒（不寄 Email 或 LINE） |
| 📅 **訂房看板** | 手動新增；同一物業日期重疊的訂房會被擋下（相鄰不算重疊） |
| 🛠️ **需求記錄** | 房客反應的維修、特別需求、清潔備註，附優先級與處理狀態 |
| 🔧 **維修派工** | 廠商聯絡、估價、實際費用、起訖日，附需求單關聯 |
| 📆 **ICS 匯入** | 手動貼上 https 的 iCal 連結匯入並轉成訂房（以 UID 去重、重疊時不建立並提示）；不會定期自動同步 |
| 📊 **月報表** | 月租 + 當月已完成訂房，依房東分潤比例拆帳；可下載 CSV（沒有 PDF） |
| 💳 **Stripe 訂閱** | Checkout 與 Webhook（目前只在測試模式驗證）；方案用量限制尚未實作 |

> 目前**暫停開放公開註冊**（`/register` 轉到登入頁、註冊 API 回 410），何時重開待決定。
> 後台路由由 `src/proxy.ts`（Next.js 16 的 middleware 慣例）保護，未登入一律轉到 `/login`；各 API 也各自檢查登入。

---

## Tech Stack

- **Framework**: [Next.js 16.2.12](https://nextjs.org/)（App Router、Turbopack 預設）
- **UI**: [React 19.2.4](https://react.dev/) + [Tailwind CSS v3](https://tailwindcss.com/)
- **ORM / DB**: [Prisma 5.22](https://www.prisma.io/)（schema only）+ [`pg` 8.22](https://node-postgres.com/) 直連（繞過 Supabase pooler 的 prepared statement 限制）
- **Database**: PostgreSQL（建議 [Supabase](https://supabase.com/)，免費 tier 即可）
- **Auth**: [NextAuth 5.0.0-beta](https://authjs.dev/)（Auth.js v5，Credentials provider + JWT session）
- **Payment**: [Stripe 22.4](https://stripe.com/)（Checkout + Webhook）
- **Validation**: [Zod 4](https://zod.dev/)
- **Password Hash**: [bcryptjs 3](https://www.npmjs.com/package/bcryptjs)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Test**: [Vitest](https://vitest.dev/)（單元與 route handler 測試）、[Playwright](https://playwright.dev/)（E2E）
- **Lint**: ESLint 9（`eslint-config-next`）

---

## 環境需求

開始前請先確認本機有以下工具：

- **Node.js 20+**（CI 使用 Node 20）
- **npm 10+**（隨 Node 22 內建）
- **PostgreSQL 14+** 連線字串（推薦用 [Supabase](https://supabase.com/) 免費方案）
- **Stripe 測試帳號**（拿 test mode 的 `sk_test_*` 與 `whsec_*`）

> macOS 用 `brew install node@22`；Windows 用 [nvm-windows](https://github.com/coreybutler/nvm-windows)。

---

## 本地啟動

### 1. 取得程式碼

```bash
git clone https://github.com/openclawsean024-create/hotel-pm-pro.git
cd hotel-pm-pro
```

### 2. 建立環境變數

```bash
cp .env.example .env
```

打開 `.env`，把 8 個 key 換成真實值：

| Key | 怎麼取得 |
|---|---|
| `DATABASE_URL` | Supabase Dashboard → Project Settings → Database → Connection string → **Transaction mode**（port 6543） |
| `AUTH_SECRET` | 終端機跑 `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | 同 `AUTH_SECRET` |
| `NEXT_PUBLIC_APP_URL` | 本地 `http://localhost:3000`；部署時改成實際網址 |
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) → Secret key（test mode） |
| `STRIPE_WEBHOOK_SECRET` | 跑 `stripe listen --forward-to localhost:3000/api/stripe/webhook`，把輸出貼過來 |
| `STRIPE_PRICE_PRO` | Stripe Dashboard → Products → Pro 方案 → Price ID |
| `STRIPE_PRICE_BUSINESS` | Stripe Dashboard → Products → Business 方案 → Price ID |

### 3. 安裝相依

```bash
npm ci --legacy-peer-deps
```

### 4. 套用 Prisma schema 到資料庫

```bash
npx prisma generate          # 產生 Prisma Client
npx prisma db push           # 把 schema 推上去（第一次用這個；之後改 schema 用 migrate dev）
```

> 如果想保留 migration 歷史，請用 `npx prisma migrate dev --name init`。

### 5. 植入 demo 資料

```bash
npm run seed
```

這會建立：
- 1 個 demo user（`demo@hotel-pm.test` / `Password123!`）
- 1 個 Pro 訂閱
- 2 個物業（中山、逢甲）
- 2 個房客
- 4 筆訂房、2 筆需求、1 筆維修派工

> 跑第二次會自動跳過（idempotent），不會 error 也不會重複建。所有 seed 資料都是明顯的假資料（`測試房客A`、`0900-000-001`、`台北市測試路 XX 號`）。

### 6. 啟動開發伺服器

```bash
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000)，用以下帳號登入：

```
Email:    demo@hotel-pm.test
Password: Password123!
```

---

## 環境變數清單

完整定義見 [`.env.example`](.env.example)。共 **8 個 key**：

1. `DATABASE_URL` — Postgres 連線字串
2. `AUTH_SECRET` — NextAuth 加密用
3. `NEXTAUTH_SECRET` — NextAuth legacy 變數（與 `AUTH_SECRET` 同值）
4. `NEXT_PUBLIC_APP_URL` — 對外網址（影響 OAuth callback、Stripe redirect）
5. `STRIPE_SECRET_KEY` — Stripe Server API key（test mode `sk_test_*`）
6. `STRIPE_WEBHOOK_SECRET` — Stripe Webhook signing secret
7. `STRIPE_PRICE_PRO` — Pro 方案的 price id
8. `STRIPE_PRICE_BUSINESS` — Business 方案的 price id

> ⚠️ 部署前請把 `.env` 加入 `.gitignore`（已經預設排除），**絕對不要 commit 真實 secret**。

---

## 部署

### Vercel（前端）

1. 從 [vercel.com/new](https://vercel.com/new) 匯入 GitHub repo
2. **Environment Variables** 貼上 8 個 key 的真實值（`AUTH_SECRET` / `STRIPE_SECRET_KEY` 等）
3. **Build Command** 保持預設 `next build`（Next 16 預設走 Turbopack）
4. **Output Directory** 保持 `.next`（預設）
5. 部署完成後，把 Vercel 給的網址填回 `NEXT_PUBLIC_APP_URL`

### Supabase（資料庫）

1. 開 [supabase.com](https://supabase.com/) 新建專案（選 Singapore region 最近台灣）
2. 從 Dashboard 拿 **Transaction mode** 連線字串（port 6543）填到 `DATABASE_URL`
3. 第一次部署後，本地跑 `npx prisma db push` 把 schema 推上去
4. 之後改 schema：用 `npx prisma migrate dev --name <change>` 產生 migration，再 commit

### Stripe Webhook

1. 部署完成後，到 [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks) 新增 endpoint
   - URL: `https://你的網域/api/stripe/webhook`
   - Events: `checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted`、`invoice.paid`、`invoice.payment_failed`
   - 非 production 環境若 `STRIPE_SECRET_KEY` 是 `sk_live_` 開頭，checkout 與 webhook 會拒絕執行
2. 把產生的 `whsec_*` 填到 Vercel 的 `STRIPE_WEBHOOK_SECRET` 環境變數
3. 在 test mode 測試一次 checkout → 確認 dashboard 訂閱狀態正確更新（切換正式模式需另行人審）

### 本地 Webhook 測試

```bash
# 安裝 Stripe CLI：https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# 把 stripe listen 印出來的 whsec_xxx 填到 .env
```

---

## 常用指令

```bash
npm run dev        # 啟動 dev server（Turbopack，HMR）
npm run build      # production build（需 8 個 env 餵好）
npm run start      # 啟動 production server
npm run seed       # 跑 seed script（需 DATABASE_URL）
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm test           # Vitest（不需資料庫、不連 Stripe）
npm run test:e2e   # Playwright（自行 build + start，不需資料庫）
npx prisma studio  # 開 GUI 看資料
```

---

## 授權

[MIT](LICENSE) — 歡迎 fork、修改、商用。

---

## 客服 / 聯絡

- 線上客服：站內 [/contact](https://hotel-pm-pro.vercel.app/contact) 頁面
- Email：請透過站內表單留言，會有專人在 1-2 個工作天內回覆
- Issue：本 repo 的 GitHub Issues


---

**Made with ❤️ in Taiwan for 台灣民宿業者**
