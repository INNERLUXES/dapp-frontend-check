# Sources

The public pages the checks of this tool are based on, each with a short note in this project's own words on what the
page says and which parts of the tool lean on it. Nothing here is a copy of a page: read the page itself for its exact
wording. src/data.js holds the pages and the points the reports show, and test/data.test.js checks that every page in
src/data.js is listed here.
Each page was fetched and read before it was listed.

The tool reads the source, JSON and env files of a decentralized app on disk as text and runs nothing; its result is an
input to a review of how the app talks to wallets and chains, not a security audit and not a guarantee that the app is
safe. These notes say what the pages say so a reader can follow a finding back to its source; they are not advice on
any one app. The pages were chosen with web addresses that hold no number that reads like a year: the Ethereum
Improvement Proposals by their number, the BIP repository on its main branch, the documentation of MetaMask, ethers and
viem at their current addresses, and the OWASP cheat sheets by their names.

## Ethereum Improvement Proposals

### ERC-55: Mixed-case checksum address encoding (Ethereum Improvement Proposals)

https://eips.ethereum.org/EIPS/eip-55

The checksum of an address in the case of its letters: the 40 hexadecimal digits are written in lowercase, hashed as
ASCII with Keccak-256, and each letter is written in upper case where the digit of the hash at its place is 8 or more.
An address in all lower or all upper case carries no checksum and stays valid. The page lists test addresses in all
caps, all lower and mixed case. `address-checksum` follows it with the Keccak-256 of src/keccak.js, and
test/values.test.js runs every test address of the page.

### EIP-712: Typed structured data hashing and signing (Ethereum Improvement Proposals)

https://eips.ethereum.org/EIPS/eip-712

Signing typed data instead of an opaque string of bytes, so that a wallet can show the user the fields of what is
signed. The domain of a signature has the fields name, version, chainId, verifyingContract and salt; a wallet should
refuse to sign when chainId does not match the active chain, and verifyingContract is the contract that checks the
signature. The standard itself has no replay protection; the application binds and checks it. `typed-data-domain` and
`unstructured-signing` lean on it.

### EIP-1193: Ethereum Provider JavaScript API (Ethereum Improvement Proposals)

https://eips.ethereum.org/EIPS/eip-1193

The provider a wallet injects: a request method for every JSON-RPC call, and events such as chainChanged, which a
provider emits with the new chain id when the chain it is connected to changes. An appendix keeps the legacy API (send
and sendAsync) for old applications only, and its authors advise against implementing it. `chain-not-checked` and
`legacy-wallet-api` lean on it.

### EIP-1102: Opt-in account exposure (Ethereum Improvement Proposals)

https://eips.ethereum.org/EIPS/eip-1102

How a dapp asks for accounts: the eth_requestAccounts method, which may show the user a prompt and returns the
accounts the user approved. ethereum.enable() is marked deprecated in its favour. The page describes the previous
generation of browsers, which injected a provider with accounts and no consent, as a risk to privacy and safety.
`legacy-wallet-api` leans on it for window.web3, ethereum.enable() and eth_accounts with no request.

### ERC-2612: Permit Extension for EIP-20 Signed Approvals (Ethereum Improvement Proposals)

https://eips.ethereum.org/EIPS/eip-2612

A permit sets an allowance with a signed message instead of a transaction; the message holds the owner, the spender,
the value, a nonce and a deadline, and the domain binds it to the token and the chain. `unlimited-approval` reads the
value of a permit signed through signTypedData.

### ERC-20: Token Standard (Ethereum Improvement Proposals)

https://eips.ethereum.org/EIPS/eip-20

approve lets the spender withdraw from the account several times, up to the value given, and a new call replaces the
allowance. `unlimited-approval` leans on it.

### EIP-155: Simple replay attack protection (Ethereum Improvement Proposals)

https://eips.ethereum.org/EIPS/eip-155

The chain id becomes part of what a transaction signs, so a transaction meant for one chain cannot be replayed on
another. `chain-not-checked`, `typed-data-domain`, `address-repeated` and `address-conflict` lean on the fact that a
transaction, a signature and an address belong to one chain.

