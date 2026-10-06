# Method

This document says exactly what the tool reads, how it reads a JavaScript, TypeScript, JSON or env file, what each rule
looks at and cannot see, and how the report is built. The names used here are the defaults; docs/inputs.md says how the
configuration changes them. The tool reads the files of a project on disk as text and runs nothing; its checks are a
heuristic. Its result is an input to a review of how the app talks to wallets and chains, not a security audit and not
a guarantee that the app is safe: a finding points at a line that needs a look, and a clean run says only that the
folder holds none of the forms below.

## What is read

The input is one folder. It is listed with a list of folders of the tool's own, with no recursion (src/walk.js), in the
order of the names. Every file whose path, relative to the folder, matches an include pattern and no exclude pattern is
read; paths and patterns are compared in lowercase. By default the JavaScript and TypeScript files (`.js`, `.jsx`,
`.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts`), the JSON files and the env files (`.env` and `.env.*`) are read, and
the folders of build output and caches (`dist`, `build`, `.next`, `out`, `coverage`, `artifacts`, `cache`) and the lock
files of npm are left out wherever they are. The folders .git and node_modules are counted and passed over wherever they
are, in any case of letters, because they hold history and installed packages, not the code of the project. A symbolic
link (or a junction on Windows) is counted and never followed.

Each file is read once (src/files.js), decoded by its byte order mark: UTF-16 little or big endian with one, UTF-8 with
or without one. A file that holds a null byte, bytes that are not valid UTF-8, or more than 4 MB is an
`unreadable-file` finding and nothing in it is checked. Lines end at LF, CRLF or CR, and every finding has the line and
column of the token or the value it is about. The kind of a file comes from its name (src/check.js): `.env` and
`.env.*` are env files, `*.json` are JSON files, and every other file is code.

## The lexer

src/lexer.js is a JavaScript and TypeScript lexer of the tool's own. It reads the text once, left to right, and turns it
into tokens with their offsets, so that no check of the code ever looks inside a comment, a regular expression or the
text of a JSX element, while the rules about values can still read every string:

- a line comment (`//`, and `#!` on the first line) runs to the end of its line, and a block comment to its `*/`;
  neither gives a token, so `eth_sign` in a comment is never read;
- a string in double or single quotes is one token with its value, its escapes (`\n`, `\x41`, `A`, a backslash
  before a line end) read for their meaning; a string that is not closed ends at the end of its line; a value longer
  than 65,536 characters is cut there;
- a template literal gives one token with its fixed parts, then the tokens of each `${...}` between a `${` and a `}`,
  then an end token; templates inside substitutions are read with the same stack, and the braces inside a substitution
  are counted, so its `}` is found;
- a slash where an expression may start opens a regular expression literal, one token with no value: at the start, after
  punctuation other than `)`, `]`, `++` and `--`, and after the words `return`, `typeof`, `instanceof`, `in`, `of`,
  `new`, `delete`, `void`, `throw`, `case`, `do`, `else`, `yield`, `await` and `extends`, as the lexical grammar of
  ECMAScript lets the context decide; elsewhere it is a division; a character class may hold a slash, and an unclosed
  literal ends at its line;
- in a `.js`, `.jsx`, `.mjs`, `.cjs` or `.tsx` file, a `<` where an expression may start, followed by a letter or by
  `>`, opens a JSX element: tag and attribute names are names, attribute values in quotes are strings, an expression in
  braces is read as code, a fragment `<>` is read too, and the text between tags gives no token, so `eth_sign` in the
  text of a paragraph is never read; in `.ts`, `.mts` and `.cts` files a `<` is always an operator, because `<T>x` is a
  type assertion there and the TypeScript Handbook bars it from `.tsx` for that reason;
- a number keeps its text (hexadecimal, binary, octal, decimal with `_`, a fraction, an exponent and the `n` of a
  BigInt), a name keeps its name, the operators are read longest first (`>>>=` before `>>=` before `>>`), and a character
  outside ASCII outside a literal is a token with no text.

`blankText` gives the same text with every comment, string, template part, regular expression and JSX text replaced by
spaces, line ends kept, for anyone who wants to see what the checks of the code see. The lexer keeps a stack of its own
for templates, JSX elements and the braces inside them, and never recurses. It never fails on what it reads; it stops
only at its limits of tokens, of the length of a name or a number, and of nesting (docs/limits.md), with a `scan-limit`
finding at the place.

