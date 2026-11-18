import { day, copy, addDays, eligible, nextRoundCards, createSession, nextItem, question, reveal, grade, undo, markMastered, unmarkMastered, makeCard } from './core.mjs';
import { migrateState, DEFAULT_SETTINGS, removeCards } from './state.mjs';
import {MAX_IMPORT_BYTES,externalPrompt,photoPrompt,chatSystemPrompt,parseImportBatch,parsePhotoResponse,parseChatResult,validateItem,pickContent,contentKey} from './import.mjs';

const app = document.querySelector('#app');
const STORE = 'liushi-demo-v1';
const native = window.Android;
const defaultSettings = DEFAULT_SETTINGS;
let state;
try {
  const saved = (native ? native.loadProgress() : '') || localStorage.getItem(STORE);
  state = saved ? JSON.parse(saved) : null;
  if (!state || !Array.isArray(state.cards)) state = null;
} catch { state = null; }
state = migrateState(state);
state.settings = { ...defaultSettings, ...state.settings };
if (native) { try { Object.assign(state.settings, JSON.parse(native.getSettings())); } catch {} }
let view = 'home', kind = 'formula', active = null, subject = '全部', importing = [], pictures = [], importIndex = 0, loading = false, importError = '', rejectedItems = 0, importKind = 'formula', browserKey = '', waitTimer, toastTimer;
let editing=false, selectedIds=new Set(), pendingDeletion=null;
let importMode='photo',importSource='photo',jsonDraft='',jsonError='',batchVersion=0,chatThreads={},chatDraft='',chatError='',chatBusy=false,draftPictures=[];
let importIssues=[],photoReading=false,jsonReading=false,photoLoadVersion=0,jsonLoadVersion=0,ocrVersion=0;
const renderMath=latex=>window.katex.renderToString(latex,{throwOnError:true,trust:false,strict:'error'});
const e = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${({ back:'<path d="m14 5-7 7 7 7"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>', arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>', undo:'<path d="M8 7H4V3m0 4h9a7 7 0 1 1-6 10"/>', book:'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zM13 7a3 3 0 0 1 3-3h4v15h-3a4 4 0 0 0-4 2"/>', camera:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>', settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#faf7f0"/><circle cx="16" cy="17" r="3" fill="#faf7f0"/>', star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>', check:'<path d="m5 12 4 4L19 6"/>', plus:'<path d="M12 5v14M5 12h14"/>', trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>' })[name] || ''}</svg>`;
function math(text, display = false) {
  try { return window.katex.renderToString(text, { displayMode: display, throwOnError: true, trust: false, strict: 'ignore', output: 'htmlAndMathml' }); }
  catch { return `<span class="mono">${e(text)}</span>`; }
}
function rich(text) { return String(text).split(/(\$[^$]+\$)/g).map(s => s.startsWith('$') && s.endsWith('$') ? math(s.slice(1, -1)) : e(s)).join(''); }
function save() {
  try { const json=JSON.stringify(state);if(native)native.saveProgress(json);else localStorage.setItem(STORE,json);return true; }
  catch { toast('保存失败，请先导出备份后重试');return false; }
}
function toast(text) { const el = document.querySelector('#toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3200); }
function sessionKey(mode = 'daily') { return `${kind}:${mode}`; }
function getCurrentSession() { return state.sessions[active]; }
function focusCards() { return state.cards.filter(c => c.kind === kind && c.focus && c.focusDay !== day()); }
function dueCards() { return eligible(state.cards, kind); }
function header(title, action = '') { return `<header class="panel-header"><button class="icon-btn" data-act="home" aria-label="返回首页">${icon('back')}</button><h1>${title}</h1>${action}</header>`; }
function streak() {
  let current = day(), count = 0;
  if (!state.activity.includes(current)) current = addDays(current, -1);
  while (state.activity.includes(current)) { count++; current = addDays(current, -1); }
  return count;
}
function remaining(session) { return session?.items.filter(i => !i.done).length || 0; }
function nextRoundSize(session) { return session?.finished && session.day === day() && session.mode === 'daily' ? Math.min(state.settings.limit,nextRoundCards(state.cards,kind,session).length) : 0; }
function renderHome() {
  const session = state.sessions[sessionKey()];
  const resume = session && !session.finished && session.items.length;
  const sessionToday = session?.day === day();
  const carryIds=session && !sessionToday ? [...session.items.filter(i=>!i.done),...(session.deferred||[])].map(i=>i.id) : [];
  const available = resume && sessionToday ? remaining(session) : sessionToday && session.finished ? 0 : Math.min(state.settings.limit,new Set([...carryIds,...dueCards().map(c=>c.id)]).size);
  const fc = focusCards().length;
  const date = new Date().toLocaleDateString('zh-CN', { month:'long', day:'numeric' });
  const total=state.cards.filter(c=>c.kind===kind).length;
  const completed=sessionToday && session.finished;
  const nextCount=nextRoundSize(session);
  return `<div class="page-enter home-page home-simple">
    <header class="home-top"><span class="date-label">${e(date)}</span><nav class="mode-switch" aria-label="题库类型"><button class="mode-tab ${kind==='formula'?'active':''}" data-act="kind" data-kind="formula" aria-pressed="${kind==='formula'}">公式</button><button class="mode-tab ${kind==='wrong'?'active':''}" data-act="kind" data-kind="wrong" aria-pressed="${kind==='wrong'}">错题</button></nav></header>
    <section class="home-brand"><h1>Carmanline</h1><span class="brand-stroke" aria-hidden="true"></span></section>
    <div class="home-task-cards"><button class="home-task daily-task" data-act="start"><span class="task-label">今日巩固</span><strong class="big-count">${completed?'✓':available}</strong><span class="task-foot">${!total?'拍照录入':completed?nextCount?'再巩固 '+nextCount+' 个':'今日已完成':available?resume?'继续'+((session.round||1)>1?'第 '+session.round+' 轮':'复习'):'开始复习':'今日已完成'}${icon('arrow')}</span></button><button class="home-task focus-task" data-act="focus"><span class="task-label">重点复习</span><strong class="num">${fc}</strong><span class="task-foot">${fc?'再记一次':'暂无重点'}${icon('arrow')}</span></button></div>
    <footer class="home-nav"><button data-act="library" aria-label="我的题库">${icon('book')}<span>题库${total?' · '+total:''}</span></button><button class="home-capture" data-act="import" aria-label="拍照录入">${icon('camera')}<span>录入</span></button><button data-act="settings" aria-label="设置">${icon('settings')}<span>设置</span></button></footer>
    ${streak()?`<div class="home-streak">已连续复习 ${streak()} 天</div>`:''}
  </div>`;
}
function start(mode = 'daily', extraRound = false) {
  active = sessionKey(mode);
  let session = state.sessions[active];
  if (extraRound && (!session?.finished || session.day !== day())) extraRound=false;
  if (extraRound && !nextRoundSize(session)) { view='summary';render();return; }
  if (!extraRound && session?.finished && session.day === day()) { view = 'summary'; render(); return; }
  if (!session || session.finished || session.day !== day()) {
    session = createSession(state.cards, kind, state.settings.limit, mode, Date.now(), session && (extraRound || !session.finished || session.deferred?.length) ? session : null, extraRound);
    state.sessions[active] = session;
  }
  if (!session.items.length) { view = 'home'; toast(mode === 'focus' ? '今天没有待复习的重点' : '今天没有到期内容'); render(); return; }
  view = 'review'; save(); render();
}
function updateWait(session, until) {
  if (view !== 'review' || getCurrentSession() !== session) return;
  const seconds = Math.max(0,Math.ceil((until-Date.now())/1000));
  if (!seconds) { render(); return; }
  const value=document.querySelector('[data-countdown]');
  if (value) value.textContent=String(seconds);
  waitTimer=setTimeout(()=>updateWait(session,until),Math.min(1000,until-Date.now()));
}
function renderReview() {
  const s = getCurrentSession();
  if (!s) { view = 'home'; return renderHome(); }
  if (s.finished) return renderSummary();
  if (!s.current) {
    const next = nextItem(s);
    if (next.done) { s.finished = true; save(); return renderSummary(); }
    if (next.waitUntil) {
      waitTimer = setTimeout(()=>updateWait(s,next.waitUntil),Math.min(1000,next.waitUntil-Date.now()));
      const seconds = Math.max(0, Math.ceil((next.waitUntil - Date.now()) / 1000));
      return `<div class="empty-page wait-page"><div class="eyebrow">GIVE MEMORY A MOMENT</div><h1>让记忆，隔一小会儿。</h1><p>还剩 ${remaining(s)} 个${kind === 'formula' ? '公式' : '错题'}。<br>隔开之后再回想，才算这轮真正记起。</p><div class="wait-number" aria-live="off"><span data-countdown>${seconds}</span><small> 秒</small></div><button class="secondary" data-act="home">先休息，稍后继续</button>${s.history.length ? '<button class="back-link" data-act="undo">撤销上一题</button>' : ''}</div>`;
    }
    const card = state.cards.find(c => c.id === next.item.id);
    s.current = { question: question(card, s.turn), selected: null, revealed: false, seenRecorded: false };
    save();
  }
  const cur = s.current, q = cur.question, c = state.cards.find(c => c.id === q.cardId), item = s.items.find(i => i.id === c.id);
  const selectedCorrect = cur.selected !== null && q.options[cur.selected]?.correct;
  const canUndo = s.history.length > 0 || cur.fromUndo && cur.revealed;
  const done = s.items.filter(i => i.done).length;
  const options = q.options.map((o,i) => {
    let status = '', indicator = '';
    if (cur.revealed) {
      if (o.correct) { status = 'correct'; indicator = '✓'; }
      else if (cur.selected === i) { status = 'wrong'; indicator = '×'; }
      else status = 'faded';
    }
    return `<button class="option ${status}" data-act="answer" data-index="${i}" ${cur.revealed ? 'aria-disabled="true"' : ''} aria-label="选项 ${'ABCDEF'[i]}"><span class="letter">${'ABCDEF'[i]}</span><span class="option-content">${q.judge ? e(o.text) : c.kind === 'wrong' ? rich(o.text) : math(q.cloze ? o.text.slice(o.text.indexOf('=')+1) : o.text)}</span>${indicator ? `<span class="option-icon">${indicator}</span>` : ''}</button>`;
  }).join('');
  return `<section class="review-page page-enter"><header class="review-top"><button class="icon-btn" data-act="previous" aria-label="上一题" ${canUndo ? '' : 'disabled'}>${icon('back')}</button><span class="progress-count">${done}/${s.items.length}</span><div class="review-tools"><button class="icon-btn" data-act="undo" aria-label="撤销上一题" ${s.history.length ? '' : 'disabled'}>${icon('undo')}</button>${s.mode !== 'focus' ? `<button class="master-btn ${c.mastered ? 'active' : ''}" data-act="master" aria-label="标熟，30天后复习">熟</button>` : ''}<button class="icon-btn" data-act="exit" aria-label="结束本次复习">···</button></div></header>
    <div class="review-heading"><div class="review-meta"><span>${e(c.subject)}</span><i class="dot"></i><span>${s.mode === 'focus' ? '重点复习' : q.type}</span></div><h1>${e(q.title)}</h1><div class="review-cue">${q.judge ? `<div class="math-block">${math(q.stem)}</div>这个公式正确吗？` : rich(q.stem)}</div><div class="pass-dots">${s.mode === 'focus' ? `<span>已连续记起 ${c.focusStreak} / 3 次</span>` : `<i class="${item.passes >= 1 ? 'on' : ''}"></i><i></i><span>${item.passes ? '再记起一次，就完成今天的巩固' : '先回想，再选择；想不起来就看答案'}</span>`}</div></div>
    ${q.cloze ? `<div class="math-block" style="padding:14px 6px 0">${math(cur.revealed ? q.answer : q.fragment)}</div>` : ''}<div class="options">${options}</div>
    ${cur.revealed && (q.judge || cur.selected === null) ? `<div class="correct-answer"><p class="label">正确答案</p><div class="math-block">${c.kind === 'wrong' ? rich(q.answer) : math(q.answer)}</div></div>` : ''}
    ${cur.revealed ? `<div class="answer-caption">${icon(selectedCorrect ? 'check' : 'book')}<span>${cur.selected === null ? '想不起来没关系，隔几题再见' : selectedCorrect ? '这次想起来了' : '记住正确写法，隔几题再见'}</span></div>` : ''}
    <footer class="review-bottom">${cur.revealed ? `<button class="text-action" data-act="grade" data-outcome="${selectedCorrect ? 'know' : 'forget'}">${selectedCorrect ? '下一题' : '继续'}</button>${cur.selected !== null ? `<button class="override" data-act="grade" data-outcome="${selectedCorrect ? 'guess' : 'slip'}">${selectedCorrect ? '我是蒙的，重新巩固' : '我手滑选错了，其实会'}</button>` : '<span class="override">本次按「不会」记录</span>'}` : '<button class="text-action reveal" data-act="reveal">看答案</button>'}</footer></section>`;
}
function renderSummary() {
  const s = getCurrentSession();
  const moved = s.items.filter(i => i.moved).length;
  const passed = s.items.length - moved;
  const nextCount=nextRoundSize(s);
  return `<div class="empty-page page-enter"><div class="empty-icon">✓</div><div class="eyebrow">${s.mode==='daily'?'ROUND '+(s.round||1)+' COMPLETE':'A LITTLE STRONGER TODAY'}</div><h1>这一轮，记得更牢一点。</h1><p>${s.mode === 'focus' ? '重点内容已完成本次复习' : '这一轮巩固已完成，下次复习已安排好。'}${moved ? `<br>${moved} 个已移入重点清单，明天单独照顾。` : ''}</p><div class="finish-detail"><div><strong>${passed}</strong><span>完成巩固</span></div><div><strong>${s.turn}</strong><span>次回想</span></div>${moved ? `<div><strong>${moved}</strong><span>转入重点</span></div>` : ''}</div>${nextCount?`<button class="primary" data-act="next-round">再巩固 ${nextCount} 个 ${icon('arrow')}</button><p class="round-help">到期内容优先，不足时提前复习其他内容。<br>今天已练过的内容不会再次加入。</p><button class="secondary" data-act="home">回到首页</button>`:`<button class="primary" data-act="home">回到首页 ${icon('arrow')}</button>${s.mode==='daily'?'<p class="round-help">今天可继续巩固的内容已全部完成。</p>':''}`}${s.history.length ? '<button class="back-link" data-act="undo">回看上一题</button>' : ''}</div>`;
}
function renderLibrary() {
  const cards = state.cards.filter(c => c.kind === kind && (subject === '全部' || c.subject === subject));
  const total=state.cards.filter(c=>c.kind===kind).length;
  const subjects=['全部',...new Set(state.cards.filter(c=>c.kind===kind).map(c=>c.subject))];
  const allSelected=cards.length>0&&cards.every(c=>selectedIds.has(c.id));
  return `<div class="page-enter library-page ${editing?'editing':''}">${header('我的'+(kind==='formula'?'公式':'错题'),`<div class="library-actions"><button class="edit-button" data-act="edit-library" ${!total&&!editing?'disabled':''}>${editing?'完成':'多选'}</button>${!editing?`<button class="icon-btn" data-act="import" aria-label="录入">${icon('plus')}</button>`:''}</div>`)}<div class="library-count row"><span>${editing?'已选 '+selectedIds.size+' 项':total+' 条内容'}</span>${editing?`<button class="select-all" data-act="select-all" ${cards.length?'':'disabled'}>${allSelected?'取消全选':'全选'}</button>`:''}</div>${subjects.length>2?`<div class="filter-row">${subjects.map(x=>`<button class="chip ${subject===x?'active':''}" data-act="filter" data-value="${e(x)}">${e(x)}</button>`).join('')}</div>`:''}<div class="library-list">${cards.length?cards.map(c=>`<article class="library-card ${editing?'selectable':''} ${selectedIds.has(c.id)?'selected':''}" ${editing?`data-act="toggle-card" data-id="${e(c.id)}" role="checkbox" aria-checked="${selectedIds.has(c.id)}" tabindex="0" aria-label="选择${e(c.title)}"`:''}>${editing?`<span class="selection-mark" aria-hidden="true">${selectedIds.has(c.id)?icon('check'):''}</span>`:''}<div class="library-item-body"><div class="row"><h3>${e(c.title)}</h3>${!editing&&c.mastered?`<button class="chip active" data-act="unmaster" data-id="${e(c.id)}">已标熟 · 撤销</button>`:c.focus?'<span class="chip">重点</span>':''}</div><div class="math-block">${c.kind==='formula'?math(c.latex):rich(c.stem)}</div><div class="card-status"><span>${e(c.subject)}</span><span>${c.focus?`连续记起 ${c.focusStreak}/3 次`:`${e(c.due)} 复习`}</span></div></div></article>`).join(''):`<div class="library-empty"><span>${icon('book')}</span><h2>还没有${kind==='formula'?'公式':'错题'}</h2><p>拍照或从相册录入第一条内容</p><button class="primary" data-act="import">拍照录入</button></div>`}</div>${editing?`<div class="bulk-toolbar"><span>已选择 ${selectedIds.size} 项</span><button class="delete-button" data-act="delete-selected" ${selectedIds.size?'':'disabled'}>${icon('trash')}删除${selectedIds.size?'（'+selectedIds.size+'）':''}</button></div>`:''}</div>`;
}
function renderSettings() {
  return `<div class="page-enter">${header('设置')}<section class="form-section"><h2>每日巩固</h2><label class="field">每日数量<select id="daily-limit">${[10,20,30,40].map(n=>`<option value="${n}" ${state.settings.limit===n?'selected':''}>${n} 个</option>`).join('')}</select></label><p class="help">每个连对两次；更改数量从下一场开始生效。<br>跨日排程采用六盒：0 / 1 / 3 / 7 / 15 / 30 天。</p></section><section class="form-section"><h2>AI 识别与对话</h2><p class="help">拍照识别和对话修改共用此接口。拍照需模型支持图片输入；JSON 导入本身无需配置。</p><label class="field">完整接口地址<input id="api-endpoint" type="url" autocomplete="off" placeholder="https://你的服务/v1/chat/completions" value="${e(state.settings.endpoint)}"></label><label class="field">模型名称（拍照需支持图片）<input id="api-model" autocomplete="off" placeholder="填写服务支持的视觉模型" value="${e(state.settings.model)}"></label><label class="field">API Key<input id="api-key" type="password" autocomplete="off" placeholder="${state.settings.hasKey ? '已保存，留空保持现有 Key' : '填入你的 API Key'}"></label><p class="help">${native ? 'Key 使用 Android Keystore 加密保存在本机。' : '浏览器预览中的 Key 仅保留在本次页面内存中。'}</p><button class="primary" data-act="save-settings" style="margin-top:20px">保存设置</button></section><section class="form-section"><h2>本机数据</h2><button class="secondary" data-act="export">导出复习备份</button><p class="help" style="margin-top:12px">题库内容由你录入。<br>复习无需联网；拍照识别需要配置服务。Carmanline 0.3.1</p></section></div>`;
}
function renderImport() {
  const type=importKind==='formula'?'公式':'错题';
  const tabs=`<div class="import-type">${[['formula','公式'],['wrong','错题']].map(([k,t])=>`<button class="chip ${importKind===k?'active':''}" data-act="import-kind" data-kind="${k}" ${loading?'disabled':''}>${t}</button>`).join('')}</div><nav class="input-modes" aria-label="录入方式">${[['photo','拍照识别'],['json','JSON 导入']].map(([k,t])=>`<button class="${importMode===k?'active':''}" data-act="import-mode" data-mode="${k}" aria-pressed="${importMode===k}" ${loading?'disabled':''}>${t}</button>`).join('')}</nav>`;
  const resume=importing[importIndex]?`<button class="draft-resume" data-act="resume-import">继续处理未入库内容 · ${importing.length-importIndex} 条 ${icon('arrow')}</button>`:'';
  if(importMode==='json')return `<div class="import-page">${header('录入')}${tabs}${resume}<h2 class="input-title">用其他 AI 识别${type}</h2><p class="panel-subtitle">复制提示词，和照片一起发给你常用的 AI。<br>拿到 JSON 后粘贴或选择文件，核对后入库。</p><button class="secondary copy-prompt" data-act="copy-prompt">复制${type}识别提示词</button><details class="prompt-details"><summary>查看完整提示词与格式</summary><textarea id="import-prompt" readonly aria-label="${type}识别提示词">${e(externalPrompt(importKind))}</textarea></details><div class="input-toolbar"><label class="field" for="json-input">粘贴 AI 返回的 JSON</label><button class="clear-input" data-act="clear-json">清空</button></div><textarea id="json-input" class="json-input" spellcheck="false" placeholder="粘贴完整 JSON 对象" maxlength="2097152">${e(jsonDraft)}</textarea><label class="json-file-button secondary">选择 JSON / TXT 文件<input id="json-file" type="file" accept=".json,.txt,application/json,text/plain" aria-label="选择 JSON 文件"></label>${jsonError?`<div class="error-panel" role="alert">${e(jsonError)}</div>`:''}<button class="primary parse-json" data-act="parse-json" ${loading||jsonReading?'disabled':''}>${jsonReading?'正在读取文件…':'校验并预览'} ${icon('arrow')}</button><p class="help json-help">最多 100 条、2 MB。公式和错题分别导入。<br>此方式无需配置 App 内的 AI 接口。</p></div>`;
  return `<div class="import-page">${header('录入')}${tabs}${resume}<h2 class="input-title">把需要记住的，留下。</h2><p class="panel-subtitle">正对拍摄，一页建议不超过 12 条。<br>识别后可与 AI 对话修改，也能手动编辑。</p><div class="input-toolbar photo-input-toolbar"><span>${photoReading?'正在读取图片…':pictures.length?'已选择 '+pictures.length+' 张':'添加图片'}</span><button class="clear-input" data-act="clear-photos">清除图片</button></div><label class="upload-area">${icon('camera')}<strong>${pictures.length?`已选择 ${pictures.length} 张照片`:'拍照 / 从相册选择'}</strong><small>支持多张照片，可批量入库</small><input id="photos" type="file" accept="image/*" multiple aria-label="选择照片" ${loading||photoReading?'disabled':''}></label>${pictures.length?`<div class="upload-previews">${pictures.map(p=>`<img src="${p.data}" alt="待识别照片">`).join('')}</div>`:''}${importError?`<div class="error-panel" role="alert">${e(importError)}</div>`:''}<div class="import-actions"><button class="primary" data-act="recognize" ${!pictures.length||loading||photoReading?'disabled':''}>${loading?'正在识别，请稍候…':'识别并预览'} ${icon('arrow')}</button></div><div class="notice">照片仅在点击识别或发送修改指令后交给已配置的 AI，确认完成后释放。</div></div>`;
}
function candidateCard(c) {
  return `<article class="confirm-card"><div class="eyebrow">${e(c.subject)}</div><h2>${e(c.title)}</h2><div class="math-block">${c.kind==='formula'?math(c.latex):rich(c.stem)}</div>${c.kind==='wrong'?c.options.map((o,i)=>`<p class="draft-option ${i===c.answer?'right':''}">${'ABCDEF'[i]}. ${rich(o)}${i===c.answer?' ✓':''}</p>`).join(''):`<p class="help">${e(c.cue||'未填写适用条件')}</p><details class="draft-variants"><summary>查看 ${c.distractors.length} 个混淆项</summary>${c.distractors.map(latex=>`<div class="math-block">${math(latex)}</div>`).join('')}</details>`}</article>`;
}
function renderConfirm() {
  const c=importing[importIndex];
  if(!c){importing=[];pictures=[];draftPictures=[];chatThreads={};importIssues=[];native?.clearPhotos();subject='全部';view='library';return renderLibrary();}
  const issues=importIssues.length?`<section class="notice import-notice" role="status">已保留 ${importing.length} 条可录入内容，有 ${importIssues.length} 处处理提示。<details><summary>查看跳过原因与提示</summary><ul>${importIssues.map(issue=>`<li><strong>${e(issue.title)}</strong>：${e(issue.message)}</li>`).join('')}</ul></details></section>`:'';
  return `<div class="confirm-page">${header('待录入内容')}<p class="panel-subtitle">${importIndex+1} / ${importing.length} · ${importSource==='photo'?'照片识别结果':'JSON 导入结果'}<br>可自行编辑后入库，内容请自行核对。</p>${issues}${candidateCard(c)}<div class="confirm-actions"><button class="secondary" data-act="edit-import">对话修改</button><button class="primary" data-act="confirm-import" ${chatBusy?'disabled':''}>确认入库 ${icon('check')}</button></div><button class="back-link" data-act="skip-import" ${chatBusy?'disabled':''}>跳过这一条</button>${importing.length-importIndex>1?`<button class="secondary batch-import" data-act="import-all" ${chatBusy?'disabled':''}>全部入库（剩余 ${importing.length-importIndex} 条）</button>`:''}</div>`;
}
function renderChat() {
  const c=importing[importIndex];if(!c){view='confirm';return renderConfirm();}
  const thread=chatThreads[importIndex]||[];
  return `<div class="chat-page"><header class="panel-header"><button class="icon-btn" data-act="back-confirm" aria-label="返回结果">${icon('back')}</button><h1>对话修改</h1><button class="edit-button" data-act="manual-edit" ${chatBusy?'disabled':''}>手动编辑</button></header><p class="panel-subtitle">当前第 ${importIndex+1} 条 · ${e(c.title)}<br>修改只影响这条草稿，确认入库后才保存到题库。</p><details class="chat-current"><summary>当前草稿</summary>${candidateCard(c)}</details><div class="chat-log" role="log" aria-live="polite"><div class="chat-message assistant"><span class="chat-role">Carmanline</span><p>告诉我哪里需要调整，例如“把变量改为 t，并同步修改混淆项”。你也可以直接手动编辑。</p></div>${thread.map(m=>`<div class="chat-message ${m.role}"><span class="chat-role">${m.role==='user'?'你':'Carmanline'}</span><p>${e(m.text)}</p></div>`).join('')}${chatBusy?'<div class="chat-message assistant chat-pending">正在核对并修改草稿…</div>':''}</div>${chatError?`<div class="error-panel" role="alert">${e(chatError)}<br>原草稿已保留，可修改指令后重试或手动编辑。</div>`:''}<div class="chat-composer"><label class="sr-only" for="chat-input">给 AI 的修改指令</label><textarea id="chat-input" rows="2" maxlength="2000" placeholder="告诉 AI 怎么修改这条内容…">${e(chatDraft)}</textarea><button class="primary" data-act="send-chat" ${chatBusy?'disabled':''}>${chatBusy?'处理中':'发送'} ${icon('arrow')}</button><p class="help">发送时会将当前草稿${importSource==='photo'?'和对应原图':''}交给设置中的模型。</p></div><button class="secondary chat-done" data-act="back-confirm">完成修改，返回结果</button></div>`;
}
function render() {
  clearTimeout(waitTimer);
  app.innerHTML = ({ home: renderHome, review: renderReview, summary: renderSummary, library: renderLibrary, settings: renderSettings, import: renderImport, confirm: renderConfirm, chat:renderChat })[view]();
  if(view==='chat'){const log=document.querySelector('.chat-log');if(log)log.scrollTop=log.scrollHeight;}
}
function modal(title, text, buttons) {
  document.querySelector('#modal-root').innerHTML = `<div class="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-label="${e(title)}"><h2>${e(title)}</h2><p>${e(text)}</p>${buttons.map((b,i)=>`<button class="${i === 0 ? 'primary' : 'secondary'}" data-act="${b.act}">${e(b.label)}</button>`).join('')}</section></div>`;
}
function closeModal() { document.querySelector('#modal-root').innerHTML = ''; }
function onGrade(outcome) {
  const s = getCurrentSession();
  if (!s?.current?.revealed) return;
  const result = grade(s, state.cards, outcome);
  if (!state.activity.includes(day())) state.activity.push(day());
  if (result.moved) toast('这条先移入重点清单，明天单独复习');
  save(); render();
}
function previous(alwaysUndo = false) {
  const s = getCurrentSession(); if (!s) return;
  if (!alwaysUndo && s.current?.revealed && s.current.fromUndo) { s.current.revealed = false; s.current.selected = null; }
  else if (!undo(s, state.cards)) return;
  view = 'review'; save(); render();
}
function exportBackup() {
  const json = JSON.stringify(state, null, 2);
  if (native) { native.exportBackup(json); toast('已打开备份保存窗口'); }
  else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type:'application/json' })); a.download = `Carmanline备份-${day()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
}
function validateCandidate(c) {
  return {...c,...validateItem(pickContent(c),c.kind,renderMath)};
}
function beginBatch(items,source,navigate=true,issues=[]) {
  batchVersion++;importing=items;importIndex=0;importSource=source;chatThreads={};chatDraft='';chatError='';chatBusy=false;rejectedItems=0;importIssues=issues;
  kind=items[0].kind;importKind=kind;subject='全部';
  draftPictures=source==='photo'?pictures.slice():[];
  if(source==='json'){pictures=[];native?.clearPhotos();}
  if(navigate)view='confirm';
}
function discardBatch(source) {
  if(importSource!==source)return;
  batchVersion++;importing=[];importIndex=0;draftPictures=[];chatThreads={};chatDraft='';chatError='';chatBusy=false;importIssues=[];
}
function clearJsonInput() {
  jsonLoadVersion++;jsonReading=false;jsonDraft='';jsonError='';discardBatch('json');render();
}
function clearPhotoInput() {
  photoLoadVersion++;ocrVersion++;photoReading=false;loading=false;pictures=[];importError='';discardBatch('photo');native?.clearPhotos();render();
}
function previewJson() {
  if(loading||jsonReading)return;
  try {const report=parseImportBatch(jsonDraft,importKind,renderMath);if(!report.items.length)throw new Error('没有可录入的条目。'+report.issues.slice(0,3).map(issue=>issue.message).join('；'));beginBatch(report.items,'json',true,report.issues);jsonError='';}
  catch(err){jsonError=err.message;}
  render();
}
async function loadJsonFile(file) {
  if(!file)return;
  const token=++jsonLoadVersion;jsonReading=false;
  if(file.size>MAX_IMPORT_BYTES){jsonError='文件超过 2 MB，请分批导入';render();return;}
  jsonReading=true;jsonError='';render();
  try {const text=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('文件读取失败，请重新选择'));reader.readAsText(file,'UTF-8');});if(token!==jsonLoadVersion)return;jsonDraft=text;jsonError='';}
  catch(err){if(token===jsonLoadVersion)jsonError=err.message;}
  finally{if(token===jsonLoadVersion){jsonReading=false;render();}}
}
async function copyPrompt() {
  const text=externalPrompt(importKind);
  try {
    if(native?.copyText)native.copyText(text);
    else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
    else {const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();const copied=document.execCommand('copy');area.remove();if(!copied)throw new Error();}
    toast('提示词已复制，把它和照片一起发给其他 AI');
  }catch {const details=document.querySelector('.prompt-details');if(details)details.open=true;document.querySelector('#import-prompt')?.select();toast('请长按提示词，选择复制');}
}
function commitImport(count=1) {
  if(chatBusy)return false;
  const oldCards=state.cards;
  try {
    const candidates=importing.slice(importIndex,importIndex+count).map(c=>pickContent(validateCandidate(c)));
    const keys=new Set(oldCards.map(contentKey)),added=[];let duplicates=0;
    for(const c of candidates){const key=contentKey(c);if(keys.has(key)){duplicates++;continue;}keys.add(key);added.push(makeCard({...c,id:'custom-'+Date.now()+'-'+batchVersion+'-'+importIndex+'-'+added.length+'-'+Math.random().toString(36).slice(2,8)}));}
    state.cards=[...oldCards,...added];
    if(!save()){state.cards=oldCards;return false;}
    importIndex+=candidates.length;chatDraft='';chatError='';
    toast('已入库 '+added.length+' 条'+(duplicates?'，跳过 '+duplicates+' 条相同内容':''));return true;
  }catch(err){state.cards=oldCards;toast('请先修改：'+err.message);return false;}
}
async function loadPhotos(files) {
  const token=++photoLoadVersion;photoReading=true;importError='';pictures=[];render();
  const decoded=[],errors=[];
  const selected = Array.from(files).slice(0, 8);
  for (const file of selected) {
    const img = new Image(); const url = URL.createObjectURL(file);
    try {
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      if(token!==photoLoadVersion)return;
      const scale = Math.min(1,1600 / Math.max(img.naturalWidth,img.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(img.naturalWidth*scale); canvas.height = Math.round(img.naturalHeight*scale);
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      decoded.push({ data:canvas.toDataURL('image/jpeg',.9), name:file.name });
    } catch { errors.push('有一张照片无法读取，已跳过，请换一张重试。'); }
    finally { URL.revokeObjectURL(url); }
  }
  if(token===photoLoadVersion){pictures=decoded;photoReading=false;importError=errors[0]||'';render();}
}
async function recognize() {
  if (loading || photoReading || !pictures.length) return;
  if (!native) { importError = '浏览器预览不发送照片。请安装 APK，在设置中填写支持图片的视觉接口。'; render(); return; }
  if (!state.settings.endpoint || !state.settings.model || !state.settings.hasKey) { importError = '请先在设置中配置支持图片输入的接口、模型和 API Key。'; render(); return; }
  loading = true; importError = '';const type=importKind,token=++ocrVersion,photos=pictures.slice();render();
  try {
    const results=[],issues=[];
    for (let i=0; i<photos.length; i++) {
      if(token!==ocrVersion)return;
      try {
        const result=await nativeRequest({prompt:photoPrompt(type),image:photos[i].data});
        if(token!==ocrVersion)return;
        const report=parsePhotoResponse(result,type,renderMath);
        results.push(...report.items.map(c=>({...c,imageIndex:i})));
        issues.push(...report.issues.map(issue=>({...issue,title:'第 '+(i+1)+' 张 · '+issue.title})));
      }catch(err){if(token!==ocrVersion)return;issues.push({index:0,title:'第 '+(i+1)+' 张照片',message:String(err.message||'识别失败').slice(0,240),skipped:true});}
    }
    if(!results.length)throw new Error('没有可录入的内容。'+issues.slice(0,3).map(issue=>issue.title+'：'+issue.message).join('；'));
    if(token===ocrVersion)beginBatch(results,'photo',view==='import',issues);
  } catch(err) {if(token===ocrVersion)importError=err.message||'识别失败，请稍后重试';}
  finally{if(token===ocrVersion){loading=false;render();}}
}
const requests = new Map();
let requestSequence=0;
function nativeRequest(payload) {
  return new Promise((resolve,reject)=>{
    const id = crypto.randomUUID ? crypto.randomUUID() : 'req'+Date.now()+'-'+(++requestSequence);
    const timeout = setTimeout(()=>{requests.delete(id);reject(new Error('识别超时，请检查网络和模型服务'));},95000);
    requests.set(id,{resolve,reject,timeout});try{native.recognize(id,JSON.stringify(payload));}catch(err){clearTimeout(timeout);requests.delete(id);reject(err);}
  });
}
window.onNativeResult = (id, success, payload) => {
  const req = requests.get(id); if (!req) return;
  clearTimeout(req.timeout); requests.delete(id);
  if (success) { try { req.resolve(JSON.parse(payload)); } catch { req.reject(new Error('模型返回的数据不是有效 JSON')); } }
  else req.reject(new Error(payload));
};
function manualEdit() {
  const c = importing[importIndex];
  if(!c||chatBusy)return;
  document.querySelector('#modal-root').innerHTML = `<div class="modal-overlay"><section class="modal edit-fields" role="dialog" aria-modal="true" aria-label="手动编辑草稿"><h2>手动编辑</h2><label class="field">名称<input id="edit-title" maxlength="160" value="${e(c.title)}"></label><label class="field">科目<input id="edit-subject" maxlength="60" value="${e(c.subject)}"></label><label class="field">${c.kind==='formula'?'正确公式（LaTeX）':'题干'}<textarea id="edit-source">${e(c.kind==='formula'?c.latex:c.stem)}</textarea></label>${c.kind==='formula'?`<label class="field">适用条件<textarea id="edit-cue">${e(c.cue||'')}</textarea></label><label class="field">混淆项（每行一条，3～8 条）<textarea id="edit-variants">${e(c.distractors.join('\n'))}</textarea></label>`:`<label class="field">选项（每行一条）<textarea id="edit-variants">${e(c.options.join('\n'))}</textarea></label><label class="field">正确答案序号（从 1 开始）<input id="edit-answer" type="number" min="1" max="${c.options.length}" value="${c.answer+1}"></label>`}<div id="edit-error" class="error-panel" role="alert" hidden></div><button class="primary" data-act="save-edit">保存修改</button><button class="secondary" data-act="close-modal">取消</button></section></div>`;
}
async function sendChat() {
  const c=importing[importIndex],instruction=chatDraft.trim();if(!c||chatBusy||!instruction)return;
  if(!native){chatError='AI 对话请在安卓 App 中使用并配置接口；也可以直接手动编辑。';render();return;}
  if(!state.settings.endpoint||!state.settings.model||!state.settings.hasKey){chatError='请先在设置中配置 AI 接口、模型和 API Key，或使用手动编辑。';render();return;}
  const token=batchVersion,index=importIndex,thread=chatThreads[index]||(chatThreads[index]=[]);
  const history=thread.filter(m=>m.wire).slice(-12).map(m=>({role:m.role,content:m.wire}));
  const content='当前最新草稿：\n'+JSON.stringify(pickContent(c))+'\n本次修改指令：\n'+instruction;
  const user={role:'user',text:instruction};thread.push(user);chatBusy=true;chatDraft='';chatError='';render();
  try {
    const messages=[{role:'system',content:chatSystemPrompt(c.kind)},...history,{role:'user',content}];
    const image=importSource==='photo'?draftPictures[c.imageIndex||0]?.data:null;
    const raw=await nativeRequest({messages,...(image?{image}:{})});
    const result=parseChatResult(raw,c.kind,renderMath);
    if(token!==batchVersion||index!==importIndex)return;
    importing[index]={...c,...result.item};user.wire=content;
    thread.push({role:'assistant',text:result.reply,wire:JSON.stringify(result)});
  }catch(err){if(token===batchVersion&&index===importIndex){chatError=err.message||'修改失败';if(!chatDraft)chatDraft=instruction;}}
  finally{if(token===batchVersion&&index===importIndex){chatBusy=false;render();}}
}
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-act]'); if (!button || button.disabled) return;
  const act = button.dataset.act;
  if (act === 'close-modal') { pendingDeletion=null;closeModal(); return; }
  if (act === 'home') { closeModal();editing=false;selectedIds.clear();view = 'home'; render(); return; }
  if (act === 'kind') { kind = button.dataset.kind; subject = '全部';editing=false;selectedIds.clear();render(); return; }
  if (act === 'start') { const s = state.sessions[sessionKey()];if(!state.cards.some(c=>c.kind===kind)){view='import';importKind=kind;importError='';render();return;}if(s?.finished&&s.day===day()){start('daily',nextRoundSize(s)>0);return;}if (!remaining(s) && !dueCards().length) { view = 'library'; render(); } else start(); return; }
  if (act === 'next-round') { start('daily',true);return; }
  if (act === 'focus') { start('focus'); return; }
  if (['settings','library','import'].includes(act)) { view = act;editing=false;selectedIds.clear();if(act === 'import') { importKind = kind; importError = ''; } render(); return; }
  if (act === 'filter') { subject = button.dataset.value;selectedIds.clear();render(); return; }
  if (act === 'edit-library') {editing=!editing;selectedIds.clear();render();return;}
  if (act === 'toggle-card' && editing) {const id=button.dataset.id;if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);render();return;}
  if (act === 'select-all' && editing) {const ids=state.cards.filter(c=>c.kind===kind&&(subject==='全部'||c.subject===subject)).map(c=>c.id);if(ids.every(id=>selectedIds.has(id)))ids.forEach(id=>selectedIds.delete(id));else ids.forEach(id=>selectedIds.add(id));render();return;}
  if (act === 'delete-selected' && editing && selectedIds.size) {pendingDeletion=new Set(selectedIds);modal('删除所选 '+pendingDeletion.size+' 项？','所选内容和复习进度将被删除，无法撤销。',[{act:'confirm-delete',label:'删除 '+pendingDeletion.size+' 项'},{act:'close-modal',label:'取消'}]);return;}
  if (act === 'confirm-delete' && pendingDeletion) {const before=copy(state),count=removeCards(state,pendingDeletion);if(save()){pendingDeletion=null;selectedIds.clear();editing=false;subject='全部';closeModal();toast('已删除 '+count+' 项');}else{state=before;closeModal();pendingDeletion=null;}render();return;}
  if (act === 'answer') { const s = getCurrentSession(); if(s.current.revealed) return; reveal(s,state.cards,Number(button.dataset.index)); save(); render(); return; }
  if (act === 'reveal') { reveal(getCurrentSession(),state.cards,null); save(); render(); return; }
  if (act === 'grade') { onGrade(button.dataset.outcome); return; }
  if (act === 'undo' || act === 'previous') { previous(act === 'undo'); return; }
  if (act === 'master') { const s=getCurrentSession(),c=state.cards.find(c=>c.id===s.current.question.cardId);if(c.mastered){unmarkMastered(c,Object.values(state.sessions));toast('已取消标熟');}else{markMastered(s,state.cards);toast('已标熟，30 天后再见；顶部可撤销');}save();render();return; }
  if (act === 'unmaster') { unmarkMastered(state.cards.find(c=>c.id===button.dataset.id),Object.values(state.sessions)); save(); toast('已恢复原来的复习安排与本场进度'); render(); return; }
  if (act === 'exit') { modal('休息一下？','本场进度已经保存在手机。下次打开，接着这一题继续。',[{act:'home',label:'保存并回到首页'},{act:'close-modal',label:'继续巩固'}]); return; }
  if (act === 'save-settings') {
    const endpoint = document.querySelector('#api-endpoint').value.trim();
    if (endpoint && (!endpoint.startsWith('https://') || !endpoint.endsWith('/chat/completions'))) { toast('请填写以 https:// 开头、/chat/completions 结尾的完整地址'); return; }
    state.settings.limit = Number(document.querySelector('#daily-limit').value);
    state.settings.endpoint = endpoint; state.settings.model = document.querySelector('#api-model').value.trim();
    const key = document.querySelector('#api-key').value.trim();
    if (native) { try { native.saveSettings(JSON.stringify({...state.settings,key})); Object.assign(state.settings,JSON.parse(native.getSettings())); } catch { toast('密钥保存失败，请重试'); return; } }
    else if (key) { browserKey = key; state.settings.hasKey = true; }
    save(); toast('设置已保存'); view = 'home'; render(); return;
  }
  if (act === 'export') { exportBackup(); return; }
  if (act === 'import-kind') { if(loading)return;importKind=button.dataset.kind;jsonError='';render();return; }
  if (act === 'import-mode') { if(loading)return;importMode=button.dataset.mode;render();return; }
  if (act === 'copy-prompt') {await copyPrompt();return;}
  if (act === 'clear-json') {clearJsonInput();return;}
  if (act === 'clear-photos') {clearPhotoInput();return;}
  if (act === 'parse-json') {previewJson();return;}
  if (act === 'resume-import') {if(loading)return;kind=importing[importIndex].kind;importKind=kind;subject='全部';view='confirm';render();return;}
  if (act === 'recognize') { await recognize(); return; }
  if (act === 'edit-import') {view='chat';chatError='';render();return;}
  if (act === 'back-confirm') {view='confirm';render();return;}
  if (act === 'manual-edit') {manualEdit();return;}
  if (act === 'send-chat') {await sendChat();return;}
  if (act === 'save-edit') {
    if(chatBusy)return;
    const c = copy(importing[importIndex]); c.title = document.querySelector('#edit-title').value.trim();c.subject=document.querySelector('#edit-subject').value.trim();
    const source = document.querySelector('#edit-source').value.trim(), variants = document.querySelector('#edit-variants').value.split('\n').filter(s=>s.trim());
    if(c.kind === 'formula') { c.latex=source;c.distractors=variants;c.cue=document.querySelector('#edit-cue').value.trim(); } else { c.stem=source;c.options=variants;c.answer=Number(document.querySelector('#edit-answer').value)-1; }
    try { importing[importIndex]=validateCandidate(c);const thread=chatThreads[importIndex]||(chatThreads[importIndex]=[]);thread.push({role:'assistant',text:'已按你的手动编辑更新草稿。后续修改将以这份草稿为准。'});closeModal();chatError='';render(); } catch(err) {const error=document.querySelector('#edit-error');error.hidden=false;error.textContent=err.message;}return;
  }
  if(act==='import-all'){modal('将剩余 '+(importing.length-importIndex)+' 条全部入库？','将剩余内容加入题库，相同内容会自动跳过。',[{act:'confirm-import-all',label:'确认全部入库'},{act:'close-modal',label:'继续编辑'}]);return;}
  if(act==='confirm-import-all'){if(commitImport(importing.length-importIndex)){closeModal();view='confirm';render();}return;}
  if (act === 'confirm-import' || act === 'skip-import') {
    if(chatBusy)return;
    if(act === 'confirm-import') {
      if(!commitImport())return;
    }else{
      importIndex++;chatDraft='';chatError='';
    }
    render();return;
  }
});
document.addEventListener('change', event=>{if(event.target.id==='photos')loadPhotos(event.target.files);if(event.target.id==='json-file')loadJsonFile(event.target.files[0]);});
document.addEventListener('input',event=>{if(event.target.id==='json-input'){jsonLoadVersion++;if(jsonReading){jsonReading=false;const button=document.querySelector('[data-act="parse-json"]');if(button){button.disabled=loading;button.innerHTML='校验并预览 '+icon('arrow');}}jsonDraft=event.target.value;}if(event.target.id==='chat-input')chatDraft=event.target.value;});
document.addEventListener('keydown',event=>{if((event.key===' '||event.key==='Enter')&&event.target.matches('[role="checkbox"][data-act="toggle-card"]')){event.preventDefault();event.target.click();}});
window.onAndroidBack = () => {
  if(document.querySelector('#modal-root').innerHTML) { closeModal();return; }
  if(editing){editing=false;selectedIds.clear();render();return;}
  if(view==='chat'){view='confirm';render();return;}
  if(view!=='home') { view='home';save();render(); } else native?.closeApp();
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();else if(view==='review')render();});
// Read-only inspection for development and Android smoke verification.
window.demo = { getState:()=>copy(state), getView:()=>view, getActive:()=>active, validateCandidate };
save();render();
