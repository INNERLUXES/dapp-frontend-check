import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checksumState, toChecksumAddress } from '../src/index.js';
import { badPhrase, counterKey, fakeKey, findingsIn, goodPhrase, lineOf, ofRule, projectFindings, rulesIn } from './helpers.js';

// Every rule with the form it reports and a near miss on each side: the form next to it that is not reported, and the
// same pattern in a comment, a regular expression or the text of a JSX element, which the lexer sets aside. The
// secrets are made at run time (test/helpers.js), and a test checks that no value reaches a finding.

const RPC = (key) => `https://eth-mainnet.rpcnode.test/v3/${key}`;
const KEY20 = `${'k3y'.repeat(7)}`;
const A = '0x24f8097B1994432e896001062ff6be5E53a6F170';
const B = '0x4Aec56CbB6cc1C1849b27F883b97B2A9e8969e99';
const lower = (a) => a.toLowerCase();
// The address with the case of its first letter turned, which breaks a checksum that held.
const badCase = (a) => {
  const at = a.slice(2).search(/[a-fA-F]/) + 2;
  const c = a[at];
  return `${a.slice(0, at)}${c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()}${a.slice(at + 1)}`;
};

test('private-key: a value of 64 digits that its name, its key or its call says is a key, in code, JSON and env files', () => {
  const key = counterKey(3);
  for (const text of [`const PRIVATE_KEY = '${key}';`, `const relayer = { signerKey: '${key}' };`, `new Wallet('${key}');`, `privateKeyToAccount(\`${key}\`);`, `const pk = '${key.slice(2)}';`, `process.env.DEPLOYER_KEY ?? '${key}'`]) {
    const f = ofRule(text, 'private-key');
    assert.equal(f.length, 1, text);
    assert.ok(!f[0].found.includes(key.slice(2, 18)), 'the value is never shown');
  }
  for (const text of [`const TOPIC_HASH = '${key}';`, `const storageSlotKey = '${key}';`, `const txHash = '${key}';`, `const value = '${key}';`, `const PRIVATE_KEY = '${fakeKey('0')}';`, `// const PRIVATE_KEY = '${key}';`, `const PRIVATE_KEY = '${key}0';`, `const re = /${key}/;`]) assert.deepEqual(ofRule(text, 'private-key'), [], text);
  assert.equal(ofRule(`{\n  "deployer": { "privateKey": "${key}" }\n}`, 'private-key', 'json').length, 1);
  assert.deepEqual(ofRule(`{ "blockHash": "${key}" }`, 'private-key', 'json'), []);
  const env = ofRule(`# ${key}\nNEXT_PUBLIC_SIGNER_KEY=${key}\nROLE_ID=${key}\n`, 'private-key', 'env');
  assert.equal(env.length, 1);
  assert.equal(env[0].line, 2);
  assert.match(env[0].found, /the prefix NEXT_PUBLIC_ puts it into the code every visitor downloads/);
});

test('seed-phrase: 12 or more words of the list in a row, with the checksum, in code, JSON and env files', () => {
  const good = goodPhrase();
  const f = ofRule(`const words = '${good}';`, 'seed-phrase');
  assert.equal(f.length, 1);
  assert.match(f[0].found, /12 words .* and they pass the BIP-39 checksum/);
  assert.ok(!f[0].found.includes(good.split(' ')[0] + ' '), 'the words are never shown');
  assert.match(ofRule(`m = \`${badPhrase()}\`;`, 'seed-phrase')[0].found, /though they do not pass the BIP-39 checksum/);
  assert.match(ofRule(`const words = '${goodPhrase(32)}';`, 'seed-phrase')[0].found, /24 words .* pass the BIP-39 checksum/);
  const eleven = good.split(' ').slice(0, 11).join(' ');
  for (const text of [`const words = '${eleven}';`, `// ${good}`, `const w = '${good.split(' ').join(', ')}';`, `const w = '${good.toUpperCase()}';`]) assert.deepEqual(ofRule(text, 'seed-phrase'), [], text);
  assert.equal(ofRule(`{"mnemonic": "${good}"}`, 'seed-phrase', 'json').length, 1);
  assert.match(ofRule(`MNEMONIC="${good}"\n`, 'seed-phrase', 'env')[0].found, /^MNEMONIC holds 12 words/);
  assert.equal(ofRule(`const words = '${good} ${good}';`, 'seed-phrase').length, 1, 'one finding for a string');
});