`brackets` matches every `(`, `[`, `{` and `${` with its closing bracket, and every template with its end, once for the
file with a stack of its own, and gives every token the bracket around it.

## The view of a file of code

src/code.js builds a view of each file of code: the tokens, the brackets, and the first value of every name declared
with `const`, `let` or `var` in the file (a type annotation after the name is passed over). The checks use a few
readers of the view, each bounded by `LOOKAHEAD`, 1,024 tokens:

- `argumentsOf` splits the arguments of a call at its commas outside brackets;
- `entriesOf` reads the entries of an object literal: `key: value`, the shorthand `key`, a spread `...x`; a computed
  key and a method are passed over;
- `expressionEnd` finds the end of a value: the first `,`, `;`, `)`, `]` or `}` outside brackets, or a word that starts
  a statement (`const`, `export`, `return` and the others), so a value with no semicolon ends at the next statement;
- `chainAt` gives the names of a member chain, such as `window.ethereum.enable`;
- `isCall` says that a name is called and not declared: a name after `function`, or a name whose `)` is followed by `{`
  (a method) or by `:` (a return type), is a declaration;
- `namesAround` gives the names around a string: the key or the name it is given to (`key: '...'`, `name = '...'`,
  `name ?? '...'`), the call it is passed to (`new Wallet('...')`), and the name of the object literal it sits in;
- a single name in an argument is followed once to its declaration in the file, so `const domain = {...}` and
  `signTypedData(domain, ...)` are read together; a name declared in another file is not followed.

## The values of strings

The rules about values read the value of every string of the code, every fixed part of a template, every string of a
JSON file and every value of an env file (src/strings.js), each with the names around it. Every pattern is fixed and
runs once over the value. No value is ever copied into a finding but an address, which is public.

- **A private key** is a run of 64 hexadecimal digits, with or without `0x`, with no letter, digit or `_` on either
  side, where a name around it has a word of `KEY_WORDS` (private, priv, privkey, privatekey, secret, pk, signer,
  deployer, wallet, mnemonic, seed), or the word key and no word of `NOT_KEY_WORDS` (public, pub, hash, topic, slot,
  storage, salt, root, id, tx, block, selector, role, digest, code, init). The words of a name come from `wordsOfName`,
  which splits camelCase, PascalCase, snake_case and kebab-case, so `RELAYER_PRIVATE_KEY` and `relayerPrivateKey` give
  the same words. A value whose digits are all the same, in any case, is a placeholder.
- **A seed phrase** is the longest run of 12 or more words of the BIP-39 English list, taken apart at white space, in
  lowercase as the list writes them. When the run has 12, 15, 18, 21 or 24 words its checksum is worked out as BIP-39
  writes it (src/bip39.js, with the SHA-256 of Node); a longer run is cut to the longest length BIP-39 allows. The
  report says whether the checksum holds.
- **An RPC address with a key** is an `http`, `https`, `ws` or `wss` address with a path part of 20 or more letters,
  digits, `-` and `_` that holds both letters and digits and is not an address, or a query parameter of `KEY_PARAMS`
  (key, apikey, api_key, api-key, token, access_token, accesstoken, auth, secret, projectid, project_id, apisecret,
  x-api-key) with a value of 8 or more characters, or a password before the host. It counts as an RPC address when a
  word of its host or path is in `RPC_HOST_WORDS` (rpc, node, mainnet, testnet, sepolia, the names of common providers
  and chains, and the others of src/strings.js) or a word of the names around it is in `RPC_WORDS` (rpc, provider,
  node, endpoint, transport, jsonrpc, web3, http, ws, chain, network and the others). In a template, a key written as
  `${...}` is not a fixed part and is not seen. Only the host is shown.
- **An address** is `0x` and 40 hexadecimal digits with no letter, digit or `_` on either side.

In an env file, a name that starts with a prefix of `PUBLIC_PREFIXES` (NEXT_PUBLIC_, VITE_, REACT_APP_, PUBLIC_,
EXPO_PUBLIC_, NUXT_PUBLIC_, GATSBY_, VUE_APP_) is put into the code every visitor downloads by the build tools that use
it, and a finding says so.

## JSON files

A JSON file is read with the lexer and the forgiving reader of src/tree.js: objects with their keys, lists, strings,
numbers and the words true, false and null. Comments, a comma at the end of a list and names with no quotes are read,
because `tsconfig.json` and other files of a front end are often written that way; the reader never refuses a file and
reads what it can. `__proto__` is kept as an entry of a list, never as a property. Every string is read as above with
its key as the name around it.

