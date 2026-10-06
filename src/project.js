// The checks that need the whole project: the checksum of every address, an address written in several files instead
// of one map, a contract name mapped to two addresses for one chain in two configuration files, eth_accounts with no
// request for accounts anywhere, and a wait for zero or one confirmation where a setting asks for more. Each file gives
// its facts with their file, line and column; the checks here only compare them.

import { checksumState, toChecksumAddress } from './keccak.js';
import { placeholderAddress } from './strings.js';
import { asciiLower, byCode } from './words.js';

const at = (x) => `${x.file}:${x.line}`;

// The findings of the project: [{ rule, file, line, column, found }]. files is a list of { file, kind, facts } where kind
// is 'code', 'json' or 'env' and every fact has its line and column.
export function analyzeProject(files) {
  const out = [];
  const add = (rule, x, found) => out.push({ rule, file: x.file, line: x.line, column: x.column, found });

  // The checksum of EIP-55, and where each address is written.
  const byAddress = new Map();
  for (const f of files) {
    for (const a of f.facts.addresses ?? []) {
      if (placeholderAddress(a.address)) continue;
      if (checksumState(a.address) === 'invalid') add('address-checksum', { ...a, file: f.file }, `the address ${a.address} mixes upper and lower case but does not match the EIP-55 checksum, which is ${toChecksumAddress(a.address)}; a typo in one digit would read the same`);
      const key = asciiLower(a.address);
      if (!byAddress.has(key)) byAddress.set(key, []);
      byAddress.get(key).push({ ...a, file: f.file, kind: f.kind });
    }
  }
  for (const places of byAddress.values()) {
    const maps = [...new Set(places.filter((p) => p.kind !== 'code').map((p) => p.file))].sort(byCode);
    const code = places.filter((p) => p.kind === 'code');
    const codeFiles = [...new Set(code.map((p) => p.file))].sort(byCode);
    if (maps.length) {
      for (const p of code) add('address-repeated', p, `the address ${p.address} is written here and is also in ${maps[0]}${maps.length > 1 ? ` and ${maps.length - 1} more` : ''}; read it from that map, so a change of address is made once`);
    } else if (codeFiles.length >= 2) {
      const home = code.find((p) => p.file === codeFiles[0]);
      for (const p of code.filter((x) => x.file !== codeFiles[0])) add('address-repeated', p, `the address ${p.address} is written here and also at ${at(home)}; keep it in one map of addresses by chain, so a change of address is made once`);
    }
  }

  // A contract name mapped to two addresses for one chain in two files.
  const groups = new Map();
  for (const f of files) {
    for (const e of f.facts.mapEntries ?? []) {
      const key = `${e.chain}\u0000${asciiLower(e.name)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ ...e, file: f.file });
    }
  }
  for (const entries of groups.values()) {
    const sorted = [...entries].sort((a, b) => byCode(a.file, b.file) || a.line - b.line);
    const base = sorted[0];
    for (const e of sorted) {
      if (e.file !== base.file && asciiLower(e.address) !== asciiLower(base.address)) add('address-conflict', e, `${e.name} on chain ${e.chain} is ${e.address} here and ${base.address} at ${at(base)}; one of the two configurations sends users to the wrong contract`);
    }
  }

  // eth_accounts with no request for accounts in the project.
  if (!files.some((f) => f.facts.requestFlow)) {
    for (const f of files) for (const x of f.facts.ethAccounts ?? []) add('legacy-wallet-api', { ...x, file: f.file }, 'eth_accounts is read and nothing in the project asks for accounts with eth_requestAccounts (EIP-1102), so the code counts on accounts the wallet shows with no request, as old wallets did');
  }

  // Waits for zero or one confirmation where a setting asks for more.
  const settings = files.flatMap((f) => (f.facts.confirmations ?? []).map((c) => ({ ...c, file: f.file }))).filter((c) => c.value >= 2);
  if (settings.length) {
    const setting = [...settings].sort((a, b) => b.value - a.value || byCode(a.file, b.file) || a.line - b.line)[0];
    for (const f of files) {
      if (!f.facts.valueTransfer) continue;
      for (const w of f.facts.waits ?? []) {
        if (w.confirmations > 1) continue;
        add('low-confirmations', { ...w, file: f.file }, `${w.call} waits for ${w.confirmations} confirmation${w.confirmations === 1 ? '' : 's'} in a file that moves value, while ${setting.name} at ${at(setting)} asks for ${setting.value}`);
      }
    }
  }
  return out;
}
