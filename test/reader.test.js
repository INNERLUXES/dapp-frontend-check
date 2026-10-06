import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEX_LIMITS, LexError, allowsJsx, argumentsOf, blankText, brackets, chainAt, entriesOf, entryOf, expressionEnd, fileView, isCall, namesAround, parseEnv, readTree, tokenize, walkTree } from '../src/index.js';

// The readers: the JavaScript and TypeScript lexer with its strings, templates, regular expressions and JSX, the
// brackets and the views the checks share, the forgiving reader of JSON files, and the reader of env files.

const kinds = (text, options) => tokenize(text, options).tokens.map((t) => (t.t === 'id' || t.t === 'num' || t.t === 'p' ? t.v : `<${t.t}${t.v ? ` ${t.v}` : ''}>`));

test('lexer: comments give no token, strings keep their value with escapes, and an unclosed string ends at its line', () => {
  assert.deepEqual(kinds('a // eth_sign\nb /* window.web3 */ c'), ['a', 'b', 'c']);
  assert.deepEqual(kinds('x = "a\\nb\\u0041\\x42\\q";'), ['x', '=', '<str a\nbABq>', ';']);
  assert.deepEqual(kinds("y = 'it\\'s';"), ['y', '=', "<str it's>", ';']);
  assert.deepEqual(kinds('s = "open\nnext;'), ['s', '=', '<str open>', 'next', ';']);
  assert.deepEqual(kinds('s = "a\\\nb";'), ['s', '=', '<str ab>', ';'], 'a backslash before a line end carries the string on');
  assert.deepEqual(kinds('s = "a\\\r\nb";'), ['s', '=', '<str ab>', ';']);
  assert.deepEqual(kinds('a /* never closed\nb'), ['a']);
  assert.deepEqual(kinds('#!/usr/bin/env node\nrun()'), ['run', '(', ')'], 'a hashbang line is passed over');
  assert.deepEqual(kinds('s = "ends at the file'), ['s', '=', '<str ends at the file>']);
  assert.equal(tokenize(`s = "${'x'.repeat(50)}";`, { limits: { maxStringValue: 10 } }).tokens[2].v, 'x'.repeat(10), 'a long value is capped');
  assert.equal(tokenize(`s = "a\\n${'x'.repeat(50)}";`, { limits: { maxStringValue: 10 } }).tokens[2].v.length, 10);
});

test('lexer: template literals keep their fixed parts, with the tokens of every ${...} between, nested too', () => {
  const t = tokenize('u = `https://h/${key}/x${a ? `in${b}` : 1}` + 1').tokens;
  assert.deepEqual(t.map((x) => x.t), ['id', 'p', 'tpl', 'p', 'id', 'p', 'p', 'id', 'p', 'tpl', 'p', 'id', 'p', 'tplEnd', 'p', 'num', 'p', 'tplEnd', 'p', 'num']);
  assert.deepEqual(t[2].parts, ['https://h/', '/x', '']);
  assert.equal(t[2].v, 'https://h/${}/x${}');
  assert.deepEqual(t[9].parts, ['in', '']);
  assert.deepEqual(kinds('`a\\`b\\n`'), ['<tpl a`b\n>', '<tplEnd>']);
  assert.deepEqual(kinds('`open ${x'), ['<tpl open >', '${', 'x']);
  assert.deepEqual(kinds('`never closed'), ['<tpl never closed>', '<tplEnd>']);
  assert.deepEqual(kinds('`${ {a: 1} }`'), ['<tpl ${}>', '${', '{', 'a', ':', '1', '}', '}', '<tplEnd>'], 'braces inside a substitution are counted');
});

test('lexer: a slash is a regular expression where an expression may start, and a division elsewhere', () => {
  assert.deepEqual(kinds('x = /eth_sign[/]x/g.test(c) / 2'), ['x', '=', '<re>', '.', 'test', '(', 'c', ')', '/', '2']);
  assert.deepEqual(kinds('return /a\\/b/'), ['return', '<re>']);
  assert.deepEqual(kinds('a / b / c'), ['a', '/', 'b', '/', 'c']);
  assert.deepEqual(kinds('a[0] / 2'), ['a', '[', '0', ']', '/', '2']);
  assert.deepEqual(kinds('i++ / 2'), ['i', '++', '/', '2']);
  assert.deepEqual(kinds('x = /open\ny'), ['x', '=', '<re>', 'y'], 'an unclosed regular expression ends at its line');
  assert.deepEqual(kinds('"s" / 2'), ['<str s>', '/', '2']);
  assert.deepEqual(kinds('x /= 2'), ['x', '/=', '2']);
});

