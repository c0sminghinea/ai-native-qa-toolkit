/**
 * Lightweight pre-commit secret scanner.
 *
 * Scans staged files for high-confidence credential patterns. Designed to be
 * fast (no network, no native binary) so it can run on every commit without
 * friction. CI runs the official gitleaks action for full-history scanning.
 *
 * Usage:
 *   npx tsx scripts/check-secrets.ts            # scan staged files (pre-commit)
 *   npx tsx scripts/check-secrets.ts --all      # scan whole tracked tree
 *
 * Exit code 1 if any pattern matches; 0 otherwise.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface Pattern {
  name: string;
  re: RegExp;
}

const PATTERNS: Pattern[] = [
  { name: 'Groq API key', re: /\bgsk_[A-Za-z0-9]{20,}\b/ },
  { name: 'OpenAI API key', re: /\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}\b/ },
  { name: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Generic private key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  // Catches Authorization: Bearer <obviously-not-placeholder>
  { name: 'Hardcoded bearer token', re: /Authorization:\s*Bearer\s+[A-Za-z0-9_\-.]{30,}/ },
];

// Files we should never scan (binary or noise).
const SKIP_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.lock',
]);
const SKIP_PATH = [
  'node_modules/',
  'playwright-report/',
  'test-results/',
  'visual-regression/',
  'agent-screenshots/',
  'persona-screenshots/',
  '.cache/',
  'runs/',
  'package-lock.json',
  'scripts/check-secrets.ts', // self
];

function getStagedFiles(): string[] {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function getAllTrackedFiles(): string[] {
  const out = execSync('git ls-files', { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function shouldSkip(file: string): boolean {
  if (SKIP_EXT.has(path.extname(file).toLowerCase())) return true;
  return SKIP_PATH.some(p => file.startsWith(p) || file === p);
}

interface Hit {
  file: string;
  line: number;
  pattern: string;
  preview: string;
}

function scanFile(file: string): Hit[] {
  if (!fs.existsSync(file)) return [];
  const stat = fs.statSync(file);
  if (stat.isDirectory()) return [];
  if (stat.size > 1_000_000) return []; // 1MB cap — skip huge generated files

  let content: string;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    return []; // binary or unreadable
  }

  const hits: Hit[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of PATTERNS) {
      if (p.re.test(line)) {
        hits.push({
          file,
          line: i + 1,
          pattern: p.name,
          // Truncate to avoid printing the whole secret in CI logs.
          preview: line.trim().slice(0, 60) + (line.length > 60 ? '…' : ''),
        });
      }
    }
  }
  return hits;
}

function main(): void {
  const all = process.argv.includes('--all');
  const files = (all ? getAllTrackedFiles() : getStagedFiles()).filter(f => !shouldSkip(f));

  if (files.length === 0) {
    console.log('🔍 No files to scan.');
    return;
  }

  const hits = files.flatMap(scanFile);

  if (hits.length === 0) {
    console.log(`🔍 Scanned ${files.length} file(s) — no secrets detected.`);
    return;
  }

  console.error('\n❌ Potential secrets detected — commit blocked.\n');
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  [${h.pattern}]`);
    console.error(`    ${h.preview}`);
  }
  console.error('\nIf this is a false positive, refine the pattern in scripts/check-secrets.ts.');
  console.error(
    'To bypass for an emergency commit, use `git commit --no-verify` (not recommended).'
  );
  process.exit(1);
}

main();
