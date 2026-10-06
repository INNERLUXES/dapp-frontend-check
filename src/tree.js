// The values of a JSON file of the project, read from the tokens of the lexer: objects with their keys, lists, strings,
// numbers and the words true, false and null. The reader is forgiving, because the JSON files of a front end are often
// JSON with comments (tsconfig.json) or have a comma at the end of a list; it never refuses a file, and reads what it
// can. The configuration of the tool itself is read by the strict reader of src/json.js instead. A name such as
// __proto__ is kept in a list of entries and never becomes a property. The reader keeps a stack of its own, with no
// recursion, and stops at a nesting of LEX_LIMITS.maxNesting.

import { LEX_LIMITS, LexError } from './lexer.js';

// The value of a file: { k: 'obj', entries: [{ key, keyAt, node }], o } | { k: 'arr', items, o } | { k: 'str', v, o }
// | { k: 'num', v, o } | { k: 'lit', v, o }, or null when the file holds no value.
export function readTree(tokens, limits = LEX_LIMITS) {
  const maxNesting = limits.maxNesting ?? LEX_LIMITS.maxNesting;
  let root = null;
  const stack = [];
  const attach = (node) => {
    const top = stack[stack.length - 1];
    if (!top) {
      if (root === null) root = node;
      return;
    }
    if (top.node.k === 'obj') {
      if (top.key !== null) top.node.entries.push({ key: top.key, keyAt: top.keyAt, node });
      top.key = null;
    } else top.node.items.push(node);
  };
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const top = stack[stack.length - 1];
    const next = tokens[i + 1];
    if (t.t === 'p' && (t.v === '{' || t.v === '[')) {
      const node = t.v === '{' ? { k: 'obj', entries: [], o: t.o } : { k: 'arr', items: [], o: t.o };
      attach(node);
      if (stack.length >= maxNesting) throw new LexError(`values nested more than ${maxNesting} deep`, t.o);
      stack.push({ node, key: null, keyAt: 0 });
    } else if (t.t === 'p' && (t.v === '}' || t.v === ']')) {
      if (stack.length) stack.pop();
    } else if ((t.t === 'str' || t.t === 'id' || t.t === 'num') && top && top.node.k === 'obj' && top.key === null && next && next.t === 'p' && next.v === ':') {
      top.key = t.v;
      top.keyAt = t.o;
    } else if (t.t === 'str') attach({ k: 'str', v: t.v, o: t.o });
    else if (t.t === 'num') attach({ k: 'num', v: Number(t.v.replace(/[_n]/g, '')), o: t.o });
    else if (t.t === 'p' && t.v === '-' && next && next.t === 'num') {
      attach({ k: 'num', v: -Number(next.v.replace(/[_n]/g, '')), o: t.o });
      i += 1;
    } else if (t.t === 'id') attach({ k: 'lit', v: t.v, o: t.o });
    else if (t.t === 'p' && t.v === ',' && top && top.node.k === 'obj') top.key = null;
  }
  return root;
}

// Calls visit(node, keys, owners) for every string and number of a value, with the keys from the top down to it (null
// for a place in a list) and the objects that hold it, the innermost last. The walk keeps a stack of its own.
export function walkTree(root, visit) {
  if (!root) return;
  const stack = [{ node: root, keys: [], owners: [] }];
  while (stack.length) {
    const { node, keys, owners } = stack.pop();
    if (node.k === 'obj') {
      const inner = [...owners, node];
      for (let k = node.entries.length - 1; k >= 0; k -= 1) stack.push({ node: node.entries[k].node, keys: [...keys, node.entries[k].key], owners: inner });
    } else if (node.k === 'arr') {
      for (let k = node.items.length - 1; k >= 0; k -= 1) stack.push({ node: node.items[k], keys: [...keys, null], owners });
    } else visit(node, keys, owners);
  }
}

// The value of a key in an object node, or undefined; the first entry wins.
export function entryOf(obj, key) {
  const e = obj.entries.find((x) => x.key === key);
  return e ? e.node : undefined;
}
