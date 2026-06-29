# Loxo

**Typed, structured, self-maintaining memory for AI agents.**

Named for *Loxodonta* — the genus of the animal that never forgets.

---

Most AI memory products are flat vector stores. Loxo is different: a typed, curated, relationship-aware knowledge layer with confidence tracking, provenance, pattern recognition, and maintenance semantics built in. Your agents don't just retrieve — they reason over a cortex that gets sharper over time.

## What makes Loxo different

| Capability | Flat vector stores | Loxo |
|---|---|---|
| Typed documents (`knowledge`, `skill`, `pattern`) | — | ✓ |
| Confidence + provenance tracking | — | ✓ |
| Pattern signals with counter-examples | — | ✓ |
| Supersession / conflict detection | — | ✓ |
| Blindspot analysis | — | ✓ |
| Self-maintaining (lint, stale detection) | — | ✓ |
| Multi-tenant, MCP-native | — | ✓ |

## Document types

- **`knowledge`** — facts, claims, concepts with confidence, source strength, and optional expiry
- **`skill`** — reusable techniques with steps, pitfalls, and source attribution
- **`pattern`** — recurring structures recognizable from `signals[]`, with examples and counter-examples
- **`question`** — logged user queries for blindspot analysis

## MCP tools

Connect via any MCP-compatible client (Claude, Cursor, Windsurf, OpenClaw, etc.):

| Tool | Description |
|---|---|
| `recall` | Semantic + keyword search across your cortex |
| `store_knowledge` | Upsert a typed knowledge doc with confidence + provenance |
| `store_skill` | Upsert a reusable skill doc |
| `store_pattern` | Upsert a pattern with signals and domain |
| `add_pattern_example` | Append/dedupe an example on an existing pattern |
| `log_question` | Record a user question for blindspot analysis |
| `find_blindspots` | Analyze your question corpus against external cognitive frames |
| `upsert_doc` | Generic escape hatch for arbitrary cortex docs |

## Quickstart

```bash
# Install the Loxo MCP server
npx @sparksharе-io/loxo

# Or add to your MCP config manually:
{
  "mcpServers": {
    "loxo": {
      "command": "npx",
      "args": ["@sparksharе-io/loxo"],
      "env": {
        "LOXO_API_KEY": "lx_your_key_here"
      }
    }
  }
}
```

Get your API key at [loxo.ai](https://loxo.ai) — free tier available.

## Architecture

```
AI Agent (Claude, GPT, etc.)
    ↓ MCP over HTTP/SSE
Loxo Gateway
    ↓ API key → tenant namespace
Azure Cosmos DB (per-tenant container)
    ↓
Azure OpenAI (embeddings)
```

## Self-hosted

Loxo runs on any Node.js host with a Cosmos DB backend.

```bash
git clone https://github.com/SparkShare-io/loxo
cd loxo
cp .env.example .env   # fill in your Cosmos + Azure OpenAI credentials
npm install
npm start
```

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## License

MIT — SparkShare.io
