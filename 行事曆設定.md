# FLUX 行事曆設定（桌面／網頁 0.3.0）

這次加入「筆記轉行程」及「今日行程」，沿用原有 Apps Script 網址與 SYNC_TOKEN。網頁版及桌面 EXE 0.3.0 均支援行事曆；舊電腦版仍可透過同一服務同步筆記。

## 1. 更新 Apps Script

1. 打開原本的 Apps Script 專案，先保留原 Code.gs 的備份。
2. 用這次附的完整 `Code.gs` 取代原內容並儲存，不要和舊版本重複貼在一起。
3. 左側「服務」旁按「＋」，新增 **Google Calendar API**（版本 v3，識別名稱 Calendar）。這是 Google 的進階服務，不需要填 Gemini API 金鑰。
4. 如果使用自行管理的標準 Google Cloud 專案，也要在該專案啟用 Google Calendar API；預設 Apps Script Cloud 專案會由新增服務處理。
5. 上方函式選擇 **authorizeCalendar**，按「執行」，使用部署者的 Google 帳號完成行事曆讀寫授權。此函式只讀取一筆行程，不會新增。若看到未驗證應用程式畫面，先確認是你自己的這份專案，再依 Google 提供的流程授權；若帳號管理員禁止存取，需由管理員處理。
6. 「部署 → 管理部署 → 編輯（鉛筆）→ 版本選『新版本』→ 部署」。保持「以自己身分執行」與原本的存取設定。選原有部署即可維持同一個 `/exec` 網址。

若原本設定了明確的 `oauthScopes`，到專案設定開啟「顯示 appsscript.json」，保留現有內容，合併附帶 `appsscript.json` 的 Calendar 服務與 `https://www.googleapis.com/auth/calendar.events` 權限；不要覆蓋其他自行加入的服務。預設自動推斷權限的專案可直接新增服務及執行授權。

## 2. 指定行事曆

指令碼屬性維持原本的：

| 屬性 | 用途 |
| --- | --- |
| `SPREADSHEET_ID` | 原本筆記同步的試算表 ID |
| `SYNC_TOKEN` | 原本至少 24 字元的同步密語 |
| `CALENDAR_ID`（選填） | 不填時使用部署者的主要行事曆 `primary` |

建議建立一本「FLUX」專用 Google 行事曆，從該行事曆的「設定與共用 → 整合行事曆 → 行事曆 ID」複製 ID，填入 `CALENDAR_ID`。部署者須有該行事曆的寫入權限。修改屬性後再執行一次 authorizeCalendar 確認可讀取。

這是個人用服務：持有同步密語者可讀取和新增指定行事曆的行程。同步密語仍只填在 FLUX 設定，不要寫進 Code.gs、GitHub、圖片或公開分享。

## 3. 更新 GitHub Pages

1. 解壓新版 **FLUX-Web-0.3.0-static.zip**。
2. 上傳所有解壓後的檔案與資料夾，覆蓋 repository 對應位置。`index.html` 維持在最外層，記得一併上傳新增的 `calendar.js`、`calendar-ui.js` 與新版 `sw.js`。
3. 等 GitHub Pages 部署完成，重新開啟網頁。若還看到舊畫面，先連網開啟一次，再關閉所有 FLUX 分頁／主畫面 App 後重開；仍未更新時重新整理。避免為更新介面直接清除網站資料，以免刪除未同步筆記。
4. 設定頁填入原本的 Apps Script `/exec` 網址與 SYNC_TOKEN，再儲存。原本已填且儲存成功的裝置可繼續沿用。

## 4. 筆記轉行程

1. 在網頁或桌面版點開一則筆記 → **加入行事曆**。目前編輯中的筆記會先保存。
2. 手動填寫標題、開始／結束時間、地點與說明；或按 **AI 帶入草稿**，使用設定中的 Gemini 金鑰與模型提取資料。
3. AI 缺少明確日期時會保留空欄位並提示。只有日期會帶入全天模式，未提及結束時間就留空。確認裝置時區後，按 **確認新增** 才會呼叫 Google 新增。
4. 成功後可按 **在 Google 查看**。已建立的行程請在 Google 中修改。

每則筆記在同一本行事曆對應一個固定事件 ID。再次送出會回傳既有行程，保留 Google 內的修改，不會另建一份，也不會用新草稿覆蓋舊行程。若真的需要另一個行程，請新建一則筆記。Google 中刪除的行程可能保留刪除識別碼，這時也請使用新筆記。

