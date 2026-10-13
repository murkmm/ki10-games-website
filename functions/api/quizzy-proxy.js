// Cloudflare Pages Function: GET /api/quizzy-proxy?url=<https url>
//
// Lets the Quizzy Quiz Writer (served from this site at /quizzy/) download pictures, songs and
// videos from search results on sites that don't allow web pages to read them directly (CORS).
// Only public https addresses and media/JSON responses are passed through.

const MAX_BYTES = 300 * 1024 * 1024;
const ALLOWED_TYPES = ["image/", "audio/", "video/", "application/json", "text/javascript",
  "application/javascript", "application/ogg", "application/octet-stream", "binary/octet-stream"];

function reply(status, body, headers = {}) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } });
}

function allowed(target) {
  let u;
  try { u = new URL(target); } catch (_) { return false; }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || /\.(local|lan|internal|home)$/.test(host) || host.startsWith("[")) return false;
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if ([0, 10, 127].includes(a) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
  }
  return true;
}

export async function onRequestGet({ request }) {
  const params = new URL(request.url).searchParams;
  if (params.has("ping")) return Response.json({ ok: true });
  const target = params.get("url") || "";
  if (!allowed(target)) return reply(400, "That address isn't allowed.");

  let upstream;
  try {
    upstream = await fetch(target, {
      headers: { "User-Agent": "QuizzyQuizWriter/0.2 (+https://ki10games.com/quizzy/)", Accept: "*/*" },
      redirect: "follow",
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
  } catch (_) {
    return reply(502, "Couldn't download that.");
  }
  const type = (upstream.headers.get("content-type") || "application/octet-stream").toLowerCase();
  if (!ALLOWED_TYPES.some((t) => type.startsWith(t))) return reply(415, "That isn't a picture, sound or video.");
  const size = Number(upstream.headers.get("content-length") || 0);
  if (size > MAX_BYTES) return reply(413, "That file is too big.");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
