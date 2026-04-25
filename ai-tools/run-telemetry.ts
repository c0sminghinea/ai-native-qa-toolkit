/**
 * Per-run telemetry. Every CLI invocation that imports this module records a
 * single JSON file at `runs/<ISO-timestamp>.json` containing:
 *   - argv, command, start/end time, duration, exit code
 *   - cumulative Groq token usage and retry counts
 *   - artifacts written during the run (registered via `recordArtifact()`)
 *
 * Opt-out by setting `QA_RUN_TELEMETRY=0`. The single-summary
 * `.cache/run-stats.json` writer in groq-client.ts is unaffected.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getRunStats } from './groq-client';

const startTimeMs = Date.now();
const startedAt = new Date(startTimeMs).toISOString();
const argv = process.argv.slice(2);
const artifacts: string[] = [];

let installed = false;

function safeRunsDir(): string {
  return path.join(process.cwd(), 'runs');
}

function safeFilename(iso: string): string {
  // Replace ':' so the filename works on Windows / FAT filesystems too.
  return iso.replace(/:/g, '-');
}

/** Register a file path that this run produced. Called by tools after writing. */
export function recordArtifact(p: string): void {
  if (typeof p === 'string' && p.length > 0) artifacts.push(p);
}

/** Builds the JSON body written at process exit. Exported for unit tests. */
export function buildRunRecord(opts: {
  argv: string[];
  startedAt: string;
  endedAt: string;
  durationMs: number;
  exitCode: number;
  artifacts: string[];
  stats: ReturnType<typeof getRunStats>;
}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    command: opts.argv[0] ?? null,
    argv: opts.argv,
    startedAt: opts.startedAt,
    endedAt: opts.endedAt,
    durationMs: opts.durationMs,
    exitCode: opts.exitCode,
    artifacts: [...opts.artifacts],
    llm: {
      calls: opts.stats.calls,
      cacheHits: opts.stats.cacheHits,
      retries: opts.stats.retries,
      promptTokens: opts.stats.promptTokens,
      completionTokens: opts.stats.completionTokens,
      totalTokens: opts.stats.totalTokens,
      byModel: opts.stats.byModel,
    },
  };
}

/**
 * Installs the process-exit hook that writes the run record. Idempotent.
 * No-op when `QA_RUN_TELEMETRY=0` is set.
 */
export function installRunTelemetry(): void {
  if (installed) return;
  installed = true;
  if (process.env.QA_RUN_TELEMETRY === '0') return;

  process.on('exit', code => {
    try {
      const endTimeMs = Date.now();
      const record = buildRunRecord({
        argv,
        startedAt,
        endedAt: new Date(endTimeMs).toISOString(),
        durationMs: endTimeMs - startTimeMs,
        exitCode: code,
        artifacts,
        stats: getRunStats(),
      });

      // Skip writing for trivial CLI invocations that did nothing meaningful
      // (e.g. --help). A run is "meaningful" if it called the LLM or wrote an
      // artifact.
      if (record.artifacts as string[]) {
        const a = record.artifacts as string[];
        const llm = record.llm as { calls: number; cacheHits: number };
        if (a.length === 0 && llm.calls === 0 && llm.cacheHits === 0) return;
      }

      const dir = safeRunsDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${safeFilename(startedAt)}.json`);
      fs.writeFileSync(file, JSON.stringify(record, null, 2));
    } catch {
      // Telemetry is best-effort and must never fail a run.
    }
  });
}

// Auto-install on import. Tools that import this module will get telemetry
// for free with no further wiring.
installRunTelemetry();
