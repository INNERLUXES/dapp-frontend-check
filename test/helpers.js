// Shared test helpers: files built inline, read in memory or written into a temporary folder that is removed after the
// test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS and Windows. The
// line a test expects is found with lineOf(), which counts lines the way the tool does, so a test never holds a line
// number worked out by hand for one system only. No test reads the clock, the time zone or the locale.
//
// The secrets the tests need are made at run time and never written into the repository: a key is one short pattern
// repeated or built from a counter, and a phrase whose checksum holds is built from fixed entropy with phraseOf().

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { analyzeProject, checkText, lineStarts, main, phraseOf, positionOf, readConfig, defaultConfig } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'dapp-frontend-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function offsetOf(text, needle, n) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return at;
}

// The line (from 1) of the n-th place where needle starts in text.
export const lineOf = (text, needle, n = 1) => positionOf(lineStarts(text), offsetOf(text, needle, n)).line;

// The column (from 1) of the n-th place where needle starts in text.
export const columnOf = (text, needle, n = 1) => positionOf(lineStarts(text), offsetOf(text, needle, n)).column;

// The configuration of a configuration object, through the real reader, or the defaults.
export const configOf = (object = null) => (object === null ? defaultConfig() : readConfig(JSON.stringify(object), 'config.json'));

// A made-up private key: 0x and a pattern of hexadecimal digits repeated to 64, deadbeef by default.
export const fakeKey = (pattern = 'deadbeef') => `0x${pattern.repeat(Math.ceil(64 / pattern.length)).slice(0, 64)}`;

// A made-up key of 64 digits that is not a repeated pattern, built from a counter at run time.
export const counterKey = (seed = 1) => `0x${Array.from({ length: 16 }, (_, i) => ((seed * 2654435761 + i * 40503) >>> 0).toString(16).padStart(8, '0').slice(-4)).join('')}`;

// A phrase whose BIP-39 checksum holds, built from fixed entropy at run time, and one whose checksum fails.
export const goodPhrase = (bytes = 16, fill = 7) => phraseOf(Buffer.alloc(bytes, fill)).join(' ');
export const badPhrase = (count = 12) => Array(count).fill(phraseOf(Buffer.alloc(16, 0))[0]).join(' ');

// The findings of one file of code, JSON or env, through the lexer and the checks: [{ rule, line, column, found }].
export const findingsIn = (text, kind = 'code', path = 'a.tsx') => checkText(text, kind, path).findings;

// The rule ids of the findings of one file.
export const rulesIn = (text, kind, path) => findingsIn(text, kind, path).map((f) => f.rule);

// The findings of one rule in one file.
export const ofRule = (text, rule, kind, path) => findingsIn(text, kind, path).filter((f) => f.rule === rule);

// The findings of the checks of the whole project for files given as { path: [kind, text] }.
export function projectFindings(files) {
  const read = Object.entries(files).map(([file, [kind, text]]) => ({ file, kind, facts: checkText(text, kind, file).facts }));
  return analyzeProject(read);
}

export const P = 's/src/wallet.ts';
export const Q = 's/src/config/contracts.json';

// A project with nothing to report: a wallet module that asks for accounts and follows the chain, and a map of
// addresses.
export const SITE = {
  [P]: [
    'export async function connect(ethereum) {',
    "  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });",
    "  const chainId = await ethereum.request({ method: 'eth_chainId' });",
    "  ethereum.on('chainChanged', () => location.reload());",
    '  return { account: accounts[0], chainId };',
    '}',
    ''
  ].join('\n'),
  [Q]: '{\n  "1": { "Booth": "0xc2079ddD5FBaC924060EF34bdD1eEbb856dC77D2" }\n}\n'
};

// The project with some files changed or added; null takes a file out.
export function siteWith(changes = {}) {
  const out = { ...SITE };
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

// Writes the files and runs the command line with these arguments (paths relative to the folder).
export async function run(files, args = ['s'], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(args, { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err, dir };
  });
}

// The JSON report of a folder of files, with more arguments.
export async function reportOf(files, args = ['s'], limits) {
  const r = await run(files, [...args, '--json'], limits);
  if (r.code === 2) throw new Error(r.err);
  return { ...JSON.parse(r.out), code: r.code };
}

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, dir) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, dir);
  return { code, out, err };
}
