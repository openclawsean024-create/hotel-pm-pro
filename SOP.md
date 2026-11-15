# 民宿與包租代管 PMS — 開發 SOP

## 1. 環境準備

- Node.js：CI 使用 Node 20（`.github/workflows/ci.yml`）；本 repo 沒有 `.nvmrc` 或 `engines` 設定。
- 環境變數：複製 `.env.example` 為 `.env.local`，本機開發只填測試值。只需 build 時，可用 CI 的假值（見下方 §3 Build）。
- `.env.local` 不得提交。

```bash
npm ci --legacy-peer-deps
npx prisma generate
```

## 2. 驗證指令（依 `package.json` scripts 查證，2026-11-16，M1 分支 `feat/m1`）

| 類型 | 指令 | 現況 |
|---|---|---|
| 安裝 | `npm ci --legacy-peer-deps` | 可用（2026-11-16 本機 exit 0） |
| Prisma client | `npx prisma generate` | 可用（exit 0）；不需連資料庫 |
| Typecheck | `npm run typecheck`（= `tsc --noEmit`） | 可用（exit 0） |
| Lint | `npm run lint`（= `eslint .`） | 可用；ESLint 9 flat config（`eslint.config.mjs`，`eslint-config-next`） |
| Unit test | `npm test`（= `vitest run`） | 可用；單元測試與 route handler 測試，不連資料庫、不連 Stripe |
| Integration test | `npx vitest run src/app/api` | route handler 測試（以 `vi.mock` 取代 `@/lib/pg-client`、`@/lib/auth`、`fetch`） |
| E2E | `npm run test:e2e`（= `playwright test`） | 可用；自行以假環境變數 build + start（port 3210），不需資料庫。第一次需 `npx playwright install chromium` |
| Build | `npm run build` | 可用；需要環境變數（可用假值），見 §3 |
| Dev server | `npm run dev` | 可用；登入與後台需要可連線的 Postgres |
| 正式啟動 | `npm run start` | 需先 build |
| 假資料 seed | `npm run seed` | 需要 `DATABASE_URL` 指向**開發用**資料庫；`npx tsx prisma/seed.ts --dry-run` 只印 SQL |
| Format | — | 尚未配置 |

## 3. Build（不連真實服務）

以下值都是假的，與 CI 使用的相同性質；不得替換成真實金鑰後提交。

```bash
DATABASE_URL=postgresql://dummy:dummy@127.0.0.1:5432/dummy \
AUTH_SECRET=dummy-auth-secret-for-local-only-32chars \
NEXTAUTH_SECRET=dummy-auth-secret-for-local-only-32chars \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
STRIPE_SECRET_KEY=sk_test_dummy_placeholder \
STRIPE_WEBHOOK_SECRET=whsec_dummy_placeholder \
STRIPE_PRICE_PRO=price_dummy_pro \
STRIPE_PRICE_BUSINESS=price_dummy_business \
npm run build
```

2026-11-16 本機（Node v26.13.1）以上述假值執行 exit 0。

## 4. 提交前檢查

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build        # 帶 §3 假環境變數
git diff --check
git grep -nE "sk_live_[A-Za-z0-9]|rk_live_[A-Za-z0-9]|whsec_[A-Za-z0-9]{20,}"   # 應無輸出
```

## 5. 各 AC 的測試

| 指令 | 對應 AC |
|---|---|
| `npx vitest run src/lib/ci-baseline.test.ts` | AC-001 |
| `npx vitest run src/lib/settlement.test.ts` | AC-002 |
| `npx vitest run src/lib/csv.test.ts src/app/api/reports` | AC-003 |
| `npx vitest run src/lib/contracts.test.ts` | AC-004 |
| `npx vitest run src/lib/booking-rules.test.ts src/app/api/bookings` | AC-005 |
| `npx vitest run src/app/api/stripe` | AC-006 (a)(b) |
| `npx vitest run src/lib/ics-parser.test.ts src/app/api/ics` | AC-007 |
| `npm run test:e2e` | AC-008 |
| `npx vitest run src/app/api/dashboard src/lib/occupancy.test.ts` | AC-009 |
| `npx vitest run src/lib/data-hygiene.test.ts` | AC-010 |

測試名稱一律以 AC 編號開頭，可用 `npx vitest run -t "AC-002"` 只跑某一條。

## 6. Stripe 測試模式手動驗證（AC-006 (c)，需 Sean 執行）

需要：Stripe CLI、Stripe **測試模式**帳號、本機 `.env.local` 的測試金鑰（不提交），以及已套用 `StripeEvent` 表的**開發用**資料庫（`npx prisma db push`）。

```bash
npm run dev
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

記錄執行時間、事件類型、HTTP 回應碼與資料庫結果到 `STATUS.md`，不得記錄任何金鑰或 `whsec_` 值。

## 7. 故意不做

- 不使用 Stripe 正式模式、不收真實款項。
- 不呼叫訂房平台官方 API、不抓取真實客戶的 ICS 連結做測試。
- 不使用真實個資。
- 不在 agent session 中部署 production 或修改 Vercel／Supabase／Stripe 後台設定。
