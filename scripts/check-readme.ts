/**
 * README drift checker.
 *
 * Scans README.md for command references and verifies:
 *   - `npm run X` references → script `X` exists in package.json
 *   - `npx tsx path/to/file.ts` references → the file exists on disk
 *
 * Exits with code 1 if any drift is detected.
 */
import * as fs from 'fs';
import * as path from 'path';

interface PkgJson {
  scripts?: Record<string, string>;
}

const root = process.cwd();
const readmePath = path.join(root, 'README.md');
const pkgPath = path.join(root, 'package.json');

if (!fs.existsSync(readmePath)) {
  console.error('❌ README.md not found at workspace root');
  process.exit(1);
}
if (!fs.existsSync(pkgPath)) {
  console.error('❌ package.json not found at workspace root');
  process.exit(1);
}

const readme = fs.readFileSync(readmePath, 'utf-8');
const pkg: PkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const scripts = new Set(Object.keys(pkg.scripts ?? {}));

const missingScripts = new Set<string>();
const missingFiles = new Set<string>();

const npmRunRe = /\bnpm run ([a-z][a-z0-9:_-]*)/gi;
let m: RegExpExecArray | null;
const PLACEHOLDER_SCRIPTS = new Set(['x', 'command', 'script']);
while ((m = npmRunRe.exec(readme)) !== null) {
  const name = m[1];
  if (PLACEHOLDER_SCRIPTS.has(name.toLowerCase())) continue;
  if (!scripts.has(name)) missingScripts.add(name);
}

const npxTsxRe = /\bnpx\s+tsx\s+([A-Za-z0-9_./-]+\.ts)\b/g;
const PLACEHOLDER_PATHS = new Set(['path/file.ts', 'path/to/file.ts']);
while ((m = npxTsxRe.exec(readme)) !== null) {
  const rel = m[1];
  // Skip placeholders or generated paths
  if (rel.includes('<') || rel.includes('>')) continue;
  if (PLACEHOLDER_PATHS.has(rel)) continue;
  const abs = path.resolve(root, rel);
  if (!fs.existsSync(abs)) missingFiles.add(rel);
}

const errors: string[] = [];
if (missingScripts.size > 0) {
  errors.push(
    `Missing npm scripts referenced in README:\n  - ${Array.from(missingScripts)
      .sort()
      .join('\n  - ')}`
  );
}
if (missingFiles.size > 0) {
  errors.push(
    `Missing files referenced via 'npx tsx' in README:\n  - ${Array.from(missingFiles)
      .sort()
      .join('\n  - ')}`
  );
}

if (errors.length > 0) {
  console.error('❌ README drift detected:\n');
  errors.forEach(e => console.error(e + '\n'));
  process.exit(1);
}

console.log('✅ README references verified — no drift.');
