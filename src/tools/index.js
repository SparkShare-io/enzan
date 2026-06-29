/**
 * Registers all Enzan MCP tools on the McpServer instance.
 *
 * In stdio (single-tenant) mode, namespace defaults to COSMOS_CONTAINER env var.
 * In HTTP mode, a per-tenant namespace is passed in and baked into the handlers.
 */

import { z } from 'zod';
import { recall, upsertDoc, logOp, getDoc } from '../cortex/client.js';

export function registerTools(server, { namespace: fixedNs } = {}) {
  const ns = fixedNs ?? process.env.COSMOS_CONTAINER ?? 'cortex';

  // ── recall ──────────────────────────────────────────────────────────────────
  server.tool(
    'recall',
    {
      query: z.string().describe('Natural language query to search the cortex'),
      type: z
        .enum(['knowledge', 'skill', 'pattern', 'question'])
        .optional()
        .describe('Limit results to a specific doc type'),
      limit: z.number().int().min(1).max(50).optional().default(10),
    },
    async ({ query, type, limit }) => {
      const results = await recall({ query, type, limit }, ns);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  // ── store_knowledge ──────────────────────────────────────────────────────────
  server.tool(
    'store_knowledge',
    {
      doc: z.object({
        id: z.string().describe('knowledge:<slug>'),
        name: z.string(),
        summary: z.string(),
        claim: z.string().optional(),
        confidence: z.enum(['low', 'medium', 'high']).default('medium'),
        sourceStrength: z
          .enum(['single-video', 'multi-source', 'primary-document', 'peer-reviewed'])
          .optional(),
        tags: z.array(z.string()).optional(),
        sourceVideoIds: z.array(z.string()).optional(),
        relatedKnowledgeIds: z.array(z.string()).optional(),
        relatedPatternIds: z.array(z.string()).optional(),
        validUntil: z.string().optional(),
      }),
      summary: z.string().optional().describe('Log entry summary'),
    },
    async ({ doc, summary }) => {
      const saved = await upsertDoc({ ...doc, type: 'knowledge' }, ns);
      await logOp(
        { action: 'store_knowledge', targetType: 'knowledge', targetId: doc.id, summary },
        ns,
      );
      return { content: [{ type: 'text', text: JSON.stringify(saved, null, 2) }] };
    },
  );

  // ── store_skill ──────────────────────────────────────────────────────────────
  server.tool(
    'store_skill',
    {
      doc: z.object({
        id: z.string().describe('skill:<slug>'),
        name: z.string(),
        summary: z.string(),
        steps: z.array(z.string()).optional(),
        pitfalls: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        sourceVideoIds: z.array(z.string()).optional(),
      }),
      summary: z.string().optional(),
    },
    async ({ doc, summary }) => {
      const saved = await upsertDoc({ ...doc, type: 'skill' }, ns);
      await logOp(
        { action: 'store_skill', targetType: 'skill', targetId: doc.id, summary },
        ns,
      );
      return { content: [{ type: 'text', text: JSON.stringify(saved, null, 2) }] };
    },
  );

  // ── store_pattern ────────────────────────────────────────────────────────────
  server.tool(
    'store_pattern',
    {
      doc: z.object({
        id: z.string().describe('pattern:<slug>'),
        name: z.string(),
        domain: z.string().describe('Subject-matter domain for this pattern'),
        summary: z.string(),
        signals: z.array(z.string()).describe('Observable indicators of this pattern'),
        matchingHints: z.string().optional(),
        counterExamples: z.array(z.record(z.unknown())).optional().default([]),
        examples: z.array(z.record(z.unknown())).optional().default([]),
        confidence: z.enum(['low', 'medium', 'high']).default('low'),
        tags: z.array(z.string()).optional(),
        sourceVideoIds: z.array(z.string()).optional(),
        cortexHints: z.string().optional(),
      }),
      summary: z.string().optional(),
    },
    async ({ doc, summary }) => {
      const saved = await upsertDoc({ ...doc, type: 'pattern' }, ns);
      await logOp(
        { action: 'store_pattern', targetType: 'pattern', targetId: doc.id, summary },
        ns,
      );
      return { content: [{ type: 'text', text: JSON.stringify(saved, null, 2) }] };
    },
  );

  // ── add_pattern_example ──────────────────────────────────────────────────────
  server.tool(
    'add_pattern_example',
    {
      patternId: z.string(),
      subject: z.string().optional(),
      subjectId: z.string().optional(),
      sourceVideoId: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ patternId, subject, subjectId, sourceVideoId, notes }) => {
      const pattern = await getDoc(patternId, 'pattern', ns);
      if (!pattern) {
        return {
          content: [{ type: 'text', text: `Pattern not found: ${patternId}` }],
          isError: true,
        };
      }

      const example = {
        subject,
        subjectId,
        sourceVideoId,
        notes,
        addedAt: new Date().toISOString(),
      };

      const existing = pattern.examples ?? [];
      const isDup = existing.some(
        (e) => e.subjectId === subjectId && e.sourceVideoId === sourceVideoId,
      );

      if (!isDup) {
        pattern.examples = [...existing, example];
        await upsertDoc(pattern, ns);
        await logOp(
          {
            action: 'add_pattern_example',
            targetType: 'pattern',
            targetId: patternId,
            summary: `Added example: ${subject ?? subjectId}`,
          },
          ns,
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: isDup
              ? `Example already exists on ${patternId} — no change.`
              : `Example added to ${patternId}.`,
          },
        ],
      };
    },
  );

  // ── log_question ─────────────────────────────────────────────────────────────
  server.tool(
    'log_question',
    {
      text: z.string().describe('The user question to log (will be stored as-is)'),
      sessionId: z.string().optional(),
      move: z.string().optional().describe('Epistemic move classification'),
      frame: z.string().optional(),
      producedIds: z.array(z.string()).optional(),
    },
    async ({ text, sessionId, move, frame, producedIds }) => {
      const ts = new Date().toISOString();
      const id = `question:${ts}-${Math.random().toString(36).slice(2, 8)}`;
      const doc = { id, type: 'question', text, askedAt: ts, sessionId, move, frame, producedIds };
      await upsertDoc(doc, ns);
      return { content: [{ type: 'text', text: `Logged: ${id}` }] };
    },
  );

  // ── upsert_doc ────────────────────────────────────────────────────────────────
  server.tool(
    'upsert_doc',
    {
      doc: z.record(z.unknown()).describe('Arbitrary cortex document (must include id and type)'),
      summary: z.string().optional(),
      log: z.boolean().optional().default(true),
    },
    async ({ doc, summary, log: shouldLog }) => {
      if (!doc.id || !doc.type) {
        return {
          content: [{ type: 'text', text: 'doc must include id and type fields' }],
          isError: true,
        };
      }
      const saved = await upsertDoc(doc, ns);
      if (shouldLog) {
        await logOp(
          {
            action: 'upsert_doc',
            targetType: String(doc.type),
            targetId: String(doc.id),
            summary,
          },
          ns,
        );
      }
      return { content: [{ type: 'text', text: JSON.stringify(saved, null, 2) }] };
    },
  );
}
