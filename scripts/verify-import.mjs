import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {formula,secondFormula,wrong,jsonFor} from '../tests/import-fixtures.mjs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:412,height:868},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await context.addInitScript(({formula})=>{
 window.mockCalls=[];window.mockReplies=[];window.failSave=false;window.photoResult={format:'carmanline.formula.v1',items:[formula]};
 window.Android={loadProgress:()=>localStorage.getItem('liushi-demo-v1')||'',saveProgress:json=>{if(window.failSave)throw new Error('Synthetic disk failure');localStorage.setItem('liushi-demo-v1',json);},getSettings:()=>JSON.stringify({endpoint:'https://example.invalid/chat/completions',model:'test-vision',hasKey:true}),clearPhotos:()=>{},copyText:text=>{window.copiedPrompt=text;},recognize:(id,json)=>{const payload=JSON.parse(json);window.mockCalls.push(payload);const response=payload.messages?window.mockReplies.shift():{value:window.photoResult};if(window.mockHold){window.heldReply={id,response};return;}setTimeout(()=>window.onNativeResult(id,!response?.error,response?.error||JSON.stringify(response?.value||{})),30);}};
},{formula});
const p=await context.newPage(),errors=[];p.on('pageerror',err=>errors.push(err.message));
const click=selector=>p.locator(selector).first().click();
const state=()=>p.evaluate(()=>window.demo.getState());
async function openJson(kind='formula') {await p.evaluate(()=>{for(let i=0;i<3&&window.demo.getView()!=='home';i++)window.onAndroidBack();});await click('[data-act="import"]');await click(`[data-act="import-kind"][data-kind="${kind}"]`);await click('[data-mode="json"]');}
async function paste(items,kind='formula') {await p.locator('#json-input').fill(jsonFor(items,kind));await click('[data-act="parse-json"]');}
async function queue(value,error) {await p.evaluate(({value,error})=>window.mockReplies.push({value,error}),{value,error});}
try {
 await p.goto(process.env.DEMO_URL||'http://127.0.0.1:4174');await openJson();await click('[data-act="copy-prompt"]');
 assert.match(await p.evaluate(()=>window.copiedPrompt),/carmanline.formula.v1/);
 await p.locator('#json-input').fill('{invalid');await click('[data-act="parse-json"]');assert.match(await p.locator('[role="alert"]').textContent(),/格式错误/);assert.equal((await state()).cards.length,0);
 await paste([formula,secondFormula]);assert.equal((await state()).cards.length,0,'Preview alone never writes data');
 await click('[data-act="edit-import"]');assert.equal(await p.locator('#chat-input').count(),1);await click('[data-act="manual-edit"]');
 await p.locator('#edit-source').fill('\\invalidCommand');await click('[data-act="save-edit"]');assert.equal(await p.locator('#edit-error').isVisible(),true);
 await p.locator('#edit-source').fill(formula.latex);await p.locator('#edit-title').fill('手动修改 · 平方差');await p.locator('#edit-cue').fill('实数范围');await click('[data-act="save-edit"]');
 await click('[data-act="back-confirm"]');assert.match(await p.locator('.confirm-card h2').textContent(),/手动修改/);
 await click('[data-act="import-all"]');await click('[data-act="close-modal"]');assert.equal((await state()).cards.length,0);
 await p.evaluate(()=>window.failSave=true);await click('[data-act="import-all"]');await click('[data-act="confirm-import-all"]');assert.equal((await state()).cards.length,0,'Failed persistence rolls back the entire batch');
 await p.evaluate(()=>window.failSave=false);await click('[data-act="confirm-import-all"]');assert.equal((await state()).cards.length,2);
 const imported=(await state()).cards.map(({kind,subject,title,latex,cue,distractors})=>({kind,subject,title,latex,cue,distractors}));
 await openJson();await paste(imported);await click('[data-act="import-all"]');await click('[data-act="confirm-import-all"]');assert.equal((await state()).cards.length,2,'Repeated JSON does not duplicate entries');
 await openJson('wrong');await click('[data-act="copy-prompt"]');assert.match(await p.evaluate(()=>window.copiedPrompt),/carmanline.wrong.v1/);
 await p.locator('#json-file').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(jsonFor([wrong],'wrong'))});
 await p.waitForFunction(()=>document.querySelector('#json-input').value.includes('carmanline.wrong.v1'));await click('[data-act="parse-json"]');
 assert.equal(await p.locator('.draft-option.right').count(),1);assert.match(await p.locator('.draft-option.right').textContent(),/^A\./);
 await p.evaluate(()=>document.querySelector('#toast').classList.remove('visible'));await p.screenshot({path:'dist/carmanline-v031-json-preview.png',animations:'disabled'});
 await click('[data-act="edit-import"]');await p.locator('#chat-input').fill('把名称改成导数练习');await queue({reply:'已修改名称',item:{...wrong,title:'导数练习'}});await click('[data-act="send-chat"]');
 await p.waitForFunction(()=>!document.querySelector('.chat-pending'));
 assert.equal(await p.evaluate(()=>window.mockCalls[0].image===undefined),true,'JSON conversations are text-only');
 await click('[data-act="back-confirm"]');await click('[data-act="confirm-import"]');assert.equal((await state()).cards.filter(c=>c.kind==='wrong').length,1);

 await openJson();await click('[data-mode="photo"]');
 const pixels=await p.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;canvas.getContext('2d').fillRect(0,0,200,100);return canvas.toDataURL('image/png').split(',')[1];});
 await p.locator('#photos').setInputFiles({name:'formula.png',mimeType:'image/png',buffer:Buffer.from(pixels,'base64')});
 await p.waitForFunction(()=>!document.querySelector('[data-act=recognize]').disabled);await click('[data-act="recognize"]');await p.locator('.confirm-card').waitFor();
 assert.equal(await p.locator('.preview-source').count(),0);assert.equal(await p.locator('[data-act="view-source"]').count(),0);
 await openJson();await click('[data-mode="photo"]');
 const alternate=await p.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=80;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,80,80);return canvas.toDataURL('image/png').split(',')[1];});
 await p.locator('#photos').setInputFiles({name:'another-photo.png',mimeType:'image/png',buffer:Buffer.from(alternate,'base64')});await p.waitForFunction(()=>document.querySelectorAll('.upload-previews img').length===1);await click('[data-act="resume-import"]');await click('[data-act="edit-import"]');
 await p.locator('#chat-input').fill('改用完全平方公式，保留当前科目');await queue({reply:'已同步调整公式和混淆项',item:secondFormula});await click('[data-act="send-chat"]');
 await p.waitForFunction(()=>!document.querySelector('.chat-pending'));
 assert.equal(await p.locator('.confirm-card h2').textContent(),secondFormula.title);
 const last=await p.evaluate(()=>window.mockCalls[window.mockCalls.length-1]);assert.ok(last.image.startsWith('data:image/'));assert.equal(last.image,await p.evaluate(()=>window.mockCalls.find(call=>call.prompt).image),'A resumed draft keeps its original image after selecting a different photo');assert.equal(last.messages[0].role,'system');assert.ok(last.messages[last.messages.length-1].content.includes(formula.title));
 await p.evaluate(()=>{document.querySelector('#toast').classList.remove('visible');document.querySelector('.chat-current').open=true;});await p.screenshot({path:'dist/carmanline-v031-chat-preview.png',animations:'disabled'});await p.evaluate(()=>document.querySelector('.chat-current').open=false);
 const before=await p.locator('.confirm-card h2').textContent();await p.locator('#chat-input').fill('测试非法结果');await queue({reply:'错误结果',item:{...formula,distractors:[]}});await click('[data-act="send-chat"]');await p.waitForFunction(()=>!document.querySelector('.chat-pending'));
 assert.equal(await p.locator('.confirm-card h2').textContent(),before);assert.match(await p.locator('[role="alert"]').textContent(),/原草稿已保留/);
 await p.locator('#chat-input').fill('再次修改');await queue(null,'Synthetic network failure');await click('[data-act="send-chat"]');await p.waitForFunction(()=>!document.querySelector('.chat-pending'));assert.equal(await p.locator('.confirm-card h2').textContent(),before);
 await click('[data-act="manual-edit"]');await p.locator('#edit-title').fill('手动同步后的标题');await click('[data-act="save-edit"]');
 await p.locator('#chat-input').fill('补充适用条件');await queue({reply:'已更新条件',item:{...secondFormula,title:'手动同步后的标题',cue:'a、b 为实数，注意交叉项'}});await click('[data-act="send-chat"]');await p.waitForFunction(()=>!document.querySelector('.chat-pending'));
 assert.ok(await p.evaluate(()=>window.mockCalls[window.mockCalls.length-1].messages.slice(-1)[0].content.includes('手动同步后的标题')));

 for(const size of [{width:320,height:640},{width:412,height:868}]){await p.setViewportSize(size);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Chat fits phone width');assert.ok(await p.locator('[data-act="send-chat"]').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'Chat composer stays visible');}
 await click('[data-act="back-confirm"]');await click('[data-act="confirm-import"]');assert.equal((await state()).cards.length,4);
 await p.reload();assert.equal((await state()).cards.length,4);assert.ok((await state()).cards.some(c=>c.title==='手动同步后的标题'));
 await openJson();await paste([formula]);await click('[data-act="edit-import"]');await p.evaluate(()=>window.mockHold=true);await queue({reply:'旧批次回复',item:{...formula,title:'旧回复不应覆盖新批次'}});await p.locator('#chat-input').fill('延迟修改');await click('[data-act="send-chat"]');
 await openJson();await paste([{...secondFormula,title:'新批次草稿'}]);await p.evaluate(()=>{const held=window.heldReply;window.onNativeResult(held.id,true,JSON.stringify(held.response.value));});
 assert.equal(await p.locator('.confirm-card h2').textContent(),'新批次草稿','Late AI replies cannot overwrite a new import batch');assert.equal((await state()).cards.length,4);
 const offline=await browser.newContext({viewport:{width:412,height:868}}),o=await offline.newPage();await o.goto(process.env.DEMO_URL||'http://127.0.0.1:4174');await o.locator('[data-act="import"]').click();await o.locator('[data-kind="wrong"]').click();await o.locator('[data-mode="json"]').click();await o.locator('#json-input').fill(jsonFor([wrong],'wrong'));await o.locator('[data-act="parse-json"]').click();await o.locator('[data-act="confirm-import"]').click();assert.equal(await o.evaluate(()=>window.demo.getState().cards.length),1);assert.equal(await o.evaluate(()=>window.demo.getState().settings.endpoint),'');await offline.close();
 assert.deepEqual(errors,[]);
 const report={status:'passed',version:'0.3.1',aiTransport:'deterministic native-bridge test double; no external provider called',checks:['separate copyable prompts','invalid JSON leaves library unchanged','preview before write','manual edit validation','batch confirmation cancel','atomic save rollback and retry','duplicate import skip','wrong JSON file and correct answer','text-only JSON chat','photo recognition into draft','photo-backed conversation','valid AI result updates draft','invalid AI result preserves draft','network failure preserves draft','manual edits become next AI context','phone width 320 and 412 with visible composer','confirmed data persists after reload','late reply cannot overwrite new batch','offline JSON needs no bridge or API settings'],browserErrors:errors};
 await writeFile('dist/import-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
