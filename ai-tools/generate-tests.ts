import { groqChat, MODELS } from './groq-client';
import { handleToolError, DEFAULT_TARGET_URL } from './tool-utils';
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/** Reads every .ts file from tests/pages/ so the AI can reuse existing POMs. */
function collectExistingPom(): string {
  const pagesDir = path.join(process.cwd(), 'tests', 'pages');
  if (!fs.existsSync(pagesDir)) return '';
  const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.ts'));
  if (files.length === 0) return '';
  return files
    .map(f => {
      const content = fs.readFileSync(path.join(pagesDir, f), 'utf-8');
      return `// --- ${f} ---\n${content}`;
    })
    .join('\n\n');
}

export async function explorePage(url: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext()).newPage();

    await page.goto(url, { timeout: 15000 }).catch(() => {
      throw new Error(`Could not load URL: ${url} — check it is accessible`);
    });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const data = await page.evaluate(() => {
      const visible = (el: Element) => (el as HTMLElement).offsetParent !== null;

      const testIds = Array.from(document.querySelectorAll('[data-testid]'))
        .filter(visible)
        .map(el => ({
          testId: el.getAttribute('data-testid'),
          tag: el.tagName,
          text: ((el as HTMLElement).innerText || '').trim().substring(0, 50),
        }));

      const buttons = Array.from(document.querySelectorAll('button:not([disabled])'))
        .filter(visible)
        .map(el => ({
          text: ((el as HTMLElement).innerText || '').trim().substring(0, 50),
          testId: el.getAttribute('data-testid'),
        }))
        .filter(b => b.text);

      const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(el => ({
        tag: el.tagName,
        text: ((el as HTMLElement).innerText || '').trim().substring(0, 50),
      }));

      const formElements = [
        ...Array.from(document.querySelectorAll('label'))
          .map(el => ({
            type: 'label' as const,
            text: ((el as HTMLElement).innerText || '').trim().substring(0, 50),
            forAttr: el.htmlFor || null,
          }))
          .filter(l => l.text),
        ...Array.from(document.querySelectorAll('input:not([type="hidden"]),textarea,select'))
          .filter(visible)
          .map(el => {
            const inp = el as HTMLInputElement;
            return {
              type: el.tagName.toLowerCase() as 'input' | 'textarea' | 'select',
              inputType: inp.type || null,
              placeholder: inp.placeholder || null,
              ariaLabel: el.getAttribute('aria-label') || null,
              testId: el.getAttribute('data-testid') || null,
            };
          }),
      ];

      return { testIds, buttons, headings, formElements };
    });

    const title = await page.title();
    const finalUrl = page.url();
    return { url: finalUrl, title, ...data };
  } finally {
    await browser.close();
  }
}

