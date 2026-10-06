# Rules and sources

Every rule rests on points of public pages, written in this project's own words; this document lists them, with the
choices that are the tool's own and what to change. The same points are in src/data.js and are shown by `--explain`;
research/sources.md has a longer note on each page. The tool reads the source, JSON and env files on disk as text and
runs nothing: a point says what a page says, and a finding says what a file holds. The result is an input to a review
of how the app talks to wallets and chains, not a security audit and not a guarantee that the app is safe.

## The rules

| Rule | Default level | Points |
| --- | --- | --- |
| `private-key` | error | `keysNeverShared`, `secretsNotInCode`, `secretsRotate`, `dotenvFormat` |
| `seed-phrase` | error | `bip39Phrase`, `bip39List`, `keysNeverShared`, `phraseOffline`, `secretsNotInCode` |
| `rpc-url-key` | warning | `secretsNotInCode`, `secretsRotate` |
| `unlimited-approval` | warning | `limitApprovals`, `eip20Approve`, `eip2612Permit`, `ethersMax` |
| `eth-sign` | error | `mmEthSignRemoved`, `mmTypedData`, `ethSignPrefix` |
| `unstructured-signing` | info | `eip712Readable`, `mmTypedData` |
| `typed-data-domain` | warning | `eip712Domain`, `eip712NoReplay`, `eip155ChainId`, `viemTypedData` |
| `chain-not-checked` | info | `eip1193ChainChanged`, `mmChainChanged`, `mmSwitch`, `eip155ChainId` |
| `address-checksum` | warning | `eip55Checksum` |
| `address-repeated` | info | `eip155ChainId` |
| `address-conflict` | warning | `eip155ChainId` |
| `legacy-wallet-api` | warning | `eip1102Request`, `eip1102Legacy`, `eip1193Legacy`, `mmEthAccounts`, `mmRequestAccounts` |
| `html-from-chain` | warning | `xssSinks`, `reactDangerous`, `eip721Metadata` |
| `low-confirmations` | info | `ethersWait`, `viemWaitConfirmations`, `finality` |
| `unreadable-file` | error, always | `jsonUtf8`, `jsonRepeatedNames` |
| `scan-limit` | error, always | `lexical`, `tsxAssertions` |

### `private-key`

A value that looks like a private key in the code, a JSON file or an env file.

- `keysNeverShared` (Ethereum security and scam prevention (ethereum.org)): a recovery phrase or a private key is never to be shared for any reason, and never kept in digital form such as a screenshot.
- `secretsNotInCode` (Secrets Management Cheat Sheet (OWASP)): secrets hard coded in source and configuration files are a common leak; .env files are not to be committed, and client-side code is not to hold secrets at all.
- `secretsRotate` (Secrets Management Cheat Sheet (OWASP)): a secret that leaked is revoked and rotated, and removed from the code, the logs and the history.
- `dotenvFormat` (dotenv (the README of the package)): an env file holds KEY=value lines, # starts a comment unless the value is quoted, and the file is not to be committed.

The tool's own choice: a value of 64 hexadecimal digits, with or without 0x, in a string, a fixed part of a template, a JSON string or an env value, where the name it is given to, its key, the call it is passed to or the object it sits in has a word of KEY_WORDS, or the word key and no word of NOT_KEY_WORDS (a hash, a topic, a slot or a role is a value of the same shape); a value whose digits are all the same is a placeholder; the value is never shown.

What to change: take the key out of the repository and out of its history, treat it as known to everyone and move what it holds to a new key; sign on a server or in the wallet of the user, never with a key shipped in a front end.

### `seed-phrase`

A run of words that looks like a seed phrase.

