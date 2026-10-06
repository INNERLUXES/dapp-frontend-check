import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { KEY_PARAMS, NOT_KEY_WORDS, PHRASE_LENGTHS, PUBLIC_PREFIXES, RPC_HOST_WORDS, WORDS, WORD_INDEX, addressesIn, checksumHolds, checksumState, hostOf, keccak256, keccakHex, namesSayKey, phraseOf, phraseWords, placeholderAddress, privateKeysIn, publicPrefixOf, rpcKeysIn, seedPhraseIn, seedPhraseOf, sponge, toChecksumAddress } from '../src/index.js';
import { counterKey, fakeKey } from './helpers.js';

// The values the rules read: Keccak-256 and the checksum of EIP-55 against the test cases EIP-55 publishes, the BIP-39
// list against the SHA-256 of english.txt and its checksum against phrases built at run time, and the shapes of keys,
// phrases, addresses and RPC addresses.

// The addresses EIP-55 lists as its test cases: all caps, all lower, and mixed case.
const EIP55_CASES = [
  '0x52908400098527886E0F7030069857D2E4169EE7',
  '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
  '0xde709f2102306220921060314715629080e2fb77',
  '0x27b1fdb04752bbc536007a920d24acb045561c26',
  '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
  '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb'
];

test('keccak: the known hashes of the empty text and of abc, and the permutation over several blocks against the SHA3-256 of Node', () => {
  assert.equal(keccakHex(''), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(keccakHex('abc'), '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  assert.equal(keccak256(new Uint8Array(0)).length, 32);
  for (const n of [0, 1, 135, 136, 137, 271, 272, 1000]) {
    const bytes = Buffer.alloc(n, n % 251);
    assert.equal(Buffer.from(sponge(bytes, 0x06)).toString('hex'), createHash('sha3-256').update(bytes).digest('hex'), `${n} bytes`);
  }
});

test('EIP-55: every test case of the EIP gives itself back, and its state is upper, lower or valid', () => {
  for (const a of EIP55_CASES) {
    assert.equal(toChecksumAddress(a.toLowerCase()), toChecksumAddress(a), a);
    if (/[a-f]/.test(a.slice(2)) && /[A-F]/.test(a.slice(2))) {
      assert.equal(toChecksumAddress(a), a, a);
      assert.equal(checksumState(a), 'valid', a);
    }
  }
  assert.deepEqual(EIP55_CASES.map(checksumState), ['upper', 'upper', 'lower', 'lower', 'valid', 'valid', 'valid', 'valid']);
  assert.equal(checksumState('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD'), 'invalid', 'one letter changed');
  assert.equal(checksumState(`0x${'1'.repeat(40)}`), 'lower', 'digits only');
});

test('BIP-39: the list is the published english.txt, the checksum holds for phrases built from entropy and fails for others', () => {
  assert.equal(WORDS.length, 2 ** 11);
  assert.equal(new Set(WORDS).size, WORDS.length);
  assert.equal(createHash('sha256').update(`${WORDS.join('\n')}\n`).digest('hex'), '2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda');
  assert.ok(WORDS.every((w) => /^[a-z]{3,8}$/.test(w)));
  assert.equal(new Set(WORDS.map((w) => w.slice(0, 4))).size, WORDS.length, 'unique by the first four letters');
  assert.equal(WORD_INDEX.get(WORDS[17]), 17);
  assert.deepEqual(PHRASE_LENGTHS, [12, 15, 18, 21, 24]);
  for (const bytes of [16, 20, 24, 28, 32]) {
    const phrase = phraseOf(Buffer.alloc(bytes, bytes));
    assert.equal(phrase.length, (bytes * 8 * 33) / 32 / 11);
    assert.ok(checksumHolds(phrase), `${bytes} bytes`);
    const changed = [...phrase];
    changed[changed.length - 1] = WORDS[(WORD_INDEX.get(changed[changed.length - 1]) + 1) % WORDS.length];
    assert.ok(!checksumHolds(changed), `${bytes} bytes, last word changed`);
  }
  assert.equal(phraseOf(Buffer.alloc(16, 0))[0], WORDS[0]);
  assert.ok(!checksumHolds(phraseOf(Buffer.alloc(16, 1)).slice(0, 11)), 'eleven words');
  assert.ok(!checksumHolds([...phraseOf(Buffer.alloc(16, 1)).slice(0, 11), 'notaword']), 'a word not in the list');
});

test('BIP-39: runs of words in a text, the longest run, and the phrase of a run', () => {
  const p = phraseOf(Buffer.alloc(16, 3));
  assert.equal(seedPhraseIn(`x ${p.join(' ')} y`).start, 2);
  assert.equal(seedPhraseIn(p.slice(0, 11).join(' ')), null);
  const long = seedPhraseIn(`${p.slice(0, 12).join(' ')} . ${[...p, p[0]].join('\n')}`);
  assert.equal(long.count, 13);
  assert.equal(phraseWords(long).length, 12);
  assert.equal(seedPhraseOf('no words here'), null);
  assert.deepEqual(seedPhraseOf(p.join('  ')), { index: 0, count: 12, holds: true });
});

test('strings: keys by their names, addresses, placeholders, RPC addresses with keys, hosts and public prefixes', () => {
  const key = counterKey(5);
  assert.ok(namesSayKey(['PRIVATE_KEY']) && namesSayKey(['apiKey']) && namesSayKey(['x', 'Wallet']) && namesSayKey(['mnemonicSeed']));
  assert.ok(!namesSayKey(['publicKey']) && !namesSayKey(['TOPIC_HASH']) && !namesSayKey(['keyId']) && !namesSayKey([]) && !namesSayKey(['value']));
  assert.ok(NOT_KEY_WORDS.includes('hash'));
  assert.deepEqual(privateKeysIn(`a ${key} b ${key.slice(2)}`, ['pk']), [2, 71]);
  assert.deepEqual(privateKeysIn(`${key}f`, ['pk']), []);
  assert.deepEqual(privateKeysIn(fakeKey('0'), ['pk']), []);
  assert.deepEqual(privateKeysIn(fakeKey('Ab'), ['pk']).length, 1, 'a repeated pattern of two digits is reported; only one digit repeated is a placeholder');
  assert.deepEqual(addressesIn('see 0x24f8097B1994432e896001062ff6be5E53a6F170, not 0x24f8097B1994432e896001062ff6be5E53a6F1701'), [{ index: 4, address: '0x24f8097B1994432e896001062ff6be5E53a6F170' }]);
  assert.ok(placeholderAddress(`0x${'Ee'.repeat(20)}`) && !placeholderAddress('0x24f8097B1994432e896001062ff6be5E53a6F170'));
  assert.equal(hostOf('https://user:pw@rpc.example.test:8545/v3/x'), 'rpc.example.test');
  assert.equal(hostOf('wss://rpc.example.test'), 'rpc.example.test');
  assert.deepEqual(rpcKeysIn('https://api.example.test/eth?apikey=abcdefgh123', []).map((r) => r.where), ['query']);
  assert.deepEqual(rpcKeysIn('https://api.example.test/v1?token=abcdefgh123', []), [], 'not an RPC address by its host or path');
  assert.deepEqual(rpcKeysIn('https://api.example.test/v1?token=abcdefgh123', ['rpcUrl']).map((r) => r.where), ['query'], 'an RPC address by its name');
  assert.deepEqual(rpcKeysIn('https://rpc.example.test/v1?token=short', []), []);
  assert.deepEqual(rpcKeysIn('https://rpc.example.test/v1?page=abcdefgh123&x', []), []);
  assert.deepEqual(rpcKeysIn('https://a:b@node.example.test', []).map((r) => r.where), ['password']);
  assert.deepEqual(rpcKeysIn('https://rpc.example.test', []), []);
  assert.deepEqual(rpcKeysIn(`https://rpc.example.test/${'a'.repeat(30)}`, []), [], 'letters only');
  assert.ok(RPC_HOST_WORDS.includes('rpc') && KEY_PARAMS.includes('apikey'));
  assert.equal(publicPrefixOf('NEXT_PUBLIC_RPC'), 'NEXT_PUBLIC_');
  assert.equal(publicPrefixOf('RPC'), null);
  assert.ok(PUBLIC_PREFIXES.includes('VITE_'));
});
