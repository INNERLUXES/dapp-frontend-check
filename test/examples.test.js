import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLEAN, EXPECTED, FAKE_SECRETS, MESSY, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');
const M = 'examples/messy';
const ENV = `${M}/.env.example`;
const SEED = `${M}/scripts/seed-market.mjs`;
const RPC = `${M}/src/lib/rpc.ts`;
const ADDR = `${M}/src/lib/addresses.ts`;
const APPROVE = `${M}/src/trade/approve.ts`;
const SIGN = `${M}/src/wallet/sign.ts`;
const CONNECT = `${M}/src/wallet/connect.ts`;
const CARD = `${M}/src/components/NftCard.tsx`;
const STAGING = `${M}/src/config/staging/contracts.json`;

test('examples: the messy project fails with the report that is saved in examples/output', async () => {
  const r = await run(MESSY);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('messy.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the clean project passes with no finding and the report that is saved', async () => {
  const r = await run(CLEAN);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('clean.txt'));
  assert.match(r.out, /\nfindings: 0\n/);
  assert.equal((await run([...CLEAN, '--config', 'examples/config.json', '--fail-on', 'info'])).code, 0, 'the clean project also passes with the configuration of the messy one, at every level');
});

test('examples: --explain, JSON, CSV, the GitHub commands and the defaults are the reports that are saved, with no made-up secret in them', async () => {
  const outputs = { 'messy-explain.txt': [...MESSY, '--explain'], 'messy.json': [...MESSY, '--json', '--explain'], 'messy-findings.csv': [...MESSY, '--format', 'csv'], 'messy-github.txt': [...MESSY, '--format', 'github'], 'defaults.json': ['--print-defaults'] };
  for (const [name, args] of Object.entries(outputs)) {
    const out = (await run(args)).out;
    assert.equal(out, await saved(name), name);
    for (const s of FAKE_SECRETS) assert.ok(!out.includes(s), `${name}: ${s}`);
  }
});

test('examples: every rule fires on the messy project, each on the line built for it', async () => {
  const report = JSON.parse((await run([...MESSY, '--json'])).out);
  const lines = {};
  for (const f of [ENV, SEED, RPC, ADDR, APPROVE, SIGN, CONNECT, CARD, STAGING]) lines[f] = (await readFile(resolve(root, f), 'utf8')).split('\n');
  const at = (file, needle) => `${file}:${lines[file].findIndex((l) => l.includes(needle)) + 1}`;
  const of = (rule) => report.findings.filter((f) => f.rule === rule).map((f) => f.at);
  assert.deepEqual(of('private-key'), [at(ENV, 'RELAYER_PRIVATE_KEY'), at(SEED, 'new Wallet')]);
  assert.deepEqual(of('seed-phrase'), [at(ENV, 'DEPLOYER_MNEMONIC')]);
  assert.deepEqual(of('rpc-url-key'), [at(RPC, 'readProvider')]);
  assert.deepEqual(of('unlimited-approval'), [at(APPROVE, 'MaxUint256);')]);
  assert.deepEqual(of('eth-sign'), [at(SIGN, "'eth_sign'")]);
  assert.deepEqual(of('unstructured-signing'), [at(SIGN, 'JSON.stringify')]);
  assert.deepEqual(of('typed-data-domain'), [at(SIGN, 'signer.signTypedData')]);
  assert.deepEqual(of('chain-not-checked'), [at(CONNECT, 'ethereum.enable')]);
  assert.deepEqual(of('address-checksum'), [at(ADDR, 'QUILL_TOKEN')]);
  assert.deepEqual(of('address-repeated'), [at(ADDR, 'QUILL_TOKEN'), at(APPROVE, 'const ROUTER')]);
  assert.deepEqual(of('address-conflict'), [at(STAGING, 'MarketRouter')]);
  assert.deepEqual(of('legacy-wallet-api'), [at(CONNECT, 'window.web3'), at(CONNECT, 'ethereum.enable')]);
  assert.deepEqual(of('html-from-chain'), [at(CARD, '__html: metadata.description')]);
  assert.deepEqual(of('low-confirmations'), [at(APPROVE, 'tx.wait(1)')]);
  assert.deepEqual(report.rules.filter((r) => r.findings === 0).map((r) => r.id), ['unreadable-file', 'scan-limit']);
  assert.equal(report.files.length, 12);
  assert.equal(report.summary.distinctAddresses, 5);
});

test('examples: without the configuration, the mocks are read too; dist and node_modules never are', async () => {
  const report = JSON.parse((await run(['examples/messy', '--json'])).out);
  assert.ok(report.findings.some((f) => f.file === 'examples/messy/src/mocks/wallet.ts' && f.rule === 'eth-sign'));
  assert.equal(report.findings.find((f) => f.rule === 'unstructured-signing').level, 'info');
  assert.ok(!report.findings.some((f) => f.file.includes('node_modules') || f.file.includes('/dist/')));
  assert.equal(report.input.foldersPassedOver, 1);
  assert.equal(report.input.excluded, 1);
});

test('examples: the same files written with CRLF line ends and as UTF-16 give the same output', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'dapp-frontend-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    for (const f of [ENV, SEED, RPC, ADDR, APPROVE, CONNECT, CARD, STAGING]) {
      const text = await readFile(resolve(root, f), 'utf8');
      await writeFile(resolve(dir, f), text.split('\n').join('\r\n'));
    }
    const sign = (await readFile(resolve(root, SIGN), 'utf8')).split('\n').join('\r\n');
    await writeFile(resolve(dir, SIGN), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(sign, 'utf16le')]));
    assert.equal((await run([...MESSY, '--explain'], dir)).out, await saved('messy-explain.txt'));
    assert.equal((await run(CLEAN, dir)).out, await saved('clean.txt'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
