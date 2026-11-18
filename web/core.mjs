import { formulaKey, uniqueFormulas } from './duplicates.mjs';

export const INTERVALS = [0, 1, 3, 7, 15, 30];
export const recallTarget = session => session.targetPasses ?? 2;
export const copy = x => JSON.parse(JSON.stringify(x));
export function day(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return day(new Date(y, m - 1, d + days).getTime());
}
export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function makeCard(content, now = Date.now()) {
  return { ...content, box: 0, due: day(now), seen: 0, lapses: 0, mistakes: 0, focus: false, focusStreak: 0, mastered: false, lastDay: null, lastPracticedAt: null, createdAt: now };
}
export function eligible(cards, kind, today = day()) {
  const practiced = new Set(cards.filter(c => c.kind === 'formula' && c.lastDay === today).map(formulaKey));
  return uniqueFormulas(cards.filter(c => c.kind === kind && !c.focus && c.due <= today && c.lastDay !== today && !practiced.has(formulaKey(c)))
    .sort((a, b) => a.box - b.box || a.due.localeCompare(b.due) || a.createdAt - b.createdAt));
}
// Extra rounds use real calendar dates: due cards first, then unreviewed future
// cards. Explicitly mastered cards keep their promised interval until due.
export function nextRoundCards(cards, kind, previous = null, now = Date.now()) {
  const today = day(now);
  const completed = new Set(previous?.day === today ? previous.items.filter(i => i.done).map(i => i.id) : []);
  const practiced = new Set(cards.filter(c => c.kind === 'formula' && (c.lastDay === today || completed.has(c.id))).map(formulaKey));
  const available = cards.filter(c => c.kind === kind && !c.focus && c.lastDay !== today && !completed.has(c.id) && !practiced.has(formulaKey(c)) && (!c.mastered || c.due <= today));
  const pendingIds = previous ? [...previous.items.filter(i => !i.done), ...(previous.deferred || [])].map(i => i.id) : [];
  const pending = pendingIds.map(id => available.find(c => c.id === id)).filter(Boolean);
  const due = eligible(available, kind, today);
  const future = available.filter(c => c.due > today).sort((a,b) => a.due.localeCompare(b.due) || a.box - b.box || a.createdAt - b.createdAt);
  return uniqueFormulas([...new Map([...pending, ...due, ...future].map(c => [c.id,c])).values()]);
}
export function createSession(cards, kind, limit = 30, mode = 'daily', now = Date.now(), carry = null, extraRound = false) {
  const today = day(now);
  if (extraRound && (mode !== 'daily' || !carry?.finished || carry.day !== today)) throw new Error('Finish today’s daily round before starting another');
  const pending = carry ? [...carry.items.filter(i => !i.done), ...(carry.deferred || [])] : [];
  if (carry?.current) {
    const index = pending.findIndex(i => i.id === carry.current.question.cardId);
    if (index > 0) pending.unshift(pending.splice(index,1)[0]);
  }
  const oldIds = [...new Set(pending.map(i => i.id))];
  const carried = oldIds.map(id => cards.find(c => c.id === id)).filter(Boolean);
  const roundPool = extraRound ? nextRoundCards(cards, kind, carry, now) : null;
  const candidates = mode === 'focus'
    ? cards.filter(c => c.kind === kind && c.focus && c.focusDay !== today)
    : (roundPool || eligible(cards, kind, today)).filter(c => !oldIds.includes(c.id));
  const roundIds = roundPool && new Set(roundPool.map(c => c.id));
  const validCarried = extraRound ? carried.filter(c => roundIds.has(c.id)) : carried;
  const selected = uniqueFormulas(mode === 'focus' ? candidates : [...validCarried, ...candidates]).slice(0, mode === 'focus' ? undefined : limit);
  const selectedKeys = new Set(selected.map(formulaKey));
  const items = shuffle(selected).map(c => {
    const previous = pending.find(i => i.id === c.id);
    return previous ? {...copy(previous),readyTurn:0,readyAt:0} : { id: c.id, passes: 0, fails: 0, errorStreak: 0, hadForget: false, hadGuess: false, first: null, done: false, moved: false, baseBox: c.box, readyTurn: 0, readyAt: 0 };
  });
  const current = carry?.current && items.some(i => i.id === carry.current.question.cardId) ? copy(carry.current) : null;
  return {
    day: today, kind, mode, targetPasses: 3, round:extraRound ? (carry.round || 1) + 1 : 1, turn: 0, finished: false, history: [], current, items,
    deferred: pending.filter(i => {
      const card = cards.find(c => c.id === i.id);
      return card && !selectedKeys.has(formulaKey(card));
    }).map(copy),
  };
}
export function nextItem(session, now = Date.now()) {
  const pending = session.items.filter(i => !i.done);
  if (!pending.length) return { done: true };
  const item = pending.find(i => i.readyTurn <= session.turn) || pending.find(i => i.readyAt <= now);
  if (!item) return { waitUntil: Math.min(...pending.map(i => i.readyAt)) };
  return { item };
}
export function question(card, turn = 0) {
  if (card.kind === 'wrong') return { cardId: card.id, title: card.title, stem: card.stem, type: '原题复习', options: shuffle(card.options.map((text, i) => ({ text, correct: i === card.answer }))), answer: card.options[card.answer] };
  const variants = shuffle(card.distractors);
  // The source formula and the distractors are the only persistent content.
  if (turn % 4 === 3 && card.allowJudge) {
    const valid = Math.random() >= .5;
    return { cardId: card.id, title: card.title, stem: valid ? card.latex : variants[0], type: '判断正误', options: shuffle([{ text: '正确', correct: valid }, { text: '错误', correct: !valid }]), answer: card.latex, judge: true };
  }
  const cloze = card.latex.length > 48;
  return { cardId: card.id, title: card.title, stem: card.cue || '回想完整公式，再选择正确的一项', type: cloze ? '补全公式' : '公式巩固', cloze, fragment: cloze ? card.latex.slice(0,card.latex.indexOf('=')) + '=\\square' : '', options: shuffle([{ text: card.latex, correct: true }, ...variants.slice(0, 3).map(text => ({ text, correct: false }))]), answer: card.latex };
}
const scheduling = c => ({ box: c.box, due: c.due, lapses: c.lapses, mistakes: c.mistakes ?? 0, lastPracticedAt: c.lastPracticedAt ?? null, focus: c.focus, focusStreak: c.focusStreak, focusDay: c.focusDay ?? null, mastered: c.mastered, lastDay: c.lastDay, prevMaster: c.prevMaster ?? null, masterSessionUndo:c.masterSessionUndo ?? null });
function snapshot(session, card) {
  return { current: copy(session.current), before: { items: copy(session.items), turn: session.turn, card: scheduling(card), finished: session.finished } };
}
function requeue(session, item, gap, now, delay) {
  item.readyTurn = session.turn + 4;
  item.readyAt = now + delay;
  const queue = session.items.filter(i => i.id !== item.id);
  const pending = queue.filter(i => !i.done);
  const position = gap < pending.length ? queue.indexOf(pending[gap]) : queue.length;
  queue.splice(position, 0, item);
  session.items = queue;
}
export function skipQuestion(session, cards, now = Date.now()) {
  if (!session.current || session.current.revealed) return false;
  const card = cards.find(c => c.id === session.current.question.cardId);
  const item = session.items.find(i => i.id === card.id);
  session.history.push({ action: 'skip', ...snapshot(session, card) });
  requeue(session, item, Infinity, now, 20000);
  session.current = null;
  session.turn++;
  return true;
}
export function reveal(session, cards, selected, now = Date.now()) {
  const current = session.current;
  if (!current || current.revealed) return;
  current.selected = selected;
  current.revealed = true;
  if (!current.seenRecorded) { cards.find(c => c.id === current.question.cardId).seen++; current.seenRecorded = true; }
  current.revealedAt = now;
}
export function grade(session, cards, outcome, now = Date.now()) {
  if (!session.current?.revealed) throw new Error('Reveal before grading');
  const card = cards.find(c => c.id === session.current.question.cardId);
  const item = session.items.find(i => i.id === card.id);
  session.history.push(snapshot(session, card));
  const success = outcome === 'know' || outcome === 'slip';
  card.lastPracticedAt = now;
  if (!success) card.mistakes = (card.mistakes ?? 0) + 1;
  if (item.first === null) item.first = outcome;
  if (session.mode === 'focus') {
    item.done = true; card.focusDay = day(now);
    card.focusStreak = success ? card.focusStreak + 1 : 0;
    if (card.focusStreak >= 3) { card.focus = false; card.focusStreak = 0; card.box = 0; card.due = addDays(day(now), 1); card.lastDay = day(now); }
  } else {
    if (success) { item.passes++; item.errorStreak = 0; }
    else { item.passes = 0; item.fails++; item.errorStreak++; item.hadForget = item.hadForget || outcome === 'forget'; item.hadGuess = item.hadGuess || outcome === 'guess'; }
    if (item.errorStreak >= 5) {
      item.done = true; item.moved = true; card.focus = true; card.focusStreak = 0; card.focusDay = day(now); card.mastered = false;
      card.box = 0; card.due = day(now); card.lapses++; card.lastDay = day(now);
    } else if (item.passes >= recallTarget(session)) {
      item.done = true;
      card.box = item.hadForget ? 0 : item.hadGuess ? Math.max(0, item.baseBox - 1) : item.first === 'slip' ? item.baseBox : Math.min(5, item.baseBox + 1);
      if (item.hadForget || item.hadGuess) { card.lapses++; card.mastered = false; }
      card.due = addDays(day(now), Math.max(1, INTERVALS[card.box])); card.lastDay = day(now);
    } else {
      const gap = success ? 5 + Math.floor(Math.random() * 3) : 3;
      requeue(session, item, gap, now, success ? 30000 : 20000);
    }
  }
  session.turn++; session.current = null;
  session.finished = session.items.every(i => i.done);
  return { completed: item.done, moved: item.moved };
}
export function undo(session, cards) {
  const event = session.history.pop();
  if (!event) return false;
  session.items = event.before.items; session.turn = event.before.turn; session.finished = event.before.finished;
  Object.assign(cards.find(c => c.id === event.current.question.cardId), event.before.card);
  session.current = { ...event.current, fromUndo: true };
  return true;
}
export function markMastered(session, cards, now = Date.now()) {
  if (!session.current || session.mode === 'focus') return false;
  const c = cards.find(c => c.id === session.current.question.cardId);
  const historyId='master-'+c.id+'-'+now+'-'+session.turn;
  session.history.push({ action:'master',id:historyId,...snapshot(session, c) });
  c.prevMaster = scheduling(c); c.mastered = true; c.box = 5; c.due = addDays(day(now), 30); c.lastDay = day(now);
  c.masterSessionUndo = { day:session.day,kind:session.kind,mode:session.mode,historyId,item:copy(session.items.find(i=>i.id===c.id)) };
  session.items.find(i => i.id === c.id).done = true;
  session.current = null; session.turn++; session.finished = session.items.every(i => i.done);
  return true;
}
export function unmarkMastered(card, sessions = []) {
  const sessionUndo = card.masterSessionUndo;
  if (card.prevMaster) {
    const { mistakes, lastPracticedAt, ...previousSchedule } = card.prevMaster;
    Object.assign(card, previousSchedule);
  }
  card.mastered = false; card.prevMaster = null; card.masterSessionUndo = null;
  for (const session of sessions) {
    if(sessionUndo && session.day===sessionUndo.day && session.kind===sessionUndo.kind && session.mode===sessionUndo.mode) {
      const index=session.items.findIndex(i=>i.id===card.id);
      if(index!==-1) {
        const restored={...copy(sessionUndo.item),readyTurn:0,readyAt:0};
        session.items[index]=restored;session.finished=false;
        const markIndex=session.history.findIndex(event=>event.id===sessionUndo.historyId);
        if(markIndex!==-1) {
          for(let i=markIndex+1;i<session.history.length;i++) {
            const before=session.history[i].before;
            before.items=before.items.map(item=>item.id===card.id?copy(restored):item);
            before.finished=before.items.every(item=>item.done);
          }
          session.history.splice(markIndex,1);
        }
      }
    }
    if(session.current?.question.cardId===card.id) {
      const item=session.items.find(i=>i.id===card.id);if(item)item.baseBox=card.box;
    }
  }
}
