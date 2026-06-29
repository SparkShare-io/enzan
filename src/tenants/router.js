/**
 * Tenant namespace router.
 *
 * Resolves a tenant record to a Cosmos container name (namespace).
 * All cortex operations thread this namespace through to the client
 * so that tenant data is fully isolated at the storage layer.
 *
 * Naming convention: container name = tenant.<tenantId>
 *   e.g. tenant.acme-corp → Cosmos container "tenant.acme-corp"
 *
 * In single-tenant stdio mode, namespace is always the value of
 * COSMOS_CONTAINER (or "cortex"), bypassing this router entirely.
 */

import { CosmosClient } from '@azure/cosmos';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const db = cosmosClient.database(process.env.COSMOS_DB_NAME ?? 'loxo-db');
const tenantsContainer = db.container('tenants');

/**
 * Resolve tenant record → namespace string.
 */
export function tenantNamespace(tenant) {
  return `tenant.${tenant.tenantId}`;
}

/**
 * Provision a new tenant:
 *   1. Generate a raw API key.
 *   2. Create the Cosmos container for the tenant.
 *   3. Write the tenant doc (hashed key only — raw key returned once).
 *
 * Returns { tenantId, namespace, apiKey (raw, show once) }
 */
export async function provisionTenant({ name, tier = 'starter' }) {
  const tenantId = randomUUID();
  const namespace = `tenant.${tenantId}`;
  const rawKey = `lx_${randomUUID().replace(/-/g, '')}`;
  const apiKeyHash = createHash('sha256').update(rawKey).digest('hex');

  // Create the Cosmos container for this tenant
  await db.containers.createIfNotExists({
    id: namespace,
    partitionKey: { paths: ['/type'] },
  });

  // Write the tenant record
  const doc = {
    id: `tenant:${tenantId}`,
    type: 'tenant',
    tenantId,
    name,
    namespace,
    tier,
    apiKeyHash,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await tenantsContainer.items.upsert(doc);

  return { tenantId, namespace, apiKey: rawKey };
}
