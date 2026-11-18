import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {run,connect,restart,home} from './android-test-client.mjs';
import {legacyFixture} from '../tests/ui-fixtures.mjs';
import {formula,secondFormula,wrong,jsonFor} from '../tests/import-fixtures.mjs';
assert.ok(run(['emu','avd','name']).includes('FormulaDemo'),'Use only the disposable project emulator');
if(/versionCode=5\b/.test(run(['shell','dumpsys','package','app.formula.recall'])))run(['uninstall','app.formula.recall']);
run(['install','-r','dist/carmanline-v0.3.0.apk']);run(['shell','pm','clear','app.formula.recall']);restart();
let c=await connect();const fixture=legacyFixture();fixture.settings.endpoint='https://127.0.0.1:1/chat/completions';fixture.settings.model='preserved-test-model';
await c.evaluate(`Android.saveProgress(JSON.stringify(${JSON.stringify(fixture)}))`);
await c.evaluate(`Android.saveSettings(JSON.stringify({endpoint:'https://127.0.0.1:1/chat/completions',model:'preserved-test-model',key:'test-only-v031-key'}))`);
c.close();run(['shell','am','force-stop','app.formula.recall']);run(['install','-r','dist/carmanline-v0.3.1.apk']);restart();c=await connect();
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
await c.click('[data-act="clear-json"]');assert.equal(await c.evaluate('document.querySelector("#json-input").value'),'');assert.equal(await c.evaluate('document.querySelector("#json-file").files.length'),0);
await c.evaluate(`(()=>{const input=document.querySelector('#json-input');input.value=${JSON.stringify(jsonFor([wrong],'wrong'))};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await c.capture('carmanline-v031-android-json.png');await c.click('[data-act="parse-json"]');
assert.equal(await c.evaluate('document.querySelectorAll(".draft-option.right").length'),1);
await c.click('[data-act="edit-import"]');
await c.evaluate('(()=>{const input=document.querySelector("#chat-input");input.value="请修改标题";input.dispatchEvent(new Event("input",{bubbles:true}));})()');await c.click('[data-act="send-chat"]');
for(let n=0;n<300;n++){if(await c.evaluate('Boolean(document.querySelector(".chat-page>.error-panel"))'))break;await pause(100);}
const error=await c.evaluate('document.querySelector(".chat-page>.error-panel")?.textContent||""');assert.ok(error);assert.ok(!/No value for image/.test(error),'Text-only requests must not require an image');
assert.equal(await c.evaluate('document.querySelector(".confirm-card h2").textContent'),wrong.title,'Native service failure preserves draft');
await c.click('[data-act="manual-edit"]');
await c.evaluate('document.querySelector("#edit-title").value="安卓手动修改后的错题"');await c.click('[data-act="save-edit"]');
assert.equal(await c.evaluate('document.querySelector(".confirm-card h2").textContent'),'安卓手动修改后的错题');
await c.capture('carmanline-v031-android-chat.png');await c.click('[data-act="back-confirm"]');await c.click('[data-act="confirm-import"]');
s=await c.evaluate('window.demo.getState()');assert.equal(s.cards.length,7);assert.equal(s.cards.filter(card=>card.kind==='wrong').length,3);
assert.ok(s.cards.some(card=>card.title==='安卓手动修改后的错题'&&card.answer===0));

await home(c);await c.click('[data-act="import"]');await c.click('[data-act="import-kind"][data-kind="formula"]');await c.click('[data-mode="photo"]');
async function selectPhoto(){await c.evaluate(`(()=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=80;canvas.getContext('2d').fillRect(0,0,160,80);const bytes=Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),v=>v.charCodeAt(0));const files=new DataTransfer();files.items.add(new File([bytes],'same-photo.png',{type:'image/png'}));const input=document.querySelector('#photos');input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await c.until('!document.querySelector("[data-act=recognize]").disabled');}
await selectPhoto();assert.equal(await c.evaluate('document.querySelectorAll(".upload-previews img").length'),1);await c.click('[data-act="clear-photos"]');assert.equal(await c.evaluate('document.querySelectorAll(".upload-previews img").length'),0);assert.equal(await c.evaluate('document.querySelector("[data-act=recognize]").disabled'),true);
// Only a closed loopback connection is attempted. Replace that expected failure
// with fixture photo replies to exercise the installed WebView's import flow.
await c.evaluate(`window.photoTestOriginal=window.onNativeResult;window.photoTestReplies=[];window.photoTestHold=false;window.onNativeResult=(id,success,payload)=>{if(!success&&/connect|refused|127\\.0\\.0\\.1/i.test(payload)&&window.photoTestReplies.length){const value=window.photoTestReplies.shift();if(window.photoTestHold)window.photoTestHeld={id,value};else window.photoTestOriginal(id,true,JSON.stringify(value));}else window.photoTestOriginal(id,success,payload);}`);
await selectPhoto();await c.evaluate(`window.photoTestHold=true;window.photoTestReplies.push(${JSON.stringify({modelOutput:jsonFor([formula]),finishReason:'stop'})})`);await c.click('[data-act="recognize"]');await c.until('Boolean(window.photoTestHeld)');await c.click('[data-act="clear-photos"]');await c.evaluate('window.photoTestHold=false;window.photoTestOriginal(window.photoTestHeld.id,true,JSON.stringify(window.photoTestHeld.value))');await pause(80);assert.equal(await c.evaluate('window.demo.getView()'),'import');assert.equal(await c.evaluate('document.querySelectorAll(".confirm-card").length'),0);
const photoItems=[{...formula,title:'安卓照片有效甲'},{...formula,latex:'\\unknown{x}',title:'安卓坏项'},{...secondFormula,title:'安卓照片有效乙'}];
const interrupted='{"format":"carmanline.formula.v1","items":'+JSON.stringify(photoItems).slice(0,-1)+',{"title":"unfinished';
await selectPhoto();await c.evaluate(`window.photoTestReplies.push(${JSON.stringify({modelOutput:interrupted,finishReason:'length'})})`);await c.click('[data-act="recognize"]');await c.until('Boolean(document.querySelector(".confirm-card"))');
assert.ok(await c.evaluate('document.querySelector(".import-notice").textContent.includes("已保留 2 条")'));assert.ok(await c.evaluate('document.querySelector(".import-notice").textContent.includes("未完整返回")'));assert.equal(await c.evaluate('document.querySelectorAll(".confirm-page img,[data-act=view-source]").length'),0);await c.capture('carmanline-v031-android-partial.png');
await c.click('[data-act="import-all"]');await c.click('[data-act="confirm-import-all"]');assert.equal(await c.evaluate('window.demo.getState().cards.length'),9);
c.close();restart();c=await connect();assert.equal(await c.evaluate('window.demo.getState().cards.length'),9);

