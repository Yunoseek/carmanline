import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {roundFixture,waitFixture} from '../tests/ui-fixtures.mjs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page=await browser.newPage({viewport:{width:412,height:868},isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',err=>errors.push(err.message));
await page.clock.install();
const state=()=>page.evaluate(()=>window.demo.getState());
const session=async()=>(await state()).sessions['formula:daily'];
const click=selector=>page.locator(selector).click();
async function load(fixture) {
 await page.close();page=await browser.newPage({viewport:{width:412,height:868},isMobile:true,hasTouch:true});
 page.on('pageerror',err=>errors.push(err.message));await page.clock.install();await page.clock.pauseAt(new Date());
 await page.addInitScript(data=>{if(!localStorage.getItem('liushi-demo-v1'))localStorage.setItem('liushi-demo-v1',JSON.stringify(data));},fixture);
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:4174');
}
try {
 await page.goto(process.env.DEMO_URL||'http://127.0.0.1:4174');
 await load(waitFixture(await page.evaluate(()=>Date.now()),4));await click('[data-act="start"]');
 const start=Number(await page.locator('[data-countdown]').textContent());
 await page.evaluate(()=>{window.waitRoot=document.querySelector('.wait-page');window.waitDigits=document.querySelector('[data-countdown]');window.pageReplacements=0;new MutationObserver(records=>{window.pageReplacements+=records.filter(r=>r.target.id==='app').length;}).observe(document.querySelector('#app'),{childList:true,subtree:true});});
 await page.clock.fastForward(1100);
 assert.ok(Number(await page.locator('[data-countdown]').textContent())<start);
 assert.equal(await page.evaluate(()=>window.waitRoot===document.querySelector('.wait-page')&&window.waitDigits===document.querySelector('[data-countdown]')&&window.pageReplacements===0),true,'Countdown updates its existing digit node without replacing the page');
 assert.equal(await page.locator('.wait-page').evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.clock.fastForward(3100);assert.equal(await page.locator('.review-heading').count(),1,'Waiting ends automatically');
 assert.equal(await page.locator('.review-page').evaluate(el=>getComputedStyle(el).animationName),'none');
 await click('[data-act="reveal"]');assert.equal(await page.locator('.review-page').evaluate(el=>getComputedStyle(el).opacity),'1');
 await page.screenshot({path:'dist/carmanline-v021-review.png'});

 const fixture=roundFixture(await page.evaluate(()=>Date.now())),firstIds=fixture.sessions['formula:daily'].items.map(i=>i.id);
 await load(fixture);assert.equal(await page.locator('.big-count').textContent(),'✓');
 assert.match(await page.locator('.daily-task .task-foot').textContent(),/再巩固 30 个/);
 await click('[data-act="start"]');let s=await session();assert.equal(s.round,2);assert.equal(s.items.length,30);assert.ok(s.items.every(i=>!firstIds.includes(i.id)));
 const id=s.current.question.cardId,right=s.current.question.options.findIndex(o=>o.correct);
 await click(`.option[data-index="${right}"]`);await page.reload();await click('[data-act="start"]');
 s=await session();assert.equal(s.round,2);assert.equal(s.current.question.cardId,id);assert.equal(s.current.revealed,true);
 await click('[data-act="grade"][data-outcome="know"]');await click('[data-act="undo"]');assert.equal((await session()).current.question.cardId,id);
 // Exercise the complete second batch through product controls, keeping real spacing via the virtual clock.
 for(let n=0;n<80&&!(await session()).finished;n++) {
  if(await page.locator('[data-countdown]').count()){await page.clock.fastForward(31000);continue;}
  s=await session();if(!s.current.revealed)await click(`.option[data-index="${s.current.question.options.findIndex(o=>o.correct)}"]`);
  await click('[data-act="grade"][data-outcome="know"]');
 }
 assert.equal((await session()).finished,true);assert.match(await page.locator('[data-act="next-round"]').textContent(),/再巩固 5 个/);
 await page.screenshot({path:'dist/carmanline-v021-next-round.png'});
 await click('[data-act="next-round"]');s=await session();assert.equal(s.round,3);assert.equal(s.items.length,5);
 assert.ok(s.items.every(i=>!firstIds.includes(i.id)));
 for(let n=0;n<25&&!(await session()).finished;n++) {
  if(await page.locator('[data-countdown]').count()){await page.clock.fastForward(31000);continue;}
  s=await session();if(!s.current.revealed)await click(`.option[data-index="${s.current.question.options.findIndex(o=>o.correct)}"]`);
  await click('[data-act="grade"][data-outcome="know"]');
 }
 assert.equal((await session()).finished,true);assert.equal(await page.locator('[data-act="next-round"]').count(),0);
 await click('[data-act="home"]');assert.match(await page.locator('.daily-task .task-foot').textContent(),/今日已完成/);
 await click('[data-act="start"]');assert.equal(await page.locator('.finish-detail').count(),1,'Exhausted pool returns to completion summary');
 assert.deepEqual(errors,[]);
 const report={status:'passed',version:'0.3.1',checks:['countdown keeps page and digit DOM nodes','no whole-page fade on waiting or review','wait automatically resumes','home starts next 30 distinct cards','second-round answer survives reload','undo within extra round','summary starts remaining five','no repeats across three rounds','exhausted pool has no extra-round entry'],browserErrors:errors};
 await writeFile('dist/review-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