### ERC-721: Non-Fungible Token Standard (Ethereum Improvement Proposals)

https://eips.ethereum.org/EIPS/eip-721

tokenURI points to metadata JSON with a name, a description and an image; the contract decides the URI, and the page
says the URI may change over time. `html-from-chain` leans on it: metadata is data the app does not control.

## BIP-39

### BIP-39: Mnemonic code for generating deterministic keys (Bitcoin Improvement Proposals)

https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki

A mnemonic is 12, 15, 18, 21 or 24 words of a list of 2,048 words, each word standing for 11 bits; the entropy is 128
to 256 bits, and the last ENT/32 bits are the first bits of its SHA-256 hash. The list is sorted, and its words are
told apart by their first four letters. `seed-phrase` and src/bip39.js follow it.

### The BIP-39 English word list, english.txt (Bitcoin Improvement Proposals)

https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt

The English list, one word per line in its fixed order. src/wordlist.js stores it front coded, and test/values.test.js
checks that the SHA-256 of the decoded list, one word per line, is the SHA-256 of this file.

## ethereum.org

### JSON-RPC API (ethereum.org)

https://ethereum.org/developers/docs/apis/json-rpc/

The methods of a node: eth_sign signs with the prefix of an Ethereum signed message, eth_chainId returns the chain id
used for replay protection, eth_accounts the addresses the client holds, and eth_sendTransaction sends a transaction.
`eth-sign` leans on it, next to the MetaMask pages.

### Ethereum security and scam prevention (ethereum.org)

https://ethereum.org/security/

A recovery phrase or a private key is never to be shared for any reason and never kept in digital form; an unlimited
spending limit lets a contract take every token of the kind, so approvals are to be limited to what is needed.
`private-key`, `seed-phrase` and `unlimited-approval` lean on it.

### Ethereum wallets (ethereum.org)

https://ethereum.org/wallets/

A wallet controls an account through its private key, and the seed phrase is written down and kept offline, never on a
computer. `seed-phrase` leans on it.

### Proof-of-stake (ethereum.org)

https://ethereum.org/developers/docs/consensus-mechanisms/pos/

A block is final after about two epochs, when two checkpoints in a row are justified; before that, a short
reorganization can still drop it. `low-confirmations` leans on it for why a setting may ask for more than one
confirmation.

## MetaMask

### Sign data (MetaMask documentation)

https://docs.metamask.io/metamask-connect/evm/guides/sign-data/

eth_signTypedData_v4 gives the most readable signatures that are efficient to check on chain, personal_sign suits text
such as Sign-In with Ethereum, and eth_sign is deprecated. `eth-sign` and `unstructured-signing` lean on it.

### MIP-3: Remove eth_sign (MetaMask Improvement Proposals)

https://github.com/MetaMask/metamask-improvement-proposals/blob/main/MIPs/mip-3.md

eth_sign let a site have a user sign any hash with no prefix, a transaction included, with nothing readable to check;
MetaMask removes the method, with the settings that turned it on, and answers it with an error. `eth-sign` leans on it.

### eth_requestAccounts (MetaMask documentation)

https://docs.metamask.io/metamask-connect/evm/reference/json-rpc-api/eth_requestAccounts/

eth_requestAccounts asks the user for access to addresses, follows EIP-1102, and returns the addresses the user
allowed. `legacy-wallet-api` leans on it.

### eth_accounts (MetaMask documentation)

https://docs.metamask.io/metamask-connect/evm/reference/json-rpc-api/eth_accounts/

eth_accounts returns only the addresses the user already allowed; the page advises eth_requestAccounts to get that
permission. `legacy-wallet-api` leans on it.

### Ethereum provider API (MetaMask documentation)

https://docs.metamask.io/metamask-connect/evm/reference/provider-api/

The provider follows EIP-1193, is injected as window.ethereum, and emits chainChanged with a hexadecimal chain id that
an application listens to. `chain-not-checked` leans on it.

### Manage networks (MetaMask documentation)

https://docs.metamask.io/metamask-connect/evm/guides/manage-networks/

An application reads the current chain, listens for chainChanged, asks the wallet to switch networks, and handles a user
who rejects the switch. `chain-not-checked` leans on it.

