// The checks of one JavaScript or TypeScript file, over the tokens of src/lexer.js. A check of the code reads names,
// calls, member chains, object literals and the values of strings; it never reads a comment, the inside of a regular
// expression or the text of a JSX element, and a string is read for its value only by the rules that are about values
// (keys, phrases, RPC addresses, addresses and method names). Every check is a loop over the tokens of the file, with
// the brackets matched once; a look at the arguments of a call or the value of a name stops after LOOKAHEAD tokens.
// Facts that need the whole project (the addresses, the eth_accounts calls, the waits and the settings of
// confirmations) are collected here and decided in src/project.js.

import { brackets } from './lexer.js';
import { addressesIn, privateKeysIn, rpcKeysIn, seedPhraseOf } from './strings.js';
import { wordsOfName } from './words.js';

export const LOOKAHEAD = 1024;

// The names of a value that is the largest uint256, from ethers (MaxUint256 in v6 and constants.MaxUint256 in v5),
// viem (maxUint256) and the names projects give it.
export const UNLIMITED_NAMES = ['MaxUint256', 'maxUint256', 'MAX_UINT256', 'MAX_UINT_256', 'UINT256_MAX', 'MAX_UINT', 'MAX_ALLOWANCE', 'MAX_APPROVAL', 'UNLIMITED_ALLOWANCE', 'UNLIMITED_APPROVAL', 'INFINITE_APPROVAL', 'INFINITE_ALLOWANCE'];

// The largest uint256 written out: 2**256 - 1 in decimal and in hexadecimal, and as expressions with the parentheses
// and BigInt calls taken out.
const MAX_DECIMAL = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
const MAX_HEX = `0x${'f'.repeat(64)}`;
const MAX_EXPRESSIONS = ['2**256-1', '1<<256-1'];

// The calls that ask a wallet for an approval of a token, by the name of the method.
export const APPROVE_METHODS = ['approve', 'increaseAllowance'];

// The calls of a library that take the name of a function of a contract and its arguments: viem and wagmi.
export const CONTRACT_CALLS = ['writeContract', 'writeContractAsync', 'simulateContract', 'prepareWriteContract', 'encodeFunctionData', 'estimateContractGas'];

// The calls that ask a wallet for a signature of typed data, by the name of the method or of the JSON-RPC method.
export const TYPED_DATA_CALLS = ['signTypedData', '_signTypedData', 'signTypedDataAsync'];
export const TYPED_DATA_METHODS = ['eth_signTypedData_v4', 'eth_signTypedData_v3', 'eth_signTypedData'];

// The calls that ask a wallet to sign a message as text.
export const MESSAGE_CALLS = ['signMessage', 'signMessageAsync'];

// The names and strings that show the code looks at the chain it is on, asks for it, or switches it.
export const CHAIN_WORDS = ['chainId', 'chainID', 'chain_id', 'chainChanged', 'eth_chainId', 'net_version', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'switchChain', 'switchChainAsync', 'useSwitchChain', 'useChainId', 'getChainId', 'getNetwork', 'useNetwork', 'switchNetwork'];

// The calls and strings that send a transaction, and those that connect a wallet.
export const SEND_CALLS = ['sendTransaction', 'sendTransactionAsync', 'writeContract', 'writeContractAsync'];
// connect and connectAsync count only with a connector in their arguments, as wagmi calls them, so that the connect of a
// socket or a database is not read as a wallet.
export const CONNECT_CALLS = ['requestAddresses', 'requestAccounts', 'connect', 'connectAsync'];

// The calls that wait for a receipt, and the names of a transaction that .wait() is called on.
export const WAIT_CALLS = ['waitForTransactionReceipt', 'useWaitForTransactionReceipt', 'waitForTransaction'];
export const TX_WORDS = ['tx', 'txn', 'transaction', 'response', 'pending', 'sent', 'submitted', 'res', 'resp'];

// The names and calls that move value.
export const VALUE_WORDS = ['parseEther', 'parseUnits', 'transfer', 'transferFrom', 'sendTransaction', 'eth_sendTransaction', 'writeContract', 'writeContractAsync', 'deposit', 'withdraw'];