結束時間是選填，不會自動填進欄位。有開始時刻但未填結束時，會傳送一小時後作為 Google API 相容用的 end，並在 FLUX 自訂欄位標記未指定結束（不直接寫入 Google 的 endTimeUnspecified 欄位）。Google 介面仍可能依相容值顯示時長，FLUX 顯示開始時間「起」。只有日期時勾選「只記日期（全天）」，開始日期必填，結束日期可不填（建立當天全天事件）；多日的結束日期為最後一天、含當天。系統會轉成 Google 要求的不含最後一天之隔日 end.date。

## 5. 今日行程

導覽列按 **今日行程**（手機為「行程」）。會讀取指定日午夜至次日午夜間的行程，日期與時間依這台裝置時區顯示，涵蓋跨日、全天及重複行程。可換日期、按「今天」或「重新整理」，超過 100 則時提供載入更多。

行程只在開啟此頁或按重新整理時讀取，未加入背景輪詢、離線行程快取或把行程內容送給 AI。電腦關機不影響 Google 已建立的事件；網頁須開啟並連網才能讀取或新增。

## 問題排除

- 顯示「同步請求格式不正確」：仍在執行舊版 Apps Script，請更新原部署為新版本。
- 顯示「Calendar 未啟用」：新增 Google Calendar API 服務，執行 authorizeCalendar 完成授權後重新部署。
- 授權不足：檢查部署執行身分、oauthScopes 及該行事曆的寫入權限。
- 找不到行事曆：CALENDAR_ID 要填行事曆 ID，不是瀏覽器網址。先不填可測試主要行事曆。
- 逾時：原筆記與草稿仍保留；對同一則筆記重試即可，固定事件 ID 會避免重複新增。

官方文件：[Apps Script 進階行事曆服務](https://developers.google.com/apps-script/advanced/calendar)、[啟用進階服務](https://developers.google.com/apps-script/guides/services/advanced)、[Calendar events.insert 與自訂事件 ID](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)。

本版測試採模擬 Calendar/Gemini 服務；實際帳號授權、Google 配額與正式部署須在你完成以上設定後確認。

## 桌面版更新

先儲存輸入中的內容，在 Windows 系統匣 FLUX 圖示按右鍵選「離開 FLUX」，再開啟 `FLUX-0.3.0-win-x64.exe`。筆記及加密設定繼續沿用 `%APPDATA%\ShiguangCapture`，不必搬移或清除舊資料。

主視窗左側新增「今日行程」；編輯筆記時新增「加入行事曆」。行事曆共用原本「連線與設定 → 雲端同步」中的網址與密語，金鑰與密語繼續由 Windows 加密保存在此電腦，行事曆請求與 AI 請求由主程序發送。浮球與快速收錄操作維持原樣。此版沒有新增開機自動啟動。

## #行程 快捷帶入（0.3.0）

在原文輸入「明天寄文件 #行程」，或在標籤填入「行程」／「#行程」，收錄或儲存後會自動打開行程草稿。有 Gemini 設定且連網時會提取日期等欄位；沒有金鑰也能手動填寫。AI 整理後產生「行程」標籤，也會帶入草稿。桌面浮球的快速收錄同樣支援。

每台裝置對同一則筆記只自動提示一次；關閉草稿後若要再開，請用筆記的「加入行事曆」。自動帶入只建立草稿，必須按「確認新增」才會寫入 Google。沒有日期時仍須先選日期，只有日期可使用全天，不用填時刻。

Google 的結束時間相容要求見 [Events 資料格式](https://developers.google.com/workspace/calendar/api/v3/reference/events)。

## 0.3.1 修正：只有開始時間時 Bad Request

此修正只需更新 Apps Script，桌面 EXE 與網頁 0.3.0 都可繼續使用。

1. 用本更新包的完整 Code.gs 取代 Apps Script 內舊內容，儲存。
2. 部署 → 管理部署 → 選原本部署 → 鉛筆編輯 → 版本選「新版本」→ 部署。
3. 沿用原 /exec 網址與同步密語，回到 FLUX，對同一則筆記按確認新增即可重試。

不要只按儲存就重試；既有 /exec 部署仍會跑舊版。以瀏覽器開啟 /exec 網址，健康資訊中的 revision 應是「0.3.1」，才表示已更新（不會顯示筆記或密語）。

新的寫入格式保留明確起訖時間；結束留空仍用一小時相容值。未指定結束的語意存在 writable 的 extendedProperties.private.fluxEndUnspecified，FLUX 回傳與今日行程顯示仍為開始時間「起」。全天事件與手動填結束的事件不使用此標記。重試保留同一事件 ID，避免重複新增。

已用禁止寫入 endTimeUnspecified 的嚴格模擬服務驗證；尚需在你的實際 Google 部署確認成功。
