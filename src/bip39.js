// Seed phrases as BIP-39 writes them: 12, 15, 18, 21 or 24 words of its list, each word standing for 11 bits; the last
// ENT/32 bits are the first bits of the SHA-256 hash of the entropy before them. The tool never prints a phrase: it
// only says where one is, how many words it has and whether its checksum holds.

import { createHash } from 'node:crypto';
import { WORDS } from './wordlist.js';

// The index of every word of the list.
export const WORD_INDEX = new Map(WORDS.map((w, i) => [w, i]));

// The numbers of words a phrase may have.
export const PHRASE_LENGTHS = [12, 15, 18, 21, 24];

// True when the words (lowercase, from the list) make a phrase whose checksum holds.
export function checksumHolds(words) {
  if (!PHRASE_LENGTHS.includes(words.length)) return false;
  const bits = [];
  for (const w of words) {
    const index = WORD_INDEX.get(w);
    if (index === undefined) return false;
    for (let b = 10; b >= 0; b -= 1) bits.push((index >> b) & 1);
  }
  const entropyBits = (words.length * 11 * 32) / 33;
  const checksumBits = entropyBits / 32;
  const entropy = Buffer.alloc(entropyBits / 8);
  for (let k = 0; k < entropyBits; k += 1) if (bits[k]) entropy[k >> 3] |= 0x80 >> (k & 7);
  const hash = createHash('sha256').update(entropy).digest();
  for (let k = 0; k < checksumBits; k += 1) if (((hash[k >> 3] >> (7 - (k & 7))) & 1) !== bits[entropyBits + k]) return false;
  return true;
}

// The words of a phrase made from entropy, as BIP-39 builds them; the tests use it to make a phrase whose checksum
// holds at run time, so that no phrase is written into the repository.
export function phraseOf(entropy) {
  const hash = createHash('sha256').update(entropy).digest();
  const bits = [];
  for (const byte of entropy) for (let b = 7; b >= 0; b -= 1) bits.push((byte >> b) & 1);
  for (let k = 0; k < (entropy.length * 8) / 32; k += 1) bits.push((hash[k >> 3] >> (7 - (k & 7))) & 1);
  const out = [];
  for (let k = 0; k + 11 <= bits.length; k += 11) {
    let index = 0;
    for (let b = 0; b < 11; b += 1) index = index * 2 + bits[k + b];
    out.push(WORDS[index]);
  }
  return out;
}

// The longest run of words of the list in a text, taken apart at white space: { start, count, words } with start the
// offset of its first word, or null when no run has 12 words or more.
export function seedPhraseIn(text) {
  const s = String(text);
  let best = null;
  let run = [];
  let runStart = 0;
  const close = () => {
    if (run.length >= 12 && (!best || run.length > best.count)) best = { start: runStart, count: run.length, words: run };
    run = [];
  };
  const re = /[^\s]+/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const word = m[0];
    if (WORD_INDEX.has(word)) {
      if (!run.length) runStart = m.index;
      run.push(word);
    } else close();
  }
  close();
  return best;
}

// The words of a run that make a phrase: the run itself when its length is one BIP-39 allows, else its first 24, 21,
// 18, 15 or 12 words.
export function phraseWords(run) {
  const length = [...PHRASE_LENGTHS].reverse().find((l) => l <= run.count);
  return run.words.slice(0, length);
}
