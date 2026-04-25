import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as path from 'path';

/**
 * Smoke test for the MCP server. Spawns the server as a subprocess over
 * stdio and verifies that:
 *   - the server connects without throwing
 *   - tools/list returns the expected tool names
 *   - tools/call validates inputs (calling visual_regression with a non-http
 *     URL should return an error message rather than crashing the server)
 *
 * This intentionally does NOT exercise tools that hit the network (Groq, a
 * live browser, cal.com) — that would make CI flaky and burn API quota.
 */
describe('mcp-server', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', path.resolve(__dirname, '..', 'mcp-server.ts')],
    });
    client = new Client({ name: 'mcp-smoke-test', version: '0.0.0' }, { capabilities: {} });
    await client.connect(transport);
  }, 30_000);

  afterAll(async () => {
    await client?.close().catch(() => {});
  });

  it('exposes the documented tools via tools/list', async () => {
    const result = await client.listTools();
    const names = result.tools.map(t => t.name).sort();
    expect(names).toEqual(
      [
        'advise_coverage',
        'analyze_failure',
        'data_consistency',
        'generate_tests',
        'heal_locator',
        'visual_regression',
      ].sort()
    );
  });

  it('every tool has a non-empty description and an input schema', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description, `${tool.name} missing description`).toBeTruthy();
      expect(tool.inputSchema, `${tool.name} missing inputSchema`).toBeTruthy();
    }
  });

  it('rejects invalid URLs in visual_regression with an error message (not a crash)', async () => {
    const result = await client.callTool({
      name: 'visual_regression',
      arguments: { url: 'not-a-real-url' },
    });
    const text = (result.content as Array<{ type: string; text: string }>)
      .map(c => c.text)
      .join('\n');
    expect(text).toMatch(/url must start with http/i);
  });

  it('rejects path-traversal in advise_coverage', async () => {
    const result = await client.callTool({
      name: 'advise_coverage',
      arguments: { test_file_path: '../../../etc/passwd' },
    });
    const text = (result.content as Array<{ type: string; text: string }>)
      .map(c => c.text)
      .join('\n');
    expect(text).toMatch(/outside workspace/i);
  });
});
