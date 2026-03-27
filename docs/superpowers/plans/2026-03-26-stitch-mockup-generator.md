# Stitch MCP Mockup Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static HTML templates in the AI prospecting pipeline Stage 4 with Stitch MCP for per-prospect AI-generated landing pages, hosted live at `buildkitlabs.com/preview/[slug]` via Cloudflare R2 + Worker.

**Architecture:** Worker calls Stitch MCP via `@modelcontextprotocol/sdk` HTTP transport to generate unique mobile landing pages per prospect. Generated HTML is post-processed (OG tags, branding, sanitization via cheerio), then uploaded to the existing R2 bucket. A Cloudflare Worker serves preview pages at `buildkitlabs.com/preview/*`. Stitch also provides pre-rendered screenshots — eliminating the need for Playwright in this processor.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `cheerio`, `@aws-sdk/client-s3`, Cloudflare Workers + Wrangler, Vitest

**Spec:** `docs/superpowers/specs/2026-03-26-stitch-mockup-generator-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `apps/worker/src/lib/stitch-client.ts` | MCP client: connect to Stitch, call `generate_screen_from_text`, poll `list_screens`, return `{ html, screenshotBuffer, screenId }` |
| `apps/worker/src/lib/prompt-builder.ts` | Build Stitch prompt string from company data + industry style direction |
| `apps/worker/src/lib/html-sanitizer.ts` | Post-process HTML: inject OG meta tags, append branding footer, strip dangerous elements |
| `apps/worker/src/lib/slug.ts` | Generate URL slugs from company name + city, check R2 for collisions via `HeadObjectCommand` |
| `infrastructure/cloudflare-worker/src/index.ts` | Cloudflare Worker: serve preview HTML + OG images from R2 with CSP headers |
| `infrastructure/cloudflare-worker/wrangler.toml` | Worker config: R2 bucket binding, route `buildkitlabs.com/preview/*` |
| `infrastructure/cloudflare-worker/package.json` | Worker package with wrangler dev dependency |
| `apps/worker/tests/slug.test.ts` | Unit tests for slug generation |
| `apps/worker/tests/prompt-builder.test.ts` | Unit tests for prompt construction |
| `apps/worker/tests/html-sanitizer.test.ts` | Unit tests for HTML post-processing + sanitization |

### Modified Files

| File | Changes |
|------|---------|
| `apps/worker/package.json` | Add `@modelcontextprotocol/sdk`. Remove `playwright`. |
| `apps/worker/src/processors/prospect-mockup.ts` | Full rewrite: Stitch client → download → sanitize → R2 upload → advance |
| `apps/worker/src/processors/prospect-outreach.ts` | Inject `previewUrl` into Claude prompt so cold emails include the preview link |
| `apps/worker/src/index.ts` | Add dedicated mockup worker on separate `PROSPECT_MOCKUP_QUEUE_NAME` queue at concurrency 1 |
| `packages/shared/src/queues.ts` | Add `PROSPECT_MOCKUP_QUEUE_NAME` queue + `createProspectMockupQueue()`. Update `prospect-enrich.ts` to route mockup jobs to the new queue. |
| `apps/worker/src/processors/prospect-enrich.ts` | Route to mockup queue instead of prospect queue for mockup stage |
| `apps/web/src/pages/Scraper.tsx` | Add `previewUrl`/`previewSlug` to types, new status values, clickable preview link, handle error states in pipeline dots |

---

### Task 1: Slug Generation Utility

**Files:**
- Create: `apps/worker/src/lib/slug.ts`
- Create: `apps/worker/tests/slug.test.ts`

- [ ] **Step 1: Write failing tests for slug generation**

```typescript
// apps/worker/tests/slug.test.ts
import { describe, it, expect } from 'vitest';
import { generateSlug } from '../src/lib/slug.js';

describe('generateSlug', () => {
  it('creates slug from name and city', () => {
    expect(generateSlug("Sal's Pizza", 'Arlington')).toBe('sals-pizza-arlington');
  });

  it('lowercases and strips special characters', () => {
    expect(generateSlug('Joe & Sons HVAC!!!', 'Fort Worth')).toBe('joe-sons-hvac-fort-worth');
  });

  it('collapses multiple hyphens', () => {
    expect(generateSlug('A--B  C', 'D')).toBe('a-b-c-d');
  });

  it('trims leading/trailing hyphens', () => {
    expect(generateSlug('---Test---', 'City---')).toBe('test-city');
  });

  it('handles missing city', () => {
    expect(generateSlug("Bob's Plumbing", null)).toBe('bobs-plumbing');
  });

  it('appends suffix for collision avoidance', () => {
    expect(generateSlug("Sal's Pizza", 'Arlington', 'abc123def')).toBe('sals-pizza-arlington-abc123');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/worker && npx vitest run tests/slug.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement slug.ts**

```typescript
// apps/worker/src/lib/slug.ts

/**
 * Generate a URL-safe slug from company name and city.
 * Optional companyId suffix for collision avoidance.
 */
export function generateSlug(name: string, city: string | null, companyIdSuffix?: string): string {
  const parts = [name, city].filter(Boolean).join('-');
  let slug = parts
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-|-$/g, '');        // trim leading/trailing hyphens

  if (companyIdSuffix) {
    slug += `-${companyIdSuffix.slice(0, 6)}`;
  }

  return slug;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/worker && npx vitest run tests/slug.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/lib/slug.ts apps/worker/tests/slug.test.ts
git commit -m "feat: add slug generation utility for prospect preview URLs"
```

---

### Task 2: Prompt Builder

**Files:**
- Create: `apps/worker/src/lib/prompt-builder.ts`
- Create: `apps/worker/tests/prompt-builder.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/worker/tests/prompt-builder.test.ts
import { describe, it, expect } from 'vitest';
import { buildStitchPrompt } from '../src/lib/prompt-builder.js';