// The words of a name that say a value comes from token metadata or from the chain, for html-from-chain.
export const CHAIN_DATA_WORDS = ['metadata', 'uri', 'nft', 'ens', 'onchain', 'token', 'symbol', 'attributes', 'description', 'collection', 'erc721', 'erc1155', 'contract', 'read'];

// The words of a call that cleans HTML.
export const SANITIZE_WORDS = ['sanitize', 'purify', 'dompurify', 'escape', 'xss'];

// The words that start a statement, where the value of a const ends when the semicolon is left out.
const STATEMENT_WORDS = new Set(['const', 'let', 'var', 'export', 'import', 'function', 'return', 'if', 'for', 'while', 'class', 'async', 'await', 'throw', 'switch', 'try', 'type', 'interface']);

const SIWE_TEXT = 'wants you to sign in with your Ethereum account';

const isP = (t, v) => t !== undefined && t.t === 'p' && t.v === v;
const isId = (t, v) => t !== undefined && t.t === 'id' && (v === undefined || t.v === v);
const OPENERS = new Set(['(', '[', '{', '${']);

// The view of one file that the checks share: the tokens, the brackets and the values of its names.
export function fileView(tokens) {
  const { match, parent } = brackets(tokens);
  const view = { tokens, match, parent, consts: new Map() };
  for (let k = 0; k + 2 < tokens.length; k += 1) {
    if (!(isId(tokens[k], 'const') || isId(tokens[k], 'let') || isId(tokens[k], 'var')) || !isId(tokens[k + 1])) continue;
    const name = tokens[k + 1].v;
    let j = k + 2;
    if (isP(tokens[j], ':')) {
      const stop = Math.min(tokens.length, j + 64);
      while (j < stop && !isP(tokens[j], '=') && !isP(tokens[j], ';')) j = opensAt(view, j) ? view.match[j] + 1 || stop : j + 1;
    }
    if (isP(tokens[j], '=') && !view.consts.has(name)) view.consts.set(name, j + 1);
  }
  return view;
}

// True when the token at k opens a bracket that is matched.
function opensAt(view, k) {
  const t = view.tokens[k];
  return ((t.t === 'p' && OPENERS.has(t.v)) || t.t === 'tpl') && view.match[k] > k;
}

// The end (exclusive) of the expression that starts at k: the first , ; ) ] or } outside brackets, a word that starts a
// statement, or LOOKAHEAD tokens.
export function expressionEnd(view, k) {
  const { tokens } = view;
  const stop = Math.min(tokens.length, k + LOOKAHEAD);
  let j = k;
  while (j < stop) {
    const t = tokens[j];
    if (j > k && t.t === 'id' && STATEMENT_WORDS.has(t.v)) break;
    if (t.t === 'p' && (t.v === ',' || t.v === ';' || t.v === ')' || t.v === ']' || t.v === '}')) break;
    if (t.t === 'tplEnd') break;
    if ((t.t === 'p' && OPENERS.has(t.v)) || t.t === 'tpl') {
      if (view.match[j] < j) return stop;
      j = view.match[j] + 1;
      continue;
    }
    j += 1;
  }
  return Math.min(j, stop);
}

// The arguments of the call whose ( is at open: [[start, end)], split at the commas outside brackets.
export function argumentsOf(view, open) {
  const { tokens, match } = view;
  const close = match[open];
  if (close < open) return [];
  const out = [];
  let start = open + 1;
  let k = open + 1;
  const stop = Math.min(close, open + 1 + LOOKAHEAD);
  while (k < stop) {
    const t = tokens[k];
    if (opensAt(view, k)) {
      k = match[k] + 1;
      continue;
    }
    if (t.t === 'p' && t.v === ',') {
      out.push([start, k]);
      start = k + 1;
    }
    k += 1;
  }
  if (start < close) out.push([start, Math.min(close, stop)]);
  return out;
}

