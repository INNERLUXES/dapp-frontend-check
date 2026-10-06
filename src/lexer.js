// A JavaScript and TypeScript lexer of the tool's own. It reads the text once, left to right, and turns it into tokens
// with their offsets, so that no check of the code ever looks inside a comment, a string, a template literal, a regular
// expression literal or the text of a JSX element, while the rules on secrets, addresses and RPC addresses can still
// read the value of every string and the fixed parts of every template literal. JSON files are read with the same lexer:
// JSON is a JavaScript expression, and the comments of JSON with comments are passed over.
//
// - A line comment (//, and #! on the first line) and a block comment give no token.
// - A string in double or single quotes is one 'str' token with its value; an escape is read for its meaning, and a
//   string that is not closed ends at the end of its line.
// - A template literal gives a 'tpl' token with its fixed parts, the tokens of each ${...} between a '${' and a '}', and
//   a 'tplEnd' token.
// - A slash where an expression may start opens a regular expression literal, one 're' token with no value; elsewhere
//   it is a division. The choice is made from the token before it, as the grammar does.
// - In a .js, .jsx, .mjs, .cjs or .tsx file, a < where an expression may start, followed by a letter or >, opens a JSX
//   element: tag names and attribute names are 'id' tokens, attribute values in quotes 'str' tokens, an expression in
//   braces is read as code, and the text between tags gives no token. In .ts, .mts and .cts files a < is always an
//   operator, because <T>x is a type assertion there.
// - Numbers keep their text, names their name, and the operators of the language are read longest first.
//
// The lexer keeps a stack of its own for templates, JSX elements and the braces inside them, and never recurses. It
// never fails on what it reads; it stops only at its limits of tokens, of the length of a name or a number, and of
// nesting (docs/limits.md), with the offset of the place.

export const LEX_LIMITS = { maxTokens: 400000, maxNameLength: 1024, maxNesting: 256, maxStringValue: 65536 };

export class LexError extends Error {
  constructor(reason, offset) {
    super(reason);
    this.reason = reason;
    this.offset = offset;
  }
}

// The operators of JavaScript and TypeScript, longest first.
const OPERATORS = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '|=', '&=', '^=', '<<', '>>', '**'];

// The words after which a slash starts a regular expression and a < starts a JSX element.
const EXPRESSION_WORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await', 'extends']);

const ESCAPES = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' };

const isIdStart = (c) => (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 36 || c === 95;
const isIdPart = (c) => isIdStart(c) || (c >= 48 && c <= 57);
const isDigit = (c) => c >= 48 && c <= 57;
const isSpace = (c) => c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 11 || c === 0xa0 || c === 0xfeff || c === 0x2028 || c === 0x2029;
const isLineEnd = (c) => c === 10 || c === 13 || c === 0x2028 || c === 0x2029;
const isHex = (c) => isDigit(c) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);

// True when the token before a place lets an expression start there.
function expressionMayStart(prev) {
  if (!prev) return true;
  if (prev.t === 'id') return EXPRESSION_WORDS.has(prev.v);
  if (prev.t === 'p') return !(prev.v === ')' || prev.v === ']' || prev.v === '++' || prev.v === '--');
  return false;
}

// True when a file of this name may hold JSX: every JavaScript file and .tsx, not .ts, .mts or .cts.
export function allowsJsx(path) {
  const p = String(path).toLowerCase();
  return !(p.endsWith('.ts') || p.endsWith('.mts') || p.endsWith('.cts') || p.endsWith('.json'));
}

