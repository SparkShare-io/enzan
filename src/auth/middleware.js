/**
 * API key authentication middleware (HTTP transport only).
 *
 * Validates Bearer tokens against the `tenants` Cosmos container.
 * Resolved tenant info is attached to request context for downstream routing.
 *
 * Tenant doc shape:
 *   {
 *     id: "tenant:<id>",
 *     type: "tenant",
 *     apiKeyHash: "<sha256 hex>",
 *     namespace: "<cosmos-container-name>",
 *     tier: "starter" | "pro" | "enterprise",
 *     active: true,
 *     createdAt: "<iso-ts>"
 *   }
 */

import { createHash } from 'node:crypto';
import { CosmosClient } from '@azure/cosmos';

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const tenantsContainer = cosmosClient
  .database(process.env.COSMOS_DB_NAME ?? 'loxo-db')
  .container('tenants');

function hashKey(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Resolve an API key to its tenant record.
 * Returns null if the key is invalid or the tenant is inactive.
 */
export async function resolveTenant(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const raw = authHeader.slice(7).trim();
  if (!raw) return null;

  const hash = hashKey(raw);

  const { resources } = await tenantsContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.type = "tenant" AND c.apiKeyHash = @hash AND c.active = true',
      parameters: [{ name: '@hash', value: hash }],
    })
    .fetchAll();

  return resources[0] ?? null;
}

/**
 * Check whether a raw key is the admin key.
 * Used for tenant provisioning routes only.
 */
export function isAdminKey(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const raw = authHeader.slice(7).trim();
  return raw === (process.env.LOXO_ADMIN_KEY ?? '');
}
