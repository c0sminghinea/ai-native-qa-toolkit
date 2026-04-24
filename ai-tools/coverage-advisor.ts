import { groqChat, MODELS } from './groq-client';
import { handleToolError, saveReport } from './tool-utils';
import * as fs from 'fs';
import * as path from 'path';

async function adviseCoverage(testFile: string) {
  console.log('\n🧠 Analyzing test coverage...\n');

  try {
    if (!fs.existsSync(testFile)) {
      throw new Error(`Test file not found: ${testFile}`);
    }

    const MAX_CONTENT_CHARS = 8000;
    const testCode = fs.readFileSync(testFile, 'utf-8').substring(0, MAX_CONTENT_CHARS);

    if (!testCode.trim()) {
      throw new Error('Test file is empty — nothing to analyze');
    }

    const result = await groqChat({
      model: MODELS.text,
      messages: [
        {
          role: 'system',
          content: 'You are a senior QA engineer specializing in test coverage analysis. Be specific and practical.'
        },
        {
          role: 'user',
          content: `Review this Playwright test file and identify coverage gaps.

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
   Code: [the actual Playwright test code]

2. Test name: [name]
   Why: [one sentence on why this matters]
   Code: [the actual Playwright test code]

3. Test name: [name]
   Why: [one sentence on why this matters]
   Code: [the actual Playwright test code]`
        }
      ]
    });

    const advice = result.choices[0].message.content!;

    console.log(advice);
    saveReport('coverage-report.md', `# Coverage Advisor Report\n\n${advice}`);

  } catch (err) {
    handleToolError(err, {
      'API key': 'Add GROQ_API_KEY=your_key to your .env file',
      'not found': 'Run with a valid path: npx tsx ai-tools/coverage-advisor.ts tests/booking-flow.spec.ts',
    });
  }
}

const testFile = process.argv[2] || path.join(process.cwd(), 'tests', 'booking-flow.spec.ts');
adviseCoverage(testFile);