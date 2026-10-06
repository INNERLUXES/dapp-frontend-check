// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// projects to examples/output. CI runs it and then fails if those files changed, so the example output in the
// repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const MESSY = ['examples/messy', '--config', 'examples/config.json'];
export const CLEAN = ['examples/clean'];

// The made-up secrets of the messy example: one pattern repeated, so that no real key or phrase is written into the
// repository. None of them may appear in any output.
export const FAKE_SECRETS = ['deadbeefdeadbeef', 'demo0key0demo0key0demo0key', 'abandon abandon'];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the messy project: the counts, the summary, one finding of every rule, and the result.
export const EXPECTED = [
  'input: 12 files read (7 code, 4 JSON, 1 env); 1 other file passed over; 1 folder named .git or node_modules passed over; 2 paths excluded',
  'config: examples/config.json (Quillmere Market front end review)',
  'findings: 17 (4 error, 9 warning, 4 info)',
  'files: 12 read, 7 JavaScript or TypeScript, 4 JSON and 1 env',
  'addresses: 9 written, 5 distinct',
  'RELAYER_PRIVATE_KEY holds a value of 64 hexadecimal digits that looks like a private key in an env file of the repository; the value is not shown',
  'a value of 64 hexadecimal digits that looks like a private key is given to SEEDER_KEY in the code; the value is not shown',
  'DEPLOYER_MNEMONIC holds 12 words of the BIP-39 English list in a row in an env file of the repository, though they do not pass the BIP-39 checksum; the words are not shown',
  'an RPC address on eth-mainnet.rpcnode.test holds what looks like an API key in its path',
  'approve gives the spender an allowance of the largest uint256',
  'the code asks the wallet for eth_sign',
  'personal_sign signs a message built from fields',
  'the domain given to signer.signTypedData has no chainId and no verifyingContract',
  'this file asks the wallet for accounts or sends a transaction, and nothing in it reads the chain id',
  'the address 0xa30A33DbBa2306021D3143805837911EE55e092C mixes upper and lower case but does not match the EIP-55 checksum, which is 0xa30A33dbBa2306021D3143805837911EE55e092C',
  'the address 0x24f8097B1994432e896001062ff6be5E53a6F170 is written here and is also in examples/messy/.env.example and 1 more',
  'MarketRouter on chain 1 is 0x4Aec56CbB6cc1C1849b27F883b97B2A9e8969e99 here and 0x24f8097B1994432e896001062ff6be5E53a6F170 at examples/messy/src/config/contracts.json:3',
  'window.web3 is the old injected web3 object',
  'ethereum.enable() is the deprecated way to ask for accounts',
  'dangerouslySetInnerHTML is given HTML built from metadata',
  'tx.wait waits for 1 confirmation in a file that moves value, while confirmations at examples/messy/src/config/networks.json:3 asks for 3',
  'note: 2 paths matching **/dist/**, **/build/**, **/.next/**, **/out/**, **/coverage/** and 5 more are left out',
  'not a security audit and not a guarantee that the app is safe',
  'RESULT: FAIL - 4 findings at or above error (4 error, 9 warning, 4 info)'
];
// What must not be reported: the excluded mocks and build output, the package under node_modules, the patterns in
// comments, JSX text and near misses, and the findings of input problems.
export const UNWANTED = ['examples/messy/src/mocks/', 'examples/messy/dist/', 'node_modules/', 'RELAYER_TOPIC_HASH', 'PASS_COLLECTION', 'NftCard.tsx:19', 'sign.ts:25', 'approve.ts:20', 'rpc.ts:7', 'ERROR    unreadable-file', 'ERROR    scan-limit', 'RESULT: PASS', ...FAKE_SECRETS];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const messy = await run(MESSY);
  process.stdout.write(messy.out);
  expect('messy project', messy, 1, EXPECTED, UNWANTED);

  const clean = await run(CLEAN);
  expect('clean project', clean, 0, ['input: 7 files read (3 code, 3 JSON, 1 env); 1 other file passed over', 'findings: 0', 'wallet calls: 2 signature requests, 2 transaction sends, 1 approval', 'RESULT: PASS - no finding at or above error'], ['  ERROR  ', '  WARNING  ', '  INFO  ', 'RESULT: FAIL']);

  // Without the configuration, the mocks are read too, and personal_sign of fields is a note.
  expect('messy, no configuration', await run(['examples/messy']), 1, ['examples/messy/src/mocks/wallet.ts', 'unstructured-signing (info)'], ['examples/messy/dist/', 'node_modules/', ...FAKE_SECRETS]);
  // Only the errors are shown with --min-severity error.
  expect('messy, errors only', await run([...MESSY, '--min-severity', 'error']), 1, ['findings: 4 (4 error); 13 below error not shown', 'RESULT: FAIL - 4 findings at or above error'], ['WARNING  ', 'INFO  ']);
  // The clean project still passes when notes fail the run.
  expect('clean, fail on info', await run([...CLEAN, '--fail-on', 'info']), 0, ['RESULT: PASS - no finding at or above info'], []);
  // A path that is a file stops the run.
  const F = 'examples/messy/package.json';
  expect('a folder that is a file', await run([F]), 2, [`${F}: is a file; give the folder of the project`], [], 'err');

  // The README shows the whole report of the messy project, the --explain lines of one finding, the GitHub annotations
  // of two findings, the start of the CSV report and the report of the clean project.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  if (!readme.includes(messy.out)) problems.push('README: the sample output of the messy project differs from a real run');
  if (!readme.includes(clean.out)) problems.push('README: the sample output of the clean project differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/messy.txt'), messy.out);
  await writeFile(resolve(root, 'examples/output/clean.txt'), clean.out);
  const explain = await run([...MESSY, '--explain']);
  if (explain.code !== 1) problems.push(`explain: exit code ${explain.code}, expected 1`);
  const lines = explain.out.split('\n');
  const at = lines.findIndex((l) => l.includes('private-key') && l.includes('examples/messy/.env.example'));
  const sample = lines.slice(at, at + 9).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the --explain sample of private-key differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-explain.txt'), explain.out);
  const github = await run([...MESSY, '--format', 'github']);
  if (github.code !== 1) problems.push(`github: exit code ${github.code}, expected 1`);
  const picked = github.out.split('\n').filter((x) => x.includes('title=dapp-frontend-check unlimited-approval::') || x.includes('title=dapp-frontend-check typed-data-domain::'));
  if (picked.length !== 2) problems.push(`github: the sample lines are not in the output (${picked.length})`);
  for (const l of picked) if (!readme.includes(l)) problems.push('README: the GitHub sample differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-github.txt'), github.out);
  const csv = await run([...MESSY, '--format', 'csv']);
  if (csv.code !== 1) problems.push(`csv: exit code ${csv.code}, expected 1`);
  const head = csv.out.split('\r\n').slice(0, 4).join('\n');
  if (!readme.includes(head)) problems.push('README: the CSV sample differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-findings.csv'), csv.out);
  const json = await run([...MESSY, '--json', '--explain']);
  if (json.code !== 1) problems.push(`json: exit code ${json.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output/messy.json'), json.out);
  const defaults = await run(['--print-defaults']);
  if (defaults.code !== 0) problems.push(`--print-defaults: exit code ${defaults.code}, expected 0`);
  await writeFile(resolve(root, 'examples/output/defaults.json'), defaults.out);
  for (const [name, r] of [['explain', explain], ['github', github], ['csv', csv], ['json', json]]) {
    for (const s of FAKE_SECRETS) if (r.out.includes(s)) problems.push(`${name}: a made-up secret is shown in the output`);
  }

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
