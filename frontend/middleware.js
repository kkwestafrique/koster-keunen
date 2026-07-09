// Vercel Edge Middleware — rate limits all /api/* routes to 100 requests/minute/IP.
// Note: this app is a Supabase-backed SPA with no custom API routes today; this
// middleware is wired up so that any Vercel Serverless/Edge Functions added later
// under /api/* are automatically rate limited.
//
// The in-memory counter below is per Edge Function instance (best-effort). For
// strict, globally-consistent rate limiting across all edge regions, back this
// with Vercel KV / Upstash Redis instead of the Map.

export const config = {
  matcher: '/api/:path*',
};

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

const requestLog = new Map(); // ip -> [timestamps]

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export default function middleware(request) {
  const ip = getClientIp(request);
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);
}