- `bip39Phrase` (BIP-39: Mnemonic code for generating deterministic keys (Bitcoin Improvement Proposals)): a mnemonic has 12, 15, 18, 21 or 24 words of a list of 2,048, each standing for 11 bits, and its last bits are a checksum taken from the SHA-256 hash of the entropy.
- `bip39List` (The BIP-39 English word list, english.txt (Bitcoin Improvement Proposals)): the English word list holds 2,048 words in a fixed order, one per line, and the index of a word is its place in the list.
- `keysNeverShared` (Ethereum security and scam prevention (ethereum.org)): a recovery phrase or a private key is never to be shared for any reason, and never kept in digital form such as a screenshot.
- `phraseOffline` (Ethereum wallets (ethereum.org)): the seed phrase of a wallet is written down and kept offline, never on a computer, because whoever holds it holds the account.
- `secretsNotInCode` (Secrets Management Cheat Sheet (OWASP)): secrets hard coded in source and configuration files are a common leak; .env files are not to be committed, and client-side code is not to hold secrets at all.

The tool's own choice: 12 or more words in a row, all of the BIP-39 English list, in a string, a fixed part of a template, a JSON string or an env value; the report says whether the BIP-39 checksum of the phrase holds, and a run whose checksum fails is still reported, because it may be a real phrase with one word changed; the words are never shown.

What to change: take the phrase out of the repository and out of its history, treat every account of it as known to everyone and move what they hold; a test that needs a phrase builds it at run time.

### `rpc-url-key`

An RPC address with an API key in it, committed in source.

- `secretsNotInCode` (Secrets Management Cheat Sheet (OWASP)): secrets hard coded in source and configuration files are a common leak; .env files are not to be committed, and client-side code is not to hold secrets at all.
- `secretsRotate` (Secrets Management Cheat Sheet (OWASP)): a secret that leaked is revoked and rotated, and removed from the code, the logs and the history.

The tool's own choice: an http, https, ws or wss address with a path part of 20 or more letters, digits, - and _ that holds letters and digits, a query parameter of KEY_PARAMS with a value of 8 or more characters, or a password before the host, where the host or the path has a word of RPC_HOST_WORDS or the name around it a word of RPC_WORDS; a key that comes from ${...} is not seen; only the host is shown.

What to change: read the address from the environment at build time and keep the key out of the repository; for a front end, use a key restricted to your domains and methods, or send the calls through a server of your own, and rotate the key that was committed.

### `unlimited-approval`

An approval or a permit for the largest uint256.

- `limitApprovals` (Ethereum security and scam prevention (ethereum.org)): an unlimited spending limit lets a contract take every token of the kind from the wallet, so approvals are to be limited to what the transaction needs.
- `eip20Approve` (ERC-20: Token Standard (Ethereum Improvement Proposals)): approve lets the spender withdraw from the account again and again, up to the value given.
- `eip2612Permit` (ERC-2612: Permit Extension for EIP-20 Signed Approvals (Ethereum Improvement Proposals)): a permit is a signed message with owner, spender, value, nonce and deadline that sets an allowance like approve does, bound to the token by its domain.
- `ethersMax` (Constants (ethers v6 documentation)): MaxUint256 is the constant for the largest value of a uint256.

The tool's own choice: x.approve(spender, amount) or x.increaseAllowance(spender, amount), approve named by functionName with args of viem or wagmi or by encodeFunctionData of ethers, and a value or amount of the typed data of a permit, where the amount is a name of UNLIMITED_NAMES at the end of a member chain, 2**256 - 1, (1 << 256) - 1, the same in BigInt, 64 f digits or the decimal number, or a name declared in the file as one of these.

What to change: approve only the amount the next transaction needs, or let the user choose the amount and show it before the wallet opens.

### `eth-sign`

Eth_sign asked of the wallet.

- `mmEthSignRemoved` (MIP-3: Remove eth_sign (MetaMask Improvement Proposals)): eth_sign lets a site have a user blindly sign any hash, a transaction included, so MetaMask removes the method and answers it with an error.
- `mmTypedData` (Sign data (MetaMask documentation)): eth_signTypedData_v4 gives the most readable signatures that are efficient to check on chain, personal_sign suits text such as Sign-In with Ethereum, and eth_sign is deprecated.
- `ethSignPrefix` (JSON-RPC API (ethereum.org)): eth_sign signs with the prefix of an Ethereum signed message, eth_chainId returns the chain id used for replay protection, and eth_accounts returns the addresses of the client.

