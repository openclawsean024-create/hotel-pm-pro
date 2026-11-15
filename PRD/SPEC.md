# 民宿與包租代管 PMS — 產品規格書（PRD）

> 版本：v4.0（文件重建版，2026-11-16）
> 前一版：v3.0.2（2026-09-06，Fleet 自動生成；部分「✅ shipped」敘述與程式不符，本版以程式實況重寫）
> 主 repo：`openclawsean024-create/hotel-pm-pro`（預設分支 `main`）
> 要併入的 repo：`openclawsean024-create/hotel-pm`（只讀；合併清單見 §12）
> 商業依據：Notion 資料庫「可產品化商品」中的「民宿與包租代管 PMS」列（唯一商業依據）

---

## 0. 文件資訊

| 欄位 | 值 |
|---|---|
| 產品名稱 | 民宿與包租代管 PMS（repo 代號 hotel-pm-pro） |
| 優先順序 | P1；開發順位第 2 個 |
| 獲利潛力 | 高 |
| 獲利模式 | SaaS 訂閱 |
| Notion 現況完成度 | 60 |
| 上市前要補（Notion） | 補測試（目前 0 個）、Stripe 金流實測、訂房平台串接、合併兩個 repo |
| 主要風險（Notion） | Cloudbeds 等國際 PMS 競爭；金流與帳務錯誤風險 |
| 文件狀態 | 文件重建完成，尚未依本版開發 |
| 維護者 | Sean |

### 0.1 本次盤點方法

- 兩個 repo 都實際 clone 並閱讀 `src/`、`prisma/`、`e2e/`、測試、`package.json` scripts、CI。
- 2026-11-16 在本機（Node v26.13.1）實跑檢查：
  - `hotel-pm-pro`：`npm ci --legacy-peer-deps`、`npx prisma generate`、`npm run typecheck`、`npm test`、`npm run build`（用假環境變數）全部 exit 0；但 `npm test` 只是 `echo`，**實際測試數為 0**。
  - `hotel-pm`：`npm ci`、`npm test`（Vitest 71 個測試通過：domain 57、storage 8、use-local-storage 6）、`npm run typecheck`、`npm run lint` 全部 exit 0。Playwright E2E（3 個 spec 檔、15 個 test）本次未執行。
- README、舊 SPEC 與程式不一致的地方，以程式為準，並在 §5、§13 註明。

---

## 1. 問題

台灣小型民宿與包租代管業者日常營運常見的問題（依舊版 SPEC 與競品文件整理；量化數字一律待確認）：

1. **工具成本與複雜度不合**：國際 PMS 功能齊全，但對 1–10 房民宿而言價格與學習成本偏高（實際價格待確認，見 §4）。
2. **Excel／LINE 群組管理**：多人協作困難、容易漏記，訂房、報修、派工散在不同地方。
3. **跨平台訂房重複輸入**：Airbnb、Booking.com 等平台的訂房要手動整理，容易重複訂房。
4. **房東分潤與月報靠手工**：包租代管業者要每月替每位房東計算分潤、製作報表，算錯直接造成帳務糾紛。

> 舊版 SPEC 中「小型民宿占 87%」「95% 仍用 Excel」等統計沒有附出處，本版一律標為**待確認**，不作為決策依據。

## 2. 目標客群

依 Notion 定義（舊版 SPEC 的「5–15 房」「30–100 房東」不再使用）：

| Persona | 規模 | 主要工作 | 本產品要解決的事 |
|---|---|---|---|
| 小型民宿經營者 | 1–10 房 | 接訂房、入住退房、清潔、報修 | 一個畫面看今天要做什麼；訂房不重複；月底能出報表 |
| 包租代管業者 | 管理 50–200 房 | 多物業、多房東、維修派工、每月房東對帳 | 多物業總覽、房東分潤正確計算、維修追蹤、可匯出報表 |

> 注意：目前資料模型以「物業（Property）」為單位，沒有「房間／單位（Room/Unit）」也沒有「房東（Owner）」實體。要服務 50–200 房的包租代管業者，需在 M2 補齊（FR-005、FR-006）。

