const rules=globalThis.FluxModelAdvice;
export function mountAdvice({history,clear}) {
 const text=document.getElementById('advice-input'),task=document.getElementById('advice-task'),output=document.getElementById('advice-preview'),list=document.getElementById('advice-history');
 function preview(){const a=rules.advise(task.value,text.value);output.textContent=`建議：${rules.label(a.tier)}。${a.reason}`;}
 async function show(){try{const items=await history();list.replaceChildren();if(!items.length){list.textContent='目前沒有觀察紀錄。';return;}for(const item of items.slice(-10).reverse()){const row=document.createElement('li');const taskName=item.task==='calendarExtract'?'行程擷取':'整理筆記';const reasons={'url-only':'只有網址，未讀取網頁','complex-format':'長文或多列表格，需確認','calendar':'行程擷取','organize':'標題、摘要與標籤','unknown-task':'未設定規則','empty':'內容不足'};const tokens=item.inputTokens===null?'用量未提供':`輸入 ${item.inputTokens}／輸出 ${item.outputTokens??'未知'} tokens`;row.textContent=`${new Date(item.time).toLocaleString('zh-TW')} · ${taskName} · 建議 ${rules.label(item.tier)}（${reasons[item.code]||'其他'}） · 實際 ${item.model} · ${item.outcome} · ${item.durationMs} 毫秒 · ${tokens}`;list.append(row);}}catch{list.textContent='無法讀取觀察紀錄。';}}
 text.addEventListener('input',preview);task.addEventListener('change',preview);
 document.getElementById('advice-refresh').addEventListener('click',()=>void show());
 document.getElementById('advice-clear').addEventListener('click',async()=>{await clear();await show();});
 document.querySelector('.model-advice-panel').addEventListener('toggle',()=>void show());
 preview();void show();return {show};
}
