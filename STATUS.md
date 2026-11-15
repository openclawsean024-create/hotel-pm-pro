# Status — 民宿與包租代管 PMS（hotel-pm-pro）

- 更新日期：2026-11-16
- 狀態：🟡 **M1 開發中**（分支 `feat/m1`）
- 目前里程碑：M1（見 `GOAL.md`）
- 規格：`PRD/SPEC.md` v4.0

## M1 AC 進度

狀態：✅ 驗證指令通過｜🟡 進行中｜⬜ 未開始。驗證指令與 exit code 的完整紀錄見文末「M1 驗證紀錄」。

| AC | 內容 | 狀態 | 測試（名稱皆以 AC 編號開頭） |
|---|---|---|---|
| AC-001 | 測試基線（Vitest、ESLint、CI 必經） | ✅ | `src/lib/ci-baseline.test.ts` |
| AC-002 | 拆帳引擎 | ✅ | `src/lib/settlement.test.ts` |
| AC-003 | 月報與 CSV | ✅ | `src/lib/csv.test.ts`、`src/lib/dates.test.ts`、`src/app/api/reports/monthly/route.test.ts` |
| AC-004 | 合約到期／逾期提醒 | ✅ | `src/lib/contracts.test.ts`（總覽 API 的 contractAlerts 另見 AC-009 的 summary 測試檔） |
| AC-005 | 訂房重疊檢查 | ⬜ | — |
| AC-006 | Stripe 測試模式 | ⬜ | — |
| AC-007 | ICS 匯入與 SSRF | ⬜ | — |
| AC-008 | 安全標頭、proxy、E2E | ✅ | `src/lib/security-headers.test.ts`、`e2e/smoke.spec.ts`、`e2e/flows.spec.ts` |
| AC-009 | 已知缺陷修正 | ✅ | `src/app/api/dashboard/preload.test.ts`、`src/app/api/dashboard/summary/route.test.ts`、`src/lib/occupancy.test.ts`、`src/app/api/requirements/[id]/route.test.ts` |
| AC-010 | 收尾與資料衛生 | ⬜ | — |

## 與 Notion「可產品化商品」的對應

| Notion 欄位 | 值 | repo 對應 |
|---|---|---|
| 產品名稱 | 民宿與包租代管 PMS | 本 repo（hotel-pm-pro） |
| 優先順序 | P1 | — |
| 開發順位 | 第 2 個 | — |
| 主 repo | openclawsean024-create/hotel-pm-pro（main） | 本 repo |
| 要併入的 repo | openclawsean024-create/hotel-pm | 合併清單：`PRD/SPEC.md` §12；M1 AC-002～AC-010 |
| 獲利潛力／模式 | 高／SaaS 訂閱 | Stripe 訂閱（測試模式，FR-022／FR-023） |
| 目標客群 | 1–10 房民宿、50–200 房包租代管 | SPEC §2；房間與房東模型 M2（FR-005／FR-006） |
| 現況完成度 | 60 | 見下方 FR 對照；本次盤點未重新評分 |
| 上市前要補 | 補測試、Stripe 金流實測、訂房平台串接、合併兩個 repo | M1：AC-001、AC-006、AC-007、AC-002～AC-010 |
| 主要風險 | 國際 PMS 競爭；金流與帳務錯誤 | SPEC §9 |

## 盤點基準

| repo | 分支 | HEAD |
|---|---|---|
| hotel-pm-pro | main | `cde7950` |
| hotel-pm（只讀） | main | `7e8e015` |

## 本次實跑檢查（2026-11-16，本機 Node v26.13.1，在 clone 的工作目錄執行）

| repo | 指令 | exit | 說明 |
|---|---|---:|---|
| hotel-pm-pro | `npm ci --legacy-peer-deps` | 0 | |
| hotel-pm-pro | `npx prisma generate` | 0 | |
| hotel-pm-pro | `npm run typecheck` | 0 | |
| hotel-pm-pro | `npm test` | 0 | 只是 `echo`，**0 個測試** |
| hotel-pm-pro | `npm run build`（假環境變數） | 0 | |
| hotel-pm | `npm ci` | 0 | |
| hotel-pm | `npm test` | 0 | Vitest 71 passed（domain 57、storage 8、use-local-storage 6） |
| hotel-pm | `npm run typecheck` | 0 | |
| hotel-pm | `npm run lint` | 0 | |
| hotel-pm | `npm run test:e2e` | 未執行 | 15 個 Playwright test，針對 mock 頁面 |

CI 使用 Node 20；本次本機版本不同，結果僅供參考。

## FR 實作對照

狀態：✅ 已實作｜🟡 部分｜❌ 未實作。完整描述見 `PRD/SPEC.md` §6。

