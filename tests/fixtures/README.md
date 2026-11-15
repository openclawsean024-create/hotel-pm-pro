# 測試 fixture

這個目錄的檔案全部是**自行編寫的假資料**，只供自動化測試使用。

| 檔案 | 說明 |
|---|---|
| `airbnb-fake.ics` | 仿 Airbnb 匯出格式（全天日期、`Reserved`／`Airbnb (Not available)`、折行的 UID 與 DESCRIPTION） |
| `booking-fake.ics` | 仿 Booking.com 匯出格式（`CLOSED - Not available`） |
| `edge-cases-fake.ics` | 時區、UTC 時間、缺 UID、退房日等於入住日、折行的 SUMMARY、只有 DESCRIPTION |

- UID 一律使用 `@fixture.hotel-pm.test`，網址一律使用 `calendar.example.test`（保留給測試的網域，不會解析到真實主機）。
- 內容不取自任何真實的 Airbnb／Booking.com 帳號；不得把真實客戶的 ICS 連結或內容放進來。
- `.ics` 檔使用 CRLF 換行（RFC 5545），`.gitattributes` 已設定不轉換換行字元。