// The entries of the object literal whose { is at open: [{ key, keyAt, start, end, spread, shorthand }].
export function entriesOf(view, open) {
  const { tokens, match } = view;
  const close = match[open];
  const out = [];
  if (close < open) return out;
  const stop = Math.min(close, open + 1 + LOOKAHEAD);
  let k = open + 1;
  while (k < stop) {
    const t = tokens[k];
    const next = tokens[k + 1];
    let end;
    if (isP(t, '...')) {
      end = expressionEnd(view, k + 1);
      out.push({ key: null, keyAt: k, start: k + 1, end, spread: true, shorthand: false });
    } else if ((t.t === 'id' || t.t === 'str' || t.t === 'num') && isP(next, ':')) {
      end = expressionEnd(view, k + 2);
      out.push({ key: t.v, keyAt: k, start: k + 2, end, spread: false, shorthand: false });
    } else if (t.t === 'id' && (isP(next, ',') || k + 1 === close)) {
      end = k + 1;
      out.push({ key: t.v, keyAt: k, start: k, end, spread: false, shorthand: true });
    } else end = expressionEnd(view, k);
    k = Math.max(end, k + 1);
    while (k < stop && !isP(tokens[k], ',')) k = opensAt(view, k) ? match[k] + 1 : k + 1;
    k += 1;
  }
  return out;
}

// The names of a member chain that ends at the name at k: a.b.c gives ['a', 'b', 'c'].
export function chainAt(view, k) {
  const { tokens } = view;
  const out = [tokens[k].v];
  let j = k;
  while (j >= 2 && (isP(tokens[j - 1], '.') || isP(tokens[j - 1], '?.')) && isId(tokens[j - 2]) && out.length < 16) {
    out.unshift(tokens[j - 2].v);
    j -= 2;
  }
  return out;
}

// True when the name at k is called, as f(...) or a.f(...), and not declared: a function or method whose ) is
// followed by { or by : (a return type) is a declaration.
export function isCall(view, k) {
  const { tokens, match } = view;
  if (!isId(tokens[k]) || !isP(tokens[k + 1], '(')) return false;
  if (isId(tokens[k - 1], 'function')) return false;
  const close = match[k + 1];
  if (close < 0) return false;
  const after = tokens[close + 1];
  if (isP(after, '{')) return false;
  if (isP(after, ':') && !isP(tokens[k - 1], '.')) return false;
  return true;
}

// The value of a range as a single name (not a member chain), or null.
const singleName = (view, [s, e]) => (e - s === 1 && isId(view.tokens[s]) ? view.tokens[s].v : null);

// The range of the value of a name declared in the file with const, let or var, or null.
function valueOfName(view, name) {
  const at = view.consts.get(name);
  return at === undefined ? null : [at, expressionEnd(view, at)];
}

// The range of a value, with a single name followed to its declaration once.
function resolved(view, range) {
  const name = singleName(view, range);
  if (name === null) return range;
  return valueOfName(view, name) ?? range;
}

// True when a range holds the largest uint256: a name of UNLIMITED_NAMES at the end of a member chain, 2**256 - 1 in
// one of its written forms, or a name declared as one of these.
export function isUnlimited(view, range) {
  if (unlimitedForm(view, range)) return true;
  const name = singleName(view, range);
  const value = name === null ? null : valueOfName(view, name);
  return value !== null && unlimitedForm(view, value);
}

// True when a range is written as the largest uint256, with no name followed.
function unlimitedForm(view, range) {
  const { tokens } = view;
  const [s, e] = range;
  if (e <= s || e - s > 64) return false;
  const parts = tokens.slice(s, e);
  if (parts.every((t) => t.t === 'id' || isP(t, '.') || isP(t, '?.')) && UNLIMITED_NAMES.includes(parts[parts.length - 1].v)) return true;
  let text = '';
  for (const t of parts) {
    if (t.t === 'id' && t.v === 'BigInt') continue;
    if (isP(t, '(') || isP(t, ')')) continue;
    if (t.t === 'num') text += t.v.replace(/[_n]/g, '').replace(/n$/, '');
    else if (t.t === 'str') text += t.v.replace(/[_n]/g, '');
    else text += t.v;
  }
  const lower = text.toLowerCase();
  return lower === MAX_DECIMAL || lower === MAX_HEX || MAX_EXPRESSIONS.includes(lower);
}