test('lexer: JSX elements in .js, .jsx and .tsx, with text set aside, attributes and expressions read; .ts reads < as an operator', () => {
  assert.deepEqual(kinds('return <p className="a" title=\'b\'>Don\'t {x} <b>eth_sign</b> / no</p>; next()'), ['return', '<', 'p', 'className', '=', '<str a>', 'title', '=', '<str b>', '>', '{', 'x', '}', '<', 'b', '>', '<', '/', 'b', '>', '<', '/', 'p', '>', ';', 'next', '(', ')']);
  assert.deepEqual(kinds('const C = () => <><Foo {...p} bar={{ __html: m }} /></>; y < z'), ['const', 'C', '=', '(', ')', '=>', '<', '>', '<', 'Foo', '{', '...', 'p', '}', 'bar', '=', '{', '{', '__html', ':', 'm', '}', '}', '/>', '<', '/', '>', ';', 'y', '<', 'z']);
  assert.deepEqual(kinds('<a-b x:y="1" /* c */ // d\n/>'), ['<', 'a-b', 'x', ':', 'y', '=', '<str 1>', '/>']);
  assert.deepEqual(kinds('<a \u00e9/>'), ['<', 'a', '<other>', '/>']);
  assert.deepEqual(kinds('let x = <T>y;', { jsx: false }), ['let', 'x', '=', '<', 'T', '>', 'y', ';']);
  assert.deepEqual(kinds('f(a < b, c > d)'), ['f', '(', 'a', '<', 'b', ',', 'c', '>', 'd', ')']);
  assert.deepEqual(kinds('<div>open text'), ['<', 'div', '>'], 'text that is never closed runs to the end');
  assert.deepEqual(kinds('<div'), ['<', 'div']);
  assert.ok(allowsJsx('a.tsx') && allowsJsx('a.js') && allowsJsx('A.JSX') && allowsJsx('a.mjs'));
  assert.ok(!allowsJsx('a.ts') && !allowsJsx('a.mts') && !allowsJsx('a.CTS') && !allowsJsx('a.json'));
});

test('lexer: numbers, names, operators longest first, characters outside ASCII and a byte order mark', () => {
  assert.deepEqual(kinds('0xFFn 1_000 .5 1e-3 1E+3 2n**256n 0b101 0o17'), ['0xFFn', '1_000', '.5', '1e-3', '1E+3', '2n', '**', '256n', '0b101', '0o17']);
  assert.deepEqual(kinds('a >>>= b ... c === d !== e ??= f ?. g => h'), ['a', '>>>=', 'b', '...', 'c', '===', 'd', '!==', 'e', '??=', 'f', '?.', 'g', '=>', 'h']);
  assert.deepEqual(kinds('$x _y a1 #p \\u0061b'), ['$x', '_y', 'a1', '#', 'p', '\\u0061b']);
  assert.deepEqual(kinds('a \u00e9 \ud83d\ude00 b'), ['a', '<other>', '<other>', 'b']);
  assert.equal(tokenize('\ufeffa').tokens[0].o, 1);
  assert.deepEqual(tokenize('a\r\n  b').tokens.map((x) => x.o), [0, 5]);
});

test('lexer: blankText keeps every offset and line end and blanks comments, strings, templates, regular expressions and JSX text', () => {
  const text = 'a = "eth_sign"; // x\r\n/* y\nz */ b = /re/; c = `t${d}u`;';
  const blank = blankText(text);
  assert.equal(blank.length, text.length);
  assert.ok(!blank.includes('eth_sign') && !blank.includes('re/') && !blank.includes('t$'));
  assert.ok(blank.includes('${d}'));
  assert.equal(blankText('<p>window.web3</p>').trim(), '<p>' + ' '.repeat(11) + '</p>');
});

test('lexer: the limits of tokens, names, numbers and nesting stop with the place', () => {
  assert.throws(() => tokenize('a b c d', { limits: { maxTokens: 3 } }), (e) => e instanceof LexError && /more than 3 tokens/.test(e.reason) && e.offset === 6);
  assert.throws(() => tokenize(`x ${'n'.repeat(20)}`, { limits: { maxNameLength: 10 } }), (e) => e instanceof LexError && /a name longer than 10 characters/.test(e.reason) && e.offset === 2);
  assert.throws(() => tokenize(`x = 0x${'1'.repeat(20)};`, { limits: { maxNameLength: 10 } }), /a number longer than 10 characters/);
  assert.throws(() => tokenize(`<${'n'.repeat(20)} />`, { limits: { maxNameLength: 10 } }), /a name longer than 10 characters/);
  assert.throws(() => tokenize('`${`${`${x}`}`}`', { limits: { maxNesting: 3 } }), /nested more than 3 deep/);
  assert.equal(LEX_LIMITS.maxTokens, 400000);
  assert.equal(LEX_LIMITS.maxNesting, 256);
});

test('brackets: every bracket matched once, with the bracket around each token', () => {
  const tokens = tokenize('f(a, `x${b, c}`, [1]) ) {}').tokens;
  const { match, parent } = brackets(tokens);
  assert.equal(match[1], 15);
  assert.equal(match[15], 1);
  assert.equal(match[4], 10, 'a template with its end');
  assert.equal(match[5], 9, '${ with }');
  assert.equal(match[16], -1, 'a closing bracket that matches nothing');
  assert.equal(parent[2], 1);
  assert.equal(parent[7], 5);
  assert.equal(brackets(tokenize('(]').tokens).match[0], -1);
});

