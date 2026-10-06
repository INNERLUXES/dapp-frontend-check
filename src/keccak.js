// Keccak-256 and the mixed-case checksum of EIP-55, written here so that the tool needs no dependency. Keccak-256 is the
// hash of the Keccak team as Ethereum uses it: the permutation Keccak-f[1600], a rate of 136 bytes and the padding byte
// 0x01, not the 0x06 of SHA3-256 as NIST later fixed it. Each 64-bit lane is held as two 32-bit halves. test/data.test.js
// checks the hash against known values and the checksum against every address that EIP-55 lists as a test case.

// The round constants of Keccak-f[1600], low and high half of each.
const RC = [
  0x1, 0x0, 0x8082, 0x0, 0x808a, 0x80000000, 0x80008000, 0x80000000, 0x808b, 0x0, 0x80000001, 0x0, 0x80008081, 0x80000000, 0x8009, 0x80000000,
  0x8a, 0x0, 0x88, 0x0, 0x80008009, 0x0, 0x8000000a, 0x0, 0x8000808b, 0x0, 0x8b, 0x80000000, 0x8089, 0x80000000, 0x8003, 0x80000000,
  0x8002, 0x80000000, 0x80, 0x80000000, 0x800a, 0x0, 0x8000000a, 0x80000000, 0x80008081, 0x80000000, 0x8080, 0x80000000, 0x80000001, 0x0,
  0x80008008, 0x80000000
];

// The rotation of each lane, by its index x + 5y.
const ROTATION = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];

const RATE = 136;

// The 24 rounds of Keccak-f[1600] on the state, lanes in lo (low halves) and hi (high halves).
function permute(lo, hi) {
  const cLo = new Uint32Array(5);
  const cHi = new Uint32Array(5);
  const bLo = new Uint32Array(25);
  const bHi = new Uint32Array(25);
  for (let round = 0; round < 24; round += 1) {
    for (let x = 0; x < 5; x += 1) {
      cLo[x] = lo[x] ^ lo[x + 5] ^ lo[x + 10] ^ lo[x + 15] ^ lo[x + 20];
      cHi[x] = hi[x] ^ hi[x + 5] ^ hi[x + 10] ^ hi[x + 15] ^ hi[x + 20];
    }
    for (let x = 0; x < 5; x += 1) {
      const nLo = cLo[(x + 1) % 5];
      const nHi = cHi[(x + 1) % 5];
      const dLo = cLo[(x + 4) % 5] ^ ((nLo << 1) | (nHi >>> 31));
      const dHi = cHi[(x + 4) % 5] ^ ((nHi << 1) | (nLo >>> 31));
      for (let y = 0; y < 25; y += 5) {
        lo[x + y] ^= dLo;
        hi[x + y] ^= dHi;
      }
    }
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        const i = x + 5 * y;
        let l = lo[i];
        let h = hi[i];
        let n = ROTATION[i];
        if (n >= 32) {
          const t = l;
          l = h;
          h = t;
          n -= 32;
        }
        const target = y + 5 * ((2 * x + 3 * y) % 5);
        if (n === 0) {
          bLo[target] = l;
          bHi[target] = h;
        } else {
          bLo[target] = (l << n) | (h >>> (32 - n));
          bHi[target] = (h << n) | (l >>> (32 - n));
        }
      }
    }
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x += 1) {
        lo[x + y] = bLo[x + y] ^ (~bLo[((x + 1) % 5) + y] & bLo[((x + 2) % 5) + y]);
        hi[x + y] = bHi[x + y] ^ (~bHi[((x + 1) % 5) + y] & bHi[((x + 2) % 5) + y]);
      }
    }
    lo[0] ^= RC[round * 2];
    hi[0] ^= RC[round * 2 + 1];
  }
}

// The sponge with a rate of 136 bytes and an output of 32 bytes, with the first padding byte given: 0x01 for Keccak-256,
// 0x06 for SHA3-256, which lets a test compare the permutation over several blocks with the SHA3-256 of Node.
export function sponge(bytes, pad = 0x01) {
  const lo = new Uint32Array(25);
  const hi = new Uint32Array(25);
  const blocks = Math.floor(bytes.length / RATE) + 1;
  const padded = new Uint8Array(blocks * RATE);
  padded.set(bytes);
  padded[bytes.length] ^= pad;
  padded[padded.length - 1] ^= 0x80;
  for (let b = 0; b < blocks; b += 1) {
    for (let k = 0; k < RATE; k += 4) {
      const at = b * RATE + k;
      const word = (padded[at] | (padded[at + 1] << 8) | (padded[at + 2] << 16) | (padded[at + 3] << 24)) >>> 0;
      const lane = k >> 3;
      if ((k & 4) === 0) lo[lane] ^= word;
      else hi[lane] ^= word;
    }
    permute(lo, hi);
  }
  const out = new Uint8Array(32);
  for (let k = 0; k < 32; k += 1) {
    const lane = k >> 3;
    const half = (k & 4) === 0 ? lo[lane] : hi[lane];
    out[k] = (half >>> ((k & 3) * 8)) & 0xff;
  }
  return out;
}

// The Keccak-256 hash of bytes (a Uint8Array or a Buffer), as 32 bytes.
export const keccak256 = (bytes) => sponge(bytes, 0x01);

// The Keccak-256 hash of the ASCII text, as 64 lowercase hexadecimal digits.
export function keccakHex(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
  return Array.from(keccak256(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

// The address written with the checksum of EIP-55: the Keccak-256 hash of the 40 lowercase digits, as ASCII, decides
// each letter; a letter is upper case when the digit of the hash at its place is 8 or more.
export function toChecksumAddress(address) {
  const digits = String(address).slice(2).toLowerCase();
  const hash = keccakHex(digits);
  let out = '0x';
  for (let i = 0; i < digits.length; i += 1) out += parseInt(hash[i], 16) >= 8 ? digits[i].toUpperCase() : digits[i];
  return out;
}

// What the case of an address says under EIP-55: 'lower' or 'upper' (no checksum, which EIP-55 accepts), 'valid' (a
// mixed case that matches the checksum) or 'invalid' (a mixed case that does not).
export function checksumState(address) {
  const digits = String(address).slice(2);
  const hasLower = /[a-f]/.test(digits);
  const hasUpper = /[A-F]/.test(digits);
  if (!hasUpper) return 'lower';
  if (!hasLower) return 'upper';
  return toChecksumAddress(address) === `0x${digits}` ? 'valid' : 'invalid';
}
