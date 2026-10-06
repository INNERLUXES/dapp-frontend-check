// A run: read the configuration, list the files of the folder, read each one, run the checks of src/code.js or
// src/settings.js on it, then the checks of src/project.js on the facts of every file, and build the report of the run.
// A path on the command line that cannot be used (missing, a link, a folder that is a file), an --exclude pattern that is
// not valid or a configuration with a problem stops the run with an InputError and no result. A file that cannot be
// read, and input past the limits of a run, are error findings of their own, so the run fails at the default level and
// never passes because a part of the input was passed over.

import { analyzeCode } from './code.js';
import { ConfigError, defaultConfig, pathPatternProblem, readConfig } from './config.js';
import { LEVELS, NOTICE, POINTS, pointPage } from './data.js';
import { FILE_LIMITS, inspectPath, readText, readTextFile } from './files.js';
import { lineStarts, positionOf } from './json.js';
import { LEX_LIMITS, LexError, allowsJsx, tokenize } from './lexer.js';
import { analyzeProject } from './project.js';
import { RULES, atOrAbove, decide } from './rules.js';
import { analyzeEnv, analyzeJson } from './settings.js';
import { grouped, listText, plural } from './size.js';
import { safeText } from './text.js';
import { WALK_LIMITS, walkFolder } from './walk.js';
import { asciiLower, baseName, byCode, joinPath } from './words.js';

export const LIMITS = { ...FILE_LIMITS, ...WALK_LIMITS, ...LEX_LIMITS, maxFindingsPerRule: 500, maxExcludes: 100 };
export const MAX_PROBLEMS = 20;

export class InputError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.problems = problems;
  }
}

// A list of problems for an error message: the first twenty, then a count.
export function capped(problems) {
  return problems.length > MAX_PROBLEMS ? [...problems.slice(0, MAX_PROBLEMS), `and ${grouped(problems.length - MAX_PROBLEMS)} more`] : problems;
}

// The level of a rule under a configuration: the rules of input problems are always errors.
export function levelOf(rule, config) {
  return rule.key === null ? 'error' : config.rules[rule.key];
}

// The line and column of every offset of a text.
export function placer(text) {
  const starts = lineStarts(text);
  return (offset) => positionOf(starts, Math.max(0, Math.min(offset, text.length)));
}

// The kind of a file by its name: 'env' for .env and .env.*, 'json' for *.json, and 'code' for every other file.
export function kindOfFile(path) {
  const name = asciiLower(baseName(path));
  if (name === '.env' || name.startsWith('.env.')) return 'env';
  if (name.endsWith('.json')) return 'json';
  return 'code';
}

// The counts of one file, and of a run when they are added up.
export const EMPTY_STATS = { addresses: 0, signatures: 0, sends: 0, approvals: 0 };

// Every fact of a file with its line and column in place of its offset.
function placeFacts(facts, place) {
  const out = {};
  for (const [k, v] of Object.entries(facts)) out[k] = Array.isArray(v) ? v.map((x) => ({ ...x, ...place(x.offset) })) : v;
  return out;
}

// Runs the checks on the text of one file: { findings: [{ rule, line, column, found }], facts, stats }. A file past a
// limit of the lexer is one scan-limit finding, with no facts.
export function checkText(text, kind, path = '', lim = LIMITS) {
  const place = placer(text);
  let result;
  try {
    if (kind === 'env') result = analyzeEnv(text);
    else {
      const { tokens } = tokenize(text, { jsx: kind === 'code' && allowsJsx(path), limits: lim });
      result = kind === 'json' ? analyzeJson(tokens, lim) : analyzeCode(tokens);
    }
  } catch (error) {
    if (error instanceof LexError) return { findings: [{ rule: 'scan-limit', ...place(error.offset), found: `the file holds ${error.reason}; nothing in it is checked` }], facts: {}, stats: null };
    throw error;
  }
  const facts = placeFacts(result.facts, place);
  const stats = { addresses: result.facts.addresses.length, signatures: result.facts.signatures ?? 0, sends: result.facts.sends ?? 0, approvals: result.facts.approvals ?? 0 };
  return { findings: result.findings.map((f) => ({ rule: f.rule, ...place(f.offset), found: f.found })), facts, stats };
}

