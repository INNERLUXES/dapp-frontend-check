# Limits

The tool is not an auditor: it reads the source, JSON and env files of a decentralized app from disk, as text. Its
result is an input to a review of how the app talks to wallets and chains, not a security audit and not a guarantee
that the app is safe. It runs nothing, builds nothing, installs nothing, calls no node, queries no chain, fetches
nothing and asks nobody anything. A finding points at a line that needs a look, and a run without findings says only
that the folder holds none of the forms of docs/method.md. Every report ends with a sentence that says so.

## What it cannot see

- **What runs.** No code runs and nothing is bundled, so the value of a variable, a function that builds a message, an
  address read from an API, a key fetched at run time and the code a bundler adds are not seen. The checks are a
  heuristic over the text.
- **Other files.** A name is followed to its declaration only inside its own file. A domain, a message or an amount
  built in another module, a hook or a library is not read; a check of the chain in another file does not count for
  this one.
- **Types.** TypeScript is read for its tokens; types are not checked, and a name typed as a provider or a signer is
  known only by its name.
- **Secrets in other shapes.** A private key in base64, in a keystore file, split in parts or under a name with none of
  the words of docs/method.md; a seed phrase in another language, in upper case or split over strings; an API key in
  the host name of an RPC address or shorter than 20 characters in its path. Whether a key or a phrase holds anything is
  not known, and no value is ever looked up.
- **The chain.** No node is called: whether an address holds a contract, whether it is the one deployed, which chain a
  wallet is on, and what a contract does with a signature are not known.
- **Libraries.** wagmi, viem, ethers and wallet kits check and switch chains, sign and wait in ways of their own. The
  tool reads the calls it names in docs/method.md; a library that checks the chain for you is not seen, so
  `chain-not-checked` is a note.
- **Other frameworks.** Vue, Svelte and Angular templates are not read; their script parts are read only when an
  include pattern names them, as JavaScript.
- **Words.** Whether a name means what its words say: a variable named `description` that holds text the app wrote, or
  metadata held in a name with other words, is read by its name.
- **Time.** The tool reads no clock and no dates
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **Whether a finding matters to you.** A project may make up for a finding in a way the tool cannot see, such as an
  RPC key restricted to its domain. Set the level of a rule, or turn it off, in the configuration.

## The readers

- The lexer of src/lexer.js decides whether a slash starts a regular expression from the token before it. Code where
  the grammar needs more context (a regular expression after the `}` that ends an object literal, or a division right
  after a block) can be read the other way; the damage stops at the end of the line, where an unclosed literal ends.
- In `.tsx` files, a generic arrow function written `<T,>(x) => x` where an expression starts is read as JSX. In `.ts`
  files no JSX is read.
- A string that is not closed ends at its line, and a comment that is not closed runs to the end of the file. A value
  is read up to 65,536 characters.
- The JSON reader is forgiving: it reads JSON with comments and trailing commas, and what it cannot place it passes
  over, with no finding.
- Some checks look at a window of tokens: the arguments of a call, the entries of an object and the value of a name are
  looked at up to 1,024 tokens (`LOOKAHEAD`), and the bracket around a token up to 64 levels, so that nested hostile
  input cannot make the work grow with the square of its size. Code written by people never comes near it.
- A file is read as UTF-8, with or without a byte order mark, or as UTF-16 with its byte order mark; UTF-16 with no
  mark, and any other encoding, is an `unreadable-file` finding.

## Size limits

Past a limit, the input is refused with exit code `2` and no result, a file is an error finding, or the listing stops
with a `scan-limit` finding.

| What | Limit |
| --- | --- |
| a file to read | 4 MB; a larger one is an `unreadable-file` finding |
| the configuration | 1 MB |
| files and folders of the folder listed | 50,000 |
| folders nested | 32 deep |
| files to read | 5,000 |
| tokens of a file | 400,000 |
| a name or a number | 1,024 characters |
| templates, JSX elements and braces in them nested in a file | 256 deep |
| values nested in a JSON file | 256 deep |
| the value of a string read | 65,536 characters |
| tokens looked at for the arguments of a call, an object or the value of a name | 1,024 |
| entries of a list of the configuration | 200 |
| exclude patterns | 100, of up to 200 characters |
| findings of one rule | 500 listed; the rest are counted in a note and still count for the result |
| problems of the input | 20 listed; the rest are counted |

The tests check thousands of calls, approvals, signatures, keys and addresses, runs of hundreds of thousands of
brackets, quotes, comments, templates, JSX tags, names, calls and members, nesting past the limits, long strings,
phrases, env files and names, and folders nested past the limit, each with a time check.