describe('buildStitchPrompt', () => {
  it('builds full prompt with all data', () => {
    const prompt = buildStitchPrompt({
      name: "Sal's Pizza",
      industry: 'restaurant',
      city: 'Arlington',
      state: 'TX',
      googleRating: '4.8',
      phone: '817-555-0123',
      address: '123 Main St',
      reviewCount: 47,
      websiteAuditFindings: 'no online menu, outdated design',
    });
    expect(prompt).toContain("Sal's Pizza");
    expect(prompt).toContain('restaurant');
    expect(prompt).toContain('Arlington');
    expect(prompt).toContain('4.8');
    expect(prompt).toContain('47');
    expect(prompt).toContain('817-555-0123');
    expect(prompt).toContain('no online menu');
    expect(prompt).toContain('Call Now');
  });

  it('builds minimal prompt with just name', () => {
    const prompt = buildStitchPrompt({ name: "Bob's Shop" });
    expect(prompt).toContain("Bob's Shop");
    expect(prompt).toContain('Call Now');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('null');
  });

  it('includes industry-specific style direction', () => {
    const restaurant = buildStitchPrompt({ name: 'Test', industry: 'restaurant' });
    expect(restaurant).toContain('warm');

    const contractor = buildStitchPrompt({ name: 'Test', industry: 'plumbing' });
    expect(contractor).toContain('professional');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/worker && npx vitest run tests/prompt-builder.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement prompt-builder.ts**

```typescript
// apps/worker/src/lib/prompt-builder.ts

interface PromptInput {
  name: string;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  googleRating?: string | null;
  phone?: string | null;
  address?: string | null;
  reviewCount?: number | null;
  websiteAuditFindings?: string | null;
}

const STYLE_MAP: Record<string, string> = {
  restaurant: 'warm colors, appetizing food photography vibe, clean modern layout',
  food: 'warm colors, appetizing food photography vibe, clean modern layout',
  cafe: 'warm, cozy coffee shop aesthetic with earthy tones',
  pizza: 'warm colors, appetizing food photography vibe, clean modern layout',
  bakery: 'warm, artisanal aesthetic with soft pastry colors',
  contractor: 'professional, trustworthy blue/gray tones with strong typography',
  construction: 'professional, trustworthy blue/gray tones with bold geometric shapes',
  roofing: 'professional, dependable feel with sky-blue accents and strong CTAs',
  plumbing: 'professional, clean blue palette with modern utility feel',
  hvac: 'professional, clean blue palette with temperature-themed accents',
  electrical: 'professional, safety-focused with yellow/amber accents',
  landscaping: 'natural greens and earth tones with outdoor photography',
  painting: 'colorful, creative palette showcasing transformations',
  salon: 'elegant, luxurious with soft pastels and gold accents',
  beauty: 'elegant, luxurious with soft pastels and gold accents',
  spa: 'calming, zen-like with soft neutrals and natural textures',
  barber: 'bold, masculine aesthetic with dark tones and sharp typography',
};

function getStyleDirection(industry: string | null | undefined): string {
  if (!industry) return 'clean, modern, professional design with strong visual hierarchy';
  const norm = industry.toLowerCase();
  for (const [keyword, style] of Object.entries(STYLE_MAP)) {
    if (norm.includes(keyword)) return style;
  }
  return 'clean, modern, professional design with strong visual hierarchy';
}

function getIndustrySections(industry: string | null | undefined): string {
  if (!industry) return 'services overview, about section';
  const norm = industry.toLowerCase();
  if (['restaurant', 'food', 'cafe', 'pizza', 'bakery'].some(k => norm.includes(k))) {
    return 'menu highlights, photo gallery, hours of operation';
  }
  if (['contractor', 'construction', 'roofing', 'plumbing', 'hvac', 'electrical', 'landscaping', 'painting'].some(k => norm.includes(k))) {
    return 'services list with icons, project gallery, licensing/insurance badges, service area';
  }
  if (['salon', 'beauty', 'spa', 'barber', 'nails', 'hair'].some(k => norm.includes(k))) {
    return 'services menu with pricing, before/after gallery, booking section';
  }
  return 'services overview, about section, key differentiators';
}

export function buildStitchPrompt(input: PromptInput): string {
  const {
    name, industry, city, state, googleRating,
    phone, address, reviewCount, websiteAuditFindings,
  } = input;

  const location = [city, state].filter(Boolean).join(', ') || 'the local area';
  const industryLabel = industry ?? 'local business';
  const style = getStyleDirection(industry);
  const sections = getIndustrySections(industry);

  let prompt = `A modern, mobile-friendly landing page for "${name}" — a ${industryLabel} in ${location}.`;

  if (googleRating && reviewCount) {
    prompt += ` ${googleRating} stars from ${reviewCount} Google reviews.`;
  } else if (googleRating) {
    prompt += ` Rated ${googleRating} stars on Google.`;
  }

  prompt += `\n\nInclude: hero section with business name and tagline, `;
  if (googleRating) prompt += `star rating badge, `;
  prompt += `${sections}, customer testimonial quotes, `;
  prompt += `contact info (`;
  if (phone) prompt += `phone: ${phone}, `;
  if (address) prompt += `address: ${address}, `;
  prompt += `${location}), and a prominent "Call Now" CTA button.`;

  if (websiteAuditFindings) {
    prompt += `\n\nThis business's current website has these issues: ${websiteAuditFindings}. Make sure the new design specifically addresses these weaknesses.`;
  }

  prompt += `\n\nStyle: ${style}. The page should feel like a premium ${industryLabel} website, not a template. Make it unique and memorable.`;

  return prompt;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/worker && npx vitest run tests/prompt-builder.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/lib/prompt-builder.ts apps/worker/tests/prompt-builder.test.ts
git commit -m "feat: add prompt builder for Stitch MCP screen generation"
```

---

### Task 3: HTML Sanitizer + Post-Processor

**Files:**
- Create: `apps/worker/src/lib/html-sanitizer.ts`
- Create: `apps/worker/tests/html-sanitizer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/worker/tests/html-sanitizer.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/worker && npx vitest run tests/html-sanitizer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement html-sanitizer.ts**

Note: `cheerio` is already in `apps/worker/package.json` (v1.2.0).

```typescript
// apps/worker/src/lib/html-sanitizer.ts
import { load } from 'cheerio';

interface PostProcessOptions {
  businessName: string;
  industry?: string | null;
  city?: string | null;
  thumbnailUrl: string;
}

const ALLOWED_SCRIPT_PATTERNS = [
  /cdn\.tailwindcss\.com/,
];
const ALLOWED_SCRIPT_IDS = ['tailwind-config'];

export function postProcessHtml(html: string, opts: PostProcessOptions): string {
  const $ = load(html);

  // 1. Inject OG meta tags
  const description = `Check out this custom website preview for ${opts.businessName}${opts.city ? ` in ${opts.city}` : ''}.`;
  $('head').append(`<meta property="og:title" content="${escapeAttr(opts.businessName)}" />`);
  $('head').append(`<meta property="og:description" content="${escapeAttr(description)}" />`);
  $('head').append(`<meta property="og:image" content="${escapeAttr(opts.thumbnailUrl)}" />`);
  $('head').append(`<meta property="og:type" content="website" />`);

  // 2. Append branding footer
  $('body').append(`
    <div style="text-align:center;padding:24px 16px;font-family:sans-serif;font-size:12px;color:#888;border-top:1px solid #eee;margin-top:48px;">
      Preview powered by <a href="https://buildkitlabs.com" style="color:#6366f1;text-decoration:none;font-weight:600;">BuildKit Labs</a> · buildkitlabs.com
    </div>
  `);

  // 3. Sanitize scripts — keep Tailwind CDN + config, strip everything else
  $('script').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') || '';
    const id = $el.attr('id') || '';

    const isSrcAllowed = ALLOWED_SCRIPT_PATTERNS.some(p => p.test(src));
    const isIdAllowed = ALLOWED_SCRIPT_IDS.includes(id);

    if (!isSrcAllowed && !isIdAllowed) {
      $el.remove();
    }
  });

  // 4. Remove on* event handlers from all elements
  $('*').each((_, el) => {
    const attribs = $(el).attr();
    if (attribs) {
      for (const attr of Object.keys(attribs)) {
        if (attr.toLowerCase().startsWith('on')) {
          $(el).removeAttr(attr);
        }
      }
    }
  });

  // 5. Remove dangerous elements
  $('iframe, object, embed').remove();

  // 6. Remove javascript: URIs
  $('[href], [src], [action]').each((_, el) => {
    const $el = $(el);
    for (const attr of ['href', 'src', 'action']) {
      const val = $el.attr(attr);
      if (val && val.trim().toLowerCase().startsWith('javascript:')) {
        $el.removeAttr(attr);
      }
    }
  });

  return $.html();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/worker && npx vitest run tests/html-sanitizer.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/lib/html-sanitizer.ts apps/worker/tests/html-sanitizer.test.ts
git commit -m "feat: add HTML sanitizer for Stitch-generated preview pages"
```

---

### Task 4: Stitch MCP Client

**Files:**
- Create: `apps/worker/src/lib/stitch-client.ts`
- Modify: `apps/worker/package.json` — add `@modelcontextprotocol/sdk`

- [ ] **Step 1: Install MCP SDK**

```bash
cd /Users/adnaaniqbal/Developer/Consulting/buildkit-crm
npm install @modelcontextprotocol/sdk --workspace=@buildkit/worker
```

- [ ] **Step 2: Implement stitch-client.ts**

```typescript
// apps/worker/src/lib/stitch-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

interface StitchScreen {
  screenId: string;
  title: string;
  htmlDownloadUrl: string;
  screenshotDownloadUrl: string;
}

interface GenerateResult {
  html: string;
  screenshotBuffer: Buffer;
  screenId: string;
}

let clientInstance: Client | null = null;

async function getClient(): Promise<Client> {
  if (clientInstance) return clientInstance;

  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) throw new Error('[stitch] STITCH_API_KEY env var is required');

  try {
    const transport = new StreamableHTTPClientTransport(
      new URL('https://stitch.googleapis.com/mcp'),
      {
        requestInit: {
          headers: { 'X-Goog-Api-Key': apiKey },
        },
      },
    );

    const client = new Client({ name: 'buildkit-worker', version: '1.0.0' });
    await client.connect(transport);
    clientInstance = client;
    return client;
  } catch (err) {
    clientInstance = null; // Reset on connection failure so next call retries
    throw err;
  }
}

/** Reset the MCP client — call on connection errors to force reconnect */
export function resetClient(): void {
  clientInstance = null;
}

function getProjectId(): string {
  const projectId = process.env.STITCH_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      '[stitch] STITCH_PROJECT_ID is not set. Create a project first:\n' +
      '  1. Use Stitch MCP create_project tool with title "BuildKit Prospect Previews"\n' +
      '  2. Set STITCH_PROJECT_ID=<projectId> in your environment'
    );
  }
  return projectId;
}

/**
 * List all current screen IDs in the project.
 */
async function listScreenIds(client: Client, projectId: string): Promise<Map<string, StitchScreen>> {
  const result = await client.callTool({
    name: 'list_screens',
    arguments: { projectId },
  });

  const screens = new Map<string, StitchScreen>();
  // Parse the response — list_screens returns JSON with a screens array
  const text = (result.content as Array<{ type: string; text?: string }>)
    .find(c => c.type === 'text')?.text;
  if (!text) return screens;

  try {
    const parsed = JSON.parse(text);
    const arr = parsed.screens ?? [];
    for (const s of arr) {
      const idMatch = s.name?.match(/screens\/(.+)$/);
      if (idMatch) {
        screens.set(idMatch[1], {
          screenId: idMatch[1],
          title: s.title ?? '',
          htmlDownloadUrl: s.htmlCode?.downloadUrl ?? '',
          screenshotDownloadUrl: s.screenshot?.downloadUrl ?? '',
        });
      }
    }
  } catch {
    // empty or unparseable
  }
  return screens;
}

/**
 * Generate a preview page via Stitch and return the HTML + screenshot.
 *
 * Flow:
 * 1. Snapshot existing screen IDs
 * 2. Call generate_screen_from_text
 * 3. Poll list_screens until a new screen appears (max 5 min)
 * 4. Download HTML + screenshot from the new screen
 */
export async function generatePreview(prompt: string, modelId = 'GEMINI_3_1_PRO'): Promise<GenerateResult> {
  const client = await getClient();
  const projectId = getProjectId();

  // 1. Snapshot existing screens
  const existingScreens = await listScreenIds(client, projectId);

  // 2. Generate
  await client.callTool({
    name: 'generate_screen_from_text',
    arguments: {
      projectId,
      prompt,
      deviceType: 'MOBILE',
      modelId,
    },
  });

  // 3. Poll for new screen
  const POLL_INTERVAL_MS = 15_000;
  const MAX_POLLS = 20; // 5 minutes total
  let newScreen: StitchScreen | null = null;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const current = await listScreenIds(client, projectId);

    for (const [id, screen] of current) {
      if (!existingScreens.has(id) && screen.htmlDownloadUrl) {
        newScreen = screen;
        break;
      }
    }
    if (newScreen) break;
    console.log(`[stitch] Polling for screen... attempt ${i + 1}/${MAX_POLLS}`);
  }

  if (!newScreen) {
    throw new Error('[stitch] Screen did not appear after 5 minutes of polling');
  }

  // 4. Download HTML + screenshot
  const [htmlResponse, screenshotResponse] = await Promise.all([
    fetch(newScreen.htmlDownloadUrl),
    fetch(newScreen.screenshotDownloadUrl),
  ]);

  if (!htmlResponse.ok) throw new Error(`[stitch] Failed to download HTML: ${htmlResponse.status}`);
  if (!screenshotResponse.ok) throw new Error(`[stitch] Failed to download screenshot: ${screenshotResponse.status}`);

  const html = await htmlResponse.text();
  const screenshotBuffer = Buffer.from(await screenshotResponse.arrayBuffer());

  return { html, screenshotBuffer, screenId: newScreen.screenId };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/lib/stitch-client.ts apps/worker/package.json package-lock.json
git commit -m "feat: add Stitch MCP client with polling for screen generation"
```

---

### Task 5: Rewrite prospect-mockup.ts Processor

**Files:**
- Modify: `apps/worker/src/processors/prospect-mockup.ts` (full rewrite)

- [ ] **Step 1: Rewrite the processor**

Replace the entire contents of `apps/worker/src/processors/prospect-mockup.ts` with:

```typescript
// apps/worker/src/processors/prospect-mockup.ts
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { db, companies, createProspectQueue } from '@buildkit/shared';
import type { ProspectJobData } from '@buildkit/shared';
import { generatePreview } from '../lib/stitch-client.js';
import { buildStitchPrompt } from '../lib/prompt-builder.js';
import { postProcessHtml } from '../lib/html-sanitizer.js';
import { generateSlug } from '../lib/slug.js';

let queue: ReturnType<typeof createProspectQueue> | null = null;
function getQueue() {
  if (!queue) queue = createProspectQueue();
  return queue;
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!; // https://files.buildkitlabs.com
const PREVIEW_BASE_URL = process.env.PREVIEW_BASE_URL ?? 'https://buildkitlabs.com/preview';
const THROTTLE_MS = parseInt(process.env.STITCH_THROTTLE_MS ?? '5000', 10);

async function slugExists(slug: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: `previews/${slug}/index.html`,
    }));
    return true;
  } catch {
    return false;
  }
}

export async function processProspectMockup(job: Job<ProspectJobData>): Promise<void> {
  const { companyId, scrapeJobId } = job.data;
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return;

  const prospData = (company.prospectingData as Record<string, unknown>) || {};
  const audit = company.websiteAudit as { findings?: string; checks?: Record<string, { pass?: boolean; label?: string }> } | null;

  // Build audit findings summary
  let auditFindings: string | undefined;
  if (audit?.findings) {
    auditFindings = audit.findings.slice(0, 300);
  } else if (audit?.checks) {
    const issues = Object.entries(audit.checks)
      .filter(([, v]) => v && !v.pass)
      .map(([, v]) => v.label || 'issue')
      .slice(0, 5);
    if (issues.length > 0) auditFindings = issues.join(', ');
  }

  // Build prompt
  const prompt = buildStitchPrompt({
    name: company.name,
    industry: company.industry,
    city: company.city,
    state: company.state,
    googleRating: company.googleRating,
    phone: company.phone,
    address: company.address,
    reviewCount: (prospData.reviewCount as number | undefined) ?? null,
    websiteAuditFindings: auditFindings,
  });

  // Generate via Stitch — retry with Flash on failure
  // Rate limit (429) errors are re-thrown to let BullMQ handle backoff (30s exponential)
  let result;
  try {
    result = await generatePreview(prompt, 'GEMINI_3_1_PRO');
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // If rate-limited, set mockup-queued and re-throw for BullMQ retry
    if (errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit')) {
      console.warn(`[prospect-mockup] Rate limited for ${company.name} — will retry via BullMQ backoff`);
      await db.update(companies).set({
        prospectingStatus: 'mockup-queued',
        prospectingData: { ...prospData, mockupError: 'rate-limited', rateLimitedAt: new Date().toISOString() },
      }).where(eq(companies.id, companyId));
      throw err; // BullMQ retries with 30s exponential backoff
    }

    // For non-rate-limit errors, retry with Flash
    console.error(`[prospect-mockup] Pro generation failed for ${company.name}, retrying with Flash:`, errMsg);
    try {
      result = await generatePreview(prompt, 'GEMINI_3_FLASH');
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);

      // Rate limit on Flash too — re-throw for BullMQ
      if (retryMsg.includes('429') || retryMsg.toLowerCase().includes('rate limit')) {
        await db.update(companies).set({
          prospectingStatus: 'mockup-queued',
          prospectingData: { ...prospData, mockupError: 'rate-limited', rateLimitedAt: new Date().toISOString() },
        }).where(eq(companies.id, companyId));
        throw retryErr;
      }

      // Both models failed — mark as failed, advance without preview
      console.error(`[prospect-mockup] Flash fallback also failed for ${company.name}:`, retryMsg);
      await db.update(companies).set({
        prospectingStatus: 'mockup-failed',
        prospectingData: { ...prospData, mockupError: retryMsg, mockupGeneratedAt: new Date().toISOString() },
      }).where(eq(companies.id, companyId));
      await getQueue().add('outreach', { companyId, scrapeJobId, stage: 'outreach' });
      return;
    }
  }

  // Validate HTML
  if (result.html.length < 500 || !/<(html|body)/i.test(result.html)) {
    console.error(`[prospect-mockup] Invalid HTML for ${company.name} (length: ${result.html.length})`);
    await db.update(companies).set({
      prospectingStatus: 'mockup-failed',
      prospectingData: { ...prospData, mockupError: 'invalid HTML output', mockupGeneratedAt: new Date().toISOString() },
    }).where(eq(companies.id, companyId));
    await getQueue().add('outreach', { companyId, scrapeJobId, stage: 'outreach' });
    return;
  }

  // Generate slug
  let slug = generateSlug(company.name, company.city);
  // Check for existing preview from a previous run (reuse slug)
  const existingSlug = prospData.previewSlug as string | undefined;
  if (existingSlug) {
    slug = existingSlug;
  } else if (await slugExists(slug)) {
    slug = generateSlug(company.name, company.city, companyId);
  }

  const thumbnailUrl = `${R2_PUBLIC_URL}/previews/${slug}/og-image.png`;

  // Post-process HTML
  const processedHtml = postProcessHtml(result.html, {
    businessName: company.name,
    industry: company.industry,
    city: company.city,
    thumbnailUrl,
  });

  // Upload HTML + screenshot to R2
  await Promise.all([
    r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `previews/${slug}/index.html`,
      Body: processedHtml,
      ContentType: 'text/html; charset=utf-8',
      CacheControl: 'public, max-age=3600',
    })),
    r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `previews/${slug}/og-image.png`,
      Body: result.screenshotBuffer,
      ContentType: 'image/png',
    })),
  ]);

  const previewUrl = `${PREVIEW_BASE_URL}/${slug}`;

  // Update company record
  await db.update(companies).set({
    prospectingStatus: 'generating', // keep as generating until outreach finishes
    prospectingData: {
      ...prospData,
      previewUrl,
      thumbnailUrl,
      previewSlug: slug,
      stitchScreenId: result.screenId,
      mockupGeneratedAt: new Date().toISOString(),
    },
  }).where(eq(companies.id, companyId));

  // Throttle before next job
  await new Promise(resolve => setTimeout(resolve, THROTTLE_MS));

  // Advance to outreach
  await getQueue().add('outreach', { companyId, scrapeJobId, stage: 'outreach' });
  console.log(`[prospect-mockup] ${company.name} → ${previewUrl} → outreach`);
}
```

- [ ] **Step 2: Remove playwright from worker dependencies**

```bash
cd /Users/adnaaniqbal/Developer/Consulting/buildkit-crm
npm uninstall playwright --workspace=@buildkit/worker
```

Note: Only do this if Playwright is not used by any other processor in the worker. Check first:

```bash
grep -r "from 'playwright'" apps/worker/src/ --include="*.ts" | grep -v prospect-mockup
```

If other processors use Playwright (e.g., `website-audit.ts`, `prospect-enrich.ts`), keep it installed and just remove the import from `prospect-mockup.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/processors/prospect-mockup.ts apps/worker/package.json
git commit -m "feat: rewrite prospect-mockup to use Stitch MCP for AI-generated previews"
```

---

### Task 6: Update prospect-outreach.ts to Include Preview URL

**Files:**
- Modify: `apps/worker/src/processors/prospect-outreach.ts:39-55` — inject previewUrl into Claude prompt

- [ ] **Step 1: Update the email generation prompt**

In `apps/worker/src/processors/prospect-outreach.ts`, modify the Claude prompt (lines 43-55) to include the preview URL:

Replace lines 43-55:

```typescript
        content: `Write a short cold email (under 150 words) from Adnaan at BuildKit Labs to ${firstName}, the ${ownerTitle} of ${company.name} (${company.industry ?? 'local business'} in ${company.city ?? 'DFW area'}).

Key facts:
- Their website scored ${websiteScore}/100 in our audit
- They have a ${company.googleRating ?? 'good'} Google rating with loyal customers
- Specific issues: ${auditSummary}
- We build websites for local businesses starting at $1,000
- We included a preview of what their new site could look like

Tone: conversational, direct, no fluff. Reference their specific business by name. End with a soft CTA to schedule a 10-minute call. Sign off as Adnaan from BuildKit Labs.

Return ONLY valid JSON: {"subject": "...", "body": "..."}`,
```

With:

```typescript
        content: `Write a short cold email (under 150 words) from Adnaan at BuildKit Labs to ${firstName}, the ${ownerTitle} of ${company.name} (${company.industry ?? 'local business'} in ${company.city ?? 'DFW area'}).

Key facts:
- Their website scored ${websiteScore}/100 in our audit
- They have a ${company.googleRating ?? 'good'} Google rating with loyal customers
- Specific issues: ${auditSummary}
- We build websites for local businesses starting at $1,000
${previewUrl ? `- We built a free preview of what their new site could look like: ${previewUrl}` : ''}

${previewUrl ? 'Include the preview link naturally in the email body (not just at the end). Make it the centerpiece — "we put together a quick preview of what a modern site for [business] could look like" type framing.' : 'Mention that we can show them a preview of their new site.'}

Tone: conversational, direct, no fluff. Reference their specific business by name. End with a soft CTA to schedule a 10-minute call. Sign off as Adnaan from BuildKit Labs.

Return ONLY valid JSON: {"subject": "...", "body": "..."}`,
```

- [ ] **Step 2: Add the previewUrl variable extraction**

Add this line after line 17 (after the `prospData` declaration on line 17):

```typescript
  const previewUrl = (prospData.previewUrl as string | undefined) ?? null;
```

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/processors/prospect-outreach.ts
git commit -m "feat: inject preview URL into cold email generation prompt"
```

---

### Task 7: Add Dedicated Mockup Queue + Worker Registration

Two BullMQ workers on the same queue will round-robin steal each other's jobs. Instead, we create a separate queue for mockup jobs.

**Files:**
- Modify: `packages/shared/src/queues.ts` — add `PROSPECT_MOCKUP_QUEUE_NAME` and `createProspectMockupQueue()`
- Modify: `apps/worker/src/processors/prospect-enrich.ts` — route mockup jobs to the new queue
- Modify: `apps/worker/src/index.ts` — add dedicated mockup worker on the new queue
- Modify: `apps/worker/src/processors/prospect-mockup.ts` — import from new queue for outreach advancement

- [ ] **Step 1: Add the mockup queue to shared/queues.ts**

In `packages/shared/src/queues.ts`, add after the `createProspectQueue` function (line 136):

```typescript
// Dedicated mockup queue — separate from prospect pipeline to allow concurrency: 1
export const PROSPECT_MOCKUP_QUEUE_NAME = 'prospect-mockup';

export function createProspectMockupQueue() {
  return new Queue<ProspectJobData>(PROSPECT_MOCKUP_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential' as const, delay: 30000 }, // 30s backoff for rate limits
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}
```

- [ ] **Step 2: Update prospect-enrich.ts to route mockup jobs to the new queue**

In `apps/worker/src/processors/prospect-enrich.ts`, find the line that advances to the mockup stage (it calls `getQueue().add('mockup', { companyId, scrapeJobId, stage: 'mockup' })`). Change the import and queue usage:

Add import at top:
```typescript
import { createProspectMockupQueue } from '@buildkit/shared';
```

Add queue getter:
```typescript
let mockupQueue: ReturnType<typeof createProspectMockupQueue> | null = null;
function getMockupQueue() {
  if (!mockupQueue) mockupQueue = createProspectMockupQueue();
  return mockupQueue;
}
```

Replace the mockup queue advancement call:
```typescript
// Old: await getQueue().add('mockup', { companyId, scrapeJobId, stage: 'mockup' });
await getMockupQueue().add('mockup', { companyId, scrapeJobId, stage: 'mockup' });
```

- [ ] **Step 3: Update prospect-mockup.ts to use prospect queue (not mockup queue) for outreach advancement**

In the rewritten `prospect-mockup.ts` (from Task 5), the outreach advancement should use the original prospect queue:

```typescript
// This is already correct — createProspectQueue is imported from @buildkit/shared
// and used to advance to outreach stage on the main prospect pipeline queue
await getQueue().add('outreach', { companyId, scrapeJobId, stage: 'outreach' });
```

Verify the import at the top of `prospect-mockup.ts` uses `createProspectQueue` (not `createProspectMockupQueue`).

- [ ] **Step 4: Register the mockup worker in index.ts**

In `apps/worker/src/index.ts`:

Add imports at top:
```typescript
import { PROSPECT_MOCKUP_QUEUE_NAME } from '@buildkit/shared';
import type { ProspectJobData } from '@buildkit/shared'; // already imported
```

Remove the `'mockup'` case from the existing prospect worker switch (lines 261-266):

```typescript
// Existing prospect worker — remove mockup case
const prospectWorker = new Worker<ProspectJobData>(
  PROSPECT_QUEUE_NAME,
  async (job) => {
    console.log(`[Worker] Processing prospect job ${job.id} — stage: ${job.data.stage}, company: ${job.data.companyId}`);
    switch (job.data.stage) {
      case 'qualify': return processProspectQualify(job);
      case 'enrich': return processProspectEnrich(job);
      // mockup is now on its own queue
      case 'outreach': return processProspectOutreach(job);
    }
  },
  { connection, concurrency: 3 },
);
```

Add the dedicated mockup worker after the prospect worker section (after line 279):

```typescript
// Dedicated mockup worker — concurrency 1 to respect Stitch API rate limits
// Separate queue prevents job-stealing race condition with the main prospect worker
const mockupWorker = new Worker<ProspectJobData>(
  PROSPECT_MOCKUP_QUEUE_NAME,
  async (job) => {
    console.log(`[Worker] Processing mockup job ${job.id} — company: ${job.data.companyId}`);
    await processProspectMockup(job);
  },
  {
    connection,
    concurrency: 1,
    lockDuration: 900_000, // 15 min lock for long-running Stitch generation
  },
);

mockupWorker.on('completed', (job) => {
  console.log(`[Worker] Mockup job ${job.id} completed`);
});

mockupWorker.on('failed', (job, err) => {
  console.error(`[Worker] Mockup job ${job?.id} failed:`, err.message);
});

console.log(`[Worker] Mockup worker started (concurrency: 1, 15min lock) — queue: "${PROSPECT_MOCKUP_QUEUE_NAME}"`);
```

- [ ] **Step 5: Add env var validation at worker startup**

Add after the `const connection = getRedisConnection();` line (line 36) in `index.ts`:

```typescript
// Validate Stitch env vars early — fail fast rather than mid-job
if (!process.env.STITCH_API_KEY) {
  console.warn('[Worker] WARNING: STITCH_API_KEY not set — mockup generation will fail');
}
if (!process.env.STITCH_PROJECT_ID) {
  console.warn('[Worker] WARNING: STITCH_PROJECT_ID not set — mockup generation will fail');
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/queues.ts apps/worker/src/processors/prospect-enrich.ts apps/worker/src/index.ts
git commit -m "feat: add dedicated mockup queue to prevent BullMQ job-stealing between workers"
```

---

### Task 8: Update Frontend (Scraper.tsx)

**Files:**
- Modify: `apps/web/src/pages/Scraper.tsx`

- [ ] **Step 1: Update ProspectData interface (line 35-42)**

Replace:

```typescript
interface ProspectData {
  reviewCount?: number;
  filterReason?: string;
  templatePreviewUrl?: string;
  generatedEmail?: { subject: string; body: string };
  callPrepNotes?: string[];
  enrichmentSources?: string[];
}
```

With:

```typescript
interface ProspectData {
  reviewCount?: number;
  filterReason?: string;
  templatePreviewUrl?: string;
  previewUrl?: string;
  previewSlug?: string;
  thumbnailUrl?: string;
  generatedEmail?: { subject: string; body: string };
  callPrepNotes?: string[];
  enrichmentSources?: string[];
}
```

- [ ] **Step 2: Update Prospect interface prospectingStatus union (line 55)**

Replace:

```typescript
  prospectingStatus: 'qualifying' | 'enriching' | 'generating' | 'ready' | 'filtered' | 'no-contact' | 'failed';
```

With:

```typescript
  prospectingStatus: 'qualifying' | 'enriching' | 'generating' | 'ready' | 'filtered' | 'no-contact' | 'failed' | 'mockup-failed' | 'mockup-queued';
```

- [ ] **Step 3: Update StatusBadge styles (line 67-75)**

Replace:

```typescript
  const styles: Record<string, string> = {
    qualifying: 'bg-blue-100 text-blue-700',
    enriching: 'bg-purple-100 text-purple-700',
    generating: 'bg-amber-100 text-amber-700',
    ready: 'bg-green-100 text-green-700',
    filtered: 'bg-gray-100 text-gray-500',
    'no-contact': 'bg-orange-100 text-orange-600',
    failed: 'bg-red-100 text-red-600',
  };
```

With:

```typescript
  const styles: Record<string, string> = {
    qualifying: 'bg-blue-100 text-blue-700',
    enriching: 'bg-purple-100 text-purple-700',
    generating: 'bg-amber-100 text-amber-700',
    ready: 'bg-green-100 text-green-700',
    filtered: 'bg-gray-100 text-gray-500',
    'no-contact': 'bg-orange-100 text-orange-600',
    failed: 'bg-red-100 text-red-600',
    'mockup-failed': 'bg-red-100 text-red-600',
    'mockup-queued': 'bg-amber-100 text-amber-700',
  };
```

- [ ] **Step 4: Handle error states in pipeline progress dots (around line 325)**

The `PIPELINE_STAGES` array at line 309 is `['qualifying', 'enriching', 'generating', 'ready']`. Prospects with `mockup-failed` or `mockup-queued` status get `currentIdx = -1`, which makes all dots render as incomplete. Add conditional rendering:

After line 309 (`const currentIdx = PIPELINE_STAGES.indexOf(prospect.prospectingStatus);`), add:

```typescript
                const isErrorState = ['mockup-failed', 'mockup-queued', 'failed'].includes(prospect.prospectingStatus);
                // For error states, show progress up to 'generating' (index 2) with an error indicator
                const displayIdx = isErrorState ? 2 : currentIdx;
```

Then in the pipeline dots rendering (line 327), replace `currentIdx` references with `displayIdx`:

```tsx
                    {PIPELINE_STAGES.map((stage, i) => {
                        const isComplete = i <= displayIdx || prospect.prospectingStatus === 'ready';
                        const isCurrent = PIPELINE_STAGES[i] === prospect.prospectingStatus;
                        const isError = isErrorState && i === displayIdx;
```

And in the dot's className, add an error color:

```tsx
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                isError ? 'bg-red-400' :
                                isComplete ? 'bg-green-400' :
                                isCurrent ? 'bg-blue-400 animate-pulse' :
                                'bg-gray-200'
                              }`}
                            />
```

- [ ] **Step 5: Update template preview section (lines 365-372)**

Replace:

```tsx
                    {/* Template preview */}
                    {prospectData?.templatePreviewUrl && (
                      <img
                        src={prospectData.templatePreviewUrl}
                        alt="Website preview"
                        className="rounded-lg border mb-3 w-full max-h-48 object-cover object-top"
                      />
                    )}
```

With:

```tsx
                    {/* Live preview link + thumbnail */}
                    {prospectData?.previewUrl ? (
                      <div className="mb-3">
                        <a
                          href={prospectData.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block group"
                        >
                          {prospectData.thumbnailUrl && (
                            <img
                              src={prospectData.thumbnailUrl}
                              alt={`Website preview for ${prospect.name}`}
                              className="rounded-lg border w-full max-h-48 object-cover object-top group-hover:ring-2 group-hover:ring-indigo-400 transition-all"
                            />
                          )}
                          <span className="text-xs text-indigo-600 hover:text-indigo-800 mt-1 inline-flex items-center gap-1">
                            View live preview →
                          </span>
                        </a>
                      </div>
                    ) : prospectData?.templatePreviewUrl ? (
                      <img
                        src={prospectData.templatePreviewUrl}
                        alt="Website preview"
                        className="rounded-lg border mb-3 w-full max-h-48 object-cover object-top"
                      />
                    ) : null}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Scraper.tsx
git commit -m "feat: update Scraper UI for live preview links and new pipeline statuses"
```

---

### Task 9: Cloudflare Worker for Preview Hosting

**Files:**
- Create: `infrastructure/cloudflare-worker/package.json`
- Create: `infrastructure/cloudflare-worker/wrangler.toml`
- Create: `infrastructure/cloudflare-worker/src/index.ts`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p infrastructure/cloudflare-worker/src
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "buildkit-preview-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^4.0.0",
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 3: Create wrangler.toml**

```toml
name = "buildkit-preview"
main = "src/index.ts"
compatibility_date = "2024-12-01"

# Route: buildkitlabs.com/preview/*
# Configure after first deploy via Cloudflare dashboard or CLI:
#   wrangler routes add "buildkitlabs.com/preview/*" --zone <zone-id>

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "buildkit-files"
```

- [ ] **Step 4: Create the worker**

```typescript
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
```

- [ ] **Step 5: Commit**

```bash
git add infrastructure/cloudflare-worker/
git commit -m "feat: add Cloudflare Worker for serving prospect preview pages from R2"
```

---

### Task 10: Deploy Cloudflare Worker (Walkthrough)

This task is a manual walkthrough — no code changes, just deployment steps.

- [ ] **Step 1: Verify buildkitlabs.com is on Cloudflare**

Log into Cloudflare dashboard → check if `buildkitlabs.com` exists as a zone. If `files.buildkitlabs.com` works as an R2 custom domain, the zone likely exists already.

- [ ] **Step 2: Install wrangler and authenticate**

```bash
cd infrastructure/cloudflare-worker
npm install
npx wrangler login
```

This opens a browser to authenticate with your Cloudflare account.

- [ ] **Step 3: Deploy the worker**

```bash
npx wrangler deploy
```

Expected output: worker deployed with a `*.workers.dev` URL.

- [ ] **Step 4: Add the route**

```bash
# Get your zone ID from Cloudflare dashboard (buildkitlabs.com zone)
npx wrangler routes add "buildkitlabs.com/preview/*" --zone <your-zone-id>
```

Or do this via Cloudflare dashboard: Workers & Pages → buildkit-preview → Settings → Routes → Add route: `buildkitlabs.com/preview/*`

- [ ] **Step 5: Test the 404 page**

Visit `https://buildkitlabs.com/preview/nonexistent-slug` in a browser. Should show the "Preview Not Available" page.

- [ ] **Step 6: Set Railway env vars**

In Railway dashboard, add to the worker service:
- `STITCH_API_KEY` — your Google API key for Stitch MCP
- `STITCH_PROJECT_ID` — the project ID from the test project created earlier (`1487155450466957844`) or create a new production project
- `PREVIEW_BASE_URL` — `https://buildkitlabs.com/preview`

---

### Task 11: End-to-End Test

- [ ] **Step 1: Run a single AI prospect job locally**

```bash
cd /Users/adnaaniqbal/Developer/Consulting/buildkit-crm
# Ensure STITCH_API_KEY, STITCH_PROJECT_ID, R2 creds are in .env
npm run dev --workspace=@buildkit/worker
```

Then trigger a prospect scrape in AI Prospecting mode from the Scraper page, or manually enqueue a mockup job via the Bull Board admin UI (`/admin/queues`).

- [ ] **Step 2: Verify the Stitch generation completes**

Watch worker logs for:
```
[stitch] Polling for screen... attempt 1/20
[stitch] Polling for screen... attempt 2/20
...
[prospect-mockup] Sal's Pizza → https://buildkitlabs.com/preview/sals-pizza-arlington → outreach
```

- [ ] **Step 3: Verify R2 upload**

```bash
# Check the files exist in R2
aws s3 ls s3://buildkit-files/previews/ --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
```

Or visit `https://files.buildkitlabs.com/previews/{slug}/index.html` directly.

- [ ] **Step 4: Verify the Cloudflare Worker serves the page**

Visit `https://buildkitlabs.com/preview/{slug}` in a mobile browser. Verify:
- Page loads and renders correctly
- Mobile bottom nav works
- CSP header is present (check via browser DevTools → Network → Response headers)
- OG image appears when sharing the link

- [ ] **Step 5: Verify the cold email includes the preview link**

Check the company record's `prospectingData.generatedEmail.body` — it should contain the `buildkitlabs.com/preview/{slug}` URL.

- [ ] **Step 6: Verify Scraper.tsx shows the preview**

Open the Scraper page → AI Prospecting mode → find the processed prospect. Verify:
- Thumbnail image is visible
- "View live preview →" link is clickable and opens the correct URL
- Pipeline progress dots handle `mockup-failed` / `mockup-queued` states correctly

---

### Task 12: Cleanup Old Templates

- [ ] **Step 1: Delete static HTML template files**

Only after verifying the Stitch pipeline works end-to-end:

```bash
rm -rf apps/worker/src/templates/prospect/
```

- [ ] **Step 2: Commit**

```bash
git add -A apps/worker/src/templates/
git commit -m "chore: remove static HTML templates replaced by Stitch MCP generation"
```
