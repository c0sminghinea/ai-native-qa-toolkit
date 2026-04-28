import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests-unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      reportsDirectory: 'runs/coverage',
      // Source modules with unit tests. Each tool exposes pure helpers
      // (prompt builders, parsers, classifiers) that can be exercised
      // without spinning up a browser or making LLM calls. The `if
      // (require.main === module)` CLI tail stays uncovered by design.
      include: [
        'ai-tools/analyze-failure.ts',
        'ai-tools/cdp-inspector.ts',
        'ai-tools/checks-config.ts',
        'ai-tools/coverage-advisor.ts',
        'ai-tools/data-consistency.ts',
        'ai-tools/discover-selectors.ts',
        'ai-tools/dom-snapshot.ts',
        'ai-tools/generate-tests.ts',
        'ai-tools/groq-client.ts',
        'ai-tools/llm-provider.ts',
        'ai-tools/locator-healer.ts',
        'ai-tools/persona-engine.ts',
        'ai-tools/run-telemetry.ts',
        'ai-tools/tool-utils.ts',
        'ai-tools/visual-regression.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
      // Floors sit just below current actuals so CI fails on regressions but
      // doesn't lie about coverage. Bumped after exporting all 9 tool
      // orchestrators and adding integration tests with mocked LLM under
      // tests-unit/integration/, which raised line coverage from ~23% to
      // ~62% and function coverage from ~37% to ~74%. Branch coverage
      // dropped (more branches now exercised) but the floors still catch
      // regressions. Raise as the suite grows.
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 70,
        branches: 60,
      },
    },
  },
});