// The tokens of a text: { tokens: [{ t, v, o }], blanks: [[start, end]] }. t is 'id' (a name or a keyword), 'num' (a
// number, with its text), 'str' (a string, v its value), 'tpl' (a template literal, v its fixed parts joined by ${},
// parts the list of them), 'tplEnd', 're' (a regular expression literal), 'p' (punctuation or an operator) or 'other'
// (a character outside ASCII outside a literal). blanks lists the ranges of comments, literals and JSX text.
export function tokenize(text, { jsx = true, limits = LEX_LIMITS } = {}) {
  const lim = { ...LEX_LIMITS, ...limits };
  const n = text.length;
  const tokens = [];
  const blanks = [];
  // The stack of what the lexer is inside: { mode: 'code', braces, until } where until says what a closing brace at
  // depth 0 returns to ('tpl', 'jsx' or null at the top), { mode: 'tpl', token } or { mode: 'jsx', level, inTag,
  // closing }.
  const stack = [{ mode: 'code', braces: 0, until: null }];
  let prev = null;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (text.startsWith('#!', i)) {
    while (i < n && !isLineEnd(text.charCodeAt(i))) i += 1;
  }
  const push = (t, v, o, extra) => {
    if (tokens.length >= lim.maxTokens) throw new LexError(`more than ${lim.maxTokens.toLocaleString('en-US')} tokens`, o);
    const tok = extra ? { t, v, o, ...extra } : { t, v, o };
    tokens.push(tok);
    prev = tok;
    return tok;
  };
  const enter = (frame, at) => {
    if (stack.length > lim.maxNesting) throw new LexError(`templates, JSX elements or braces nested more than ${lim.maxNesting} deep`, at);
    stack.push(frame);
  };
  // A quoted string from its opening quote at q: { end, value }. In JSX attributes there are no escapes and a line end
  // does not end the string.
  const quoted = (q, escapes = true) => {
    const quote = text.charCodeAt(q);
    let k = q + 1;
    let value = '';
    let from = k;
    const add = (s) => {
      if (value.length < lim.maxStringValue) value += s;
    };
    while (k < n) {
      const c = text.charCodeAt(k);
      if (c === quote) {
        add(text.slice(from, k));
        return { end: k + 1, value: value.slice(0, lim.maxStringValue) };
      }
      if (escapes && isLineEnd(c)) break;
      if (escapes && c === 92 && k + 1 < n) {
        add(text.slice(from, k));
        const e = text[k + 1];
        if (isLineEnd(text.charCodeAt(k + 1))) {
          k += text.charCodeAt(k + 1) === 13 && text.charCodeAt(k + 2) === 10 ? 3 : 2;
        } else if (e === 'x' && isHex(text.charCodeAt(k + 2)) && isHex(text.charCodeAt(k + 3))) {
          add(String.fromCharCode(parseInt(text.slice(k + 2, k + 4), 16)));
          k += 4;
        } else if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(k + 2, k + 6))) {
          add(String.fromCharCode(parseInt(text.slice(k + 2, k + 6), 16)));
          k += 6;
        } else {
          add(Object.hasOwn(ESCAPES, e) ? ESCAPES[e] : e);
          k += 2;
        }
        from = k;
        continue;
      }
      k += 1;
    }
    add(text.slice(from, k));
    return { end: k, value: value.slice(0, lim.maxStringValue) };
  };
  // Reads the fixed text of a template from k to its end or to ${; returns { end, part, opens }.
  const templateText = (k) => {
    const start = k;
    let part = '';
    let from = k;
    while (k < n) {
      const c = text.charCodeAt(k);
      if (c === 96) {
        part += text.slice(from, k);
        return { end: k + 1, part, opens: false, start };
      }
      if (c === 36 && text.charCodeAt(k + 1) === 123) {
        part += text.slice(from, k);
        return { end: k + 2, part, opens: true, start };
      }
      if (c === 92 && k + 1 < n) {
        part += text.slice(from, k);
        const e = text[k + 1];
        part += Object.hasOwn(ESCAPES, e) ? ESCAPES[e] : e;
        k += 2;
        from = k;
        continue;
      }
      k += 1;
    }
    part += text.slice(from, k);
    return { end: n, part, opens: false, start };
  };
  // Continues a template after its opening backtick or after the } of a ${...}.
  const readTemplate = (frame, k) => {
    const r = templateText(k);
    const parts = frame.token.parts;
    if (parts.length < 4096) {
      parts.push(r.part.slice(0, lim.maxStringValue));
      frame.token.v = parts.join('${}').slice(0, lim.maxStringValue);
    }
    blanks.push([r.start, r.opens ? r.end - 2 : Math.max(r.start, r.end - 1)]);
    if (r.opens) {
      push('p', '${', r.end - 2);
      enter({ mode: 'code', braces: 0, until: 'tpl' }, r.end - 2);
    } else {
      stack.pop();
      push('tplEnd', '', Math.max(0, r.end - 1));
    }
    return r.end;
  };
  while (i < n) {
    const frame = stack[stack.length - 1];
    if (frame.mode === 'jsx') {
      i = readJsx(frame, i);
      continue;
    }
    const c = text.charCodeAt(i);
    if (isSpace(c)) {
      i += 1;
      continue;
    }
    if (c === 47 && text.charCodeAt(i + 1) === 47) {
      const start = i;
      while (i < n && !isLineEnd(text.charCodeAt(i))) i += 1;
      blanks.push([start, i]);
      continue;
    }
    if (c === 47 && text.charCodeAt(i + 1) === 42) {
      const start = i;
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      blanks.push([start, i]);
      continue;
    }
    if (c === 34 || c === 39) {
      const r = quoted(i);
      push('str', r.value, i);
      blanks.push([i, r.end]);
      i = r.end;
      continue;
    }
    if (c === 96) {
      const tok = push('tpl', '', i, { parts: [] });
      enter({ mode: 'tpl', token: tok }, i);
      i = readTemplate(stack[stack.length - 1], i + 1);
      continue;
    }
    if (c === 47 && expressionMayStart(prev)) {
      const start = i;
      let k = i + 1;
      let inClass = false;
      while (k < n) {
        const d = text.charCodeAt(k);
        if (isLineEnd(d)) break;
        if (d === 92) {
          k += 2;
          continue;
        }
        if (d === 91) inClass = true;
        else if (d === 93) inClass = false;
        else if (d === 47 && !inClass) {
          k += 1;
          break;
        }
        k += 1;
      }
      while (k < n && isIdPart(text.charCodeAt(k))) k += 1;
      push('re', '', start);
      blanks.push([start, Math.min(k, n)]);
      i = Math.min(k, n);
      continue;
    }
    if (c === 60 && jsx && expressionMayStart(prev) && (isIdStart(text.charCodeAt(i + 1)) || text.charCodeAt(i + 1) === 62)) {
      push('p', '<', i);
      enter({ mode: 'jsx', level: 0, inTag: true, closing: false }, i);
      i += 1;
      continue;
    }
    if (c === 123) {
      frame.braces += 1;
      push('p', '{', i);
      i += 1;
      continue;
    }
    if (c === 125) {
      if (frame.braces === 0 && frame.until !== null) {
        push('p', '}', i);
        stack.pop();
        const back = stack[stack.length - 1];
        if (back.mode === 'tpl') i = readTemplate(back, i + 1);
        else i += 1;
        continue;
      }
      if (frame.braces > 0) frame.braces -= 1;
      push('p', '}', i);
      i += 1;
      continue;
    }
    if (isIdStart(c) || c === 92) {
      const start = i;
      i += 1;
      while (i < n && (isIdPart(text.charCodeAt(i)) || text.charCodeAt(i) === 92)) i += 1;
      if (i - start > lim.maxNameLength) throw new LexError(`a name longer than ${lim.maxNameLength.toLocaleString('en-US')} characters`, start);
      push('id', text.slice(start, i), start);
      continue;
    }
    if (isDigit(c) || (c === 46 && isDigit(text.charCodeAt(i + 1)))) {
      const start = i;
      const x = text.charCodeAt(i + 1);
      if (c === 48 && (x === 120 || x === 88 || x === 98 || x === 66 || x === 111 || x === 79)) {
        i += 2;
        while (i < n && (isHex(text.charCodeAt(i)) || text.charCodeAt(i) === 95)) i += 1;
      } else {
        while (i < n && (isDigit(text.charCodeAt(i)) || text.charCodeAt(i) === 95 || text.charCodeAt(i) === 46)) i += 1;
        if (i < n && (text.charCodeAt(i) === 101 || text.charCodeAt(i) === 69)) {
          i += 1;
          if (text.charCodeAt(i) === 45 || text.charCodeAt(i) === 43) i += 1;
          while (i < n && isDigit(text.charCodeAt(i))) i += 1;
        }
      }
      if (text.charCodeAt(i) === 110) i += 1;
      if (i - start > lim.maxNameLength) throw new LexError(`a number longer than ${lim.maxNameLength.toLocaleString('en-US')} characters`, start);
      push('num', text.slice(start, i), start);
      continue;
    }
    let op = null;
    for (const o of OPERATORS) {
      if (text.startsWith(o, i)) {
        op = o;
        break;
      }
    }
    if (op) {
      push('p', op, i);
      i += op.length;
      continue;
    }
    if (c < 128) {
      push('p', text[i], i);
      i += 1;
      continue;
    }
    push('other', '', i);
    i += c >= 0xd800 && c <= 0xdbff ? 2 : 1;
  }
  return { tokens, blanks };

  // Reads JSX from k in the frame: a tag (its name, attributes, values in quotes and expressions in braces) or the
  // text between tags. Returns the offset to go on from.
  function readJsx(frame, k) {
    if (frame.inTag) {
      while (k < n && isSpace(text.charCodeAt(k))) k += 1;
      if (k >= n) return n;
      const c = text.charCodeAt(k);
      if (c === 47 && text.charCodeAt(k + 1) === 62) {
        push('p', '/>', k);
        frame.inTag = false;
        if (frame.level === 0) stack.pop();
        return k + 2;
      }
      if (c === 62) {
        push('p', '>', k);
        frame.inTag = false;
        if (frame.closing) {
          if (frame.level === 0) stack.pop();
        } else frame.level += 1;
        return k + 1;
      }
      if (c === 34 || c === 39) {
        const r = quoted(k, false);
        push('str', r.value, k);
        blanks.push([k, r.end]);
        return r.end;
      }
      if (c === 123) {
        push('p', '{', k);
        enter({ mode: 'code', braces: 0, until: 'jsx' }, k);
        return k + 1;
      }
      if (c === 47 && text.charCodeAt(k + 1) === 47) {
        const start = k;
        while (k < n && !isLineEnd(text.charCodeAt(k))) k += 1;
        blanks.push([start, k]);
        return k;
      }
      if (c === 47 && text.charCodeAt(k + 1) === 42) {
        const end = text.indexOf('*/', k + 2);
        blanks.push([k, end < 0 ? n : end + 2]);
        return end < 0 ? n : end + 2;
      }
      if (isIdStart(c)) {
        const start = k;
        while (k < n && (isIdPart(text.charCodeAt(k)) || text.charCodeAt(k) === 45)) k += 1;
        if (k - start > lim.maxNameLength) throw new LexError(`a name longer than ${lim.maxNameLength.toLocaleString('en-US')} characters`, start);
        push('id', text.slice(start, k), start);
        return k;
      }
      push(c < 128 ? 'p' : 'other', c < 128 ? text[k] : '', k);
      return k + 1;
    }
    // The text between tags, up to the next < or {.
    const start = k;
    while (k < n && text.charCodeAt(k) !== 60 && text.charCodeAt(k) !== 123) k += 1;
    if (k > start) blanks.push([start, k]);
    if (k >= n) return n;
    if (text.charCodeAt(k) === 123) {
      push('p', '{', k);
      enter({ mode: 'code', braces: 0, until: 'jsx' }, k);
      return k + 1;
    }
    let m = k + 1;
    while (m < n && isSpace(text.charCodeAt(m))) m += 1;
    push('p', '<', k);
    frame.inTag = true;
    if (text.charCodeAt(m) === 47) {
      push('p', '/', m);
      frame.closing = true;
      frame.level -= 1;
      return m + 1;
    }
    frame.closing = false;
    return k + 1;
  }
}

