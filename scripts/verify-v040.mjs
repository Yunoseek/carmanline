import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:320,height:690},isMobile:true,hasTouch:true});
await context.addInitScript(()=>{
  window.Android={
    loadProgress:()=>localStorage.getItem('liushi-demo-v1')||'',
    saveProgress:json=>localStorage.setItem('liushi-demo-v1',json),
    getSettings:()=>JSON.stringify({endpoint:'https://example.invalid/chat/completions',model:'fixture-model',hasKey:true}),
    copyText:text=>{window.copied=text;},closeApp:()=>{},clearPhotos:()=>{},
    recognize:(id,payload)=>setTimeout(()=>window.onNativeResult(id,true,JSON.stringify(window.photoResult)),20),
  };
});
const p=await context.newPage(),errors=[];
p.on('pageerror',err=>errors.push(err.message));
const click=(action,selector='')=>p.locator(`[data-act="${action}"]${selector}`).first().click();
const state=()=>p.evaluate(()=>window.demo.getState());
const goHome=()=>p.evaluate(()=>{for(let i=0;i<3&&window.demo.getView()!=='home';i++)window.onAndroidBack();});
const item=(n)=>({kind:'formula',subject:'数学',title:`公式 ${n}`,latex:`x=${n}`,cue:'',distractors:[`x=${n+10}`,`x=${n+11}`,`x=${n+12}`]});
const envelope=items=>JSON.stringify({format:'carmanline.formula.v1',items});
async function importJson(items) {
  await p.locator('#json-input').fill(envelope(items));await click('parse-json');
  await p.locator('.confirm-page').waitFor();
}
async function saveBatch() {await click('import-all');await click('confirm-import-all');await p.locator('.import-result').waitFor();}
const correct=()=>p.evaluate(()=>window.demo.getState().sessions['formula:daily'].current.question.options.findIndex(option=>option.correct));

