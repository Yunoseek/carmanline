import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {run,connect,restart,home} from './android-test-client.mjs';
import {roundFixture,waitFixture} from '../tests/ui-fixtures.mjs';
assert.ok(run(['emu','avd','name']).includes('FormulaDemo'),'Use only this project’s disposable test emulator');
if(/versionCode=3\b/.test(run(['shell','dumpsys','package','app.formula.recall'])))run(['uninstall','app.formula.recall']);
run(['install','-r','dist/carmanline-v0.2.0.apk']);run(['shell','pm','clear','app.formula.recall']);restart();
let c=await connect();const fixture=roundFixture();fixture.settings.model='preserved-vision-model';fixture.settings.endpoint='https://example.invalid/chat/completions';
await c.evaluate(`Android.saveProgress(JSON.stringify(${JSON.stringify(fixture)}))`);
await c.evaluate(`Android.saveSettings(JSON.stringify({endpoint:'https://example.invalid/chat/completions',model:'preserved-vision-model',key:'test-only-v021-key'}))`);
c.close();run(['shell','am','force-stop','app.formula.recall']);
run(['install','-r','dist/carmanline-v0.2.1.apk']);restart();c=await connect();
assert.equal((await c.evaluate('window.demo.getState()')).cards.length,65);
assert.equal(JSON.parse(await c.evaluate('Android.getSettings()')).model,'preserved-vision-model');
assert.equal(JSON.parse(await c.evaluate('Android.getSettings()')).hasKey,true);
const session=()=>c.evaluate('window.demo.getState().sessions["formula:daily"]');
const firstIds=(await session()).items.map(i=>i.id);
assert.match(await c.evaluate('document.querySelector(".daily-task .task-foot").textContent'),/再巩固 30 个/);
await c.click('[data-act="start"]');let s=await session();assert.equal(s.round,2);assert.equal(s.items.length,30);assert.ok(s.items.every(i=>!firstIds.includes(i.id)));
const secondIds=s.items.map(i=>i.id),id=s.current.question.cardId;
await c.click(`.option[data-index="${s.current.question.options.findIndex(o=>o.correct)}"]`);
assert.equal(await c.evaluate('getComputedStyle(document.querySelector(".review-page")).animationName'),'none');
c.close();restart();c=await connect();await c.click('[data-act="start"]');s=await session();
assert.equal(s.round,2);assert.equal(s.current.question.cardId,id);assert.equal(s.current.revealed,true);
await c.click('[data-act="grade"][data-outcome="know"]');await c.click('[data-act="undo"]');assert.equal((await session()).current.question.cardId,id);
for(let n=0;n<80&&!(await session()).finished;n++) {
 if(await c.evaluate('Boolean(document.querySelector("[data-countdown]"))')) {
  // Advance only the disposable test runtime clock to avoid waiting through every tail interval.
  await c.evaluate('(()=>{const original=Date.now;Date.now=()=>original()+31000;document.dispatchEvent(new Event("visibilitychange"));})()');continue;
 }
 s=await session();if(!s.current.revealed)await c.click(`.option[data-index="${s.current.question.options.findIndex(o=>o.correct)}"]`);
 await c.click('[data-act="grade"][data-outcome="know"]');
}
assert.equal((await session()).finished,true);
assert.match(await c.evaluate('document.querySelector("[data-act=next-round]").textContent'),/再巩固 5 个/);
await c.capture('carmanline-v021-android-next-round.png');
await c.click('[data-act="next-round"]');s=await session();assert.equal(s.round,3);assert.equal(s.items.length,5);
assert.ok(s.items.every(i=>!firstIds.includes(i.id)&&!secondIds.includes(i.id)));
c.close();restart();c=await connect();await c.click('[data-act="start"]');assert.equal((await session()).round,3);assert.equal((await session()).items.length,5);

await c.evaluate(`Android.saveProgress(JSON.stringify(${JSON.stringify(waitFixture(Date.now(),8))}))`);
c.close();restart();c=await connect();await c.click('[data-act="start"]');
const seconds=await c.evaluate('Number(document.querySelector("[data-countdown]").textContent)');
await c.evaluate('window.waitRoot=document.querySelector(".wait-page");window.waitDigits=document.querySelector("[data-countdown]");window.replacements=0;new MutationObserver(records=>{window.replacements+=records.filter(r=>r.target.id==="app").length;}).observe(document.querySelector("#app"),{childList:true,subtree:true})');
await c.capture('carmanline-v021-android-countdown.png');await pause(1200);
assert.equal(await c.evaluate('window.waitRoot===document.querySelector(".wait-page")&&window.waitDigits===document.querySelector("[data-countdown]")&&window.replacements===0'),true);
assert.ok(await c.evaluate('Number(document.querySelector("[data-countdown]").textContent)')<seconds);
assert.equal(await c.evaluate('getComputedStyle(document.querySelector(".wait-page")).animationName'),'none');
await c.until('Boolean(document.querySelector(".review-heading"))');
assert.equal(await c.evaluate('getComputedStyle(document.querySelector(".review-page")).opacity'),'1');
const platform=await c.evaluate('({userAgent:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio})');
c.close();run(['shell','pm','clear','app.formula.recall']);restart();c=await connect();
assert.equal(await c.evaluate('window.demo.getState().cards.length'),0);await home(c);c.close();
const apkSha256=createHash('sha256').update(await readFile('dist/carmanline-v0.2.1.apk')).digest('hex');
const report={status:'passed',version:'0.2.1',apkSha256,platform,checks:['same-signature v0.2.0 to v0.2.1 update','user library and API settings preserved','next 30 distinct cards from home','no page fade on answer','extra round and revealed answer survive force-stop','undo within extra round','summary offers remaining five','third round persists','countdown changes digits without replacing page','countdown automatically resumes','fresh install remains empty']};
await writeFile('dist/android-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
