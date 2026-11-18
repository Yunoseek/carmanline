import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateState, emptyState, removeCards } from '../web/state.mjs';
import { seed } from './fixtures.mjs';
import { copy,createSession,question,reveal,grade,undo,nextItem } from '../web/core.mjs';
const now=new Date(2026,10,18,10).getTime();
function custom(id,kind='formula') {return {...copy(seed(now).find(c=>c.kind===kind)),id};}
function answer(session,cards,id,outcome='know') {session.current={question:question(cards.find(c=>c.id===id)),revealed:false};reveal(session,cards,0,now);grade(session,cards,outcome,now);}
test('new installation starts with an empty library and no sessions',()=>{
 const state=migrateState();assert.equal(state.cards.length,0);assert.deepEqual(state.sessions,{});assert.equal(state.schemaVersion,2);assert.equal(state.settings.limit,30);
});
test('v0.1 upgrade removes only seeded IDs and preserves user imports and settings',()=>{
 const mine=custom('custom-user-001');const old={cards:[...seed(now),mine],sessions:{},settings:{limit:20,endpoint:'https://example.invalid/chat/completions',model:'vision',hasKey:true},activity:['2026-11-17']};
 const state=migrateState(old);assert.deepEqual(state.cards.map(c=>c.id),[mine.id]);assert.equal(state.settings.model,'vision');assert.equal(state.settings.hasKey,true);assert.equal(state.settings.limit,20);assert.equal(state.activity.length,1);
});
test('migration is one-time and never repopulates an empty library',()=>{
 const state=migrateState({cards:seed(now),sessions:{}});assert.equal(state.cards.length,0);assert.equal(migrateState(JSON.parse(JSON.stringify(state))).cards.length,0);
 const imported=custom('p01');state.cards.push(imported);assert.equal(migrateState(state).cards.length,1);
});
test('removing the displayed card clears it and advances to a valid remaining card',()=>{
 const state=emptyState();state.cards=[custom('a'),custom('b')];const s=createSession(state.cards,'formula',2,'daily',now);s.current={question:question(state.cards[0]),revealed:false};state.sessions['formula:daily']=s;
 assert.equal(removeCards(state,['a']),1);assert.equal(s.current,null);assert.equal(nextItem(s,now).item.id,'b');
});
test('undo after deletion cannot resurrect deleted cards or queue snapshots',()=>{
 const state=emptyState();state.cards=[custom('a'),custom('b'),custom('wrong-kept','wrong')];const s=createSession(state.cards,'formula',2,'daily',now);state.sessions['formula:daily']=s;
 answer(s,state.cards,'a');answer(s,state.cards,'b','forget');removeCards(state,['a']);
 assert.equal(s.history.length,1);assert.ok(undo(s,state.cards));assert.deepEqual(s.items.map(i=>i.id),['b']);assert.ok(!state.cards.some(c=>c.id==='a'));assert.ok(state.cards.some(c=>c.id==='wrong-kept'));
});
test('deleting all items removes their empty session and deferred references',()=>{
 const state=emptyState();state.cards=[custom('a'),custom('b')];const s=createSession(state.cards,'formula',1,'daily',now);s.deferred=[{id:s.items[0].id==='a'?'b':'a',done:false}];state.sessions['formula:daily']=s;
 assert.equal(removeCards(state,['a','b']),2);assert.deepEqual(state.sessions,{});assert.equal(state.cards.length,0);
});
test('upgrade prunes sample references while preserving an in-progress imported card',()=>{
 const mine=custom('custom-kept');const cards=[seed(now)[0],mine];const s=createSession(cards,'formula',2,'daily',now);answer(s,cards,'p01');s.current={question:question(mine),revealed:false};
 const state=migrateState({cards,sessions:{'formula:daily':s},settings:{},activity:[]});assert.equal(s.items.length,1);assert.equal(s.current.question.cardId,mine.id);assert.equal(s.history.length,0);assert.equal(state.cards.length,1);
});
