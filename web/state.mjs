import { copy } from './core.mjs';
import { formulaKey } from './duplicates.mjs';

export const DATA_VERSION = 3;
export const MERGE_RETENTION = 30 * 86400000;
export const DEFAULT_SETTINGS = { limit:30,endpoint:'',model:'',hasKey:false };
const demoIds = new Set([
  ...Array.from({length:10},(_,i)=>'p'+String(i+1).padStart(2,'0')),
  ...Array.from({length:20},(_,i)=>'m'+String(i+1).padStart(2,'0')),
  ...Array.from({length:5},(_,i)=>'w'+String(i+1).padStart(2,'0')),
  'focus-demo',
]);
export function emptyState() {
  return {schemaVersion:DATA_VERSION,cards:[],sessions:{},settings:{...DEFAULT_SETTINGS},activity:[],mergedFormulas:[]};
}
// Removing a card also removes the queue/history references that could revive it.
export function removeCards(state, ids) {
  const removed=new Set(ids), count=state.cards.filter(c=>removed.has(c.id)).length;
  state.cards=state.cards.filter(c=>!removed.has(c.id));
  for(const key of Object.keys(state.sessions || {})) {
    const session=state.sessions[key];
    session.items=(session.items || []).filter(i=>!removed.has(i.id));
    session.deferred=(session.deferred || []).filter(i=>!removed.has(i.id));
    if(removed.has(session.current?.question.cardId))session.current=null;
    session.history=(session.history || []).filter(event=>!removed.has(event.current?.question.cardId));
    for(const event of session.history) {
      event.before.items=(event.before.items || []).filter(i=>!removed.has(i.id));
      event.before.finished=event.before.items.every(i=>i.done);
    }
    session.finished=session.items.every(i=>i.done);
    if(!session.items.length && !session.deferred.length)delete state.sessions[key];
  }
  return count;
}
export function migrateState(saved) {
  const state=saved && Array.isArray(saved.cards) ? saved : emptyState();
  state.sessions=state.sessions || {};
  state.settings={...DEFAULT_SETTINGS,...state.settings};
  state.activity=Array.isArray(state.activity)?state.activity:[];
  if((state.schemaVersion || 0)<2)removeCards(state,demoIds);
  state.mergedFormulas=(Array.isArray(state.mergedFormulas)?state.mergedFormulas:[]).filter(entry=>entry.expiresAt>Date.now());
  if((state.schemaVersion || 0)<3) {
    const groups = new Map();
    for (const card of state.cards.filter(card => card.kind === 'formula')) {
      const key = formulaKey(card);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card.id);
    }
    for (const session of Object.values(state.sessions)) {
      for (const ids of groups.values()) {
        const represented = [...session.items, ...(session.deferred || [])].filter(item => ids.includes(item.id));
        if (represented.length < 2) continue;
        const primary = represented.find(item => item.id === session.current?.question.cardId) || represented[0];
        rebaseSession(session, new Set(represented.map(item => item.id)), primary.id);
      }
    }
  }
  state.schemaVersion=DATA_VERSION;
  return state;
}

function combineItems(items, ids, primaryId) {
  const matching = items.filter(item => ids.has(item.id));
  if (!matching.length) return items;
  const best = [...matching].sort((a,b) => Number(b.done && !b.moved) - Number(a.done && !a.moved) || b.passes - a.passes || Number(b.done) - Number(a.done))[0];
  const max = field => Math.max(...matching.map(item => item[field] ?? 0));
  const merged = { ...best, id: primaryId, passes:max('passes'), fails:max('fails'), readyTurn:max('readyTurn'), readyAt:max('readyAt') };
  return items.flatMap(item => item === matching[0] ? [merged] : ids.has(item.id) ? [] : [item]);
}

function rebaseSession(session, ids, primaryId) {
  const items = session.items;
  const deferred = session.deferred || [];
  if (items.some(item => ids.has(item.id))) {
    const activeSize = items.length;
    const combined = combineItems([...items, ...deferred.filter(item => ids.has(item.id))], ids, primaryId);
    session.items = combined.slice(0, activeSize - items.filter(item => ids.has(item.id)).length + 1);
    session.deferred = deferred.filter(item => !ids.has(item.id));
  } else session.deferred = combineItems(deferred, ids, primaryId);
  const current = session.current;
  if (ids.has(current?.question.cardId)) {
    const slot = session.items.find(item => item.id === primaryId);
    if (!slot || slot.done) session.current = null;
    else current.question.cardId = primaryId;
  }
  const mergedItem = session.items.find(item => item.id === primaryId);
  session.history = session.history.filter(event => !ids.has(event.current?.question.cardId));
  for (const event of session.history) {
    event.before.items = combineItems(event.before.items, ids, primaryId).map(item => item.id === primaryId && mergedItem ? { ...mergedItem } : item);
    event.before.finished = event.before.items.every(item => item.done);
  }
  session.finished = session.items.every(item => item.done);
}

const referenceFields = ['formulaId', 'formulaIds', 'relatedFormulaIds'];
function referenceCount(state, id) {
  const sessions = Object.values(state.sessions).reduce((count, session) => count + (session.current?.question.cardId === id ? 1 : 0) + [...session.items, ...(session.deferred || [])].filter(item => item.id === id).length + session.history.filter(event => event.current?.question.cardId === id).length, 0);
  return sessions + state.cards.filter(card => card.kind === 'wrong' && referenceFields.some(field => [card[field]].flat().includes(id))).length;
}

