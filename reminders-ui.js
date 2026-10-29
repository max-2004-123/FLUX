const model = window.FluxReminders;
const el = (tag, cls, text) => {const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
export function paper(note, {check,edit,desktop,close,pin,resize,remove,save,refresh,pinned=true} = {}) {
  const wrap=el('article','paper-wrap');wrap.dataset.noteId=note.id;
  const sheet=el('div','paper-note'),header=el('header','paper-header'),actions=el('div','paper-header-actions');
  header.append(el('span','paper-brand','FLUX'),el('span','','提醒便條'));
  const error=el('p','paper-error');error.hidden=true;error.setAttribute('role','status');
  const attempt=async fn=>{try{error.hidden=true;await fn();}catch(e){error.textContent=String(e.message||e).replace(/^Error invoking remote method '[^']+': Error: /,'');error.hidden=false;}};
  if(pin){const b=el('button','','釘住');b.type='button';b.setAttribute('aria-label','便條紙保持置頂');b.setAttribute('aria-pressed',String(pinned));b.addEventListener('click',()=>attempt(()=>pin(!pinned)));actions.append(b);}
  if(close){const b=el('button','','×');b.type='button';b.title='收起這張桌面便條，原筆記仍保留';b.setAttribute('aria-label','收起桌面便條');b.addEventListener('click',()=>attempt(close));actions.append(b);}
  if(remove){const b=el('button','','刪除');b.type='button';b.title='刪除便利貼，保留原始紀錄';b.setAttribute('aria-label','刪除便利貼');b.addEventListener('click',()=>attempt(remove));actions.append(b);}
  header.append(actions);
  const title=el('button','paper-title',model.clean(note.title)||'提醒事項');title.type='button';title.title='編輯這張便條';title.addEventListener('click',()=>startEdit());
  const list=el('div','paper-tasks'),tasks=model.tasks(note);
  for(const task of tasks){const row=el('label','paper-task'+(task.done?' is-done':'')),input=el('input');input.type='checkbox';input.checked=task.done;input.dataset.taskKey=task.key;row.append(input,el('span','',task.text));input.addEventListener('change',()=>{const done=input.checked;input.disabled=true;void attempt(async()=>{try{await check(task.key,done);row.classList.toggle('is-done',done);}catch(e){input.checked=!done;throw e;}finally{input.disabled=false;}});});list.append(row);}
  if(!tasks.length)list.append(el('p','paper-empty','點標題編輯原筆記，加入提醒內容。'));
  const footer=el('footer','paper-footer');footer.append(el('span','','# 提醒'));
  if(desktop){const b=el('button','','桌面 ↗');b.type='button';b.title='顯示這張桌面便條';b.addEventListener('click',()=>attempt(desktop));footer.append(b);}
  footer.append(el('small','',`${tasks.filter(t=>t.done).length} / ${tasks.length} 完成`));
  if(resize){
    const grip=el('button','paper-resize','◢');grip.type='button';
    grip.title='拖曳調整大小；方向鍵也可微調';grip.setAttribute('aria-label','調整便條大小');
    let drag;
    grip.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();drag={x:event.screenX,y:event.screenY,size:window.innerWidth};grip.setPointerCapture(event.pointerId);});
    grip.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.screenX-drag.x,dy=event.screenY-drag.y;void attempt(()=>resize(drag.size+(Math.abs(dx)>Math.abs(dy)?dx:dy)));});
    grip.addEventListener('pointerup',()=>{drag=undefined;});grip.addEventListener('lostpointercapture',()=>{drag=undefined;});
    grip.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();void attempt(()=>resize(window.innerWidth+(['ArrowLeft','ArrowUp'].includes(event.key)?-16:16)));});
    sheet.append(grip);
  }
  const editButton=el('button','paper-edit-button','編輯');editButton.type='button';editButton.setAttribute('aria-label','編輯便條內容');editButton.addEventListener('click',()=>startEdit());footer.prepend(editButton);
  function startEdit(){
    if(wrap.dataset.editing==='true')return;
    wrap.dataset.editing='true';title.hidden=true;list.hidden=true;footer.hidden=true;actions.querySelectorAll('button').forEach(b=>b.disabled=true);
    const form=el('form','paper-editor');
    const labelTitle=el('label','','標題'),titleInput=el('input','paper-edit-title');titleInput.value=note.title;titleInput.maxLength=160;titleInput.setAttribute('aria-label','便條標題');labelTitle.append(titleInput);
    const labelBody=el('label','paper-edit-body-label','內容（每行一項）'),bodyInput=el('textarea','paper-edit-body');bodyInput.value=note.body;bodyInput.maxLength=30000;bodyInput.required=true;bodyInput.setAttribute('aria-label','便條內容');labelBody.append(bodyInput);
    const buttons=el('div','paper-edit-actions'),cancel=el('button','','取消'),submit=el('button','paper-save','儲存');cancel.type='button';submit.type='submit';buttons.append(cancel,submit);form.append(labelTitle,labelBody,buttons);sheet.insertBefore(form,error);titleInput.focus();
    const finish=()=>{wrap.dataset.editing='false';form.remove();title.hidden=false;list.hidden=false;footer.hidden=false;actions.querySelectorAll('button').forEach(b=>b.disabled=false);void refresh?.();};
    cancel.addEventListener('click',()=>{if((titleInput.value!==note.title||bodyInput.value!==note.body)&&!window.confirm('放棄尚未儲存的便條修改？'))return;finish();});
    form.addEventListener('submit',event=>{event.preventDefault();if(!save)return;submit.disabled=true;void attempt(async()=>{try{await save({title:titleInput.value,body:bodyInput.value,originalTitle:note.title,originalBody:note.body});finish();}finally{submit.disabled=false;}});});
  }
  sheet.append(header,title,list,error,footer);wrap.append(el('span','paper-clip'),sheet);return wrap;
}
export function renderReminderBoard(notes, settings, actions) {
  const active=notes.filter(model.isReminder),grid=document.getElementById('reminder-notes');
  document.getElementById('reminder-count').textContent=`${active.length} 張`;
  document.getElementById('show-reminder-board').checked=settings.showReminderBoard;
  document.getElementById('desktop-sticky').checked=settings.desktopSticky;
  grid.hidden=!settings.showReminderBoard;
  document.getElementById('reminder-hint').hidden=!settings.showReminderBoard;
  document.getElementById('reminder-hint').textContent=active.length>12?'桌面同時顯示 12 張，其餘保留在此；按便條上的「桌面」可切換。':active.length?'有「提醒」標籤的筆記會自動出現在這裡；點「編輯」修改內容，每行可勾選完成。':'在筆記加上 #提醒，收錄後自動生成便條紙。';
  const editing=new Map([...grid.querySelectorAll('.paper-wrap[data-editing="true"]')].map(node=>[node.dataset.noteId,node]));
  // Keep a draft visible even if another update removes its source; saving will
  // report the conflict instead of silently discarding what the user typed.
  const cards=active.map(note=>editing.get(note.id)||paper(note,{check:(key,done)=>actions.check(note.id,key,done),edit:()=>actions.edit(note.id),desktop:()=>actions.desktop(note.id),save:input=>actions.save(note.id,input),refresh:actions.refresh,remove:actions.remove?()=>actions.remove(note.id):undefined}));
  for(const [id,node] of editing)if(!active.some(note=>note.id===id))cards.push(node);
  if(!editing.size)grid.replaceChildren(...cards);else{for(const node of cards)if(!node.isConnected)grid.append(node);for(const node of [...grid.children])if(!cards.includes(node))node.remove();}
}
export function mountSticky(api) {
  let running=false,again=false;
  async function refresh(){if(document.querySelector('#sticky-root .paper-wrap[data-editing="true"]'))return;if(running){again=true;return;}running=true;try{do{again=false;const state=await api.stickyState();document.getElementById('sticky-root').replaceChildren(paper(state.note,{check:(key,done)=>api.stickyCheck(key,done),edit:()=>api.stickyEdit(),save:input=>api.stickySave(input),refresh,close:()=>api.stickyClose(),remove:()=>api.stickyRemove(),pin:value=>api.stickyPin(value),resize:size=>api.stickyResize(size),pinned:state.pinned}));}while(again);}catch(e){const root=document.getElementById('sticky-root');root.textContent='便條暫時無法更新，請重新開啟桌面便條紙。';}finally{running=false;}}
  api.onChange(()=>void refresh());void refresh();
}
