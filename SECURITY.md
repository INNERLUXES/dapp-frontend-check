# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "dapp-frontend-check security", or use private vulnerability
reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up file or configuration that shows the problem, the command you ran, what you expected and what
happened. Use made-up apps, addresses and people, never the code of a live app that holds funds, and never a real key,
mnemonic or API key, even an old one: build a key from a repeated pattern, as the examples do.

## Scope

In scope:

- an input that makes the tool show the value of a private key, a seed phrase or the key of an RPC address in any
  format or error message
- an input that makes the tool read a file outside the folder and the configuration it was given, follow an import, or
  follow a symbolic link or a junction
- an input that makes the tool open a network connection, call a node or an RPC address it reads, fetch a URL, run any
  part of a file or a script of package.json, run any other program, or evaluate anything it reads
- an input that makes the tool write a file
- an input that makes the tool hang, take very long, exhaust the stack or use unbounded memory, such as very large
  files, folders with very many files or folders, templates, JSX elements or JSON values nested deep, or long runs of
  brackets, quotes, comments, slashes, tags or names
- binary or invalid input that the tool reads as if it were source
- a file the tool fails to read and passes over without an error finding
- a comment, a regular expression or the text of a JSX element that a check of the code reads as code
- a form that docs/method.md says is reported but that a form of code it says it reads hides from the tool
- a run that passes at a `failOn` level although the input holds a finding at that level that docs/method.md says is
  reported
- text from a file or a file name that rewrites the terminal through control or direction characters, starts or ends a
  GitHub workflow command, is shown unescaped in the output, or starts a formula in the CSV report
- a name such as `__proto__` that changes how objects behave inside the tool

Out of scope: the forms docs/limits.md says the tool does not see, whether the app is safe (a clean result is not a
security audit and not a guarantee that the app is safe), who may change the configuration in your repository, and
where your pipeline keeps the output.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
