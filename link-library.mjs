const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export const isDigest=n=>Array.isArray(n.manual?.fluxDigestSources)||Boolean(n.tags?.includes('連結小報'));
export const isLinkCollection=n=>Boolean(n.url)||isDigest(n);
export function linkGroups(notes,tab='links',query=''){
 const q=query.trim().toLocaleLowerCase(),groups=new Map();
 for(const n of notes.filter(n=>!n.archived&&!n.manual?.deleted&&(tab==='digests'?isDigest(n):Boolean(n.url)&&!isDigest(n))&&(!q||[n.title,n.body,n.summary,...(n.tags||[])].join(' ').toLocaleLowerCase().includes(q))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))){
  const date=new Date(n.createdAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});
  if(!groups.has(date))groups.set(date,[]);groups.get(date).push(n);
 }
 return groups;
}
export function mountLinkLibrary({root,getNotes,edit,openLink,report}){
 let tab='links';
 const heading=el('div','link-heading');heading.append(el('p','link-eyebrow','READ. COLLECT. CONNECT.'),el('h2','','連結收藏／每日小報'),el('p','','手機分享與其他收藏，集中在這裡；按日期展開閱讀。'));
 const toolbar=el('div','link-toolbar'),tabs=el('div','link-tabs'),links=el('button','','連結收藏'),digests=el('button','','每日小報'),search=el('input');
 search.type='search';search.placeholder='搜尋標題、網址或內容';search.setAttribute('aria-label','搜尋連結收藏與小報');
 tabs.append(links,digests);toolbar.append(tabs,search);
 const hint=el('p','link-hint',''),list=el('div','link-groups');
 const setup=el('details','link-setup');setup.append(el('summary','','每日小報如何產生？'),el('p','','沿用手機捷徑與雲端每日小報。需先在 Apps Script 設定雲端 Gemini 金鑰，並執行 enableFluxDailyDigest；啟用後每日台灣時間 21～22 時整理最多 10 個新連結，剩餘留待下次。同步後即可在這裡閱讀；本頁不代表排程已啟用。'),el('p','','收藏原文會保留。無法讀取的網站會標示待補充；舊收藏不會因開啟本頁而自動送給 AI。'));
 root.append(heading,toolbar,hint,list,setup);
 const run=fn=>Promise.resolve().then(fn).catch(report);
 links.onclick=()=>{tab='links';render();};digests.onclick=()=>{tab='digests';render();};search.oninput=()=>render();
 function render(){
  const notes=getNotes()||[],groups=linkGroups(notes,tab,search.value),processed=new Set(notes.flatMap(n=>n.manual?.fluxDigestSources||[]));
  const expanded=new Set([...list.querySelectorAll('details[open]')].map(n=>n.dataset.key));
  links.setAttribute('aria-pressed',String(tab==='links'));digests.setAttribute('aria-pressed',String(tab==='digests'));
  const count=[...groups.values()].reduce((sum,rows)=>sum+rows.length,0);
  hint.textContent=tab==='links'?`${count} 個收藏 · 原始連結保留在這裡，不佔主頁卡片空間。`:`${count} 篇小報 · 同步後顯示已產生的小報，點開即可閱讀介紹與來源。`;
  const firstRender=list.dataset.tab!==tab;list.dataset.tab=tab;list.replaceChildren();
  let index=0;
  for(const [date,rows] of groups){
   const group=el('details','link-day');group.dataset.key=tab+date;group.open=expanded.has(group.dataset.key)||(firstRender&&index===0);index++;
   group.append(el('summary','',`${date} · ${rows.length} ${tab==='links'?'個連結':'篇小報'}`));
   for(const n of rows){
    const row=el('article','link-entry');row.dataset.noteId=n.id;
    const title=el('h3','',n.title||n.url||'未命名');row.append(title);
    if(tab==='digests'){const reading=el('details','digest-reading');reading.append(el('summary','','閱讀今日介紹'),el('div','digest-body',n.body));row.append(reading);}
    else {row.append(el('p','link-description',n.summary||'尚無介紹，可在每日小報閱讀彙整。'),el('small','link-url',n.url),el('small','link-state',processed.has(n.id)?'已收錄至小報':'尚無對應小報'));}
    const actions=el('div','link-actions'),editButton=el('button','',tab==='digests'?'編輯小報':'編輯收藏');editButton.onclick=()=>run(()=>edit(n.id));actions.append(editButton);
    const urls=tab==='digests'?[...new Set([...(n.body||'').matchAll(/https?:\/\/[^\s<>"'）)]+/g)].map(m=>m[0]))]:[n.url];
    for(const [i,url] of urls.entries()){try{if(!['http:','https:'].includes(new URL(url).protocol))continue;}catch{continue;}const b=el('button','',tab==='digests'?`來源 ${i+1} ↗`:'開啟原文 ↗');b.title=url;b.onclick=()=>run(()=>openLink(url));actions.append(b);}
    row.append(actions);group.append(row);
   }
   list.append(group);
  }
  if(!count)list.append(el('p','link-empty',search.value?'沒有符合的內容，試試其他關鍵字。':tab==='links'?'還沒有收藏。用手機捷徑分享連結後，按同步即可在這裡查看。':'還沒有小報。若已啟用雲端排程，請在產生後按同步；設定方式見下方說明。'));
 }
 return {render};
}
