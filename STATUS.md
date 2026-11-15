# Status — 民宿與包租代管 PMS（hotel-pm-pro）

- 更新日期：2026-11-16
- 狀態：🟡 **M1 程式完成，待 Sean 覆審與 AC-006 (c) 手動驗證**（分支 `feat/m1`）
- 目前里程碑：M1（見 `GOAL.md`）
- 規格：`PRD/SPEC.md` v4.0

## M1 AC 進度

狀態：✅ 驗證指令通過｜🟡 部分完成（說明見備註）。所有測試名稱都以 AC 編號開頭。

| AC | 內容 | 狀態 | 測試檔（通過數） | 主要 commit |
|---|---|---|---|---|
| AC-001 | 測試基線：Vitest、真正的 ESLint、CI 必經 | ✅ | `src/lib/ci-baseline.test.ts`（9） | `4808b1c` |
| AC-002 | 拆帳引擎（比例／固定／階梯） | ✅ | `src/lib/settlement.test.ts`（29，含 24,240 組不變式掃描） | `af6f9c0` |
| AC-003 | 月報帳務、Asia/Taipei 月份邊界、CSV | ✅ | `src/lib/csv.test.ts`（11）、`src/lib/dates.test.ts`（8）、`src/app/api/reports/monthly/route.test.ts`（24） | `01d59b5` |
| AC-004 | 合約到期／逾期提醒（站內） | ✅ | `src/lib/contracts.test.ts`（21）、`src/app/api/dashboard/summary/route.test.ts` 的 AC-004 區塊（4） | `ed646b0`、`d1f3219`、`bd2d9de` |
| AC-005 | 訂房重疊檢查（409／400） | ✅ | `src/lib/booking-rules.test.ts`（17）、`src/app/api/bookings/route.test.ts`（20） | `09b3b81` |
| AC-006 | Stripe 測試模式 | 🟡 (a)(b) ✅；(c) 待 Sean | `src/app/api/stripe/webhook/route.test.ts`（34）、`src/app/api/stripe/checkout/route.test.ts`（9）、`src/lib/stripe.test.ts`（9） | `48d59dd` |
| AC-007 | ICS 匯入轉訂房、SSRF 防護 | ✅ | `src/lib/ics-parser.test.ts`（26）、`src/lib/safe-fetch.test.ts`（32）、`src/app/api/ics/import/route.test.ts`（26） | `ebe06d2` |
| AC-008 | 6 個安全標頭、proxy、E2E | ✅ | `src/lib/security-headers.test.ts`（8）、`e2e/smoke.spec.ts`（29）、`e2e/flows.spec.ts`（9） | `a7f2bf0`、本次收尾 commit |
| AC-009 | 已知缺陷修正（Room 表、checkout_today、需求單編輯）+ 入住率 | ✅ | `src/app/api/dashboard/preload.test.ts`（6）、`src/app/api/dashboard/summary/route.test.ts`（18）、`src/lib/occupancy.test.ts`（12）、`src/app/api/requirements/[id]/route.test.ts`（13） | `d1f3219` |
| AC-010 | 收尾、文件、資料衛生 | ✅ | `src/lib/data-hygiene.test.ts`（8） | `bd2d9de`、本次收尾 commit |

### AC-006 (c) 尚未完成的原因

GOAL 要求以 Stripe CLI 測試模式手動跑一次 `stripe trigger checkout.session.completed`。本次開發機**沒有安裝 Stripe CLI，也沒有 Stripe 測試帳號的登入與測試金鑰**（`stripe login` 需要帳號擁有者在瀏覽器授權），agent 無法也不應自行取得。(a)(b) 已用 Stripe SDK 的 `stripe.webhooks.generateTestHeaderString` 產生測試簽章完整驗證。

Sean 執行步驟（見 `SOP.md` §6）：

```bash
npx prisma db push                 # 只對開發資料庫；新增 StripeEvent 表
npm run dev
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
```

預期結果：`stripe trigger` 產生的範例事件沒有我們的 `metadata.userId`／`plan`，webhook 應回 **200**、`handled: false`，`StripeEvent` 表新增一列；同一事件用 `stripe events resend <evt_id>` 重送應回 `duplicate: true`。要驗證升級流程，請在 `/checkout?plan=pro` 用測試卡 `4242 4242 4242 4242` 結帳，確認 `Subscription` 建立、`User.tier = pro`。

