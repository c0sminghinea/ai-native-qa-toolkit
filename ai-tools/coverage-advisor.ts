import { groqChat, MODELS } from './groq-client';
import { handleToolError, saveReport } from './tool-utils';
import * as fs from 'fs';
import * as path from 'path';

const MAX_FILE_CHARS = 8000;

/** Reads a file up to MAX_FILE_CHARS and warns if it was truncated. */
function readWithTruncationWarning(filePath: string, label: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.length > MAX_FILE_CHARS) {
    console.warn(
      `⚠️  ${label} is ${content.length} chars — truncated to ${MAX_FILE_CHARS} for analysis`
    );
    return content.substring(0, MAX_FILE_CHARS);
  }
  return content;
}

/** Collects Page Object Model files from a pages/ directory adjacent to the test file. */
function collectPomContext(testFilePath: string): string {
  const pagesDir = path.join(path.dirname(testFilePath), 'pages');
  if (!fs.existsSync(pagesDir)) return '';

  const pomFiles = fs
    .readdirSync(pagesDir)
    .filter(f => f.endsWith('.ts'))
    .map(f => path.join(pagesDir, f));

  if (pomFiles.length === 0) return '';

  const sections = pomFiles.map(f => {
    const content = readWithTruncationWarning(f, path.basename(f));
    return `// --- ${path.basename(f)} ---\n${content}`;
  });

  return sections.join('\n\n');
}

/**
 * Extracts test names from a spec file by scanning for test('...') and test.skip('...')
 * calls. Returns just the names — cheap to include in the prompt without blowing token budget.
 */
function extractTestNames(specFilePath: string): string[] {
  const content = fs.readFileSync(specFilePath, 'utf-8');
  const matches = [...content.matchAll(/test(?:\.only|\.skip)?\s*\(\s*['"`]([^'"`\n]+)['"`]/g)];
  return matches.map(m => m[1]);
}

/**
 * Finds all other spec files in the same directory and returns a compact summary
 * of their test names, so the AI knows what is already covered elsewhere in the suite.
 */
function collectSuiteContext(testFilePath: string): string {
  const dir = path.dirname(testFilePath);
  const targetBase = path.basename(testFilePath);

  const otherSpecs = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.spec.ts') && f !== targetBase)
    .map(f => path.join(dir, f));

  if (otherSpecs.length === 0) return '';

  const sections = otherSpecs
    .map(f => {
      const names = extractTestNames(f);
      if (names.length === 0) return '';
      return `${path.basename(f)}:\n${names.map(n => `  - "${n}"`).join('\n')}`;
    })
    .filter(Boolean);

  return sections.join('\n\n');
}

async function adviseCoverage(testFile: string) {
  console.log('\n🧠 Analyzing test coverage...\n');

  try {
    if (!fs.existsSync(testFile)) {
      throw new Error(`Test file not found: ${testFile}`);
    }

    const testCode = readWithTruncationWarning(testFile, path.basename(testFile));

    if (!testCode.trim()) {
      throw new Error('Test file is empty — nothing to analyze');
    }

    const pomContext = collectPomContext(testFile);
    const pomSection = pomContext
      ? `\nPAGE OBJECT MODEL (available locators and methods):\n${pomContext}\n`
      : '';

    if (pomContext) {
      console.log('📄 POM context loaded from pages/ directory\n');
    }

    const suiteContext = collectSuiteContext(testFile);
    const suiteSection = suiteContext
      ? `\nTESTS ALREADY COVERED IN OTHER FILES (do NOT recommend these again):\n${suiteContext}\n`
      : '';

    if (suiteContext) {
      console.log('📋 Suite context loaded from other spec files\n');
    }

    const result = await groqChat({
      model: MODELS.text,
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior QA engineer specializing in test coverage analysis. Be specific and practical. When writing test code, use ONLY the locators and methods available in the provided Page Object Model.',
        },
        {
          role: 'user',
          content: `Review this Playwright test file and identify coverage gaps.
${pomSection}${suiteSection}
TEST FILE:
${testCode}

Provide your response in exactly this format:

COVERAGE SCORE: X/10

WHAT IS COVERED:
- (list each scenario currently tested)

CRITICAL GAPS:
- (list missing tests that could catch real bugs)

TOP 3 TESTS TO ADD:
1. Test name: [name]
   Why: [one sentence on why this matters]
   Code: [the actual Playwright test code using the POM locators above]

2. Test name: [name]
   Why: [one sentence on why this matters]
   Code: [the actual Playwright test code using the POM locators above]

3. Test name: [name]
   Why: [one sentence on why this matters]
   Code: [the actual Playwright test code using the POM locators above]`,
        },
      ],
    });

    const advice = result.choices[0].message.content!;

    console.log(advice);

    const baseName = path.basename(testFile, '.spec.ts').replace(/[^a-z0-9-]/gi, '-');
    saveReport(
      `coverage-${baseName}-report.md`,
      `# Coverage Advisor Report\n\n**Analyzed:** \`${testFile}\`  \n**Date:** ${new Date().toISOString().split('T')[0]}\n\n${advice}`
    );
  } catch (err) {
    handleToolError(err, {
      'API key': 'Add GROQ_API_KEY=your_key to your .env file',
      'not found':
        'Run with a valid path: npx tsx ai-tools/coverage-advisor.ts tests/booking-flow.spec.ts',
    });
  }
}

const testFile = process.argv[2] || path.join(process.cwd(), 'tests', 'booking-flow.spec.ts');
if (require.main === module) {
  adviseCoverage(testFile);
}