test('rpc-url-key: an RPC address with a key in its path, query or user part; a key from the environment is not seen', () => {
  for (const text of [`new JsonRpcProvider('${RPC(KEY20)}');`, "const RPC = 'https://api.example.test/eth?apikey=abcdefgh123';", `const rpcUrl = 'wss://user:${KEY20}@ws.example.test/';`, `http('${RPC(KEY20)}')`]) {
    const f = ofRule(text, 'rpc-url-key');
    assert.equal(f.length, 1, text);
    assert.ok(!f[0].found.includes(KEY20) && !f[0].found.includes('abcdefgh123'), 'the key is never shown');
  }
  assert.match(ofRule(`p = '${RPC(KEY20)}';`, 'rpc-url-key')[0].found, /on eth-mainnet\.rpcnode\.test holds what looks like an API key in its path/);
  for (const text of [`new JsonRpcProvider(\`https://eth-mainnet.rpcnode.test/v3/\${KEY}\`);`, `new JsonRpcProvider('${RPC('YOUR_KEY')}');`, "const docs = 'https://docs.example.test/guides/abcdefghij0123456789';", `// new JsonRpcProvider('${RPC(KEY20)}');`, `const RPC = 'https://rpc.example.test/${A}';`, "const RPC = 'https://rpc.example.test/eth?apikey=short';"]) assert.deepEqual(ofRule(text, 'rpc-url-key'), [], text);
  assert.equal(ofRule(`{"networks": {"rpcUrl": "${RPC(KEY20)}"}}`, 'rpc-url-key', 'json').length, 1);
  assert.match(ofRule(`VITE_RPC_URL=${RPC(KEY20)}\n`, 'rpc-url-key', 'env')[0].found, /prefix VITE_/);
  assert.deepEqual(ofRule(`VITE_RPC_URL=${RPC('YOUR_KEY')}\n`, 'rpc-url-key', 'env'), []);
});

test('unlimited-approval: approve and increaseAllowance with the largest uint256 in each of its forms, and permits', () => {
  const forms = ['MaxUint256', 'ethers.MaxUint256', 'ethers.constants.MaxUint256', 'constants.MaxUint256', 'maxUint256', 'MAX_UINT256', '2n ** 256n - 1n', '2 ** 256 - 1', '(1n << 256n) - 1n', 'BigInt(2) ** BigInt(256) - BigInt(1)', `'0x${'f'.repeat(64)}'`, `0x${'F'.repeat(64)}n`, "'115792089237316195423570985008687907853269984665640564039457584007913129639935'"];
  for (const amount of forms) assert.equal(ofRule(`await token.approve(spender, ${amount});`, 'unlimited-approval').length, 1, amount);
  assert.equal(ofRule('await token.increaseAllowance(spender, maxUint256);', 'unlimited-approval').length, 1);
  assert.equal(ofRule('const ALL = maxUint256;\nawait token.approve(spender, ALL);', 'unlimited-approval').length, 1, 'a name declared as the largest uint256');
  assert.equal(ofRule("await writeContract(config, { address, abi, functionName: 'approve', args: [spender, maxUint256] });", 'unlimited-approval').length, 1);
  assert.equal(ofRule("const data = iface.encodeFunctionData('approve', [spender, MaxUint256]);", 'unlimited-approval').length, 1);
  assert.match(ofRule("await signer.signTypedData(domain, types, { owner, spender, value: maxUint256, nonce, deadline });", 'unlimited-approval')[0].found, /EIP-2612 permit with no limit/);
  assert.equal(ofRule("ethereum.request({ method: 'eth_signTypedData_v4', params: [account, JSON.stringify({ domain: { chainId: 1, verifyingContract: token }, message: { value: MaxUint256 } })] });", 'unlimited-approval').length, 1);
  for (const text of ['await token.approve(spender, amount);', 'await token.approve(spender, MaxUint256 / 2n);', 'await token.approve(spender, 2n ** 255n);', 'await token.approve(spender);', 'approve(spender, MaxUint256);', '// token.approve(spender, MaxUint256)', "await writeContract(config, { functionName: 'approve', args: [spender, amount] });", "await writeContract(config, { functionName: 'transfer', args: [spender, maxUint256] });", "log({ functionName: 'approve', args: [spender, maxUint256] });", 'await token.approve(spender, MaxUint256.toString());', "await signer.signTypedData(domain, types, { value: amount });"]) assert.deepEqual(ofRule(text, 'unlimited-approval'), [], text);
});

