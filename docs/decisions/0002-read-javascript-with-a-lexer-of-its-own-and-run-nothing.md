# 2. Read JavaScript with a lexer of its own, and run nothing

## Status

Accepted

## Context

The facts the checks need sit in the text of the front end: the strings that hold keys and addresses, the calls of
approve, signTypedData and personal_sign, the domains of typed data, the waits, the HTML sinks, and the maps of
addresses in JSON files. A parser of the language or a bundler would see more: the full syntax tree, the imports, the
types. But a parser library brings code the project does not review and changes with the language, a type checker
needs the project installed, and a bundler runs plugins of the project, which is running its code.

Regular expressions over the raw text break in the places that matter: `eth_sign` in a comment, `window.web3` in the
text of a paragraph of JSX, an approval inside a template, a slash that starts a regular expression and hides the rest
of the line, a key in a string that a pattern of the code must not read as code but a rule on secrets must read as a
value. They also take a very long time on hostile input.

## Decision

1. Files are read by src/lexer.js, a lexer of the tool's own that turns the text into tokens in one pass, sets comments,
   regular expressions and the text of JSX elements aside, and keeps the value of every string and the fixed parts of
   every template, so that the checks of the code never read a literal as code and the rules about values still read
   every literal.
2. A slash starts a regular expression where an expression may start, as the lexical grammar of ECMAScript decides from
   the context; JSX is read in JavaScript and `.tsx` files and never in `.ts` files, where `<T>x` is a type assertion.
3. Templates, JSX elements and the braces inside them are read with a stack of the lexer's own, with no recursion and a
   limit of nesting; every bracket of a file is matched once.
4. JSON files are read with the same lexer and a forgiving reader of values, because the JSON of a front end often has
   comments; the configuration of the tool is read by a strict reader of RFC 8259.
5. The tool builds nothing, resolves no import, installs nothing, runs no script and calls no node. A check reads the
   tokens of the file and the facts of the other files, and nothing else.
6. Keccak-256, the checksum of EIP-55 and the BIP-39 English list are part of the tool, so that it needs no dependency;
   the hash is tested against known values and the test addresses of EIP-55, and the list against the SHA-256 of the
   published file.
7. The checks are a heuristic over the text as written, and every report says so; docs/method.md says what each rule
   reads and docs/limits.md what it cannot see.

## Consequences

- The tool needs no install and no network, reads a project that does not build, runs in seconds on a large front end,
  and the same files give the same report on Linux, Windows and macOS.
- What only the running app or a type checker knows (the value of a variable, a type, a module of another file) is not
  seen; a clean result is not a security audit and not a guarantee that the app is safe.
- Unusual code may be read differently from the grammar in places docs/limits.md lists, such as a slash after the brace
  that ends an object literal; the damage stops at the end of the line.
