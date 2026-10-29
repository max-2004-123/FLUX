import './reminders.js';
import {paper} from './reminders-ui.js';
const model=globalThis.FluxReminders;
const preference='flux.web.reminder-board.v1';
export function mountReminders({getStore,changed,report}) {
  const grid=document.getElementById('reminder-notes'),toggle=document.getElementById('show-reminder-board');
  try{toggle.checked=localStorage.getItem(preference)!=='hidden';}catch{}
  toggle.addEventListener('change',()=>{try{localStorage.setItem(preference,toggle.checked?'visible':'hidden');render();}catch(e){report(e);}});
  function active(id){const note=getStore().get(id);if(!model.isReminder(note))throw new Error('便條已更新或移除，請重新開啟原紀錄。');return note;}
  function render(){
    const store=getStore();if(!store)return;
    const notes=store.all().filter(model.isReminder).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    document.getElementById('reminder-count').textContent=notes.length+' 張';grid.hidden=!toggle.checked;
    document.getElementById('reminder-hint').hidden=!toggle.checked;
    document.getElementById('reminder-hint').textContent=notes.length?'點「編輯」修改內容，每行可勾選完成。移除便條仍會保留原紀錄。':'收錄時加上 #提醒，每行一項，就會出現在這裡。';
    const editing=new Map([...grid.querySelectorAll('[data-editing="true"]')].map(n=>[n.dataset.noteId,n]));
    const cards=notes.map(note=>editing.get(note.id)||paper(note,{
      check(key,done){const latest=active(note.id);store.change(note.id,{manual:model.checkedManual(latest,key,done)});changed();},
      remove(){const latest=active(note.id);store.change(note.id,{manual:{...latest.manual,reminderRemoved:true}});changed();},
      save(input){const latest=active(note.id);if(latest.body!==input.originalBody||latest.title!==input.originalTitle)throw new Error('這則紀錄已在其他地方修改。請保留草稿，取消後重新開啟。');store.save({id:note.id,title:input.title,body:input.body});changed();},
      refresh:render
    }));
    for(const [id,node] of editing)if(!notes.some(n=>n.id===id))cards.push(node);
    // Preserve live editor nodes so sync updates cannot erase a draft or focus.
    for(const node of [...grid.children])if(!cards.includes(node))node.remove();
    for(const node of cards)if(node.parentNode!==grid)grid.append(node);
  }
  return {render};
}