test('eth-sign: the eth_sign method and web3.eth.sign; personal_sign, eth_signTypedData_v4 and the word in a comment are not', () => {
  assert.equal(ofRule("ethereum.request({ method: 'eth_sign', params: [account, hash] });", 'eth-sign').length, 1);
  assert.equal(ofRule('await web3.eth.sign(hash, account);', 'eth-sign').length, 1);
  assert.equal(ofRule("provider.send(\"eth_sign\", [account, hash]);", 'eth-sign').length, 1);
  for (const text of ["ethereum.request({ method: 'personal_sign', params: [message, account] });", "ethereum.request({ method: 'eth_signTypedData_v4', params: [account, data] });", '// never use eth_sign', "const label = 'eth_sign is removed';", 'const re = /eth_sign/;', 'await web3.eth.personal.sign(message, account, "");', 'wallet.sign(hash);']) assert.deepEqual(ofRule(text, 'eth-sign'), [], text);
  assert.deepEqual(ofRule("export const Note = () => <p>Never call 'eth_sign' here</p>;", 'eth-sign', 'code', 'a.tsx'), [], 'JSX text is not code');
});

test('unstructured-signing: a message built from fields; plain text and Sign-In with Ethereum are not', () => {
  for (const text of ["ethereum.request({ method: 'personal_sign', params: [JSON.stringify({ tokenId, price }), account] });", 'await signer.signMessage(JSON.stringify(order));', 'await walletClient.signMessage({ account, message: `bid ${tokenId} at ${price}` });', "await signMessageAsync({ message: 'order ' + tokenId + ' at ' + price });", 'await web3.eth.personal.sign(JSON.stringify(order), account, "");', 'const msg = JSON.stringify(order);\nawait signer.signMessage(msg);', 'const message = JSON.stringify(order);\nawait walletClient.signMessage({ account, message });']) assert.equal(ofRule(text, 'unstructured-signing').length, 1, text);
  for (const text of ["await signer.signMessage('Log in to Quillmere');", 'await signer.signMessage(`Hello ${name}`);', 'await signer.signMessage(`${host} wants you to sign in with your Ethereum account:\\n${account}\\n\\nNonce: ${nonce}`);', 'await signer.signMessage(siwe.prepareMessage());', 'await signer.signMessage(new SiweMessage({ domain, address }).prepareMessage());', 'await signer.signMessage(message);', "ethereum.request({ method: 'personal_sign', params: [message, account] });", "ethereum.request({ method: 'personal_sign' });", 'await signer.signMessage();', 'await walletClient.signMessage({ account });']) assert.deepEqual(ofRule(text, 'unstructured-signing'), [], text);
});

