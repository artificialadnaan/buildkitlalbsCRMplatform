// infrastructure/cloudflare-worker/src/index.ts

interface Env {
  BUCKET: R2Bucket;
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Preview Not Available</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#374151;}
.c{text-align:center;padding:2rem;}.c h1{font-size:1.5rem;margin-bottom:0.5rem;}.c p{color:#6b7280;}.c a{color:#6366f1;text-decoration:none;}</style>
</head><body><div class="c"><h1>Preview Not Available</h1><p>This preview may have expired or been removed.</p><p><a href="https://buildkitlabs.com">buildkitlabs.com</a></p></div></body></html>`;

const CSP = [
  "default-src 'self'",
  "script-src 'unsafe-inline' https://cdn.tailwindcss.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' https://lh3.googleusercontent.com data:",
  "connect-src 'self'",
].join('; ');

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Match /preview/{slug} or /preview/{slug}/og-image.png
    const match = path.match(/^\/preview\/([a-z0-9-]+)(\/og-image\.png)?$/);
    if (!match) {
      return new Response(NOT_FOUND_HTML, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const slug = match[1];
    const isOgImage = !!match[2];

    const key = isOgImage
      ? `previews/${slug}/og-image.png`
      : `previews/${slug}/index.html`;

    const object = await env.BUCKET.get(key);
    if (!object) {
      return new Response(NOT_FOUND_HTML, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const contentType = isOgImage ? 'image/png' : 'text/html; charset=utf-8';
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    };

    if (!isOgImage) {
      headers['Content-Security-Policy'] = CSP;
    }

    return new Response(object.body, { headers });
  },
} satisfies ExportedHandler<Env>;