The tool's own choice: the string eth_sign as a whole value, as the method of a request, and a call of web3.eth.sign or of any x.eth.sign.

What to change: sign typed data with eth_signTypedData_v4 (EIP-712), or text the user can read with personal_sign.

### `unstructured-signing`

A message signed as text that is built from fields.

- `eip712Readable` (EIP-712: Typed structured data hashing and signing (Ethereum Improvement Proposals)): typed data lets a wallet show the fields of a message to the user, where a signature of an opaque string of bytes shows nothing the user can check.
- `mmTypedData` (Sign data (MetaMask documentation)): eth_signTypedData_v4 gives the most readable signatures that are efficient to check on chain, personal_sign suits text such as Sign-In with Ethereum, and eth_sign is deprecated.

The tool's own choice: personal_sign, signMessage or signMessageAsync, or x.personal.sign, whose message (the first parameter, the first argument or the message key) holds a call of JSON.stringify, a template with two or more ${...}, or text joined with + more than once; a Sign-In with Ethereum message, by its fixed text or a SiweMessage, is left out, and a message held in a name declared elsewhere is not followed.

What to change: sign the fields as EIP-712 typed data with eth_signTypedData_v4, so the wallet shows each field and the contract can check them; keep personal_sign for text such as a sign-in message.

### `typed-data-domain`

Typed data whose domain has no chainId or no verifyingContract.

- `eip712Domain` (EIP-712: Typed structured data hashing and signing (Ethereum Improvement Proposals)): the domain of typed data names the signing domain with name, version, chainId, verifyingContract and salt; a wallet should refuse to sign when chainId does not match the active chain, and verifyingContract names the contract that checks the signature.
- `eip712NoReplay` (EIP-712: Typed structured data hashing and signing (Ethereum Improvement Proposals)): the standard itself has no replay protection, so the application has to bind the signature to its chain and contract and refuse a message it has seen.
- `eip155ChainId` (EIP-155: Simple replay attack protection (Ethereum Improvement Proposals)): the chain id is part of what a transaction signs, so that a transaction for one chain cannot be replayed on another.
- `viemTypedData` (signTypedData (viem documentation)): signTypedData of viem takes the domain, the types, the primary type and the message of an EIP-712 signature in one object.

The tool's own choice: signTypedData, _signTypedData or signTypedDataAsync called with a domain object literal (the first argument, or the domain key of an object argument, or a name declared in the file as one) that has no chainId or no verifyingContract key, or with an object that has types, primaryType or message and no domain; an eth_signTypedData request whose domain key holds such a literal; a domain built elsewhere or with a spread is not read.

What to change: put chainId and verifyingContract into the domain, the chain id of the chain the contract is on and the address of the contract that checks the signature.

### `chain-not-checked`

Wallet code that never looks at the chain.

- `eip1193ChainChanged` (EIP-1193: Ethereum Provider JavaScript API (Ethereum Improvement Proposals)): a provider emits chainChanged with the new chain id when the chain it is connected to changes, and the request method is the way to call the provider.
- `mmChainChanged` (Ethereum provider API (MetaMask documentation)): the provider of MetaMask follows EIP-1193 and emits chainChanged with a hexadecimal chain id, which an application listens to for the network of the user.
- `mmSwitch` (Manage networks (MetaMask documentation)): an application reads the current chain, listens for chainChanged and asks the wallet to switch networks, and handles a user who rejects the switch.
- `eip155ChainId` (EIP-155: Simple replay attack protection (Ethereum Improvement Proposals)): the chain id is part of what a transaction signs, so that a transaction for one chain cannot be replayed on another.

The tool's own choice: a file that asks for accounts (eth_requestAccounts, requestAddresses, ethereum.enable(), connect with a connector) or sends a transaction (eth_sendTransaction, sendTransaction, writeContract), with no name or string of CHAIN_WORDS anywhere in it; the first such place is reported; a check in another file, or in a library that checks the chain for you, is not seen, so this is a note.