test('typed-data-domain: a domain literal with no chainId or no verifyingContract, as ethers, viem and a raw request write it', () => {
  const missing = (text) => ofRule(text, 'typed-data-domain').map((f) => f.found);
  assert.match(missing("await signer.signTypedData({ name: 'M', version: '1' }, types, value);")[0], /has no chainId and no verifyingContract, so the signature can be replayed on another chain/);
  assert.match(missing("await signer._signTypedData({ name: 'M', chainId: 1 }, types, value);")[0], /has no verifyingContract, so the signature is not bound to the contract/);
  assert.match(missing("const domain = { name: 'M', verifyingContract: market };\nawait signer.signTypedData(domain, types, value);")[0], /has no chainId,/);
  assert.equal(missing("await walletClient.signTypedData({ account, domain: { name: 'M' }, types, primaryType: 'Order', message });").length, 1);
  assert.equal(missing("const domain = { name: 'M' };\nawait walletClient.signTypedData({ account, domain, types, primaryType: 'Order', message });").length, 1);
  assert.match(missing("await signTypedDataAsync({ types, primaryType: 'Order', message });")[0], /is called with no domain/);
  assert.equal(missing("ethereum.request({ method: 'eth_signTypedData_v4', params: [account, JSON.stringify({ domain: { name: 'M', chainId: 1 }, types, message })] });").length, 1);
  for (const text of ["await signer.signTypedData({ name: 'M', chainId: 1, verifyingContract: market }, types, value);", "await walletClient.signTypedData({ domain: { chainId, verifyingContract }, types, primaryType: 'O', message });", 'await signer.signTypedData(domain, types, value);', "await signer.signTypedData({ ...base, name: 'M' }, types, value);", 'await walletClient.signTypedData({ ...typedData });', 'await walletClient.signTypedData(typedData);', "ethereum.request({ method: 'eth_signTypedData_v4', params: [account, JSON.stringify(data)] });", "// signer.signTypedData({ name: 'M' }, types, value)", 'async signTypedData(domain, types, value) { return inner(domain); }', 'function signTypedData(domain) { return domain; }', 'await signer.signTypedData();']) assert.deepEqual(missing(text), [], text);
});

test('chain-not-checked: a file that connects or sends with no chain id, chainChanged or switch in it; a comment does not count', () => {
  for (const text of ["await ethereum.request({ method: 'eth_requestAccounts' });", "await ethereum.request({ method: 'eth_sendTransaction', params: [tx] });", 'await signer.sendTransaction(tx); // chainId checked elsewhere', 'await walletClient.writeContract(request);', 'await connect({ connector: injected() });', 'await walletClient.requestAddresses();']) assert.equal(ofRule(text, 'chain-not-checked').length, 1, text);
  const two = "await ethereum.request({ method: 'eth_requestAccounts' });\nawait signer.sendTransaction(tx);";
  assert.deepEqual(ofRule(two, 'chain-not-checked').map((f) => f.line), [1], 'one finding, at the first place');
  for (const text of ["await ethereum.request({ method: 'eth_requestAccounts' });\nconst id = await ethereum.request({ method: 'eth_chainId' });", "ethereum.on('chainChanged', reload);\nawait signer.sendTransaction(tx);", 'await switchChain(config, { chainId: 1 });\nawait writeContract(config, request);', 'const { chainId } = useAccount();\nawait writeContractAsync(request);', 'await socket.connect();', 'await db.connect(url);', 'const x = 1;']) assert.deepEqual(ofRule(text, 'chain-not-checked'), [], text);
});

test('address-checksum: EIP-55 with the Keccak-256 of the tool, in code, JSON and env files; lower and upper case pass', () => {
  const wrong = badCase(A);
  assert.equal(checksumState(wrong), 'invalid');
  const files = { 'a.ts': ['code', `const X = '${wrong}';\nconst Y = '${A}';\nconst Z = '${lower(A)}';\nconst W = '0x${A.slice(2).toUpperCase()}';`], 'b.json': ['json', `{"x": "${wrong}"}`], '.env': ['env', `X=${wrong}\n`] };
  const f = projectFindings(files).filter((x) => x.rule === 'address-checksum');
  assert.deepEqual(f.map((x) => `${x.file}:${x.line}`), ['a.ts:1', 'b.json:1', '.env:1']);
  assert.ok(f[0].found.includes(toChecksumAddress(wrong)));
  assert.deepEqual(projectFindings({ 'a.ts': ['code', `// '${wrong}'\nconst r = /${wrong}/;`] }), [], 'a comment and a regular expression are not read');
  assert.deepEqual(projectFindings({ 'a.ts': ['code', `const zero = '0x${'0'.repeat(40)}';\nconst e = '0x${'Ee'.repeat(20)}';`] }), [], 'placeholders are left out');
});

