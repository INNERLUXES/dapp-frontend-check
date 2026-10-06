import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { EMPTY_STATS, FILE_LIMITS, LIMITS, MAX_PATTERN_LENGTH, OPEN_FLAGS, RULES, SKIPPED_FOLDERS, WALK_LIMITS, asciiLower, atOrAbove, baseName, byCode, capped, checkFile, checkFolder, checkText, decide, defaultConfig, displayPath, fileError, flat, folderOf, globMatch, grouped, inspectPath, joinPath, kindOfFile, levelOf, listText, matchesAny, placer, plural, readBounded, readText, readTextFile, ruleById, safeText, textOf, walkFolder, wordsOfName } from '../src/index.js';
import { SITE, withFiles } from './helpers.js';

test('glob: path patterns with *, ?, ** and **/, and the lowercase match of the walk', () => {
  for (const [p, t] of [['dist/**', 'dist/a/x.js'], ['dist/**', 'dist/'], ['**/mocks/**', 'x/mocks/a.ts'], ['**/mocks/**', 'mocks/a'], ['*.ts', 'a.ts'], ['a?c', 'abc'], ['**', 'a/b/c'], ['**/.env.*', '.env.local'], ['**/.env.*', 'app/.env.production'], ['a/**/b', 'a/b'], ['a/**/b', 'a/x/y/b']]) assert.ok(globMatch(p, t), `${p} ${t}`);
  for (const [p, t] of [['dist/**', 'dist'], ['*.ts', 'a/a.ts'], ['a?c', 'a/c'], ['a', 'ab'], ['ab', 'a'], ['**/x', 'ax'], ['**/.env.*', '.env'], ['**/.env', '.envrc']]) assert.ok(!globMatch(p, t), `${p} ${t}`);
  assert.ok(matchesAny(['**/*.TS'], 'A/Wallet.ts'));
  assert.ok(matchesAny(['Dist/**'], 'dist', true) && !matchesAny(['dist/**'], 'dist', false) && !matchesAny([], 'x'));
  assert.equal(MAX_PATTERN_LENGTH, 200);
});

test('words, sizes and text: ASCII lowercase, the words of a name, paths, lists, plurals and cleaned text', () => {
  assert.equal(asciiLower('Wallet.TS'), 'wallet.ts');
  assert.deepEqual(wordsOfName('RELAYER_PRIVATE_KEY'), ['relayer', 'private', 'key']);
  assert.deepEqual(wordsOfName('relayerPrivateKey'), ['relayer', 'private', 'key']);
  assert.deepEqual(wordsOfName('tokenURI'), ['token', 'uri']);
  assert.deepEqual(wordsOfName('JSONRpcProvider'), ['json', 'rpc', 'provider']);
  assert.deepEqual(wordsOfName('a-b c2d'), ['a', 'b', 'c', 'd']);
  assert.deepEqual(wordsOfName(''), []);
  assert.equal(baseName('src/wallet.ts'), 'wallet.ts');
  assert.equal(folderOf('src/wallet.ts'), 'src');
  assert.equal(folderOf('wallet.ts'), '.');
  assert.equal(joinPath('.', 'a'), 'a');
  assert.equal(joinPath('a', ''), 'a');
  assert.equal(joinPath('', 'b'), 'b');
  assert.equal(byCode('B', 'a'), -1);
  assert.equal(byCode('a', 'a'), 0);
  assert.equal(byCode('b', 'a'), 1);
  assert.equal(grouped(1234567), '1,234,567');
  assert.equal(listText(['a', 'b', 'c', 'd'], 2), 'a, b and 2 more');
  assert.equal(listText(['a', 'b']), 'a and b');
  assert.equal(listText(['a', 'b', 'c']), 'a, b and c');
  assert.equal(plural(1, 'file'), '1 file');
  assert.equal(plural(2, 'file'), '2 files');
  assert.equal(plural(2, 'address', 'addresses'), '2 addresses');
  assert.equal(safeText('a\u0007b\u202ec\u2028d', 100), 'a b c d');
  assert.equal(safeText('x'.repeat(20), 10), 'xxxxxxx...');
  assert.equal(flat(' a \n b '), 'a b');
});

