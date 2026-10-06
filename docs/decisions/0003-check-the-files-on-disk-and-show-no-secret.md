# 3. Check the files on disk, call no node, and show no secret

## Status

Accepted

## Context

Some facts about a dApp live elsewhere: whether an address holds the contract it should, which chain a wallet is on,
whether an RPC key works or is restricted to a domain, whether a key holds funds. A check could call the RPC addresses
it finds, query a chain, or look a key up. Each would need the network, would make the result depend on the state of a
chain or a server, would let a file in a pull request make the pipeline reach an address it names, and, for keys,
would use a secret it found.

A report also travels further than the repository: it is printed in the log of a pipeline, kept as an artifact, opened
in a spreadsheet and pasted into a ticket. A report that copies a key or a phrase it found makes the leak larger.

## Decision

1. The tool reads the files of the folder and the configuration, and nothing else. It fetches nothing, calls no node
   and no RPC address it reads, needs no key, runs no program and calls no service.
2. A finding about a secret names the file, the line, the column and the name around the value, and never the value:
   not in the text, JSON, CSV or GitHub output, not with `--explain`, not in an error message. The host of an RPC
   address is shown without its key; addresses, which are public, are shown in full.
3. The repository holds no real key and no real phrase. The made-up keys of the examples are one short pattern repeated
   and the made-up phrase is one word repeated; the tests build every other key and phrase at run time; and
   `npm run check` fails on a value of 64 hexadecimal digits that is not a repeated pattern or a known public digest,
   and on a run of 12 words of the BIP-39 list that is not one word repeated.
4. The words the checks compare (the names of keys, of RPC addresses, of unlimited amounts, of chain checks, of chain
   data and of sanitizers) are the tool's own and are listed in docs/method.md, and the public pages each rule rests on
   are named in src/data.js and research/sources.md, each fetched and read before it was listed; the tool never looks
   them up while it runs.

## Consequences

- The result depends only on the files, and a run needs no network access, no secret and no node.
- A finding of a key says where to look and nothing more: the reader opens the file to see the value, and rotates it.
- A deployed contract, a live wallet and the state of a chain are not checked; a review and a test against a test chain
  do that.
- When a library renames a call the checks compare, the lists in src/code.js are updated in a release, with a test.
