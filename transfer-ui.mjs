import {uploadChunks,sizeLabel,safeDriveLink} from './transfer-core.mjs';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function mountTransfers({request,openLink}){
 const dialog=node('dialog','flux-transfer'),header=node('header','transfer-heading'),heading=node('div');
 heading.append(node('small','','YOUR DEVICES. ONE INBOX.'),node('h2','','設備互傳'),node('p','','把檔案放進來，在另一台設備接著用。'));
 const close=node('button','transfer-close','×');close.type='button';close.setAttribute('aria-label','關閉互傳視窗');close.onclick=()=>dialog.close();header.append(heading,close);
 const drop=node('div','transfer-drop'),pick=node('button','transfer-pick','＋ 選擇檔案'),input=node('input');input.type='file';input.multiple=true;input.hidden=true;
 drop.append(node('strong','','拖曳檔案到這裡'),node('p','','照片、文件、影片、ZIP · 單檔最高 20 GB'),pick,input);
 const note=node('p','transfer-note','檔案保留在私人 Drive。手機上傳時請保持頁面開啟；切換 App 或鎖屏可能中斷，可回來按「繼續」。');
 const jobsRoot=node('div','transfer-jobs'),toolbar=node('div','transfer-toolbar'),refresh=node('button','','重新整理'),label=node('h3','','共用收件匣');
 toolbar.append(label,refresh);const status=node('p','transfer-status');status.setAttribute('role','status');const list=node('div','transfer-list'),more=node('button','transfer-more','載入更多');more.hidden=true;
 const hint=node('p','transfer-note','清單只在開啟視窗或按「重新整理」時更新。兩台設備請使用相同的 Apps Script 網址與同步密語。下載會開啟 Google Drive，請登入同一個 Google 帳號。');
 dialog.append(header,drop,note,jobsRoot,toolbar,status,list,more,hint);document.body.append(dialog);
 const jobs=[];let running=false,pageToken='',loading=false;
 const errorText=e=>String(e.message||e).replace(/^Error invoking remote method '[^']+': Error: /,'');
 const link=(text,url)=>{const b=node('button','',text);b.onclick=()=>openLink(url);return b;};
 async function load(append=false){if(loading)return;loading=true;refresh.disabled=true;more.disabled=true;status.textContent='讀取清單中…';
  try{const data=await request('transfer.list',append?{pageToken}:{});if(!Array.isArray(data.files))throw new Error('請更新 Apps Script 至支援互傳的版本。');if(!append)list.replaceChildren();
   for(const f of data.files){const row=node('article','transfer-file'),info=node('div');info.append(node('strong','',f.name||'未命名檔案'),node('small','',sizeLabel(Number(f.size)||0)+' · '+new Date(f.createdTime).toLocaleString('zh-TW')));row.append(info);const actions=node('div','transfer-file-actions');const view=safeDriveLink(f.webViewLink),download=safeDriveLink(f.webContentLink);if(view)actions.append(link('開啟',view));if(download)actions.append(link('下載',download));row.append(actions);list.append(row);}
   pageToken=data.nextPageToken||'';more.hidden=!pageToken;status.textContent=list.children.length?'已更新 · 檔案不會自動刪除':'尚無檔案。從這台設備上傳第一個檔案。';
  }catch(e){status.textContent=errorText(e);}finally{loading=false;refresh.disabled=false;more.disabled=false;}}
 function renderJob(job){job.progress.value=job.sent;job.detail.textContent=job.message+' · '+sizeLabel(job.sent)+' / '+sizeLabel(job.file.size);job.button.hidden=['done','cancelled','cancelling'].includes(job.state);job.button.textContent=job.state==='sending'?'暫停':job.state==='queued'?'移出佇列':'繼續';job.cancel.hidden=job.state==='done';job.cancel.disabled=job.state==='cancelling';job.cancel.textContent=job.state==='cancelled'?'移除':'取消';}
 async function drain(){if(running)return;running=true;
  try{for(let job;job=jobs.find(j=>j.state==='queued');){job.state='sending';job.controller=new AbortController();job.message='準備上傳';renderJob(job);
    try{if(!job.url){const response=await request('transfer.start',{file:{name:job.file.name,size:job.file.size,type:job.file.type},origin:location.origin});job.url=response.uploadUrl;}
     if(job.controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
     await uploadChunks(job.file,job.url,{signal:job.controller.signal,onProgress:sent=>{job.sent=sent;job.message='上傳中';renderJob(job);}});
     if(job.cancelRequested){job.state='cancelled';job.message='已取消；若剛好送達，請檢查共用收件匣';void job.file.release?.();job.file={name:job.file.name,size:job.file.size};renderJob(job);continue;}
     job.state='done';job.message='已送達';void job.file.release?.();job.file={name:job.file.name,size:job.file.size};
    }catch(e){if(job.cancelRequested){job.state='cancelled';job.message='已取消；若剛好送達，請檢查共用收件匣';void job.file.release?.();job.file={name:job.file.name,size:job.file.size};}else{job.state='paused';job.message=job.controller.signal.aborted?'已暫停':errorText(e);if(e.expired)job.url=null;}}
    renderJob(job);
  }}finally{running=false;}}
 function add(files){for(const file of Array.from(files)){
  if(jobs.filter(j=>!['done','cancelled'].includes(j.state)).length>=10){status.textContent='一次最多保留 10 個待傳檔案。';void file.release?.();continue;}
  if(!file.size||file.size>20*1024**3||file.name.length>240){status.textContent='略過 '+file.name+'：需為 1 byte～20 GB，檔名最多 240 字。';void file.release?.();continue;}
  const row=node('article','transfer-job'),title=node('strong','',file.name),detail=node('small'),progress=node('progress');progress.max=file.size;progress.value=0;progress.setAttribute('aria-label',file.name+' 上傳進度');const button=node('button','','暫停'),cancel=node('button','transfer-cancel','取消'),actions=node('div','transfer-job-actions');cancel.type='button';button.type='button';actions.append(button,cancel);
  const job={file,row,detail,progress,button,cancel,sent:0,state:'queued',message:'等待上傳'};button.onclick=()=>{if(job.state==='sending')job.controller.abort();else if(job.state==='queued'){jobs.splice(jobs.indexOf(job),1);void job.file.release?.();row.remove();}else{job.state='queued';job.message='等待續傳';renderJob(job);void drain();}};
  cancel.onclick=()=>{if(job.state==='sending'){job.cancelRequested=true;job.state='cancelling';job.message='正在取消';job.controller.abort();renderJob(job);}else if(job.state==='cancelled'){jobs.splice(jobs.indexOf(job),1);row.remove();}else if(['queued','paused'].includes(job.state)){job.state='cancelled';job.message='已取消';void job.file.release?.();job.file={name:job.file.name,size:job.file.size};renderJob(job);}};
  row.append(title,detail,progress,actions);jobsRoot.append(row);jobs.push(job);renderJob(job);
 }void drain();}
 pick.onclick=()=>input.click();input.onchange=()=>{add(input.files);input.value='';};
 drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag-over');};drop.ondragleave=()=>drop.classList.remove('drag-over');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag-over');add(e.dataTransfer.files);};
 dialog.addEventListener('dragover',e=>e.preventDefault());dialog.addEventListener('drop',e=>e.preventDefault());
 refresh.onclick=()=>void load();more.onclick=()=>void load(true);
 window.addEventListener('beforeunload',e=>{if(jobs.some(j=>!['done','cancelled'].includes(j.state))){e.preventDefault();e.returnValue='';}});
 return {open(){if(!dialog.open)dialog.showModal();void load();},dialog,add,report(message){status.textContent=message;},dispose(){for(const j of jobs)j.controller?.abort();dialog.remove();}};
}