// Reads one file and runs the checks. A file that cannot be read is one unreadable-file finding.
export async function checkFile(full, kind, path, lim = LIMITS) {
  let text;
  try {
    ({ text } = await readText(full, 'file', lim.maxFileBytes));
  } catch (error) {
    return { findings: [{ rule: 'unreadable-file', line: 1, column: 1, found: `the file cannot be read: ${error.reason ?? error.message}; nothing in it is checked` }], facts: {}, stats: null };
  }
  return checkText(text, kind, path, lim);
}

// The run as a report object.
export function buildReport({ input, files, summary, raw, config, minSeverity, failOn, version, notes: extraNotes = [], limits = LIMITS }) {
  const ruleOrder = new Map(RULES.map((r, i) => [r.id, i]));
  const levels = new Map(RULES.map((r) => [r.id, levelOf(r, config)]));
  const level = (id) => levels.get(id);
  const all = raw
    .filter((f) => level(f.rule) !== 'off')
    .map((f) => ({ ...f, level: level(f.rule) }))
    .sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || byCode(a.file, b.file) || a.line - b.line || a.column - b.column || ruleOrder.get(a.rule) - ruleOrder.get(b.rule) || byCode(a.found, b.found));
  const shown = all.filter((f) => atOrAbove(f.level, minSeverity));
  const hidden = all.length - shown.length;
  const perRule = new Map();
  const findings = [];
  let cut = 0;
  for (const f of shown) {
    const n = (perRule.get(f.rule) ?? 0) + 1;
    perRule.set(f.rule, n);
    if (n > limits.maxFindingsPerRule) {
      cut += 1;
      continue;
    }
    const rule = RULES.find((r) => r.id === f.rule);
    findings.push({
      rule: f.rule,
      level: f.level,
      file: safeText(f.file),
      line: f.line,
      column: f.column,
      at: `${safeText(f.file)}:${f.line}`,
      found: safeText(f.found, 800),
      fix: rule.fix,
      basis: rule.basis.map((k) => ({ text: POINTS[k].text, source: pointPage(k).title, url: pointPage(k).url })),
      own: rule.own
    });
  }
  const result = decide(shown, failOn);
  const perFile = new Map();
  const perRuleAll = new Map();
  for (const f of all) {
    if (!perFile.has(f.file)) perFile.set(f.file, { error: 0, warning: 0, info: 0 });
    perFile.get(f.file)[f.level] += 1;
    perRuleAll.set(f.rule, (perRuleAll.get(f.rule) ?? 0) + 1);
  }
  const shownFiles = files.map((x) => ({ file: safeText(x.file), kind: x.kind, addresses: x.stats.addresses, byLevel: perFile.get(x.file) ?? { error: 0, warning: 0, info: 0 } }));
  const rules = RULES.map((r) => ({ id: r.id, level: level(r.id), findings: perRuleAll.get(r.id) ?? 0 }));
  const notes = [];
  if (!input.files) notes.push('the folder holds no file that the include patterns name');
  if (input.links) notes.push(`${plural(input.links, 'symbolic link')} ${input.links === 1 ? 'is' : 'are'} not followed`);
  notes.push(...extraNotes);
  if (cut) notes.push(`${plural(cut, 'finding')} past the limit of ${grouped(limits.maxFindingsPerRule)} per rule ${cut === 1 ? 'is' : 'are'} counted but not listed`);
  if (hidden) notes.push(`${plural(hidden, 'finding')} below ${minSeverity} ${hidden === 1 ? 'is' : 'are'} not shown`);
  const off = RULES.filter((r) => r.key !== null && levelOf(r, config) === 'off');
  if (off.length) notes.push(`${plural(off.length, 'rule')} ${off.length === 1 ? 'is' : 'are'} off: ${off.map((r) => r.id).join(', ')}`);
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of shown) byLevel[f.level] += 1;
  return {
    tool: 'dapp-frontend-check',
    version,
    input: { ...input, folder: safeText(input.folder), include: input.include.map((p) => safeText(p, 200)), exclude: input.exclude.map((p) => safeText(p, 200)) },
    config: {
      file: config.file === null ? null : safeText(config.file),
      name: config.name === null ? null : safeText(config.name, 120),
      include: config.include,
      exclude: config.exclude,
      minSeverity,
      failOn,
      rules: RULES.map((r) => ({ id: r.id, key: r.key, level: levelOf(r, config), rule: safeText(r.rule(config), 600) }))
    },
    files: shownFiles,
    summary,
    rules,
    findings,
    totals: { findings: shown.length, byLevel, hidden, notListed: cut, files: files.length },
    result,
    notes: notes.map((n) => safeText(n, 600)),
    notice: NOTICE
  };
}

