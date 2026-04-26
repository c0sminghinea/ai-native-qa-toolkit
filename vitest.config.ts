import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests-unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      reportsDirectory: 'runs/coverage',
      // Only count source modules that actually have unit tests today. Tools
      // that are exercised primarily through e2e/manual runs (browser-agent,
      // mcp-server, persona-engine, etc.) would dilute the gate without
      // adding signal — track them separately when their unit suites grow.
      include: [
        'ai-tools/checks-config.ts',
        'ai-tools/discover-selectors.ts',
        'ai-tools/dom-snapshot.ts',
        'ai-tools/groq-client.ts',
        'ai-tools/llm-provider.ts',
        'ai-tools/run-telemetry.ts',
        'ai-tools/tool-utils.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
      // Floors set just below current actuals so CI fails on regressions but
      // doesn't lie about coverage. Raise these as the suite grows; never lower.
      // Current baseline (April 2026): lines/statements 44%, functions 37%, branches 91%.
      thresholds: {
        lines: 40,
        statements: 40,
        functions: 35,
        branches: 85,
      },
    },
  },
});
