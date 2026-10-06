# Fernhollow Tickets: a front end that follows every rule

A made-up ticket booth sells tickets through a small front end. It keeps the address of its booth in one map by chain,
leaves the key of its RPC address out of the repository, asks for accounts with `eth_requestAccounts` when the user
clicks, reads the chain and switches it, listens for `chainChanged`, approves the exact price of a ticket, signs a
resale as EIP-712 typed data with a domain bound to the chain and to the booth, signs in with a Sign-In with Ethereum
message, waits for the confirmations its network setting asks for, and cleans the description of a ticket before it
shows it as HTML. The report has no finding, and the run passes at every level.

```
node bin/dapp-frontend-check.js examples/clean
```

The imports name packages that are not here: the tool reads the files as text and never resolves an import. The booth,
its contracts, its hosts on the reserved `.test` domain and every name are made up. The files are made-up input for the
tool, not code of this repository, and they are never built or run.
