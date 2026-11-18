export const DATA_VERSION = 2;
export const DEFAULT_SETTINGS = { limit:30,endpoint:'',model:'',hasKey:false };
const demoIds = new Set([
  ...Array.from({length:10},(_,i)=>'p'+String(i+1).padStart(2,'0')),
  ...Array.from({length:20},(_,i)=>'m'+String(i+1).padStart(2,'0')),
  ...Array.from({length:5},(_,i)=>'w'+String(i+1).padStart(2,'0')),
  'focus-demo',
]);
export function emptyState() {
  return {schemaVersion:DATA_VERSION,cards:[],sessions:{},settings:{...DEFAULT_SETTINGS},activity:[]};
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
  if((state.schemaVersion || 0)<DATA_VERSION)removeCards(state,demoIds);
  state.schemaVersion=DATA_VERSION;
  return state;
}