// The text with every comment, literal and JSX text blanked: each character in them a space, line ends kept, so that
// offsets, lines and columns stay where they were.
export function blankText(text, options = {}) {
  const { blanks } = tokenize(text, options);
  const parts = [];
  let at = 0;
  for (const [start, end] of [...blanks].sort((a, b) => a[0] - b[0])) {
    if (end <= at) continue;
    const from = Math.max(start, at);
    parts.push(text.slice(at, from), text.slice(from, end).replace(/[^\r\n]/g, ' '));
    at = end;
  }
  parts.push(text.slice(at));
  return parts.join('');
}

// The opening and closing brackets: ( with ), [ with ], { and ${ with }, and a template with its end.
const OPEN = new Map([['(', ')'], ['[', ']'], ['{', '}'], ['${', '}']]);
const CLOSE = new Set([')', ']', '}']);

// For every token, the index of the bracket that matches it (an opening bracket gives its closing one and the other
// way round), or -1; and for every token the index of the innermost bracket around it, or -1. Every bracket is
// matched once, with a stack of its own; a closing bracket that matches nothing is passed over.
export function brackets(tokens) {
  const match = new Int32Array(tokens.length).fill(-1);
  const parent = new Int32Array(tokens.length).fill(-1);
  const stack = [];
  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    parent[k] = stack.length ? stack[stack.length - 1] : -1;
    const opens = (t.t === 'p' && OPEN.has(t.v)) || t.t === 'tpl';
    const closes = (t.t === 'p' && CLOSE.has(t.v)) || t.t === 'tplEnd';
    if (opens) stack.push(k);
    else if (closes && stack.length) {
      const top = tokens[stack[stack.length - 1]];
      const fits = t.t === 'tplEnd' ? top.t === 'tpl' : top.t === 'p' && OPEN.get(top.v) === t.v;
      if (fits) {
        const open = stack.pop();
        match[open] = k;
        match[k] = open;
        parent[k] = stack.length ? stack[stack.length - 1] : -1;
      }
    }
  }
  return { match, parent };
}
