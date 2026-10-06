# Inputs

## The folder

```
dapp-frontend-check <folder> [--exclude <pattern>]... [--config <file>]
```

Name one folder: the folder of the front end or the off-chain service, the one that holds its source. Every file below
it that an include pattern names is read; the folders .git and node_modules are passed over wherever they are, in any
case of letters, and so is every path that matches an exclude pattern, which by default leaves out build output and
caches. A folder that is a file, a symbolic link or missing stops the run with exit code `2`. Check two projects in two
runs.

The paths in the report are relative to the folder you run the command in, with forward slashes on every system,
followed by the line.

## The files

| File | How it is read | What is read |
| --- | --- | --- |
| `*.js`, `*.jsx`, `*.mjs`, `*.cjs`, `*.tsx` | the lexer, with JSX | names, calls, member chains and object literals outside comments, regular expressions and JSX text; the value of every string and of the fixed parts of every template |
| `*.ts`, `*.mts`, `*.cts` | the lexer, with no JSX | the same; `<` is always an operator, because `<T>x` is a type assertion there |
| `*.json`, `package.json` among them | the lexer and a forgiving reader of values | every string with its keys, the maps of contract names to addresses by chain, and the settings of confirmations; comments and commas at the end of a list are allowed |
| `.env`, `.env.*` (`.env.example`, `.env.local`, `.env.production` and the others) | the reader of env files | every `NAME=value` line, the value in quotes or bare |
| any other file an include pattern names | the lexer, with JSX | as JavaScript |

Names are compared without regard to case, so `Wallet.TS` is read too. A file is read as UTF-8, with or without a byte
order mark, or as UTF-16 with its byte order mark. Nothing is built, bundled or run, no import is followed, no package
is installed and no node is called.

## The paths left out by default

| Pattern | Why |
| --- | --- |
| `**/dist/**` | the bundles of Vite, Rollup and webpack |
| `**/build/**` | the build of Create React App and other tools |
| `**/.next/**` | the build of Next.js |
| `**/out/**` | the static export of Next.js and the output of Foundry |
| `**/coverage/**` | the reports of test coverage |
| `**/artifacts/**` | the compiled contracts of Hardhat |
| `**/cache/**` | the caches of Hardhat and Foundry |
| `**/package-lock.json`, `**/npm-shrinkwrap.json` | the lock files of npm: hashes and versions, no code of the project |

The patterns match these folders wherever they are, so a monorepo with several apps is covered. The folders `.git` and
`node_modules` are not patterns: they are never read, wherever they are, and no setting reads them. To read `dist` too,
give `exclude` a list without it; to leave out tests or mocks, add them, such as `"**/mocks/**"`.

## Exclude patterns

`--exclude <pattern>` and `exclude` of the configuration leave paths of the folder out, and `include` names the files
to read. A pattern is matched against the path relative to the folder, with forward slashes, in lowercase: `*` is any
run of characters but a slash, `?` one character but a slash, `**` any run of characters with slashes, and `**/` any
run of folders, none included. A folder is left out when the pattern matches its path or its path with a slash after
it, so `mocks/**` leaves out the folder mocks at the top and all below it, and `**/mocks/**` every folder named mocks. A
pattern may not be absolute, hold a backslash or `..`, or be longer than 200 characters. The patterns of `--exclude`
add to those of the configuration.

## The configuration file

The configuration is one JSON object, read by a strict reader of RFC 8259 (no comments, no trailing comma, no name
given twice). Every key is optional; without `--config` the defaults apply, and `--print-defaults` writes them out. A
key the tool does not know is an error with its line and a suggestion, and stops the run with exit code `2`.

```json
{
  "name": "Quillmere Market front end review",
  "include": ["**/*.ts", "**/*.tsx", "**/*.json", "**/.env.*"],
  "exclude": ["**/dist/**", "**/mocks/**"],
  "rules": { "unstructuredSigning": "warning", "addressRepeated": "off" },
  "minSeverity": "info",
  "failOn": "error"
}
```

| Key | Value | Default |
| --- | --- | --- |
| `name` | a text of 1 to 120 characters, shown in the report | none |
| `include` | 1 to 200 path patterns of the files to read | the JavaScript, TypeScript, JSON and env files |
| `exclude` | up to 200 path patterns of paths to leave out | the build output, caches and lock files above |
| `rules` | an object of rule keys to `info`, `warning`, `error` or `off` | below |
| `minSeverity` | the lowest level shown: `info`, `warning` or `error` | `info` |
| `failOn` | the lowest level that fails the run | `error` |

The lists replace their defaults as a whole, and a value given twice in a list is kept once. `--min-severity` and
`--fail-on` on the command line win over the configuration. No key takes a regular expression, and no key takes a
secret: the tool needs none.

## The keys of rules

| Key | Rule | Default |
| --- | --- | --- |
| `rules.privateKey` | `private-key` | error |
| `rules.seedPhrase` | `seed-phrase` | error |
| `rules.rpcUrlKey` | `rpc-url-key` | warning |
| `rules.unlimitedApproval` | `unlimited-approval` | warning |
| `rules.ethSign` | `eth-sign` | error |
| `rules.unstructuredSigning` | `unstructured-signing` | info |
| `rules.typedDataDomain` | `typed-data-domain` | warning |
| `rules.chainCheck` | `chain-not-checked` | info |
| `rules.addressChecksum` | `address-checksum` | warning |
| `rules.addressRepeated` | `address-repeated` | info |
| `rules.addressConflict` | `address-conflict` | warning |
| `rules.legacyWalletApi` | `legacy-wallet-api` | warning |
| `rules.htmlFromChain` | `html-from-chain` | warning |
| `rules.lowConfirmations` | `low-confirmations` | info |

`unreadable-file` and `scan-limit` have no key: they are always errors. Setting a rule to `off` leaves it out of the
findings and the counts, and a note names it.

### Why the levels are what they are

The errors are the findings that are wrong wherever they appear: a value that looks like a private key or a seed
phrase in a file of the repository, which has to be treated as known to everyone, and a request of `eth_sign`, which
MetaMask has removed. The warnings are often wrong but can be right in a context the tool cannot see: an RPC key that
is restricted to a domain, an unlimited approval the user chose on purpose, a domain whose chain is checked another
way, an address whose case was typed by hand, two configurations for staging and production, an old wallet API kept for
one old wallet, and HTML from metadata that a component cleans elsewhere. The notes ask the review for a look rather
than a change: a message built from fields and signed as text, wallet code with no chain check in the same file, an
address written in several places, and a wait for one confirmation against a setting of more.
