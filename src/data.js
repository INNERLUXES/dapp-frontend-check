// The public pages the checks rest on, and what each says, written in this project's own words. research/sources.md
// lists every page with a longer note on each, and test/data.test.js checks that every page here is listed there and
// that every rule names points that exist. The code in src/ uses these constants and never writes a reason of its own
// in a report.

const EIP = 'https://eips.ethereum.org/EIPS';
const MM = 'https://docs.metamask.io/metamask-connect/evm';

export const SOURCES = [
  { id: 'eip55', title: 'ERC-55: Mixed-case checksum address encoding (Ethereum Improvement Proposals)', url: `${EIP}/eip-55` },
  { id: 'eip712', title: 'EIP-712: Typed structured data hashing and signing (Ethereum Improvement Proposals)', url: `${EIP}/eip-712` },
  { id: 'eip1193', title: 'EIP-1193: Ethereum Provider JavaScript API (Ethereum Improvement Proposals)', url: `${EIP}/eip-1193` },
  { id: 'eip1102', title: 'EIP-1102: Opt-in account exposure (Ethereum Improvement Proposals)', url: `${EIP}/eip-1102` },
  { id: 'eip2612', title: 'ERC-2612: Permit Extension for EIP-20 Signed Approvals (Ethereum Improvement Proposals)', url: `${EIP}/eip-2612` },
  { id: 'eip20', title: 'ERC-20: Token Standard (Ethereum Improvement Proposals)', url: `${EIP}/eip-20` },
  { id: 'eip155', title: 'EIP-155: Simple replay attack protection (Ethereum Improvement Proposals)', url: `${EIP}/eip-155` },
  { id: 'eip721', title: 'ERC-721: Non-Fungible Token Standard (Ethereum Improvement Proposals)', url: `${EIP}/eip-721` },
  { id: 'bip39', title: 'BIP-39: Mnemonic code for generating deterministic keys (Bitcoin Improvement Proposals)', url: 'https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki' },
  { id: 'bip39English', title: 'The BIP-39 English word list, english.txt (Bitcoin Improvement Proposals)', url: 'https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt' },
  { id: 'ethJsonRpc', title: 'JSON-RPC API (ethereum.org)', url: 'https://ethereum.org/developers/docs/apis/json-rpc/' },
  { id: 'ethSecurity', title: 'Ethereum security and scam prevention (ethereum.org)', url: 'https://ethereum.org/security/' },
  { id: 'ethWallets', title: 'Ethereum wallets (ethereum.org)', url: 'https://ethereum.org/wallets/' },
  { id: 'ethPos', title: 'Proof-of-stake (ethereum.org)', url: 'https://ethereum.org/developers/docs/consensus-mechanisms/pos/' },
  { id: 'mmSignData', title: 'Sign data (MetaMask documentation)', url: `${MM}/guides/sign-data/` },
  { id: 'mmMip3', title: 'MIP-3: Remove eth_sign (MetaMask Improvement Proposals)', url: 'https://github.com/MetaMask/metamask-improvement-proposals/blob/main/MIPs/mip-3.md' },
  { id: 'mmRequestAccounts', title: 'eth_requestAccounts (MetaMask documentation)', url: `${MM}/reference/json-rpc-api/eth_requestAccounts/` },
  { id: 'mmAccounts', title: 'eth_accounts (MetaMask documentation)', url: `${MM}/reference/json-rpc-api/eth_accounts/` },
  { id: 'mmProvider', title: 'Ethereum provider API (MetaMask documentation)', url: `${MM}/reference/provider-api/` },
  { id: 'mmNetworks', title: 'Manage networks (MetaMask documentation)', url: `${MM}/guides/manage-networks/` },
  { id: 'ethersConstants', title: 'Constants (ethers v6 documentation)', url: 'https://docs.ethers.org/v6/api/constants/' },
  { id: 'ethersProviders', title: 'Providers (ethers v6 documentation)', url: 'https://docs.ethers.org/v6/api/providers/' },
  { id: 'viemWait', title: 'waitForTransactionReceipt (viem documentation)', url: 'https://viem.sh/docs/actions/public/waitForTransactionReceipt' },
  { id: 'viemSignTypedData', title: 'signTypedData (viem documentation)', url: 'https://viem.sh/docs/actions/wallet/signTypedData' },
  { id: 'owaspSecrets', title: 'Secrets Management Cheat Sheet (OWASP)', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html' },
  { id: 'owaspXss', title: 'Cross Site Scripting Prevention Cheat Sheet (OWASP)', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html' },
  { id: 'reactCommon', title: 'Common components, dangerouslySetInnerHTML (React documentation)', url: 'https://react.dev/reference/react-dom/components/common' },
  { id: 'ecma262', title: 'ECMAScript Language Specification, lexical grammar (TC39)', url: 'https://tc39.es/ecma262/' },
  { id: 'tsJsx', title: 'JSX (TypeScript Handbook)', url: 'https://www.typescriptlang.org/docs/handbook/jsx.html' },
  { id: 'dotenv', title: 'dotenv (the README of the package)', url: 'https://github.com/motdotla/dotenv' },
  { id: 'rfc4180', title: 'RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files', url: 'https://www.rfc-editor.org/rfc/rfc4180' },
  { id: 'rfc8259', title: 'RFC 8259, The JSON Data Interchange Format', url: 'https://www.rfc-editor.org/rfc/rfc8259' },
  { id: 'owaspCsv', title: 'CSV Injection (OWASP)', url: 'https://community.owasp.org/attacks/CSV_Injection' },
  { id: 'githubCommands', title: 'Workflow commands for GitHub Actions (GitHub Docs)', url: 'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands' }
];

export const source = (id) => SOURCES.find((s) => s.id === id);

// What a page says, in this project's own words. Each point names its page.
export const POINTS = {
  eip55Checksum: { source: 'eip55', text: 'an address is checksummed by hashing its 40 lowercase digits with Keccak-256 and writing each letter in upper case where the digit of the hash at its place is 8 or more; all lower and all upper case stay valid with no checksum' },
  eip712Domain: { source: 'eip712', text: 'the domain of typed data names the signing domain with name, version, chainId, verifyingContract and salt; a wallet should refuse to sign when chainId does not match the active chain, and verifyingContract names the contract that checks the signature' },
  eip712Readable: { source: 'eip712', text: 'typed data lets a wallet show the fields of a message to the user, where a signature of an opaque string of bytes shows nothing the user can check' },
  eip712NoReplay: { source: 'eip712', text: 'the standard itself has no replay protection, so the application has to bind the signature to its chain and contract and refuse a message it has seen' },
  eip1193ChainChanged: { source: 'eip1193', text: 'a provider emits chainChanged with the new chain id when the chain it is connected to changes, and the request method is the way to call the provider' },
  eip1193Legacy: { source: 'eip1193', text: 'the legacy provider API, with send and sendAsync, is kept in an appendix only for old applications, and its authors advise against implementing it' },
  eip1102Request: { source: 'eip1102', text: 'a dapp asks for accounts with the eth_requestAccounts method, which may show the user a prompt, and ethereum.enable() is deprecated in its favour' },
  eip1102Legacy: { source: 'eip1102', text: 'the previous generation of browsers injected a provider with accounts and no consent of the user, which let any site see the accounts and start transactions' },
  eip2612Permit: { source: 'eip2612', text: 'a permit is a signed message with owner, spender, value, nonce and deadline that sets an allowance like approve does, bound to the token by its domain' },
  eip20Approve: { source: 'eip20', text: 'approve lets the spender withdraw from the account again and again, up to the value given' },
  eip155ChainId: { source: 'eip155', text: 'the chain id is part of what a transaction signs, so that a transaction for one chain cannot be replayed on another' },
  eip721Metadata: { source: 'eip721', text: 'the tokenURI of a token points to metadata JSON with a name, a description and an image that the contract decides, and the URI may change over time' },
  bip39Phrase: { source: 'bip39', text: 'a mnemonic has 12, 15, 18, 21 or 24 words of a list of 2,048, each standing for 11 bits, and its last bits are a checksum taken from the SHA-256 hash of the entropy' },
  bip39List: { source: 'bip39English', text: 'the English word list holds 2,048 words in a fixed order, one per line, and the index of a word is its place in the list' },
  ethSignPrefix: { source: 'ethJsonRpc', text: 'eth_sign signs with the prefix of an Ethereum signed message, eth_chainId returns the chain id used for replay protection, and eth_accounts returns the addresses of the client' },
  keysNeverShared: { source: 'ethSecurity', text: 'a recovery phrase or a private key is never to be shared for any reason, and never kept in digital form such as a screenshot' },
  limitApprovals: { source: 'ethSecurity', text: 'an unlimited spending limit lets a contract take every token of the kind from the wallet, so approvals are to be limited to what the transaction needs' },
  phraseOffline: { source: 'ethWallets', text: 'the seed phrase of a wallet is written down and kept offline, never on a computer, because whoever holds it holds the account' },
  finality: { source: 'ethPos', text: 'a block is final only after about two epochs, when two checkpoints are justified in a row; until then a short reorganization of the chain can still drop it' },
  mmTypedData: { source: 'mmSignData', text: 'eth_signTypedData_v4 gives the most readable signatures that are efficient to check on chain, personal_sign suits text such as Sign-In with Ethereum, and eth_sign is deprecated' },
  mmEthSignRemoved: { source: 'mmMip3', text: 'eth_sign lets a site have a user blindly sign any hash, a transaction included, so MetaMask removes the method and answers it with an error' },
  mmRequestAccounts: { source: 'mmRequestAccounts', text: 'eth_requestAccounts asks the user for access to addresses and returns the addresses the user allowed' },
  mmEthAccounts: { source: 'mmAccounts', text: 'eth_accounts returns only the addresses the user has already allowed, and eth_requestAccounts is the advised way to get that permission' },
  mmChainChanged: { source: 'mmProvider', text: 'the provider of MetaMask follows EIP-1193 and emits chainChanged with a hexadecimal chain id, which an application listens to for the network of the user' },
  mmSwitch: { source: 'mmNetworks', text: 'an application reads the current chain, listens for chainChanged and asks the wallet to switch networks, and handles a user who rejects the switch' },
  ethersMax: { source: 'ethersConstants', text: 'MaxUint256 is the constant for the largest value of a uint256' },
  ethersWait: { source: 'ethersProviders', text: 'wait and waitForTransaction take a number of confirmations, one by default, and with zero they may return before the transaction is mined' },
  viemWaitConfirmations: { source: 'viemWait', text: 'waitForTransactionReceipt takes the number of confirmations to wait for, one by default' },
  viemTypedData: { source: 'viemSignTypedData', text: 'signTypedData of viem takes the domain, the types, the primary type and the message of an EIP-712 signature in one object' },
  secretsNotInCode: { source: 'owaspSecrets', text: 'secrets hard coded in source and configuration files are a common leak; .env files are not to be committed, and client-side code is not to hold secrets at all' },
  secretsRotate: { source: 'owaspSecrets', text: 'a secret that leaked is revoked and rotated, and removed from the code, the logs and the history' },
  xssSinks: { source: 'owaspXss', text: 'innerHTML, outerHTML and document.write treat their value as HTML, so a variable is not to be put there, and HTML that must be shown is cleaned first, such as with DOMPurify' },
  reactDangerous: { source: 'reactCommon', text: 'dangerouslySetInnerHTML takes raw HTML in __html, and HTML that does not come from a fully trusted source opens the page to cross-site scripting' },
  lexical: { source: 'ecma262', text: 'whether a slash starts a division or a regular expression literal depends on where it stands, and template literals have substitutions in ${...} between their fixed parts' },
  tsxAssertions: { source: 'tsJsx', text: 'in a .tsx file an angle bracket starts JSX, so the type assertion <T>x is not allowed there and as is used instead' },
  dotenvFormat: { source: 'dotenv', text: 'an env file holds KEY=value lines, # starts a comment unless the value is quoted, and the file is not to be committed' },
  csvRecords: { source: 'rfc4180', text: 'each record of a CSV file is on its own line, ended by CRLF, the first line may be a header, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice' },
  csvInjection: { source: 'owaspCsv', text: 'a spreadsheet may read a cell that starts with =, +, -, @, a tab, a carriage return or a line feed as a formula, and no one escape is safe in every program that opens the file' },
  jsonUtf8: { source: 'rfc8259', text: 'JSON text exchanged between systems must be UTF-8' },
  jsonRepeatedNames: { source: 'rfc8259', text: 'when an object repeats a name the behavior of the software that reads it cannot be predicted, so the JSON reader of this tool refuses a repeated name' },
  githubAnnotations: { source: 'githubCommands', text: 'a line of output such as ::warning file=...,line=...::message becomes an annotation on that file and line in the run' }
};

// The page of a point.
export const pointPage = (key) => source(POINTS[key].source);

// The levels of a finding, from the lowest.
export const LEVELS = ['info', 'warning', 'error'];

// The sentence every report ends with, before the result.
export const NOTICE = 'This check reads the source, JSON and env files on disk as text and runs nothing, calls no node and fetches nothing; the checks are a heuristic, and no secret value is shown. A finding is a lead with a file and a line for a review of how the app talks to wallets and chains, and a clean result is not a security audit and not a guarantee that the app is safe (docs/limits.md).';