// The innermost object literal around the token at k, as the index of its {, or -1.
function enclosingObject(view, k) {
  let p = view.parent[k];
  let steps = 0;
  while (p >= 0 && steps < 64) {
    if (isP(view.tokens[p], '{')) return p;
    p = view.parent[p];
    steps += 1;
  }
  return -1;
}

// The entry of an object literal by its key.
const entry = (view, open, key) => entriesOf(view, open).find((x) => x.key === key && !x.spread);

// The { of an object literal held by a range, following a single name to its declaration once, or -1.
function objectIn(view, range) {
  const [s, e] = resolved(view, range);
  return isP(view.tokens[s], '{') && view.match[s] === e - 1 ? s : -1;
}

// The names around a string or a template at k: the key or the name it is given to (key: '...', name = '...', name
// ?? '...'), the call it is passed to, and the name of the object literal it sits in.
export function namesAround(view, k) {
  const { tokens, parent } = view;
  const out = [];
  const p = parent[k];
  for (let j = k - 1; j >= Math.max(0, k - 12) && parent[j] === p; j -= 1) {
    const t = tokens[j];
    if ((isP(t, '=') || isP(t, ':')) && j > 0 && (tokens[j - 1].t === 'id' || tokens[j - 1].t === 'str')) {
      out.push(tokens[j - 1].v);
      break;
    }
    if ((isP(t, '??') || isP(t, '||')) && j > 0 && isId(tokens[j - 1])) out.push(tokens[j - 1].v);
    if (isP(t, ';') || isP(t, ',')) break;
  }
  if (p >= 0 && isP(tokens[p], '(') && p > 0 && isId(tokens[p - 1])) out.push(tokens[p - 1].v);
  if (p >= 0 && isP(tokens[p], '{') && p > 1 && (isP(tokens[p - 1], '=') || isP(tokens[p - 1], ':')) && (tokens[p - 2].t === 'id' || tokens[p - 2].t === 'str')) out.push(tokens[p - 2].v);
  return out;
}

// True when a range holds a call to JSON.stringify, or a template literal with two or more ${...} whose text is not a
// Sign-In with Ethereum message, or a string joined with + to two or more names.
function looksStructured(view, [s, e]) {
  const { tokens } = view;
  let joined = 0;
  for (let k = s; k < e && k < s + LOOKAHEAD; k += 1) {
    const t = tokens[k];
    if (isId(t, 'JSON') && isP(tokens[k + 1], '.') && isId(tokens[k + 2], 'stringify')) return true;
    if (t.t === 'id' && (t.v === 'SiweMessage' || t.v === 'createSiweMessage' || t.v === 'prepareMessage')) return false;
    if (t.t === 'tpl' && t.parts.length >= 3) return !t.v.includes(SIWE_TEXT) && !(t.v.includes('Nonce:') && t.v.includes('Chain ID:'));
    if (isP(t, '+')) joined += 1;
  }
  return joined >= 2;
}

// The keys of a domain object literal that are missing, of chainId and verifyingContract, or null when the object
// holds a spread, so that its keys are not known.
function missingDomainKeys(view, open) {
  const entries = entriesOf(view, open);
  if (entries.some((x) => x.spread)) return null;
  return ['chainId', 'verifyingContract'].filter((key) => !entries.some((x) => x.key === key));
}

