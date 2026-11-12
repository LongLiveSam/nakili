#!/usr/bin/env node
/**
 * Release helper for Nakili's decimal version scheme.
 *
 *   npm run release -- bump --note "what changed"
 *   npm run release -- set 0.5 --note "public beta"
 *   npm run release -- set 1 --note "1.0"
 *
 * `bump` adds 0.01 (0.09 → 0.1, 0.5 → 0.51, 0.99 → 1.0).
 * `set` jumps to an exact version (0.5, 1, 1.25).
 *
 * By default it updates package.json, package-lock.json and CHANGELOG.md,
 * commits `chore: release vX` and creates the tag `vX`. Use --no-commit to
 * only edit files, or --dry-run to preview.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');
const changelogPath = path.join(root, 'CHANGELOG.md');

export function parseVersion(input) {
  const raw = String(input).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`invalid version "${input}" — use 0.01, 0.5 or 1`);
  }
  return Math.round(Number(raw) * 100);
}

export function formatVersion(hundredths) {
  const major = Math.floor(hundredths / 100);
  const minor = hundredths % 100;
  if (minor === 0) return `${major}.0`;
  if (minor < 10) return `${major}.0${minor}`;
  if (minor % 10 === 0) return `${major}.${minor / 10}`;
  return `${major}.${minor}`;
}

function parseArgs(argv) {
  const args = { command: null, value: null, note: '', dryRun: false, commit: true };
  const rest = [...argv];
  while (rest.length > 0) {
    const arg = rest.shift();
    if (arg === '--note') args.note = rest.shift() ?? '';
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--no-commit') args.commit = false;
    else if (!args.command) args.command = arg;
    else if (!args.value) args.value = arg;
  }
  return args;
}

function changelogEntry(version, note) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = (note || 'No notes.')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n');
  return `## v${version} — ${date}\n\n${lines}\n\n`;
}

function insertEntry(changelog, entry) {
  const marker = changelog.indexOf('\n## ');
  if (marker === -1) return `${changelog.trimEnd()}\n\n${entry}`;
  return `${changelog.slice(0, marker + 1)}${entry}${changelog.slice(marker + 1)}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== 'bump' && args.command !== 'set') {
    console.error('usage: npm run release -- bump|set <version> [--note "..."] [--dry-run] [--no-commit]');
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const current = parseVersion(pkg.version);
  const next = args.command === 'bump' ? current + 1 : parseVersion(args.value);
  if (next <= current) {
    console.error(`next version must be greater than ${pkg.version}`);
    process.exit(1);
  }
  const version = formatVersion(next);

  console.log(`v${pkg.version} → v${version}`);
  if (args.dryRun) {
    console.log('dry run: no files written');
    return;
  }

  pkg.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  lock.version = version;
  if (lock.packages?.['']) lock.packages[''].version = version;
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const changelog = readFileSync(changelogPath, 'utf8');
  writeFileSync(changelogPath, insertEntry(changelog, changelogEntry(version, args.note)));

  if (!args.commit) {
    console.log('files updated; commit and tag when ready');
    return;
  }

  execFileSync('git', ['add', 'package.json', 'package-lock.json', 'CHANGELOG.md'], { cwd: root });
  execFileSync('git', ['commit', '-m', `chore: release v${version}`], { cwd: root });
  execFileSync('git', ['tag', '-a', `v${version}`, '-m', `v${version}`], { cwd: root });
  console.log(`committed and tagged v${version}`);
  console.log('next: git push --follow-tags');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
