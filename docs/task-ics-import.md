# Task 1b: F-M9 ICS 匯入

> 角色：worker（task 1b）
> 日期：2026-09-05
> 工作目錄：`/Users/sean/.minimax-agent/projects/hotel-pm-pro`

## 改了什麼

- 新增 `src/lib/ics-parser.ts`（214 行，純函式，零外部依賴）
- 新增 `src/app/api/ics/import/route.ts`（131 行，POST endpoint，pg 直連）
- 新增 `src/app/dashboard/ics/page.tsx`（211 行，client component）
- 編輯 `src/components/AppNav.tsx`（加 1 個 NAV_ITEMS entry，位於 bookings 之後、reports 之前）

## Parser 決策

### 支援的日期格式

| 範例 | 處理 |
|---|---|
| `DTSTART:20261215` | DATE-only，當 UTC 00:00 |
| `DTSTART:20261215T143000Z` | DATE-TIME，UTC |
| `DTSTART;TZID=Asia/Taipei:20261215` | DATE-only，TZID 為 Asia/Taipei → 換算成 UTC（= 當地 - 8h） |
| `DTSTART;TZID=Asia/Taipei:20261215T143000` | DATE-TIME，TZID 為 Asia/Taipei → 換算成 UTC |
| `DTSTART:20261215T143000`（無 Z、無 TZID） | Floating time，視為 UTC（保守選擇） |

### 時區處理

簡化策略：維護一個白名單的 TZID → offset 小時數對照表，**不支援的時區直接拋 `IcsParseError`**（400）。

支援：Asia/Taipei、Asia/Tokyo、Asia/Shanghai、Asia/Hong_Kong、Asia/Singapore、Asia/Bangkok、Asia/Manila、Asia/Seoul、UTC、Etc/GMT±N。理由：民宿管家以台灣為主，鄰近東亞時區是合理覆蓋面；引入完整的 IANA tz database 需要新套件（`luxon` / `moment-timezone`），違反「不可裝新套件」限制。

### Line folding

照 RFC 5545 §3.1：CRLF + SPACE/HTAB 是上一行的 continuation。實作：先 normalize `\r\n` 與孤立 `\r` 成 `\n`，然後把「開頭是 SPACE/HTAB 的行」合併到上一行（移除前綴空白）。常見實務中 SUMMARY/DESCRIPTION 折行時會用單一空格，合併後看起來是「王小明 2 guests」（不是「王小明 2guests」），是 producer 的責任。

### CRLF / LF / CR

- `\r\n`（標準）→ 折成 `\n` 再 split
- `\n`（Unix 風）→ 直接 split
- 孤立 `\r`（少見）→ 也 normalize 成 `\n`，避免 AirBnb 偶爾吐 CR-only 格式時爆炸

### 無效 event 處理

- **沒 UID / 沒 DTSTART / 沒 DTEND** → 靜默 `return null`（不收進結果）
- **checkOut ≤ checkIn** → 靜默跳過（不合理 event）
- **日期 parse 失敗 / 不支援的 TZID** → 拋 `IcsParseError`（整個 ICS 視為壞檔，回 400）
- **空字串 / 非字串輸入** → 拋 `IcsParseError("ICS 內容為空")`

理由：UID / 日期缺失是 ICS 格式不完整（很可能整批都不該匯入），但個別 event 異常時不該讓整批 400；時區不支援則是**全檔性**問題，使用者必須先看到錯誤訊息。

### 文字跳脫

支援 `\,` `\;` `\\` `\n` 四種 RFC 5545 §3.3.11 跳脫（用於 SUMMARY / DESCRIPTION）。

## API 決策

### 是否自動建 Booking

**目前結論：否**。

理由：
1. **欄位對應不明** — ICS 內只有 `SUMMARY`（自由文字，可能是「王小明 2 guests」這種平台預設格式）與 `UID`，**沒有結構化的 guestName / totalPrice / channel**。自動建 Booking 等於把 SUMMARY 硬塞到 `guestName`，把 `totalPrice` 留 0、把 `channel` 寫 source — 這是假資料，使用者看到反而困惑。
2. **避免與手動 booking 衝突** — 使用者可能在 `/dashboard/bookings` 手動建 Booking，又在 Airbnb 上有 ICS，兩者 UID 不同、摘要重疊時會撞單。
3. **目前 IcsEvent schema 沒有 `bookingId` 對應欄位**（有 `@@unique([userId, uid])` 但沒 FK 連 Booking），未來要對應需先改 schema。

### 後續要建需要什麼欄位對應

