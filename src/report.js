// The reports: text for a terminal, JSON for other tools, and GitHub workflow commands that turn each finding into an
// annotation on the file, line and column. The CSV report is in src/csv.js. Every text from the input (a file name, the
// name of a variable or a key, a host) was cleaned by safeText before it reached the report object, and no finding holds
// a secret value: the checks write where a key, a phrase or the key of an RPC address is, never the value. The GitHub
// commands also escape the characters a command gives a meaning to, so a text in the input cannot end a command early
// or start another one.

import { grouped, listText, plural } from './size.js';
import { safeText } from './text.js';

const clean = (t, max = 200) => safeText(t, max);

function inputLine(r) {
  const i = r.input;
  return [`${plural(i.files, 'file')} read (${grouped(i.codeFiles)} code, ${grouped(i.jsonFiles)} JSON, ${grouped(i.envFiles)} env)`, `${plural(i.otherFiles, 'other file')} passed over`, `${plural(i.foldersPassedOver, 'folder')} named .git or node_modules passed over`, `${plural(i.excluded, 'path')} excluded`, `${plural(i.links, 'link')} not followed`].join('; ');
}

function configLine(r) {
  const c = r.config;
  const where = c.file ? `${c.file}${c.name ? ` (${clean(c.name, 120)})` : ''}` : 'built-in defaults';
  const list = (items) => (items.length ? listText(items, 20) : 'none');
  return [`${where}: include ${list(r.input.include)}`, `exclude ${list(r.input.exclude)}`, `minimum severity ${c.minSeverity}`, `fail on ${c.failOn}`].join('; ');
}

const rulesLine = (r) => r.config.rules.map((x) => `${x.id} (${x.level})`).join('; ');

function findingsLine(r) {
  const b = r.totals.byLevel;
  const parts = ['error', 'warning', 'info'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.totals.findings)}${parts.length ? ` (${parts.join(', ')})` : ''}${r.totals.hidden ? `; ${grouped(r.totals.hidden)} below ${r.config.minSeverity} not shown` : ''}`;
}

// A table with a header row and its columns padded to the widest cell.
function table(head, rows, indent = '  ') {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => `${indent}${cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ')}`.trimEnd();
  return [line(head), ...rows.map(line)];
}

const PAD = ' '.repeat(11);

export function summaryLines(r) {
  const s = r.summary;
  return [
    `  files: ${grouped(s.files)} read, ${grouped(s.code)} JavaScript or TypeScript, ${grouped(s.json)} JSON and ${grouped(s.env)} env`,
    `  addresses: ${grouped(s.addresses)} written, ${grouped(s.distinctAddresses)} distinct`,
    `  wallet calls: ${plural(s.signatures, 'signature request')}, ${plural(s.sends, 'transaction send')}, ${plural(s.approvals, 'approval')}`,
    ''
  ];
}

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`dapp-frontend-check: ${r.input.folder}`);
  out.push(`input: ${inputLine(r)}`);
  out.push(`config: ${configLine(r)}`);
  out.push(`rules: ${rulesLine(r)}`);
  out.push(`findings: ${findingsLine(r)}`);
  out.push('', `Files (${grouped(r.files.length)})`, '');
  if (r.files.length) out.push(...table(['file', 'kind', 'addresses', 'error', 'warning', 'info'], r.files.map((f) => [f.file, f.kind, grouped(f.addresses), grouped(f.byLevel.error), grouped(f.byLevel.warning), grouped(f.byLevel.info)])), '');
  else out.push('  none', '');
  out.push('Summary', '', ...summaryLines(r));
  out.push(`Rules (${grouped(r.rules.length)})`, '');
  out.push(...table(['rule', 'level', 'findings'], r.rules.map((x) => [x.id, x.level, grouped(x.findings)])), '');
  out.push(`Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const width = Math.max(...r.config.rules.map((x) => x.id.length));
  for (const f of r.findings) {
    out.push(`  ${f.level.toUpperCase().padEnd(8)} ${f.rule.padEnd(width)}  ${f.at}`);
    out.push(`${PAD}${f.found}`);
    out.push(`${PAD}fix: ${f.fix}`);
    if (explain) {
      out.push(`${PAD}rule: ${r.config.rules.find((x) => x.id === f.rule).rule}`);
      for (const b of f.basis) out.push(`${PAD}basis: ${b.text} (${b.source}, ${b.url})`);
      if (f.own) out.push(`${PAD}the tool's own choice: ${f.own}`);
    }
    out.push('');
  }
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  out.push(r.notice, '');
  out.push(`RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}

export function toJson(r, { explain = false } = {}) {
  const out = { ...r, findings: r.findings.map((f) => (explain ? f : { ...f, basis: undefined, own: undefined })) };
  return `${JSON.stringify(out, null, 2)}\n`;
}

// The message of a workflow command: %, CR and LF escaped.
export const escapeData = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

// A property of a workflow command: also : and , escaped.
export const escapeProperty = (t) => escapeData(t).replace(/:/g, '%3A').replace(/,/g, '%2C');

const COMMANDS = { error: 'error', warning: 'warning', info: 'notice' };

export function toGithub(r) {
  const out = [];
  for (const f of r.findings) {
    const props = [`file=${escapeProperty(f.file)}`, `line=${f.line}`, ...(f.column ? [`col=${f.column}`] : []), `title=${escapeProperty(`dapp-frontend-check ${f.rule}`)}`];
    out.push(`::${COMMANDS[f.level]} ${props.join(',')}::${escapeData(`${f.found}; fix: ${f.fix}`)}`);
  }
  out.push(`dapp-frontend-check: ${plural(r.totals.files, 'file')}, ${plural(r.summary.distinctAddresses, 'distinct address', 'distinct addresses')}, ${plural(r.totals.findings, 'finding')}; RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}