An address that is the whole value of a string is an entry of a map when its chain and its name are known
(`placeOfAddress` of src/settings.js): the chain is the innermost key that is a number, or a key of `CHAIN_KEYS`
(chainId, chainID, chain_id, chain) with a number in an object that holds it; the name is the key that holds the
address, or, when that key is one of `ADDRESS_KEYS` (address, addr, contractAddress, deployedAddress), a key of
`NAME_KEYS` (name, contract, contractName, label, id) next to it, or else the nearest key above that is not a number.
So `{"1": {"Router": "0x..."}}`, `{"Router": {"1": "0x..."}}`, `{"chainId": 1, "contracts": {"Router": "0x..."}}` and
`[{"chainId": 1, "name": "Router", "address": "0x..."}]` all give Router on chain 1. Maps keyed by the name of a
network, such as `mainnet`, are not read.

A key whose words hold confirmation or confirmations, with a number or a number in a string, is a setting of
confirmations.

## Env files

An env file is read by src/envfile.js as the dotenv convention writes it: a line `NAME=value`, with an optional `export`
in front, a value in single, double or back quotes or bare, and `#` starting a comment on a line of its own or after a
bare value. Nothing is expanded. Every value is read as above with its name as the name around it, and a name whose
words hold confirmations with a number is a setting of confirmations.

## The rules

### `private-key`

A value of 64 hexadecimal digits that its name, its key, the call it is passed to or the object it sits in says is a
private key, in a string or a fixed part of a template of the code, a string of a JSON file or a value of an env file.
`const PRIVATE_KEY = '0x...'`, `{ signerKey: '0x...' }`, `new Wallet('0x...')`, `privateKeyToAccount('0x...')`,
`process.env.DEPLOYER_KEY ?? '0x...'`, `"privateKey": "0x..."` and `SIGNER_KEY=0x...` are reported; `TOPIC_HASH`,
`storageSlotKey`, `txHash`, `blockHash`, a value with no name that says key, and a placeholder of one digit are not.
What it cannot see: a key held in a name with none of these words, a key split in parts, a key in base64 or in another
encoding, and whether the key holds anything. The value is never shown, in any format.

### `seed-phrase`

A run of 12 or more words of the BIP-39 English list in a string, a template part, a JSON string or an env value,
whatever the name around it. Eleven words, words in upper case, words joined by commas and words in a comment are not
reported. The report says whether the checksum holds: a phrase whose checksum holds can be a real phrase, and one whose
checksum fails may be a placeholder or a real phrase with one word changed, so both are errors. What it cannot see: a
phrase in another language, split over several strings, or in upper case. The words are never shown.

### `rpc-url-key`

An RPC address with what looks like an API key in its path, its query or its user part, in a string or template part
of the code, a JSON string or an env value. `new JsonRpcProvider('https://.../v3/<key>')`, `?apikey=<key>` and
`wss://user:<key>@...` are reported; an address whose key is `${...}`, a placeholder such as `YOUR_KEY` (no digits,
under 20 characters), an address with no word of an RPC address, and a short parameter are not. What it cannot see: a
key in the host name, as some providers write it, a key of fewer than 20 characters in the path, and whether the key is
restricted to a domain, which some providers allow for keys that ship in a front end. Only the host is shown.

### `unlimited-approval`

An approval for the largest uint256: `x.approve(spender, amount)` or `x.increaseAllowance(spender, amount)`, the
`approve` or `increaseAllowance` named by `functionName` with `args` in a call of `CONTRACT_CALLS` (writeContract,
writeContractAsync, simulateContract, prepareWriteContract, encodeFunctionData, estimateContractGas) or in an object
assigned to a name, `encodeFunctionData('approve', [spender, amount])` of ethers, and a `value` or `amount` in the
arguments of a signTypedData call or an eth_signTypedData request, as an EIP-2612 permit has. The amount is unlimited
when it is a name of `UNLIMITED_NAMES` (MaxUint256, maxUint256, MAX_UINT256, MAX_UINT_256, UINT256_MAX, MAX_UINT,
MAX_ALLOWANCE, MAX_APPROVAL, UNLIMITED_ALLOWANCE, UNLIMITED_APPROVAL, INFINITE_APPROVAL, INFINITE_ALLOWANCE) at the end
of a member chain (`ethers.MaxUint256`, `ethers.constants.MaxUint256`), `2 ** 256 - 1` or `(1 << 256) - 1` with or
without `n` and `BigInt(...)`, 64 `f` digits after `0x` in a number or a string, the decimal number of 78 digits, or a
name declared in the file as one of these. `MaxUint256 / 2n`, `2n ** 255n`, `MaxUint256.toString()` and an amount held
in a name declared elsewhere are not reported. What it cannot see: an amount computed at run time, and a permit whose
message is built elsewhere.