## 3. 獲利模式

- SaaS 月訂閱，透過 Stripe Checkout 收款。
- 程式中 `src/app/pricing/page.tsx` 目前的方案：

| 方案 | 價格（頁面標示） | 頁面宣稱內容 | 程式是否實際限制 |
|---|---|---|---|
| Free | NT$0 | 1 物業、5 房以內 | 否（無用量限制程式） |
| Pro | NT$499／月 | 5 物業、20 房、ICS、拆帳、CSV 匯出 | 否；CSV 匯出尚未實作 |
| Business | NT$1,499／月 | 無限物業、5 個團隊帳號、API、白標、審計日誌 | 否；團隊帳號／API／白標／審計日誌皆未實作 |

- 不一致：舊版 SPEC §1.2 寫 Business NT$1,999，程式與 `.env.example` 為 NT$1,499。**定價待 Sean 確認**。
- 方案頁宣稱但未實作的功能，上市前必須實作或從頁面移除（列入 M2）。

## 4. 競品與差異

競品清單取自 `docs/competitor-benchmark-2026-09.md`（附官方網址）。價格、市占等外部數字沒有在本次查證，一律**待確認**。

| 競品 | 定位（依公開頁面） | 價格 | 我們的差異 |
|---|---|---|---|
| Cloudbeds | 國際 hospitality 平台：PMS、付款、分銷、報表、多物業 | 待確認（舊 SPEC 有 US$50–200 與 US$250+ 兩種說法，互相矛盾） | 繁中、台灣小型民宿導入快；不做 channel manager |
| Hostaway | 短租營運：channel manager、訊息、付款、任務、房東報告 | 待確認 | 聚焦台灣包租代管的房東分潤與月報 |
| Lodgify | 直訂網站、channel manager、OTA 整合 | 待確認 | ICS 匯入降低重複輸入，不宣稱 channel manager |
| 林管家 | 台灣包租代管：合約、收租、帳單、催繳 | 待確認 | 結合短租訂房／房務與房東分潤 |
| Ragic 包租代管 | 可客製表單：房源、報修、合約、權限 | 待確認 | 開箱即用的民宿流程，不需自行設計表單 |
| Excel + LINE | 通用工具 | 免費 | 自動計算、提醒、不重複訂房 |

**差異化主張（需以功能兌現，不得超前宣稱）**：

1. 房東分潤自動計算且可驗證（多種拆帳規則、帳務測試覆蓋）。
2. ICS 匯入轉成訂房、自動去重與重疊檢查。
3. 繁中、台灣時區（Asia/Taipei）、NT$ 計價的營運總覽。

## 5. 現況盤點（以程式為準）

### 5.1 主 repo `hotel-pm-pro` 實際技術棧

- Next.js 16.2.12（App Router）、React 19.2.4、TypeScript、Tailwind CSS v3。
- Auth.js（next-auth 5.0.0-beta.32）Credentials + bcryptjs，JWT session。
- 資料庫：Postgres（Supabase pooler）。`prisma/schema.prisma` 定義資料表，但**執行期所有查詢都用 `pg` 直接下 SQL**（`src/lib/pg-client.ts`），沒有 Prisma migration 檔，靠 `prisma db push`。
- Stripe SDK 22.4（`apiVersion: "2026-07-29.dahlia"`）。
- Zod 4 驗證輸入。
- CI：`.github/workflows/ci.yml`（lint／test／build／deploy to Vercel）。`lint` 實際是 `tsc --noEmit`；`test` job 設 `continue-on-error: true`，且 `npm test` 只印一行字。

### 5.2 主 repo 實際已實作

| 模組 | 頁面 | API | 實況 |
|---|---|---|---|
| 登入 | `/login` | `/api/auth/[...nextauth]` | 可登入；`/register` 轉址到 `/login`，`POST /api/auth/register` 回 410（註冊暫停） |
| 物業 | `/dashboard/properties` | `GET/POST /api/properties`、`DELETE /api/properties/[id]` | 無編輯（頁面寫「編輯功能 v2 補」） |
| 房客 | `/dashboard/tenants` | `GET/POST /api/tenants`、`DELETE /api/tenants/[id]` | 無編輯；無月繳提醒、無寄信（舊 SPEC 宣稱有） |
| 訂房 | `/dashboard/bookings` | `GET/POST /api/bookings`、`DELETE /api/bookings/[id]` | 手動建立；無重疊檢查、無狀態更新 |
| ICS | `/dashboard/ics` | `POST /api/ics/import` | 伺服器端抓 URL（10 秒逾時）、`src/lib/ics-parser.ts` 解析、依 (userId, uid) 去重寫入 `IcsEvent`；**不會轉成 Booking**，所以不出現在訂房與月報；未阻擋內網位址 |
| 需求單 | `/dashboard/requirements` | `GET/POST /api/requirements`、`DELETE …/[id]` | 無狀態更新 API |
| 派工單 | `/dashboard/maintenance` | `GET/POST /api/maintenance`、`PATCH/DELETE …/[id]` | 完整 CRUD |
| 月報 | `/dashboard/reports` | `GET /api/reports/monthly?month=YYYY-MM` | 回 JSON：每物業「月租 + 當月 completed 訂房」× 房東比例%；**沒有 PDF 或 CSV 匯出**（README、舊 SPEC、方案頁都宣稱有） |
| 營運總覽 | `/dashboard` | `GET /api/dashboard/summary` | KPI、房況、今日時間軸、待辦、6 個月營收、物業表現；房東分帳卡為前端估算 |
| 訂閱 | `/pricing`、`/checkout` | `POST /api/stripe/checkout`、`POST /api/stripe/webhook` | 見 §5.4 |
| 聯絡 | `/contact` | `POST /api/contact` | 寫入 `ContactMessage` |
| 行銷／法務 | `/`、`/faq`、`/terms`、`/privacy`、`sitemap.xml`、`robots.txt` | — | 已實作 |
| 示範資料 | — | `prisma/seed.ts` | 假資料（demo@hotel-pm.test 等），可重跑 |

### 5.3 主 repo 已知缺陷（本次閱讀程式發現）

1. `src/app/dashboard/page.tsx` 查詢不存在的 `"Room"` 資料表；錯誤被 `catch` 吞掉，伺服器端預載的物業清單永遠是空的。
2. `src/app/api/dashboard/summary/route.ts` 的房況判斷：先篩 `checkOut > today`，再判斷 `checkOut === today`，因此 `checkout_today` 狀態永遠不會出現。
3. Stripe webhook 收到 `checkout.session.completed` 時只對 `Subscription` 做 `UPDATE`；新使用者沒有該列時不會建立訂閱紀錄（只有 seed 帳號有）。
4. Stripe webhook 沒有事件冪等處理；`invoice.paid`／`invoice.payment_failed` 未處理（舊 SPEC 要求設定 `invoice.paid`）；`customer.subscription.updated` 不會同步方案升降級到 `User.tier`。
5. 沒有任何方案用量限制，`User.tier` 只被寫入、不被讀取來限制功能。
6. `POST /api/ics/import` 會向使用者給的任意 http(s) URL 發請求，未阻擋 localhost／內網位址（SSRF 風險）。
7. 沒有安全標頭（CSP、X-Frame-Options 等）；沒有集中式路由保護（無 middleware／proxy），由各頁面與各 API 自行檢查。

### 5.4 要併入的 repo `hotel-pm` 實際已實作