What to change: read the chain id before a transaction, ask the wallet to switch when it differs (wallet_switchEthereumChain or switchChain), and listen for chainChanged; or pass the chain to the library call so that it checks it.

### `address-checksum`

A mixed-case address that fails the EIP-55 checksum.

- `eip55Checksum` (ERC-55: Mixed-case checksum address encoding (Ethereum Improvement Proposals)): an address is checksummed by hashing its 40 lowercase digits with Keccak-256 and writing each letter in upper case where the digit of the hash at its place is 8 or more; all lower and all upper case stay valid with no checksum.

The tool's own choice: an address of 40 hexadecimal digits after 0x, in a string, a JSON file or an env file, with upper and lower case letters that do not match the checksum of EIP-55, worked out with the Keccak-256 of the tool itself; an address all in lower or all in upper case has no checksum and is not reported; the report names the address with its right checksum.

What to change: check the address against its source, a digit may be wrong; then write it with its EIP-55 checksum, as getAddress of ethers or viem gives it.

### `address-repeated`

An address written into the code in several places instead of one map.

- `eip155ChainId` (EIP-155: Simple replay attack protection (Ethereum Improvement Proposals)): the chain id is part of what a transaction signs, so that a transaction for one chain cannot be replayed on another.

The tool's own choice: an address written in the code that is also in a JSON or env file of the project, or written in two files of code or more; the first file of code in the order of the paths is taken as the home of the address and the others are reported; the zero address and other addresses of one repeated digit are left out.

What to change: keep the addresses in one map by chain and name, in a JSON file or one module, and read them from there.

### `address-conflict`

One contract name mapped to two addresses for one chain.

- `eip155ChainId` (EIP-155: Simple replay attack protection (Ethereum Improvement Proposals)): the chain id is part of what a transaction signs, so that a transaction for one chain cannot be replayed on another.

The tool's own choice: two JSON files that map the same contract name (the key that holds the address, or the name next to an address key) to two addresses for the same chain (a key that is a number, or a chainId next to it); the first file in the order of the paths is the reference, and maps by chain name rather than chain id are not read; two settings for staging and production can differ on purpose, which a person has to judge.

What to change: keep one map of addresses by chain id, or name the files so that each is used for one deployment only, and check which of the two addresses is the deployed one.

### `legacy-wallet-api`

An old way to reach the wallet.

- `eip1102Request` (EIP-1102: Opt-in account exposure (Ethereum Improvement Proposals)): a dapp asks for accounts with the eth_requestAccounts method, which may show the user a prompt, and ethereum.enable() is deprecated in its favour.
- `eip1102Legacy` (EIP-1102: Opt-in account exposure (Ethereum Improvement Proposals)): the previous generation of browsers injected a provider with accounts and no consent of the user, which let any site see the accounts and start transactions.
- `eip1193Legacy` (EIP-1193: Ethereum Provider JavaScript API (Ethereum Improvement Proposals)): the legacy provider API, with send and sendAsync, is kept in an appendix only for old applications, and its authors advise against implementing it.
- `mmEthAccounts` (eth_accounts (MetaMask documentation)): eth_accounts returns only the addresses the user has already allowed, and eth_requestAccounts is the advised way to get that permission.
- `mmRequestAccounts` (eth_requestAccounts (MetaMask documentation)): eth_requestAccounts asks the user for access to addresses and returns the addresses the user allowed.

The tool's own choice: window.web3, the old injected object; ethereum.enable() (or window.ethereum.enable()); and the string eth_accounts in a project where nothing asks for accounts (no eth_requestAccounts, wallet_requestPermissions, requestAddresses, getSigner, useConnect or connect with a connector); web3.js as a library is not reported.

What to change: use the EIP-1193 provider: ask for accounts with eth_requestAccounts when the user acts, and read them with eth_accounts after that.

### `html-from-chain`

HTML built from token metadata or values of the chain.

