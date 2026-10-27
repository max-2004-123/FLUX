export const CHUNK_SIZE=8*1024*1024;
export function sessionURL(value){
 const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='www.googleapis.com'||!/^\/upload\/drive\/v3\/files(?:\/|$)/.test(u.pathname)||u.username||u.password||u.port)throw new Error('上傳連線來源不正確。');return u.href;
}
export async function transferRequest(settings,action,payload={},fetcher=fetch){
 if(!['transfer.list','transfer.start'].includes(action))throw new Error('不支援的互傳操作。');
 if(!settings.syncUrl||!settings.syncToken)throw new Error('請先到「設定與連線」填入 Apps Script 網址與同步密語。');
 const url=new URL(settings.syncUrl);
 if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)||url.search||url.username||url.password)throw new Error('Apps Script 網址不正確。');
 let response;try{response=await fetcher(url.href,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,action,token:settings.syncToken}),signal:AbortSignal.timeout(45000)});}catch{throw new Error('互傳服務連線失敗或逾時，請檢查網路後再試。');}
 let data;try{data=await response.json();}catch{throw new Error('請確認 Apps Script 已部署為網頁應用程式，且允許所有人存取。');}
 if(!response.ok||!data.ok)throw new Error(data.error||'互傳服務暫時無法使用。');return data;
}
function nextOffset(response,size){const range=response.headers.get('Range');if(!range)return 0;const m=/^bytes=0-(\d+)$/.exec(range);const next=m?Number(m[1])+1:NaN;if(!Number.isSafeInteger(next)||next<0||next>size)throw new Error('Google 回傳的續傳位置不正確。');return next;}
function uploadError(response){if([404,410].includes(response.status)){const e=new Error('上傳連線已過期，請重新選取檔案上傳。');e.expired=true;return e;}return new Error('上傳未完成（HTTP '+response.status+'），可按繼續重試。');}
export async function uploadChunks(file,url,{fetcher=fetch,signal,onProgress=()=>{}}={}){
 url=sessionURL(url);
 const send=(range,body)=>fetcher(url,{method:'PUT',credentials:'omit',headers:{'Content-Type':'application/octet-stream','Content-Range':range},body,signal});
 let response=await send('bytes */'+file.size,new Blob([]));
 if(response.ok){onProgress(file.size);return;}
 if(response.status!==308)throw uploadError(response);
 let offset=nextOffset(response,file.size);onProgress(offset);
 while(offset<file.size){
  const end=Math.min(offset+CHUNK_SIZE,file.size);
  response=await send(`bytes ${offset}-${end-1}/${file.size}`,await file.slice(offset,end));
  if(response.ok){onProgress(file.size);return;}
  if(response.status!==308)throw uploadError(response);
  const next=nextOffset(response,file.size);
  if(next<=offset||next>end)throw new Error('無法確認上傳進度，請按繼續重試。');
  offset=next;onProgress(offset);
 }
 // A final 308 is not confirmation of completion.
 response=await send('bytes */'+file.size,new Blob([]));if(!response.ok)throw uploadError(response);onProgress(file.size);
}
export function sizeLabel(size){if(size<1024)return size+' B';const units=['KB','MB','GB'];let n=size/1024,i=0;while(n>=1024&&i<2){n/=1024;i++;}return n.toFixed(n>=100?0:1)+' '+units[i];}
export function safeDriveLink(value){try{const u=new URL(value);return u.protocol==='https:'&&['drive.google.com','drive.usercontent.google.com'].includes(u.hostname)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
