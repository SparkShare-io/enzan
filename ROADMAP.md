# Loxo — Roadmap

## Phase 1 — MCP-as-a-Service MVP

The fastest path to a sellable product. Expose the existing MCP server
over HTTP/SSE (MCP 1.0 native) with per-tenant isolation and API key auth.

- [ ] HTTP/SSE transport (`src/http.js`) — wrap the MCP server in a Node HTTP server with SSE
- [ ] API key middleware (`src/auth/middleware.js`) — Bearer token → tenant lookup ✓ scaffolded
- [ ] Tenant provisioning (`src/tenants/router.js`, `scripts/provision-tenant.js`) ✓ scaffolded
- [ ] Per-tenant Cosmos container isolation ✓ scaffolded in cortex client
- [ ] Usage logging (log every tool call: tenantId, tool, timestamp, token count)
- [ ] Rate limiting (token bucket per tenant, tier-aware)
- [ ] Stripe metered billing wired to usage container
- [ ] Deploy to Azure Container Apps (or Fly.io for speed)

**Target**: working MCP endpoint a customer can point their Claude config at.

---

## Phase 2 — REST API + MCP Registry

Broaden reach beyond MCP-only clients.

- [ ] REST API (`src/http.js` extension) — one REST endpoint per MCP tool, OpenAPI spec
- [ ] Publish npm package `@sparksharе-io/loxo` for stdio self-hosting
- [ ] Submit to MCP server registry
- [ ] Tenant self-service sign-up endpoint (`POST /tenants`) behind LOXO_ADMIN_KEY
- [ ] Usage dashboard (simple Next.js page — calls, docs stored, last active)
- [ ] `find_blindspots` tool implementation (port from AI-Cortex blindspots.js)
- [ ] `capture_video` tool (YouTube transcript → knowledge extraction pipeline)

---

## Phase 3 — Full SaaS

- [ ] Web sign-up + Stripe checkout
- [ ] Tenant web dashboard — cortex browser, usage graphs, API key rotation
- [ ] `cortex_ops` maintenance API — lint, supersede, link-conflict, mark-stale
- [ ] Admin panel (internal) — tenant management, billing ops, usage review
- [ ] Enterprise tier: database-per-tenant isolation, SLA, custom domains
- [ ] HIPAA / FedRAMP alignment path for regulated verticals

---

## Pricing model (planned)

| Tier | Price | Calls/mo | Features |
|---|---|---|---|
| Starter | $49/mo | 10k | recall, store_*, pattern ops |
| Pro | $199/mo | 50k | + blindspots, video ingest |
| Enterprise | $999+/mo | Unlimited | DB isolation, SLA, ops API |
| Overage | $0.01/100 calls | — | above plan cap |
