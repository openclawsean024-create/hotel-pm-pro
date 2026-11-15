# Goal — 民宿與包租代管 PMS M1

## Objective

把 `hotel-pm` 中仍有價值的業務邏輯與測試基礎併入主 repo `hotel-pm-pro`，讓主 repo 成為唯一程式庫；並把主 repo 從 0 個測試提升到「拆帳、月報、訂房重疊、ICS 匯入、Stripe 測試模式」都有可重跑的自動化測試，作為上市前的帳務與金流可信基線。全程只用假資料與 Stripe 測試模式，不接真實訂房平台 API、不收真實款項。

規格依據：[`PRD/SPEC.md`](./PRD/SPEC.md) v4.0（FR 編號、合併清單 §12）。

## Acceptance criteria

測試指令一律在 repo 根目錄執行。「route handler 測試」指以 Vitest 直接呼叫 `src/app/api/**/route.ts` 匯出的函式，並以 `vi.mock` 取代 `@/lib/pg-client`、`@/lib/auth` 與 `fetch`，不連真實資料庫或外部服務。

- **AC-001：測試基線建立**
  主 repo 加入 Vitest；`npm test` 改為執行真實測試（不得再是 `echo`）；CI 的 test job 移除 `continue-on-error`，測試失敗會讓 build／deploy job 不執行。
  驗證：`npm test` exit 0 且輸出的測試數 > 0；`grep -c "continue-on-error" .github/workflows/ci.yml` 輸出 `0`；在 PR 上 CI test job 為必經步驟（`needs` 鏈包含 test）。

- **AC-002：拆帳引擎併入（合併清單 #2，FR-016／FR-017）**
  新增 `src/lib/settlement.ts`，提供比例／固定／階梯三種規則，輸入使用主 repo 的 `ownerShare`（0–100 整數）並明確轉換；比例超出範圍、收入或支出為負時拋錯；所有結果 `ownerShare + operatorShare === netIncome`，金額為整數元。測試至少包含 `hotel-pm` `domain.test.ts` 中「F-M6 報表與拆帳」「拆帳 ownerRatio 範圍驗證」的全部案例（改寫成主 repo 欄位後斷言不得放寬），另加四捨五入邊界（例如 .5 元）案例。
  驗證：`npx vitest run src/lib/settlement.test.ts` exit 0。

- **AC-003：月報帳務正確性與 CSV 匯出（合併清單 #3、#7，FR-016／FR-018）**
  `GET /api/reports/monthly` 改用 `settlement.ts`；收入規則（月租 + 當月 `completed` 訂房、排除 `cancelled`）與月份邊界（Asia/Taipei）寫入測試；新增 CSV 匯出（例如 `?format=csv`，回 `text/csv`），使用併入的 `createCsv`（RFC 4180 跳脫）。月報頁面提供下載按鈕。
  驗證：`npx vitest run src/lib/csv.test.ts src/app/api/reports` exit 0；測試涵蓋：跨月訂房、已取消訂房、無物業、多物業加總等於 summary、CSV 欄位含逗號／雙引號／換行。

- **AC-004：房客合約到期／逾期提醒（合併清單 #4，FR-008）**
  併入 `getContractAlerts`、`calculateOverdueDays`、`parseDateStrict`；房客頁與總覽提醒區顯示 30 天內到期與已逾期的房客（站內顯示，不發送任何外部通知）。
  驗證：`npx vitest run src/lib/contracts.test.ts` exit 0（含 `hotel-pm` 原有案例與「無 endDate 不提醒」「今天到期」邊界）。

- **AC-005：訂房重疊檢查（合併清單 #5，FR-010）**
  併入 `isBookingOverlapping` 與日期規則；`POST /api/bookings` 對同一物業、非 `cancelled` 的重疊訂房回 409，退房日不晚於入住日回 400；相鄰（退房日 = 下一筆入住日）不算重疊。
  驗證：`npx vitest run src/lib/booking-rules.test.ts src/app/api/bookings` exit 0。

- **AC-006：Stripe 測試模式金流驗證（Notion「Stripe 金流實測」，FR-022／FR-023）**
  (a) webhook route handler 測試：以 `stripe.webhooks.generateTestHeaderString` 產生測試簽章，涵蓋簽章錯誤回 400、`checkout.session.completed` 會建立或更新 `Subscription`（修正目前只 UPDATE 的缺陷）並更新 `User.tier`、`customer.subscription.updated` 同步方案、`customer.subscription.deleted` 降回 free、同一事件重送不重複處理（冪等）。
  (b) 非 production 環境若 `STRIPE_SECRET_KEY` 以 `sk_live_` 開頭，checkout 與 webhook 拒絕執行，並有測試。
  (c) 以 Stripe CLI 測試模式手動跑一次：`stripe listen --forward-to localhost:3000/api/stripe/webhook` + `stripe trigger checkout.session.completed`，把指令、時間與結果（不含任何金鑰）記錄在 `STATUS.md`。
  驗證：`npx vitest run src/app/api/stripe` exit 0；`STATUS.md` 有 (c) 的紀錄；`git grep -nE "sk_live_[A-Za-z0-9]|whsec_[A-Za-z0-9]{20,}"` 無輸出。

- **AC-007：ICS 匯入轉訂房與 SSRF 防護（Notion「訂房平台串接」的 M1 範圍，FR-011）**
  ICS 匯入除寫入 `IcsEvent` 去重外，也建立對應 `Booking`（channel = 來源、以 UID 去重、重疊時標記或略過並回報數量）；拒絕非 http(s)、localhost、私有與保留 IP 位址的 URL；`src/lib/ics-parser.ts` 補單元測試，使用 `tests/fixtures/` 下的**假** Airbnb／Booking.com 格式 .ics 檔（內容自行編寫，不取自真實帳號）。
  驗證：`npx vitest run src/lib/ics-parser.test.ts src/app/api/ics` exit 0；測試涵蓋折行、全天日期、時區、缺 UID、重複匯入、`http://127.0.0.1`／`http://169.254.169.254` 被拒、fetch 逾時。

- **AC-008：安全標頭併入與 E2E 冒煙測試（合併清單 #1、#8）**
  `next.config.ts` 加入 `hotel-pm` 的 6 個安全標頭（CSP 需確認不擋 Stripe Checkout 轉址）；加入 Playwright 與 `test:e2e` script，覆蓋：首頁、方案頁、登入頁可載入；未登入造訪 `/dashboard` 轉到 `/login`；回應含安全標頭。E2E 不需真實資料庫。
  驗證：`npm run test:e2e` exit 0；CI 有 E2E job。

- **AC-009：已知缺陷修正（SPEC §5.3 缺陷 1、2，FR-020）**
  總覽頁不再查詢不存在的 `Room` 表（伺服器端預載能取得物業）；房況 `checkout_today` 可被正確判斷；入住率改用併入的 `getOccupancyRate`（合併清單 #6）。每個缺陷都有先失敗後通過的回歸測試。
  驗證：`npx vitest run src/app/api/dashboard src/lib/occupancy.test.ts` exit 0。

- **AC-010：合併收尾與文件、資料衛生**
  合併清單 §12.1 每一項在 `STATUS.md` 標示完成的 commit 或書面延後理由；README 移除與程式不符的說法（PDF 匯出、註冊、middleware）；repo 內新增的測試資料皆為明顯假資料；所有既有 checks 通過。
  驗證：`npm run typecheck`、`npm run lint`、`npm test`、`npm run test:e2e`、`npm run build`（使用 `.env.example` 形式的假環境變數）全部 exit 0，指令與 exit code 記錄在 `STATUS.md`；`git diff --check` exit 0。

## Out of scope

- Stripe 正式模式、任何真實扣款、退款或真實客戶的 Stripe 資料（只用測試模式與測試金鑰）。
- 訂房平台官方 API、channel manager、抓取真實客戶的 ICS 連結（M1 只用 fixture 與 mock fetch）。
- 真實個資：真實房客、房東、旅客、業者資料不得進入程式、測試、fixture、截圖或文件。
- 編輯功能（PATCH）、房間／房東資料模型、方案用量限制、月報 PDF、ICS 定期同步（M2）。
- 公開註冊重新開放、Email 寄送、LINE 或任何對外通知。
- 正式資料庫 migration、production 部署、Vercel／Supabase／Stripe 後台設定變更。
- 封存、刪除或改名 `hotel-pm` repo（由 Sean 決定）。

## Exit gate

M1 完成前需：AC-001～AC-010 的驗證指令全部 exit 0 並記錄於 `STATUS.md`；Sean 覆審拆帳規則（AC-002）與 Stripe webhook 行為（AC-006）；CI 在 PR 上全綠。未通過不得進入 M2，也不得切換 Stripe 正式模式。