// The checks of one file of code. text is not read again; the tokens hold what the checks need. Returns { findings:
// [{ rule, offset, found }], facts }.
export function analyzeCode(tokens, file = '') {
  const view = fileView(tokens);
  const findings = [];
  const add = (rule, offset, found) => findings.push({ rule, offset, found });
  const facts = { addresses: [], ethAccounts: [], requestFlow: false, waits: [], confirmations: [], valueTransfer: false, signatures: 0, sends: 0, approvals: 0 };
  let chainSeen = false;
  let firstWallet = null;

  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    const prev = tokens[k - 1];
    const next = tokens[k + 1];

    // Values of strings and of the fixed parts of templates.
    if (t.t === 'str' || t.t === 'tpl') {
      const values = t.t === 'str' ? [t.v] : t.parts;
      const names = namesAround(view, k);
      for (const value of values) {
        if (privateKeysIn(value, names).length) add('private-key', t.o, `a value of 64 hexadecimal digits that looks like a private key is given to ${names[0]} in the code; the value is not shown`);
        const phrase = seedPhraseOf(value);
        if (phrase) add('seed-phrase', t.o, `${phrase.count} words of the BIP-39 English list in a row in a string of the code, ${phrase.holds ? 'and they pass the BIP-39 checksum, so they can be a real seed phrase' : 'though they do not pass the BIP-39 checksum'}; the words are not shown`);
        for (const r of rpcKeysIn(value, names)) add('rpc-url-key', t.o, `an RPC address on ${r.host} holds what looks like an API key in its ${r.where === 'path' ? 'path' : r.where === 'query' ? 'query' : 'user part'}, written in the code that is shipped to the browser; the key is not shown`);
        for (const a of addressesIn(value)) facts.addresses.push({ address: a.address, offset: t.o });
      }
      if (t.t === 'str') {
        if (t.v === 'eth_sign') add('eth-sign', t.o, 'the code asks the wallet for eth_sign, which in MetaMask signed any hash with no prefix, a transaction included, so a user could not see what was signed; MetaMask has removed the method');
        if (t.v === 'eth_accounts') facts.ethAccounts.push({ offset: t.o });
        if (t.v === 'eth_requestAccounts' || t.v === 'wallet_requestPermissions') facts.requestFlow = true;
        if (t.v === 'eth_sendTransaction') {
          facts.sends += 1;
          firstWallet ??= t.o;
        }
        if (t.v === 'eth_requestAccounts') firstWallet ??= t.o;
        if (CHAIN_WORDS.includes(t.v)) chainSeen = true;
        if (VALUE_WORDS.includes(t.v)) facts.valueTransfer = true;
        if (t.v === 'personal_sign') {
          facts.signatures += 1;
          const obj = enclosingObject(view, k);
          const params = obj >= 0 ? entry(view, obj, 'params') : undefined;
          if (params && isP(tokens[params.start], '[')) {
            const first = argumentsOf(view, params.start)[0];
            if (first && looksStructured(view, resolved(view, first))) add('unstructured-signing', t.o, 'personal_sign signs a message built from fields (JSON.stringify, a template with several values, or text joined to values); the wallet shows it as plain text that the user cannot check');
          }
        }
        if (TYPED_DATA_METHODS.includes(t.v)) {
          facts.signatures += 1;
          const obj = enclosingObject(view, k);
          if (obj >= 0) checkTypedDataTokens(obj, t.o);
        }
        if (t.v === 'approve' || t.v === 'increaseAllowance') checkNamedApproval(k);
      }
      continue;
    }

    if (t.t !== 'id') continue;
    if (CHAIN_WORDS.includes(t.v)) chainSeen = true;
    if (VALUE_WORDS.includes(t.v) || (t.v === 'value' && isP(next, ':'))) facts.valueTransfer = true;

    // window.web3 and ethereum.enable().
    if (t.v === 'web3' && isP(prev, '.') && isId(tokens[k - 2], 'window')) add('legacy-wallet-api', tokens[k - 2].o, 'window.web3 is the old injected web3 object; wallets inject an EIP-1193 provider as window.ethereum instead, and window.web3 is no longer there');
    if (t.v === 'enable' && isP(prev, '.') && isCall(view, k) && isId(tokens[k - 2], 'ethereum')) {
      add('legacy-wallet-api', t.o, 'ethereum.enable() is the deprecated way to ask for accounts; EIP-1102 replaces it with the eth_requestAccounts method');
      facts.requestFlow = true;
      firstWallet ??= t.o;
    }
    if ((t.v === 'getSigner' || t.v === 'requestAddresses' || t.v === 'requestAccounts' || t.v === 'useConnect') && isP(next, '(')) facts.requestFlow = true;

    if (!isCall(view, k)) continue;
    const open = k + 1;
    const args = argumentsOf(view, open);
    const chain = chainAt(view, k);
    const withConnector = (t.v === 'connect' || t.v === 'connectAsync') && tokens.slice(open, Math.min(view.match[open], open + LOOKAHEAD)).some((x) => isId(x, 'connector'));
    if (withConnector) facts.requestFlow = true;

    if (SEND_CALLS.includes(t.v)) {
      facts.sends += 1;
      firstWallet ??= t.o;
    }
    if (CONNECT_CALLS.includes(t.v) && (withConnector || (t.v !== 'connect' && t.v !== 'connectAsync'))) firstWallet ??= t.o;

    // eth_sign through web3.eth.sign.
    if (t.v === 'sign' && chain.length >= 2 && chain[chain.length - 2] === 'eth') add('eth-sign', t.o, `${chain.join('.')}() asks the wallet for eth_sign, which in MetaMask signed any hash with no prefix, a transaction included, so a user could not see what was signed; MetaMask has removed the method`);

    // Approvals: x.approve(spender, amount) and x.increaseAllowance(spender, amount).
    if (APPROVE_METHODS.includes(t.v) && isP(prev, '.')) {
      facts.approvals += 1;
      facts.valueTransfer = true;
      if (args[1] && isUnlimited(view, args[1])) add('unlimited-approval', t.o, `${t.v} gives the spender an allowance of the largest uint256, so the spender can move every token of the user, now and later`);
    }

    // Messages signed as text.
    if (MESSAGE_CALLS.includes(t.v) || (t.v === 'sign' && chain.length >= 2 && chain[chain.length - 2] === 'personal')) {
      facts.signatures += 1;
      const first = args[0];
      if (first) {
        let range = resolved(view, first);
        const obj = objectIn(view, first);
        if (obj >= 0) {
          const message = entry(view, obj, 'message');
          range = message ? resolved(view, message.shorthand ? [message.keyAt, message.keyAt + 1] : [message.start, message.end]) : null;
        }
        if (range && looksStructured(view, range)) add('unstructured-signing', t.o, `${chain.join('.')} signs a message built from fields (JSON.stringify, a template with several values, or text joined to values); the wallet shows it as plain text that the user cannot check`);
      }
    }

    // Typed data.
    if (TYPED_DATA_CALLS.includes(t.v)) {
      facts.signatures += 1;
      checkTypedDataCall(k, args, chain);
    }

    // Approvals through the name of the function: writeContract({ functionName: 'approve', args: [s, x] }).
    // checkNamedApproval runs on the string 'approve'.

    // innerHTML and its kin.
    if ((t.v === 'insertAdjacentHTML' && args[1]) || ((t.v === 'write' || t.v === 'writeln') && chain[0] === 'document' && args[0])) {
      const range = t.v === 'insertAdjacentHTML' ? args[1] : args[0];
      if (fedFromChain(range)) add('html-from-chain', t.o, `${chain.join('.')} writes HTML built from ${fedFromChain(range)}, a value that comes from token metadata or the chain, with no sanitizer in sight`);
    }

    // Waits for a receipt.
    if (WAIT_CALLS.includes(t.v)) {
      const obj = args[0] ? objectIn(view, args[0]) : -1;
      let confirmations = 1;
      let known = true;
      if (obj >= 0) {
        const c = entry(view, obj, 'confirmations');
        if (c) [confirmations, known] = numberIn(c);
      } else if (args[1]) [confirmations, known] = numberIn({ start: args[1][0], end: args[1][1] });
      if (known) facts.waits.push({ offset: t.o, confirmations, call: chain.join('.') });
    }
    if (t.v === 'wait' && isP(prev, '.') && (isP(tokens[k - 2], ')') || (isId(tokens[k - 2]) && wordsOfName(tokens[k - 2].v).some((w) => TX_WORDS.includes(w))))) {
      let confirmations = 1;
      let known = true;
      if (args[0]) [confirmations, known] = numberIn({ start: args[0][0], end: args[0][1] });
      if (known) facts.waits.push({ offset: t.o, confirmations, call: `${isId(tokens[k - 2]) ? tokens[k - 2].v : '(...)'}.wait` });
    }
  }

  // innerHTML = ..., outerHTML = ... and dangerouslySetInnerHTML={{ __html: ... }}. A sink whose value starts inside the
  // value of the sink before it (a = b.innerHTML = c) was read with it, so each token is read once.
  let covered = -1;
  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (t.t !== 'id' || k + 2 <= covered) continue;
    const sink = (t.v === 'innerHTML' || t.v === 'outerHTML') && isP(tokens[k - 1], '.') && (isP(tokens[k + 1], '=') || isP(tokens[k + 1], '+='));
    const react = t.v === '__html' && isP(tokens[k + 1], ':');
    if (!sink && !react) continue;
    covered = expressionEnd(view, k + 2);
    const source = fedFromChain([k + 2, covered]);
    if (source && sink) add('html-from-chain', t.o, `${t.v} is set to HTML built from ${source}, a value that comes from token metadata or the chain, with no sanitizer in sight`);
    if (source && react) add('html-from-chain', t.o, `dangerouslySetInnerHTML is given HTML built from ${source}, a value that comes from token metadata or the chain, with no sanitizer in sight`);
  }

  // The settings of confirmations in the code: const CONFIRMATIONS = 3, or confirmations: 3 in an object literal that
  // is not an argument of a call.
  for (let k = 0; k + 2 < tokens.length; k += 1) {
    const t = tokens[k];
    if (!(t.t === 'id' || t.t === 'str') || !wordsOfName(t.v).some((w) => w === 'confirmations' || w === 'confirmation')) continue;
    if (!(isP(tokens[k + 1], '=') || isP(tokens[k + 1], ':')) || tokens[k + 2].t !== 'num') continue;
    if (isP(tokens[k + 1], ':') && insideCall(k)) continue;
    const value = Number(tokens[k + 2].v.replace(/[_n]/g, ''));
    if (Number.isFinite(value)) facts.confirmations.push({ name: t.v, value, offset: t.o });
  }

  if (!chainSeen && firstWallet !== null) add('chain-not-checked', firstWallet, 'this file asks the wallet for accounts or sends a transaction, and nothing in it reads the chain id, listens for chainChanged or switches the network, so a transaction can go to the chain the wallet happens to be on');

  return { findings, facts, view };

  // A number written as a literal in a range or an entry: [value, known]. A name or an expression is not known.
  function numberIn(e) {
    const s = e.shorthand ? e.keyAt : e.start;
    const end = e.shorthand ? e.keyAt + 1 : e.end;
    if (end - s === 1 && tokens[s].t === 'num') return [Number(tokens[s].v.replace(/[_n]/g, '')), true];
    return [0, false];
  }

  // True when the token at k sits inside the parentheses of a call.
  function insideCall(k) {
    let p = view.parent[k];
    let steps = 0;
    while (p >= 0 && steps < 64) {
      if (isP(tokens[p], '(') && p > 0 && isId(tokens[p - 1])) return true;
      p = view.parent[p];
      steps += 1;
    }
    return false;
  }

  // The first name of a range that comes from token metadata or the chain, or null; null too when the range calls a
  // sanitizer.
  function fedFromChain([s, e]) {
    let found = null;
    for (let j = s; j < e && j < s + LOOKAHEAD; j += 1) {
      const x = tokens[j];
      if (x.t !== 'id') continue;
      const words = wordsOfName(x.v);
      if (words.some((w) => SANITIZE_WORDS.includes(w))) return null;
      if (found === null && words.some((w) => CHAIN_DATA_WORDS.includes(w))) found = x.v;
    }
    return found;
  }

  // An approval named as the function of a library call: functionName: 'approve' with args: [spender, amount], or
  // encodeFunctionData('approve', [spender, amount]) of ethers.
  function checkNamedApproval(k) {
    const prevTok = tokens[k - 1];
    let list = null;
    if (isP(prevTok, ':') && isId(tokens[k - 2], 'functionName')) {
      const obj = enclosingObject(view, k);
      const a = obj >= 0 ? entry(view, obj, 'args') : undefined;
      if (a && isP(tokens[a.start], '[')) list = a.start;
      const p = obj >= 0 ? view.parent[obj] : -1;
      if (!(p >= 0 && isP(tokens[p], '(') && isId(tokens[p - 1]) && CONTRACT_CALLS.includes(tokens[p - 1].v)) && !(obj >= 0 && isP(tokens[obj - 1], '='))) return;
    } else if (view.parent[k] >= 0 && isP(tokens[view.parent[k]], '(') && isId(tokens[view.parent[k] - 1], 'encodeFunctionData')) {
      const args = argumentsOf(view, view.parent[k]);
      if (args[1] && isP(tokens[args[1][0]], '[')) list = args[1][0];
    } else return;
    facts.approvals += 1;
    facts.valueTransfer = true;
    if (list === null) return;
    const items = argumentsOf(view, list);
    if (items[1] && isUnlimited(view, items[1])) add('unlimited-approval', tokens[k].o, `${tokens[k].v}, called through ${tokens[k - 2].v === 'functionName' ? 'functionName' : 'encodeFunctionData'}, gives the spender an allowance of the largest uint256, so the spender can move every token of the user, now and later`);
  }

  // A call of signTypedData: the domain is the first argument (ethers), or the domain key of an object argument (viem
  // and wagmi); a permit with a value of the largest uint256 is an unlimited approval.
  function checkTypedDataCall(k, args, chain) {
    const name = chain.join('.');
    if (!args[0]) return;
    let domain = -1;
    let missingWhole = false;
    const obj = objectIn(view, args[0]);
    if (obj >= 0) {
      const keys = entriesOf(view, obj);
      const d = keys.find((x) => x.key === 'domain');
      if (d) domain = objectIn(view, d.shorthand ? [d.keyAt, d.keyAt + 1] : [d.start, d.end]);
      else if (keys.some((x) => x.key === 'types' || x.key === 'primaryType' || x.key === 'message')) missingWhole = !keys.some((x) => x.spread);
      else domain = obj;
    }
    if (missingWhole) add('typed-data-domain', tokens[k].o, `${name} is called with no domain, so the signature is bound to no chain and no contract and can be replayed where the same fields mean something`);
    else if (domain >= 0) {
      const missing = missingDomainKeys(view, domain);
      if (missing && missing.length) add('typed-data-domain', tokens[k].o, `the domain given to ${name} has no ${missing.join(' and no ')}, so the signature ${missing.includes('chainId') ? 'can be replayed on another chain' : 'is not bound to the contract that checks it'}`);
    }
    permitCheck(args.reduce((r, a) => [Math.min(r[0], a[0]), Math.max(r[1], a[1])], [Infinity, -Infinity]), tokens[k].o, name);
  }

  // A request of eth_signTypedData_v4: the domain is the domain key of an object literal inside the request.
  function checkTypedDataTokens(obj, at) {
    const close = view.match[obj];
    if (close < obj) return;
    for (let j = obj + 1; j < close && j < obj + LOOKAHEAD; j += 1) {
      if ((isId(tokens[j], 'domain') || (tokens[j].t === 'str' && tokens[j].v === 'domain')) && isP(tokens[j + 1], ':')) {
        const d = objectIn(view, [j + 2, expressionEnd(view, j + 2)]);
        if (d >= 0) {
          const missing = missingDomainKeys(view, d);
          if (missing && missing.length) add('typed-data-domain', at, `the domain of the eth_signTypedData request has no ${missing.join(' and no ')}, so the signature ${missing.includes('chainId') ? 'can be replayed on another chain' : 'is not bound to the contract that checks it'}`);
        }
        break;
      }
    }
    permitCheck([obj + 1, close], at, 'eth_signTypedData');
  }

  // A value or amount of the largest uint256 in the message of a typed data request, as an EIP-2612 permit has.
  function permitCheck([s, e], at, name) {
    for (let j = s; j < e && j < s + LOOKAHEAD; j += 1) {
      const x = tokens[j];
      if ((x.t === 'id' || x.t === 'str') && (x.v === 'value' || x.v === 'amount') && isP(tokens[j + 1], ':') && isUnlimited(view, [j + 2, expressionEnd(view, j + 2)])) {
        add('unlimited-approval', at, `the typed data signed through ${name} sets ${x.v} to the largest uint256, an EIP-2612 permit with no limit, so the spender can move every token of the user`);
        return;
      }
    }
  }
}
