import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCard,copy,day,addDays,createSession,nextRoundCards,question,reveal,grade} from '../web/core.mjs';
const now=new Date(2026,10,18,12).getTime(),today=day(now);
function card(id,changes={}) {return {...makeCard({id,kind:'formula',title:id,cue:id,latex:'x=1',distractors:['x=2','x=3','x=4']},now),...changes};}
function finish(s,cards) {
 for(const item of [...s.items])for(let pass=0;pass<3;pass++) {
  s.current={question:question(cards.find(c=>c.id===item.id)),revealed:false};
  reveal(s,cards,null,now);grade(s,cards,'know',now);
 }
 return s;
}
test('extra rounds prioritize due cards then the nearest future dates and respect exclusions',()=>{
 const cards=[card('later',{due:addDays(today,7)}),card('soon',{due:addDays(today,1)}),card('due'),card('learned',{lastDay:today}),card('focus',{focus:true}),card('mastered',{mastered:true,due:addDays(today,30)}),card('mastered-due',{mastered:true}),card('wrong',{kind:'wrong'})];
 assert.deepEqual(nextRoundCards(cards,'formula',null,now).map(c=>c.id),['due','mastered-due','soon','later']);
});
test('ordinary daily sessions do not automatically pull future content',()=>{
 const cards=[card('due'),card('future',{due:addDays(today,2)})];
 assert.deepEqual(createSession(cards,'formula',30,'daily',now).items.map(i=>i.id),['due']);
});
test('successive rounds use 30 different cards, then only the remaining five',()=>{
 const cards=Array.from({length:65},(_,i)=>card('formula-'+i));
 let s=finish(createSession(cards,'formula',30,'daily',now),cards);
 const seen=new Set(s.items.map(i=>i.id));
 s=createSession(cards,'formula',30,'daily',now,s,true);assert.equal(s.round,2);assert.equal(s.items.length,30);
 for(const i of s.items){assert.ok(!seen.has(i.id));seen.add(i.id);}
 finish(s,cards);s=createSession(cards,'formula',30,'daily',now,s,true);
 assert.equal(s.round,3);assert.equal(s.items.length,5);
 for(const i of s.items){assert.ok(!seen.has(i.id));seen.add(i.id);}
 finish(s,cards);assert.equal(seen.size,65);assert.equal(nextRoundCards(cards,'formula',s,now).length,0);
});
test('an extra round cannot replace an unfinished round or a different calendar day',()=>{
 const cards=[card('a')],s=createSession(cards,'formula',1,'daily',now);
 assert.throws(()=>createSession(cards,'formula',30,'daily',now,s,true));
 finish(s,cards);assert.throws(()=>createSession(cards,'formula',30,'daily',now+86400000,s,true));
 assert.throws(()=>createSession(cards,'formula',30,'focus',now,s,true));
});
test('deferred progress is retained and selected first when the next-round quota changes',()=>{
 const cards=Array.from({length:35},(_,i)=>card('f-'+i,{due:addDays(today,-1)}));
 const original=createSession(cards,'formula',30,'daily',now-86400000);
 const todaySession=createSession(cards,'formula',10,'daily',now,original);
 assert.equal(todaySession.deferred.length,20);
 const pendingId=todaySession.deferred[0].id;todaySession.deferred[0].passes=1;
 finish(todaySession,cards);
 const s=createSession(cards,'formula',20,'daily',now,todaySession,true);
 assert.equal(s.items.length,20);assert.equal(s.items.find(i=>i.id===pendingId).passes,1);assert.equal(s.deferred.length,0);
});
test('early review schedules from the actual date and advances only one box',()=>{
 const cards=[card('done'),card('early',{box:3,due:addDays(today,5)})];
 const first=finish(createSession(cards,'formula',30,'daily',now),cards);
 const next=createSession(cards,'formula',30,'daily',now,first,true);assert.equal(next.items.length,1);
 finish(next,cards);assert.equal(cards[1].box,4);assert.equal(cards[1].lastDay,today);assert.equal(cards[1].due,addDays(today,15));
});
test('a persisted extra round keeps its current question and starts the next day at round one',()=>{
 const cards=Array.from({length:35},(_,i)=>card('f-'+i));
 const first=finish(createSession(cards,'formula',30,'daily',now),cards);
 const next=createSession(cards,'formula',30,'daily',now,first,true);
 next.current={question:question(cards.find(c=>c.id===next.items[0].id)),revealed:false};
 const restored=copy(next);assert.equal(restored.round,2);assert.equal(restored.current.question.cardId,next.current.question.cardId);
 const tomorrow=createSession(cards,'formula',30,'daily',now+86400000,restored);
 assert.equal(tomorrow.round,1);assert.equal(tomorrow.current.question.cardId,restored.current.question.cardId);
});
test('wrong-question rounds use their own quota and never pull formulas',()=>{
 const cards=[card('formula'),...Array.from({length:12},(_,i)=>card('wrong-'+i,{kind:'wrong',stem:'1+1',options:['2','3'],answer:0}))];
 const first=finish(createSession(cards,'wrong',10,'daily',now),cards);
 const next=createSession(cards,'wrong',10,'daily',now,first,true);
 assert.equal(next.items.length,2);assert.ok(next.items.every(i=>i.id.startsWith('wrong-')));assert.equal(cards[0].lastDay,null);
});
