# 民宿與包租代管 PMS — 開發 SOP

## 1. 環境準備

- Node.js：CI 使用 Node 20（`.github/workflows/ci.yml`）；本 repo 沒有 `.nvmrc` 或 `engines` 設定。
- 環境變數：複製 `.env.example` 為 `.env.local`，本機開發只填測試值。只需 build 時，可用 CI 的假值（見下方 §3 Build）。
- `.env.local` 不得提交。

```bash
npm ci --legacy-peer-deps
npx prisma generate
```

## 2. 驗證指令（依 `package.json` scripts 查證，2026-11-16）

| 類型 | 指令 | 現況 |
|---|---|---|
| 安裝 | `npm ci --legacy-peer-deps` | 可用（2026-11-16 本機 exit 0） |
| Prisma client | `npx prisma generate` | 可用（exit 0）；不需連資料庫 |
| Typecheck | `npm run typecheck`（= `tsc --noEmit`） | 可用（exit 0） |
| Lint | `npm run lint` | ⚠️ 實際是 `tsc --noEmit`，**不是 ESLint**；repo 有 `.eslintrc.json` 但沒有安裝 eslint。真正的 lint 尚未配置 |
| Unit test | `npm test` | ⚠️ 只執行 `echo "no unit tests yet…"` 並 exit 0，**目前 0 個測試**；不得把它當成測試通過。Vitest 尚未配置（M1 AC-001） |
| Integration test | — | 尚未配置（M1 以 route handler 測試補上） |
| E2E | — | 尚未配置（無 Playwright；M1 AC-008 加入 `test:e2e`） |
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

## 4. 提交前檢查（目前可用的部分）

```bash
npm run typecheck
npm run build        # 帶 §3 假環境變數
git diff --check
git grep -nE "sk_live_[A-Za-z0-9]|rk_live_[A-Za-z0-9]|whsec_[A-Za-z0-9]{20,}"   # 應無輸出
```

`npm test` 與 `npm run lint` 在 M1 完成前不能證明任何事，不得在 PR 或 STATUS 中寫成「測試通過」。

## 5. M1 完成後預計的指令（尚未配置，完成 AC 後再改成可用）

| 指令 | 對應 AC |
|---|---|
| `npm test`（Vitest） | AC-001～AC-007、AC-009 |
| `npx vitest run <path>` | 各 AC 指定的測試檔 |
| `npm run test:e2e`（Playwright） | AC-008 |

## 6. Stripe 測試模式手動驗證（AC-006 (c)，尚未執行）

需要：Stripe CLI、Stripe **測試模式**帳號、本機 `.env.local` 的測試金鑰（不提交）。

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