assert.equal(JSON.parse(await c.evaluate('Android.getSettings()')).hasKey,true);
const platform=await c.evaluate('({userAgent:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio})');
c.close();run(['shell','pm','clear','app.formula.recall']);restart();c=await connect();assert.equal(await c.evaluate('window.demo.getState().cards.length'),0);assert.equal(JSON.parse(await c.evaluate('Android.getSettings()')).hasKey,false);c.close();
const apkSha256=createHash('sha256').update(await readFile('dist/carmanline-v0.3.1.apk')).digest('hex');
const report={status:'passed',version:'0.3.1',apkSha256,platform,aiTransport:'Native text-only failure path uses closed loopback port; photo success/interruption simulated in the installed WebView; AI edits covered by browser bridge tests; no external provider called',checks:['same-signature v0.3.0 to v0.3.1 update','user content/API key/pending answer preserved','native prompt copy','Android document picker selects JSON','wrong file content reaches textarea','JSON validation and answer preview','native text-only request needs no image','service failure preserves draft','native manual edit and confirmation','new entry and existing settings survive force-stop','fresh install empty','clear JSON in place','clear photo and same photo reselect','clear rejects delayed photo result','interrupted mixed photo retains two valid entries','no screenshot verification','photo batch import']};
await writeFile('dist/android-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