// Reads the inputs, runs every check and builds the report object of the run.
export async function checkFolder({ folder, config: configPath = null, exclude = [], minSeverity = null, failOn = null, version = '0.0.0', limits = LIMITS, base = process.cwd() }) {
  const lim = { ...LIMITS, ...limits };
  let config;
  try {
    if (configPath) {
      const c = await readTextFile(configPath, base, lim.maxConfigBytes);
      config = readConfig(c.text, c.file);
    } else config = defaultConfig();
  } catch (error) {
    if (error instanceof ConfigError) throw new InputError(capped(error.problems));
    throw new InputError([error.message]);
  }
  const problems = [];
  let root = null;
  try {
    root = await inspectPath(folder, base);
    if (!root.folder) problems.push(`${root.shown}: is a file; give the folder of the project, the one that holds its source`);
  } catch (error) {
    problems.push(error.message);
  }
  for (const p of exclude) {
    const problem = pathPatternProblem(p);
    if (problem) problems.push(`--exclude "${p.slice(0, 80)}" ${problem}`);
  }
  if (problems.length) throw new InputError(capped(problems));

  const patterns = [...new Set([...config.exclude, ...exclude])];
  const walked = await walkFolder(root.full, { include: config.include, exclude: patterns, limits: lim });
  const raw = [];
  const notes = [];
  if (walked.limit) raw.push({ rule: 'scan-limit', file: root.shown, line: 1, column: 1, found: `the folder holds ${walked.limit}; the listing stopped there, and the rest of the folder is not read` });

  const files = [];
  const read = [];
  const summary = { files: walked.files.length, code: 0, json: 0, env: 0, ...EMPTY_STATS, distinctAddresses: 0 };
  const distinct = new Set();
  for (const f of walked.files) {
    const shown = joinPath(root.shown, f.rel);
    const kind = kindOfFile(f.rel);
    const r = await checkFile(f.full, kind, f.rel, lim);
    for (const x of r.findings) raw.push({ ...x, file: shown });
    const stats = r.stats ?? EMPTY_STATS;
    summary[kind] += 1;
    for (const k of Object.keys(EMPTY_STATS)) summary[k] += stats[k];
    for (const a of r.facts.addresses ?? []) distinct.add(asciiLower(a.address));
    files.push({ file: shown, kind, stats });
    read.push({ file: shown, kind, facts: r.facts });
  }
  summary.distinctAddresses = distinct.size;
  raw.push(...analyzeProject(read));

  if (walked.excluded) notes.push(`${plural(walked.excluded, 'path')} matching ${listText(patterns, 5)} ${walked.excluded === 1 ? 'is' : 'are'} left out`);
  if (walked.skipped) notes.push(`${plural(walked.skipped, 'folder')} named .git or node_modules ${walked.skipped === 1 ? 'is' : 'are'} passed over`);
  return buildReport({
    input: { folder: root.shown, files: walked.files.length, codeFiles: summary.code, jsonFiles: summary.json, envFiles: summary.env, otherFiles: walked.others, foldersPassedOver: walked.skipped, excluded: walked.excluded, links: walked.links, include: config.include, exclude: patterns },
    files,
    summary,
    raw,
    config,
    minSeverity: minSeverity ?? config.minSeverity,
    failOn: failOn ?? config.failOn,
    version,
    notes,
    limits: lim
  });
}
