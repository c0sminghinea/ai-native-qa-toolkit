/**
 * Architectural-invariant test: the ESLint config must reject imports from
 * tests/examples/** inside ai-tools/**. See docs/architecture.md.
 *
 * We don't shell out to the eslint binary here — we load the flat config
 * directly and run a programmatic Linter against an in-memory probe file.
 * This keeps the test fast (no child process, no fs writes) and pinned to
 * the same config the CLI uses.
 */
import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
// eslint.config.mjs has no type declarations — opt out for this one import.
// @ts-expect-error -- untyped flat config module
import config from '../eslint.config.mjs';

const VIOLATION_CODE = `
import { foo } from '../tests/examples/cal-com/target';
console.log(foo);
`;

const CLEAN_CODE = `
import * as path from 'path';
console.log(path.sep);
`;

function lint(filename: string, code: string) {
  const linter = new Linter({ configType: 'flat' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return linter.verify(code, config as any, { filename });
}

describe('eslint architectural invariant', () => {
  it('flags imports from tests/examples/** inside ai-tools/**', () => {
    const messages = lint('ai-tools/_probe.ts', VIOLATION_CODE);
    const restricted = messages.filter(m => m.ruleId === 'no-restricted-imports');
    expect(restricted, JSON.stringify(messages, null, 2)).toHaveLength(1);
    expect(restricted[0].message).toMatch(/tests\/examples/);
    expect(restricted[0].severity).toBe(2); // error
  });

  it('does NOT flag the same import outside ai-tools/**', () => {
    const messages = lint('cli.ts', VIOLATION_CODE);
    const restricted = messages.filter(m => m.ruleId === 'no-restricted-imports');
    expect(restricted).toHaveLength(0);
  });

  it('does NOT flag clean imports inside ai-tools/**', () => {
    const messages = lint('ai-tools/_probe.ts', CLEAN_CODE);
    const restricted = messages.filter(m => m.ruleId === 'no-restricted-imports');
    expect(restricted).toHaveLength(0);
  });
});