| 項目 | 紀錄 |
|---|---|
| 執行時間 | （待填） |
| 指令 | （待填） |
| HTTP 回應碼 | （待填） |
| 資料庫結果 | （待填） |

紀錄中不得出現任何金鑰或 `whsec_` 值。

## 待 Sean 決定或覆審（本次刻意未處理）

| 項目 | 現況 | 說明 |
|---|---|---|
| Business 方案價格 | 維持 **NT$1,499**（方案頁、首頁、結帳頁） | 舊 SPEC 寫 NT$1,999；未決定前不改。`src/lib/data-hygiene.test.ts` 有防護測試，改價時需同步更新該測試 |
| 公開註冊重開時間 | 維持**關閉**（`/register` → `/login`、`POST /api/auth/register` 回 410） | 未決定前不重開；E2E 與 `data-hygiene.test.ts` 有防護測試 |
| 拆帳規則（AC-002） | 比例四捨五入到整數元（.5 進位、負數對稱），尾差由業者吸收；固定金額不超過淨收入；階梯以淨收入落點決定比例（不是累進） | GOAL Exit gate：需 Sean 覆審 |
| Stripe webhook 行為（AC-006） | 見下方「Stripe webhook 行為摘要」 | GOAL Exit gate：需 Sean 覆審 |
| 資料庫 schema 變更 | 新增 `StripeEvent` model（webhook 冪等用） | 需人審後才 `prisma db push`；尚未套用到任何資料庫 |
| ESLint 規則 `react-hooks/set-state-in-effect` | 關閉 | 既有後台頁面以 effect 抓資料；要通過需重寫資料載入方式，列入 M2 |
| `next` 16.2.12 的 critical 弱點 | 未升級（修正版 16.4.6） | 框架升級屬重大相依變更，M1 未處理；CI 也未加 `npm audit` job，避免一開始就紅燈。建議下一步單獨開 PR 升級 |

### Stripe webhook 行為摘要

| 事件 | 行為 |
|---|---|
| `checkout.session.completed` | 訂閱模式且已付款、`metadata` 有 `userId` 與 `plan`（pro／business）時，**建立或更新** `Subscription`（`ON CONFLICT ("userId")`）並更新 `User.tier`、補上 `stripeCustomerId`；其他情況回 200 不寫入 |
| `customer.subscription.updated` | 同步狀態、期末取消、期末時間；有效狀態依 price id 對應方案（未知 price 維持原方案）；`canceled`／`unpaid`／`incomplete_expired` 降回 free；`past_due` 保留方案 |
| `customer.subscription.deleted` | `Subscription` 與 `User.tier` 降回 free |
| `invoice.payment_failed` | active → past_due |
| `invoice.paid` | past_due／incomplete → active（不會讓已取消的訂閱復活） |
| 冪等 | 以 `event.id` 寫入 `StripeEvent`（`ON CONFLICT DO NOTHING`）；重送回 `duplicate: true` 不再處理；處理失敗回 500 並釋放佔位讓 Stripe 重送 |
| 金鑰防呆 | 非 production（以 `VERCEL_ENV` 為準，沒有時看 `NODE_ENV`）拿到 `sk_live_`／`rk_live_` 時 checkout 與 webhook 回 503；`livemode` 事件在非 production 回 400 |

## M1 驗證紀錄（SOP §4 全套）

2026-11-16，本機 Node v26.13.1（CI 為 Node 20），在乾淨的 `npm ci` 後依序執行；build 使用 SOP §3 的假環境變數。

| 指令 | exit | 輸出摘要 |
|---|---:|---|
| `npm ci --legacy-peer-deps` | 0 | |
| `npx prisma generate` | 0 | Generated Prisma Client (v5.22.0) |
| `npm run typecheck` | 0 | |
| `npm run lint` | 0 | ESLint 0 problems |
| `npm test` | 0 | Test Files 20 passed (20)；Tests 340 passed (340) |
| `CI=1 npm run test:e2e` | 0 | 38 passed（smoke 29、flows 9） |
| `npm run build`（假環境變數） | 0 | ✓ Compiled successfully |
| `git diff --check` | 0 | |
| `git grep -nE "sk_live_[A-Za-z0-9]\|rk_live_[A-Za-z0-9]\|whsec_[A-Za-z0-9]{20,}"` | 1 | 無輸出（沒有金鑰） |
| `grep -c "continue-on-error" .github/workflows/ci.yml` | — | `0` |

