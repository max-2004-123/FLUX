(function(){
  const key='flux.appearance.v1',root=document.documentElement;
  const valid=value=>['cloud','ink','stellar'].includes(value)?value:'chrome';
  function apply(value){
    const theme=valid(value);root.dataset.theme=theme;
    document.querySelectorAll('[data-theme-select]').forEach(select=>select.value=theme);
    const favicon=theme==='stellar'?'./assets/stellar-orb.svg':theme==='ink'?'./assets/ink-favicon.png':theme==='cloud'?'./icons/cloud-favicon.png':null;
    document.querySelectorAll('link[rel=icon]').forEach(icon=>{icon.href=favicon||icon.dataset.originalHref;icon.type=favicon?(theme==='stellar'?'image/svg+xml':'image/png'):icon.dataset.originalType;});
    const color=document.querySelector('meta[name=theme-color]');
    if(color)color.content=theme==='stellar'?'#111c2c':theme==='ink'?'#101f2a':theme==='cloud'?'#e9edf0':'#111115';
  }
  document.querySelectorAll('link[rel=icon]').forEach(icon=>{icon.dataset.originalHref=icon.getAttribute('href');icon.dataset.originalType=icon.getAttribute('type')||'';});
  try{apply(localStorage.getItem(key));}catch{apply('chrome');}
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(event.newValue);});
  document.addEventListener('DOMContentLoaded',()=>{
    const form=document.getElementById('settings-form');if(!form)return;
    const section=document.createElement('section');section.className='theme-settings';
    const label=document.createElement('label');label.textContent='外觀主題';
    const select=document.createElement('select');select.dataset.themeSelect='';select.setAttribute('aria-label','外觀主題');
    for(const [value,text] of [['chrome','液態金屬'],['cloud','雲海畫境'],['ink','墨潮'],['stellar','星際漫遊']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
    select.value=root.dataset.theme;label.append(select);
    const hint=document.createElement('p');hint.textContent='立即套用並記住這台裝置；不影響筆記與連線設定。';
    const status=document.createElement('p');status.setAttribute('role','status');
    select.addEventListener('change',()=>{const previous=root.dataset.theme;try{localStorage.setItem(key,select.value);apply(select.value);status.textContent='主題已套用。';}catch{select.value=previous;status.textContent='無法保存主題，請確認裝置儲存空間。';}});
    section.append(label,hint,status);form.prepend(section);
  });
})();