try {
  await p.goto(process.env.DEMO_URL || pathToFileURL('web/index.html').href);
  await click('import');await click('import-mode','[data-mode="json"]');
  const malformed='{"format":"carmanline.formula.v1",\n"items":[,]}';
  await p.locator('#json-input').fill(malformed);await click('parse-json');
  assert.match(await p.locator('.error-panel').textContent(),/第 2 行，第 10 列/);
  assert.equal(await p.locator('#json-input').inputValue(),malformed);

  const fraction={...item(1),latex:'\\dfrac{x}{2}',cue:'x→0'};
  const alias={...item(2),latex:'\\frac{x}{2}',cue:'x \\to 0'};
  const invalid={...item(3)};delete invalid.latex;
  const mixed=envelope([fraction,invalid,alias]);
  await p.locator('#json-file').setInputFiles({name:'batch.json',mimeType:'application/json',buffer:Buffer.from(mixed)});
  assert.equal(await p.locator('.selected-filename').textContent(),'batch.json');
  await click('parse-json');await saveBatch();
  assert.match(await p.locator('.result-count').textContent(),/新增 1 · 跳过（重复） 1 · 失败 1/);
  assert.match(await p.locator('.result-failures').textContent(),/#2.*latex/s);
  assert.equal(await p.locator('#json-input').inputValue(),'');assert.equal(await p.locator('.selected-filename').count(),0);
  await click('copy-failed-json');assert.deepEqual(JSON.parse(await p.evaluate(()=>window.copied)).items,[invalid]);
  await click('retry-failed-json');assert.equal(await p.locator('#json-input').inputValue(),envelope([invalid]));

  await importJson([item(3)]);await click('confirm-import');await click('close-import-result');
  assert.equal(await p.locator('#json-input').inputValue(),'');await click('undo-json-clear');
  assert.equal(await p.locator('#json-input').inputValue(),envelope([item(3)]));
  await click('parse-json');assert.match(await p.locator('.error-panel').textContent(),/刚导入过/);

  await click('import-mode','[data-mode="manual"]');await click('new-manual');
  for(const [id,value] of Object.entries({title:'手动同义项',subject:'数学',source:alias.latex,cue:alias.cue,variants:alias.distractors.join('\n')}))await p.locator(`#edit-${id}`).fill(value);
  assert.match(await p.locator('#edit-duplicate').textContent(),/题库里已有/);
  await click('preview-existing');await p.locator('#edit-duplicate .confirm-card').waitFor();
  await click('save-edit');await click('keep-duplicate');await click('confirm-keep-duplicate');
  assert.equal(await p.locator('#duplicate-note-error').isVisible(),true);
  await p.locator('#duplicate-note').fill('用于区分导数练习');await click('confirm-keep-duplicate');await click('close-import-result');
  assert.equal((await state()).cards.find(card=>card.title==='手动同义项').duplicateNote,'用于区分导数练习');

  await goHome();await click('import');await click('import-mode','[data-mode="photo"]');
  await p.evaluate(result=>{window.photoResult=result;}, {items:[alias]});
  await p.locator('#photos').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAE/wGJgQP7kgAAAABJRU5ErkJggg==','base64')});
  await click('recognize');await p.locator('.duplicate-notice').waitFor();await click('confirm-import');
  assert.match(await p.locator('.result-count').textContent(),/跳过（重复） 1 · 失败 0/);await click('close-import-result');

  await goHome();await click('import');await click('import-mode','[data-mode="json"]');
  await importJson(Array.from({length:8},(_,i)=>item(i+4)));
  await saveBatch();await click('close-import-result');await goHome();await click('start');
  assert.match(await p.locator('.progress-count').textContent(),/0\/30 次记起/);
  const beforeSkip=(await state()).sessions['formula:daily'].current.question.cardId;
  await click('skip-question');let session=(await state()).sessions['formula:daily'];
  assert.notEqual(session.current.question.cardId,beforeSkip);assert.equal(session.items.at(-1).id,beforeSkip);
  await p.reload();await click('start');assert.deepEqual((await state()).sessions['formula:daily'],session);

  await click('answer',`[data-index="${(await correct()+1)%4}"]`);
  const buttons=await p.locator('.review-actions button').evaluateAll(elements=>elements.map(element=>{
    const box=element.getBoundingClientRect();return {top:box.top,left:box.left,right:box.right,height:box.height,width:box.width,overflow:element.scrollWidth>element.clientWidth};
  }));
  assert.equal(buttons.length,2);assert.equal(buttons[0].top,buttons[1].top);assert.equal(buttons[0].height,buttons[1].height);
  assert.equal(Math.round(buttons[1].left-buttons[0].right),12);assert.ok(buttons.every(button=>button.height>=48&&button.width>=48&&!button.overflow));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),320);
  await p.screenshot({path:'dist/carmanline-v040-review.png',fullPage:true});
  await click('grade','[data-outcome="slip"]');assert.match(await p.locator('.progress-count').textContent(),/1\/30 次记起/);
  await click('answer',`[data-index="${await correct()}"]`);assert.equal(await p.locator('.review-actions button').count(),1);

  await goHome();
  const snapshot=await state(), original=snapshot.cards.find(card=>card.title===fraction.title);
  snapshot.cards.push({...original,id:'historical-duplicate',title:'旧版重复公式',latex:alias.latex,duplicateNote:undefined,mistakes:6});
  await p.addInitScript(data=>{
    if(sessionStorage.getItem('loaded-v040-merge-fixture'))return;
    localStorage.setItem('liushi-demo-v1',JSON.stringify(data));
    sessionStorage.setItem('loaded-v040-merge-fixture','yes');
  },snapshot);
  await p.reload();assert.ok((await state()).cards.some(card=>card.id==='historical-duplicate'));
  await click('library');await click('scan-duplicates');await click('preview-exact-merge');
  await p.locator('input[value="historical-duplicate"]').check();await click('confirm-formula-merge');
  assert.equal((await state()).cards.find(card=>card.id==='historical-duplicate').mistakes,(original.mistakes||0)+6);
  assert.equal((await state()).cards.some(card=>card.id===original.id),false);
  await p.reload();await click('library');await click('scan-duplicates');await click('merge-bin');await click('restore-formula-merge');
  assert.ok((await state()).cards.some(card=>card.id===original.id));assert.deepEqual((await state()).mergedFormulas,[]);
  assert.deepEqual(errors,[]);
  const report={status:'passed',version:'0.4.0',checks:['320px answer layout','slip grading','queue skip and reload','JSON syntax location','JSON mixed import, copy, refill and undo','duplicate import via JSON, photo and manual','merge and restore after reload'],browserErrors:errors};
  await writeFile('dist/v040-web-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally { await browser.close(); }
