# Task 1a: /dashboard/properties page

## 改了什麼
- 新增 `src/app/dashboard/properties/page.tsx`（298 行，client component）

## 設計決定

### 編輯功能
**留 v2 TODO（confirm 提示）**。
原因：`/api/properties/[id]/route.ts` 當前**只支援 DELETE**，沒有 PATCH 端點；任務明確禁止改 API routes。如果按鈕走真的 inline 編輯，PATCH 會 405 / 404，UX 比 confirm 提示更糟。任務也明確允許「如果太複雜可以先用 confirm("編輯功能 v2 補") 留 TODO」。UI 上仍放了一顆「編輯」按鈕（藍色 `text-[var(--accent)]`），點下去顯示 `confirm("編輯功能 v2 補（待 /api/properties/[id] 支援 PATCH）")`。

### /dashboard 物業清單是否搬走
**未搬**。`/dashboard/page.tsx` 仍保留 KPI 區塊（總物業數 / 月租總額 / 方案）+ 物業清單 + 新增表單，原因：
- 任務說「可以保留部分彙總，不改也 OK」
- 改動 `/dashboard/page.tsx` 風險大（既有功能都在跑），新頁面補完後兩處重複是**功能冗餘**而非 bug
- preflight 報告（task 0）已標註此為「功能重複的導航冗餘」，要清掉的話建議走「從 AppNav 拿掉 `/dashboard/properties` 連結」或「在 /dashboard 加『完整管理 →』按鈕」的方向，**不在本 task 範圍**。

### KPI 區塊
3 個 KPI：總物業數 / 月租總額 / 平均坪數。
- 與 `/dashboard` 風格一致（`card` 包裝、`text-3xl font-bold`）
- 第三個 KPI 從 `/dashboard` 的「方案」改為「平均坪數」— 任務明確要求
- 平均坪數有 null 處理：若所有物業都沒填 area，顯示 `—`；有填才顯示 `${avgArea.toFixed(1)} 坪`

### Header
照 `/dashboard`（**非** tenants）的 header 結構：tier badge + email + 升級按鈕（tier === "free"）+ 登出按鈕。任務明確要求「民宿管家 + 登出按鈕結構，與 /dashboard 一致」。

### 表格欄位
名稱 / 地址 / 房型 / 坪數 / 月租金 / 房東分潤 / 操作（編輯 + 刪除）。
- 比 `/dashboard/page.tsx` 多「坪數」一欄（因 KPI 強調坪數，表格也要能看到）
- 操作欄用 `whitespace-nowrap` 避免編輯 / 刪除擠在一起換行

### 刪除確認訊息
比 `/dashboard` 多一段：「此操作會連帶影響房客與訂房記錄」— 因為 Property 對 Tenant / Booking 有 FK cascade，刪前提示比較負責任。

## 驗證

### `npx tsc --noEmit`
- **exit code**: `0`
- **error 數**: `0`
- **warning 數**: `0`
- 環境：`set -a; source .env.build; set +a; npx tsc --noEmit`（dummy env 必備但 tsc 本身不吃環境變數，這裡只是合約一致性）

### 型別小細節
- `tier` 從 `session?.user.tier` 取出時用了 `(session?.user as { tier?: string } | null)?.tier ?? "free"` — 比 `/dashboard/page.tsx` 用的 `as any` 嚴格一點，但因 `User` schema 沒在 NextAuth session type 內，仍需要 cast；不算改善只是略乾淨
- `Property.area` 型別為 `number | null`，表格渲染與平均計算都做了 null 防護

## 風險 / 已知問題

1. **編輯按鈕是 placeholder**：要等到 task 1b 或 follow-up 加完 `/api/properties/[id]` 的 PATCH 才能實作。當下點下去只會跳 confirm。
2. **與 `/dashboard/page.tsx` 物業清單重複**：兩個地方都能新增 / 刪除物業，UX 一致性靠兩邊 form 欄位對齊（已對齊）。建議下一輪拿掉 `/dashboard` 的物業清單區塊或從 AppNav 拿掉 `/dashboard/properties` 連結。
3. **未做「無物業時禁用 /dashboard 上其他依賴物業的子頁」**：例如 tenants 頁有 `disabled={properties.length === 0}` 提示，本頁未做反向檢查（不太需要）。
4. **沒做分頁 / 排序**：與既有 tenants / bookings 一致，未來若物業數 > 50 再補。
5. **坪數輸入未限制型別**：用 `<input type="number">`，但允許小數（Prisma schema 是 `Float?`），OK。
6. **Next 16 / React 19 無新警告**：與 baseline 一致；無 client component / hydration 問題。
