import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {run,connect,restart,home} from './android-test-client.mjs';
import {legacyFixture} from '../tests/ui-fixtures.mjs';
import {wrong,jsonFor} from '../tests/import-fixtures.mjs';
assert.ok(run(['emu','avd','name']).includes('FormulaDemo'),'Use only the disposable project emulator');
if(/versionCode=4\b/.test(run(['shell','dumpsys','package','app.formula.recall'])))run(['uninstall','app.formula.recall']);
run(['install','-r','dist/carmanline-v0.2.1.apk']);run(['shell','pm','clear','app.formula.recall']);restart();
let c=await connect();const fixture=legacyFixture();fixture.settings.endpoint='https://127.0.0.1:1/chat/completions';fixture.settings.model='preserved-test-model';
await c.evaluate(`Android.saveProgress(JSON.stringify(${JSON.stringify(fixture)}))`);
await c.evaluate(`Android.saveSettings(JSON.stringify({endpoint:'https://127.0.0.1:1/chat/completions',model:'preserved-test-model',key:'test-only-v030-key'}))`);
c.close();run(['shell','am','force-stop','app.formula.recall']);run(['install','-r','dist/carmanline-v0.3.0.apk']);restart();c=await connect();
let s=await c.evaluate('window.demo.getState()');assert.equal(s.cards.length,6);assert.ok(s.cards.every(card=>card.id.startsWith('custom-')));
assert.equal(s.settings.model,'preserved-test-model');assert.equal(JSON.parse(await c.evaluate('Android.getSettings()')).hasKey,true);
await c.click('[data-act="start"]');assert.equal(await c.evaluate('document.querySelectorAll(".option.correct").length'),1,'Existing revealed question survives update');await home(c);
await c.click('[data-act="import"]');await c.click('[data-act="import-kind"][data-kind="wrong"]');await c.click('[data-mode="json"]');await c.click('[data-act="copy-prompt"]');
assert.ok(await c.evaluate('document.querySelector("#toast").textContent.includes("已复制")'));
await mkdir('build/android',{recursive:true});await writeFile('build/android/Carmanline-import-test.json',jsonFor([wrong],'wrong'));
run(['push','build/android/Carmanline-import-test.json','/sdcard/Download/Carmanline-import-test.json']);
await c.click('#json-file');await pause(900);
function tree(){run(['shell','uiautomator','dump','/sdcard/carmanline-test-ui.xml']);return run(['shell','cat','/sdcard/carmanline-test-ui.xml']);}
function findNode(xml,predicate){return [...xml.matchAll(/<node\b[^>]*>/g)].map(m=>m[0]).find(predicate);}
function tapNode(node){assert.ok(node,'Expected Android document-picker control');const b=/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);assert.ok(b);run(['shell','input','tap',String(Math.floor((+b[1]+ +b[3])/2)),String(Math.floor((+b[2]+ +b[4])/2))]);}
let xml=tree(),file=findNode(xml,node=>node.includes('text="Carmanline-import-test.json"'));
if(!file){
 const roots=findNode(xml,node=>/content-desc="(Show roots|显示根目录|打开抽屉)/.test(node));if(roots){tapNode(roots);await pause(300);xml=tree();}
 const downloads=findNode(xml,node=>/text="(Downloads|下载)"/.test(node));if(downloads){tapNode(downloads);await pause(500);xml=tree();}
 file=findNode(xml,node=>node.includes('text="Carmanline-import-test.json"'));
}
tapNode(file);await pause(700);
// Some headless emulator builds ignore taps on document cards. The isolated
// Download directory contains only our synthetic fixture; keyboard activation
// exercises the same system picker and delivers the real content URI.
if(!await c.evaluate('Boolean(document.querySelector("#json-input")?.value.includes("carmanline.wrong.v1"))'))run(['shell','input','keyevent','20','66']);
await c.until('document.querySelector("#json-input")?.value.includes("carmanline.wrong.v1")');
assert.equal(await c.evaluate('document.querySelector("#json-input").value'),jsonFor([wrong],'wrong'));
await c.capture('carmanline-v030-android-json.png');await c.click('[data-act="parse-json"]');
assert.equal(await c.evaluate('document.querySelectorAll(".draft-option.right").length'),1);
await c.click('[data-act="edit-import"]');
await c.evaluate('(()=>{const input=document.querySelector("#chat-input");input.value="请修改标题";input.dispatchEvent(new Event("input",{bubbles:true}));})()');await c.click('[data-act="send-chat"]');
for(let n=0;n<300;n++){if(await c.evaluate('Boolean(document.querySelector(".chat-page>.error-panel"))'))break;await pause(100);}
const error=await c.evaluate('document.querySelector(".chat-page>.error-panel")?.textContent||""');assert.ok(error);assert.ok(!/No value for image/.test(error),'Text-only requests must not require an image');
assert.equal(await c.evaluate('document.querySelector(".confirm-card h2").textContent'),wrong.title,'Native service failure preserves draft');
await c.click('[data-act="manual-edit"]');
await c.evaluate('document.querySelector("#edit-title").value="安卓手动修改后的错题"');await c.click('[data-act="save-edit"]');
assert.equal(await c.evaluate('document.querySelector(".confirm-card h2").textContent'),'安卓手动修改后的错题');
await c.capture('carmanline-v030-android-chat.png');await c.click('[data-act="back-confirm"]');await c.click('[data-act="confirm-import"]');
s=await c.evaluate('window.demo.getState()');assert.equal(s.cards.length,7);assert.equal(s.cards.filter(card=>card.kind==='wrong').length,3);
assert.ok(s.cards.some(card=>card.title==='安卓手动修改后的错题'&&card.answer===0));
c.close();restart();c=await connect();assert.equal(await c.evaluate('window.demo.getState().cards.length'),7);
assert.equal(JSON.parse(await c.evaluate('Android.getSettings()')).hasKey,true);
const platform=await c.evaluate('({userAgent:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio})');
c.close();run(['shell','pm','clear','app.formula.recall']);restart();c=await connect();assert.equal(await c.evaluate('window.demo.getState().cards.length'),0);assert.equal(JSON.parse(await c.evaluate('Android.getSettings()')).hasKey,false);c.close();
const apkSha256=createHash('sha256').update(await readFile('dist/carmanline-v0.3.0.apk')).digest('hex');
const report={status:'passed',version:'0.3.0',apkSha256,platform,aiTransport:'Native text-only failure path uses closed loopback port; successful AI edits covered by deterministic browser bridge tests; no external provider called',checks:['same-signature v0.2.1 to v0.3.0 update','user content/API key/pending answer preserved','native prompt copy','Android document picker selects JSON','wrong file content reaches textarea','JSON validation and answer preview','native text-only request needs no image','service failure preserves draft','native manual edit and confirmation','new entry and existing settings survive force-stop','fresh install empty']};
await writeFile('dist/android-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