test('rules: the levels, the result and the input problems', () => {
  assert.ok(atOrAbove('error', 'warning'));
  assert.ok(!atOrAbove('info', 'warning'));
  assert.equal(ruleById('eth-sign').key, 'ethSign');
  assert.equal(levelOf(ruleById('unreadable-file'), defaultConfig()), 'error');
  assert.deepEqual(decide([{ level: 'warning' }], 'error'), { pass: true, failOn: 'error', failing: 0, byLevel: { error: 0, warning: 1, info: 0 }, text: 'PASS - no finding at or above error (1 warning)' });
  assert.equal(decide([{ level: 'error' }, { level: 'error' }], 'error').text, 'FAIL - 2 findings at or above error (2 error)');
  assert.equal(decide([], 'error').text, 'PASS - no finding at or above error');
  assert.equal(capped(Array.from({ length: 25 }, (_, i) => `p${i}`)).at(-1), 'and 5 more');
  assert.equal(capped(['a']).length, 1);
  assert.equal(RULES.filter((r) => r.key === null).length, 2);
  assert.equal(RULES.length, 16);
});

test('files: bounded reading, UTF-8 and UTF-16 by the byte order mark, and paths as shown', async () => {
  const utf16le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('a;', 'utf16le')]);
  const utf16be = Buffer.from(Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('a;', 'utf16le')]).map((b, i, all) => (i < 2 ? b : all[i % 2 === 0 ? i + 1 : i - 1])));
  await withFiles({ 'a/x.ts': 'x\n', 'a/big.ts': Buffer.alloc(3000, 65), 'a/latin.ts': Buffer.from([0x61, 0xe9]), 'a/le.ts': utf16le }, async (dir) => {
    assert.equal((await readBounded(resolve(dir, 'a/x.ts'), 100)).toString(), 'x\n');
    await assert.rejects(readBounded(resolve(dir, 'a/big.ts'), 100), /3,000 bytes is over the 100 byte limit/);
    await assert.rejects(readBounded(resolve(dir, 'a/big.ts'), 1024), /over the 1,024 byte limit/);
    await assert.rejects(readBounded(resolve(dir, 'a'), 100), /is a folder/);
    await assert.rejects(readBounded(resolve(dir, 'none'), 100), /no such file/);
    assert.deepEqual(await readText(resolve(dir, 'a/le.ts'), 'a/le.ts', 100), { size: 6, text: 'a;', encoding: 'utf-16le' });
    assert.equal(displayPath(resolve(dir, 'a/x.ts'), dir), 'a/x.ts');
    assert.equal(displayPath(dir, dir), '.');
    assert.ok(!displayPath(resolve(dir, '..', 'x'), dir).startsWith('..'));
    assert.equal((await inspectPath('a', dir)).folder, true);
    await assert.rejects(inspectPath('none', dir), /no such file or folder/);
    await assert.rejects(readTextFile('a', dir, 100), /is a folder; give the file itself/);
    const r = await checkFile(resolve(dir, 'a/latin.ts'), 'code', 'a/latin.ts');
    assert.match(r.findings[0].found, /the file cannot be read: .*not valid UTF-8/);
    assert.equal(r.stats, null);
  });
  assert.deepEqual(textOf(Buffer.from('\ufeffx'), 'f'), { text: 'x', encoding: 'utf-8' });
  assert.deepEqual(textOf(utf16be, 'f'), { text: 'a;', encoding: 'utf-16be' });
  assert.throws(() => textOf(Buffer.from([0xff]), 'f'), /not valid UTF-8/);
  assert.throws(() => textOf(Buffer.from('a;', 'utf16le'), 'f'), /a null byte\); a UTF-16 file needs its byte order mark/);
  assert.throws(() => textOf(Buffer.from([0xff, 0xfe, 0x41]), 'f'), /odd number of bytes/);
  assert.throws(() => textOf(Buffer.from([0xff, 0xfe, 0x00, 0xd8, 0x41, 0x00]), 'f'), /not valid UTF-16/);
  assert.throws(() => textOf(Buffer.from([0xff, 0xfe, 0x00, 0x00]), 'f'), /a null character/);
  assert.equal(fileError('p', 'r').reason, 'r');
  assert.equal(typeof OPEN_FLAGS, 'number');
  assert.equal(FILE_LIMITS.maxFileBytes, 4 * 1024 * 1024);
});