- `xssSinks` (Cross Site Scripting Prevention Cheat Sheet (OWASP)): innerHTML, outerHTML and document.write treat their value as HTML, so a variable is not to be put there, and HTML that must be shown is cleaned first, such as with DOMPurify.
- `reactDangerous` (Common components, dangerouslySetInnerHTML (React documentation)): dangerouslySetInnerHTML takes raw HTML in __html, and HTML that does not come from a fully trusted source opens the page to cross-site scripting.
- `eip721Metadata` (ERC-721: Non-Fungible Token Standard (Ethereum Improvement Proposals)): the tokenURI of a token points to metadata JSON with a name, a description and an image that the contract decides, and the URI may change over time.

The tool's own choice: dangerouslySetInnerHTML with __html, x.innerHTML or x.outerHTML set with = or +=, insertAdjacentHTML and document.write, whose value holds a name with a word of CHAIN_DATA_WORDS (metadata, uri, nft, ens, token, description and the others of docs/method.md) and no call with a word of SANITIZE_WORDS; a heuristic on names: a value from the chain held in a name with other words is not seen.

What to change: show text with textContent or as a JSX child, or clean the HTML with a sanitizer such as DOMPurify right before it is set.

### `low-confirmations`

A wait for zero or one confirmation where a setting asks for more.

- `ethersWait` (Providers (ethers v6 documentation)): wait and waitForTransaction take a number of confirmations, one by default, and with zero they may return before the transaction is mined.
- `viemWaitConfirmations` (waitForTransactionReceipt (viem documentation)): waitForTransactionReceipt takes the number of confirmations to wait for, one by default.
- `finality` (Proof-of-stake (ethereum.org)): a block is final only after about two epochs, when two checkpoints are justified in a row; until then a short reorganization of the chain can still drop it.

The tool's own choice: tx.wait(), tx.wait(0) or tx.wait(1), waitForTransaction and waitForTransactionReceipt with no confirmations or 0 or 1 (the libraries wait for one by default), in a file that moves value (approve, transfer, parseEther, sendTransaction, writeContract or a value key), in a project where a JSON key, an env name or a constant named confirmations sets 2 or more; a number held in a name is not read.

What to change: pass the number of confirmations of the setting to the wait, so the app shows a transfer as done only when the setting says it is safe.

### `unreadable-file`

A file that cannot be read.

- `jsonUtf8` (RFC 8259, The JSON Data Interchange Format): JSON text exchanged between systems must be UTF-8.
- `jsonRepeatedNames` (RFC 8259, The JSON Data Interchange Format): when an object repeats a name the behavior of the software that reads it cannot be predicted, so the JSON reader of this tool refuses a repeated name.

The tool's own choice: a file over its size limit, a binary file, or a file that is not valid UTF-8, or UTF-16 with its byte order mark; nothing in it is checked; this rule cannot be set lower or off.

What to change: save the file as UTF-8; a file larger than the limit can be checked with a larger limit in a run of its own.

### `scan-limit`

The input is larger than the limits of a run.

- `lexical` (ECMAScript Language Specification, lexical grammar (TC39)): whether a slash starts a division or a regular expression literal depends on where it stands, and template literals have substitutions in ${...} between their fixed parts.
- `tsxAssertions` (JSX (TypeScript Handbook)): in a .tsx file an angle bracket starts JSX, so the type assertion <T>x is not allowed there and as is used instead.

The tool's own choice: a folder with more files, folders or files to read than the limits of docs/limits.md, folders nested deeper, or a file past the limits of the lexer (tokens, names, nesting); the rest is not read, so the run fails; this rule cannot be set lower or off.

What to change: exclude the folders that are not code of the project, such as bundles and vendored files, or check the parts of the project in runs of their own.

## The points

