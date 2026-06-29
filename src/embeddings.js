/**
 * Embedding helper.
 * Calls Azure OpenAI text-embedding endpoint.
 * Returns null (gracefully) if the endpoint is not configured.
 */

export async function embed(text) {
  const endpoint = process.env.AOAI_ENDPOINT;
  const key = process.env.AOAI_KEY;
  const deployment = process.env.AOAI_EMBED_DEPLOYMENT ?? 'text-embedding-3-large';
  const apiVersion = process.env.AOAI_API_VERSION ?? '2024-02-01';

  if (!endpoint || !key) return null;

  const url = `${endpoint}openai/deployments/${deployment}/embeddings?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding request failed (${res.status}): ${body}`);
  }

  const { data } = await res.json();
  return data[0].embedding;
}
