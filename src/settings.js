// The checks of the JSON files and the env files of a project: the values that look like private keys, seed phrases and
// RPC addresses with a key, the addresses and the maps of contract names to addresses by chain, and the settings of
// confirmations. A JSON file is read with the lexer and the forgiving reader of src/tree.js, an env file with
// src/envfile.js. A value is never copied into a finding but an address, which is public.

import { parseEnv } from './envfile.js';
import { addressesIn, placeholderAddress, privateKeysIn, publicPrefixOf, rpcKeysIn, seedPhraseOf } from './strings.js';
import { entryOf, readTree, walkTree } from './tree.js';
import { asciiLower, wordsOfName } from './words.js';

// The keys of an object whose value is the address itself, so that the name of the contract is found above them or in
// a name key next to them.
export const ADDRESS_KEYS = ['address', 'addr', 'contractaddress', 'deployedaddress'];

// The keys next to an address that name its contract.
export const NAME_KEYS = ['name', 'contract', 'contractname', 'label', 'id'];

// The keys that give the chain of the values in an object.
export const CHAIN_KEYS = ['chainId', 'chainID', 'chain_id', 'chain'];

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const CHAIN_NUMBER = /^[0-9]{1,12}$/;

const isConfirmationName = (name) => wordsOfName(name).some((w) => w === 'confirmations' || w === 'confirmation');

// The chain and the contract name of an address of a JSON file, from its keys and the objects that hold it: the chain is
// the innermost key that is a number, or a chainId key of an object that holds it; the name is the key that holds the
// address, or, for a key such as address, the name key next to it or the nearest key above that is not a number.
// Returns { chain, name } or null when either is not found.
export function placeOfAddress(keys, owners) {
  let chain = null;
  for (let k = keys.length - 1; k >= 0 && chain === null; k -= 1) if (keys[k] !== null && CHAIN_NUMBER.test(keys[k])) chain = String(Number(keys[k]));
  if (chain === null) {
    for (let k = owners.length - 1; k >= 0 && chain === null; k -= 1) {
      for (const key of CHAIN_KEYS) {
        const v = entryOf(owners[k], key);
        if (v && (v.k === 'num' || (v.k === 'str' && CHAIN_NUMBER.test(v.v)))) {
          chain = String(Number(v.v));
          break;
        }
      }
    }
  }
  const named = keys.filter((x) => x !== null && !CHAIN_NUMBER.test(x));
  let name = null;
  const last = keys[keys.length - 1];
  if (last !== null && last !== undefined && !CHAIN_NUMBER.test(last) && !ADDRESS_KEYS.includes(asciiLower(last))) name = last;
  else {
    const holder = owners[owners.length - 1];
    if (holder && last !== null && ADDRESS_KEYS.includes(asciiLower(last ?? ''))) {
      for (const key of holder.entries) if (NAME_KEYS.includes(asciiLower(key.key)) && key.node.k === 'str') name = key.node.v;
    }
    if (name === null) name = [...named].reverse().find((x) => !ADDRESS_KEYS.includes(asciiLower(x)) && !CHAIN_KEYS.includes(x)) ?? null;
  }
  return chain !== null && name !== null ? { chain, name } : null;
}

// The checks of one JSON file: { findings: [{ rule, offset, found }], facts }.
export function analyzeJson(tokens, limits = undefined) {
  const findings = [];
  const facts = { addresses: [], mapEntries: [], confirmations: [] };
  const add = (rule, offset, found) => findings.push({ rule, offset, found });
  const root = readTree(tokens, limits);
  walkTree(root, (node, keys, owners) => {
    const key = [...keys].reverse().find((x) => x !== null) ?? '';
    if (node.k === 'num' && isConfirmationName(key) && Number.isFinite(node.v)) facts.confirmations.push({ name: key, value: node.v, offset: node.o });
    if (node.k !== 'str') return;
    if (isConfirmationName(key) && /^[0-9]{1,6}$/.test(node.v)) facts.confirmations.push({ name: key, value: Number(node.v), offset: node.o });
    const names = key ? [key] : [];
    if (privateKeysIn(node.v, names).length) add('private-key', node.o, `a value of 64 hexadecimal digits that looks like a private key is given to ${key} in a JSON file of the project; the value is not shown`);
    const phrase = seedPhraseOf(node.v);
    if (phrase) add('seed-phrase', node.o, `${phrase.count} words of the BIP-39 English list in a row in a JSON file of the project${key ? `, under ${key}` : ''}, ${phrase.holds ? 'and they pass the BIP-39 checksum, so they can be a real seed phrase' : 'though they do not pass the BIP-39 checksum'}; the words are not shown`);
    for (const r of rpcKeysIn(node.v, names)) add('rpc-url-key', node.o, `an RPC address on ${r.host}${key ? `, under ${key},` : ''} holds what looks like an API key in its ${r.where === 'path' ? 'path' : r.where === 'query' ? 'query' : 'user part'}, written in a JSON file of the project; the key is not shown`);
    for (const a of addressesIn(node.v)) facts.addresses.push({ address: a.address, offset: node.o });
    if (ADDRESS.test(node.v) && !placeholderAddress(node.v)) {
      const place = placeOfAddress(keys, owners);
      if (place) facts.mapEntries.push({ ...place, address: node.v, offset: node.o });
    }
  });
  return { findings, facts };
}

// The checks of one env file: { findings: [{ rule, offset, found }], facts }.
export function analyzeEnv(text) {
  const findings = [];
  const facts = { addresses: [], mapEntries: [], confirmations: [], entries: 0 };
  const add = (rule, offset, found) => findings.push({ rule, offset, found });
  for (const e of parseEnv(text)) {
    facts.entries += 1;
    const prefix = publicPrefixOf(e.name);
    const shipped = prefix ? `, and the prefix ${prefix} puts it into the code every visitor downloads` : '';
    if (privateKeysIn(e.value, [e.name]).length) add('private-key', e.valueAt, `${e.name} holds a value of 64 hexadecimal digits that looks like a private key in an env file of the repository${shipped}; the value is not shown`);
    const phrase = seedPhraseOf(e.value);
    if (phrase) add('seed-phrase', e.valueAt, `${e.name} holds ${phrase.count} words of the BIP-39 English list in a row in an env file of the repository, ${phrase.holds ? 'and they pass the BIP-39 checksum, so they can be a real seed phrase' : 'though they do not pass the BIP-39 checksum'}${shipped}; the words are not shown`);
    for (const r of rpcKeysIn(e.value, [e.name])) add('rpc-url-key', e.valueAt, `${e.name} holds an RPC address on ${r.host} with what looks like an API key in its ${r.where === 'path' ? 'path' : r.where === 'query' ? 'query' : 'user part'}, in an env file of the repository${shipped}; the key is not shown`);
    for (const a of addressesIn(e.value)) facts.addresses.push({ address: a.address, offset: e.valueAt + a.index });
    if (isConfirmationName(e.name) && /^[0-9]{1,6}$/.test(e.value)) facts.confirmations.push({ name: e.name, value: Number(e.value), offset: e.valueAt });
  }
  return { findings, facts };
}
