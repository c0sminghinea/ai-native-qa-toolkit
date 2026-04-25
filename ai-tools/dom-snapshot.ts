import type { Page } from '@playwright/test';

/**
 * Snapshot of visible, interactive elements on a page.
 * Used by generate-tests, locator-healer, and the MCP heal_locator tool.
 */
export interface DomSnapshot {
  testIds: string[];
  headings: string[];
  buttons: string[];
}

/**
 * Extracts a compact, deduplicated list of testids, headings, and buttons
 * from the live DOM. Caps each list to keep AI prompts under control.
 */
export async function captureDomSnapshot(page: Page): Promise<DomSnapshot> {
  return page.evaluate(() => {
    const visible = (el: Element) => (el as HTMLElement).offsetParent !== null;

    const testIds = Array.from(document.querySelectorAll('[data-testid]'))
      .filter(visible)
      .map(
        el =>
          `  testid="${el.getAttribute('data-testid')}" <${el.tagName.toLowerCase()}> "${((el as HTMLElement).innerText || '').trim().substring(0, 60)}"`
      )
      .slice(0, 25);

    const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
      .map(
        el =>
          `  <${el.tagName.toLowerCase()}> "${((el as HTMLElement).innerText || '').trim().substring(0, 60)}"`
      )
      .slice(0, 15);

    const buttons = Array.from(document.querySelectorAll('button:not([disabled])'))
      .filter(visible)
      .map(el => {
        const testId = el.getAttribute('data-testid');
        const text = ((el as HTMLElement).innerText || '').trim().substring(0, 50);
        return `  [button]${testId ? ` testid="${testId}"` : ''} text="${text}"`;
      })
      .filter(b => !b.endsWith('text=""'))
      .slice(0, 15);

    return { testIds, headings, buttons };
  });
}

/**
 * Formats a DomSnapshot as a single string suitable for embedding in an AI prompt.
 */
export function formatDomSnapshot(snap: DomSnapshot): string {
  return [
    'DATA-TESTID ELEMENTS:',
    ...(snap.testIds.length ? snap.testIds : ['  (none found)']),
    '',
    'HEADINGS:',
    ...(snap.headings.length ? snap.headings : ['  (none found)']),
    '',
    'BUTTONS:',
    ...(snap.buttons.length ? snap.buttons : ['  (none found)']),
  ].join('\n');
}
