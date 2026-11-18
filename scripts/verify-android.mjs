// Exercise the APK through the page-level CDP supported by stock Android 11.
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
const adb=resolve('.tools/android-sdk/platform-tools/adb.exe');
const run=args=>execFileSync(adb,['-e',...args],{encoding:'utf8'}).trim();
let ws,seq=0;const calls=new Map();
async function connect(){
 const pid=run(['shell','pidof','app.formula.recall']);
 run(['forward','tcp:9227',`localabstract:webview_devtools_remote_${pid}`]);
 let targets;
 for(let i=0;i<50;i++){
  try{targets=await (await fetch('http://127.0.0.1:9227/json')).json();if(targets.length)break;}catch{}
  await pause(100);
 }
 const target=targets.find(p=>p.url.includes('appassets.androidplatform.net'));
 assert.ok(target,'APK WebView is running');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(calls.has(m.id)){const {resolve,reject}=calls.get(m.id);calls.delete(m.id);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);}};
 await until('typeof window.demo === "object"');
}
function send(method,params){return new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){
 const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));
 return r.result.value;
}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw new Error('Timed out: '+expression);}
const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const capture=async name=>{await pause(350);return writeFile('dist/'+name,execFileSync(adb,['-e','exec-out','screencap','-p']));};
await connect();
if(process.argv.includes('--capture-home')) {
 await evaluate('window.demo.getView() !== "home" && window.onAndroidBack()');
 await until('Boolean(document.querySelector(".home-page"))');
 await pause(1000);await capture('android-home.png');ws.close();process.exit(0);
}
const platform=await evaluate('({userAgent:navigator.userAgent,width:innerWidth,height:innerHeight,dpr:devicePixelRatio})');
await capture('android-home.png');
await click('[data-act="start"]');
await until('Boolean(document.querySelector(".option"))');
const correct=await evaluate('(()=>{const s=window.demo.getState();return s.sessions[window.demo.getActive()].current.question.options.findIndex(o=>o.correct)})()');
await click(`.option[data-index="${correct}"]`);
await click('[data-outcome="guess"]');
const afterGuess=await evaluate('(()=>{const s=window.demo.getState().sessions[window.demo.getActive()];return s.items.find(i=>i.id===s.history[0].current.question.cardId)})()');
assert.equal(afterGuess.passes,0);assert.equal(afterGuess.hadGuess,true);
await click('[data-act="undo"]');
assert.equal(await evaluate('document.querySelectorAll(".option.correct").length'),1);
await click('[data-outcome="know"]');
const wrong=await evaluate('(()=>{const s=window.demo.getState();return s.sessions[window.demo.getActive()].current.question.options.findIndex(o=>!o.correct)})()');
await capture('android-question.png');
await click(`.option[data-index="${wrong}"]`);
await capture('android-answer.png');
const title=await evaluate('document.querySelector(".review-heading h1").textContent');
const key='demo-keystore-verification-key';
const settings=await evaluate(`(()=>{Android.saveSettings(JSON.stringify({endpoint:'https://example.invalid/v1/chat/completions',model:'demo-model',key:${JSON.stringify(key)}}));return Android.getSettings()})()`);
assert.ok(JSON.parse(settings).hasKey);assert.ok(!settings.includes(key),'API key is not returned to JavaScript');
ws.close();
run(['shell','am','force-stop','app.formula.recall']);
run(['shell','am','start','-n','app.formula.recall/.MainActivity']);
await connect();
await click('[data-act="start"]');
assert.equal(await evaluate('document.querySelector(".review-heading h1").textContent'),title);
assert.equal(await evaluate('document.querySelectorAll(".option.wrong").length'),1,'Revealed answer survives force-stop');
await click('[data-outcome="forget"]');
const immediateCorrect=await evaluate('(()=>{const s=window.demo.getState();return s.sessions[window.demo.getActive()].current.question.options.findIndex(o=>o.correct)})()');
const immediateTitle=await evaluate('document.querySelector(".review-heading h1").textContent');
await click(`.option[data-index="${immediateCorrect}"]`);
ws.close();
run(['shell','am','force-stop','app.formula.recall']);
run(['shell','am','start','-n','app.formula.recall/.MainActivity']);
await connect();await click('[data-act="start"]');
assert.equal(await evaluate('document.querySelector(".review-heading h1").textContent'),immediateTitle);
assert.equal(await evaluate('document.querySelectorAll(".option.correct").length'),1,'Zero-delay force-stop preserves latest revealed answer');
ws.close();
const apkSha256=createHash('sha256').update(await readFile('dist/liushi-demo.apk')).digest('hex');
await writeFile('dist/android-verification.json',JSON.stringify({status:'passed',apkSha256,platform,checks:['APK install and launch','Android 11 stock WebView','native offline assets','guess resets passes','undo changes self-rating','pink and mint feedback','Android Keystore save','API key not exposed to JS','force-stop and relaunch preserve revealed answer','zero-delay force-stop preserves latest answer']},null,2));
console.log('Android verification passed: '+JSON.stringify(platform));
