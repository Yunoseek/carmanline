const aliases = new Map([
  ['\\dfrac', '\\frac'], ['\\tfrac', '\\frac'], ['\\backsim', '\\sim'], ['~', '\\sim'],
  ['∼', '\\sim'], ['\\cdot', '\\times'], ['\\rightarrow', '\\to'], ['→', '\\to'], ['∞', '\\infty'],
]);
const delimiters = new Set(['\\left', '\\right', '\\middle']);
const namedFunctions = /^\\(?:sin|cos|tan|cot|sec|csc|log|ln|exp|arcsin|arccos|arctan|sinh|cosh|tanh)$/;
const textCommands = /^\\(?:text\w*|mbox|hbox|operatorname|begin|end|verb)$/;

function latexTokens(value) {
  const tokens = String(value ?? '').normalize('NFC').match(/\\[A-Za-z]+|\\[\s\S]|\s+|[^\s]/gu) || [];
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (delimiters.has(token) || /^\s+$/.test(token)) continue;
    if (textCommands.test(token)) {
      // Text and identifiers can contain meaningful whitespace and punctuation.
      out.push(tokens.slice(i).join(''));
      break;
    }
    if ((token === '^' || token === '_') && tokens[i + 1] === '{' && /^[A-Za-z0-9]$/.test(tokens[i + 2]) && tokens[i + 3] === '}') {
      out.push(token, tokens[i + 2]);
      i += 3;
      continue;
    }
    const previous = out[out.length - 1];
    if (token === '{' && namedFunctions.test(tokens[i + 1]) && tokens[i + 2] === '}' && (!previous || /^[A-Za-z0-9=+\-()]$/.test(previous))) {
      out.push(tokens[i + 1]);
      i += 2;
      continue;
    }
    out.push(aliases.get(token) || token);
  }
  return out;
}

export function normalizeCondition(value) {
  const condition = String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  return condition.split(/(\$[^$]+\$)/).map(part => {
    if (part.startsWith('$') && part.endsWith('$')) part = part.slice(1, -1);
    if (!/(?:[\u3400-\u9fff]|[A-Za-z]{2,})/.test(part.replace(/\\[A-Za-z]+/g, ''))) return latexTokens(part);
    return part.replace(/\s*(?:→|\\(?:to|rightarrow)\b)\s*/g, '→').replace(/\\infty\b/g, '∞');
  });
}

export const formulaKey = card => card?.kind === 'formula' ? JSON.stringify([latexTokens(card.latex), normalizeCondition(card.cue), card.kind]) : card?.id;

export function uniqueFormulas(cards) {
  const seen = new Set();
  return cards.filter(card => {
    if (card.kind !== 'formula') return true;
    const key = formulaKey(card);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function structuralKey(latex, parseMath) {
  if (!parseMath) return null;
  try {
    return JSON.stringify(parseMath(latex), (key, value) => {
      if (key === 'loc') return undefined;
      if (value?.type === 'ordgroup' && value.body.length === 1) return value.body[0];
      return value;
    });
  } catch { return null; }
}

export function sameCondition(first, second) {
  return JSON.stringify(normalizeCondition(first.cue)) === JSON.stringify(normalizeCondition(second.cue));
}

export function findFormulaDuplicate(candidate, cards, parseMath) {
  if (candidate.kind !== 'formula') return null;
  const key = formulaKey(candidate);
  const formulas = cards.filter(card => card.kind === 'formula' && card.id !== candidate.id);
  const exact = formulas.find(card => formulaKey(card) === key);
  if (exact) return { card: exact, level: 'exact' };
  const shape = structuralKey(candidate.latex, parseMath);
  if (!shape) return null;
  const similar = formulas.find(card => sameCondition(card, candidate) && structuralKey(card.latex, parseMath) === shape);
  return similar ? { card: similar, level: 'strong' } : null;
}

// Similarity is for review suggestions only. The active queue and automatic imports use exact keys.
function tokenSimilarity(first, second) {
  if (first.length < 4 || Math.min(first.length, second.length) / Math.max(first.length, second.length) < .7) return 0;
  let previous = Array.from({length:second.length + 1}, (_, index) => index);
  for (const [index, token] of first.entries()) {
    const row = [index + 1];
    for (let col = 0; col < second.length; col++) {
      row.push(Math.min(row[col] + 1, previous[col + 1] + 1, previous[col] + Number(token !== second[col])));
    }
    previous = row;
  }
  return 1 - previous[second.length] / Math.max(first.length, second.length);
}

export function scanFormulaDuplicates(cards, parseMath) {
  const groups = new Map();
  const byCondition = new Map();
  const similar = [];
  for (const card of cards) {
    if (card.kind !== 'formula' || card.duplicateNote) continue;
    const key = formulaKey(card);
    if (groups.has(key)) { groups.get(key).push(card); continue; }
    groups.set(key, [card]);
    const condition = JSON.stringify(normalizeCondition(card.cue));
    const peers = byCondition.get(condition) || [];
    const tokens = latexTokens(card.latex);
    const shape = structuralKey(card.latex, parseMath);
    for (const peer of peers) {
      const strong = shape && shape === peer.shape;
      // Very long formulas can still be matched structurally or exactly.
      if (strong || (tokens.length <= 160 && peer.tokens.length <= 160 && tokenSimilarity(tokens, peer.tokens) >= .7)) {
        similar.push({ cards: [peer.card, card], strong: Boolean(strong) });
      }
    }
    peers.push({ card, tokens, shape });
    byCondition.set(condition, peers);
  }
  return { exact: [...groups.values()].filter(group => group.length > 1), similar };
}
