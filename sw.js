const CACHE='flux-shell-v10-web-reminders';
const SHELL=['./','./index.html','./style.css','./app.js','./core.js','./transfer-core.mjs','./transfer-ui.mjs','./transfer.css','./transfer-setup.md','./model-advice.js','./model-advice-ui.js','./classification.js','./calendar.js','./calendar-ui.js','./favicon.svg','./favicon.ico','./manifest.webmanifest','./assets/chrome-orb.svg','./icons/apple-touch-icon.png','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./google-sync.gs','./appsscript.json','./calendar-setup.md','./share-setup.md','./reminders.js','./reminders-ui.js','./reminder-board.js','./reminders.css','./assets/paper-grain.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('flux-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  // Credentials, notes and external API requests never enter Cache Storage.
  if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));return;
  }
  if(SHELL.some(p=>new URL(p,self.registration.scope).pathname===u.pathname))e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(c=>c||fetch(e.request)));
});