async function generateTests(url: string, outputPath?: string) {
  try {
    if (!url.startsWith('http')) {
      throw new Error(`Invalid URL: "${url}" — must start with http or https`);
    }

    console.log('\n🔍 Exploring: ' + url);
    const p = await explorePage(url);
    console.log(
      '📊 Found: ' +
        p.testIds.length +
        ' testids, ' +
        p.buttons.length +
        ' buttons, ' +
        p.headings.length +
        ' headings, ' +
        p.formElements.length +
        ' form elements\n'
    );

    if (p.testIds.length === 0 && p.buttons.length === 0) {
      throw new Error(
        'No interactive elements found on page — the page may not have loaded correctly'
      );
    }

    const parsedUrl = new URL(p.url);
    const relativePath = parsedUrl.pathname;

    const pomContext = collectExistingPom();
    const pomSection = pomContext
      ? `\nEXISTING PAGE OBJECTS (reuse these if the target URL matches ${parsedUrl.origin}; otherwise create a new POM class inline):\n${pomContext}\n`
      : '';

    if (pomContext) {
      console.log('📄 Existing POM context injected\n');
    }

    const formLines =
      p.formElements.length > 0
        ? [
            '',
            'FORM ELEMENTS:',
            ...p.formElements.map(f => {
              if ('text' in f && f.type === 'label') {
                return `- [label] "${f.text}"${f.forAttr ? ` for="${f.forAttr}"` : ''}`;
              }
              const fi = f as {
                type: string;
                inputType: string | null;
                placeholder: string | null;
                ariaLabel: string | null;
                testId: string | null;
              };
              return `- [${fi.type}]${fi.inputType ? ` type="${fi.inputType}"` : ''}${fi.placeholder ? ` placeholder="${fi.placeholder}"` : ''}${fi.ariaLabel ? ` aria-label="${fi.ariaLabel}"` : ''}${fi.testId ? ` data-testid="${fi.testId}"` : ''}`;
            }),
          ]
        : [];

    const lines = [
      'Generate a Playwright TypeScript test file for: ' + p.url,
      'Title: ' + p.title,
      pomSection,
      'DATA-TESTID ELEMENTS:',
      ...p.testIds.map(e => '- data-testid="' + e.testId + '" ' + e.tag + ' "' + e.text + '"'),
      '',
      'BUTTONS:',
      ...p.buttons.map(
        b => '- "' + b.text + '"' + (b.testId ? ' [data-testid="' + b.testId + '"]' : '')
      ),
      '',
      'HEADINGS:',
      ...p.headings.map(h => '- ' + h.tag + ': "' + h.text + '"'),
      ...formLines,
      '',
      'Rules:',
      '- Use ONLY selectors listed above',
      '- getByTestId() for data-testid elements',
      '- getByRole("button", { name }) for buttons without data-testid',
      '- No `any` types — use Page and Locator from @playwright/test',
      '- Every test.describe must use beforeEach to call page.goto("' + relativePath + '")',
      '- No getAllByRole — use getByRole(...) instead; prefer getByTestId()',
      '- No hardcoded element counts — use toBeGreaterThan(0) for dynamic lists',
      '- Use relative paths (e.g. "' + relativePath + '"), not absolute https:// URLs',
      '- 5+ tests: load, elements, click date, time slots, mobile',
      '- Page Object Model pattern',
      '- Return ONLY TypeScript code, no markdown fences, no explanations',
    ];

    console.log('🤖 Generating tests from real page data...\n');

    const result = await groqChat({
      model: MODELS.text,
      messages: [
        {
          role: 'system',
          content: 'Expert QA engineer. Return ONLY TypeScript, no markdown.',
        },
        { role: 'user', content: lines.join('\n') },
      ],
      max_tokens: 3000,
    });

    let code = result.choices[0].message.content!.trim();
    code = code.replace(/^```typescript\n?|^```\n?|```$/gm, '').trim();

    if (!code || code.length < 50) {
      throw new Error('AI returned empty or invalid code — try running again');
    }

    const resolvedOutput = outputPath
      ? path.resolve(process.cwd(), outputPath)
      : path.join(process.cwd(), 'tests', 'ai-generated.spec.ts');

    if (fs.existsSync(resolvedOutput)) {
      console.log(`⚠️  Warning: overwriting existing file: ${resolvedOutput}`);
    }
    fs.writeFileSync(resolvedOutput, code);

    console.log('✅ Tests generated successfully!');
    console.log(`📄 Saved to: ${path.relative(process.cwd(), resolvedOutput)}\n`);
    console.log('--- Preview (first 400 chars) ---');
    console.log(code.substring(0, 400));
    console.log('...\n');
  } catch (err) {
    handleToolError(err, {
      'API key': 'Add GROQ_API_KEY=your_key to your .env file',
      URL: 'Usage: npx tsx ai-tools/generate-tests.ts https://example.com [output-path]',
      load: 'Check the URL is publicly accessible',
    });
  }
}

const url = process.argv[2] || DEFAULT_TARGET_URL;
const outputPath = process.argv[3];
if (require.main === module) {
  generateTests(url, outputPath);
}
