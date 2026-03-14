import * as dotenv from 'dotenv';
import Groq from 'groq-sdk';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function analyzeFailure(errorLog: string, testFile: string) {
  console.log('\n🔍 Analyzing test failure...\n');

  const testCode = fs.readFileSync(testFile, 'utf-8');

  const result = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
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
const errorLog = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf-8') : sampleError;

analyzeFailure(errorLog, testFile).catch(console.error);