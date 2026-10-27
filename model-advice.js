// Pure local rules. The note text is analyzed in memory and is never returned.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FluxModelAdvice=api;})(globalThis,()=>{
  const VERSION='rules-1';
  function advise(task,body){
    if(!['organize','calendarExtract'].includes(task))return {tier:'default',code:'unknown-task',reason:'此操作尚未設定判斷規則，建議沿用固定模型。',version:VERSION};
    if(typeof body!=='string'||!body.trim())return {tier:'default',code:'empty',reason:'沒有足夠文字，建議沿用固定模型。',version:VERSION};
    const value=body.trim();
    if(/^https?:\/\/[^\s]+$/i.test(value))return {tier:'lite',code:'url-only',reason:'只有網址；可用 Lite 做基本收錄，無法讀取網頁內容。',version:VERSION};
    if(value.length>12000 || (value.match(/^\s*\|.+\|\s*$/gm)||[]).length>=8)
      return {tier:'review',code:'complex-format',reason:'內容較長或包含多列表格，建議人工確認整理品質與模型。',version:VERSION};
    if(task==='calendarExtract')return {tier:'lite',code:'calendar',reason:'此操作是擷取行程草稿，先用 Lite；日期與時間仍需本人確認。',version:VERSION};
    return {tier:'lite',code:'organize',reason:'此操作是產生標題、短摘要與標籤，先以 Lite 作為基準。',version:VERSION};
  }
  function label(tier){return ({lite:'Flash-Lite',flash:'Flash',review:'待確認',default:'固定模型'})[tier]||'固定模型';}
  function observation(task,body,model,duration,outcome,usage){
    const result=advise(task,body),n=body.length;
    const count=v=>Number.isInteger(v)&&v>=0?v:null;
    return {time:new Date().toISOString(),task,tier:result.tier,code:result.code,version:VERSION,model:String(model||'').slice(0,100),lengthBucket:n<200?'短':n<2000?'中':'長',durationMs:Math.max(0,Math.round(duration)),outcome:outcome==='ok'?'完成':'未完成',inputTokens:count(usage?.promptTokenCount),outputTokens:count(usage?.candidatesTokenCount)};
  }
  return {advise,label,observation};
});