| Point | Page | What it says |
| --- | --- | --- |
| `eip55Checksum` | ERC-55: Mixed-case checksum address encoding (Ethereum Improvement Proposals) | an address is checksummed by hashing its 40 lowercase digits with Keccak-256 and writing each letter in upper case where the digit of the hash at its place is 8 or more; all lower and all upper case stay valid with no checksum |
| `eip712Domain` | EIP-712: Typed structured data hashing and signing (Ethereum Improvement Proposals) | the domain of typed data names the signing domain with name, version, chainId, verifyingContract and salt; a wallet should refuse to sign when chainId does not match the active chain, and verifyingContract names the contract that checks the signature |
| `eip712Readable` | EIP-712: Typed structured data hashing and signing (Ethereum Improvement Proposals) | typed data lets a wallet show the fields of a message to the user, where a signature of an opaque string of bytes shows nothing the user can check |
| `eip712NoReplay` | EIP-712: Typed structured data hashing and signing (Ethereum Improvement Proposals) | the standard itself has no replay protection, so the application has to bind the signature to its chain and contract and refuse a message it has seen |
| `eip1193ChainChanged` | EIP-1193: Ethereum Provider JavaScript API (Ethereum Improvement Proposals) | a provider emits chainChanged with the new chain id when the chain it is connected to changes, and the request method is the way to call the provider |
| `eip1193Legacy` | EIP-1193: Ethereum Provider JavaScript API (Ethereum Improvement Proposals) | the legacy provider API, with send and sendAsync, is kept in an appendix only for old applications, and its authors advise against implementing it |
| `eip1102Request` | EIP-1102: Opt-in account exposure (Ethereum Improvement Proposals) | a dapp asks for accounts with the eth_requestAccounts method, which may show the user a prompt, and ethereum.enable() is deprecated in its favour |
| `eip1102Legacy` | EIP-1102: Opt-in account exposure (Ethereum Improvement Proposals) | the previous generation of browsers injected a provider with accounts and no consent of the user, which let any site see the accounts and start transactions |
| `eip2612Permit` | ERC-2612: Permit Extension for EIP-20 Signed Approvals (Ethereum Improvement Proposals) | a permit is a signed message with owner, spender, value, nonce and deadline that sets an allowance like approve does, bound to the token by its domain |
| `eip20Approve` | ERC-20: Token Standard (Ethereum Improvement Proposals) | approve lets the spender withdraw from the account again and again, up to the value given |
| `eip155ChainId` | EIP-155: Simple replay attack protection (Ethereum Improvement Proposals) | the chain id is part of what a transaction signs, so that a transaction for one chain cannot be replayed on another |
| `eip721Metadata` | ERC-721: Non-Fungible Token Standard (Ethereum Improvement Proposals) | the tokenURI of a token points to metadata JSON with a name, a description and an image that the contract decides, and the URI may change over time |
| `bip39Phrase` | BIP-39: Mnemonic code for generating deterministic keys (Bitcoin Improvement Proposals) | a mnemonic has 12, 15, 18, 21 or 24 words of a list of 2,048, each standing for 11 bits, and its last bits are a checksum taken from the SHA-256 hash of the entropy |
| `bip39List` | The BIP-39 English word list, english.txt (Bitcoin Improvement Proposals) | the English word list holds 2,048 words in a fixed order, one per line, and the index of a word is its place in the list |
| `ethSignPrefix` | JSON-RPC API (ethereum.org) | eth_sign signs with the prefix of an Ethereum signed message, eth_chainId returns the chain id used for replay protection, and eth_accounts returns the addresses of the client |
| `keysNeverShared` | Ethereum security and scam prevention (ethereum.org) | a recovery phrase or a private key is never to be shared for any reason, and never kept in digital form such as a screenshot |
| `limitApprovals` | Ethereum security and scam prevention (ethereum.org) | an unlimited spending limit lets a contract take every token of the kind from the wallet, so approvals are to be limited to what the transaction needs |
| `phraseOffline` | Ethereum wallets (ethereum.org) | the seed phrase of a wallet is written down and kept offline, never on a computer, because whoever holds it holds the account |
| `finality` | Proof-of-stake (ethereum.org) | a block is final only after about two epochs, when two checkpoints are justified in a row; until then a short reorganization of the chain can still drop it |
| `mmTypedData` | Sign data (MetaMask documentation) | eth_signTypedData_v4 gives the most readable signatures that are efficient to check on chain, personal_sign suits text such as Sign-In with Ethereum, and eth_sign is deprecated |
| `mmEthSignRemoved` | MIP-3: Remove eth_sign (MetaMask Improvement Proposals) | eth_sign lets a site have a user blindly sign any hash, a transaction included, so MetaMask removes the method and answers it with an error |
| `mmRequestAccounts` | eth_requestAccounts (MetaMask documentation) | eth_requestAccounts asks the user for access to addresses and returns the addresses the user allowed |
| `mmEthAccounts` | eth_accounts (MetaMask documentation) | eth_accounts returns only the addresses the user has already allowed, and eth_requestAccounts is the advised way to get that permission |
| `mmChainChanged` | Ethereum provider API (MetaMask documentation) | the provider of MetaMask follows EIP-1193 and emits chainChanged with a hexadecimal chain id, which an application listens to for the network of the user |
| `mmSwitch` | Manage networks (MetaMask documentation) | an application reads the current chain, listens for chainChanged and asks the wallet to switch networks, and handles a user who rejects the switch |
| `ethersMax` | Constants (ethers v6 documentation) | MaxUint256 is the constant for the largest value of a uint256 |
| `ethersWait` | Providers (ethers v6 documentation) | wait and waitForTransaction take a number of confirmations, one by default, and with zero they may return before the transaction is mined |
| `viemWaitConfirmations` | waitForTransactionReceipt (viem documentation) | waitForTransactionReceipt takes the number of confirmations to wait for, one by default |
| `viemTypedData` | signTypedData (viem documentation) | signTypedData of viem takes the domain, the types, the primary type and the message of an EIP-712 signature in one object |
| `secretsNotInCode` | Secrets Management Cheat Sheet (OWASP) | secrets hard coded in source and configuration files are a common leak; .env files are not to be committed, and client-side code is not to hold secrets at all |
| `secretsRotate` | Secrets Management Cheat Sheet (OWASP) | a secret that leaked is revoked and rotated, and removed from the code, the logs and the history |
| `xssSinks` | Cross Site Scripting Prevention Cheat Sheet (OWASP) | innerHTML, outerHTML and document.write treat their value as HTML, so a variable is not to be put there, and HTML that must be shown is cleaned first, such as with DOMPurify |
| `reactDangerous` | Common components, dangerouslySetInnerHTML (React documentation) | dangerouslySetInnerHTML takes raw HTML in __html, and HTML that does not come from a fully trusted source opens the page to cross-site scripting |
| `lexical` | ECMAScript Language Specification, lexical grammar (TC39) | whether a slash starts a division or a regular expression literal depends on where it stands, and template literals have substitutions in ${...} between their fixed parts |
| `tsxAssertions` | JSX (TypeScript Handbook) | in a .tsx file an angle bracket starts JSX, so the type assertion <T>x is not allowed there and as is used instead |
| `dotenvFormat` | dotenv (the README of the package) | an env file holds KEY=value lines, # starts a comment unless the value is quoted, and the file is not to be committed |
| `csvRecords` | RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files | each record of a CSV file is on its own line, ended by CRLF, the first line may be a header, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice |
| `csvInjection` | CSV Injection (OWASP) | a spreadsheet may read a cell that starts with =, +, -, @, a tab, a carriage return or a line feed as a formula, and no one escape is safe in every program that opens the file |
| `jsonUtf8` | RFC 8259, The JSON Data Interchange Format | JSON text exchanged between systems must be UTF-8 |
| `jsonRepeatedNames` | RFC 8259, The JSON Data Interchange Format | when an object repeats a name the behavior of the software that reads it cannot be predicted, so the JSON reader of this tool refuses a repeated name |
| `githubAnnotations` | Workflow commands for GitHub Actions (GitHub Docs) | a line of output such as ::warning file=...,line=...::message becomes an annotation on that file and line in the run |

