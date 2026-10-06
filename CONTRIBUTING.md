# Contributing

Every change goes through a pull request and is reviewed before it is merged. The pipeline runs the tests on Linux,
Windows and macOS with Node 22 and 24, the tests with coverage, the repository checks, CodeQL, and a secure
development check of the repository itself.

Commit messages in this repository follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`,
with `!` for a breaking change.

This tool reads the source, JSON and env files of a dApp on disk as text and runs nothing; its result is an input to a
review of how the app talks to wallets and chains, not a security audit and not a guarantee that the app is safe. A
change must keep it that way: a rule reports what a file holds, the tool never fetches, builds, runs, calls a node or
evaluates what it reads, and it never shows a secret value.

## Changing a rule

1. Describe the change in docs/method.md first: what the rule looks at and what it can and cannot see, and add what it
   cannot see to docs/limits.md. Where the tool makes its own choice, say so in `own` in src/rules.js and say why.
2. Keep the rules to what is written. A finding must point at something a reader can check in a file: a line and a
   column. Never add a rule that needs the network, a node, a build or the clock.
3. A rule about a secret names where the value is and the name around it, never the value. A test looks for the value
   in every format.
4. A rule says what to change, in `fix` in src/rules.js, and names the points of the public pages it rests on in
   `basis`; a new page goes into src/data.js and research/sources.md, and docs/rules-and-sources.md lists it.
5. A run must never pass because something could not be read: a file that cannot be read and input past the limits
   are error findings, and those two rules keep no key in the configuration.
6. Add a test with the code written inline (`findingsIn()`, `ofRule()`, `rulesIn()`, `projectFindings()`, `SITE`,
   `siteWith()`, `reportOf()` and `run()` in test/helpers.js), small enough to work out by hand, with a near miss on
   each side: the form that is reported and the form next to it that is not, and the pattern in a comment, a regular
   expression or JSX text.
7. A rule id, once released, keeps its meaning: pipelines and other tools read it from the JSON output, the CSV report
   and the GitHub annotations.

## Changing the readers

1. The lexer (src/lexer.js), the JSON reader and its walk (src/tree.js), the pattern matcher (src/glob.js) and the
   listing of the folder (src/walk.js) keep lists of their own, never recursion, and read each character a bounded
   number of times; the JSON reader of the configuration (src/json.js) stops at 32 levels of nesting. Every check of
   src/code.js is a loop over the tokens of the file, with the brackets matched once; a look at the arguments of a
   call, an object or the value of a name stops at `LOOKAHEAD` tokens. A test in test/repo.test.js fails when a function
   of these files calls itself.
2. The readers stop at their limits with the place; they never guess past them. A form of code that is read is listed
   in docs/method.md, and a form that is not in docs/limits.md.
3. No pattern is built from a file or the configuration, and no key of the configuration takes a regular expression.
   A test fails when `new RegExp` appears in src outside src/text.js.
4. The tables of names in src/code.js, src/strings.js and src/settings.js are the tool's own and are listed in
   docs/method.md; a change to them is a change to the rules.
5. Keccak-256 (src/keccak.js) is tested against known hashes, the SHA3-256 of Node over several blocks and every test
   address of EIP-55; the BIP-39 list (src/wordlist.js) against the SHA-256 of the published english.txt. Keep both
   tests when you touch them.
6. A time check in a test widens under coverage: read `process.env.NODE_V8_COVERAGE`, which the test runner sets only
   when coverage is on, and allow four times the time. Never read the flags of the process for this, because they hold
   the coverage flags of the runner in every run. Run `npm run test:coverage` before you open the pull request.
7. A file written with LF, CRLF or CR line ends, as UTF-8 with or without a byte order mark or as UTF-16 with one, must
   give the same output. The example files are stored as written (`.gitattributes`), and a test reads them with CRLF
   line ends and as UTF-16.

## Changing the configuration file

A new key is added to `KEYS` in src/config.js, documented in docs/inputs.md and tested with a good value and a bad one.
Every key the tool does not know stays an error, and a key named twice stays refused.

## Changing a source

1. Every point the reports show is in src/data.js, written in this project's own words, with the page it comes from. A
   short phrase of a page may be named; a long quotation may not.
2. research/sources.md lists every page with a note on what it says, and docs/rules-and-sources.md lists every rule
   with its points and what to change. A test checks all three against each other. Fetch and read a page before it is
   listed, leave out a web address that holds a number that reads like a year, and never write a publication date or
   the year of an edition.

## The examples

The files under `examples/` are made-up input for the tool: minimal illustrations of the patterns, never built or run,
with made-up names, hosts on the reserved `.test` domain and no real protocol, company or person. A key in them is a
short pattern repeated (`deadbeef`), a phrase is one word of the list repeated, and an API key is a made-up pattern;
`npm run check` fails on a value of 64 hexadecimal digits that is not a repeated pattern and on a run of 12 words of the
BIP-39 list that is not one word repeated, and `npm run example` fails when one of these made-up values reaches an
output. A change to them goes with the real output that `npm run example` writes to `examples/output`.

## Secrets in tests

A test never holds a real key or phrase. `fakeKey()` repeats a pattern, `counterKey()` builds a key from a counter,
`goodPhrase()` builds a phrase whose checksum holds from fixed entropy at run time, and `badPhrase()` repeats one word
(test/helpers.js).

## Tests that depend on the system

A test that depends on the operating system (a symbolic link, a device, file permissions) is guarded with
`process.platform`, says why in its `t.skip`, and asserts no line of its own: a line is asserted only in a test that
runs on every system, and is worked out there with `lineOf()` of test/helpers.js or from the text itself, never written
by hand. `test/repo.test.js` fails when a guarded test asserts a line. Every other test builds its paths with
`resolve()` from names with forward slashes.

A test never reads the clock, the time zone of the machine or the locale.

## Rules for the code

- No runtime dependencies and no development dependencies. Node 22 or newer and nothing else; the tests use `node:test`.
- The tool reads the files it is given and writes only to standard output and standard error. It opens no network
  connection, runs no program and evaluates nothing it reads.
- Text from the input, file names and keys included, goes through `safeText` before it reaches the output or an error
  message.
- Source files stay ASCII; write any other character as a Unicode escape, or build it from its code point.
- No file carries a date, and no file holds a number that reads like a year. Version numbers (Node 22, ethers 6.13.0,
  EIP-1193, RFC 4180) and chain ids are fine (decision 1).
- Plain words in the documents: `npm run check` fails on a short list of words that say little.

## Before you open the pull request

```
npm test
npm run test:coverage
npm run check
npm run example
```
