#!/usr/bin/env node
/**
 * Enzan MCP Server
 *
 * Supports two transports:
 *   ENZAN_TRANSPORT=stdio  — single-tenant local mode (for Cursor / Claude Desktop)
 *   ENZAN_TRANSPORT=http   — multi-tenant HTTP/SSE mode (for hosted service)
 *
 * In HTTP mode every request must carry:
 *   Authorization: Bearer <api-key>
 *
 * The API key resolves to a tenant namespace (Cosmos container name).
 */

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';

const transport = process.env.ENZAN_TRANSPORT ?? 'stdio';

async function main() {
  const server = new McpServer({
    name: 'enzan',
    version: '0.1.0',
  });

  registerTools(server);

  if (transport === 'http') {
    // HTTP/SSE multi-tenant transport — Phase 1 implementation
    const { startHttpServer } = await import('./http.js');
    await startHttpServer(server);
  } else {
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
  }
}

main().catch((err) => {
  process.stderr.write(`[enzan] fatal: ${err.message}\n`);
  process.exit(1);
});
