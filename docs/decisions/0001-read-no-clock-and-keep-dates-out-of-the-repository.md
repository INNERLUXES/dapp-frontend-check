# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

A check of a dApp front end tempts a tool to look at the calendar: how old a library is, whether a provider still
serves an old method, which edition of a list of weaknesses was current, how long a key has been in the repository.
Each of these would make the same files give a different result on a different day, so a pipeline that passed
yesterday could fail today with no change to the repository, and two people reading the same commit could see two
reports. The output could never be saved and compared.

The checks do not need a date. Whether a value looks like a key, whether an approval is unlimited, whether a domain has
a chain id and whether an address matches its checksum can all be read from the files as they are. The public pages the
rules rest on are named by addresses that hold no year: the Ethereum Improvement Proposals by their number, the BIP
repository on its main branch, and the documentation of MetaMask, ethers and viem at their current addresses.

## Decision

1. The tool reads no clock, no time zone and no locale. It never prints the current time and never says when a page, a
   method or a list was published. The same files and configuration give the same output on every machine and on every
   day.
2. No file of this repository holds a date or a number that reads like a year: not the licence, not the changelog, not
   the documents, not the comments of the code, not the tests, not the examples. `npm run check` and a test fail on any
   word of four digits that starts with 19 or 20.
3. A version, a number of an EIP, a chain id and an address are not a year and are not caught: 1.0.0, 6.13.0, EIP-1193,
   11155111 and an address of 40 hexadecimal digits hold no word of four digits that starts with 19 or 20. A test of
   test/repo.test.js runs the pattern over such values and checks that none of them is caught, and that a year in the
   same place still is; the pattern is the same in the tests and in tools/check.mjs. The size of the BIP-39 list is
   written 2,048, with its comma.
4. The sources are chosen with addresses that hold no year, and the notes on them name no publication date.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change, because it does
  not move with the calendar.
- The report holds no date and no deadline; a team puts dates in its own plan.
- A method a wallet drops changes nothing until the rules are changed in a release, with a test.
- The limits of the tool are chosen so that none of them reads like a year, and a check catches one that does.