### `eth-sign`

The string `eth_sign` as a whole value (the method of a request, `provider.send("eth_sign", ...)`) and a call of
`x.eth.sign`, such as `web3.eth.sign`. `personal_sign`, `eth_signTypedData_v4`, `web3.eth.personal.sign`, the word in a
comment, a regular expression, a longer string or the text of a JSX element are not reported. What it cannot see: a
method name built from parts.

### `unstructured-signing`

A message built from fields and signed as text: `personal_sign` (the first of its `params`), `signMessage` or
`signMessageAsync` (the first argument, or its `message` key), and `x.personal.sign` (the first argument), whose
message holds a call of `JSON.stringify`, a template with two or more `${...}`, or text joined with `+` more than once;
a single name is followed once to its declaration in the file. A Sign-In with Ethereum message (a template whose text
holds the line of EIP-4361 that asks the user to sign in, or both `Nonce:` and `Chain ID:`, or a call of `SiweMessage`,
`createSiweMessage` or `prepareMessage`) is left out, because text is right for it. What it cannot see: a message built
in another file or in a function, and whether the contract checks the message at all. It is a note by default.

### `typed-data-domain`

A typed data signature whose domain is a literal with no `chainId` or no `verifyingContract`: `signTypedData`,
`_signTypedData` (ethers v5) or `signTypedDataAsync` (wagmi) called with a domain object as the first argument (ethers)
or as the `domain` key of an object argument (viem and wagmi), a name declared in the file as one, and an
`eth_signTypedData_v4`, `_v3` or `eth_signTypedData` request whose object holds a `domain` key with a literal. An object
argument with `types`, `primaryType` or `message` and no `domain` is reported too. A domain with a spread, a domain
held in a name declared elsewhere, a function or method declared with that name, and a request whose typed data is
built elsewhere are not read. What it cannot see: a domain built in another file, and whether the contract that checks
the signature uses the same domain. A protocol that binds signatures with `salt` instead may differ on purpose.

### `chain-not-checked`

A file that asks the wallet for accounts (`eth_requestAccounts`, `requestAddresses`, `requestAccounts`,
`ethereum.enable()`, or `connect` or `connectAsync` with a `connector` in its arguments, as wagmi calls them) or sends a
transaction (`eth_sendTransaction`, `sendTransaction`, `sendTransactionAsync`, `writeContract`, `writeContractAsync`),
and holds no name or string of `CHAIN_WORDS` (chainId, chainID, chain_id, chainChanged, eth_chainId, net_version,
wallet_switchEthereumChain, wallet_addEthereumChain, switchChain, switchChainAsync, useSwitchChain, useChainId,
getChainId, getNetwork, useNetwork, switchNetwork). One finding per file, at the first such place. The `connect` of a
socket or a database is not a wallet. What it cannot see: a check of the chain in another file of the app, in a hook,
or in a library that checks it for you (viem checks the `chain` of a write against the wallet, wagmi switches it), so
the rule is a note.

### `address-checksum`

An address of 40 hexadecimal digits after `0x`, in a string or template part of the code, a JSON string or an env
value, whose letters mix upper and lower case but do not match the checksum of EIP-55, which src/keccak.js works out
with a Keccak-256 of its own. An address all in lower or all in upper case has no checksum and is not reported, and
neither are placeholders of one repeated digit such as the zero address. The report names the address with its right
checksum. What it cannot see: an address with no checksum that is wrong, and a number literal that is not a string.

### `address-repeated`

An address written in the code that is also written in a JSON or env file of the project (the map), or that is written
in two files of code or more. With a map, every place in the code is reported and the map named; with no map, the
first file of code in the order of the paths is taken as the home of the address and the places in the other files are
reported. An address written several times in one file of code (such as one map in a module) and an address in several
JSON files (the same contract deployed at the same address on two chains) are not reported. What it cannot see: two
different addresses for one contract written in the code, and addresses built at run time.

### `address-conflict`

One contract name mapped to two addresses for one chain id in two JSON files. The entries of the maps are read as the
section on JSON files says, the name compared in lowercase and the address compared in lowercase; the first file in the
order of the paths is the reference, and every entry of another file with another address is reported, with the
reference. Two entries of one file are not compared, nor maps by the name of a network, nor maps written in code. Two
settings for staging and production can differ on purpose, which a person has to judge.