- 技術棧：Next.js 16.2.x、React 19.1.1、Tailwind v4、Vitest、Playwright。宣告了 `@supabase/supabase-js` 但**完全沒有使用**。
- 頁面（`/`、`/dashboard`、`/properties`、`/properties/[id]`、`/tenants`、`/bookings`、`/reports`）全部是**寫死的 mock 陣列**，沒有新增／編輯／刪除；localStorage 只用於「收藏物業」按鈕。README 說「純前端 SPA + localStorage 四大模組」與程式不符。
- `src/lib/domain.ts` 純函式（有單元測試）：
  - `validateProperty`、`getPropertyById`、`parseDateStrict`
  - `getContractAlerts`（合約 30 天內到期／已逾期）、`calculateOverdueDays`
  - `validateBooking`、`isBookingOverlapping`（相鄰不算重疊）、`getOccupancyRate`
  - `parseIcsEvents`（簡化版 ICS 解析）
  - `calculateBreakdown`（比例／固定／階梯三種拆帳規則，含比例 0–1 範圍驗證、`owner + operator = net`）
  - `calculateMonthlyReport`（排除已取消訂房）
  - `createCsv`（RFC 4180 跳脫）
  - `createMaintenanceRequest`／`assign…`／`complete…`（工單狀態）
  - `generateReportPdf`（名稱是 PDF，**實際輸出 CSV**）
  - `formatLineNotify`／`sendLineNotify`（**mock，不會真的發送**；README 寫「LINE Notify 推播」與程式不符）
  - `validatePosOrder`、`isLawReviewRequired`、`getGracefulFallback`、`generateSitemap`、`openGraphMeta`
- `src/lib/storage.ts`、`use-local-storage.ts`、`components/favorite-button.tsx`。
- `next.config.mjs`：6 個安全標頭（CSP、X-Content-Type-Options、X-Frame-Options、Referrer-Policy、Permissions-Policy、HSTS）。
- 測試：Vitest 71 個（本次實跑通過）；Playwright 15 個（針對 mock 頁面，本次未執行）。
- CI：typecheck、test、lint、build、`npm audit --audit-level=critical`、Playwright E2E。

---

## 6. 功能需求（FR）

狀態定義：**已實作**＝程式可用且符合描述；**部分**＝有程式但缺關鍵行為或只有函式／mock；**未實作**＝沒有程式。
「所在 repo」：`pro` = hotel-pm-pro（主 repo）；`pm` = hotel-pm（要併入）。「里程碑」為預計完成的里程碑。

| FR | 名稱 | 優先 | 狀態 | 所在 repo | 里程碑 | 備註 |
|---|---|---|---|---|---|---|
| FR-001 | Email／密碼登入（JWT session） | P0 | 已實作 | pro | — | Credentials + bcryptjs |
| FR-002 | 公開註冊 | P0 | 部分 | pro | M2 | API 回 410 暫停註冊；何時開放待 Sean 決定 |
| FR-003 | 後台路由與 API 存取保護 | P0 | 部分 | pro | M2 | 各頁／各 API 自行檢查；無集中式保護 |
| FR-004 | 物業管理（新增／列表／編輯／刪除） | P0 | 部分 | pro（pm 僅 mock） | M2 | 缺編輯（PATCH） |
| FR-005 | 房間／單位模型（一物業多房） | P1 | 未實作 | — | M2 | 50–200 房客群必要；總覽頁已誤查 `Room` 表 |
| FR-006 | 房東資料與房東別月報 | P1 | 未實作 | pm 僅有 `ownerName` mock 欄位 | M2 | 目前只有物業上的 `ownerShare%` |
| FR-007 | 房客 CRM（新增／列表／編輯／刪除） | P0 | 部分 | pro | M2 | 缺編輯 |
| FR-008 | 房客合約到期／逾期提醒（站內） | P1 | 部分 | pm（函式＋測試） | M1 | 搬入 pro，顯示於房客頁與總覽 |
| FR-009 | 訂房手動建立／列表／取消 | P0 | 部分 | pro | M2 | 缺編輯與狀態更新 |
| FR-010 | 訂房重疊檢查 | P0 | 部分 | pm（函式＋測試） | M1 | pro 未實作；搬入並在建立訂房時阻擋 |
| FR-011 | ICS 匯入（抓取、解析、去重） | P0 | 部分 | pro | M1 | 需轉成 Booking、加 SSRF 防護與測試 |
| FR-012 | ICS 定期自動同步 | P1 | 未實作 | — | M2 | 排程機制待選定 |
| FR-013 | 訂房平台官方 API／channel manager 串接 | P2 | 未實作 | — | M3（待評估） | 需平台合作資格，待確認 |
| FR-014 | 需求單（建立／列表／狀態更新／刪除） | P1 | 部分 | pro | M2 | 缺狀態更新 API |
| FR-015 | 維修派工（CRUD） | P1 | 已實作 | pro | — | 無測試 |
| FR-016 | 月報與房東分潤計算 | P0 | 部分 | pro | M1 | 僅比例%；無測試；計算規則需寫入測試 |
| FR-017 | 多種拆帳規則（比例／固定／階梯） | P1 | 部分 | pm（函式＋測試） | M1 | 搬入 pro 作為拆帳引擎 |
| FR-018 | 月報 CSV 匯出 | P0 | 部分 | pm（`createCsv`） | M1 | pro 未實作；方案頁已宣稱 |
| FR-019 | 月報 PDF 匯出 | P1 | 未實作 | — | M2 | README、舊 SPEC、方案頁宣稱已有，與程式不符 |
| FR-020 | 營運總覽儀表板 | P1 | 部分 | pro | M1（修缺陷） | §5.3 缺陷 1、2 |
| FR-021 | 房東分帳預估卡片 | P2 | 部分 | pro | M2 | 前端估算，非正式帳本 |
| FR-022 | Stripe 訂閱結帳（測試模式） | P0 | 部分 | pro | M1 | 已寫未實測 |
| FR-023 | Stripe webhook 同步訂閱狀態 | P0 | 部分 | pro | M1 | §5.3 缺陷 3、4 |
| FR-024 | 方案用量限制（物業數、房數） | P1 | 未實作 | — | M2 | 方案頁已宣稱 |
| FR-025 | 團隊帳號與角色權限 | P2 | 未實作 | — | M3 | Business 方案頁已宣稱 |
| FR-026 | 對外通知（Email／LINE） | P2 | 部分 | pm（mock） | M3 | pm 的 LINE Notify 僅 mock；LINE Notify 服務已終止（待確認官方公告），需改評估 LINE Messaging API |
| FR-027 | 聯絡表單 | P2 | 已實作 | pro | — | |
| FR-028 | 行銷與法務頁（首頁、方案、FAQ、條款、隱私、sitemap、robots） | P1 | 已實作 | pro | — | 方案頁文案需與實作一致（M2） |
| FR-029 | 示範用假資料 seed | P1 | 已實作 | pro | — | `npm run seed`，需 DATABASE_URL |
| FR-030 | 資料匯出／刪除（個資當事人請求） | P1 | 未實作 | — | M2 | 見 §8 |

## 7. 非功能需求

| 類別 | 需求 | 現況 |
|---|---|---|
| 測試 | P0 業務邏輯（拆帳、月報、訂房重疊、ICS、Stripe webhook）必須有自動化測試；CI 測試失敗必須擋下合併 | pro 0 個測試；CI test job `continue-on-error` |
| 帳務正確性 | 金額以新台幣整數（元）計算；`房東分潤 + 業者分潤 = 總收入` 恆成立；四捨五入規則固定並有測試；月份邊界以 Asia/Taipei 為準 | 未測試；月份邊界目前用伺服器時區字串比較 |
| 金流安全 | Stripe 簽章驗證；事件冪等；非 production 環境拒絕 `sk_live_` 金鑰 | 簽章驗證有；其餘無 |
| 資安 | 輸入以 Zod 驗證；SQL 一律參數化；安全標頭；伺服器端抓外部 URL 需阻擋內網位址 | Zod 與參數化有；安全標頭、SSRF 防護無 |
| 多租戶隔離 | 每筆查詢都以 `userId` 限定；跨帳號存取回 404 | 目前 API 皆有 `userId` 條件，但無測試 |
| 效能 | 目標：API P95 ≤ 300ms（待量測，目前無數據） | 未量測 |
| 可用性 | 繁體中文介面；手機寬度可操作 | 已有 RWD 與行動底部導覽 |
| 無障礙 | 表單 label、焦點樣式、鍵盤可操作 | 部分（landing 已修，後台未驗證） |
| 可維運 | 錯誤不得把個資或金鑰寫入 log | `console.error` 目前會印出錯誤物件，需檢查 |

## 8. 資料與個資處理

### 8.1 會儲存的個人資料

| 資料表 | 欄位 | 來源 |
|---|---|---|
| `User` | email、name、passwordHash（bcrypt） | 業者帳號 |
| `Tenant` | name、phone、email、租約日期、租金、押金 | 業者輸入的房客資料 |
| `Booking` | guestName、入退房日期、金額 | 業者輸入或 ICS |
| `IcsEvent` | summary、raw（可能含旅客資訊，待確認各平台內容） | ICS 匯入 |
| `ContactMessage` | name、email、message | 網站訪客 |
| `Subscription`／`User.stripeCustomerId` | Stripe 客戶 ID、訂閱 ID | Stripe；卡號不經過本系統 |

### 8.2 處理原則

- 開發、測試、示範一律使用明顯的假資料（例如 `demo@hotel-pm.test`、`測試房客A`、`0900-000-000`）；不得把真實房客、房東或業者資料放進 repo、測試、截圖或 issue。
- 不在 log、錯誤訊息、分析工具中輸出個資或憑證。
- 業者是房客個資的蒐集者，本系統是受託處理者：服務條款與隱私權政策需說明角色分工（文字待法律確認）。
- 需提供業者匯出與刪除其房客資料的方法（FR-030，M2）。
- 刪除帳號時以資料庫 `onDelete: Cascade` 清除關聯資料；備份保留期限待確認。
- 卡號與付款資訊只在 Stripe 處理，本系統不儲存。

## 9. 法規與風險

| 項目 | 說明 | 狀態 |
|---|---|---|
| 個人資料保護法 | 房客姓名、電話、Email 屬個資；需告知、目的限制、安全維護與當事人權利 | 待法律確認條款文字 |
| 租賃住宅市場發展及管理條例 | 包租代管業者本身的法定義務（是否影響產品需提供的欄位或報表） | 待確認 |
| 民宿相關法規 | 民宿登記資訊、旅客登記要求是否需要系統支援 | 待確認 |
| 統一發票／電子發票 | 向台灣客戶收取訂閱費的發票開立方式（Stripe 不會自動開立台灣發票） | 待確認，M3 前需決定 |
| 消費者保護（線上訂閱退費） | 訂閱取消與退費規則 | 待確認 |

| 風險 | 影響 | 對策 |
|---|---|---|
| 國際 PMS 競爭（Cloudbeds 等） | 客戶比較功能數量 | 聚焦台灣小型民宿與包租代管的分潤與月報；不宣稱沒有的功能 |
| 帳務計算錯誤 | 房東糾紛、信任流失 | M1 拆帳引擎與月報全面測試；計算規則寫入文件 |
| 金流錯誤（重複扣款、狀態不同步） | 營收損失、客訴 | M1 webhook 冪等與測試；M3 切 live 前 Sean 人審 |
| ICS／訂房平台變更格式或限制 | 匯入失敗、重複訂房 | 解析器以 fixture 測試；重疊檢查；失敗時提示手動新增 |
| 方案頁宣稱與實作不符 | 消費爭議 | M2 前修正方案頁或補實作 |
| 依賴 beta 版套件（next-auth 5 beta） | 升級破壞 | 鎖版本；升級需跑完整測試 |
| 兩個 repo 並存造成維護分歧 | 重工 | M1 完成合併，`hotel-pm` 的處置由 Sean 決定 |

## 10. 里程碑

### M1 — 合併與可驗證基線（詳見 `GOAL.md`）

- 把 `hotel-pm` 中有價值的業務邏輯與測試基礎搬進主 repo（§12）。
- 主 repo 從 0 個測試到涵蓋所有 P0 帳務、訂房、ICS、Stripe 邏輯的自動化測試；CI 測試失敗會擋下。
- Stripe 只在測試模式完成結帳與 webhook 驗證。
- ICS 匯入轉成訂房（以 fixture 測試），加上 SSRF 防護。
- 修正 §5.3 的已知缺陷 1–4、6、7（安全標頭）。

