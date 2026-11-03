(function(){
  const key='flux.appearance.v1',root=document.documentElement;
  const valid=value=>value==='cloud'?'cloud':'chrome';
  function apply(value){root.dataset.theme=valid(value);document.querySelectorAll('[data-theme-select]').forEach(select=>select.value=root.dataset.theme);}
  try{apply(localStorage.getItem(key));}catch{apply('chrome');}
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(event.newValue);});
  document.addEventListener('DOMContentLoaded',()=>{
    const form=document.getElementById('settings-form');if(!form)return;
    const section=document.createElement('section');section.className='theme-settings';
    const label=document.createElement('label');label.textContent='外觀主題';
    const select=document.createElement('select');select.dataset.themeSelect='';select.setAttribute('aria-label','外觀主題');
    for(const [value,text] of [['chrome','液態金屬'],['cloud','雲海畫境']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
    select.value=root.dataset.theme;label.append(select);
    const hint=document.createElement('p');hint.textContent='立即套用並記住這台裝置；不影響筆記與連線設定。';
    const status=document.createElement('p');status.setAttribute('role','status');
    select.addEventListener('change',()=>{const previous=root.dataset.theme;try{localStorage.setItem(key,select.value);apply(select.value);status.textContent='主題已套用。';}catch{select.value=previous;status.textContent='無法保存主題，請確認裝置儲存空間。';}});
    section.append(label,hint,status);form.prepend(section);
  });
})();
