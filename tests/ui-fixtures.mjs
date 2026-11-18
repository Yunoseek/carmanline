// Test-only content. This directory is never packaged into the APK.
import { seed } from './fixtures.mjs';
import { copy,createSession,question,reveal,grade } from '../web/core.mjs';
import {emptyState} from '../web/state.mjs';
export function roundFixture(now=Date.now()) {
 const state=emptyState(),source=seed(now).find(c=>c.id==='p01');
 state.cards=Array.from({length:65},(_,i)=>({...copy(source),id:'custom-round-'+i,title:'公式 '+(i+1),createdAt:now+i}));
 const s=createSession(state.cards,'formula',30,'daily',now);
 for(const item of [...s.items])for(let pass=0;pass<2;pass++) {
  const c=state.cards.find(c=>c.id===item.id);s.current={question:question(c),revealed:false};
  reveal(s,state.cards,null,now);grade(s,state.cards,'know',now);
 }
 state.sessions['formula:daily']=s;
 return state;
}
export function waitFixture(now=Date.now(),seconds=4) {
 const state=emptyState(),source=seed(now).find(c=>c.id==='p01');
 state.cards=[{...copy(source),id:'custom-wait'}];
 const s=createSession(state.cards,'formula',30,'daily',now);
 s.current={question:question(state.cards[0]),revealed:false};reveal(s,state.cards,null,now);grade(s,state.cards,'know',now);
 s.items[0].readyAt=now+seconds*1000;state.sessions['formula:daily']=s;
 return state;
}
export function legacyFixture(now=Date.now()) {
  const builtins=seed(now);
  const card=(source,id,title)=>({...copy(source),id,title,createdAt:now});
  const mine=[
    card(builtins.find(c=>c.id==='m17'),'custom-formula-a','自录 · 分部积分'),
    card(builtins.find(c=>c.id==='p01'),'custom-formula-b','自录 · 单摆周期'),
    card(builtins.find(c=>c.id==='m14'),'custom-formula-c','自录 · 幂函数积分'),
    card(builtins.find(c=>c.id==='focus-demo'),'custom-focus','自录 · 对数展开'),
    card(builtins.find(c=>c.id==='w01'),'custom-wrong-a','自录 · 求导错题'),
    card(builtins.find(c=>c.id==='w02'),'custom-wrong-b','自录 · 动能错题'),
  ];
  const daily=createSession([builtins[0],...mine.slice(0,3)],'formula',4,'daily',now);
  daily.current={question:question(builtins[0]),revealed:false};
  reveal(daily,[...builtins,...mine],0,now);grade(daily,[...builtins,...mine],'know',now);
  const q=question(mine[0]);daily.current={question:q,revealed:false};
  reveal(daily,mine,q.options.findIndex(o=>o.correct),now);
  return {cards:[...builtins,...mine],sessions:{'formula:daily':daily},settings:{limit:20,endpoint:'https://example.invalid/v1/chat/completions',model:'keep-vision-model',hasKey:true},activity:[]};
}
