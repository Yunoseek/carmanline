import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
export const adb=resolve('.tools/android-sdk/platform-tools/adb.exe');
export const device='emulator-5554';
export const run=args=>execFileSync(adb,['-s',device,...args],{encoding:'utf8'}).trim();
export async function connect() {
 let pid='';for(let i=0;i<50&&!pid;i++){try{pid=run(['shell','pidof','app.formula.recall']);}catch{}if(!pid)await pause(100);}
 run(['forward','tcp:9227',`localabstract:webview_devtools_remote_${pid}`]);
 let targets=[];
 for(let i=0;i<70;i++){try{targets=await(await fetch('http://127.0.0.1:9227/json')).json();if(targets.length)break;}catch{}await pause(100);}
 const target=targets.find(p=>p.url.includes('appassets.androidplatform.net'));
 if(!target)throw new Error('APK WebView not available');
 const ws=new WebSocket(target.webSocketDebuggerUrl),calls=new Map();let seq=0;
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=event=>{const m=JSON.parse(event.data),call=calls.get(m.id);if(call){calls.delete(m.id);m.error?call.reject(new Error(JSON.stringify(m.error))):call.resolve(m.result);}};
 const send=(method,params)=>new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw new Error('Timed out: '+expression);};
 await until('typeof window.demo === "object" && document.querySelector("#app").childElementCount > 0');
 return {evaluate,until,click:selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`),close:()=>ws.close(),capture:async name=>{await pause(700);await writeFile('dist/'+name,execFileSync(adb,['-s',device,'exec-out','screencap','-p']));}};
}
export function restart() {run(['shell','am','force-stop','app.formula.recall']);run(['shell','am','start','-n','app.formula.recall/.MainActivity']);}
export async function home(client) {await client.evaluate('for(let i=0;i<3&&window.demo.getView()!=="home";i++)window.onAndroidBack()');}
