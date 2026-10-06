# Changes

## 1.0.0

First release.

- Lists risky Web3 integration patterns in the front end or off-chain service of a decentralized app, with file, line
  and column, as an input to a review of how the app talks to wallets and chains: every file that an include pattern
  names (the JavaScript, TypeScript, JSON and env files by default), with .git and node_modules passed over, `dist`,
  `build`, `.next`, `out`, `coverage`, `artifacts`, `cache` and the lock files of npm left out by default and
  `--exclude` patterns left out. Runs nothing, calls no node, fetches nothing, follows no symbolic link and no import,
  and reads no clock.
- Never shows a secret value: a private key, a seed phrase and the key of an RPC address are named by where they are,
  in every format.
- A JavaScript and TypeScript lexer with no dependency that sets comments, regular expressions and the text of JSX
  elements aside, keeps the value of every string and the fixed parts of every template, decides a slash from the
  token before it, reads JSX in JavaScript and `.tsx` files only, and keeps a stack of its own with limits of tokens,
  names and nesting.
- A forgiving reader of JSON files with comments and trailing commas, a reader of env files, Keccak-256 and the
  checksum of EIP-55 tested against the test addresses of the EIP, and the BIP-39 English list with its checksum,
  tested against the SHA-256 of the published list.
- Fourteen rules in three levels: values that look like private keys (`private-key`) or seed phrases (`seed-phrase`),
  RPC addresses with an API key (`rpc-url-key`), approvals and permits for the largest uint256 (`unlimited-approval`),
  `eth_sign` (`eth-sign`), messages built from fields and signed as text (`unstructured-signing`), typed data domains
  with no chainId or verifyingContract (`typed-data-domain`), wallet code with no chain check (`chain-not-checked`),
  addresses that fail the EIP-55 checksum (`address-checksum`), addresses written in several places
  (`address-repeated`), one contract name with two addresses for one chain (`address-conflict`), `window.web3`,
  `ethereum.enable()` and `eth_accounts` with no request for accounts (`legacy-wallet-api`), HTML built from token
  metadata (`html-from-chain`) and waits for one confirmation against a setting of more (`low-confirmations`); and two
  rules of input problems that cannot be lowered (`unreadable-file`, `scan-limit`).
- A table of the files with their kind, addresses and findings, and a summary of the files, the addresses and the
  signature requests, transaction sends and approvals.
- A configuration file in strict JSON over documented defaults: the files to read, the paths left out, the level of
  every rule, the minimum severity and the level that fails the run; a key the tool does not know is an error with its
  line and a suggestion, and a key named twice is refused.
- Reports as text, JSON, CSV with one row per finding (`--format csv`) and GitHub workflow commands (`--format github`)
  that show each finding as an annotation; every finding has its file, line and column; `--min-severity`, `--fail-on`,
  `--explain` with the rule, the sources and the tool's own choice, and `--print-defaults`. Exit code `0` when no
  finding is at or above the fail-on level, `1` when one is, `2` for a usage or input error, with no result.
- An input to a review of how the app talks to wallets and chains, not a security audit and not a guarantee that the
  app is safe: every report says so.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