test('address-repeated: an address in two files of code, or in code and a map; one file of code alone is not', () => {
  const two = projectFindings({ 'src/a.ts': ['code', `const R = '${A}';`], 'src/b.ts': ['code', `\nconst R = '${lower(A)}';`] }).filter((x) => x.rule === 'address-repeated');
  assert.deepEqual(two.map((x) => `${x.file}:${x.line}`), ['src/b.ts:2']);
  assert.match(two[0].found, /also at src\/a\.ts:1/);
  const map = projectFindings({ 'src/a.ts': ['code', `const R = '${A}';`], 'src/c.json': ['json', `{"1": {"R": "${A}"}}`] }).filter((x) => x.rule === 'address-repeated');
  assert.deepEqual(map.map((x) => x.file), ['src/a.ts']);
  assert.match(map[0].found, /is also in src\/c\.json; read it from that map/);
  assert.deepEqual(projectFindings({ 'src/a.ts': ['code', `const M = { 1: '${A}', 10: '${A}' };`] }).filter((x) => x.rule === 'address-repeated'), [], 'one file of code is its own map');
  assert.deepEqual(projectFindings({ 'a.json': ['json', `{"1": {"R": "${A}"}}`], 'b.json': ['json', `{"10": {"R": "${A}"}}`] }).filter((x) => x.rule === 'address-repeated'), [], 'maps alone are not reported');
});

test('address-conflict: one name with two addresses for one chain in two JSON files, by chain key or chainId', () => {
  const c = (files) => projectFindings(files).filter((x) => x.rule === 'address-conflict');
  const keyed = c({ 'a/contracts.json': ['json', `{"1": {"Router": "${A}"}}`], 'b/contracts.json': ['json', `{\n"1": {"Router": "${B}"}}`] });
  assert.deepEqual(keyed.map((x) => `${x.file}:${x.line}`), ['b/contracts.json:2']);
  assert.match(keyed[0].found, /^Router on chain 1 is 0x4Aec.* here and 0x24f8.* at a\/contracts\.json:1/);
  assert.equal(c({ 'a.json': ['json', `{"Router": {"1": "${A}"}}`], 'b.json': ['json', `{"router": {"1": "${B}"}}`] }).length, 1, 'name above the chain, in any case');
  assert.equal(c({ 'a.json': ['json', `[{"chainId": 1, "name": "Router", "address": "${A}"}]`], 'b.json': ['json', `{"deployments": [{"chainId": "1", "contract": "Router", "address": "${B}"}]}`] }).length, 1, 'chainId and a name next to the address');
  assert.equal(c({ 'a.json': ['json', `{"chainId": 1, "contracts": {"Router": "${A}"}}`], 'b.json': ['json', `{"chainId": 1, "contracts": {"Router": "${B}"}}`] }).length, 1);
  for (const files of [{ 'a.json': ['json', `{"1": {"Router": "${A}"}}`], 'b.json': ['json', `{"10": {"Router": "${B}"}}`] }, { 'a.json': ['json', `{"1": {"Router": "${A}"}}`], 'b.json': ['json', `{"1": {"Router": "${lower(A)}"}}`] }, { 'a.json': ['json', `{"1": {"Router": "${A}", "Old": "${B}"}}`] }, { 'a.json': ['json', `{"1": {"Router": "${A}"}, "x": {"1": {"Router": "${B}"}}}`] }, { 'a.json': ['json', `{"mainnet": {"Router": "${A}"}}`], 'b.json': ['json', `{"mainnet": {"Router": "${B}"}}`] }, { 'a.json': ['json', `{"1": {"Router": "${A}"}}`], 'b.ts': ['code', `const m = { 1: { Router: '${B}' } };`] }]) assert.deepEqual(c(files), [], JSON.stringify(files));
});