| FR | 名稱 | 優先 | 狀態 | 所在 repo | 計畫 |
|---|---|---|---|---|---|
| FR-001 | 登入 | P0 | ✅ | pro | — |
| FR-002 | 公開註冊 | P0 | 🟡 暫停（410） | pro | M2，待 Sean 決定 |
| FR-003 | 路由與 API 保護 | P0 | 🟡 | pro | M2 |
| FR-004 | 物業管理 | P0 | 🟡 缺編輯 | pro | M2 |
| FR-005 | 房間／單位模型 | P1 | ❌ | — | M2 |
| FR-006 | 房東資料與房東別月報 | P1 | ❌ | — | M2 |
| FR-007 | 房客 CRM | P0 | 🟡 缺編輯 | pro | M2 |
| FR-008 | 合約到期／逾期提醒 | P1 | 🟡 只有函式 | pm | M1（AC-004） |
| FR-009 | 訂房管理 | P0 | 🟡 缺編輯 | pro | M2 |
| FR-010 | 訂房重疊檢查 | P0 | 🟡 只有函式 | pm | M1（AC-005） |
| FR-011 | ICS 匯入 | P0 | 🟡 不轉訂房、無 SSRF 防護 | pro | M1（AC-007） |
| FR-012 | ICS 定期同步 | P1 | ❌ | — | M2 |
| FR-013 | 訂房平台官方串接 | P2 | ❌ | — | M3 評估 |
| FR-014 | 需求單 | P1 | 🟡 缺狀態更新 | pro | M2 |
| FR-015 | 維修派工 | P1 | ✅ | pro | 補測試 |
| FR-016 | 月報與房東分潤 | P0 | 🟡 無測試 | pro | M1（AC-002、AC-003） |
| FR-017 | 多種拆帳規則 | P1 | 🟡 只有函式 | pm | M1（AC-002） |
| FR-018 | 月報 CSV 匯出 | P0 | 🟡 只有函式 | pm | M1（AC-003） |
| FR-019 | 月報 PDF 匯出 | P1 | ❌（文件宣稱有） | — | M2 |
| FR-020 | 營運總覽 | P1 | 🟡 有缺陷 | pro | M1（AC-009） |
| FR-021 | 房東分帳預估卡 | P2 | 🟡 | pro | M2 |
| FR-022 | Stripe 結帳（測試模式） | P0 | 🟡 未實測 | pro | M1（AC-006） |
| FR-023 | Stripe webhook | P0 | 🟡 有缺陷 | pro | M1（AC-006） |
| FR-024 | 方案用量限制 | P1 | ❌ | — | M2 |
| FR-025 | 團隊帳號 | P2 | ❌ | — | M3 |
| FR-026 | 對外通知 | P2 | 🟡 只有 mock | pm | M3 |
| FR-027 | 聯絡表單 | P2 | ✅ | pro | — |
| FR-028 | 行銷與法務頁 | P1 | ✅ | pro | 方案頁文案 M2 修正 |
| FR-029 | 假資料 seed | P1 | ✅ | pro | — |
| FR-030 | 個資匯出／刪除 | P1 | ❌ | — | M2 |

小計：✅ 5、🟡 17、❌ 8。

## 合併進度（`hotel-pm` → 本 repo）

| # | 項目 | 狀態 | commit |
|---|---|---|---|
| 1 | 測試基礎建設（Vitest／Playwright／CI） | 未開始 | — |
| 2 | 拆帳引擎 `calculateBreakdown` | 未開始 | — |
| 3 | CSV `createCsv` | 未開始 | — |
| 4 | 合約提醒 `getContractAlerts` 等 | 未開始 | — |
| 5 | 訂房重疊 `isBookingOverlapping` 等 | 未開始 | — |
| 6 | 入住率 `getOccupancyRate` | 未開始 | — |
| 7 | 月報排除已取消訂房測試案例 | 未開始 | — |
| 8 | 安全標頭 | 未開始 | — |

## 已知問題（詳見 SPEC §5.3、§13）

- 0 個自動化測試；CI test job `continue-on-error`。
- 總覽頁查詢不存在的 `Room` 表；`checkout_today` 房況不可達。
- Stripe webhook 不建立 `Subscription`、無冪等、未處理 invoice 事件。
- ICS 匯入不轉訂房、無 SSRF 防護。
- 無安全標頭。
- README／舊 SPEC／方案頁宣稱 PDF 匯出、月繳提醒、middleware、團隊帳號等未實作功能。

## Stripe 測試模式驗證紀錄（AC-006 (c)）

尚未執行。

## 下一步

1. Sean 確認 `PRD/SPEC.md` 與 `GOAL.md` 的範圍與「待確認」事項。
2. 依 `GOAL.md` 從 AC-001（測試基線）開始實作。
