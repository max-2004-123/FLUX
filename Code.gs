/** FLUX：Sheets 同步與 Google 行事曆。部署步驟見「行事曆設定.md」。 */
const HEADERS = ['id', 'version', 'updatedAt', 'title', 'summary', 'tags', 'originalContent', 'url', 'archived', 'recordJson'];

function doPost(e) {
  let lock;
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('SYNC_TOKEN');
    const sheetId = props.getProperty('SPREADSHEET_ID');
    if (!token || token.length < 24) throw new Error('請先設定至少 24 字元的 SYNC_TOKEN。');
    if (!e || !e.postData || e.postData.contents.length > 5000000) throw new Error('請求內容不正確或過大。');
    const request = JSON.parse(e.postData.contents);
    if (typeof request.token !== 'string' || request.token !== token) throw new Error('同步密語不正確。');
    if (request.action === 'transfer.list') return json(listTransfers(request, props));
    if (request.action === 'transfer.start') return json(startTransfer(request, props));
    if (request.action === 'calendar.list') return json(listCalendarEvents(request, props));
    if (request.action === 'calendar.create') return json(createCalendarEvent(request, props));
    if (!sheetId) throw new Error('請先設定 SPREADSHEET_ID。');
    if (request.action !== 'sync' || !Array.isArray(request.notes) || request.notes.length > 100) throw new Error('同步請求格式不正確（每批最多 100 則）。');
    // Validate everything before mutating the spreadsheet.
    request.notes.forEach(validateNote);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error('另一台電腦正在同步，請稍後再試。');
    const book = SpreadsheetApp.openById(sheetId);
    let sheet = book.getSheetByName('Shiguang');
    if (!sheet) {
      sheet = book.insertSheet('Shiguang');
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setBackground('#526b4b').setFontColor('#ffffff');
      sheet.setColumnWidths(4, 4, 230);
    }
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues() : [];
    const notes = new Map();
    rows.forEach((row, index) => {
      if (!row[0]) return;
      let note;
      try { note = JSON.parse(row[9]); } catch (_) { throw new Error('試算表資料格式受損，請從備份還原 recordJson 欄位。'); }
      if (notes.has(note.id)) throw new Error('試算表有重複的筆記 ID，請先檢查資料。');
      notes.set(note.id, { note, row: index + 2 });
    });
    const accepted = [], conflicts = [];
    for (const incoming of request.notes) {
      const existing = notes.get(incoming.id);
      if (existing && sameContent(existing.note, incoming)) {
        // An earlier request may have succeeded even if its response was lost.
        accepted.push({ id: incoming.id, version: existing.note.cloudVersion });
        continue;
      }
      if ((existing && existing.note.cloudVersion !== incoming.cloudVersion) || (!existing && incoming.cloudVersion !== 0)) {
        // Missing cloud rows must not strand previously synced local notes.
        if (existing) { conflicts.push(incoming.id); continue; }
      }
      const note = { ...incoming, cloudVersion: existing ? existing.note.cloudVersion + 1 : 1 };
      const rowNumber = existing ? existing.row : sheet.getLastRow() + 1;
      const safeCell = value => /^[=+\-@]/.test(String(value || '')) ? "'" + value : String(value || '');
      const cells = [note.id, note.cloudVersion, note.updatedAt, safeCell(note.title), safeCell(note.summary), safeCell(note.tags.join(', ')), safeCell(note.body), safeCell(note.url), note.archived ? 'yes' : 'no', JSON.stringify(note)];
      sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([cells]);
      notes.set(note.id, { note, row: rowNumber });
      accepted.push({ id: note.id, version: note.cloudVersion });
    }
    SpreadsheetApp.flush();
    return json({ ok: true, notes: [...notes.values()].map(x => x.note), accepted, conflicts });
  } catch (error) {
    return json({ ok: false, error: error.message || '同步服務暫時無法使用。' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
function validateNote(n) {
  if (!n || !/^[a-zA-Z0-9-]{1,100}$/.test(n.id) || !Number.isInteger(n.cloudVersion) || n.cloudVersion < 0) throw new Error('筆記 ID 或版本格式不正確。');
  if (typeof n.body !== 'string' || !n.body.trim() || n.body.length > 30000 || typeof n.title !== 'string' || n.title.length > 160 || typeof n.summary !== 'string' || n.summary.length > 5000) throw new Error('筆記文字格式不正確或超過長度限制。');
  if (typeof n.url !== 'string' || !Array.isArray(n.tags) || n.tags.length > 12 || n.tags.some(t => typeof t !== 'string' || t.length > 30)) throw new Error('筆記標籤或網址格式不正確。');
  if (typeof n.createdAt !== 'string' || typeof n.updatedAt !== 'string' || isNaN(Date.parse(n.createdAt)) || isNaN(Date.parse(n.updatedAt))) throw new Error('筆記日期格式不正確。');
  if (JSON.stringify(n).length > 45000) throw new Error('有一則筆記太長，請將內容拆成兩則再同步。');
}
function sameContent(a, b) {
  return ['id', 'title', 'body', 'summary', 'url', 'tags', 'archived', 'createdAt', 'updatedAt', 'manual', 'aiStatus', 'aiError'].every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
}
function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function doGet() { return json({ ok: true, service: 'FLUX', version: 3, revision: '0.7.0', capabilities: ['sync', 'calendar.list', 'calendar.create', 'transfer.list', 'transfer.start'] }); }

function calendarService() {
  if (typeof Calendar === 'undefined') throw new Error('請在 Apps Script 的「服務」啟用 Google Calendar API，執行 authorizeCalendar 完成授權，再部署新版本。');
  return Calendar;
}
function calendarId(props) { return props.getProperty('CALENDAR_ID') || 'primary'; }
function calendarInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('行程時間須包含明確的日期、時間與時區。');
  if (new Date(value.slice(0, 10) + 'T00:00:00.000Z').toISOString().slice(0, 10) !== value.slice(0, 10)) throw new Error('行程日期不存在，請重新確認。');
  return new Date(value);
}
function calendarEventView(event) {
  return {id: event.id, title: event.summary || '（未命名行程）', start: event.start, end: event.end, allDay: !!event.start.date, endTimeUnspecified: !!event.endTimeUnspecified || event.extendedProperties?.private?.fluxEndUnspecified === 'true', location: event.location || '', htmlLink: event.htmlLink || ''};
}
function listCalendarEvents(request, props) {
  const start = calendarInstant(request.start), end = calendarInstant(request.end);
  if (end <= start || end - start > 32 * 3600000) throw new Error('每次最多讀取一天的行程，結束時間須晚於開始時間。');
  if (request.pageToken !== undefined && (typeof request.pageToken !== 'string' || request.pageToken.length > 2048)) throw new Error('行程分頁格式不正確。');
  const options = {timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: true, orderBy: 'startTime', maxResults: 100, showDeleted: false};
  if (request.pageToken) options.pageToken = request.pageToken;
  const result = calendarService().Events.list(calendarId(props), options);
  return {ok: true, events: (result.items || []).filter(e => e.status !== 'cancelled').map(calendarEventView), nextPageToken: result.nextPageToken || '', calendarName: result.summary || 'Google 行事曆', calendarTimeZone: result.timeZone || '', fetchedAt: new Date().toISOString()};
}
function calendarDigest(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8).map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}
function createCalendarEvent(request, props) {
  if (typeof request.noteId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(request.noteId)) throw new Error('行程來源筆記 ID 不正確。');
  const input = request.event;
  if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 160 || typeof input.description !== 'string' || input.description.length > 30000 || typeof input.location !== 'string' || input.location.length > 500) throw new Error('請確認行程標題、說明與地點。');
  let start, end, dates;
  if (input.allDay === true) {
    start = calendarDay(input.start);
    end = input.end ? calendarDay(input.end) : new Date(+start + 86400000);
    dates = {start: {date: input.start}, end: {date: end.toISOString().slice(0,10)}};
  } else {
    start = calendarInstant(input.start);
    end = input.end ? calendarInstant(input.end) : new Date(+start + 3600000);
    dates = {start: {dateTime: start.toISOString(), timeZone: input.timeZone}, end: {dateTime: end.toISOString(), timeZone: input.timeZone}};
  }
  if (end <= start || end - start > 31 * 86400000) throw new Error('行程結束時間須晚於開始時間，單次最長 31 天。');
  if (typeof input.timeZone !== 'string' || input.timeZone.length > 100 || !/^[A-Za-z0-9_+\-/]+$/.test(input.timeZone)) throw new Error('行程時區格式不正確。');
  // A deterministic Calendar event ID prevents duplicates across devices and lost responses.
  // Google's IDs accept base32hex (a-v, 0-9); a hexadecimal digest is a valid subset.
  const id = 'f' + calendarDigest('flux:event:v1:' + request.noteId);
  // Keep FLUX's optional-end intent in writable custom metadata. Do not write
  // Google's endTimeUnspecified field: omitted-end inserts can be rejected.
  const resource = {id, summary: input.title.trim(), description: input.description, location: input.location, ...dates, reminders: {useDefault: true}, extendedProperties: {private: {fluxNoteId: request.noteId, fluxEndUnspecified: input.allDay !== true && !input.end ? 'true' : 'false'}}};
  const service = calendarService(), calId = calendarId(props);
  let event, reused = false;
  try { event = service.Events.insert(resource, calId, {sendUpdates: 'none'}); }
  catch (insertError) {
    // Recover both an HTTP 409 and a write that succeeded before its response was lost.
    try { event = service.Events.get(calId, id); reused = true; } catch (_) {
      if (/Bad Request/i.test(String(insertError.message))) throw new Error('Google 拒絕行程格式（Bad Request，服務版本 0.3.1）。請確認已部署新版程式，並檢查開始與結束日期。');
      throw insertError;
    }
  }
  if (event.status === 'cancelled') throw new Error('這則筆記對應的行程已在 Google 刪除。若要另建行程，請使用一則新筆記。');
  if (event.extendedProperties?.private?.fluxNoteId !== request.noteId) throw new Error('行程識別碼不符，未更動既有行程。');
  return {ok: true, event: calendarEventView(event), reused};
}
/** 在編輯器手動執行一次，只讀取一筆來觸發 Google 授權，不會新增行程。 */
function authorizeCalendar() {
  const props = PropertiesService.getScriptProperties();
  calendarService().Events.list(calendarId(props), {maxResults: 1});
  console.log('FLUX 行事曆授權完成。請將網頁應用程式部署為新版本。');
}
function calendarDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('請填入正確的行程日期。');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0,10) !== value) throw new Error('行程日期不存在。');
  return date;
}


