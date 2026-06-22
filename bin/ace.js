#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { install, update } from '../lib/installer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')).version;

const CYAN  = '\x1b[96m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const RESET = '\x1b[0m';

const BANNER = `
${CYAN}${BOLD} █████╗   ██████╗ ███████╗
██╔══██╗ ██╔════╝ ██╔════╝
███████║ ██║      █████╗
██╔══██║ ██║      ██╔══╝
██║  ██║ ╚██████╗ ███████╗
╚═╝  ╚═╝  ╚═════╝ ╚══════╝${RESET}

${BOLD}  Agentic Collaborative Engineering${RESET}
${DIM}  Claude Code-native multi-agent dev team · v${VERSION}${RESET}

`;

const HELP = `\
ace-agents ${VERSION}

Usage:
  ace init   [--force] [--no-ci] [--target <dir>]
  ace update [--force] [--target <dir>]
  ace --version

Commands:
  init    Copy ACE agent files into a project directory (default: current dir).
          Skips files that already exist unless --force is passed.
  update  Re-sync ACE files. Files you have locally modified are skipped
          with a warning unless --force is passed.

Options:
  --force         Overwrite existing / locally modified files.
  --no-ci         Skip .github/workflows/ci.yml (init only).
  --target <dir>  Destination directory (default: .).
  --version, -v   Print version and exit.
`;

function label(status) {
  return status === 'warned' ? 'WARN   ' :
         status === 'updated' ? 'UPDATED' :
         status === 'skipped' ? 'SKIPPED' : 'COPIED ';
}

function printResults(results) {
  let copied = 0, updated = 0, skipped = 0, warned = 0;
  for (const { path, status } of results) {
    const line = `  ${label(status)}  ${path}`;
    if (status === 'warned') process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
    if (status === 'copied')  copied++;
    if (status === 'updated') updated++;
    if (status === 'skipped') skipped++;
    if (status === 'warned')  warned++;
  }

  const parts = [];
  if (copied)  parts.push(`${copied} copied`);
  if (updated) parts.push(`${updated} updated`);
  if (skipped) parts.push(`${skipped} skipped`);
  if (warned)  parts.push(`${warned} locally modified (skipped; use --force to overwrite)`);
  console.log(`\n  Done. ${parts.join(', ')}.`);
}

function runInit(args) {
  const { values } = parseArgs({
    args,
    options: {
      force:    { type: 'boolean', default: false },
      'no-ci':  { type: 'boolean', default: false },
      target:   { type: 'string',  default: '.' },
    },
    strict: true,
  });
  const dest = resolve(values.target);
  const results = install(dest, { force: values.force, includeCi: !values['no-ci'] });
  printResults(results);
}

function runUpdate(args) {
  const { values } = parseArgs({
    args,
    options: {
      force:  { type: 'boolean', default: false },
      target: { type: 'string',  default: '.' },
    },
    strict: true,
  });
  const dest = resolve(values.target);
  const results = update(dest, { force: values.force });
  printResults(results);
}

process.stdout.write(BANNER);

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case 'init':
    runInit(rest);
    break;
  case 'update':
    runUpdate(rest);
    break;
  case '--version':
  case '-v':
    console.log(`ace-agents ${VERSION}`);
    break;
  case '--help':
  case '-h':
  case undefined:
    process.stdout.write(HELP);
    break;
  default:
    process.stderr.write(`ace: unknown command '${cmd}'\n\n${HELP}`);
    process.exit(1);
}