## The pages

| Page | Address |
| --- | --- |
| ERC-55: Mixed-case checksum address encoding (Ethereum Improvement Proposals) | https://eips.ethereum.org/EIPS/eip-55 |
| EIP-712: Typed structured data hashing and signing (Ethereum Improvement Proposals) | https://eips.ethereum.org/EIPS/eip-712 |
| EIP-1193: Ethereum Provider JavaScript API (Ethereum Improvement Proposals) | https://eips.ethereum.org/EIPS/eip-1193 |
| EIP-1102: Opt-in account exposure (Ethereum Improvement Proposals) | https://eips.ethereum.org/EIPS/eip-1102 |
| ERC-2612: Permit Extension for EIP-20 Signed Approvals (Ethereum Improvement Proposals) | https://eips.ethereum.org/EIPS/eip-2612 |
| ERC-20: Token Standard (Ethereum Improvement Proposals) | https://eips.ethereum.org/EIPS/eip-20 |
| EIP-155: Simple replay attack protection (Ethereum Improvement Proposals) | https://eips.ethereum.org/EIPS/eip-155 |
| ERC-721: Non-Fungible Token Standard (Ethereum Improvement Proposals) | https://eips.ethereum.org/EIPS/eip-721 |
| BIP-39: Mnemonic code for generating deterministic keys (Bitcoin Improvement Proposals) | https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki |
| The BIP-39 English word list, english.txt (Bitcoin Improvement Proposals) | https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt |
| JSON-RPC API (ethereum.org) | https://ethereum.org/developers/docs/apis/json-rpc/ |
| Ethereum security and scam prevention (ethereum.org) | https://ethereum.org/security/ |
| Ethereum wallets (ethereum.org) | https://ethereum.org/wallets/ |
| Proof-of-stake (ethereum.org) | https://ethereum.org/developers/docs/consensus-mechanisms/pos/ |
| Sign data (MetaMask documentation) | https://docs.metamask.io/metamask-connect/evm/guides/sign-data/ |
| MIP-3: Remove eth_sign (MetaMask Improvement Proposals) | https://github.com/MetaMask/metamask-improvement-proposals/blob/main/MIPs/mip-3.md |
| eth_requestAccounts (MetaMask documentation) | https://docs.metamask.io/metamask-connect/evm/reference/json-rpc-api/eth_requestAccounts/ |
| eth_accounts (MetaMask documentation) | https://docs.metamask.io/metamask-connect/evm/reference/json-rpc-api/eth_accounts/ |
| Ethereum provider API (MetaMask documentation) | https://docs.metamask.io/metamask-connect/evm/reference/provider-api/ |
| Manage networks (MetaMask documentation) | https://docs.metamask.io/metamask-connect/evm/guides/manage-networks/ |
| Constants (ethers v6 documentation) | https://docs.ethers.org/v6/api/constants/ |
| Providers (ethers v6 documentation) | https://docs.ethers.org/v6/api/providers/ |
| waitForTransactionReceipt (viem documentation) | https://viem.sh/docs/actions/public/waitForTransactionReceipt |
| signTypedData (viem documentation) | https://viem.sh/docs/actions/wallet/signTypedData |
| Secrets Management Cheat Sheet (OWASP) | https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html |
| Cross Site Scripting Prevention Cheat Sheet (OWASP) | https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html |
| Common components, dangerouslySetInnerHTML (React documentation) | https://react.dev/reference/react-dom/components/common |
| ECMAScript Language Specification, lexical grammar (TC39) | https://tc39.es/ecma262/ |
| JSX (TypeScript Handbook) | https://www.typescriptlang.org/docs/handbook/jsx.html |
| dotenv (the README of the package) | https://github.com/motdotla/dotenv |
| RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files | https://www.rfc-editor.org/rfc/rfc4180 |
| RFC 8259, The JSON Data Interchange Format | https://www.rfc-editor.org/rfc/rfc8259 |
| CSV Injection (OWASP) | https://community.owasp.org/attacks/CSV_Injection |
| Workflow commands for GitHub Actions (GitHub Docs) | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands |
