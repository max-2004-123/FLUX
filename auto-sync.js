export function mountAutoSync({window:win,document:doc,enabled,sync,online=()=>win.navigator.onLine,setInterval:every=globalThis.setInterval,clearInterval:clear=globalThis.clearInterval}) {
  let last=0;
  const refresh=()=>{if(doc.visibilityState==='hidden'||!online()||!enabled()||Date.now()-last<2000)return;last=Date.now();void sync(true);};
  doc.addEventListener('visibilitychange',refresh);
  win.addEventListener('pageshow',refresh);
  win.addEventListener('focus',refresh);
  const timer=every(refresh,60000);
  return ()=>{clear(timer);doc.removeEventListener('visibilitychange',refresh);win.removeEventListener('pageshow',refresh);win.removeEventListener('focus',refresh);};
}
