# iPhone 快速分享與每日連結小報

這次更新使用原有 Google Apps Script 與 Shiguang 工作表，電腦版不必更換 EXE。完成以下設定後，分享的連結及每日小報會在 FLUX 下次同步時出現。

## 1. 更新雲端服務

1. 在現有 Apps Script 專案，以新版 Code.gs 取代程式碼。
2. 保留原本 SPREADSHEET_ID、SYNC_TOKEN。若採明確 OAuth 權限，合併新版 appsscript.json 的 script.scriptapp 權限。
3. 「部署 → 管理部署 → 編輯 → 新版本 → 部署」，保留同一個 /exec 網址。執行身分是自己，存取權是所有人；每次寫入仍驗證同步密語。

## 2. 建立 iPhone「收進 FLUX」捷徑（只需一次）

1. 開啟 Apple「捷徑」，新增捷徑，命名「收進 FLUX」。在詳細資訊啟用「在分享表單中顯示」，接收類型選「URL」及「Safari 網頁」。無輸入時選停止。
2. 加入「從輸入取得 URL」，輸入選「捷徑輸入」。再加入「取得列表中的項目」，選「第一個項目」。本版本每次收錄一個連結。
3. 加入「取得 URL 內容」，上方網址填你的 Apps Script **/exec 部署網址**（不要選剛才的分享網址）。
4. 展開選項，方法選 **POST**，要求本文選 **JSON**，新增三個文字欄位：

   | 欄位 | 值 |
   | --- | --- |
   | token | 與 FLUX 設定相同的同步密語 |
   | action | capture.link |
   | url | 第 2 步取得的第一個 URL（選魔術變數） |

5. 加入「取得字典值」，從「URL 內容」取出 `ok`。加入「如果」：當 ok 為真，顯示通知「已收進 FLUX」；否則從同一份「URL 內容」取出 `error` 並顯示提示。不要無條件顯示成功。
6. Safari 或其他會分享網址的 App → 分享 →「收進 FLUX」。首次允許捷徑連線至 Google。可以在分享表單的編輯動作中加入喜好項目。

不必開啟 FLUX，也不必複製貼上。需有網路；失敗時捷徑會顯示錯誤，請再分享一次。同一個仍在收藏的完整網址不重複新增。分享純圖片／檔案不適用。請勿公開含同步密語的捷徑。

## 3. 啟用每日 Gemini 小報

1. Apps Script → 專案設定 → 指令碼屬性，加入 `GEMINI_API_KEY`。這是雲端使用的金鑰，與電腦加密保存的金鑰分開設定，不會寫入筆記或回傳給捷徑。
2. 可選 `FLUX_DIGEST_MODEL`，預設 `gemini-3.1-flash-lite`，須支援 URL context。
3. 在編輯器執行一次 `enableFluxDailyDigest`，完成 Google 授權。每天台灣時間 **21:00～22:00** 左右執行；Apps Script 時間觸發器不保證精確分鐘。
4. 啟用後分享一個連結，執行 `runFluxDailyDigest` 可立即驗證，接著在 FLUX 按同步。
5. 小報標題為「連結小報｜日期」，可以用「連結小報」標籤搜尋。它會逐個簡短整理連結，再彙整共同主題；原收藏保持不變。

僅處理啟用後新增且已同步到雲端的連結，每次最多 10 則，剩下的下次續處理；沒有新連結不呼叫 AI。初次啟用前的舊收藏不會自動送出。啟用後，待處理連結的標題、URL 及 Google 取得的公開頁面內容會由 Gemini 處理。登入頁、付費牆、影片等可能無法讀取，模型會被要求標示待補充，不保證每個網站都能摘要。

執行失敗會保留待處理連結，下次排程再試一次。到 Apps Script「執行項目」查看失敗；指令碼屬性 `FLUX_DIGEST_ERROR` 保存最近錯誤，`FLUX_DIGEST_LAST_SUCCESS` 保存最近成功時間。模型額度及 URL 讀取可能產生 API 費用。

停止：執行 `disableFluxDailyDigest`。再次啟用會接續未處理連結。不要刪除小報的來源記錄欄位；它用來避免重複整理。將小報移到 FLUX 垃圾桶仍會保留去重記錄。

參考：[Apple 分享輸入類型](https://support.apple.com/guide/shortcuts/apd7644168e1/ios)、[Gemini URL context](https://ai.google.dev/gemini-api/docs/generate-content/url-context)。
