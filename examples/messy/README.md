# Quillmere Market: a front end to review

A made-up market for passes and a points token keeps its front end and a small seed script here: the wallet module,
the signing of listings and bids, the approval of the router, a card that shows the metadata of a pass, the maps of
contracts by chain, and its env files. The team wants a list of what to look at in how the app talks to wallets and
chains. The files are minimal illustrations of the patterns, not an app to run. They hold what such a list finds:

- in `.env.example`, a seed phrase for the deployer, made of one word of the BIP-39 list repeated twelve times, and a
  private key for the relayer, the pattern `deadbeef` repeated, next to a topic hash of the same shape that is not a
  key, and next to an RPC address whose key is the placeholder `YOUR_KEY`;
- in `scripts/seed-market.mjs`, the same made-up key as the fallback of `new Wallet(...)`;
- in `src/lib/rpc.ts`, an RPC address with a made-up key in its path, and next to it a provider that reads its address
  from the build;
- in `src/lib/addresses.ts`, the token address with the case of one letter changed, so its EIP-55 checksum fails, and
  the same token in the map of `src/config/contracts.json`;
- in `src/trade/approve.ts`, an approval of the router for `MaxUint256`, the router address written again although the
  map and the env file hold it, and a purchase with ether that waits for one confirmation while
  `src/config/networks.json` asks for three; next to them, an approval of the exact price;
- in `src/wallet/sign.ts`, a listing signed as typed data with a domain of a name and a version only, a bid signed with
  `personal_sign` as `JSON.stringify` of its fields, and a proof signed with `eth_sign`; next to them, a Sign-In with
  Ethereum message signed as text, which is right;
- in `src/wallet/connect.ts`, `window.web3`, `ethereum.enable()` and no look at the chain, with a note about the chain
  in a comment only;
- in `src/components/NftCard.tsx`, the description of the metadata given to `dangerouslySetInnerHTML`; next to it, the
  same description cleaned by DOMPurify, and text with apostrophes and `eth_sign` that is JSX text, not code;
- in `src/config/staging/contracts.json`, a router for chain 1 that differs from the one of `src/config/contracts.json`.

It also holds what must not be reported: `eth_accounts`, because `getSigner` of ethers asks for accounts elsewhere in
the project, an address all in lower case, a JSON file with comments and a trailing comma, a package under
`node_modules`, a bundle under `dist`, which the default exclude patterns leave out, and the folder `src/mocks`, which
`../config.json` leaves out. `../config.json` also raises `unstructured-signing` to a warning.

```
node bin/dapp-frontend-check.js examples/messy --config examples/config.json
```

The market, its contracts, its hosts on the reserved `.test` domain and every name are made up, and so is every key
and phrase: each is one short pattern or one word repeated, never a real key. The files are made-up input for the tool,
not code of this repository, and they are never built or run.