test('views: arguments, entries, expressions, member chains, calls and the names around a string', () => {
  const v = fileView(tokenize("const A: Map<string, number> = make(); const B = { k: 1, ...rest, s, 'q': f(1, 2), [x]: 2, m() { return 1; } }; a.b?.c(x, [y, z], { w })").tokens);
  const t = v.tokens;
  assert.ok(v.consts.has('A') && v.consts.has('B'));
  const open = v.consts.get('B');
  assert.deepEqual(entriesOf(v, open).map((e) => [e.key, e.spread, e.shorthand]), [['k', false, false], [null, true, false], ['s', false, true], ['q', false, false]]);
  const call = t.findIndex((x) => x.v === 'c');
  assert.deepEqual(chainAt(v, call), ['a', 'b', 'c']);
  assert.ok(isCall(v, call));
  assert.equal(argumentsOf(v, call + 1).length, 3);
  assert.equal(expressionEnd(v, open), v.match[open] + 1);
  const decl = fileView(tokenize('function f(a) { return a; } async g(b): Promise<void> { } h(1);').tokens);
  assert.ok(!isCall(decl, 1), 'a function declaration');
  assert.ok(!isCall(decl, decl.tokens.findIndex((x) => x.v === 'g')), 'a method with a return type');
  assert.ok(isCall(decl, decl.tokens.findIndex((x) => x.v === 'h')));
  assert.ok(!isCall(decl, decl.tokens.length - 1));
  assert.deepEqual(argumentsOf(fileView(tokenize('f(').tokens), 1), []);
  assert.deepEqual(entriesOf(fileView(tokenize('{').tokens), 0), []);
  const n = fileView(tokenize("const relayer = { signerKey: 'v' }; x = env.K ?? 'w'; new Wallet('z');").tokens);
  assert.deepEqual(namesAround(n, n.tokens.findIndex((x) => x.v === 'v')), ['signerKey', 'relayer']);
  assert.deepEqual(namesAround(n, n.tokens.findIndex((x) => x.v === 'w')), ['K', 'x']);
  assert.deepEqual(namesAround(n, n.tokens.findIndex((x) => x.v === 'z')), ['Wallet']);
  assert.equal(expressionEnd(fileView(tokenize('const a = maxUint256\nexport const b = 1').tokens), 3), 4, 'a statement word ends a value with no semicolon');
});

test('tree: the forgiving reader of JSON files reads comments, trailing commas and single quotes, and never makes a property', () => {
  const root = readTree(tokenize('{\n // c\n "a": [1, -2, "x", true,],\n b: { "__proto__": "p" },\n \'c\': null,\n}').tokens);
  assert.equal(root.k, 'obj');
  assert.deepEqual(root.entries.map((e) => e.key), ['a', 'b', 'c']);
  assert.deepEqual(entryOf(root, 'a').items.map((x) => x.v), [1, -2, 'x', 'true']);
  assert.equal(entryOf(entryOf(root, 'b'), '__proto__').v, 'p');
  assert.equal({}.p, undefined);
  assert.equal(readTree([]), null);
  assert.equal(readTree(tokenize('"a" "b"').tokens).v, 'a', 'the first value is the value of the file');
  assert.deepEqual(readTree(tokenize('{"a" 1}').tokens).entries, [], 'a value with no key is passed over');
  assert.deepEqual(readTree(tokenize('}]{').tokens).entries, []);
  assert.throws(() => readTree(tokenize('['.repeat(10)).tokens, { maxNesting: 5 }), /values nested more than 5 deep/);
  const seen = [];
  walkTree(readTree(tokenize('{"x": {"1": ["a", 2]}, "y": "b"}').tokens), (node, keys, owners) => seen.push([node.v, keys.join('/'), owners.length]));
  assert.deepEqual(seen, [['a', 'x/1/', 2], [2, 'x/1/', 2], ['b', 'y', 1]]);
  walkTree(null, () => assert.fail('nothing to walk'));
});

test('env: names, values in quotes or bare, comments, export and CRLF, each with its place', () => {
  const text = '# c\nA=1\r\nexport B = "x y" # z\nC=bare # note\nD=\'q\'\nE=`b`\n bad line\nF=\nG="open';
  const e = parseEnv(text);
  assert.deepEqual(e.map((x) => [x.name, x.value]), [['A', '1'], ['B', 'x y'], ['C', 'bare'], ['D', 'q'], ['E', 'b'], ['F', ''], ['G', 'open']]);
  assert.equal(text.slice(e[1].valueAt, e[1].valueAt + 3), 'x y');
  assert.equal(text.slice(e[0].nameAt, e[0].nameAt + 1), 'A');
  assert.deepEqual(parseEnv('\ufeffA=1').map((x) => x.nameAt), [1]);
  assert.deepEqual(parseEnv('A=1\rB=2').map((x) => x.name), ['A', 'B']);
});
