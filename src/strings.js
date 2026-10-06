// What the rules read in the value of a string: a string of the code, a fixed part of a template literal, a string of a
// JSON file or the value of an env file. The value is never copied into a finding: a key, a phrase or the key of an RPC
// address is named by where it is, and an address, which is public, by its digits. Every pattern here is fixed and
// bounded: each runs once over the value, and no pattern is built from the input.

import { seedPhraseIn, phraseWords, checksumHolds } from './bip39.js';
import { wordsOfName } from './words.js';

// The words of a name that say it holds a private key or a secret. "key" alone counts too, unless a word of
// NOT_KEY_WORDS says the value is something public such as a hash, a topic or a storage slot.
export const KEY_WORDS = ['private', 'priv', 'privkey', 'privatekey', 'secret', 'pk', 'signer', 'deployer', 'wallet', 'mnemonic', 'seed'];
export const NOT_KEY_WORDS = ['public', 'pub', 'hash', 'topic', 'slot', 'storage', 'salt', 'root', 'id', 'tx', 'block', 'selector', 'role', 'digest', 'code', 'init'];

// The words of a name, a property or a call that say an address is an RPC address.
export const RPC_WORDS = ['rpc', 'rpcs', 'provider', 'node', 'endpoint', 'transport', 'jsonrpc', 'web3', 'ws', 'wss', 'http', 'https', 'chain', 'network'];

// The words of a host or a path that say an address is an RPC address.
export const RPC_HOST_WORDS = ['rpc', 'node', 'nodes', 'mainnet', 'testnet', 'sepolia', 'holesky', 'infura', 'alchemy', 'quiknode', 'quicknode', 'ankr', 'chainstack', 'blastapi', 'getblock', 'nodereal', 'drpc', 'pokt', 'eth', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc', 'avalanche'];

// The names of query parameters that hold a key.
export const KEY_PARAMS = ['key', 'apikey', 'api_key', 'api-key', 'token', 'access_token', 'accesstoken', 'auth', 'secret', 'projectid', 'project_id', 'apisecret', 'x-api-key'];

// The prefixes of env names that a front-end build puts into the code that every visitor downloads.
export const PUBLIC_PREFIXES = ['NEXT_PUBLIC_', 'VITE_', 'REACT_APP_', 'PUBLIC_', 'EXPO_PUBLIC_', 'NUXT_PUBLIC_', 'GATSBY_', 'VUE_APP_'];

const HEX64 = /(?<![0-9A-Za-z_])(?:0x)?[0-9a-fA-F]{64}(?![0-9A-Za-z_])/g;
const ADDRESS = /(?<![0-9A-Za-z_])0x[0-9a-fA-F]{40}(?![0-9A-Za-z_])/g;
const URL = /(?:https?|wss?):\/\/[^\s"'`<>\\{}|^]{1,4096}/gi;

// True when every digit of a value is the same, in any case, like 0x000...0: a placeholder, not a key or an address.
const sameDigits = (hex) => /^(?:0x)?([0-9a-f])\1*$/.test(String(hex).toLowerCase());

// True when the names around a value say it is a private key: a name with a word of KEY_WORDS, or with the word key and
// no word of NOT_KEY_WORDS.
export function namesSayKey(names) {
  for (const name of names) {
    const words = wordsOfName(name);
    if (words.some((w) => KEY_WORDS.includes(w))) return true;
    if (words.includes('key') && !words.some((w) => NOT_KEY_WORDS.includes(w))) return true;
  }
  return false;
}

// The places of the values of 64 hexadecimal digits in a value that the names around it say are private keys:
// [offset in the value]. A value whose digits are all the same is a placeholder and is passed over.
export function privateKeysIn(value, names) {
  if (!namesSayKey(names)) return [];
  const out = [];
  for (const m of String(value).matchAll(HEX64)) if (!sameDigits(m[0])) out.push(m.index);
  return out;
}

// A seed phrase in a value: { index, count, holds } with the number of words of the list in a row and whether the
// BIP-39 checksum of the phrase they make holds, or null.
export function seedPhraseOf(value) {
  const run = seedPhraseIn(value);
  if (!run) return null;
  return { index: run.start, count: run.count, holds: checksumHolds(phraseWords(run)) };
}

// The addresses of 40 hexadecimal digits after 0x in a value: [{ index, address }].
export function addressesIn(value) {
  return [...String(value).matchAll(ADDRESS)].map((m) => ({ index: m.index, address: m[0] }));
}

// True when an address of 40 digits is a placeholder such as the zero address: every digit the same.
export const placeholderAddress = (address) => sameDigits(address);

// A key seen in an address: a path part of 20 characters or more of letters, digits, - and _ with both letters and
// digits in it that is not an address, or a parameter of KEY_PARAMS with a value of 8 characters or more, or a password
// before the host. Returns 'path', 'query', 'password' or null.
function keyIn(url) {
  const rest = url.replace(/^[a-z]+:\/\//i, '');
  const slash = rest.search(/[/?#]/);
  const authority = slash < 0 ? rest : rest.slice(0, slash);
  if (/^[^@]*:[^@]+@/.test(authority)) return 'password';
  const after = slash < 0 ? '' : rest.slice(slash);
  const q = after.indexOf('?');
  const path = q < 0 ? after : after.slice(0, q);
  for (const part of path.split('/')) {
    if (part.length >= 20 && /^[A-Za-z0-9_-]+$/.test(part) && /[0-9]/.test(part) && /[A-Za-z]/.test(part) && !/^0x[0-9a-fA-F]{40}$/.test(part)) return 'path';
  }
  if (q >= 0) {
    for (const pair of after.slice(q + 1).split(/[&#]/)) {
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      const name = pair.slice(0, eq).toLowerCase();
      if (KEY_PARAMS.includes(name) && pair.length - eq - 1 >= 8) return 'query';
    }
  }
  return null;
}

// The host of an address, with no user and no port.
export function hostOf(url) {
  const rest = url.replace(/^[a-z]+:\/\//i, '');
  const authority = rest.split(/[/?#]/)[0];
  return authority.slice(authority.lastIndexOf('@') + 1).replace(/:\d+$/, '');
}

// The RPC addresses with a key in a value: [{ index, host, where }]. An address counts as an RPC address when a word of
// its host or path is in RPC_HOST_WORDS, or a word of the names around it is in RPC_WORDS.
export function rpcKeysIn(value, names) {
  const out = [];
  const named = names.some((n) => wordsOfName(n).some((w) => RPC_WORDS.includes(w)));
  for (const m of String(value).matchAll(URL)) {
    const url = m[0];
    const where = keyIn(url);
    if (!where) continue;
    const host = hostOf(url);
    const words = wordsOfName(url.replace(/^[a-z]+:\/\//i, '').split(/[?#]/)[0]);
    if (named || words.some((w) => RPC_HOST_WORDS.includes(w))) out.push({ index: m.index, host, where });
  }
  return out;
}

// The prefix of an env name that puts its value into the front-end bundle, or null.
export const publicPrefixOf = (name) => PUBLIC_PREFIXES.find((p) => String(name).startsWith(p)) ?? null;
