import { describe, it, expect } from 'vitest';
import { postProcessHtml } from '../src/lib/html-sanitizer.js';

const MINIMAL_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body><h1>Test</h1></body></html>`;
const TAILWIND_HTML = `<!DOCTYPE html><html><head>
<script src="https://cdn.tailwindcss.com"></script>
<script id="tailwind-config">tailwind.config = {}</script>
</head><body><h1>Test</h1></body></html>`;

describe('postProcessHtml', () => {
  const opts = {
    businessName: "Sal's Pizza",
    industry: 'restaurant',
    city: 'Arlington',
    thumbnailUrl: 'https://files.buildkitlabs.com/previews/sals-pizza/og-image.png',
  };

  it('injects OG meta tags into head', () => {
    const result = postProcessHtml(MINIMAL_HTML, opts);
    expect(result).toContain('og:title');
    expect(result).toContain("Sal's Pizza");
    expect(result).toContain('og:image');
    expect(result).toContain(opts.thumbnailUrl);
  });

  it('appends BuildKit branding footer', () => {
    const result = postProcessHtml(MINIMAL_HTML, opts);
    expect(result).toContain('BuildKit Labs');
    expect(result).toContain('buildkitlabs.com');
  });

  it('preserves Tailwind CDN and config scripts', () => {
    const result = postProcessHtml(TAILWIND_HTML, opts);
    expect(result).toContain('cdn.tailwindcss.com');
    expect(result).toContain('tailwind-config');
  });

  it('strips non-whitelisted script tags', () => {
    const html = `<!DOCTYPE html><html><head>
<script src="https://cdn.tailwindcss.com"></script>
<script>alert("xss")</script>
<script src="https://evil.com/hack.js"></script>
</head><body><h1>Test</h1></body></html>`;
    const result = postProcessHtml(html, opts);
    expect(result).toContain('cdn.tailwindcss.com');
    expect(result).not.toContain('alert("xss")');
    expect(result).not.toContain('evil.com');
  });

  it('removes on* event handler attributes', () => {
    const html = `<!DOCTYPE html><html><head></head><body><img onerror="alert(1)" src="x"/><div onclick="hack()">Hi</div></body></html>`;
    const result = postProcessHtml(html, opts);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('onclick');
    expect(result).toContain('<img');
    expect(result).toContain('Hi');
  });

  it('removes iframe, object, embed tags', () => {
    const html = `<!DOCTYPE html><html><head></head><body><iframe src="https://evil.com"></iframe><object data="x"></object><embed src="y"/><h1>Keep</h1></body></html>`;
    const result = postProcessHtml(html, opts);
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
    expect(result).toContain('Keep');
  });

  it('removes javascript: URIs', () => {
    const html = `<!DOCTYPE html><html><head></head><body><a href="javascript:alert(1)">Click</a></body></html>`;
    const result = postProcessHtml(html, opts);
    expect(result).not.toContain('javascript:');
  });
});
