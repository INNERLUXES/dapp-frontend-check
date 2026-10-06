# dapp-frontend-check

dApp front-end check. Give it the folder of the front end or the off-chain service of a decentralized app. It reads every
JavaScript, TypeScript, JSON and env file in it as text, with a lexer of its own that sets comments, regular expressions
and the text of JSX elements aside and still reads the value of every string, runs nothing, and lists the risky Web3
integration patterns it can see: values that look like private keys or seed phrases in source or committed env files,
RPC addresses with an API key, approvals and permits for the largest uint256, `eth_sign`, messages built from fields and
signed as text, typed data whose domain has no `chainId` or no `verifyingContract`, wallet code that never looks at the
chain, addresses that fail the EIP-55 checksum, addresses written in several places instead of one map, one contract
name mapped to two addresses for one chain, `window.web3`, `ethereum.enable()` and `eth_accounts` with no request for
accounts, HTML built from token metadata, and waits for one confirmation where a setting asks for more. Every finding
has its file, line and column, what was found and what to change, and the run exits with a code a pipeline can act on.
It never shows a secret value.

**It is an input to a review of how the app talks to wallets and chains: not a security audit and not a guarantee that
the app is safe.** It is not an auditor. It reads files only: it runs nothing, builds nothing, calls no node, fetches
nothing and reads no clock, so it does not see the value of a variable, a module of another file, which chain a wallet
is on, or what a contract does with a signature; the checks are a heuristic. A clean run means only that none of the
forms of its rules were found, and people still have to review and test the app before anyone can say it is safe.

