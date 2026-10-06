// Words compared as the tool compares them: the letters A to Z lowered whatever the locale, paths with forward slashes,
// and texts in the order of their code units. Used for the names of files and folders, the names of variables,
// keys and functions, and the suggestions of the configuration.

// Lowercase for the letters A to Z only, so the result does not depend on the locale.
export const asciiLower = (text) => String(text).replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));

// The last part of a path with forward slashes: "src/wallet.ts" is "wallet.ts".
export const baseName = (path) => String(path).slice(String(path).lastIndexOf('/') + 1);

// A path with forward slashes and no trailing slash, the parts joined: joinPath("a", "b") is "a/b", and "." is left out.
export const joinPath = (a, b) => (a === '' || a === '.' ? b : b === '' || b === '.' ? a : `${a}/${b}`);

// The folder of a path with forward slashes: "src/wallet.ts" is "src", and "wallet.ts" is ".".
export function folderOf(path) {
  const at = String(path).lastIndexOf('/');
  return at < 0 ? '.' : String(path).slice(0, at);
}

// Two texts in the order of their UTF-16 code units, with no locale.
export const byCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// The words of a name in lowercase, for the tables of names the rules compare: camelCase, PascalCase, snake_case,
// kebab-case and runs of capitals are split, so "RELAYER_PRIVATE_KEY", "relayerPrivateKey" and "relayer-private-key"
// all give relayer, private and key, and "tokenURI" gives token and uri. Digits end a word.
export function wordsOfName(name) {
  const out = [];
  const s = String(name).slice(0, 4096);
  let word = '';
  const flush = () => {
    if (word) out.push(asciiLower(word));
    word = '';
  };
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    const upper = c >= 'A' && c <= 'Z';
    const lower = c >= 'a' && c <= 'z';
    if (!upper && !lower) {
      flush();
      continue;
    }
    if (upper && word && (s[i - 1] < 'A' || s[i - 1] > 'Z' || (s[i + 1] >= 'a' && s[i + 1] <= 'z'))) flush();
    word += c;
  }
  flush();
  return out;
}
