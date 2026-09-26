# hotel-pm-pro 競品對標與 Landing redesign brief

日期：2026-09-24
範圍：只做公開頁面視覺原型，不改正式 Next.js React、不部署、不外派 MiniMax。

## 目前產品盤點

- Production 首頁目前是深色、單欄式的功能與定價介紹。
- 現有產品範圍包含：物業、房客、訂房、ICS 匯入、需求、維修、月報與 Stripe 方案。
- Notion 專案定位為「民宿 / 短租 / 包租代管業者的物業管理系統」，目前狀態為已上線。
- 現有 `dashboard.html` 已經有營運型後台原型；本次新增 `landing-redesign.html`，專門驗證公開首頁的定位與轉換流程。

## 公開競品觀察

| 產品 | 公開定位 / 強項 | 對 hotel-pm-pro 的啟示 |
|---|---|---|
| Cloudbeds | 把 PMS、付款、分銷、報表、多物業、客戶體驗與整合平台包成大型 hospitality platform；強調統一資料與可擴張性。 | 不要在首頁用功能數量硬碰硬；應清楚切出小型台灣旅宿的導入速度與使用密度。 |
| Hostaway | 以短租營運規模化為主，包含 channel manager、訊息、付款、任務、房東報告、直訂與整合。 | 用「每天該處理什麼」作第一屏，比羅列模組更容易讓目標使用者理解價值；保留不做 OTA channel manager 的產品邊界。 |
| Lodgify | 以直訂網站、channel manager、Airbnb / Booking.com / Vrbo 等整合與定價工具吸引短租業者。 | ICS 同步要被說成「降低手動輸入與重複訂房風險」，不要包裝成完整 OTA channel manager。 |
| 林管家 | 針對台灣包租代管與多房東，強調合約、收租、帳單、催繳與自動化規模。 | hotel-pm-pro 的差異應放在旅宿日常營運、訂房／房務與房東分潤的交界，而非泛租賃管理。 |
| Ragic 包租代管 | 強調房源、裝修、報修、合約、權限、客製報表與流程彈性。 | 首頁要把維修與報表講成可追蹤的工作流，避免讓產品看起來只是 CRUD 資料表。 |

## 定位結論

新的首頁原型採用這句核心訊息：

> 每天先看該處理什麼，再看賺了多少。

三個設計決策：

1. **第一屏先展示營運結果**：今日入住、退房、待處理、營收與房東分帳，而不是先展示四個功能卡片。
2. **把本地差異講清楚**：繁中流程、房東分帳、ICS、維修與月報；不暗示具備大型競品的 OTA channel manager、動態定價或 AI 功能。
3. **用工作情境分流**：民宿老闆、包租代管營運、財務／房東報表各自看到不同價值，降低首頁認知負擔。

## 本次原型驗收重點

- [x] 單一 HTML 可直接開啟，沒有 API、資料庫或 secret。
- [x] 包含 hero、產品操作畫面、工作流程、定位比較、功能、方案與 CTA。
- [x] 有手機版導覽、響應式產品 preview、使用情境切換與 demo modal。
- [x] 文案與現有產品功能相容，明確標註 Demo data only / 視覺原型。
- [ ] Sean 確認定位、視覺與文案後，才進入正式 React 實作或外派 MiniMax。

## 來源

- Cloudbeds — [Hospitality management system](https://www.cloudbeds.com/)、[Pricing](https://www.cloudbeds.com/pricing/)
- Hostaway — [About Hostaway](https://support.hostaway.com/hc/en-us/articles/360002572393-About-Hostaway)
- Lodgify — [Pricing and plans](https://www.lodgify.com/pricing/)
- 林管家 — [包租代管自動化房管系統](https://www.linhome.tw/)
- Ragic — [包租代管系統](https://www.ragic.com/intl/zh-TW/product-property-rental-management)