test('walk: the files below a folder in the order of their paths, with .git and node_modules passed over in any case', async () => {
  await withFiles({
    'r/wallet.ts': 'x',
    'r/About.TS': 'x',
    'r/.env': 'x',
    'r/src/Token.Tsx': 'x',
    'r/src/notes.md': 'x',
    'r/.git/a.ts': 'x',
    'r/Node_Modules/p/a.js': 'x',
    'r/dist/w.js': 'x',
    'r/test/old.test.ts': 'x'
  }, async (dir) => {
    const w = await walkFolder(resolve(dir, 'r'), { include: ['**/*.ts', '**/*.tsx', '**/.env'], exclude: ['dist/**', '**/*.test.ts'] });
    assert.deepEqual(w.files.map((f) => f.rel), ['.env', 'About.TS', 'src/Token.Tsx', 'wallet.ts']);
    assert.deepEqual([w.skipped, w.excluded, w.links, w.others, w.limit], [2, 2, 0, 1, null]);
    assert.match((await walkFolder(resolve(dir, 'r'), { include: ['**/*.ts'], limits: { maxInputFiles: 1 } })).limit, /more than 1 files to read/);
    assert.deepEqual((await walkFolder(resolve(dir, 'r'), { include: ['src/*.md'] })).files.map((f) => f.rel), ['src/notes.md']);
    assert.deepEqual((await walkFolder(resolve(dir, 'r'))).files.map((f) => f.rel), ['dist/w.js'], 'the default include of the walk alone is **/*.js');
  });
  assert.deepEqual(SKIPPED_FOLDERS, ['.git', 'node_modules']);
  assert.equal(WALK_LIMITS.maxProjectEntries, 50000);
});

test('check: checkFolder builds the report of a run without the command line, and the pieces it uses', async () => {
  await withFiles(SITE, async (dir) => {
    const r = await checkFolder({ folder: 's', base: dir, version: '9.9.9' });
    assert.equal(r.version, '9.9.9');
    assert.equal(r.result.pass, true);
    assert.equal(r.input.files, 2);
    assert.equal(r.input.codeFiles, 1);
    assert.equal(r.summary.addresses, 1);
    assert.equal(r.summary.signatures, 0);
    assert.equal(r.files.length, 2);
  });
  const place = placer('a\nbc\r\nd');
  assert.deepEqual(place(3), { line: 2, column: 2 });
  assert.deepEqual(place(99), { line: 3, column: 2 });
  assert.equal(LIMITS.maxFindingsPerRule, 500);
  const limited = checkText('`${`${`${x}`}`}`', 'code', 'a.ts', { ...LIMITS, maxNesting: 2 });
  assert.deepEqual(limited.findings, [{ rule: 'scan-limit', line: 1, column: 4, found: 'the file holds templates, JSX elements or braces nested more than 2 deep; nothing in it is checked' }]);
  assert.equal(checkText('a b c', 'code', 'a.ts', { ...LIMITS, maxTokens: 2 }).findings[0].found, 'the file holds more than 2 tokens; nothing in it is checked');
  assert.equal(checkText('[[[[1]]]]', 'json', 'a.json', { ...LIMITS, maxNesting: 2 }).findings[0].found, 'the file holds values nested more than 2 deep; nothing in it is checked');
  assert.deepEqual(Object.keys(EMPTY_STATS), ['addresses', 'signatures', 'sends', 'approvals']);
  assert.deepEqual(checkText('// nothing\n', 'code').stats, EMPTY_STATS);
  assert.deepEqual(['.env', 'a/.env.local', 'b/.ENV.example', 'x.json', 'y.ts', 'z.vue', '.envrc'].map(kindOfFile), ['env', 'env', 'env', 'json', 'code', 'code', 'code']);
});
