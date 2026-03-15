import * as dotenv from 'dotenv';
import Groq from 'groq-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function sendMCPMessage(
  process: ReturnType<typeof spawn>,
  message: object
): Promise<object> {
  return new Promise((resolve, reject) => {
    const messageStr = JSON.stringify(message) + '\n';
    let response = '';

    const onData = (data: Buffer) => {
      response += data.toString();
      try {
        const lines = response.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const parsed = JSON.parse(line);
          if (parsed.id === (message as any).id) {
            process.stdout?.removeListener('data', onData);
            resolve(parsed);
            return;
          }
        }
      } catch {
        // Keep accumulating
      }
    };

    process.stdout?.on('data', onData);
    setTimeout(() => reject(new Error('MCP timeout')), 10000);
    process.stdin?.write(messageStr);
  });
}

async function runPlaywrightMCPDemo() {
  console.log('\n🎭 Playwright MCP Server Demo');
  console.log('==============================\n');

  // Start the official @playwright/mcp server
  console.log('🚀 Starting @playwright/mcp server...');
  const mcpServer = spawn('npx', ['playwright-mcp', '--headless'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  mcpServer.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`   [MCP Server] ${msg}`);
  });

  await new Promise(r => setTimeout(r, 2000));

  try {
    // Initialize the MCP connection
    console.log('🔌 Initializing MCP connection...\n');
    await sendMCPMessage(mcpServer, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'qa-toolkit', version: '1.0.0' }
      }
    });

    // List available tools
    const toolsResponse = await sendMCPMessage(mcpServer, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    }) as any;

    const tools = toolsResponse.result?.tools || [];
    console.log(`📦 Playwright MCP exposes ${tools.length} browser control tools:`);
    tools.slice(0, 8).forEach((t: any) => {
      console.log(`   - ${t.name}: ${t.description?.substring(0, 60)}...`);
    });
    console.log();

    // Navigate to cal.com using the MCP tool
    console.log('🌐 Using MCP to navigate to cal.com/bailey/chat...');
    await sendMCPMessage(mcpServer, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'browser_navigate',
        arguments: { url: 'https://cal.com/bailey/chat' }
      }
    });
    console.log('   ✅ Navigation complete\n');

    // Take a snapshot via MCP
    console.log('📸 Taking accessibility snapshot via MCP...');
    const snapshotResponse = await sendMCPMessage(mcpServer, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'browser_snapshot',
        arguments: {}
      }
    }) as any;

    const snapshot = snapshotResponse.result?.content?.[0]?.text || '';
    console.log(`   ✅ Snapshot captured (${snapshot.length} chars)\n`);

    // Ask AI to analyze what it sees and decide next action
    console.log('🧠 Asking AI to analyze MCP snapshot and decide action...\n');
    const aiDecision = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a QA engineer controlling a browser via MCP tools. Analyze the page snapshot and decide the best next action to verify the booking flow works correctly. Be concise.'
        },
        {
          role: 'user',
          content: `You have navigated to cal.com/bailey/chat via Playwright MCP.
          
Page snapshot (accessibility tree):
${snapshot.substring(0, 2000)}

Available MCP tools: browser_click, browser_type, browser_snapshot, browser_navigate, browser_scroll

What is the most important thing to verify on this booking page, and which MCP tool call would you use next?
Respond in this format:
OBSERVATION: what you see
RISK: what could go wrong
NEXT ACTION: which tool and why`
        }
      ]
    });

    const decision = aiDecision.choices[0].message.content!;
    console.log('📋 AI Analysis of MCP Snapshot:\n');
    console.log(decision);

    // Save report
    const report = `# Playwright MCP Demo Report

## What This Demonstrates

This demo shows the official \`@playwright/mcp\` server being used to control
a browser through the Model Context Protocol — the same protocol Claude Code
uses to interact with browsers in agentic workflows.

## MCP Tools Available
${tools.map((t: any) => `- \`${t.name}\`: ${t.description}`).join('\n')}

## Session Log

1. Started \`@playwright/mcp\` server
2. Initialized MCP connection (JSON-RPC 2.0)
3. Listed ${tools.length} available browser control tools
4. Navigated to cal.com/bailey/chat via \`browser_navigate\` MCP tool
5. Captured accessibility snapshot via \`browser_snapshot\` MCP tool
6. AI analyzed snapshot and proposed next QA action

## AI Analysis
${decision}

---
*Generated by AI-Native QA Toolkit — Playwright MCP Integration*
`;

    const reportPath = path.join(process.cwd(), 'playwright-mcp-report.md');
    fs.writeFileSync(reportPath, report);
    console.log('\n📄 Report saved to: playwright-mcp-report.md');

  } catch (err) {
    console.error('Error during MCP session:', err);
  } finally {
    mcpServer.kill();
    console.log('\n✅ MCP server stopped');
  }
}

runPlaywrightMCPDemo().catch(console.error);