### `legacy-wallet-api`

An old way to reach the wallet: `window.web3`, the object old wallets injected; `ethereum.enable()` (or
`window.ethereum.enable()`), which EIP-1102 deprecates in favour of `eth_requestAccounts`; and the string
`eth_accounts` in a project where nothing asks for accounts: no `eth_requestAccounts` or `wallet_requestPermissions`
string, no `ethereum.enable()`, and no call of `getSigner` (the BrowserProvider of ethers asks for accounts in it), `requestAddresses`,
`requestAccounts`, `useConnect`, or `connect` with a connector. `new Web3(window.ethereum)`, `feature.enable()` and
the words in a comment or a string are not reported, and web3.js as a library is not. What it cannot see: a request
for accounts in a library the project uses without naming it.

### `html-from-chain`

HTML built from token metadata or values of the chain: `dangerouslySetInnerHTML` with `__html` (any `__html:` key),
`x.innerHTML` or `x.outerHTML` set with `=` or `+=`, `insertAdjacentHTML` (its second argument) and `document.write` or
`document.writeln`, whose value holds a name with a word of `CHAIN_DATA_WORDS` (metadata, uri, nft, ens, onchain,
token, symbol, attributes, description, collection, erc721, erc1155, contract, read) and no call with a word of
`SANITIZE_WORDS` (sanitize, purify, dompurify, escape, xss). `textContent`, a JSX child, a comparison with `===`, and a
value cleaned by DOMPurify are not reported. A sink whose value starts inside the value of the sink before it is read
with it. It is a heuristic on names: a value from the chain held in a name with other words is not seen, and a name
such as `description` that holds text the app wrote itself is reported.

### `low-confirmations`

A wait for zero or one confirmation where a setting of the project asks for more: `tx.wait()`, `tx.wait(0)` and
`tx.wait(1)` (on a name with a word of `TX_WORDS`: tx, txn, transaction, response, pending, sent, submitted, res, resp,
or on the result of a call), `waitForTransaction(hash)` with no second argument or 0 or 1, and
`waitForTransactionReceipt` or `useWaitForTransactionReceipt` with no `confirmations` or 0 or 1 (the libraries wait for
one by default), in a file that moves value (a name or string of `VALUE_WORDS`: parseEther, parseUnits, transfer,
transferFrom, sendTransaction, eth_sendTransaction, writeContract, writeContractAsync, deposit, withdraw; an approval;
or a `value:` key). The setting is the largest number of 2 or more of a JSON key, an env name or a constant of the code
(`const CONFIRMATIONS = 3`, or `confirmations: 3` in an object literal that is not an argument of a call) whose words
hold confirmation or confirmations. A wait with a number held in a name, a wait for more, a project with no setting, and
a file that moves no value are not reported. What it cannot see: whether the transaction moves value, which the file
only suggests, and a setting read at run time. It is a note by default.

### `unreadable-file`

A file that cannot be read: over 4 MB, holding a null byte, or not valid UTF-8, or UTF-16 with its byte order mark; and
a file the system refuses to open. Nothing in it is checked. This rule is always an error and has no key, so a run
never passes because a file was passed over.

### `scan-limit`

Input past the limits of a run: a folder with more than 50,000 files and folders, folders nested more than 32 deep,
more than 5,000 files to read, and a file with more than 400,000 tokens, a name or a number longer than 1,024
characters, templates, JSX elements or braces nested more than 256 deep, or JSON values nested more than 256 deep. The
listing stops at the place or the file is not checked. This rule is always an error and has no key.

## The project

src/project.js gets the facts of every file with their file, line and column (the addresses, the map entries, the
`eth_accounts` strings, whether a file asks for accounts, the waits, the settings of confirmations and whether a file
moves value) and decides `address-checksum`, `address-repeated`, `address-conflict`, the `eth_accounts` form of
`legacy-wallet-api` and `low-confirmations` over the whole project. A file that cannot be read gives no facts.

## The report

Every finding has a rule, a level, a file, a line, a column, what was found and what to change. Findings are sorted by
level, errors first, then by file, line, column and rule. A rule set to `off` gives no finding. A rule lists 500
findings at most; the rest are counted in a note and still count for the result. The run fails when a finding is at or
above the `failOn` level. Every text from the input goes through `safeText` before it reaches the report.