### M2 — 付費試營運準備

- 註冊重新開放（含 Email 驗證，待 Sean 決定）、方案用量限制（FR-024）。
- 物業／房客／訂房／需求單的編輯與狀態更新。
- 房間／單位模型（FR-005）與房東實體、房東別月報（FR-006）。
- 月報 PDF（FR-019）、ICS 定期同步（FR-012）、個資匯出與刪除（FR-030）。
- Prisma migration 取代 `db push`；錯誤監控。
- 方案頁文案與實作一致。

### M3 — 正式上市

- Stripe 切換正式模式（需 Sean 人審與帳務對帳流程）。
- 發票開立方案、條款與隱私權政策法律確認。
- 團隊帳號（FR-025）、通知（FR-026）。
- 訂房平台官方串接可行性評估（FR-013）。

## 11. 成功指標

| 里程碑 | 指標 | 目標 |
|---|---|---|
| M1 | 自動化測試 | P0 帳務／訂房／ICS／Stripe 測試全數通過；CI 測試 job 失敗即擋 |
| M1 | 帳務不變式 | 所有拆帳測試案例 `房東 + 業者 = 總收入`，0 例外 |
| M1 | Stripe 測試模式 | 結帳完成、取消訂閱兩種事件在測試模式下正確更新方案（測試證據記錄於 `STATUS.md`） |
| M1 | 合併 | 合併清單「要搬」項目 100% 完成或有書面延後理由 |
| M2 | 試營運客戶數、7 日留存 | 待 Sean 設定 |
| M3 | 付費客戶數、月經常性收入、流失率 | 待 Sean 設定 |
| 全期 | 帳務相關客訴 | 目標值待 Sean 設定 |

## 12. 合併清單（`hotel-pm` → `hotel-pm-pro`）

`hotel-pm` 只讀；搬移時在主 repo 重新實作或複製並改寫成主 repo 的資料欄位（例如主 repo 的 `ownerShare` 是 0–100 整數，`hotel-pm` 的 `ownerRatio` 是 0–1 小數）。

### 12.1 要搬（M1）

| # | `hotel-pm` 來源 | 搬到主 repo 的用途 | 對應 FR | 原因 |
|---|---|---|---|---|
| 1 | `vitest.config.ts`、`playwright.config.ts`、CI 的 test／E2E／audit job 寫法 | 主 repo 的測試基礎建設 | NFR 測試 | 主 repo 0 個測試 |
| 2 | `domain.ts` `calculateBreakdown` + `BreakdownRule` 與其測試案例 | 拆帳引擎（比例／固定／階梯），月報 API 改用它 | FR-016、FR-017 | 主 repo 只有比例且無驗證、無測試 |
| 3 | `domain.ts` `createCsv`（RFC 4180）與測試 | 月報 CSV 匯出 | FR-018 | 主 repo 沒有任何匯出 |
| 4 | `domain.ts` `getContractAlerts`、`calculateOverdueDays`、`parseDateStrict` 與測試 | 房客合約到期／逾期提醒 | FR-008 | 主 repo 有 `Tenant.endDate` 但沒有提醒 |
| 5 | `domain.ts` `isBookingOverlapping`、`validateBooking`（日期規則）與測試 | 建立訂房與 ICS 匯入時的重疊檢查 | FR-010、FR-011 | 主 repo 沒有重疊檢查 |
| 6 | `domain.ts` `getOccupancyRate` 與測試 | 總覽與物業表現的入住率計算改為可測試的純函式 | FR-020 | 主 repo 目前是 SQL 內的近似值 |
| 7 | `domain.ts` `calculateMonthlyReport` 中「排除已取消訂房」的測試案例 | 月報收入規則測試 | FR-016 | 主 repo 規則（只算 completed）尚無測試 |
| 8 | `next.config.mjs` 的 6 個安全標頭 | 主 repo `next.config.ts` | NFR 資安 | 主 repo 沒有安全標頭 |