A front end holds the keys to the wallets of its users in a weaker sense than a contract does: it decides what the
wallet is asked to sign, for how much, on which chain, and against which address. EIP-712 says why typed data beats an
opaque string (https://eips.ethereum.org/EIPS/eip-712), MetaMask has removed `eth_sign`
(https://github.com/MetaMask/metamask-improvement-proposals/blob/main/MIPs/mip-3.md), ethereum.org asks users to refuse
unlimited approvals (https://ethereum.org/security/), and the OWASP cheat sheet says client-side code holds no secrets
(https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html). Before a team ships a release, it
needs the list: which file, which call, which line. This tool writes that list from the files, on every change.

- **One check per pattern.** Fourteen rules, each with what it looks at, what it cannot see, the public pages it rests
  on and what to change, and two rules of input problems that are always errors.
- **A lexer of its own.** Comments, regular expressions and JSX text are set aside before any check of the code runs,
  so `eth_sign` in a comment is never a finding, while the rules about keys, phrases, RPC addresses and addresses still
  read every string; a slash is a division or a regular expression by the token before it, and JSX is read in
  JavaScript and `.tsx` files, never in `.ts` files.
- **Keccak-256 and BIP-39 of its own.** The EIP-55 checksum is worked out with a Keccak-256 tested against the test
  addresses of the EIP, and seed phrases are read against the BIP-39 English list, tested against the published file.
- **No secret in the output.** A key, a phrase or the key of an RPC address is named by its file, line, column and the
  name around it, never by its value, in every format.
- Reports as text, JSON, CSV with one row per finding and GitHub workflow annotations, with an exit code for a
  pipeline: `0` no finding at or above the `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network.

```
npm test
```

```
tests 111
pass 109
fail 0
skipped 2
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link, a device or file permissions (links in the folder to a file and to a folder, a folder and a
configuration named through a link, `/dev/null` named as a folder, and a file with no read access); they are guarded
with `process.platform`, run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same
tests with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install, and no node, wallet or key is needed.

```
git clone https://github.com/INNERLUXES/dapp-frontend-check.git
cd dapp-frontend-check
node bin/dapp-frontend-check.js examples/messy --config examples/config.json
```

Or without a clone, in the folder of your own project:

```
npx --yes github:INNERLUXES/dapp-frontend-check .
```

`examples/` holds two made-up projects. `examples/messy/` is the front end of a market for passes: a wallet module,
the signing of listings and bids, the approval of a router, a card that shows metadata, maps of contracts by chain, env
files and a seed script. Between them they hold one finding of every rule. They also hold what must not be reported:
patterns in comments and JSX text, near misses next to each finding, a JSON file with comments, a package under
`node_modules`, a bundle under `dist` and a folder of mocks the configuration leaves out. `examples/clean/` is the
front end of a ticket booth, which passes with no finding. Every key and phrase in them is made up: one short pattern or
one word repeated, never a real key.

## Usage

```
dapp-frontend-check <folder> [--exclude <pattern>]... [--config <file>] [options]
```

```
--exclude <pattern>       a path of the folder to leave out, relative to it, such as test/** or **/mocks/**;
                          may be given more than once, and adds to exclude of the configuration
--config <file>           settings in strict JSON: include, exclude, rules, minSeverity and failOn
                          (--print-defaults shows them)
--format <name>           text, json, csv or github (default: text); csv writes one row per finding, github writes
                          workflow commands that GitHub shows as annotations
--json                    the same as --format json
--min-severity <level>    the lowest level of a finding that is shown: info, warning, error (default: minSeverity of
                          the configuration, else info)
--fail-on <level>         the lowest level of a finding that fails the run: info, warning, error (default: failOn of
                          the configuration, else error)
--explain                 show the rule, the public sources and the tool's own choice behind each finding
--print-defaults          print the built-in configuration and exit
--help                    show the usage
--version                 show the version
```

Name one folder, the one that holds the source of the app. The paths in the report are relative to the folder you run
the command in, with forward slashes on every system, followed by the line.

The report of the messy example starts with what was read, the configuration, the rules and the findings in one line
each; then every file with its kind, its addresses and its findings; then the summary; then the count of findings of
every rule; then the findings, errors first, each with what to change:

```
dapp-frontend-check: examples/messy
input: 12 files read (7 code, 4 JSON, 1 env); 1 other file passed over; 1 folder named .git or node_modules passed over; 2 paths excluded; 0 links not followed
config: examples/config.json (Quillmere Market front end review): include **/*.js, **/*.jsx, **/*.mjs, **/*.cjs, **/*.ts, **/*.tsx, **/*.mts, **/*.cts, **/*.json, **/.env and **/.env.*; exclude **/dist/**, **/build/**, **/.next/**, **/out/**, **/coverage/**, **/artifacts/**, **/cache/**, **/package-lock.json, **/npm-shrinkwrap.json and **/mocks/**; minimum severity info; fail on error
rules: private-key (error); seed-phrase (error); rpc-url-key (warning); unlimited-approval (warning); eth-sign (error); unstructured-signing (warning); typed-data-domain (warning); chain-not-checked (info); address-checksum (warning); address-repeated (info); address-conflict (warning); legacy-wallet-api (warning); html-from-chain (warning); low-confirmations (info); unreadable-file (error); scan-limit (error)
findings: 17 (4 error, 9 warning, 4 info)

Files (12)

  file                                              kind  addresses  error  warning  info
  examples/messy/.env.example                       env   1          2      0        0
  examples/messy/package.json                       json  0          0      0        0
  examples/messy/scripts/seed-market.mjs            code  0          1      0        0
  examples/messy/src/components/NftCard.tsx         code  0          0      1        0
  examples/messy/src/config/contracts.json          json  3          0      0        0
  examples/messy/src/config/networks.json           json  0          0      0        0
  examples/messy/src/config/staging/contracts.json  json  2          0      1        0
  examples/messy/src/lib/addresses.ts               code  2          0      1        1
  examples/messy/src/lib/rpc.ts                     code  0          0      1        0
  examples/messy/src/trade/approve.ts               code  1          0      1        2
  examples/messy/src/wallet/connect.ts              code  0          0      2        1
  examples/messy/src/wallet/sign.ts                 code  0          1      2        0

Summary

  files: 12 read, 7 JavaScript or TypeScript, 4 JSON and 1 env
  addresses: 9 written, 5 distinct
  wallet calls: 3 signature requests, 0 transaction sends, 2 approvals

Rules (16)

  rule                  level    findings
  private-key           error    2
  seed-phrase           error    1
  rpc-url-key           warning  1
  unlimited-approval    warning  1
  eth-sign              error    1
  unstructured-signing  warning  1
  typed-data-domain     warning  1
  chain-not-checked     info     1
  address-checksum      warning  1
  address-repeated      info     2
  address-conflict      warning  1
  legacy-wallet-api     warning  2
  html-from-chain       warning  1
  low-confirmations     info     1
  unreadable-file       error    0
  scan-limit            error    0

Findings (17)

  ERROR    seed-phrase           examples/messy/.env.example:5
           DEPLOYER_MNEMONIC holds 12 words of the BIP-39 English list in a row in an env file of the repository, though they do not pass the BIP-39 checksum; the words are not shown
           fix: take the phrase out of the repository and out of its history, treat every account of it as known to everyone and move what they hold; a test that needs a phrase builds it at run time

  ERROR    private-key           examples/messy/.env.example:7
           RELAYER_PRIVATE_KEY holds a value of 64 hexadecimal digits that looks like a private key in an env file of the repository; the value is not shown
           fix: take the key out of the repository and out of its history, treat it as known to everyone and move what it holds to a new key; sign on a server or in the wallet of the user, never with a key shipped in a front end

  ERROR    private-key           examples/messy/scripts/seed-market.mjs:5
           a value of 64 hexadecimal digits that looks like a private key is given to SEEDER_KEY in the code; the value is not shown
           fix: take the key out of the repository and out of its history, treat it as known to everyone and move what it holds to a new key; sign on a server or in the wallet of the user, never with a key shipped in a front end

  ERROR    eth-sign              examples/messy/src/wallet/sign.ts:19
           the code asks the wallet for eth_sign, which in MetaMask signed any hash with no prefix, a transaction included, so a user could not see what was signed; MetaMask has removed the method
           fix: sign typed data with eth_signTypedData_v4 (EIP-712), or text the user can read with personal_sign

  WARNING  html-from-chain       examples/messy/src/components/NftCard.tsx:11
           dangerouslySetInnerHTML is given HTML built from metadata, a value that comes from token metadata or the chain, with no sanitizer in sight
           fix: show text with textContent or as a JSX child, or clean the HTML with a sanitizer such as DOMPurify right before it is set

  WARNING  address-conflict      examples/messy/src/config/staging/contracts.json:3
           MarketRouter on chain 1 is 0x4Aec56CbB6cc1C1849b27F883b97B2A9e8969e99 here and 0x24f8097B1994432e896001062ff6be5E53a6F170 at examples/messy/src/config/contracts.json:3; one of the two configurations sends users to the wrong contract
           fix: keep one map of addresses by chain id, or name the files so that each is used for one deployment only, and check which of the two addresses is the deployed one

  WARNING  address-checksum      examples/messy/src/lib/addresses.ts:2
           the address 0xa30A33DbBa2306021D3143805837911EE55e092C mixes upper and lower case but does not match the EIP-55 checksum, which is 0xa30A33dbBa2306021D3143805837911EE55e092C; a typo in one digit would read the same
           fix: check the address against its source, a digit may be wrong; then write it with its EIP-55 checksum, as getAddress of ethers or viem gives it

  WARNING  rpc-url-key           examples/messy/src/lib/rpc.ts:4
           an RPC address on eth-mainnet.rpcnode.test holds what looks like an API key in its path, written in the code that is shipped to the browser; the key is not shown
           fix: read the address from the environment at build time and keep the key out of the repository; for a front end, use a key restricted to your domains and methods, or send the calls through a server of your own, and rotate the key that was committed

  WARNING  unlimited-approval    examples/messy/src/trade/approve.ts:13
           approve gives the spender an allowance of the largest uint256, so the spender can move every token of the user, now and later
           fix: approve only the amount the next transaction needs, or let the user choose the amount and show it before the wallet opens

  WARNING  legacy-wallet-api     examples/messy/src/wallet/connect.ts:3
           window.web3 is the old injected web3 object; wallets inject an EIP-1193 provider as window.ethereum instead, and window.web3 is no longer there
           fix: use the EIP-1193 provider: ask for accounts with eth_requestAccounts when the user acts, and read them with eth_accounts after that

  WARNING  legacy-wallet-api     examples/messy/src/wallet/connect.ts:7
           ethereum.enable() is the deprecated way to ask for accounts; EIP-1102 replaces it with the eth_requestAccounts method
           fix: use the EIP-1193 provider: ask for accounts with eth_requestAccounts when the user acts, and read them with eth_accounts after that

  WARNING  typed-data-domain     examples/messy/src/wallet/sign.ts:9
           the domain given to signer.signTypedData has no chainId and no verifyingContract, so the signature can be replayed on another chain
           fix: put chainId and verifyingContract into the domain, the chain id of the chain the contract is on and the address of the contract that checks the signature

  WARNING  unstructured-signing  examples/messy/src/wallet/sign.ts:14
           personal_sign signs a message built from fields (JSON.stringify, a template with several values, or text joined to values); the wallet shows it as plain text that the user cannot check
           fix: sign the fields as EIP-712 typed data with eth_signTypedData_v4, so the wallet shows each field and the contract can check them; keep personal_sign for text such as a sign-in message

  INFO     address-repeated      examples/messy/src/lib/addresses.ts:2
           the address 0xa30A33DbBa2306021D3143805837911EE55e092C is written here and is also in examples/messy/src/config/contracts.json and 1 more; read it from that map, so a change of address is made once
           fix: keep the addresses in one map by chain and name, in a JSON file or one module, and read them from there

  INFO     address-repeated      examples/messy/src/trade/approve.ts:3
           the address 0x24f8097B1994432e896001062ff6be5E53a6F170 is written here and is also in examples/messy/.env.example and 1 more; read it from that map, so a change of address is made once
           fix: keep the addresses in one map by chain and name, in a JSON file or one module, and read them from there

  INFO     low-confirmations     examples/messy/src/trade/approve.ts:28
           tx.wait waits for 1 confirmation in a file that moves value, while confirmations at examples/messy/src/config/networks.json:3 asks for 3
           fix: pass the number of confirmations of the setting to the wait, so the app shows a transfer as done only when the setting says it is safe

  INFO     chain-not-checked     examples/messy/src/wallet/connect.ts:7
           this file asks the wallet for accounts or sends a transaction, and nothing in it reads the chain id, listens for chainChanged or switches the network, so a transaction can go to the chain the wallet happens to be on
           fix: read the chain id before a transaction, ask the wallet to switch when it differs (wallet_switchEthereumChain or switchChain), and listen for chainChanged; or pass the chain to the library call so that it checks it

note: 2 paths matching **/dist/**, **/build/**, **/.next/**, **/out/**, **/coverage/** and 5 more are left out
note: 1 folder named .git or node_modules is passed over

This check reads the source, JSON and env files on disk as text and runs nothing, calls no node and fetches nothing; the checks are a heuristic, and no secret value is shown. A finding is a lead with a file and a line for a review of how the app talks to wallets and chains, and a clean result is not a security audit and not a guarantee that the app is safe (docs/limits.md).

RESULT: FAIL - 4 findings at or above error (4 error, 9 warning, 4 info)
```

With `--explain`, each finding also shows the rule, the points of the public pages it rests on and the tool's own
choice:

```
  ERROR    private-key           examples/messy/.env.example:7
           RELAYER_PRIVATE_KEY holds a value of 64 hexadecimal digits that looks like a private key in an env file of the repository; the value is not shown
           fix: take the key out of the repository and out of its history, treat it as known to everyone and move what it holds to a new key; sign on a server or in the wallet of the user, never with a key shipped in a front end
           rule: a value of 64 hexadecimal digits that its name says is a private key
           basis: a recovery phrase or a private key is never to be shared for any reason, and never kept in digital form such as a screenshot (Ethereum security and scam prevention (ethereum.org), https://ethereum.org/security/)
           basis: secrets hard coded in source and configuration files are a common leak; .env files are not to be committed, and client-side code is not to hold secrets at all (Secrets Management Cheat Sheet (OWASP), https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
           basis: a secret that leaked is revoked and rotated, and removed from the code, the logs and the history (Secrets Management Cheat Sheet (OWASP), https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
           basis: an env file holds KEY=value lines, # starts a comment unless the value is quoted, and the file is not to be committed (dotenv (the README of the package), https://github.com/motdotla/dotenv)
           the tool's own choice: a value of 64 hexadecimal digits, with or without 0x, in a string, a fixed part of a template, a JSON string or an env value, where the name it is given to, its key, the call it is passed to or the object it sits in has a word of KEY_WORDS, or the word key and no word of NOT_KEY_WORDS (a hash, a topic, a slot or a role is a value of the same shape); a value whose digits are all the same is a placeholder; the value is never shown
```

The clean example passes:

```
dapp-frontend-check: examples/clean
input: 7 files read (3 code, 3 JSON, 1 env); 1 other file passed over; 0 folders named .git or node_modules passed over; 0 paths excluded; 0 links not followed
config: built-in defaults: include **/*.js, **/*.jsx, **/*.mjs, **/*.cjs, **/*.ts, **/*.tsx, **/*.mts, **/*.cts, **/*.json, **/.env and **/.env.*; exclude **/dist/**, **/build/**, **/.next/**, **/out/**, **/coverage/**, **/artifacts/**, **/cache/**, **/package-lock.json and **/npm-shrinkwrap.json; minimum severity info; fail on error
rules: private-key (error); seed-phrase (error); rpc-url-key (warning); unlimited-approval (warning); eth-sign (error); unstructured-signing (info); typed-data-domain (warning); chain-not-checked (info); address-checksum (warning); address-repeated (info); address-conflict (warning); legacy-wallet-api (warning); html-from-chain (warning); low-confirmations (info); unreadable-file (error); scan-limit (error)
findings: 0

Files (7)

  file                                          kind  addresses  error  warning  info
  examples/clean/.env.example                   env   0          0      0        0
  examples/clean/package.json                   json  0          0      0        0
  examples/clean/src/booth.ts                   code  0          0      0        0
  examples/clean/src/components/TicketCard.tsx  code  0          0      0        0
  examples/clean/src/config/contracts.json      json  2          0      0        0
  examples/clean/src/config/network.json        json  0          0      0        0
  examples/clean/src/wallet.ts                  code  0          0      0        0

Summary

  files: 7 read, 3 JavaScript or TypeScript, 3 JSON and 1 env
  addresses: 2 written, 2 distinct
  wallet calls: 2 signature requests, 2 transaction sends, 1 approval

Rules (16)

  rule                  level    findings
  private-key           error    0
  seed-phrase           error    0
  rpc-url-key           warning  0
  unlimited-approval    warning  0
  eth-sign              error    0
  unstructured-signing  info     0
  typed-data-domain     warning  0
  chain-not-checked     info     0
  address-checksum      warning  0
  address-repeated      info     0
  address-conflict      warning  0
  legacy-wallet-api     warning  0
  html-from-chain       warning  0
  low-confirmations     info     0
  unreadable-file       error    0
  scan-limit            error    0

Findings (0)

  none

This check reads the source, JSON and env files on disk as text and runs nothing, calls no node and fetches nothing; the checks are a heuristic, and no secret value is shown. A finding is a lead with a file and a line for a review of how the app talks to wallets and chains, and a clean result is not a security audit and not a guarantee that the app is safe (docs/limits.md).

RESULT: PASS - no finding at or above error
```

## How the files are read

1. The folder is listed with a list of folders of its own and no link followed; every file that an include pattern
   names (the JavaScript, TypeScript, JSON and env files by default) is read, the folders .git and node_modules are
   passed over, and the build output, caches and lock files and the paths of `--exclude` are left out.
2. Each file is decoded by its byte order mark (UTF-8 with or without one, UTF-16 with one). A file of code or JSON is
   read once by the lexer of src/lexer.js into tokens with their offsets, with comments, regular expressions and JSX
   text set aside and the value of every string kept; an env file is read line by line by src/envfile.js.
3. The checks of src/code.js run over the tokens of a file of code; src/settings.js reads the values of JSON and env
   files, with the maps of contract names to addresses by chain; src/strings.js reads every value for keys, phrases, RPC
   addresses and addresses.
4. src/project.js decides what needs the whole project: the checksum of every address, addresses written in several
   places, two addresses for one contract on one chain, `eth_accounts` with no request for accounts, and short waits
   against a setting of confirmations.

[docs/method.md](docs/method.md) gives the details, and
[decision 2](docs/decisions/0002-read-javascript-with-a-lexer-of-its-own-and-run-nothing.md) says why the files are
read with a lexer of the tool's own and nothing is run.

## What it reports

| Rule | Key | Default level | Finds |
| --- | --- | --- | --- |
| `private-key` | `rules.privateKey` | error | a value of 64 hexadecimal digits that its name says is a private key |
| `seed-phrase` | `rules.seedPhrase` | error | 12 or more words of the BIP-39 English list in a row |
| `rpc-url-key` | `rules.rpcUrlKey` | warning | an RPC address with what looks like an API key in its path, query or user part |
| `unlimited-approval` | `rules.unlimitedApproval` | warning | an approval or a permit whose amount is the largest uint256 |
| `eth-sign` | `rules.ethSign` | error | a request of eth_sign, or a call of x.eth.sign |
| `unstructured-signing` | `rules.unstructuredSigning` | info | personal_sign or signMessage of a message built from fields |
| `typed-data-domain` | `rules.typedDataDomain` | warning | a typed data domain literal with no chainId or no verifyingContract |
| `chain-not-checked` | `rules.chainCheck` | info | a file that connects a wallet or sends a transaction with no chain id, chainChanged or network switch in it |
| `address-checksum` | `rules.addressChecksum` | warning | a mixed-case address whose case does not match EIP-55 |
| `address-repeated` | `rules.addressRepeated` | info | an address in several files of code, or in the code and a configuration map |
| `address-conflict` | `rules.addressConflict` | warning | a contract name with two addresses for one chain id in two JSON files |
| `legacy-wallet-api` | `rules.legacyWalletApi` | warning | window.web3, ethereum.enable(), or eth_accounts with no request for accounts in the project |
| `html-from-chain` | `rules.htmlFromChain` | warning | an HTML sink fed from a name of token metadata or of the chain, with no sanitizer |
| `low-confirmations` | `rules.lowConfirmations` | info | a wait for 0 or 1 confirmation in a file that moves value, against a setting of 2 or more |
| `unreadable-file` | none | error | a file that the tool could not read |
| `scan-limit` | none | error | input past the limits of a run |

The two rules of input problems are always errors. Several rules are heuristics and say so: `unstructured-signing`,
`chain-not-checked`, `address-repeated`, `address-conflict`, `html-from-chain` and `low-confirmations` read the form of
the code and the names in it, not what the app does. [docs/method.md](docs/method.md) says exactly what each rule looks
at and what it cannot see, and [docs/rules-and-sources.md](docs/rules-and-sources.md) gives the points of the public
pages each rule rests on.

## Inputs and excluded paths

| Input | What is read |
| --- | --- |
| `*.js`, `*.jsx`, `*.mjs`, `*.cjs`, `*.ts`, `*.tsx`, `*.mts`, `*.cts` | the tokens of every file outside comments, regular expressions and JSX text, and the value of every string |
| `*.json` | every string with its keys, the maps of contracts by chain and the settings of confirmations, comments allowed |
| `.env`, `.env.*` | every `NAME=value` line, `.env.example` among them |
| `include` | the files to read, as patterns relative to the folder |
| `exclude` | paths left out, `**/dist/**`, `**/build/**`, `**/.next/**`, `**/out/**`, `**/coverage/**`, `**/artifacts/**`, `**/cache/**` and the lock files of npm by default |
| `--exclude <pattern>` | more paths left out, matched relative to the folder: `*` and `?` stay in one folder, `**` crosses folders, so `test/**` leaves the folder test out |

The folders .git and node_modules are never read, wherever they are. No import is followed, no package is installed
and no script of package.json is run. [docs/inputs.md](docs/inputs.md) describes every input.

## What is not checked

The tool reads the files it is given and never guesses. It does not:

- run or build the app, so the value of a variable, a message built in a function and an address read from an API are
  not seen;
- follow a name into another file: a domain, a message or an amount built in another module is not read;
- call a node or an RPC address it finds: whether an address holds the contract, and which chain a wallet is on, are not
  known;
- check a value it finds: whether a key holds funds, or an RPC key is restricted to a domain;
- read the templates of Vue, Svelte or Angular;
- read a date or the clock;
- say that an app is safe: it is not a security audit and not a guarantee that the app is safe.

So a clean run means the folder holds none of the forms the rules look for, and every report says so.

## The configuration file

```json
{
  "name": "Quillmere Market front end review",
  "exclude": ["**/dist/**", "**/build/**", "**/.next/**", "**/out/**", "**/coverage/**", "**/artifacts/**", "**/cache/**", "**/package-lock.json", "**/npm-shrinkwrap.json", "**/mocks/**"],
  "rules": { "unstructuredSigning": "warning" }
}
```

Every key is optional, and without `--config` the defaults apply. `include` lists the files to read and `exclude` the
paths to leave out, as patterns relative to the folder; `rules` sets the level of each rule (`info`, `warning`,
`error` or `off`); `minSeverity` sets the lowest level shown and `failOn` the lowest level that fails the run. A key the
tool does not know is an error with its line and a suggestion, and a key named twice is refused.
[docs/inputs.md](docs/inputs.md) describes every key, and `--print-defaults` writes the whole default configuration
out.

## Formats

- `text`: for a terminal: what was read, the configuration, the rules, the files, the summary, the count of every rule,
  the findings with the file and line and what to change, the notes, the notice and the result. With `--explain` also
  the rule, the points of the public pages and the tool's own choice behind each finding.
- `json` (or `--json`): the whole report: the input, the configuration, the files, the summary, the counts per rule,
  every finding with its file, line and column, the totals, the result, the notes and the notice.
- `csv`: one record per finding, ready for a sheet: the level, the rule, the file, the line, the column, what was found
  and what to change, with CRLF line ends as RFC 4180 writes. A field that a spreadsheet could read as a formula gets a
  single quote in front. The start of the messy example:

```
level,rule,file,line,column,found,fix
error,seed-phrase,examples/messy/.env.example,5,20,"DEPLOYER_MNEMONIC holds 12 words of the BIP-39 English list in a row in an env file of the repository, though they do not pass the BIP-39 checksum; the words are not shown","take the phrase out of the repository and out of its history, treat every account of it as known to everyone and move what they hold; a test that needs a phrase builds it at run time"
error,private-key,examples/messy/.env.example,7,21,RELAYER_PRIVATE_KEY holds a value of 64 hexadecimal digits that looks like a private key in an env file of the repository; the value is not shown,"take the key out of the repository and out of its history, treat it as known to everyone and move what it holds to a new key; sign on a server or in the wallet of the user, never with a key shipped in a front end"
error,private-key,examples/messy/scripts/seed-market.mjs,5,53,a value of 64 hexadecimal digits that looks like a private key is given to SEEDER_KEY in the code; the value is not shown,"take the key out of the repository and out of its history, treat it as known to everyone and move what it holds to a new key; sign on a server or in the wallet of the user, never with a key shipped in a front end"
```

- `github`: one workflow command per finding, `::error`, `::warning` or `::notice` (for info) with the file, line and
  column, which GitHub shows as an annotation in the pull request, then a summary line. The characters a command gives
  a meaning to are escaped. Two findings of the messy example:

```
::warning file=examples/messy/src/trade/approve.ts,line=13,col=26,title=dapp-frontend-check unlimited-approval::approve gives the spender an allowance of the largest uint256, so the spender can move every token of the user, now and later; fix: approve only the amount the next transaction needs, or let the user choose the amount and show it before the wallet opens
::warning file=examples/messy/src/wallet/sign.ts,line=9,col=17,title=dapp-frontend-check typed-data-domain::the domain given to signer.signTypedData has no chainId and no verifyingContract, so the signature can be replayed on another chain; fix: put chainId and verifyingContract into the domain, the chain id of the chain the contract is on and the address of the contract that checks the signature
```

No format shows the value of a key, a phrase or the key of an RPC address. There is no SARIF format, as in the other
checks of this family; the GitHub annotations show each finding on its line in a pull request.

## Exit codes

`0`: no finding at or above the fail-on level (`error` by default). `1`: at least one finding at or above it; with the
default, a value that looks like a private key or a seed phrase, `eth_sign`, or a file the tool could not read; with
`--fail-on warning`, the warnings too. `2`: a usage or input error: no folder named, two folders named, an unknown
option, an option given twice, `--explain` with the csv or github format, a URL in place of a path, a folder that is a
file or is missing, a symbolic link, an `--exclude` pattern that is not valid, or a configuration with an unknown key, a
key named twice or a value of the wrong kind. With exit code `2` the tool gives no result and prints the problems on
standard error.

## Limits

The tool reads files; it fetches nothing and connects to nothing. A run reports the forms of docs/method.md that the
folder holds. [docs/limits.md](docs/limits.md) lists what it cannot see, with the size limits: 4 MB for a file, 50,000
files and folders listed, folders nested up to 32 deep, 5,000 files to read, 400,000 tokens in a file, names of 1,024
characters, templates, JSX elements and JSON values nested up to 256 deep, 500 findings listed per rule.
[docs/threat-model.md](docs/threat-model.md) lists the risks of reading these files from a pull request and their
controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the configuration, lists the folder, reads every file, runs the checks and builds the report of the run |
| `src/walk.js`, `src/files.js` | the listing of the folder with no link followed, and the bounded reading of files by their byte order mark |
| `src/lexer.js` | the JavaScript and TypeScript lexer: comments, regular expressions and JSX text set aside, strings and templates kept with their values, brackets matched once |
| `src/tree.js`, `src/envfile.js` | the forgiving reader of JSON files and the reader of env files |
| `src/keccak.js` | Keccak-256 and the EIP-55 checksum |
| `src/bip39.js`, `src/wordlist.js` | seed phrases and their checksum, and the BIP-39 English list |
| `src/strings.js` | keys, phrases, RPC addresses with keys and addresses in a value, and the tables of names they compare |
| `src/code.js` | the checks of a file of code, and the tables of names they compare |
| `src/settings.js` | the checks of JSON and env files, and the maps of contracts by chain |
| `src/project.js` | the checks that need the whole project |
| `src/glob.js` | the path patterns |
| `src/config.js`, `src/defaults.js` | the configuration file over the defaults |
| `src/rules.js` | the rules, their levels and the result |
| `src/report.js`, `src/csv.js`, `src/json.js`, `src/text.js`, `src/size.js`, `src/words.js` | the text, JSON, CSV and GitHub output, the strict JSON reader of the configuration, the cleaning of text from the input, number formats and compared words |
| `src/data.js` | the public pages and the points the rules rest on, in this project's own words |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

| Fact | Source |
| --- | --- |
| The mixed-case checksum of addresses and its test addresses | EIP-55, https://eips.ethereum.org/EIPS/eip-55 |
| Typed data, the fields of its domain, and why it beats an opaque string | EIP-712, https://eips.ethereum.org/EIPS/eip-712 |
| The provider API, chainChanged and the legacy API | EIP-1193, https://eips.ethereum.org/EIPS/eip-1193 |
| eth_requestAccounts, the deprecated ethereum.enable() and the old injected providers | EIP-1102, https://eips.ethereum.org/EIPS/eip-1102 |
| Permits | ERC-2612, https://eips.ethereum.org/EIPS/eip-2612 |
| approve and allowances | ERC-20, https://eips.ethereum.org/EIPS/eip-20 |
| The chain id in what a transaction signs | EIP-155, https://eips.ethereum.org/EIPS/eip-155 |
| tokenURI and the metadata of a token | ERC-721, https://eips.ethereum.org/EIPS/eip-721 |
| Mnemonics, their lengths and their checksum | BIP-39, https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki |
| The English word list | BIP-39, https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt |
| eth_sign, eth_chainId and eth_accounts | ethereum.org, https://ethereum.org/developers/docs/apis/json-rpc/ |
| Keys and phrases never shared, approvals limited | ethereum.org, https://ethereum.org/security/ |
| Seed phrases kept offline | ethereum.org, https://ethereum.org/wallets/ |
| Finality after about two epochs | ethereum.org, https://ethereum.org/developers/docs/consensus-mechanisms/pos/ |
| eth_signTypedData_v4, personal_sign and the deprecation of eth_sign | MetaMask, https://docs.metamask.io/metamask-connect/evm/guides/sign-data/ |
| The removal of eth_sign | MetaMask, https://github.com/MetaMask/metamask-improvement-proposals/blob/main/MIPs/mip-3.md |
| eth_requestAccounts and eth_accounts | MetaMask, https://docs.metamask.io/metamask-connect/evm/reference/json-rpc-api/eth_requestAccounts/ and https://docs.metamask.io/metamask-connect/evm/reference/json-rpc-api/eth_accounts/ |
| The provider, chainChanged and switching networks | MetaMask, https://docs.metamask.io/metamask-connect/evm/reference/provider-api/ and https://docs.metamask.io/metamask-connect/evm/guides/manage-networks/ |
| MaxUint256, wait and waitForTransaction | ethers, https://docs.ethers.org/v6/api/constants/ and https://docs.ethers.org/v6/api/providers/ |
| waitForTransactionReceipt and signTypedData | viem, https://viem.sh/docs/actions/public/waitForTransactionReceipt and https://viem.sh/docs/actions/wallet/signTypedData |
| Secrets in source, env files and client-side code | OWASP, https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html |
| innerHTML, document.write and sanitizers | OWASP, https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html |
| dangerouslySetInnerHTML | React, https://react.dev/reference/react-dom/components/common |
| Division or regular expression, and template literals | ECMAScript, https://tc39.es/ecma262/ |
| JSX and type assertions in .tsx files | TypeScript, https://www.typescriptlang.org/docs/handbook/jsx.html |
| The form of env files | dotenv, https://github.com/motdotla/dotenv |
| The CSV format | RFC 4180, https://www.rfc-editor.org/rfc/rfc4180 |
| Repeated names in a JSON object, and UTF-8 | RFC 8259, https://www.rfc-editor.org/rfc/rfc8259 |
| Formulas hidden in CSV files | OWASP, https://community.owasp.org/attacks/CSV_Injection |
| Annotations from workflow commands | GitHub Docs, https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands |

[research/sources.md](research/sources.md) has a note on each page, in this project's own words.

## Background

A decentralized app moves value through the wallets of its users, so the front end decides more than how a page looks:
what a wallet is asked to sign, for how much, on which chain and against which address, and whether a key that should
never leave a server was committed with the code. These patterns are read side by side when a team reviews how its app
talks to wallets and chains, or brings in engineers to build or review it. How such work is staffed and carried out is
described on the page [Blockchain Software Development Services](https://innerluxes.dev/blockchain/development/services).

## License

MIT
