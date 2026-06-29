#!/usr/bin/env node
/**
 * Provision a new Loxo tenant.
 *
 * Usage:
 *   node scripts/provision-tenant.js --name "Acme Corp" --tier starter
 *
 * Outputs the tenant ID, namespace, and API key (shown once — save it).
 */

import 'dotenv/config';
import { parseArgs } from 'node:util';
import { provisionTenant } from '../src/tenants/router.js';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    tier: { type: 'string', default: 'starter' },
  },
});

if (!values.name) {
  process.stderr.write('Usage: node scripts/provision-tenant.js --name "Tenant Name" [--tier starter|pro|enterprise]\n');
  process.exit(1);
}

const result = await provisionTenant({ name: values.name, tier: values.tier });

console.log('\n✓ Tenant provisioned\n');
console.log(`  Tenant ID : ${result.tenantId}`);
console.log(`  Namespace : ${result.namespace}`);
console.log(`  API Key   : ${result.apiKey}  ← save this, shown only once\n`);