### 12.2 不搬

| `hotel-pm` 項目 | 原因 |
|---|---|
| 所有頁面（`/dashboard`、`/properties`、`/tenants`、`/bookings`、`/reports` 等）與 mock 資料 | 寫死的 mock、沒有 CRUD；主 repo 已有接資料庫的版本與較新的營運總覽設計 |
| `parseIcsEvents` | 主 repo 的 `src/lib/ics-parser.ts` 支援折行、時區、參數，較完整；改為替主 repo 解析器補測試 |
| `storage.ts`、`use-local-storage.ts`、`FavoriteButton` | 主 repo 資料在伺服器端；收藏功能不在商業需求內 |
| `validateProperty` | 主 repo 已用 Zod schema 驗證；「坪數需大於 0」「押金不可負」規則可在 M2 補進 Zod，不搬函式 |
| `createMaintenanceRequest` 等工單函式 | 主 repo 已有 `Maintenance` 表與 PATCH API，狀態值不同 |
| `generateReportPdf` | 名稱是 PDF 但實際輸出 CSV，與 #3 重複；PDF 另於 M2 實作 |
| `formatLineNotify`／`sendLineNotify` | 只是 mock；LINE Notify 服務已終止（待確認），通知延到 M3 重新設計 |
| `validatePosOrder`、`isLawReviewRequired` | POS 不在產品範圍；法務審核概念已寫入 §8、§9 |
| `getGracefulFallback` 文案 | 內容含與主 repo 不同的方案價格與上限，不一致 |
| `generateSitemap`、`openGraphMeta` | 主 repo 已有 `sitemap.ts`；pm 版本寫死 `hotel-pm.vercel.app` 網域 |
| `@supabase/supabase-js` 依賴 | 未使用 |
| `e2e/*.spec.ts` | 針對 mock 頁面；主 repo 依自己的頁面重寫 E2E |
| Tailwind v4 設定、`dashboard.html` 原型 | 主 repo 使用 Tailwind v3 與自己的設計 |

### 12.3 合併後 `hotel-pm` 的處置

封存、刪除或保留由 Sean 決定（agent 不得封存、刪除或改名 repo）。

## 13. 與舊文件不一致之處（以程式為準）

| 文件說法 | 程式實況 |
|---|---|
| 主 repo README／舊 SPEC：月報「一鍵匯出 PDF」 | 無 PDF、無 CSV；只有 JSON API 與畫面 |
| 舊 SPEC FR-003：房客「月繳提醒」、S-03「Email 確認信寄出」 | 無提醒、無寄信功能 |
| 舊 SPEC FR-004：ICS 匯入到訂房看板 | 匯入到 `IcsEvent` 表，不出現在訂房看板 |
| 舊 SPEC FR-011：NextAuth middleware 保護 `/dashboard/*` | 沒有 middleware／proxy；由各頁面自行檢查 |
| 舊 SPEC FR-001：Email／密碼註冊已上線 | 註冊 API 回 410，暫停中 |
| 舊 SPEC §6：GHA 4 jobs 全綠、有測試 | `npm test` 只印字；test job `continue-on-error` |
| 舊 SPEC §1.2：Business NT$1,999 | 方案頁 NT$1,499 |
| 方案頁：雲端同步、CSV、團隊帳號、API、白標、審計日誌 | 除雲端資料庫外皆未實作 |
| `hotel-pm` README：純前端 SPA + localStorage 四大模組 | 頁面是寫死的 mock；localStorage 只存收藏 |
| `hotel-pm` README：LINE Notify 推播 | 只有 mock 函式 |
| `hotel-pm` `generateReportPdf` | 實際輸出 CSV |

## 14. 不做的事（全期）

- 不做 OTA channel manager（不主動推房價／房況到訂房平台）；FR-013 只評估讀取型官方串接。
- 不做硬體整合（門鎖、印表機）。
- 不做原生 App（以響應式網頁為主）。
- 不做餐飲 POS、完整會計系統。
- 不在 M3 前收取真實款項。
