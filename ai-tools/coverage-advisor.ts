import * as dotenv from 'dotenv';
import Groq from 'groq-sdk';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function adviseCoverage(testFile: string) {
  console.log('\n🧠 Analyzing test coverage...\n');

  const testCode = fs.readFileSync(testFile, 'utf-8');

  const result = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
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
  
  // Save the report
  const outputPath = path.join(process.cwd(), 'coverage-report.md');
  fs.writeFileSync(outputPath, `# Coverage Advisor Report\n\n${advice}`);
  
  console.log(advice);
  console.log(`\n📄 Report saved to: coverage-report.md\n`);
}

const testFile = process.argv[2] || path.join(process.cwd(), 'tests', 'booking-flow.spec.ts');
adviseCoverage(testFile).catch(console.error);