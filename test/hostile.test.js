import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LIMITS, LOOKAHEAD, MAX_PROBLEMS, analyzeProject, checkText, escapeProperty, globMatch, readTree, seedPhraseIn, tokenize, wordsOfName } from '../src/index.js';
import { P, SITE, badPhrase, cli, counterKey, goodPhrase, run, siteWith, withFiles } from './helpers.js';

// Hostile input: files built to exhaust the memory, the stack or the time, to make the tool follow a link out of the
// folder, to show a secret, to rewrite the terminal, to start a second workflow command, to slip a formula into a
// spreadsheet or to change how objects behave. Each heavy test also checks the time, because work that grows faster
// than the input is a failure even when the answer is right. Tests that need a symbolic link, a device or file
// permissions are guarded with process.platform, and none of them asserts a line: lines are asserted in the tests that
// run everywhere.

const LIMIT = { timeout: 180000 };
// Coverage counting slows every line of the tool several times over, so a run with --experimental-test-coverage gets a
// wider time limit. A plain `npm test` keeps the tight one, and that is the run that guards against slow growth.
// The runner sets NODE_V8_COVERAGE for its test processes only when coverage is on.
const COVERAGE = Boolean(process.env.NODE_V8_COVERAGE);
const fast = async (fn, ms = 5000) => {
  const limit = COVERAGE ? ms * 4 : ms;
  const start = Date.now();
  const result = await fn();
  assert.ok(Date.now() - start < limit, `took ${Date.now() - start} ms`);
  return result;
};
const refused = (fn) => {
  try {
    fn();
  } catch {
    // refused input is fine; the time is what is checked
  }
};
const A = '0x24f8097B1994432e896001062ff6be5E53a6F170';

test('hostile: thousands of calls, approvals, signatures, keys and addresses are checked in one pass', LIMIT, async () => {
  const lines = Array.from({ length: 3000 }, (_, i) => `async function f${i}(t, s, e) { await t.approve(s, MaxUint256); await s.signTypedData({ name: 'n${i}' }, types, v); e.request({ method: 'eth_sign' }); const x${i} = '${A}'; }`);
  const r = await fast(() => checkText(lines.join('\n'), 'code', 'a.ts'), 30000);
  assert.equal(r.findings.filter((f) => f.rule === 'unlimited-approval').length, 3000);
  assert.equal(r.findings.filter((f) => f.rule === 'typed-data-domain').length, 3000);
  assert.equal(r.findings.filter((f) => f.rule === 'eth-sign').length, 3000);
  assert.equal(r.stats.addresses, 3000);
  const files = Array.from({ length: 400 }, (_, i) => ({ file: `f${i}.ts`, kind: 'code', facts: checkText(`const a = '${A}';\nawait tx.wait();\nconst v = { value: 1 };`, 'code', `f${i}.ts`).facts }));
  files.push({ file: 'n.json', kind: 'json', facts: checkText(`{"confirmations": 3, "1": {"R": "${A}"}}`, 'json').facts });
  const p = await fast(() => analyzeProject(files));
  assert.equal(p.filter((f) => f.rule === 'address-repeated').length, 400);
  assert.equal(p.filter((f) => f.rule === 'low-confirmations').length, 400);
  const capped = JSON.parse((await run(siteWith({ [P]: lines.join('\n') }), ['s', '--json'])).out);
  assert.equal(capped.findings.filter((f) => f.rule === 'eth-sign').length, LIMITS.maxFindingsPerRule);
  assert.ok(capped.totals.notListed > 5000);
});

