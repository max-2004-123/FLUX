// Shared paper/checklist model. Checks live in the existing synced manual data.
(function(root) {
  function isReminder(note) { return Boolean(note && !note.archived && !note.manual?.deleted && !note.manual?.reminderRemoved && (note.tags || []).some(t => String(t).trim().replace(/^[#＃]/, '') === '提醒')); }
  function clean(value) {
    return String(value || '').replace(/(^|[\s，。！？；、,;:：()（）])(?:#|＃)提醒(?=$|[\s，。！？；、,;:：()（）#＃])/gu, '$1').trim();
  }
  // Stable across line reordering; duplicate lines get distinct occurrence IDs.
  function fingerprint(value) {
    let a = 2166136261, b = 5381;
    for (const c of value) { const n = c.codePointAt(0); a = Math.imul(a ^ n, 16777619); b = Math.imul(b, 33) ^ n; }
    return (a >>> 0).toString(36) + '-' + (b >>> 0).toString(36);
  }
  function tasks(note) {
    const seen = new Map(), checks = note.manual?.reminderChecks || {};
    return String(note.body || '').split(/\r?\n/).flatMap(line => {
      let text = clean(line);
      const mark = text.match(/^(?:[-*]\s+)?\[([ xX])\]\s*/);
      if (mark) text = text.slice(mark[0].length);
      else text = text.replace(/^(?:[-*•]\s+|\d+[.)、]\s*)/, '');
      text = text.trim();
      if (!text) return [];
      const hash = fingerprint(text), occurrence = seen.get(hash) || 0;
      seen.set(hash, occurrence + 1);
      const key = hash + '-' + occurrence;
      return [{key, text, done: Object.hasOwn(checks, key) ? checks[key] === true : Boolean(mark && /x/i.test(mark[1]))}];
    });
  }
  function checkedManual(note, key, done) {
    if (!isReminder(note) || typeof done !== 'boolean') throw new Error('找不到可勾選的提醒便條。');
    const current = tasks(note);
    if (!current.some(t => t.key === key)) throw new Error('內容已更新，請重新勾選。');
    const checks = {};
    for (const task of current) if (Object.hasOwn(note.manual?.reminderChecks || {}, task.key)) checks[task.key] = note.manual.reminderChecks[task.key] === true;
    checks[key] = done;
    const manual={...note.manual, reminderChecks: checks};
    if(JSON.stringify({...note,manual}).length>44000)throw new Error('這則提醒太長，請拆成幾張便條再勾選。');
    return manual;
  }
  const api = Object.freeze({isReminder, clean, tasks, checkedManual});
  if (typeof module === 'object' && module.exports) module.exports = api; else root.FluxReminders = api;
})(globalThis);