test('legacy-wallet-api: window.web3, ethereum.enable() and eth_accounts with no request for accounts in the project', () => {
  assert.equal(ofRule("if (window.web3) { load(); }", 'legacy-wallet-api').length, 1);
  assert.equal(ofRule('await window.ethereum.enable();', 'legacy-wallet-api').length, 1);
  assert.equal(ofRule('await ethereum.enable();', 'legacy-wallet-api').length, 1);
  for (const text of ['// window.web3', 'const web3 = new Web3(window.ethereum);', 'await feature.enable();', 'const enable = ethereum.enable;', "const s = 'window.web3';"]) assert.deepEqual(ofRule(text, 'legacy-wallet-api'), [], text);
  const accounts = "const a = await ethereum.request({ method: 'eth_accounts' });";
  assert.equal(projectFindings({ 'a.ts': ['code', accounts] }).filter((x) => x.rule === 'legacy-wallet-api').length, 1);
  for (const other of ["await ethereum.request({ method: 'eth_requestAccounts' });", "await ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });", 'const signer = await provider.getSigner();', 'await walletClient.requestAddresses();', 'const { connect } = useConnect();', 'await connect(config, { connector });']) {
    assert.deepEqual(projectFindings({ 'a.ts': ['code', accounts], 'b.ts': ['code', other] }).filter((x) => x.rule === 'legacy-wallet-api'), [], other);
  }
});

test('html-from-chain: an HTML sink fed from token metadata or a value of the chain, with no sanitizer', () => {
  for (const [text, path] of [['<p dangerouslySetInnerHTML={{ __html: metadata.description }} />', 'a.tsx'], ['el.innerHTML = token.name;', 'a.ts'], ['el.outerHTML += `<b>${nft.title}</b>`;', 'a.ts'], ["el.insertAdjacentHTML('beforeend', tokenUri);", 'a.ts'], ['document.write(ensName);', 'a.js'], ['const html = { __html: data.attributes };', 'a.ts']]) assert.equal(ofRule(text, 'html-from-chain', 'code', path).length, 1, text);
  for (const [text, path] of [['<p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(metadata.description) }} />', 'a.tsx'], ['el.innerHTML = escapeHtml(token.name);', 'a.ts'], ['el.textContent = token.name;', 'a.ts'], ['el.innerHTML = post.body;', 'a.ts'], ['el.innerHTML === token.name;', 'a.ts'], ['// el.innerHTML = token.name', 'a.ts'], ['<p>{metadata.description}</p>', 'a.tsx'], ["el.insertAdjacentHTML('beforeend');", 'a.ts']]) assert.deepEqual(ofRule(text, 'html-from-chain', 'code', path), [], text);
});

