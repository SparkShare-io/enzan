/**
 * Enzan HTTP Server — Phase 1 multi-tenant transport
 *
 * Implements the MCP Streamable HTTP transport spec.
 * Each tenant gets one persistent McpServer + transport pair,
 * isolating their cortex namespace at the tool layer.
 *
 * Endpoints:
 *   GET  /health          — liveness probe
 *   POST /tenants         — provision a new tenant (ENZAN_ADMIN_KEY required)
 *   ALL  /mcp             — MCP Streamable HTTP endpoint (ENZAN_API_KEY required)
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools/index.js';
import { resolveTenant, isAdminKey } from './auth/middleware.js';
import { provisionTenant } from './tenants/router.js';

/**
 * Per-tenant connection: one McpServer + one transport.
 * Multiple concurrent MCP sessions from the same tenant share this pair —
 * the transport manages sessions internally; the McpServer namespace is shared
 * (safe, since all sessions belong to the same tenant namespace).
 *
 * @type {Map<string, { transport: StreamableHTTPServerTransport, server: McpServer }>}
 */
const tenantConnections = new Map();

async function getOrCreateConnection(tenant) {
  if (tenantConnections.has(tenant.tenantId)) {
    return tenantConnections.get(tenant.tenantId);
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessionclosed: (sessionId) => {
      process.stderr.write(`[enzan] session closed: ${sessionId} (tenant: ${tenant.tenantId})\n`);
    },
  });

  const mcpServer = new McpServer({ name: 'enzan', version: '0.1.0' });
  registerTools(mcpServer, { namespace: tenant.namespace });
  await mcpServer.connect(transport);

  const conn = { transport, server: mcpServer };
  tenantConnections.set(tenant.tenantId, conn);
  process.stderr.write(`[enzan] tenant connected: ${tenant.tenantId} (ns: ${tenant.namespace})\n`);
  return conn;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, mcp-session-id');
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export async function startHttpServer() {
  const port = parseInt(process.env.ENZAN_PORT ?? '3000', 10);

  const httpServer = createServer(async (req, res) => {
    cors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);

    // ── Health check ──────────────────────────────────────────────────────────
    if (url.pathname === '/health' && req.method === 'GET') {
      return json(res, 200, {
        status: 'ok',
        name: 'enzan',
        version: '0.1.0',
        tenants: tenantConnections.size,
      });
    }

    // ── Tenant provisioning ───────────────────────────────────────────────────
    if (url.pathname === '/tenants' && req.method === 'POST') {
      if (!isAdminKey(req.headers.authorization)) {
        return json(res, 401, { error: 'Unauthorized' });
      }
      try {
        const body = await readBody(req);
        if (!body.name) return json(res, 400, { error: 'name is required' });
        const result = await provisionTenant({ name: body.name, tier: body.tier });
        return json(res, 201, result);
      } catch (err) {
        process.stderr.write(`[enzan] provision error: ${err.message}\n`);
        return json(res, 500, { error: err.message });
      }
    }

    // ── MCP endpoint ──────────────────────────────────────────────────────────
    if (url.pathname === '/mcp') {
      const tenant = await resolveTenant(req.headers.authorization);
      if (!tenant) {
        return json(res, 401, { error: 'Invalid or missing API key' });
      }

      try {
        const { transport } = await getOrCreateConnection(tenant);
        await transport.handleRequest(req, res);
      } catch (err) {
        process.stderr.write(`[enzan] mcp error: ${err.message}\n`);
        if (!res.headersSent) {
          return json(res, 500, { error: 'Internal server error' });
        }
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  httpServer.listen(port, () => {
    process.stderr.write(`[enzan] HTTP server listening on http://0.0.0.0:${port}\n`);
    process.stderr.write(`[enzan] MCP endpoint: http://0.0.0.0:${port}/mcp\n`);
    process.stderr.write(`[enzan] Health:       http://0.0.0.0:${port}/health\n`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    process.stderr.write('[enzan] SIGTERM received, shutting down\n');
    httpServer.close(() => process.exit(0));
  });
}
