import {deviceTimeZone, localInput, localDate, parseLocal, dayRange, eventPayload, calendarLink, calendarRequest, proposeEvent, hasCalendarTag} from './calendar.js';
export function mountCalendar({settings,toast,report,request=calendarRequest,propose=proposeEvent,connected=()=>!!(settings().syncUrl&&settings().syncToken),openLink,onOffer}) {
  const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  let source=null,dirty=false,sending=false,aiBusy=false,revision=0,generation=0,loadId=0,events=[],nextPage='',loadedDate='';
  $('agenda-date').value=localDate();$('agenda-zone').textContent=`日期與時間依這台裝置的時區：${deviceTimeZone()}。`;
  function link(event){const href=calendarLink(event.htmlLink);if(!href)return null;const a=make('a','text-link','在 Google 查看 ↗');a.href=href;a.target='_blank';a.rel='noopener noreferrer';if(openLink)a.addEventListener('click',e=>{e.preventDefault();Promise.resolve(openLink(href)).catch(report);});return a;}
  function timeLabel(event){
    if(event.allDay)return '全天';
    if(event.endTimeUnspecified)return new Date(event.start.dateTime).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})+' 起';
    const options={hour:'2-digit',minute:'2-digit',hour12:false},start=new Date(event.start?.dateTime),end=new Date(event.end?.dateTime);
    if(!Number.isFinite(+start)||!Number.isFinite(+end))return '時間待確認';
    const fmt=d=>d.toLocaleTimeString('zh-TW',options);
    return localDate(start)===localDate(end)?`${fmt(start)} – ${fmt(end)}`:`${start.toLocaleString('zh-TW', {...options,month:'2-digit',day:'2-digit'})} – ${end.toLocaleString('zh-TW',{...options,month:'2-digit',day:'2-digit'})}`;
  }
  function renderAgenda(){
    $('agenda-list').replaceChildren();
    for(const event of events){const row=make('article','agenda-item'),time=make('div','agenda-time',timeLabel(event)),body=make('div','agenda-body');body.append(make('h2','',event.title));if(event.location)body.append(make('p','',event.location));const a=link(event);if(a)body.append(a);row.append(time,body);$('agenda-list').append(row);}
    if(!events.length){const empty=make('div','empty');empty.append(make('strong','','這一天還沒有行程。'),make('p','','回到紀錄，將下一個想法排進時間裡。'));$('agenda-list').append(empty);}
    $('agenda-more').hidden=!nextPage;
  }
  async function refresh(more=false){
    const thisLoad=++loadId,day=$('agenda-date').value;
    $('agenda-refresh').disabled=false;$('agenda-more').disabled=false;
    if(!more||day!==loadedDate){events=[];nextPage='';$('agenda-list').replaceChildren();$('agenda-more').hidden=true;}
    if(!connected()){$('agenda-status').textContent='先在「設定」填入 Apps Script 網址與同步密語，並啟用行事曆服務。';return;}
    if(!navigator.onLine){$('agenda-status').textContent='目前離線，讀取行程需要網路。';return;}
    $('agenda-refresh').disabled=true;$('agenda-more').disabled=true;$('agenda-status').textContent='正在讀取 Google 行事曆…';
    try{
      const data=await request('calendar.list',{...dayRange(day),...(more&&nextPage?{pageToken:nextPage}:{})},settings());
      if(thisLoad!==loadId)return;
      for(const event of data.events){if(!event||typeof event.id!=='string'||typeof event.title!=='string'||!event.start||!event.end)throw new Error('行程資料不完整，請更新 Apps Script。');}
      events=more?[...events,...data.events.filter(e=>!events.some(old=>old.id===e.id))]:data.events;
      nextPage=data.nextPageToken;loadedDate=day;renderAgenda();
      $('agenda-status').textContent=`${data.calendarName||'Google 行事曆'} · ${events.length} 則${nextPage?'（還有更多）':''} · ${new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})} 更新`;
    }catch(e){if(thisLoad===loadId){$('agenda-status').textContent=e.message;report(e);}}
    finally{if(thisLoad===loadId){$('agenda-refresh').disabled=false;$('agenda-more').disabled=false;}}
  }
  function setDateMode(allDay){
    for(const id of ['event-start','event-end']){const n=$(id),before=n.value;n.type=allDay?'date':'datetime-local';n.value=allDay?before.slice(0,10):(before.length>10?before:'');}
    $('event-start-label').textContent=allDay?'日期':'開始時間';$('event-end-label').textContent=allDay?'結束日期（選填，含當天）':'結束時間（選填）';
    $('event-warning').textContent=allDay?'只填日期即可；結束日期留空會建立當天的全天行程。':'結束時間可留空。Google 相容用的結束值會以一小時後傳送，並標記為未指定結束。';
  }
  function open(note){
    source=note;dirty=false;sending=false;aiBusy=false;revision=0;generation++;
    $('event-all-day').checked=false;setDateMode(false);$('event-title').value=note.title;$('event-description').value=note.body;$('event-location').value='';$('event-start').value='';$('event-end').value='';
    $('event-zone').textContent=`時間依這台裝置的時區：${deviceTimeZone()}。`;$('event-warning').textContent='結束時間選填；只有日期可勾選全天。不填結束時間時，Google 仍需相容用的結束值，會以一小時後傳送並標記為未指定結束。';
    $('event-result').hidden=true;$('event-result').replaceChildren();$('event-fields').disabled=false;$('event-submit').disabled=false;$('event-ai').disabled=false;$('event-ai').textContent='AI 帶入草稿';$('event-submit').textContent='確認新增';$('event-dialog').showModal();
  }
  function close(){if(sending){toast('正在送出，請稍候。');return;}if(dirty&&!confirm('行程草稿尚未送出，要先關閉嗎？'))return;generation++;$('event-dialog').close();source=null;}
  $('event-close').addEventListener('click',close);$('event-dialog').addEventListener('cancel',e=>{e.preventDefault();close();});
  $('event-form').addEventListener('input',()=>{dirty=true;revision++;});
  $('event-all-day').addEventListener('change',()=>setDateMode($('event-all-day').checked));
  $('event-ai').addEventListener('click',async()=>{
    if(aiBusy||sending||!source)return;if(!navigator.onLine){toast('AI 草稿需要網路，也可手動填寫。',true);return;}
    aiBusy=true;$('event-ai').disabled=true;$('event-submit').disabled=true;$('event-ai').textContent='提取中…';
    const opened=generation,before=revision,note=source;
    try{const draft=await propose(note,settings());if(opened!==generation)return;if(before!==revision){$('event-warning').textContent='你已修改草稿，因此保留目前輸入，未套用 AI 結果。';return;}
      $('event-all-day').checked=draft.start.length===10;setDateMode($('event-all-day').checked);$('event-title').value=draft.title||note.title;$('event-start').value=draft.start;$('event-end').value=draft.end;$('event-location').value=draft.location;$('event-description').value=draft.description||note.body;
      $('event-warning').textContent=draft.warning||'AI 草稿已帶入，請確認日期與時區；結束時間可以留空。';dirty=true;revision++;
    }catch(e){if(opened===generation){$('event-warning').textContent=e.message;report(e);}}
    finally{if(opened===generation){aiBusy=false;$('event-ai').disabled=false;$('event-submit').disabled=false;$('event-ai').textContent='AI 帶入草稿';}}
  });
  $('event-form').addEventListener('submit',async e=>{
    e.preventDefault();if(sending||aiBusy||!source)return;if(!navigator.onLine){toast('新增 Google 行程需要網路，草稿仍在此處。',true);return;}
    let event;try{event=eventPayload({allDay:$('event-all-day').checked,title:$('event-title').value,start:$('event-start').value,end:$('event-end').value,location:$('event-location').value,description:$('event-description').value});}catch(error){report(error);return;}
    sending=true;$('event-fields').disabled=true;$('event-submit').disabled=true;$('event-ai').disabled=true;$('event-submit').textContent='新增中…';
    try{const result=await request('calendar.create',{noteId:source.id,event},settings());dirty=false;
      const box=$('event-result');box.replaceChildren(make('strong','',result.reused?'這則筆記已有行程，未重複新增。':'已加入 Google 行事曆。'),make('p','',result.event.title));
      box.append(make('p','',`${result.event.allDay?result.event.start.date:new Date(result.event.start.dateTime).toLocaleString('zh-TW')} · ${timeLabel(result.event)}`));const a=link(result.event);if(a)box.append(a);box.hidden=false;
      $('event-warning').textContent=result.reused?'顯示既有的 Google 行程。若要調整，請按「在 Google 查看」。':'行程已建立，Google 行事曆會依你的設定顯示提醒。';$('event-submit').textContent='已完成';
      toast(result.reused?'已找到既有行程，未重複建立。':'行程已新增。');
    }catch(error){$('event-warning').textContent=error.message;report(error);$('event-fields').disabled=false;$('event-submit').disabled=false;$('event-ai').disabled=false;$('event-submit').textContent='確認新增';}
    finally{sending=false;}
  });
  $('agenda-refresh').addEventListener('click',()=>void refresh());$('agenda-more').addEventListener('click',()=>void refresh(true));$('agenda-date').addEventListener('change',()=>void refresh());$('agenda-today').addEventListener('click',()=>{$('agenda-date').value=localDate();void refresh();});
  let offered;try{offered=new Set(JSON.parse(localStorage.getItem('flux.calendar.offered.v1')||'[]'));}catch{offered=new Set();}
  const pending=new Map();
  function pump(){if(document.querySelector('dialog[open]'))return;const note=pending.values().next().value;if(!note)return;pending.delete(note.id);offered.add(note.id);try{localStorage.setItem('flux.calendar.offered.v1',JSON.stringify([...offered]));}catch{}open(note);if(onOffer)Promise.resolve(onOffer()).catch(report);if((settings().geminiKey||settings().hasGeminiKey)&&navigator.onLine)$('event-ai').click();}
  function offer(note){if(!hasCalendarTag(note)||offered.has(note.id))return;pending.set(note.id,note);pump();}
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>queueMicrotask(pump)));
  return {open,refresh,offer};
}