PR 上的 CI（openclawsean024-create/hotel-pm-pro#2，run `43757807052`，commit `e0f20dd`，Node 20）：Lint + Typecheck ✅、Vitest ✅、Playwright E2E ✅（38 passed）、Build ✅；Deploy 依設定只在 push 到 main 時執行，此次為 skipped。

AC-009 回歸測試「先失敗後通過」：修正前執行 `npx vitest run src/app/api/dashboard src/app/api/requirements`，19 個測試失敗（checkout_today 房況、入住率、需求單 PATCH 不存在），另 `preload.test.ts` 因 `loadDashboardPreload` 不存在而無法載入；修正後全數通過。

## 合併進度（`hotel-pm` → 本 repo，SPEC §12.1）

`hotel-pm`（`7e8e015`）只讀，未修改、未封存。所有項目都在本 repo 重新實作或改寫成主 repo 欄位。

| # | `hotel-pm` 來源 | 搬到本 repo | 狀態 | commit |
|---|---|---|---|---|
| 1 | `vitest.config.ts`、`playwright.config.ts`、`.github/workflows/ci.yml` 的 test／E2E job | `vitest.config.mts`、`playwright.config.ts`、`.github/workflows/ci.yml`（lint、test、build、e2e、deploy needs 鏈） | ✅ | `4808b1c`、`a7f2bf0` |
| 2 | `src/lib/domain.ts` `calculateBreakdown`、`BreakdownRule` + `domain.test.ts`「F-M6 報表與拆帳」「拆帳 ownerRatio 範圍驗證」 | `src/lib/settlement.ts`（`ownerRatio` 0–1 → `ownerShare` 0–100 整數）+ `settlement.test.ts` | ✅ | `af6f9c0` |
| 3 | `src/lib/domain.ts` `createCsv` + 「CSV 跳脫 (RFC 4180)」測試 | `src/lib/csv.ts` + `csv.test.ts`；`GET /api/reports/monthly?format=csv` | ✅ | `01d59b5` |
| 4 | `src/lib/domain.ts` `getContractAlerts`、`calculateOverdueDays`、`parseDateStrict` + 測試 | `src/lib/contracts.ts`、`src/lib/dates.ts`（改用 `Tenant.endDate`／`status`，以台北日曆日計算）+ `contracts.test.ts`；房客頁、總覽提醒區 | ✅ | `d1f3219`、`ed646b0` |
| 5 | `src/lib/domain.ts` `isBookingOverlapping`、`validateBooking` 日期規則 + 測試 | `src/lib/booking-rules.ts` + 測試；`POST /api/bookings`、ICS 匯入 | ✅ | `09b3b81`、`ebe06d2` |
| 6 | `src/lib/domain.ts` `getOccupancyRate` + 測試 | `src/lib/occupancy.ts`（加 `unitCount`）+ 測試；總覽今晚入住率與物業表現 | ✅ | `d1f3219` |
| 7 | `src/lib/domain.ts` `calculateMonthlyReport` 的「排除已取消訂房」案例 | `src/lib/monthly-report.ts` + `src/app/api/reports/monthly/route.test.ts` | ✅ | `af6f9c0`、`01d59b5` |
| 8 | `next.config.mjs` 的 6 個安全標頭 | `next.config.ts` + `src/proxy.ts` | ✅ | `a7f2bf0` |

SPEC §12.2「不搬」清單照舊，未搬入。

## 與 Notion「可產品化商品」的對應

| Notion 欄位 | 值 | repo 對應 |
|---|---|---|
| 產品名稱 | 民宿與包租代管 PMS | 本 repo（hotel-pm-pro） |
| 優先順序 | P1 | — |
| 開發順位 | 第 2 個 | — |
| 主 repo | openclawsean024-create/hotel-pm-pro（main） | 本 repo |
| 要併入的 repo | openclawsean024-create/hotel-pm | 合併清單見上 |
| 獲利潛力／模式 | 高／SaaS 訂閱 | Stripe 訂閱（測試模式，FR-022／FR-023） |
| 目標客群 | 1–10 房民宿、50–200 房包租代管 | SPEC §2；房間與房東模型 M2（FR-005／FR-006） |
| 上市前要補 | 補測試、Stripe 金流實測、訂房平台串接、合併兩個 repo | 測試 ✅、合併 ✅、ICS 匯入轉訂房 ✅（官方 API 不在 M1）、Stripe 實測 🟡 待 (c) |
| 主要風險 | 國際 PMS 競爭；金流與帳務錯誤 | SPEC §9 |