// Files are sent directly to Drive in chunks; no binary data passes through this script.
function transferDrive(path, options) {
  const response=UrlFetchApp.fetch('https://www.googleapis.com/'+path,{method:'get',muteHttpExceptions:true,...options,headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken(),...(options?.headers||{})}});
  const code=response.getResponseCode();
  if(code<200||code>=300)throw new Error('Drive 連線失敗（HTTP '+code+'）。請確認 Drive 授權、API 啟用與儲存空間。');
  return response;
}
function transferFolder(props) {
  const id=props.getProperty('TRANSFER_FOLDER_ID');
  if(!id || !/^[A-Za-z0-9_-]{1,200}$/.test(id))throw new Error('請先在 Apps Script 執行 authorizeTransfers，建立私人互傳資料夾，再重新部署。');
  return id;
}
function authorizeTransfers() {
  const props=PropertiesService.getScriptProperties();
  const existing=props.getProperty('TRANSFER_FOLDER_ID');
  if(existing){transferDrive('drive/v3/files/'+encodeURIComponent(transferFolder(props))+'?fields=id');}
  else {
    const response=transferDrive('drive/v3/files?fields=id',{method:'post',contentType:'application/json',payload:JSON.stringify({name:'FLUX 中轉站',mimeType:'application/vnd.google-apps.folder'})});
    const folder=JSON.parse(response.getContentText());props.setProperty('TRANSFER_FOLDER_ID',folder.id);
  }
  console.log('私人互傳資料夾已就緒。請重新部署網頁應用程式為新版本。');
}
function listTransfers(request,props) {
  const folder=transferFolder(props);
  if(request.pageToken!==undefined&&(typeof request.pageToken!=='string'||request.pageToken.length>2048))throw new Error('清單分頁不正確。');
  const query="'"+folder+"' in parents and trashed = false and appProperties has { key='fluxTransfer' and value='1' }";
  const params='q='+encodeURIComponent(query)+'&pageSize=50&orderBy=createdTime%20desc&fields='+encodeURIComponent('nextPageToken,files(id,name,size,mimeType,createdTime,webContentLink,webViewLink)')+(request.pageToken?'&pageToken='+encodeURIComponent(request.pageToken):'');
  const data=JSON.parse(transferDrive('drive/v3/files?'+params).getContentText());
  return {ok:true,files:data.files||[],nextPageToken:data.nextPageToken||''};
}
function startTransfer(request,props) {
  const folder=transferFolder(props),file=request.file;
  if(!file||typeof file.name!=='string'||!file.name.trim()||file.name.length>240||/[\x00-\x1f]/.test(file.name)||!Number.isSafeInteger(file.size)||file.size<1||file.size>20*1024*1024*1024)throw new Error('請選擇 1 byte～20 GB 的檔案，檔名最多 240 字。');
  const mime=typeof file.type==='string'&&/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(file.type)&&!file.type.startsWith('application/vnd.google-apps.')?file.type:'application/octet-stream';
  const headers={'X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(file.size)};
  if(request.origin==='null'||(typeof request.origin==='string'&&/^https?:\/\/[^/\s?#]{1,250}$/.test(request.origin)))headers.Origin=request.origin;
  const response=transferDrive('upload/drive/v3/files?uploadType=resumable&fields=id,name,size',{method:'post',contentType:'application/json',headers,payload:JSON.stringify({name:file.name,parents:[folder],mimeType:mime,appProperties:{fluxTransfer:'1'}})});
  const responseHeaders=response.getAllHeaders(),key=Object.keys(responseHeaders).find(k=>k.toLowerCase()==='location');
  const uploadUrl=key&&String(responseHeaders[key]);
  if(!uploadUrl||!/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files(?:\?|\/)/.test(uploadUrl))throw new Error('Google 未提供有效的上傳連線。');
  return {ok:true,uploadUrl};
}
