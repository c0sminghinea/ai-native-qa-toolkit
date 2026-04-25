import { describe, it, expect } from 'vitest';
import { formatDomSnapshot, type DomSnapshot } from '../ai-tools/dom-snapshot';

describe('formatDomSnapshot', () => {
  it('renders all three sections when populated', () => {
    const snap: DomSnapshot = {
      testIds: ['  testid="submit" <button> "Submit"'],
      headings: ['  <h1> "Welcome"'],
      buttons: ['  [button] testid="submit" text="Submit"'],
    };
    const out = formatDomSnapshot(snap);
    expect(out).toContain('DATA-TESTID ELEMENTS:');
    expect(out).toContain('testid="submit"');
    expect(out).toContain('HEADINGS:');
    expect(out).toContain('<h1> "Welcome"');
    expect(out).toContain('BUTTONS:');
    expect(out).toContain('text="Submit"');
  });

  it('shows "(none found)" placeholders for empty sections', () => {
    const snap: DomSnapshot = { testIds: [], headings: [], buttons: [] };
    const out = formatDomSnapshot(snap);
    expect(out.match(/\(none found\)/g)).toHaveLength(3);
  });

  it('preserves section ordering: testIds → headings → buttons', () => {
    const snap: DomSnapshot = {
      testIds: ['  a'],
      headings: ['  b'],
      buttons: ['  c'],
    };
    const out = formatDomSnapshot(snap);
    const idxTest = out.indexOf('DATA-TESTID');
    const idxHead = out.indexOf('HEADINGS');
    const idxBtn = out.indexOf('BUTTONS');
    expect(idxTest).toBeLessThan(idxHead);
    expect(idxHead).toBeLessThan(idxBtn);
  });
});
