// Cloudflare Pages Function: share a quiz with a link.
//   POST /api/quizlo-share            body: a .quizlo file   -> { id }
//   GET  /api/quizlo-share?id=<id>    -> the .quizlo file
//   GET  /api/quizlo-share?status=1   -> { enabled }
// Needs a KV namespace bound to the Pages project as QUIZLO_SHARES (Settings -> Bindings -> Add ->
// KV namespace). Shared quizzes are kept for a year. KV values are limited to 25 MB, so bigger quizzes
// (with videos) are stored in parts.

const CHUNK = 20 * 1024 * 1024;
const MAX = 90 * 1024 * 1024;
const TTL = 60 * 60 * 24 * 365;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) => Response.json(data, { status, headers: CORS });

function newId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => chars[b % chars.length]).join('');
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  if (!env.QUIZLO_SHARES) return json({ error: "Sharing links aren't switched on yet." }, 503);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX)
    return json({ error: 'That quiz is too big to share with a link (the limit is 90 MB).' }, 413);
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    return json({ error: "That isn't a Quizlo quiz file." }, 400);
  const id = newId();
  const parts = Math.ceil(bytes.length / CHUNK);
  for (let i = 0; i < parts; i++) {
    await env.QUIZLO_SHARES.put(`${id}:${i}`, bytes.slice(i * CHUNK, (i + 1) * CHUNK), { expirationTtl: TTL });
  }
  await env.QUIZLO_SHARES.put(`${id}:meta`, JSON.stringify({ parts, size: bytes.length, created: Date.now() }), {
    expirationTtl: TTL,
  });
  return json({ id });
}

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  if (params.has('status')) return json({ enabled: !!env.QUIZLO_SHARES });
  if (!env.QUIZLO_SHARES) return json({ error: "Sharing links aren't switched on yet." }, 503);
  const id = (params.get('id') || '').replace(/[^a-z0-9]/g, '').slice(0, 20);
  const meta = id && (await env.QUIZLO_SHARES.get(`${id}:meta`, 'json'));
  if (!meta) return json({ error: "That link has expired or doesn't exist." }, 404);
  const out = new Uint8Array(meta.size);
  let at = 0;
  for (let i = 0; i < meta.parts; i++) {
    const part = await env.QUIZLO_SHARES.get(`${id}:${i}`, 'arrayBuffer');
    if (!part) return json({ error: "That link has expired or doesn't exist." }, 404);
    out.set(new Uint8Array(part), at);
    at += part.byteLength;
  }
  return new Response(out, {
    headers: { ...CORS, 'Content-Type': 'application/zip', 'Cache-Control': 'public, max-age=86400' },
  });
}
