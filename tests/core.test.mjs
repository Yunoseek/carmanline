import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { seed, formulas } from './fixtures.mjs';
import { day, addDays, createSession, nextItem, reveal, question, grade, undo, markMastered, unmarkMastered, eligible, copy, skipQuestion } from '../web/core.mjs';
const now = new Date(2026,10,17,12).getTime();
function fixture(limit=30, mode='daily') { const cards=seed(now);return {cards,s:createSession(cards,'formula',limit,mode,now)}; }
function attempt(s,cards,id,outcome='know',time=now) {
  const card=cards.find(c=>c.id===id);
  s.current={question:question(card,s.turn),revealed:false,seenRecorded:false,selected:null};
  reveal(s,cards,outcome==='forget'?null:0,time);
  return grade(s,cards,outcome,time);
}
test('all seeded formulas and distractors render offline and are distinct',()=>{
  for(const c of seed(now).filter(c=>c.kind==='formula')) {
    assert.ok(c.distractors.length>=5,c.title);
    assert.equal(new Set([c.latex,...c.distractors]).size,c.distractors.length+1,c.title);
    for(const latex of [c.latex,...c.distractors]) assert.doesNotThrow(()=>katex.renderToString(latex,{throwOnError:true,strict:'error'}),c.title);
  }
});
test('daily selects 30 unique ordinary cards, separate from focus',()=>{
 const {s,cards}=fixture();assert.equal(s.items.length,30);assert.equal(new Set(s.items.map(i=>i.id)).size,30);assert.ok(s.items.every(i=>!cards.find(c=>c.id===i.id).focus));
});
test('three consecutive passes graduate new sessions and advance exactly one box',()=>{
 const {s,cards}=fixture(1);const id=s.items[0].id,c=cards.find(c=>c.id===id);attempt(s,cards,id);attempt(s,cards,id,'know',now+31000);assert.equal(c.box,0);assert.equal(s.items[0].passes,2);attempt(s,cards,id,'know',now+62000);assert.equal(c.box,1);assert.equal(c.due,addDays(day(now),1));assert.equal(s.finished,true);
});
test('saved sessions without a recall target still finish after two passes',()=>{
 const {s,cards}=fixture(1);delete s.targetPasses;const id=s.items[0].id;attempt(s,cards,id);attempt(s,cards,id);assert.equal(s.finished,true);
});
test('wrong answer clears consecutive passes; eventual success preserves lapse evidence',()=>{
 const {s,cards}=fixture(1);const id=s.items[0].id,c=cards.find(c=>c.id===id);s.items[0].baseBox=c.box=4;attempt(s,cards,id);attempt(s,cards,id,'forget');assert.equal(s.items[0].passes,0);for(let pass=0;pass<3;pass++)attempt(s,cards,id);assert.equal(c.box,0);assert.equal(c.lapses,1);assert.equal(c.due,addDays(day(now),1));
});
test('guess is not success and has its own cross-day penalty',()=>{
 const {s,cards}=fixture(1);const id=s.items[0].id,c=cards.find(c=>c.id===id);s.items[0].baseBox=c.box=4;attempt(s,cards,id,'guess');assert.equal(s.items[0].passes,0);for(let pass=0;pass<3;pass++)attempt(s,cards,id);assert.equal(c.box,3);assert.equal(c.lapses,1);
});
test('five consecutive failures enter focus and only next day is eligible',()=>{
 const {s,cards}=fixture(1);const id=s.items[0].id,c=cards.find(c=>c.id===id);for(let i=0;i<5;i++)attempt(s,cards,id,'forget');assert.equal(c.focus,true);assert.equal(s.items[0].moved,true);assert.equal(createSession(cards,'formula',30,'focus',now).items.some(i=>i.id===id),false);
});
test('nonconsecutive errors do not trigger focus',()=>{
 const {s,cards}=fixture(1);const id=s.items[0].id;for(let i=0;i<5;i++){attempt(s,cards,id,'forget');attempt(s,cards,id);}assert.equal(cards.find(c=>c.id===id).focus,false);
});
test('undo restores box, due, lapse and session progress without duplicating seen',()=>{
 const {s,cards}=fixture(1);const id=s.items[0].id,c=cards.find(c=>c.id===id);for(let pass=0;pass<3;pass++)attempt(s,cards,id);assert.equal(c.box,1);const seen=c.seen;assert.ok(undo(s,cards));assert.equal(c.box,0);assert.equal(s.items[0].passes,2);assert.equal(s.finished,false);grade(s,cards,'guess',now);assert.equal(c.seen,seen);assert.equal(s.items[0].passes,0);
});
test('mastering can be undone with its full original state',()=>{
 const {s,cards}=fixture(1);const id=s.items[0].id,c=cards.find(c=>c.id===id);const original=copy(c);s.current={question:question(c),revealed:false};markMastered(s,cards,now);assert.equal(c.mastered,true);assert.equal(c.due,addDays(day(now),30));undo(s,cards);assert.equal(c.mastered,false);assert.equal(c.due,original.due);assert.equal(c.box,original.box);markMastered(s,cards,now);unmarkMastered(c);assert.equal(c.due,original.due);
});
test('three successful focus appearances graduate even across skipped calendar days',()=>{
 const {cards}=fixture();const c=cards.find(c=>c.focus);for(const days of [0,2,5]){const time=now+days*86400000;const s=createSession(cards,'formula',30,'focus',time);attempt(s,cards,c.id,'know',time);}assert.equal(c.focus,false);assert.equal(c.box,0);assert.equal(c.due,addDays(day(now),6));
});
test('tail card waits instead of appearing immediately',()=>{
 const {s,cards}=fixture(1);attempt(s,cards,s.items[0].id,'know',now);assert.ok(nextItem(s,now+1000).waitUntil);assert.ok(nextItem(s,now+31000).item);
});
test('incorrect cards reappear within the round after three intervening questions',()=>{
 const {s,cards}=fixture(10);const id=nextItem(s,now).item.id;
 attempt(s,cards,id,'forget');
 for(let i=0;i<3;i++){
  const next=nextItem(s,now+60000).item.id;assert.notEqual(next,id);attempt(s,cards,next,'know',now+60000);
 }
 assert.equal(nextItem(copy(s),now+60000).item.id,id);
});
test('skip moves the unrevealed question to the end and is undoable',()=>{
 const {s,cards}=fixture(6), first=s.items[0], card=cards.find(c=>c.id===first.id);
 s.current={question:question(card),selected:null,revealed:false};const original=copy(s);
 assert.ok(skipQuestion(s,cards,now));assert.equal(s.items.at(-1).id,first.id);assert.notEqual(nextItem(s,now).item.id,first.id);assert.equal(card.seen,0);
 assert.ok(undo(s,cards));assert.deepEqual(s.items,original.items);assert.equal(s.current.question.cardId,first.id);
});
test('uncompleted previous-day cards take the next session slots first',()=>{
 const {s,cards}=fixture(10);const pending=s.items.map(i=>i.id);const tomorrow=now+86400000;const next=createSession(cards,'formula',10,'daily',tomorrow,s);assert.deepEqual(new Set(next.items.map(i=>i.id)),new Set(pending));
});
test('completed cards do not re-enter another session on the same day',()=>{
 const {s,cards}=fixture(1);const id=s.items[0].id;for(let pass=0;pass<3;pass++)attempt(s,cards,id);assert.equal(eligible(cards,'formula',day(now)).some(c=>c.id===id),false);
});
test('new-day carry keeps consecutive progress and the revealed current question',()=>{
 const {s,cards}=fixture(10);const id=s.items[0].id;attempt(s,cards,id);
 s.current={question:question(cards.find(c=>c.id===id)),revealed:false,seenRecorded:false,selected:null};reveal(s,cards,0,now);
 const next=createSession(cards,'formula',10,'daily',now+86400000,s);
 assert.equal(next.day,addDays(day(now),1));assert.equal(next.items.find(i=>i.id===id).passes,1);assert.equal(next.current.question.cardId,id);assert.equal(next.current.revealed,true);assert.equal(next.current.seenRecorded,true);
});
test('decreasing next-day quota retains unfinished overflow without losing its progress',()=>{
 const cards=seed(now);for(let i=0;i<10;i++)cards.push({...copy(cards[0]),id:'extra-'+i,cue:'附加条件 '+i});
 const s=createSession(cards,'formula',40,'daily',now);const id=s.items[0].id;attempt(s,cards,id);
 const next=createSession(cards,'formula',10,'daily',now+86400000,s);
 assert.equal(next.items.length,10);assert.equal(next.deferred.length,30);
 assert.equal([...next.items,...next.deferred].find(i=>i.id===id).passes,1);
 const nextAgain=createSession(cards,'formula',10,'daily',now+2*86400000,next);
 assert.equal(new Set([...nextAgain.items,...nextAgain.deferred].map(i=>i.id)).size,40);
});
test('unmarking in library reopens its slot and keeps previous answer history',()=>{
 const {s,cards}=fixture(1);const id=s.items[0].id,c=cards.find(c=>c.id===id);attempt(s,cards,id);
 s.current={question:question(c),revealed:false,seenRecorded:false};markMastered(s,cards,now);assert.equal(s.finished,true);
 unmarkMastered(c,[s]);assert.equal(s.finished,false);assert.equal(s.items[0].done,false);assert.equal(s.items[0].passes,1);assert.equal(s.history.length,1);assert.equal(c.box,0);
});
test('several library unmarks each restore their own session slot',()=>{
 const {s,cards}=fixture(2);const ids=s.items.map(i=>i.id);
 for(const id of ids){s.current={question:question(cards.find(c=>c.id===id)),revealed:false};markMastered(s,cards,now);}
 for(const id of ids)unmarkMastered(cards.find(c=>c.id===id),[s]);
 assert.equal(s.items.filter(i=>i.done).length,0);assert.equal(s.finished,false);
});
test('unmarking a different card preserves undo and rebases its queue snapshot',()=>{
 const {s,cards}=fixture(2);const [a,b]=s.items.map(i=>i.id);const ca=cards.find(c=>c.id===a);
 attempt(s,cards,a);s.current={question:question(ca),revealed:false};markMastered(s,cards,now);attempt(s,cards,b);
 unmarkMastered(ca,[s]);assert.equal(s.history.length,2);assert.ok(undo(s,cards));
 assert.equal(s.items.find(i=>i.id===a).passes,1);assert.equal(s.items.find(i=>i.id===a).done,false);assert.equal(ca.mastered,false);assert.equal(s.items.find(i=>i.id===b).passes,0);
});
test('repeated master/undo cycles restore flat original scheduling state',()=>{
 const {s,cards}=fixture(1);const c=cards.find(c=>c.id===s.items[0].id);c.box=1;s.items[0].baseBox=1;const originalDue=c.due;
 s.current={question:question(c),revealed:false};
 for(let i=0;i<5;i++){markMastered(s,cards,now+i);undo(s,cards);assert.equal(c.box,1);assert.equal(c.prevMaster,null);assert.equal(c.masterSessionUndo,null);assert.equal(c.due,originalDue);}
});
