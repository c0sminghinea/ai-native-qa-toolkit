import { groqChat, MODELS } from './groq-client';
import { handleToolError, saveReport } from './tool-utils';
import * as fs from 'fs';
import * as path from 'path';

const MAX_CONTENT_CHARS = 8000;

async function analyzeFailure(errorLog: string, testFile: string) {
  console.log('\n🔍 Analyzing test failure...\n');

  try {
    if (!fs.existsSync(testFile)) {
      throw new Error(`Test file not found: ${testFile}`);
    }

    const testCode = fs.readFileSync(testFile, 'utf-8').substring(0, MAX_CONTENT_CHARS);

    if (!errorLog.trim()) {
      throw new Error('Error log is empty — nothing to analyze');
    }

    const result = await groqChat({
      model: MODELS.text,
      messages: [
        {
          role: 'system',
          content: 'You are an expert Playwright QA engineer. Analyze test failures and provide clear, actionable fixes.'
        },
        {
          role: 'user',
          content: `A Playwright test failed. Analyze the error and suggest a fix.

TEST CODE:
${testCode}

ERROR LOG:
${errorLog}

Provide:
1. ROOT CAUSE: What exactly caused this failure in 1-2 sentences
2. FIX: The exact code change needed to fix it
3. PREVENTION: One sentence on how to prevent this class of failure in future`
        }
      ]
    });

    const analysis = result.choices[0].message.content!;
    console.log('📋 Analysis:\n');
    console.log(analysis);
    console.log('\n');
    saveReport('failure-analysis-report.md', `# Failure Analysis Report\n\n${analysis}`);

  } catch (err) {
    handleToolError(err, {
      'API key': 'Add GROQ_API_KEY=your_key to your .env file',
      'not found': 'Check the test file path exists',
    });
  }
}

// Read error from a file or use a sample error for demo
const sampleError = `
Error: expect(locator).toBeVisible() failed
Locator: getByText('Chat')
Expected: visible
Error: strict mode violation: getByText('Chat') resolved to 2 elements:
    1) <h1 data-testid="event-title">Chat</h1>
    2) <title> Chat | Bailey Pumfleet | Cal.com</title>
`;

const testFile = path.join(process.cwd(), 'tests', 'booking-flow.spec.ts');

let errorLog: string;
try {
  errorLog = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf-8') : sampleError;
} catch (err) {
  handleToolError(err, { 'no such file': 'Pass a valid path to an error log file as the first argument' });
}

analyzeFailure(errorLog!, testFile);