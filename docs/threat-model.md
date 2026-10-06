# Threat model

## What the tool touches

- It reads the files below the folder named on the command line that the include patterns name (JavaScript,
  TypeScript, JSON and env files by default), and the configuration named with `--config`. It lists the folders to find
  them. Nothing else is opened: no import is followed and no package is installed.
- It writes the report to standard output and its errors to standard error. It writes nothing to disk.
- It opens no network connection, calls no node and no RPC address it reads, fetches no URL it reads, follows no
  symbolic link, builds nothing, runs nothing it reads, evaluates nothing and reads no clock.

## What the input may hold

The files come from a repository, and in a pipeline that checks every pull request they may be written by whoever opened
the pull request. Through them, a person can try to:

- make the tool read outside the folder or fetch something: a symbolic link or a junction in the folder, a link named
  on the command line, a file swapped for a link between the listing and the read, an import of a path outside the
  folder or of a web address, an RPC address that the tool might call, a folder path written as a web address;
- make the tool run something: code in a file, a script of package.json, a value of an env file built to look like a
  command, a template or a regular expression;
- make the tool show a secret: a key, a phrase or an RPC key that a report would copy into a log of the pipeline, which
  more people can read than the repository;
- exhaust the memory, the stack or the time: files of megabytes, folders with tens of thousands of files, folders nested
  very deep, templates, JSX elements or JSON values nested very deep, runs of hundreds of thousands of brackets, quotes,
  comments, slashes, tags, names or calls, strings of megabytes, thousands of findings;
- move the result: a rule set to off, `failOn` raised, an exclude pattern that leaves out the file with the problem, code
  written in a form the heuristic does not read, a comment, a regular expression or JSX text that looks like code;
- slip in something that is not text: a binary file named `*.ts`, bytes that are not valid UTF-8 or UTF-16;
- rewrite the terminal or break the output: control characters, ANSI escapes, direction controls and line separators in
  a file name, a key of a JSON file or a name of an env file;
- start a second workflow command: a text that holds `::error`, `%`, a comma, a colon or a line break, which the GitHub
  format writes into a command;
- hide a formula in the CSV report: a file name or a key that starts with `=`, `+`, `-` or `@`, which a spreadsheet may
  run when the report is opened;
- change how objects behave: a variable, a key of a JSON file or a name of an env file called `__proto__`,
  `constructor` or `toString`.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A symbolic link makes the tool read outside the folder or walk a loop | Every link met in the listing is counted and none is followed, and a link named on the command line is refused; each file is opened with `O_NOFOLLOW` where the system has it and its type is taken from the open handle. Imports are never resolved. Tests put links to a file and to a folder in the folder |
| The tool fetches, connects or runs something | No module of the network or of child processes is imported, nothing is evaluated, an RPC address is only read as text, and a path that looks like an address is refused. A test checks the imports of src |
| A report shows a secret | The checks write where a value is and the name around it, never the value; only addresses are shown. A test puts keys, phrases and RPC keys in code, JSON and env files and looks for them in every format, with and without `--explain`, and the example script fails when a made-up secret of the examples reaches any output |
| A comment, a regular expression or JSX text hides code from the checks, or looks like code to them | The lexer turns comments, regular expressions and the text of JSX elements into no token, and strings into tokens that only the rules about values read; tests put the patterns of the rules in comments, strings, regular expressions and JSX text |
| The memory, the stack or the time is exhausted | Files have a size limit checked on the open handle before they are read; the listing has limits of entries, depth and files; the lexer reads each character a bounded number of times and has limits of tokens, of the length of names and of nesting; the JSON reader and its walk keep stacks of their own, with no recursion and a limit of nesting; the checks look at a window of 1,024 tokens and read each HTML sink once; findings are capped per rule. Tests check the time, with limits that widen under coverage only |
| A pattern from the input is slow | No regular expression is built from the input or the configuration; include and exclude patterns are matched by a small matcher of the tool's own, and the fixed patterns run once over a value of at most 65,536 characters. A test looks for `new RegExp` in src |
| The result is moved through the input or the configuration | A file that cannot be read and input past the limits are error findings that cannot be set off; a rule set to off and every include and exclude pattern are named in the report. Review a change to the configuration like a change to code (docs/secure-defaults.md) |
| A binary file or bytes in another encoding are read as text | A null byte in UTF-8, an odd number of bytes or a broken pair in UTF-16, and bytes that are not valid make the file an error finding |
| Text from the input rewrites the terminal | Every text, file names, keys and names included, goes through `safeText`, which removes control, line separator and direction characters and caps the length. A test puts escapes, direction controls and line separators in names, in every format |
| A text starts a second workflow command | The GitHub format escapes `%`, CR and LF in a message and `:` and `,` in a property; a line break never reaches a command. A test writes `%0A::error file=` and a line break with `::warning::` into a key |
| A formula runs when the CSV report is opened | A field that starts with `=`, `+`, `-`, `@`, a tab, a carriage return or a line feed gets a single quote in front. The OWASP page on CSV injection says no one escape is safe in every program, so treat a report built from files you do not trust as untrusted data, and open it with formulas off |
| `__proto__` changes how objects behave | Names are kept in Map objects, sets and lists of entries, keys are looked up with `Object.hasOwn`, and the strict JSON reader defines own properties. A test uses `__proto__`, `constructor` and `toString` as names, keys and env names |
| A device or a pipe hangs the tool | A path that is not a regular file or folder is refused before it is read, and the listing passes over every entry that is not a file or a folder |
| The tool leaves files behind | Nothing is written to disk; there is no cache, no temporary file and no log. A test checks that a run leaves the folder as it was |

## Out of scope

Whether the app is safe, what it does when it runs, what the contracts it calls do, the forms of code docs/limits.md
leaves out, who may change the configuration in your repository, and where your pipeline keeps the output.

A clean result is not a security audit and not a guarantee that the app is safe.
