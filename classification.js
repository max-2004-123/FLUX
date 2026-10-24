// Shared by desktop and browser; categories live in existing tags for sync compatibility.
(function(root){
  const CATEGORIES=Object.freeze(['心情','見聞','提醒']);
  const category=t=>CATEGORIES.includes(String(t).trim().replace(/^[#＃]/,''))?String(t).trim().replace(/^[#＃]/,''):'';
  function explicit(body){
    const found=[];
    const pattern=/(?:^|[\s，。！？；、,;:：()（）])(?:#|＃)(心情|見聞|提醒)(?=$|[\s，。！？；、,;:：()（）#＃])/gu;
    for(const match of String(body||'').matchAll(pattern))if(!found.includes(match[1]))found.push(match[1]);
    return found;
  }
  function normalize(tags){return [...new Set((tags||[]).map(t=>category(t)||String(t).trim()).filter(Boolean))].slice(0,12);}
  function explicitTags(body,tags,manual){
    const normalized=normalize(tags);
    if(manual)return normalized;
    const declared=explicit(body);
    return declared.length?[...declared,...normalized.filter(t=>!category(t))].slice(0,12):normalized;
  }
  function aiTags(note,result){
    const topics=normalize(result.tags).filter(t=>!category(t));
    const declared=explicit(note.body);
    const suggested=Array.isArray(result.categories)?result.categories:normalize(result.tags).filter(category);
    const chosen=declared.length?declared:CATEGORIES.filter(c=>suggested.includes(c));
    return [...chosen,...topics].slice(0,12);
  }
  const prompt='用途分類只有「心情」「見聞」「提醒」，寫在 categories 陣列，可複選，無法確定則回傳空陣列。心情：此刻感受與狀態；見聞：發生的趣事、經驗、觀察與有趣問題；提醒：明確希望未來記得或執行的事項。使用者原文的 #心情、#見聞、#提醒 優先，不改成其他用途。不要只因出現日期就判為提醒，例如「明天報告好緊張」是心情；「今天忘了資料很懊惱，下次提醒我檢查」可同時為心情、提醒。「想做」「也許」不等於提醒。心情不做診斷、說教或強迫轉成任務。tags 只放主題標籤，不重複放用途分類；不要因提醒分類而添加「行程」標籤或宣稱已排程、已通知。';
  const api=Object.freeze({CATEGORIES,category,explicit,normalize,explicitTags,aiTags,prompt});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FluxClassification=api;
})(globalThis);