- 從 SUMMARY 解析 guestName（regex 抓名字 + 人數）
- 從 ICS 的 `X-MICROSOFT-CDO-TOTAL-PRICE` 或 Airbnb 自訂的 `X-AIRBNB-PRICE` 抓 totalPrice
- 決定 channel 對應（airbnb ICS 來源固定 airbnb）
- 在 IcsEvent 加 `bookingId String?` 欄位做 FK
- 給使用者一個「將 IcsEvent 升級為 Booking」按鈕（比自動建更有感）

### 其他 API 決策

- **10s timeout**（AbortController）— 防止慢回應把 server 函式卡住
- **URL 格式檢查** — 解析失敗或非 http(s) 協定都回 400
- **ON CONFLICT (userId, uid) DO NOTHING** — 同一 user 對同一 UID 二次匯入不報錯、靜默略過
- **INSERT 單筆逐條** — 不包 transaction（簡單優先；N=50 個 event 也才 50 round-trip，可接受）
- **不存 raw** — schema 有 `raw` 欄位但本實作不寫入，避免重複匯入時 raw 漂移
- **回傳 events 為 ISO 字串** — UI 直接 `.slice(0, 10)` 取 YYYY-MM-DD

## 驗證

### `npx tsc --noEmit`

- **exit code**: `0`
- **error 數**: `0`
- **warning 數**: `0`（tsc 不報 warning）

### Parser sanity test（手動跑 node 驗算法，無專案 test infra）

| Case | 輸入 | 預期 | 實測 |
|---|---|---|---|
| 1 | `20261215` + TZID `Asia/Taipei` | `2026-12-14T16:00:00Z` | ✅ `2026-12-14T16:00:00.000Z` |
| 2 | `20261215T143000Z`（UTC） | `2026-12-15T14:30:00Z` | ✅ `2026-12-15T14:30:00.000Z` |
| 3 | `20261215T143000` + TZID `Asia/Taipei` | `2026-12-15T06:30:00Z` | ✅ `2026-12-15T06:30:00.000Z` |
| 4 | CRLF + leading-space line folding | 合併成單行 | ✅ 正確合併 |
| 5 | CR-only line endings | 正確 split | ✅ 正確處理 |
| 6 | `20261215`（無 TZ） | `2026-12-15T00:00:00Z` | ✅ `2026-12-15T00:00:00.000Z` |

### next build

未跑（任務明確禁止，且會跟其他 worker 衝突）。

## 風險 / 已知問題

### 沒實作的部分

- **Rate limit / 重試** — 沒有「先抓一份 cache 避免重複打 ICS 來源」機制；連按兩下「匯入」會真的打兩次 fetch
- **部分匯入 rollback** — 50 個 event 中第 30 個 DB 失敗時，前面 29 個已經寫進去；不回滾
- **Property 軟刪除** — 刪 property 時 IcsEvent 沒連動（schema 沒設 `onDelete: Cascade`）
- **UID 跨 property 衝突** — `@@unique([userId, uid])` 是 user 範圍，不是 property 範圍；同一個 Airbnb UID 對 A 物業匯入後換 B 物業會被略過（這是 by design，UID 是全平台唯一）
- **不支援的時區** — ICS 來源用 `America/New_York` 等白名單外時區會整批 400；解法是改用 `Intl.DateTimeFormat`（Node 22 內建，不算新套件）或加 `IcsEvent.timezone String?` 欄位
- **沒做 prettier / 排序 / 去重 SUMMARY** — SUMMARY 完全照搬 ICS 原文

### UI 沒處理的部分

- **multi-property bulk import** — 一次只能匯入一個 property；多物業管理者要重複操作
- **排程自動同步** — 沒有 cron / webhook；使用者只能手動按「匯入」
- **IcsEvent 列表檢視** — UI 只有「本次匯入事件」表，沒有「歷史所有 IcsEvent」頁
- **刪除 / 編輯 IcsEvent** — 沒有對應 API
- **loading 狀態** — 按下「匯入」期間整個表單 disabled，但沒有 spinner 動畫（用文字「匯入中...」表示）
- **沒驗證 ICS URL 的 domain** — 使用者貼錯網址（例如 google.com）也會嘗試 fetch

### 與其他 task 的接縫

- `src/app/dashboard/ics/page.tsx` 的空狀態訊息依賴 `/api/properties` 回 `{ properties: [...] }` — 與既有 `properties/route.ts` 一致，**不需改 API**
- `src/app/api/ics/import/route.ts` 沒引入新環境變數
- 不影響 `prisma/schema.prisma` 既有 IcsEvent model
