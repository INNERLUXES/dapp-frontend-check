// The rules and the result. Each rule names the points of the public pages it rests on (src/data.js), says where it is
// the tool's own choice, and what to change. docs/method.md says exactly what each rule looks at and what it cannot
// see. The checks themselves are in src/code.js (the code), src/settings.js (JSON and env files) and src/project.js
// (what needs the whole project).

import { LEVELS } from './data.js';
import { grouped, plural } from './size.js';

export const RULES = [
  {
    id: 'private-key',
    key: 'privateKey',
    title: 'a value that looks like a private key in the code, a JSON file or an env file',
    basis: ['keysNeverShared', 'secretsNotInCode', 'secretsRotate', 'dotenvFormat'],
    own: 'a value of 64 hexadecimal digits, with or without 0x, in a string, a fixed part of a template, a JSON string or an env value, where the name it is given to, its key, the call it is passed to or the object it sits in has a word of KEY_WORDS, or the word key and no word of NOT_KEY_WORDS (a hash, a topic, a slot or a role is a value of the same shape); a value whose digits are all the same is a placeholder; the value is never shown',
    rule: () => 'a value of 64 hexadecimal digits that its name says is a private key',
    fix: 'take the key out of the repository and out of its history, treat it as known to everyone and move what it holds to a new key; sign on a server or in the wallet of the user, never with a key shipped in a front end'
  },
  {
    id: 'seed-phrase',
    key: 'seedPhrase',
    title: 'a run of words that looks like a seed phrase',
    basis: ['bip39Phrase', 'bip39List', 'keysNeverShared', 'phraseOffline', 'secretsNotInCode'],
    own: '12 or more words in a row, all of the BIP-39 English list, in a string, a fixed part of a template, a JSON string or an env value; the report says whether the BIP-39 checksum of the phrase holds, and a run whose checksum fails is still reported, because it may be a real phrase with one word changed; the words are never shown',
    rule: () => '12 or more words of the BIP-39 English list in a row',
    fix: 'take the phrase out of the repository and out of its history, treat every account of it as known to everyone and move what they hold; a test that needs a phrase builds it at run time'
  },
  {
    id: 'rpc-url-key',
    key: 'rpcUrlKey',
    title: 'an RPC address with an API key in it, committed in source',
    basis: ['secretsNotInCode', 'secretsRotate'],
    own: 'an http, https, ws or wss address with a path part of 20 or more letters, digits, - and _ that holds letters and digits, a query parameter of KEY_PARAMS with a value of 8 or more characters, or a password before the host, where the host or the path has a word of RPC_HOST_WORDS or the name around it a word of RPC_WORDS; a key that comes from ${...} is not seen; only the host is shown',
    rule: () => 'an RPC address with what looks like an API key in its path, query or user part',
    fix: 'read the address from the environment at build time and keep the key out of the repository; for a front end, use a key restricted to your domains and methods, or send the calls through a server of your own, and rotate the key that was committed'
  },
  {
    id: 'unlimited-approval',
    key: 'unlimitedApproval',
    title: 'an approval or a permit for the largest uint256',
    basis: ['limitApprovals', 'eip20Approve', 'eip2612Permit', 'ethersMax'],
    own: 'x.approve(spender, amount) or x.increaseAllowance(spender, amount), approve named by functionName with args of viem or wagmi or by encodeFunctionData of ethers, and a value or amount of the typed data of a permit, where the amount is a name of UNLIMITED_NAMES at the end of a member chain, 2**256 - 1, (1 << 256) - 1, the same in BigInt, 64 f digits or the decimal number, or a name declared in the file as one of these',
    rule: () => 'an approval or a permit whose amount is the largest uint256',
    fix: 'approve only the amount the next transaction needs, or let the user choose the amount and show it before the wallet opens'
  },
  {
    id: 'eth-sign',
    key: 'ethSign',
    title: 'eth_sign asked of the wallet',
    basis: ['mmEthSignRemoved', 'mmTypedData', 'ethSignPrefix'],
    own: 'the string eth_sign as a whole value, as the method of a request, and a call of web3.eth.sign or of any x.eth.sign',
    rule: () => 'a request of eth_sign, or a call of x.eth.sign',
    fix: 'sign typed data with eth_signTypedData_v4 (EIP-712), or text the user can read with personal_sign'
  },
  {
    id: 'unstructured-signing',
    key: 'unstructuredSigning',
    title: 'a message signed as text that is built from fields',
    basis: ['eip712Readable', 'mmTypedData'],
    own: 'personal_sign, signMessage or signMessageAsync, or x.personal.sign, whose message (the first parameter, the first argument or the message key) holds a call of JSON.stringify, a template with two or more ${...}, or text joined with + more than once; a Sign-In with Ethereum message, by its fixed text or a SiweMessage, is left out, and a message held in a name declared elsewhere is not followed',
    rule: () => 'personal_sign or signMessage of a message built from fields',
    fix: 'sign the fields as EIP-712 typed data with eth_signTypedData_v4, so the wallet shows each field and the contract can check them; keep personal_sign for text such as a sign-in message'
  },
  {
    id: 'typed-data-domain',
    key: 'typedDataDomain',
    title: 'typed data whose domain has no chainId or no verifyingContract',
    basis: ['eip712Domain', 'eip712NoReplay', 'eip155ChainId', 'viemTypedData'],
    own: 'signTypedData, _signTypedData or signTypedDataAsync called with a domain object literal (the first argument, or the domain key of an object argument, or a name declared in the file as one) that has no chainId or no verifyingContract key, or with an object that has types, primaryType or message and no domain; an eth_signTypedData request whose domain key holds such a literal; a domain built elsewhere or with a spread is not read',
    rule: () => 'a typed data domain literal with no chainId or no verifyingContract',
    fix: 'put chainId and verifyingContract into the domain, the chain id of the chain the contract is on and the address of the contract that checks the signature'
  },
  {
    id: 'chain-not-checked',
    key: 'chainCheck',
    title: 'wallet code that never looks at the chain',
    basis: ['eip1193ChainChanged', 'mmChainChanged', 'mmSwitch', 'eip155ChainId'],
    own: 'a file that asks for accounts (eth_requestAccounts, requestAddresses, ethereum.enable(), connect with a connector) or sends a transaction (eth_sendTransaction, sendTransaction, writeContract), with no name or string of CHAIN_WORDS anywhere in it; the first such place is reported; a check in another file, or in a library that checks the chain for you, is not seen, so this is a note',
    rule: () => 'a file that connects a wallet or sends a transaction with no chain id, chainChanged or network switch in it',
    fix: 'read the chain id before a transaction, ask the wallet to switch when it differs (wallet_switchEthereumChain or switchChain), and listen for chainChanged; or pass the chain to the library call so that it checks it'
  },
  {
    id: 'address-checksum',
    key: 'addressChecksum',
    title: 'a mixed-case address that fails the EIP-55 checksum',
    basis: ['eip55Checksum'],
    own: 'an address of 40 hexadecimal digits after 0x, in a string, a JSON file or an env file, with upper and lower case letters that do not match the checksum of EIP-55, worked out with the Keccak-256 of the tool itself; an address all in lower or all in upper case has no checksum and is not reported; the report names the address with its right checksum',
    rule: () => 'a mixed-case address whose case does not match EIP-55',
    fix: 'check the address against its source, a digit may be wrong; then write it with its EIP-55 checksum, as getAddress of ethers or viem gives it'
  },
  {
    id: 'address-repeated',
    key: 'addressRepeated',
    title: 'an address written into the code in several places instead of one map',
    basis: ['eip155ChainId'],
    own: 'an address written in the code that is also in a JSON or env file of the project, or written in two files of code or more; the first file of code in the order of the paths is taken as the home of the address and the others are reported; the zero address and other addresses of one repeated digit are left out',
    rule: () => 'an address in several files of code, or in the code and a configuration map',
    fix: 'keep the addresses in one map by chain and name, in a JSON file or one module, and read them from there'
  },
  {
    id: 'address-conflict',
    key: 'addressConflict',
    title: 'one contract name mapped to two addresses for one chain',
    basis: ['eip155ChainId'],
    own: 'two JSON files that map the same contract name (the key that holds the address, or the name next to an address key) to two addresses for the same chain (a key that is a number, or a chainId next to it); the first file in the order of the paths is the reference, and maps by chain name rather than chain id are not read; two settings for staging and production can differ on purpose, which a person has to judge',
    rule: () => 'a contract name with two addresses for one chain id in two JSON files',
    fix: 'keep one map of addresses by chain id, or name the files so that each is used for one deployment only, and check which of the two addresses is the deployed one'
  },
  {
    id: 'legacy-wallet-api',
    key: 'legacyWalletApi',
    title: 'an old way to reach the wallet',
    basis: ['eip1102Request', 'eip1102Legacy', 'eip1193Legacy', 'mmEthAccounts', 'mmRequestAccounts'],
    own: 'window.web3, the old injected object; ethereum.enable() (or window.ethereum.enable()); and the string eth_accounts in a project where nothing asks for accounts (no eth_requestAccounts, wallet_requestPermissions, requestAddresses, getSigner, useConnect or connect with a connector); web3.js as a library is not reported',
    rule: () => 'window.web3, ethereum.enable(), or eth_accounts with no request for accounts in the project',
    fix: 'use the EIP-1193 provider: ask for accounts with eth_requestAccounts when the user acts, and read them with eth_accounts after that'
  },
  {
    id: 'html-from-chain',
    key: 'htmlFromChain',
    title: 'HTML built from token metadata or values of the chain',
    basis: ['xssSinks', 'reactDangerous', 'eip721Metadata'],
    own: 'dangerouslySetInnerHTML with __html, x.innerHTML or x.outerHTML set with = or +=, insertAdjacentHTML and document.write, whose value holds a name with a word of CHAIN_DATA_WORDS (metadata, uri, nft, ens, token, description and the others of docs/method.md) and no call with a word of SANITIZE_WORDS; a heuristic on names: a value from the chain held in a name with other words is not seen',
    rule: () => 'an HTML sink fed from a name of token metadata or of the chain, with no sanitizer',
    fix: 'show text with textContent or as a JSX child, or clean the HTML with a sanitizer such as DOMPurify right before it is set'
  },
  {
    id: 'low-confirmations',
    key: 'lowConfirmations',
    title: 'a wait for zero or one confirmation where a setting asks for more',
    basis: ['ethersWait', 'viemWaitConfirmations', 'finality'],
    own: 'tx.wait(), tx.wait(0) or tx.wait(1), waitForTransaction and waitForTransactionReceipt with no confirmations or 0 or 1 (the libraries wait for one by default), in a file that moves value (approve, transfer, parseEther, sendTransaction, writeContract or a value key), in a project where a JSON key, an env name or a constant named confirmations sets 2 or more; a number held in a name is not read',
    rule: () => 'a wait for 0 or 1 confirmation in a file that moves value, against a setting of 2 or more',
    fix: 'pass the number of confirmations of the setting to the wait, so the app shows a transfer as done only when the setting says it is safe'
  },
  {
    id: 'unreadable-file',
    key: null,
    title: 'a file that cannot be read',
    basis: ['jsonUtf8', 'jsonRepeatedNames'],
    own: 'a file over its size limit, a binary file, or a file that is not valid UTF-8, or UTF-16 with its byte order mark; nothing in it is checked; this rule cannot be set lower or off',
    rule: () => 'a file that the tool could not read',
    fix: 'save the file as UTF-8; a file larger than the limit can be checked with a larger limit in a run of its own'
  },
  {
    id: 'scan-limit',
    key: null,
    title: 'the input is larger than the limits of a run',
    basis: ['lexical', 'tsxAssertions'],
    own: 'a folder with more files, folders or files to read than the limits of docs/limits.md, folders nested deeper, or a file past the limits of the lexer (tokens, names, nesting); the rest is not read, so the run fails; this rule cannot be set lower or off',
    rule: () => 'a folder or a file past a limit of the run',
    fix: 'exclude the folders that are not code of the project, such as bundles and vendored files, or check the parts of the project in runs of their own'
  }
];

export const ruleById = (id) => RULES.find((r) => r.id === id);

// True when a level is at or above another.
export const atOrAbove = (level, min) => LEVELS.indexOf(level) >= LEVELS.indexOf(min);

// The result: the run fails when a finding is at or above the level failOn. { pass, failOn, failing, byLevel, text }.
export function decide(findings, failOn) {
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of findings) byLevel[f.level] += 1;
  const failing = findings.filter((f) => atOrAbove(f.level, failOn)).length;
  const counts = ['error', 'warning', 'info'].filter((l) => byLevel[l]).map((l) => `${grouped(byLevel[l])} ${l}`);
  const text = failing
    ? `FAIL - ${plural(failing, 'finding')} at or above ${failOn}${counts.length ? ` (${counts.join(', ')})` : ''}`
    : `PASS - no finding at or above ${failOn}${counts.length ? ` (${counts.join(', ')})` : ''}`;
  return { pass: failing === 0, failOn, failing, byLevel, text };
}
