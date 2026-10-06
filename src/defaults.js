// The built-in configuration: the level of every rule, the files that are read, the paths left out, the lowest level
// shown and the level that fails the run. docs/inputs.md describes every key, and --print-defaults writes the
// configuration out.

// The level of every rule that the configuration can set. The two rules of input problems are always errors.
export const DEFAULT_RULES = {
  privateKey: 'error',
  seedPhrase: 'error',
  rpcUrlKey: 'warning',
  unlimitedApproval: 'warning',
  ethSign: 'error',
  unstructuredSigning: 'info',
  typedDataDomain: 'warning',
  chainCheck: 'info',
  addressChecksum: 'warning',
  addressRepeated: 'info',
  addressConflict: 'warning',
  legacyWalletApi: 'warning',
  htmlFromChain: 'warning',
  lowConfirmations: 'info'
};

// The files that are read, as patterns relative to the folder, compared in lowercase: JavaScript and TypeScript with and
// without JSX, JSON (package.json and the maps of networks and contracts among them) and env files, .env.example too.
export const DEFAULT_INCLUDE = ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs', '**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.json', '**/.env', '**/.env.*'];

// Paths of the folder that are not read: build output, bundles and caches (dist, build, .next, out, coverage,
// artifacts, cache) wherever they are, and the lock files of npm, which hold no code of the project. The folders .git
// and node_modules are never read.
export const DEFAULT_EXCLUDE = ['**/dist/**', '**/build/**', '**/.next/**', '**/out/**', '**/coverage/**', '**/artifacts/**', '**/cache/**', '**/package-lock.json', '**/npm-shrinkwrap.json'];

// The lowest level of a finding that is shown.
export const DEFAULT_MIN_SEVERITY = 'info';

// The lowest level of a finding that fails the run.
export const DEFAULT_FAIL_ON = 'error';
