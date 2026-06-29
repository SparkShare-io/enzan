/**
 * Loxo Cortex Client
 *
 * Thin wrapper around Cosmos DB for cortex read/write operations.
 * Each method accepts a `namespace` string that resolves to a Cosmos
 * container — the isolation boundary between tenants.
 *
 * In single-tenant (stdio) mode, namespace defaults to the value of
 * COSMOS_CONTAINER (or "cortex").
 */

import { CosmosClient } from '@azure/cosmos';
import { embed } from '../embeddings.js';

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const db = cosmosClient.database(process.env.COSMOS_DB_NAME ?? 'loxo-db');

/**
 * Resolve a Cosmos container by namespace.
 * Creates it on first access if it doesn't exist (dev convenience).
 */
async function container(namespace) {
  const name = namespace ?? process.env.COSMOS_CONTAINER ?? 'cortex';
  const { container: c } = await db.containers.createIfNotExists({
    id: name,
    partitionKey: { paths: ['/type'] },
  });
  return c;
}

/**
 * Upsert a document. Always idempotent by `doc.id`.
 */
export async function upsertDoc(doc, namespace) {
  const c = await container(namespace);
  const { resource } = await c.items.upsert(doc);
  return resource;
}

/**
 * Semantic + keyword recall over a specific doc type (or all types).
 *
 * Strategy:
 *   1. If Azure OpenAI is configured, embed the query and run a vector search.
 *   2. Fall back to a keyword LIKE query if embeddings are unavailable.
 */
export async function recall({ query, type, limit = 10 }, namespace) {
  const c = await container(namespace);

  const vectorEnabled = !!(process.env.AOAI_ENDPOINT && process.env.AOAI_KEY);

  if (vectorEnabled) {
    const vector = await embed(query);
    const typeClause = type ? `AND c.type = @type` : '';
    const spec = {
      query: `
        SELECT TOP @limit c.id, c.type, c.name, c.summary, c.confidence,
               VectorDistance(c.vector, @vector) AS score
        FROM c
        WHERE IS_DEFINED(c.vector) ${typeClause}
        ORDER BY VectorDistance(c.vector, @vector)
      `,
      parameters: [
        { name: '@limit', value: limit },
        { name: '@vector', value: vector },
        ...(type ? [{ name: '@type', value: type }] : []),
      ],
    };
    const { resources } = await c.items.query(spec).fetchAll();
    return resources;
  }

  // Keyword fallback
  const typeClause = type ? `AND c.type = @type` : '';
  const spec = {
    query: `
      SELECT TOP @limit c.id, c.type, c.name, c.summary, c.confidence
      FROM c
      WHERE (CONTAINS(LOWER(c.summary ?? ''), LOWER(@q))
             OR CONTAINS(LOWER(c.name ?? ''), LOWER(@q))) ${typeClause}
    `,
    parameters: [
      { name: '@limit', value: limit },
      { name: '@q', value: query },
      ...(type ? [{ name: '@type', value: type }] : []),
    ],
  };
  const { resources } = await c.items.query(spec).fetchAll();
  return resources;
}

/**
 * Fetch a single doc by id + type (partition key).
 */
export async function getDoc(id, type, namespace) {
  const c = await container(namespace);
  const { resource } = await c.item(id, type).read();
  return resource ?? null;
}

/**
 * Write an append-only log entry.
 */
export async function logOp({ action, targetType, targetId, summary, details }, namespace) {
  const ts = new Date().toISOString();
  const id = `log:${ts}-${action}-${targetId ?? 'bulk'}`.replace(/[^a-z0-9:.\-_]/gi, '-');
  return upsertDoc(
    { id, type: 'log', timestamp: ts, action, targetType, targetId, summary, details },
    namespace,
  );
}