## Libraries

### Constants (ethers v6 documentation)

https://docs.ethers.org/v6/api/constants/

MaxUint256 is the constant for the largest value of a uint256. `unlimited-approval` names it, with the constants of
ethers v5 and viem and the names projects give it.

### Providers (ethers v6 documentation)

https://docs.ethers.org/v6/api/providers/

TransactionResponse.wait and Provider.waitForTransaction take a number of confirmations, one by default; with zero
they may return before the transaction is mined. signer.signTypedData takes the domain, the types and the value.
`low-confirmations` and `typed-data-domain` lean on it.

### waitForTransactionReceipt (viem documentation)

https://viem.sh/docs/actions/public/waitForTransactionReceipt

The confirmations parameter is the number of blocks to wait for, one by default. `low-confirmations` leans on it.

### signTypedData (viem documentation)

https://viem.sh/docs/actions/wallet/signTypedData

The signTypedData action of a wallet client takes the domain, the types, the primary type and the message in one
object. `typed-data-domain` reads the domain key of that object.

## OWASP

### Secrets Management Cheat Sheet (OWASP)

https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html

Secrets hard coded in source and configuration files are common; .env files are for local work and are not committed;
client-side code holds no secrets; and a leaked secret is revoked, rotated and removed from the code and the history.
`private-key`, `seed-phrase` and `rpc-url-key` lean on it, and so does the rule of the tool never to show a value.

### Cross Site Scripting Prevention Cheat Sheet (OWASP)

https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

innerHTML, outerHTML and document.write treat their value as HTML, so no variable goes there; textContent is the safe
sink, and HTML that must be shown is cleaned with a sanitizer such as DOMPurify as the last step. `html-from-chain`
leans on it.

### CSV Injection (OWASP)

https://community.owasp.org/attacks/CSV_Injection

A spreadsheet may read a cell that starts with =, +, -, @, a tab, a carriage return or a line feed as a formula, and no
one escape is safe in every program that opens the file. The CSV report puts a single quote in front of such a field,
and the threat model says to open a report built from files you do not trust with formulas turned off.

## The languages and formats

### Common components, dangerouslySetInnerHTML (React documentation)

https://react.dev/reference/react-dom/components/common

dangerouslySetInnerHTML takes raw HTML in an object with an __html key, and HTML that does not come from a fully trusted
source makes cross-site scripting easy. `html-from-chain` reads the value of __html.

### ECMAScript Language Specification, lexical grammar (TC39)

https://tc39.es/ecma262/

Whether a slash starts a division or a regular expression literal depends on the syntactic context, and template
literals have substitutions between their fixed parts. src/lexer.js decides a slash from the token before it and
reads templates with a stack of its own.

### JSX (TypeScript Handbook)

https://www.typescriptlang.org/docs/handbook/jsx.html

In a .tsx file an angle bracket starts JSX, so the type assertion with angle brackets is not allowed there and as is
used instead. src/lexer.js reads JSX in JavaScript files and .tsx files and never in .ts, .mts or .cts files.

### dotenv (the README of the package)

https://github.com/motdotla/dotenv

An env file holds KEY=value lines; # starts a comment unless the value is in quotes; quotes keep white space; and the
file is not committed. src/envfile.js reads the same form, and `private-key` leans on the advice not to commit it.

### RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files

https://www.rfc-editor.org/rfc/rfc4180

The CSV format: one record per line ended by CRLF, an optional header line, and a field that holds a comma, a double
quote or a line break put in double quotes, with every double quote inside written twice. The CSV report follows it.

### RFC 8259, The JSON Data Interchange Format

https://www.rfc-editor.org/rfc/rfc8259

The JSON format. JSON exchanged between systems must be UTF-8. When the names of an object are not unique, the
behavior of the software that reads it is unpredictable, so the JSON reader of the configuration refuses a name given
twice.

### Workflow commands for GitHub Actions (GitHub Docs)

https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands

The error, warning and notice commands with file, line, col and title parameters create annotations on a file and a
line of the repository. The GitHub format writes one command per finding and escapes what a command gives a meaning
to.
