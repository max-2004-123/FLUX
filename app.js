import {mountAdvice} from './model-advice-ui.js';
import {proposeEvent} from './calendar.js';
import {mountTransfers} from './transfer-ui.mjs';
import {transferRequest} from './transfer-core.mjs';
import {NotesStore, DATA_KEY, DEFAULT_MODEL, organize, synchronize, syncURL} from './core.js';
import {mountCalendar} from './calendar-ui.js';
const $ = id => document.getElementById(id);
const PREFS = 'flux.web.preferences.v1', SECRETS = 'flux.web.secrets.v1', DRAFT = 'flux.web.draft.v1';
let store, view = 'capture', selectedTag = '', editingId = null, editorDirty = false, syncBusy = false, toastTimer;
let settings = {model:DEFAULT_MODEL,autoAI:true,autoSync:true,syncUrl:'',remember:false,geminiKey:'',syncToken:''};
const working = new Set();
let aiQueue = Promise.resolve();
const transfers=mountTransfers({request:(action,payload)=>transferRequest(settings,action,payload),openLink:url=>window.open(url,'_blank','noopener,noreferrer')});
$('transfers-open').onclick=()=>transfers.open();$('transfers-nav').onclick=()=>transfers.open();
const adviceKey='flux.web.model-advice.v1';
function adviceHistory(){try{return JSON.parse(localStorage.getItem(adviceKey)||'[]').filter(x=>Date.parse(x.time)>Date.now()-14*86400000).slice(-200);}catch{return [];}}
function recordAdvice(task,body,model,start,outcome,usage){try{const rows=adviceHistory();rows.push(FluxModelAdvice.observation(task,body,model,Date.now()-start,outcome,usage));localStorage.setItem(adviceKey,JSON.stringify(rows.slice(-200)));}catch{}}
const advice=mountAdvice({history:async()=>adviceHistory(),clear:async()=>localStorage.removeItem(adviceKey)});
const calendar = mountCalendar({settings:()=>settings,toast,report,propose:async(note,connection)=>{const start=Date.now();let usage,outcome='error';try{const result=await proposeEvent(note,connection,fetch,new Date(),u=>usage=u);outcome='ok';return result;}finally{recordAdvice('calendarExtract',note.body,connection.model||DEFAULT_MODEL,start,outcome,usage);}}});
function toast(message, error = false, persistent = false) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.toggle('error',error); $('toast').hidden = false;
  if (!persistent) toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 9000 : 4200);
}
function report(error) { toast(error.message || '操作未完成，請再試一次。',true); }
function readSettings() {
  const prefs = JSON.parse(localStorage.getItem(PREFS) || '{}');
  const secrets = JSON.parse((prefs.remember ? localStorage : sessionStorage).getItem(SECRETS) || '{}');
  settings = {...settings,...prefs,geminiKey:String(secrets.geminiKey || ''),syncToken:String(secrets.syncToken || '')};
}
function fillSettings() {
  $('gemini-key').value = settings.geminiKey; $('model').value = settings.model;
  $('sync-url').value = settings.syncUrl; $('sync-token').value = settings.syncToken;
  $('auto-ai').checked = settings.autoAI; $('auto-sync').checked = settings.autoSync; $('remember-secrets').checked = settings.remember;
  $('last-sync').textContent = settings.lastSync ? `上次同步：${new Date(settings.lastSync).toLocaleString('zh-TW')}` : '尚未同步';
}
function saveSettings(event) {
  event.preventDefault();
  try {
    const next = {model:$('model').value.trim() || DEFAULT_MODEL, syncUrl:$('sync-url').value.trim(),autoAI:$('auto-ai').checked,autoSync:$('auto-sync').checked,remember:$('remember-secrets').checked,lastSync:settings.lastSync};
    if (!/^[A-Za-z0-9._-]+$/.test(next.model)) throw new Error('模型名稱格式不正確。');
    if (next.syncUrl) next.syncUrl = syncURL(next.syncUrl);
    const secrets = {geminiKey:$('gemini-key').value.trim(),syncToken:$('sync-token').value.trim()};
    if (secrets.syncToken && secrets.syncToken.length < 24) throw new Error('同步密語至少需要 24 字元，並須與 Apps Script 的設定相同。');
    const target = next.remember ? localStorage : sessionStorage;
    target.setItem(SECRETS,JSON.stringify(secrets));
    localStorage.setItem(PREFS,JSON.stringify(next));
    (next.remember ? sessionStorage : localStorage).removeItem(SECRETS);
    settings = {...next,...secrets};
    $('settings-saved').textContent = '設定已儲存'; setTimeout(()=>{$('settings-saved').textContent='';},4000);
    updateStatus(); toast('設定已儲存。');
  } catch (e) { report(e); }
}
function updateStatus() {
  $('network').textContent = navigator.onLine ? '已連線' : '離線可收錄'; $('network').classList.toggle('offline',!navigator.onLine);
  $('device-label').textContent = store ? '紀錄保存在這台裝置' : '裝置儲存無法使用';
  $('ai-capture-hint').textContent = settings.geminiKey ? (settings.autoAI ? '收錄後自動整理標題、摘要與標籤。隨時可以修改。' : '已連上 Gemini。開啟紀錄，按「AI 整理」即可。') : '連上 Gemini，讓標題、摘要與標籤自動成形。';
}
function switchView(next, focus = false) {
  view = ['capture','library','archive','trash','calendar','settings'].includes(next) ? next : 'capture';
  for (const name of ['capture','library','calendar','settings']) $('view-'+name).hidden = (['archive','trash'].includes(view) ? 'library' : view) !== name;
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active',b.dataset.view === view));
  const title = {capture:'快速收錄',library:'所有紀錄',archive:'封存紀錄',trash:'垃圾桶',calendar:'今日行程',settings:'設定與連線'}[view];
  $('breadcrumb').replaceChildren(document.createTextNode('工作區 '),Object.assign(document.createElement('span'),{textContent:'/'}),document.createTextNode(' '+title));
  $('library-title').firstChild.textContent = view === 'trash' ? '垃圾桶' : view === 'archive' ? '封存紀錄' : '所有紀錄';
  $('library-description').textContent = view === 'trash' ? '已刪除的紀錄可在這裡還原；刪除狀態會同步。' : view === 'archive' ? '留在這裡，需要時隨時還原。' : '每一個想法，都能接著往下走。';
  history.replaceState(null,'','#'+view);
  render();
  if(view === 'calendar')void calendar.refresh();
  if (focus) { window.scrollTo({top:0,behavior:'instant'}); if(view === 'capture') $('capture-body').focus(); }
}
function icon(name) { const s = document.createElementNS('http://www.w3.org/2000/svg','svg'); s.setAttribute('aria-hidden','true'); const u = document.createElementNS(s.namespaceURI,'use'); u.setAttribute('href','#i-'+name);s.append(u);return s; }
function el(tag, className, text) { const n = document.createElement(tag); if(className) n.className=className; if(text !== undefined) n.textContent=text;return n; }
const dateLabel = date => new Date(date).toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit'}).replace('/','.');
function card(note) {
  const b=el('button','note-card'); b.type='button'; b.dataset.noteId=note.id; b.setAttribute('aria-label','編輯：'+note.title);
  const top=el('div','note-top'),type=el('span','note-type'); type.append(icon(note.url?'link':'text'),document.createTextNode(note.url?'LINK':'THOUGHT')); top.append(type,el('span','',dateLabel(note.createdAt)));
  const bottom=el('div','note-bottom');
  note.tags.slice(0,3).forEach(t=>bottom.append(el('span','tag',t)));
  const status = working.has(note.id) ? ['整理中…','working'] : note.aiStatus === 'done' ? ['已整理',''] : note.aiStatus === 'error' ? ['整理未完成','error'] : ['待整理',''];
  bottom.append(el('span','note-ai '+status[1],status[0]));
  b.append(top,el('h3','',note.title),el('p','',note.summary || note.body),bottom);b.addEventListener('click',()=>openEditor(note.id));return b;
}
function empty(target, mode) {
  const box=el('div','empty');box.append(icon(mode==='archive'?'archive':'text'));
  const content = mode==='search' ? ['沒有找到相符紀錄','試試其他文字，或清除篩選。'] : mode==='archive' ? ['目前沒有封存紀錄','封存的紀錄會留在這裡。'] : ['第一個想法，從這裡開始。','寫下文字或貼上連結，按「收錄」即可留下。'];
  box.append(el('strong','',content[0]),el('p','',content[1]));
  if (mode==='search') {const b=el('button','text-button','清除篩選 ↗');b.addEventListener('click',()=>{$('search').value='';$('type-filter').value='all';selectedTag='';render();});box.append(b);}
  target.append(box);
}
function render() {
  if (!store) return;
  try {
    const notes=store.all().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)), active=notes.filter(n=>!n.archived&&!n.manual?.deleted);
    $('side-count').textContent=active.length; $('recent-count').textContent=String(active.length).padStart(2,'0');
    $('recent-list').replaceChildren(...active.slice(0,3).map(card)); if(!active.length)empty($('recent-list'),'new');
    if(!['library','archive','trash'].includes(view))return;
    let matches=notes.filter(n=>view==='trash'?Boolean(n.manual?.deleted):!n.manual?.deleted && n.archived === (view==='archive'));
    $('library-count').textContent=String(matches.length).padStart(2,'0');
    const tags=[...new Set(matches.flatMap(n=>n.tags))].sort((a,b)=>a.localeCompare(b));
    if(!tags.includes(selectedTag))selectedTag='';
    $('tag-filters').replaceChildren();
    if(tags.length){for(const tag of ['',...tags]) {const b=el('button',selectedTag===tag?'active':'',tag||'全部標籤');b.setAttribute('aria-pressed',String(selectedTag===tag));b.addEventListener('click',()=>{selectedTag=tag;render();});$('tag-filters').append(b);}}
    const q=$('search').value.trim().toLocaleLowerCase(),type=$('type-filter').value;
    matches=matches.filter(n=>(!q || [n.body,n.title,n.summary,...n.tags].join('\n').toLocaleLowerCase().includes(q)) && (!selectedTag || n.tags.includes(selectedTag)) && (type==='all' || type==='link'&&n.url || type==='text'&&!n.url || type==='pending'&&n.aiStatus!=='done'));
    $('library-list').replaceChildren(...matches.map(card));
    if(!matches.length)empty($('library-list'),q||selectedTag||type!=='all'?'search':view==='archive'?'archive':'new');
  } catch(e){report(e);}
}
function draftCount(){ $('char-count').textContent=$('capture-body').value.length.toLocaleString(); }
function saveDraft(){draftCount();try{localStorage.setItem(DRAFT,$('capture-body').value);}catch{/* Capture still reports a failure if durable storage is unavailable. */}}
function capture(event) {
  event.preventDefault(); if(!store)return;
  try{
    const n=store.save({body:$('capture-body').value});$('capture-body').value='';try{localStorage.removeItem(DRAFT);}catch{}draftCount();render();toast('已收錄。');calendar.offer(n);
    if(settings.autoAI && settings.geminiKey && navigator.onLine) queueAI(n);
    if(settings.autoSync && settings.syncUrl && settings.syncToken && navigator.onLine) void sync(true);
  }catch(e){report(e);}
}
function fillEditor(note){
  $('edit-title').value=note.title;$('edit-body').value=note.body;$('edit-summary').value=note.summary;$('edit-tags').value=note.tags.join('，');
  $('delete-note').textContent=note.manual?.deleted?'還原紀錄':'刪除紀錄';$('archive-note').hidden=Boolean(note.manual?.deleted);
  $('archive-note').textContent=note.archived?'還原紀錄':'封存';$('ai-note').disabled=working.has(note.id)||note.archived;$('ai-note').textContent=working.has(note.id)?'整理中…':'AI 整理';$('calendar-note').disabled=note.archived;
  const p=$('editor-meta');p.replaceChildren(document.createTextNode(`建立於 ${new Date(note.createdAt).toLocaleString('zh-TW')} · ${note.dirty?'待同步':'已同步'}`));
  if(note.url){const a=el('a','text-link','開啟原始連結 ↗');a.href=note.url;a.target='_blank';a.rel='noopener noreferrer';p.append(document.createElement('br'),a);}
  if(note.aiError)p.append(document.createElement('br'),document.createTextNode(note.aiError));editorDirty=false;
}
function openEditor(id){try{const n=store.get(id);if(!n)return;editingId=id;fillEditor(n);$('note-dialog').showModal();}catch(e){report(e);}}
function saveEditor(){
  if(!editingId)return;
  return store.save({id:editingId,body:$('edit-body').value,title:$('edit-title').value,summary:$('edit-summary').value,tags:$('edit-tags').value});
}
function closeEditor(){if(editorDirty && !confirm('尚未儲存修改，要先關閉嗎？'))return;$('note-dialog').close();editingId=null;editorDirty=false;}
function queueAI(snapshot){
  if(working.has(snapshot.id))return;
  working.add(snapshot.id);render();
  if(editingId===snapshot.id)$('ai-note').disabled=true;
  const connection={...settings};
  aiQueue=aiQueue.then(async()=>{
    const latest=store.get(snapshot.id);if(!latest || latest.body!==snapshot.body || latest.archived)return;
    let usage,outcome='error';const started=Date.now();
    try{const result=await organize(snapshot,connection,fetch,u=>usage=u);outcome='ok';const applied=store.applyAI(snapshot,result);if(applied){toast('AI 整理完成。');calendar.offer(store.get(snapshot.id));}}
    catch(e){const n=store.get(snapshot.id);if(n && n.body===snapshot.body && !n.archived)store.change(n.id,{aiStatus:'error',aiError:e.message});report(e);}
    finally{recordAdvice('organize',snapshot.body,connection.model||DEFAULT_MODEL,started,outcome,usage);}
  }).catch(report).finally(()=>{
    working.delete(snapshot.id);render();if(editingId===snapshot.id && !editorDirty){const n=store.get(snapshot.id);if(n)fillEditor(n);}else if(editingId===snapshot.id)$('ai-note').disabled=false;
    if(settings.autoSync && settings.syncUrl && settings.syncToken && navigator.onLine)void sync(true);
  });
}
async function sync(quiet=false){
  if(syncBusy || !store)return;
  if(!navigator.onLine){if(!quiet)toast('目前離線，連網後再同步。',true);return;}
  if(!settings.syncUrl || !settings.syncToken){if(!quiet){switchView('settings',true);toast('先填入 Google 同步網址與密語。');}return;}
  syncBusy=true;$('sync-button').disabled=true;$('sync-button').classList.add('spinning');
  let copies=0;
  try{
    for(let batch=0;batch<10;batch++){
      const pending=store.all().filter(n=>n.dirty).slice(0,100),data=await synchronize(pending,{...settings});copies+=store.merge(pending,data);
      if(!store.all().some(n=>n.dirty))break;
      // Stop if a server returns no progress instead of looping forever.
      if(!data.accepted.length && !data.conflicts.length)break;
    }
    settings.lastSync=new Date().toISOString();
    const {geminiKey,syncToken,...prefs}=settings;localStorage.setItem(PREFS,JSON.stringify(prefs));
    $('last-sync').textContent=`上次同步：${new Date(settings.lastSync).toLocaleString('zh-TW')}`;
    const remaining=store.all().filter(n=>n.dirty).length;
    if(copies)toast(`同步完成，已保留 ${copies} 份衝突副本。`);
    else if(remaining)toast(`已同步，還有 ${remaining} 則變更待同步。`);
    else if(!quiet)toast('同步完成。');
    render();
  }catch(e){report(e);}finally{syncBusy=false;$('sync-button').disabled=false;$('sync-button').classList.remove('spinning');}
}
function exportNotes(){
  try{
    // Export raw data even when corrupt, allowing recovery without overwriting it.
    const raw=store ? JSON.stringify({schema:1,notes:store.all()},null,2) : localStorage.getItem(DATA_KEY);
    if(!raw)throw new Error('目前沒有可匯出的紀錄。');
    const u=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=el('a');a.href=u;a.download=`FLUX-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);
  }catch(e){report(e);}
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view,true)));
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();switchView('capture',true);});
$('capture-form').addEventListener('submit',capture);$('capture-body').addEventListener('input',saveDraft);
$('capture-body').addEventListener('keydown',e=>{if(!e.isComposing&&(e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('capture-form').requestSubmit();}});
document.addEventListener('keydown',e=>{if(!e.isComposing&&e.key.toLowerCase()==='n'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!$('note-dialog').open&&!$('event-dialog').open){e.preventDefault();switchView('capture',true);}});
$('search').addEventListener('input',render);$('type-filter').addEventListener('change',render);$('settings-form').addEventListener('submit',saveSettings);
$('sync-button').addEventListener('click',()=>void sync());
document.querySelectorAll('[data-reveal]').forEach(b=>b.addEventListener('click',()=>{const i=$(b.dataset.reveal),show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'隱藏':'顯示';b.setAttribute('aria-label',(show?'隱藏':'顯示')+(i.id==='gemini-key'?' API 金鑰':'同步密語'));}));
$('forget-secrets').addEventListener('click',()=>{try{localStorage.removeItem(SECRETS);sessionStorage.removeItem(SECRETS);settings.geminiKey='';settings.syncToken='';$('gemini-key').value='';$('sync-token').value='';updateStatus();toast('連線密鑰已清除，紀錄仍保留。');}catch(e){report(e);}});
$('close-dialog').addEventListener('click',closeEditor);$('note-dialog').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
$('edit-form').addEventListener('input',()=>{editorDirty=true;});
$('edit-form').addEventListener('submit',e=>{e.preventDefault();try{const saved=saveEditor();editorDirty=false;closeEditor();render();toast('修改已儲存。');calendar.offer(saved);if(settings.autoSync&&navigator.onLine)void sync(true);}catch(error){report(error);}});
$('delete-note').addEventListener('click',()=>{try{const n=store.get(editingId);if(!n)return;store.trash(n.id,!n.manual?.deleted);editorDirty=false;closeEditor();render();toast(n.manual?.deleted?'紀錄已還原。':'已移到垃圾桶，可隨時還原。');if(settings.autoSync&&navigator.onLine)void sync(true);}catch(e){report(e);}});
$('archive-note').addEventListener('click',()=>{try{const n=saveEditor();if(!n)return;store.change(n.id,{archived:!n.archived});editorDirty=false;closeEditor();render();toast(n.archived?'紀錄已還原。':'紀錄已封存，可在封存頁還原。');if(settings.autoSync&&navigator.onLine)void sync(true);}catch(e){report(e);}});
$('ai-note').addEventListener('click',()=>{if(!settings.geminiKey){toast('先到設定貼上 Gemini API 金鑰。',true);return;}if(!navigator.onLine){toast('AI 整理需要網路連線。',true);return;}try{const n=saveEditor();if(n){fillEditor(n);queueAI(n);toast('原文已保存，開始整理。');}}catch(e){report(e);}});
$('calendar-note').addEventListener('click',()=>{try{const n=saveEditor();if(!n)return;editorDirty=false;closeEditor();render();calendar.open(n);if(settings.autoSync&&navigator.onLine)void sync(true);}catch(e){report(e);}});
$('export-button').addEventListener('click',exportNotes);$('import-button').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async()=>{const f=$('import-file').files[0];if(!f||!store)return;try{if(f.size>20000000)throw new Error('備份檔超過 20 MB，請分批匯入。');const n=store.import(JSON.parse(await f.text()));render();toast(`已匯入 ${n} 則紀錄。`);}catch(e){report(e);}finally{$('import-file').value='';}});
window.addEventListener('online',()=>{updateStatus();if(settings.autoSync)void sync(true);});window.addEventListener('offline',updateStatus);
window.addEventListener('storage',e=>{if(e.key===DATA_KEY)render();if(e.key===PREFS||e.key===SECRETS){try{readSettings();updateStatus();}catch(error){report(error);}}});
window.addEventListener('hashchange',()=>switchView(location.hash.slice(1)));
try{store=new NotesStore(localStorage);}catch(e){document.body.classList.add('storage-error');$('capture-form').querySelector('button').disabled=true;$('import-button').disabled=true;toast(e.message,true,true);}
try{readSettings();}catch{toast('連線設定無法讀取，請重新填入；紀錄仍保留。',true);}
fillSettings();updateStatus();
try{$('capture-body').value=localStorage.getItem(DRAFT)||'';}catch{}draftCount();
const query=new URLSearchParams(location.search),shared=[query.get('title'),query.get('text'),query.get('url')].filter(Boolean).join('\n');
if(shared){$('capture-body').value=[$('capture-body').value,shared].filter(Boolean).join('\n\n').slice(0,30000);saveDraft();history.replaceState(null,'',location.pathname+'#capture');}
switchView(location.hash.slice(1)||'capture');
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{toast('離線模式尚未啟用，請保持連網使用。',true);});
if(settings.autoSync&&settings.syncUrl&&settings.syncToken&&navigator.onLine)void sync(true);
