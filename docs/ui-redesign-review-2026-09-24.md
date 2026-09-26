# Hotel PM Pro · UI redesign review

日期：2026-09-24
基線：Notion canonical Project「飯店 / 包租代管物業管理」、`PRD/SPEC.md` v3.0.2、`PRD/UI-SPEC.md` v1.0

## 專案現況

- 定位：面向台灣民宿、短租與包租代管業者的輕量 PMS + 物業營運工具。
- 核心工作流：房客 CRM、物業、訂房、ICS 匯入、需求／維修、月報與房東分帳。
- 目前 repo：`openclawsean024-create/hotel-pm-pro`。
- Notion 狀態：已上線；Project row 顯示 production HTTP 200，2026-09-23 的進度是暫停公開註冊以避開失效 Supabase tenant。
- 原型基線：`dashboard.html` 已有左側導覽、KPI、房況、今日營運、待辦、營收與快速動作，但首頁的操作優先級仍接近「資訊總覽」，還不夠像每日營運控制台。

## 競品對標摘要

| 參考產品 | 可借鑑的互動／資訊架構 | 本專案採用方式 | 不納入的範圍 |
|---|---|---|---|
| Cloudbeds | 首頁先給 arrivals、departures、occupancy、available rooms 與今日活動 | KPI 先回答入住／退房／房況；今日營運改成主要工作區 | 不因此加入飯店集團級功能 |
| Guesty | 全域搜尋、Quick add、集中任務中心、依 property／assignee／status 篩選 | header 放搜尋與快速動作；待辦中心提供狀態篩選與責任人脈絡 | 不加入完整 unified inbox 或 AI 功能 |
| Hostaway | Tasks overview + calendar view、auto-task、checklist 與 mobile task flow | 待辦中心以事件時間線與任務卡呈現；清潔／維修依入住事件排序 | 只做原型層級，不擴增自動派工後端 |
| 台灣物業管理工具 | 物業、房客、合約、收租／帳務、修繕與報表集中管理 | 在首頁加入「房東分帳準備度／待對帳」訊號，讓 PMS 不只像旅宿看板 | 不加入電子簽約、金流、門禁或 IoT |

## 新版原型決策

1. header 加入全域搜尋，降低在「物業／房客／訂房／維修」之間切換的成本。
2. 首屏以「營運警示 → KPI → 今日營運／待辦中心」排序，讓使用者先處理會影響入住的事項。
3. 房況格改成更強的工作板：保留文字狀態、物業切換與房號，但提高待清潔／維修的視覺優先級。
4. 將「房東分帳」放入財務摘要，而不是只留在營收圖表中；這對包租代管 persona 比單純 revenue trend 更直接。
5. 本輪改為 international SaaS visual language：graphite navigation、orange action color、violet analytics、neutral canvas，避免延續上一版 mint／深綠模板感。
6. 導覽、KPI、狀態 chip、搜尋、scope、時區、locale、owner settlement 與 mobile bottom bar 都使用可落地的產品元件，而不是單純裝飾卡片。
7. 以中英混排示範國際化方向；正式版應將所有 label、日期格式、幣別、時區與權限文案改為 i18n resource，不應把字串散落在 component 內。
8. 仍是 static prototype：互動只顯示 toast／modal，不假裝寫入後端；不改 route、API、Prisma schema 或商業邏輯。

## 本輪產品化補強

- 加入 `lang="zh-Hant"`、timezone 顯示、locale 控制入口與英文化操作文案，讓資訊架構不被單一市場語言綁死。
- 加入 empty/error/loading 狀態的產品化設計預留位置：status chip、exception queue、sync status、demo workspace 標示。
- 將 action、filter、scope、modal、table、mobile navigation 做成一致的 interaction primitives；避免每個區塊各自發明一套按鈕。
- 已在乾淨瀏覽器頁籤檢查 1280px 無水平溢出、HTML 可載入、console 無新錯誤；本輪不宣稱已完成正式後端／auth／資料庫上線驗收。

## 參考來源

- [Cloudbeds Dashboard 說明](https://myfrontdesk.cloudbeds.com/hc/en-us/articles/115000400634-Dashboard-Everything-you-need-to-know)
- [Cloudbeds PMS 功能](https://www.cloudbeds.com/property-management-system/)
- [Guesty Dashboard 導覽](https://help.guesty.com/hc/en-gb/articles/11877241350685-Navigating-the-Guesty-dashboard)
- [Guesty Tasks](https://www.guesty.com/features/tasks-management/)
- [Hostaway Tasks Dashboard](https://support.hostaway.com/hc/en-us/articles/360002564074-Tasks-Dashboard-Mobile-App)
- [Ragic 包租代管系統](https://www.ragic.com/intl/zh-TW/product-property-rental-management)
- [Miistay AI 包租代管系統](https://www.miistay.com/)