## FR 實作對照

狀態：✅ 已實作｜🟡 部分｜❌ 未實作。完整描述見 `PRD/SPEC.md` §6。

| FR | 名稱 | 優先 | 狀態 | 備註 |
|---|---|---|---|---|
| FR-001 | 登入 | P0 | ✅ | |
| FR-002 | 公開註冊 | P0 | 🟡 暫停（410） | 待 Sean 決定 |
| FR-003 | 路由與 API 保護 | P0 | 🟡 | M1 加上 `src/proxy.ts` 保護 `/dashboard/**`；API 仍各自檢查 |
| FR-004 | 物業管理 | P0 | 🟡 缺編輯 | M2 |
| FR-005 | 房間／單位模型 | P1 | ❌ | M2；總覽暫以每物業 1 單位計算 |
| FR-006 | 房東資料與房東別月報 | P1 | ❌ | M2 |
| FR-007 | 房客 CRM | P0 | 🟡 缺編輯 | M2 |
| FR-008 | 合約到期／逾期提醒 | P1 | ✅ | AC-004 |
| FR-009 | 訂房管理 | P0 | 🟡 缺編輯 | M2 |
| FR-010 | 訂房重疊檢查 | P0 | ✅ | AC-005 |
| FR-011 | ICS 匯入 | P0 | ✅ | AC-007；手動匯入 |
| FR-012 | ICS 定期同步 | P1 | ❌ | M2 |
| FR-013 | 訂房平台官方串接 | P2 | ❌ | M3 評估 |
| FR-014 | 需求單 | P1 | ✅ | AC-009 加上 PATCH 與編輯表單 |
| FR-015 | 維修派工 | P1 | ✅ | 尚無專屬測試 |
| FR-016 | 月報與房東分潤 | P0 | ✅ | AC-002、AC-003 |
| FR-017 | 多種拆帳規則 | P1 | 🟡 | 引擎支援三種規則；月報目前只用比例（物業沒有規則設定欄位，M2） |
| FR-018 | 月報 CSV 匯出 | P0 | ✅ | AC-003 |
| FR-019 | 月報 PDF 匯出 | P1 | ❌ | M2；README 已移除 PDF 說法 |
| FR-020 | 營運總覽 | P1 | ✅ | AC-009 |
| FR-021 | 房東分帳預估卡 | P2 | 🟡 | M2 |
| FR-022 | Stripe 結帳（測試模式） | P0 | 🟡 | 測試通過；待 (c) 實測 |
| FR-023 | Stripe webhook | P0 | 🟡 | 缺陷 3、4 已修；待 (c) 實測 |
| FR-024 | 方案用量限制 | P1 | ❌ | M2（方案頁仍宣稱，未改） |
| FR-025 | 團隊帳號 | P2 | ❌ | M3 |
| FR-026 | 對外通知 | P2 | ❌ | M3 |
| FR-027 | 聯絡表單 | P2 | ✅ | |
| FR-028 | 行銷與法務頁 | P1 | ✅ | 方案頁文案 M2 修正 |
| FR-029 | 假資料 seed | P1 | ✅ | AC-010 改為明顯假資料 |
| FR-030 | 個資匯出／刪除 | P1 | ❌ | M2 |

## 已知問題與後續（不在 M1 範圍）

- 方案頁仍宣稱 PDF、團隊帳號、API、白標、審計日誌、用量限制等未實作功能（硬性規則：M1 不做也不改方案頁）。
- `src/app/layout.tsx` 的 meta description 仍寫「純前端」「比 Cloudbeds 便宜 80%」，與程式不符，建議 M2 一併修正。
- SSRF 防護在 DNS 檢查與實際連線之間仍有極短時間差（DNS rebinding），M2 可改為綁定已檢查的 IP。
- 時間欄位是 `timestamp`（不含時區）；`pg-client` 已固定以 UTC 解析。改用 `timestamptz` 需 migration，列入 M2。

## 下一步

1. Sean 覆審 AC-002 拆帳規則與 AC-006 webhook 行為（GOAL Exit gate）。
2. Sean 以 Stripe CLI 完成 AC-006 (c)，把結果填入上表。
3. 確認 PR 上 CI 全綠後再決定是否合併；合併後才能進入 M2。
