import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { createSession, day, makeCard, nextRoundCards, question } from '../web/core.mjs';
import { findFormulaDuplicate, formulaKey, scanFormulaDuplicates } from '../web/duplicates.mjs';
import { emptyState, MERGE_RETENTION, mergeFormulas, migrateState, restoreFormulaMerge } from '../web/state.mjs';

const now = Date.now();
const formula = (id, latex, cue='') => makeCard({id,kind:'formula',latex,cue,title:id,subject:'数学',distractors:['x=2','x=3','x=4']},now);

test('formula keys use mathematical spelling and conditions, without folding distinct expressions', () => {
  const first=formula('a','\\dfrac{\\sin x}{1+\\cos x}=x^{2}','x→0');
  const equivalent=formula('b','\\frac{\\sin  x}{1+\\cos x}=x^2','x \\to 0');
  assert.equal(formulaKey(first),formulaKey(equivalent));
  assert.notEqual(formulaKey(first),formulaKey({...equivalent,cue:'x→+∞'}));
  assert.notEqual(formulaKey(formula('c','\\frac{a}{bc}')),formulaKey(formula('d','\\frac{ab}{c}')));
  assert.notEqual(formulaKey(formula('c','x=X')),formulaKey(formula('d','x=x')));
  assert.notEqual(formulaKey(formula('c','\\text{a b}')),formulaKey(formula('d','\\text{ab}')));
});

test('strong and weak matches stay out of exact duplicate groups', () => {
  const cards=[formula('a','x^{n+1}=y'),formula('b','x^{n+1}={y}'),formula('c','x^{n+2}=y')];
  assert.equal(findFormulaDuplicate(cards[1],[cards[0]],katex.__parse).level,'strong');
  const scan=scanFormulaDuplicates(cards,katex.__parse);
  assert.deepEqual(scan.exact,[]);
  assert.ok(scan.similar.some(pair=>pair.strong));
  assert.ok(scan.similar.some(pair=>!pair.strong));
});

test('an exact duplicate consumes one session slot and cannot enter a second round', () => {
  const cards=[formula('a','\\dfrac{x}{2}'),formula('b','\\frac{x}{2}'),formula('c','\\frac{x}{2}','x>0')];
  assert.equal(createSession(cards,'formula',30,'daily',now).items.length,2);
  cards[0].lastDay=day(now);
  assert.deepEqual(nextRoundCards(cards,'formula',null,now).map(card=>card.id),['c']);
});

test('merge combines statistics and updates the live queue and wrong-question references', () => {
  const state=emptyState();
  const first={...formula('a','\\dfrac{x}{2}'),notes:'积分前提',seen:8,lapses:2,mistakes:3,box:2};
  const second={...formula('b','\\frac{x}{2}'),notes:['适用范围'],seen:4,lapses:1,mistakes:2,box:4,lastPracticedAt:now};
  state.cards=[first,second,{id:'wrong',kind:'wrong',relatedFormulaIds:['b','a']}];
  const session=createSession([first],'formula',30,'daily',now);
  session.items[0].passes=2;session.current={question:question(first),selected:0,revealed:true};
  state.sessions={'formula:daily':session};
  const entry=mergeFormulas(state,['a','b'],'b',now);
  const merged=state.cards[0];
  assert.deepEqual([merged.id,merged.seen,merged.lapses,merged.mistakes,merged.box],['b',12,3,5,4]);
  assert.deepEqual(merged.notes,['积分前提','适用范围']);
  assert.equal(session.current.question.cardId,'b');assert.equal(session.items[0].passes,2);
  assert.deepEqual(state.cards[1].relatedFormulaIds,['b']);
  assert.throws(()=>restoreFormulaMerge(state,entry.id,now+MERGE_RETENTION),/已过期/);
  restoreFormulaMerge(state,entry.id,now+100);
  assert.deepEqual(state.cards.find(card=>card.id==='wrong').relatedFormulaIds,['b','a']);
  assert.equal(state.sessions['formula:daily'].current.question.cardId,'a');
  assert.equal(state.cards.find(card=>card.id==='b').mistakes,2);
});

test('restoring after new practice keeps new learning on the main formula', () => {
  const state=emptyState();state.cards=[{...formula('a','x=1'),mistakes:3},{...formula('b','x=1'),mistakes:2}];
  const entry=mergeFormulas(state,['a','b'],'a',now);
  state.cards[0].mistakes++;state.cards[0].lastPracticedAt=now+1;
  restoreFormulaMerge(state,entry.id,now+2);
  assert.equal(state.cards.find(card=>card.id==='a').mistakes,4);
  assert.equal(state.cards.find(card=>card.id==='a').lastPracticedAt,now+1);
  assert.equal(state.cards.find(card=>card.id==='b').mistakes,2);
});

test('v0.3.1 migration consolidates duplicate active slots and keeps both library records', () => {
  const state={...emptyState(),schemaVersion:2};
  state.cards=[formula('a','x=1'),formula('b','x=1')];
  const session=createSession([state.cards[0]],'formula',30,'daily',now);
  delete session.targetPasses;
  session.items.push({...session.items[0],id:'b',passes:1});
  session.current={question:question(state.cards[0]),selected:0,revealed:true};
  state.sessions={'formula:daily':session};
  assert.equal(migrateState(state).cards.length,2);
  assert.equal(session.items.length,1);assert.equal(session.items[0].passes,1);assert.equal(session.current.question.cardId,'a');
  assert.equal(session.targetPasses,undefined);
});