test('hostile: long runs of brackets, quotes, comments, templates, JSX, names, calls and members are read or stopped in one pass', LIMIT, async () => {
  const runs = [
    '{'.repeat(300000), '}'.repeat(300000), '('.repeat(300000), ')'.repeat(300000), '['.repeat(300000), '"'.repeat(300000), "'".repeat(300000), '`'.repeat(300000), '${'.repeat(150000), '/*'.repeat(150000), '//'.repeat(150000), '/'.repeat(300000), `a${'.b'.repeat(150000)}`,
    '<a>'.repeat(100000), '<a '.repeat(100000), `x = ${'<a>{'.repeat(200)}`, '</a>'.repeat(100000), 'return <'.repeat(100000), `\`${'${`'.repeat(200)}`, 'a.approve(b, '.repeat(50000), 'x.signTypedData({ domain: '.repeat(30000), 'el.innerHTML = '.repeat(100000), 'a.__html: '.repeat(50000),
    `const a = ${'['.repeat(200)}`, '{ "a": '.repeat(100000), 'f(a, '.repeat(100000), `${'tx.wait('.repeat(50000)}`, "{ method: 'personal_sign', params: [".repeat(30000), "{ method: 'eth_signTypedData_v4', ".repeat(30000), 'const confirmations = '.repeat(50000), 'functionName: \'approve\', args: ['.repeat(30000), 'connect({ connector, '.repeat(30000),
    'f('.repeat(100000) + ')'.repeat(100000), 'signer.signMessage('.repeat(50000) + ')'.repeat(50000), 'x.signTypedData({ domain: '.repeat(20000) + '})'.repeat(20000), 'a ? b : '.repeat(100000), 'const a = b ?? '.repeat(50000),
    `${'\u00e9'.repeat(200000)}`, `${'0x'.repeat(100000)}`, `${'1e'.repeat(100000)}`, `"${'\\'.repeat(200000)}"`, `"${'\\u'.repeat(100000)}"`
  ];
  for (const text of runs) {
    await fast(() => refused(() => checkText(text, 'code', 'a.tsx')));
    await fast(() => refused(() => checkText(text, 'json', 'a.json')));
  }
  assert.match(checkText(`f(${'`${'.repeat(300)}`, 'code', 'a.ts').findings[0].found, /nested more than 256 deep/);
  assert.match(checkText(`a ${'x'.repeat(3000)}`, 'code').findings[0].found, /a name longer than 1,024 characters/);
  assert.match(checkText('a '.repeat(LIMITS.maxTokens + 1), 'code').findings[0].found, /more than 400,000 tokens/);
  assert.match(checkText('['.repeat(300), 'json', 'a.json').findings[0].found, /values nested more than 256 deep/);
  assert.equal(LOOKAHEAD, 1024);
});

test('hostile: long strings, phrases, env files, names and patterns are read in time bounded by their length', LIMIT, async () => {
  const words = goodPhrase().split(' ');
  await fast(() => {
    for (let i = 0; i < 5; i += 1) {
      checkText(`const s = '${Array.from({ length: 6000 }, (_, k) => words[k % 12]).join(' ')}';`, 'code');
      checkText(`const rpc = '${'https://rpc.example.test/'.repeat(3000)}';`, 'code');
      checkText(`const PRIVATE_KEY = '${'0'.repeat(60000)}';`, 'code');
      checkText(`${'A=1\n'.repeat(20000)}B="${'x'.repeat(60000)}`, 'env');
      wordsOfName('aB'.repeat(100000));
      seedPhraseIn(' '.repeat(100000));
    }
  });
  const path = `${'a/'.repeat(500)}b`;
  await fast(() => {
    for (let i = 0; i < 200; i += 1) globMatch(`${'*'.repeat(100)}**${'?*'.repeat(50)}c`, path);
  });
  assert.equal(globMatch('**/b', path), true);
  await fast(() => readTree(tokenize(`[${'{"a": [1, "x", {"b": null}]}, '.repeat(20000)}1]`).tokens));
});

test('hostile: a file over its size limit is an unreadable-file error, and a configuration over its limit stops the run', LIMIT, async () => {
  const big = await run(siteWith({ [P]: `/* ${'x'.repeat(LIMITS.maxFileBytes)} */` }), ['s', '--json']);
  assert.match(JSON.parse(big.out).findings.find((f) => f.rule === 'unreadable-file').found, /bytes is over the 4 MB limit/);
  const config = await run({ ...SITE, 'c.json': ' '.repeat(LIMITS.maxConfigBytes + 1) }, ['s', '--config', 'c.json']);
  assert.equal(config.code, 2);
  assert.match(config.err, /c\.json: [\d,]+ bytes is over the 1 MB limit/);
  const many = await run({ ...SITE, 'c.json': JSON.stringify(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, 1]))) }, ['s', '--config', 'c.json']);
  assert.match(many.err, /\n {2}and 10 more\n$/);
  assert.equal(many.err.split('\n').filter((l) => l.startsWith('  c.json')).length, MAX_PROBLEMS);
});

test('hostile: thousands of folders and files are listed in seconds, and the limits of a folder hold', LIMIT, async () => {
  const files = { ...SITE };
  for (let i = 0; i < 300; i += 1) files[`s/m${i}/c${i}.ts`] = `export const v${i} = ${i};\n`;
  const r = await fast(() => run(files, ['s', '--json']), 60000);
  assert.equal(JSON.parse(r.out).input.files, 302);
  const capped = JSON.parse((await run(files, ['s', '--json'], { maxInputFiles: 10 })).out);
  assert.match(capped.findings.find((f) => f.rule === 'scan-limit').found, /the folder holds more than 10 files to read/);
  assert.equal(capped.result.pass, false);
  const entries = JSON.parse((await run(files, ['s', '--json'], { maxProjectEntries: 5 })).out);
  assert.match(entries.findings.find((f) => f.rule === 'scan-limit').found, /more than 5 files and folders/);
  const depth = JSON.parse((await run({ ...SITE, [`s/${'d/'.repeat(40)}a.ts`]: 'x' }, ['s', '--json'])).out);
  assert.match(depth.findings.find((f) => f.rule === 'scan-limit').found, /folders nested more than 32 deep/);
});

test('hostile: no key, phrase or key of an RPC address reaches any format, and names are capped', async () => {
  const key = counterKey(7);
  const good = goodPhrase();
  const rpcKey = `${'s3cr3t'.repeat(5)}`;
  const files = siteWith({
    [P]: `const PRIVATE_KEY = '${key}';\nconst words = '${good}';\nnew JsonRpcProvider('https://rpc.example.test/v3/${rpcKey}');\nconst q = 'https://rpc.example.test/x?apikey=${rpcKey}';\n`,
    's/.env.local': `SIGNER_KEY=${key.slice(2)}\nMNEMONIC="${good}"\nRPC_URL=wss://u:${rpcKey}@node.example.test\nOTHER=${badPhrase()}\n`,
    's/x.json': `{"deployer": {"privateKey": "${key}", "phrase": "${good}", "rpc": "https://node.example.test/${rpcKey}"}}`
  });
  for (const format of ['text', 'json', 'csv', 'github']) {
    for (const extra of format === 'text' || format === 'json' ? [[], ['--explain']] : [[]]) {
      const r = await run(files, ['s', '--format', format, ...extra]);
      assert.equal(r.code, 1, format);
      for (const secret of [key.slice(2, 20), key.slice(-20), good.split(' ').slice(0, 3).join(' '), rpcKey, badPhrase().slice(0, 20)]) assert.ok(!r.out.includes(secret) && !r.err.includes(secret), `${format}: a secret is shown`);
    }
  }
  const counts = JSON.parse((await run(files, ['s', '--json'])).out).rules.filter((x) => ['private-key', 'seed-phrase', 'rpc-url-key'].includes(x.id)).map((x) => x.findings);
  assert.deepEqual(counts, [3, 4, 4]);
  const long = 'x'.repeat(1000);
  const out = JSON.parse((await run(siteWith({ [P]: `const PRIVATE_KEY_${long} = '${key}';` }), ['s', '--json'])).out);
  assert.ok(out.findings.every((f) => f.found.length <= 800));
});

test('hostile: control, escape, direction and line separator characters in a name are removed from every format', async () => {
  const files = siteWith({ [P]: 'const chainId = 1;\nconst e = {};\ne["SIGNER_KEY\u001b[31m\u202e\u2028\u0085x"] = 1;\n', 's/.env': `KEY\u001b[31m\u202eX=0x${'ab12'.repeat(16)}\n` });
  const sneaky = siteWith({ [P]: 'const chainId = 1;\n', 's/.env': `A_\u001b[31m_KEY=${counterKey(4)}\nPRIVATE_KEY\u202e=${counterKey(5)}\n` });
  for (const format of ['text', 'json', 'csv', 'github']) {
    for (const f of [files, sneaky]) {
      const r = await run(f, ['s', '--format', format]);
      for (const c of ['\u001b', '\u202e', '\u2028']) assert.ok(!r.out.includes(c), `${format}: ${JSON.stringify(c)}`);
    }
  }
});

test('hostile: a name cannot end a workflow command or start another one, and a formula is neutralized in CSV', async () => {
  const files = siteWith({ 's/x.json': `{"PRIVATE_KEY %0A::error file=x::y\\n::warning::z": "${counterKey(6)}"}` });
  const github = await run(files, ['s', '--format', 'github']);
  const lines = github.out.trimEnd().split('\n');
  assert.equal(lines.length, 2, github.out);
  assert.ok(lines.slice(0, -1).every((l) => /^::(?:error|warning|notice) file=/.test(l)), github.out);
  assert.ok(github.out.includes('PRIVATE_KEY %250A::error file=x::y ::warning::z in a JSON file'), github.out);
  assert.equal(escapeProperty('s/%0A::e,x.ts'), 's/%250A%3A%3Ae%2Cx.ts');
  const formula = await run({ ...SITE, '=s/.env': `PRIVATE_KEY=${counterKey(8)}\n`, '=s/a.ts': 'const chainId = 1;' }, ['=s', '--format', 'csv']);
  assert.ok(formula.out.split('\r\n').slice(1, -1).every((l) => !/,[=+@-]/.test(l.replace(/,"[^"]*"/g, ','))), formula.out);
  assert.ok(formula.out.includes(",'=s/.env,"));
});

test('hostile: __proto__, constructor and toString as names, keys and env names change nothing', async () => {
  const text = "const __proto__ = { constructor: 1 };\nconst toString = { __proto__: { chainId: 1 } };\nfunction hasOwnProperty(valueOf) { return valueOf; }\n";
  const out = JSON.parse((await run({ ...siteWith({ [P]: text }), 's/a.json': '{"__proto__": {"1": {"__proto__": "0x24f8097B1994432e896001062ff6be5E53a6F170"}}, "constructor": {"1": {"__proto__": "0x4Aec56CbB6cc1C1849b27F883b97B2A9e8969e99"}}}', 's/b.json': '{"1": {"__proto__": "0x6F357FD7C1E743F947179372b48064CFF1Fac114"}}', 's/.env': '__proto__=1\nconstructor=2\n' }, ['s', '--json'])).out);
  assert.deepEqual(out.findings.map((f) => f.rule), ['address-conflict']);
  const bad = await run({ ...SITE, 'c.json': '{"rules": {"__proto__": "off"}}' }, ['s', '--config', 'c.json']);
  assert.match(bad.err, /"__proto__" is not a key of rules/);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.toString.call([]), '[object Array]');
});

test('hostile: CRLF, CR and a byte order mark give the same report as LF', async () => {
  const files = siteWith({ [P]: `const chainId = 1;\nconst PRIVATE_KEY = '${counterKey(3)}';\nawait t.approve(s, MaxUint256);\n`, 's/.env': `A=1\nSIGNER_KEY=${counterKey(4)}\n` });
  const lf = JSON.parse((await run(files, ['s', '--json'])).out);
  assert.equal(lf.findings.length, 3);
  for (const [name, change] of [['CRLF', (t) => t.split('\n').join('\r\n')], ['CR', (t) => t.split('\n').join('\r')], ['BOM', (t) => `\ufeff${t}`]]) {
    const other = JSON.parse((await run(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, change(v)])), ['s', '--json'])).out);
    assert.deepEqual(other.findings.map((f) => [f.rule, f.line, f.column]), lf.findings.map((f) => [f.rule, f.line, f.column]), name);
  }
});

test('hostile: the tool writes nothing: a run leaves the folder as it was', async () => {
  await withFiles(SITE, async (dir) => {
    const { readdir } = await import('node:fs/promises');
    const before = (await readdir(dir, { recursive: true })).sort();
    await cli(['s', '--format', 'csv'], dir);
    await cli(['s', '--json'], dir);
    assert.deepEqual((await readdir(dir, { recursive: true })).sort(), before);
  });
});

test('hostile: a symbolic link in the folder is counted and not followed, and a link named is refused', async (t) => {
  if (process.platform === 'win32') {
    t.skip('symbolic links need extra rights on Windows');
    return;
  }
  await withFiles(SITE, async (dir) => {
    await mkdir(resolve(dir, 'outside'));
    await writeFile(resolve(dir, 'outside/x.ts'), "ethereum.request({ method: 'eth_sign' });\n");
    await symlink(resolve(dir, 'outside'), resolve(dir, 's/loop'));
    await symlink(resolve(dir, 'outside/x.ts'), resolve(dir, 's/x.ts'));
    await symlink(resolve(dir, 's'), resolve(dir, 's-link'));
    const out = JSON.parse((await cli(['s', '--json'], dir)).out);
    assert.equal(out.input.links, 2);
    assert.deepEqual(out.findings, []);
    assert.match(out.notes.join('\n'), /2 symbolic links are not followed/);
    const named = await cli(['s-link'], dir);
    assert.equal(named.code, 2);
    assert.match(named.err, /is a symbolic link, which is not followed/);
    await symlink(resolve(dir, 'outside/x.ts'), resolve(dir, 'c.json'));
    assert.equal((await cli(['s', '--config', 'c.json'], dir)).code, 2);
  });
});

test('hostile: a device named as a folder is refused, and a file with no read access is an unreadable-file error', async (t) => {
  if (process.platform === 'win32') {
    t.skip('devices and file modes work differently on Windows');
    return;
  }
  const device = await cli(['/dev/null'], process.cwd());
  assert.equal(device.code, 2);
  assert.match(device.err, /is not a regular file or folder/);
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('the root user reads every file whatever its mode');
    return;
  }
  await withFiles(SITE, async (dir) => {
    await chmod(resolve(dir, P), 0o000);
    const r = await cli(['s', '--json'], dir);
    assert.match(JSON.parse(r.out).findings.find((f) => f.rule === 'unreadable-file').found, /cannot be read \(EACCES\)/);
    await chmod(resolve(dir, P), 0o644);
  });
});