test('low-confirmations: a wait for 0 or 1 in a file that moves value, against a setting of 2 or more', () => {
  const low = (files) => projectFindings(files).filter((x) => x.rule === 'low-confirmations');
  const setting = { 'n.json': ['json', '{"confirmations": 3}'] };
  const moves = 'const tx = await contract.buy(id, { value: parseEther(p) });\n';
  for (const wait of ['await tx.wait();', 'await tx.wait(1);', 'await tx.wait(0);', 'await (await token.transfer(to, n)).wait();', 'await publicClient.waitForTransactionReceipt({ hash });', 'await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });', 'await provider.waitForTransaction(hash);', 'await provider.waitForTransaction(hash, 0);', 'useWaitForTransactionReceipt({ hash, confirmations: 1 });']) {
    const f = low({ ...setting, 'a.ts': ['code', `${moves}${wait}`] });
    assert.equal(f.length, 1, wait);
    assert.match(f[0].found, /while confirmations at n\.json:1 asks for 3/);
  }
  for (const wait of ['await tx.wait(3);', 'await tx.wait(CONFIRMATIONS);', 'await publicClient.waitForTransactionReceipt({ hash, confirmations: 3 });', 'await publicClient.waitForTransactionReceipt({ hash, confirmations });', 'await queue.wait();', 'await provider.waitForTransaction(hash, n);']) assert.deepEqual(low({ ...setting, 'a.ts': ['code', `${moves}${wait}`] }), [], wait);
  assert.deepEqual(low({ 'a.ts': ['code', `${moves}await tx.wait();`] }), [], 'no setting, no finding');
  assert.deepEqual(low({ 'n.json': ['json', '{"confirmations": 1}'], 'a.ts': ['code', `${moves}await tx.wait();`] }), [], 'a setting of 1');
  assert.deepEqual(low({ ...setting, 'a.ts': ['code', 'await tx.wait();'] }), [], 'a file that moves no value');
  assert.equal(low({ 'c.ts': ['code', 'export const REQUIRED_CONFIRMATIONS = 2;'], 'a.ts': ['code', `${moves}await tx.wait();`] }).length, 1, 'a constant of the code');
  assert.equal(low({ 'c.ts': ['code', 'export const net = { mainnet: { confirmations: 4 } };'], 'a.ts': ['code', `${moves}await tx.wait();`] }).length, 1, 'an object of the code');
  assert.deepEqual(low({ 'c.ts': ['code', 'waitFor({ confirmations: 4 });'], 'a.ts': ['code', `${moves}await tx.wait();`] }), [], 'an argument is not a setting');
  assert.equal(low({ '.env': ['env', 'MIN_CONFIRMATIONS=5\n'], 'a.ts': ['code', `${moves}await tx.wait();`] }).length, 1, 'an env value');
  assert.equal(low({ 'n.json': ['json', '{"confirmations": "6"}'], 'a.ts': ['code', `${moves}await tx.wait();`] }).length, 1, 'a number in a string');
});

test('every rule: the line and column of each finding, and every rule in one file', () => {
  const key = counterKey(9);
  const text = [
    "import { MaxUint256 } from 'ethers';",
    `const SIGNER_KEY = '${key}';`,
    `const RPC = '${RPC(KEY20)}';`,
    'export async function go(token, signer, ethereum, el, metadata) {',
    '  await token.approve(spender, MaxUint256);',
    "  await ethereum.request({ method: 'eth_sign', params: [a, h] });",
    '  await signer.signMessage(JSON.stringify(order));',
    "  await signer.signTypedData({ name: 'M' }, types, value);",
    '  await ethereum.enable();',
    '  el.innerHTML = metadata.description;',
    '}'
  ].join('\n');
  const f = findingsIn(text, 'code', 'a.ts');
  assert.deepEqual(f.map((x) => x.rule).sort(), ['chain-not-checked', 'eth-sign', 'html-from-chain', 'legacy-wallet-api', 'private-key', 'rpc-url-key', 'typed-data-domain', 'unlimited-approval', 'unstructured-signing'].sort());
  const at = (rule) => f.find((x) => x.rule === rule);
  assert.equal(at('private-key').line, lineOf(text, 'SIGNER_KEY'));
  assert.equal(at('unlimited-approval').line, lineOf(text, 'approve'));
  assert.equal(at('unlimited-approval').column, 15);
  assert.equal(at('eth-sign').line, lineOf(text, "'eth_sign'"));
  assert.equal(at('html-from-chain').line, lineOf(text, 'innerHTML'));
  assert.deepEqual(rulesIn('', 'code'), []);
  assert.deepEqual(rulesIn('{}', 'json'), []);
  assert.deepEqual(rulesIn('', 'env'), []);
});