export function preferredFormula(state, cards) {
  const completeness = card => [card.title,card.cue,card.subject,card.notes,card.tags,card.images,...(card.distractors || [])].filter(field => field?.length).length;
  return [...cards].sort((a,b) => referenceCount(state,b.id) - referenceCount(state,a.id) || completeness(b) - completeness(a) || (a.createdAt ?? 0) - (b.createdAt ?? 0))[0];
}

const total = (cards, field) => cards.reduce((sum, card) => sum + (card[field] ?? 0), 0);
const latest = (cards, field) => cards.map(card => card[field]).filter(Boolean).sort().pop() ?? null;
const union = values => [...new Map(values.flat().filter(Boolean).map(value => [JSON.stringify(value), value])).values()];
function checkpoint(session) {
  const raw = JSON.stringify(session);
  let first = 2166136261, second = 0;
  for (let i = 0; i < raw.length; i++) {
    first = Math.imul(first ^ raw.charCodeAt(i), 16777619);
    second = Math.imul(second, 31) + raw.charCodeAt(i) | 0;
  }
  return `${raw.length}/${first}/${second}`;
}

export function mergeFormulas(state, groupIds, primaryId, now = Date.now()) {
  const ids = new Set(groupIds);
  const cards = state.cards.filter(card => card.kind === 'formula' && ids.has(card.id));
  const primary = cards.find(card => card.id === primaryId);
  if (!primary || cards.length !== ids.size || cards.length < 2) throw new Error('题库已变化，请重新扫描');
  const schedule = [...cards].sort((a,b) => b.box - a.box || (b.lastPracticedAt ?? 0) - (a.lastPracticedAt ?? 0))[0];
  const merged = { ...primary, box:schedule.box, due:schedule.due, mastered:schedule.mastered, prevMaster:schedule.prevMaster, masterSessionUndo:null, seen:total(cards,'seen'), lapses:total(cards,'lapses'), mistakes:total(cards,'mistakes'), lastDay:latest(cards,'lastDay'), lastPracticedAt:Math.max(...cards.map(card => card.lastPracticedAt ?? 0)) || null, focus:cards.some(card => card.focus), focusDay:latest(cards,'focusDay'), focusStreak:Math.max(...cards.map(card => card.focusStreak ?? 0)) };
  for (const field of ['tags','notes','images']) {
    const values = union(cards.map(card => card[field]));
    if (values.length) merged[field] = values;
  }
  const sessions = {};
  for (const [key, session] of Object.entries(state.sessions)) {
    if (![...session.items, ...(session.deferred || [])].some(item => ids.has(item.id)) && !session.history.some(event => ids.has(event.current?.question.cardId))) continue;
    const before = copy(session);
    rebaseSession(session, ids, primaryId);
    sessions[key] = { before, after:checkpoint(session) };
  }
  const references = [];
  state.cards = state.cards.flatMap(card => {
    if (ids.has(card.id)) return card.id === primaryId ? [merged] : [];
    if (card.kind !== 'wrong') return [card];
    const updated = {...card};
    for (const field of referenceFields) {
      const before = card[field];
      const after = Array.isArray(before) ? [...new Set(before.map(id => ids.has(id) ? primaryId : id))] : ids.has(before) ? primaryId : before;
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      updated[field] = after;
      references.push({id:card.id,field,before,after});
    }
    return [updated];
  });
  const entry = { id:`${primaryId}-${now}`, primaryId, cards:copy(cards), merged:copy(merged), sessions, references, expiresAt:now + MERGE_RETENTION };
  state.mergedFormulas = [...state.mergedFormulas.filter(item => item.expiresAt > now), entry];
  return entry;
}

export function restoreFormulaMerge(state, id, now = Date.now()) {
  const index = state.mergedFormulas.findIndex(entry => entry.id === id && entry.expiresAt > now);
  if (index < 0) throw new Error('这条合并记录已过期');
  const entry = state.mergedFormulas[index];
  if (state.mergedFormulas.slice(index + 1).some(later => later.expiresAt > now && later.cards.some(card => card.id === entry.primaryId))) throw new Error('这条公式又参与了合并，请先恢复较新的记录');
  const live = state.cards.find(card => card.id === entry.primaryId);
  const originals = copy(entry.cards);
  const original = originals.find(card => card.id === entry.primaryId);
  if (live) {
    for (const field of Object.keys(live)) {
      if (['seen','lapses','mistakes'].includes(field)) original[field] = Math.max(0, (original[field] ?? 0) + (live[field] ?? 0) - (entry.merged[field] ?? 0));
      else if (JSON.stringify(live[field]) !== JSON.stringify(entry.merged[field])) original[field] = live[field];
    }
  }
  state.cards = [...state.cards.filter(card => card.id !== entry.primaryId), ...originals];
  for (const [key, session] of Object.entries(entry.sessions)) {
    if (state.sessions[key] && checkpoint(state.sessions[key]) === session.after) state.sessions[key] = session.before;
  }
  for (const {id:wrongId,field,before,after} of entry.references) {
    const wrong = state.cards.find(card => card.id === wrongId);
    if (wrong && JSON.stringify(wrong[field]) === JSON.stringify(after)) wrong[field] = before;
  }
  state.mergedFormulas.splice(index, 1);
  return originals.length;
}
