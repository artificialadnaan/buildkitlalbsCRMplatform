# Stitch MCP Mockup Generator — Design Spec

**Date:** 2026-03-26
**Author:** Claude + Adnaan Iqbal
**Status:** Approved
**Project:** BuildKit CRM — AI Prospecting Pipeline, Stage 4

## Problem

Stage 4 of the AI Prospecting Pipeline currently uses 4 static HTML templates with mustache-style variable injection to generate prospect website mockups. Every restaurant gets the same restaurant template, every contractor the same contractor template. The result is generic and unconvincing — not the kind of preview that makes a business owner think "I need this."

## Solution

Replace the static template approach with Stitch MCP (Google's AI design generation service) to produce a unique, mobile-friendly landing page per prospect. Instead of screenshots, host the generated pages as live web deployments at `buildkitlabs.com/preview/[company-slug]`. Cold emails link directly to the live preview — prospects can tap and see an interactive page, not a flat image.

## Architecture Overview

```
Prospect passes Stage 3 (enrichment)
        │
        ▼
  prospect-mockup processor picks up BullMQ job
        │
        ▼
  prompt-builder.ts builds rich text prompt from company data
  (name, industry, rating, reviews, location, audit findings)
        │
        ▼
  stitch-client.ts → MCP Client → Stitch API
  (generate_screen_from_text, MOBILE, GEMINI_3_1_PRO)
        │
        ▼
  Poll list_screens until screen appears (~3-5 min)
        │
        ▼
  Download HTML from screen.htmlCode.downloadUrl
  Download screenshot from screen.screenshot.downloadUrl
        │
        ▼
  Post-process HTML:
  - Add OG meta tags (title, description, image)
  - Add BuildKit branding footer
  - Sanitize: strip non-Tailwind <script> tags, remove on* handlers
        │
        ▼
  Upload to R2:
  - previews/{slug}/index.html  (the live page)
  - previews/{slug}/og-image.png (Stitch screenshot, re-uploaded)
        │
        ▼
  Update company.prospectingData:
  - previewUrl: buildkitlabs.com/preview/{slug}
  - thumbnailUrl: files.buildkitlabs.com/previews/{slug}/og-image.png
  - previewSlug, stitchScreenId, mockupGeneratedAt
        │
        ▼
  Advance to Stage 5 (outreach)
```

## Stitch MCP Integration

### Verified Response Format

Tested 2026-03-26. After calling `generate_screen_from_text`, screens appear in `list_screens` after ~3-5 minutes. Each screen contains:

```json
{
  "name": "projects/{projectId}/screens/{screenId}",
  "title": "Joe's Plumbing Landing Page",
  "deviceType": "MOBILE",
  "width": "780",
  "height": "12400",
  "htmlCode": {
    "downloadUrl": "https://contribution.usercontent.google.com/download?...",
    "mimeType": "text/html",
    "name": "projects/{projectId}/files/{fileId}"
  },
  "screenshot": {
    "downloadUrl": "https://lh3.googleusercontent.com/aida/...",
    "name": "projects/{projectId}/files/{fileId}"
  }
}
```

**HTML format:** Self-contained ~300-line HTML document with:
- `<!DOCTYPE html>` + `<meta viewport>` already included
- Tailwind CSS via `cdn.tailwindcss.com` with inline custom design tokens
- Google Fonts + Material Symbols loaded from CDN
- AI-generated stock photos hosted on `lh3.googleusercontent.com/aida-public/`
- Full page sections: header, hero, services, testimonials, CTA, footer, mobile bottom nav
- No external JS dependencies beyond Tailwind CDN

**Screenshot format:** PNG image hosted on Google CDN. We download and re-upload to R2 for reliability (Google URLs may expire).

**Key finding:** Playwright is NOT needed for screenshots. Stitch provides a pre-rendered screenshot. This eliminates the Playwright dependency from the worker entirely.

### Client Setup

- Package: `@modelcontextprotocol/sdk` added to worker
- Transport: Streamable HTTP to `https://stitch.googleapis.com/mcp`
- Auth: `X-Goog-Api-Key` header from `STITCH_API_KEY` env var
- Timeout: 5 minutes per generation call

### Shared Project

One Stitch project for all BuildKit prospect mockups. Project ID stored in `STITCH_PROJECT_ID` env var.

**Initialization:** If `STITCH_PROJECT_ID` is not set, `stitch-client.ts` calls `create_project` with title "BuildKit Prospect Previews" on first invocation, logs the project ID, and throws an error instructing the developer to set the env var. This is a one-time manual step — not automatic in production.

### Prompt Building

The prompt is constructed per-prospect from available company data:

```
A modern, mobile-friendly landing page for "{company.name}" — a {industry}
business in {city}, {state}. {rating} stars from {reviewCount} Google reviews.

Include: hero section with business name and tagline, star rating badge,
photo gallery placeholder, {industry-specific sections}, customer testimonial
quotes, contact info (phone, address), Google Maps embed area, and a
prominent "Call Now" CTA button.

Style: {industry-driven style direction}. The page should feel like a premium
{industry} website, not a template.
```

Industry keywords drive style direction. Website audit findings inform emphasis (e.g., "this business has no online menu" → highlight the menu section).

Minimum required: company name. Everything else is optional enrichment.

### Generation Call

- Tool: `generate_screen_from_text`
- `deviceType`: `MOBILE`
- `modelId`: `GEMINI_3_1_PRO`
- `projectId`: shared project ID

### Screen Polling

After `generate_screen_from_text` returns, screens take ~3-5 minutes to appear. The client polls `list_screens` every 15 seconds (max 20 attempts = 5 min). It matches the new screen by checking for a screen ID not in the set of previously known screen IDs.

### Post-Processing

After downloading HTML from `htmlCode.downloadUrl`:
1. **OG meta tags:** Inject `og:title` (business name), `og:description` (industry + city), `og:image` (thumbnail URL) into `<head>`
2. **BuildKit branding footer:** Append a small footer before `</body>`: "Preview powered by BuildKit Labs · buildkitlabs.com"
3. **HTML sanitization (defense-in-depth):**
   - Whitelist: Tailwind CDN script (`cdn.tailwindcss.com`) and inline `tailwind-config` script
   - Strip all other `<script>` tags
   - Remove `on*` event handler attributes (onclick, onerror, etc.)
   - Remove `<iframe>`, `<object>`, `<embed>` tags
   - Remove `javascript:` URIs from href/src attributes
4. **Optional:** Add analytics pixel for tracking opens

HTML manipulation uses `cheerio` (already available in the monorepo or easily added).

## Hosting: Cloudflare R2 + Worker

### R2 Bucket Structure

```
buildkit-files/              (existing bucket)
├── previews/
│   ├── sals-pizza-arlington/
│   │   ├── index.html       ← Stitch-generated page
│   │   └── og-image.png     ← Stitch screenshot for emails/OG tags
│   ├── joes-plumbing-fort-worth/
│   │   ├── index.html
│   │   └── og-image.png
│   └── ...
```

### Slug Generation

- Format: `{company-name}-{city}`, lowercased, stripped to alphanumeric + hyphens
- Collision handling: HEAD request to R2 before upload. If slug exists, append `-{first 6 chars of companyId}`
- Examples: `sals-pizza-arlington`, `joes-plumbing-fort-worth`, `elite-roofing-dallas-a3f2c1`

### Cloudflare Worker

~40 lines. Deployed at `buildkitlabs.com/preview/*`.

Behavior:
- Extract slug from path: `/preview/{slug}` → fetch `previews/{slug}/index.html` from R2
- Serve as `text/html` with headers:
  - `Cache-Control: public, max-age=3600`
  - `Content-Security-Policy: default-src 'self'; script-src 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https://lh3.googleusercontent.com data:;`
- Serve `/preview/{slug}/og-image.png` as `image/png`
- 404: branded "Preview not available" page
- R2 bucket bound via `wrangler.toml`

### DNS

- `buildkitlabs.com` must be on Cloudflare (likely already is since `files.buildkitlabs.com` is an R2 custom domain)
- Worker route: `buildkitlabs.com/preview/*`
- All other routes unaffected

### New Repo Artifact

`infrastructure/cloudflare-worker/` with:
- `wrangler.toml` — Worker config, R2 bucket binding, route
- `src/index.ts` — Worker handler

## File Changes

### Modified Files

| File | Change |
|------|--------|
| `apps/worker/src/processors/prospect-mockup.ts` | Rewrite: MCP client → Stitch, download HTML + screenshot, post-process, upload to R2, slug-based paths. Remove Playwright dependency. |
| `apps/worker/src/processors/prospect-outreach.ts` | Read `previewUrl` from `prospectingData`, inject into Claude prompt so generated cold emails include the preview link. Handle missing preview gracefully. |
| `apps/worker/package.json` | Add `@modelcontextprotocol/sdk`, `cheerio`. Remove `playwright` (no longer needed for screenshots). |
| `apps/web/src/pages/Scraper.tsx` | Update `Prospect` interface: add `previewUrl`, `previewSlug` to type. Add `mockup-failed` and `mockup-queued` to `prospectingStatus` union. Update `PIPELINE_STAGES` to handle new statuses. Add badge colors for new statuses (amber for `mockup-queued`, red for `mockup-failed`). Show clickable preview link on prospect cards. |

### New Files

| File | Purpose |
|------|---------|
| `apps/worker/src/lib/stitch-client.ts` | MCP client wrapper — connects to Stitch via HTTP transport, exposes `generatePreview(company)` with polling, returns `{ html, screenshotBuffer, screenId }` |
| `apps/worker/src/lib/prompt-builder.ts` | Builds Stitch prompt from company data + industry style direction |
| `apps/worker/src/lib/html-sanitizer.ts` | Post-processes Stitch HTML: OG tags, branding footer, script stripping, event handler removal |
| `apps/worker/src/lib/slug.ts` | Slug generation + R2 collision checking via `HeadObjectCommand` |
| `infrastructure/cloudflare-worker/src/index.ts` | Cloudflare Worker for serving previews with CSP headers |
| `infrastructure/cloudflare-worker/wrangler.toml` | Worker config with R2 bucket binding + route |
| `infrastructure/cloudflare-worker/package.json` | Worker dependencies |

## Data Model

No schema changes. All data stored in existing `companies.prospectingData` JSONB column.

**New keys in prospectingData:**
- `previewUrl` — `https://buildkitlabs.com/preview/{slug}` (replaces `templatePreviewUrl`)
- `thumbnailUrl` — `https://files.buildkitlabs.com/previews/{slug}/og-image.png`
- `previewSlug` — the generated slug
- `stitchScreenId` — Stitch screen ID for future edits/regeneration
- `mockupGeneratedAt` — timestamp (already exists)

**New `prospectingStatus` values:**
- `mockup-queued` — rate-limited, will retry later (amber badge)
- `mockup-failed` — generation failed after retries (red badge)

## Environment Variables

**Worker (new):**
- `STITCH_API_KEY` — Google API key for Stitch MCP
- `STITCH_PROJECT_ID` — shared Stitch project ID (set after first-time creation)

**Cloudflare Worker:**
- R2 bucket binding configured in `wrangler.toml` (not an env var)

## Error Handling

### Stitch Generation Failure

1. Retry once with `GEMINI_3_FLASH` as fallback model (faster, more reliable)
2. If both fail: log error, set `prospectingStatus: 'mockup-failed'`, advance to Stage 5 without preview link
3. Stage 5 generates email without mockup reference

### Output Validation

- Check returned HTML is >500 chars
- Check contains `<html` or `<body`
- Check has at least one visible text element
- If validation fails: treat as generation failure (same retry/fallback)

### Rate Limiting

1. **Per-request throttle:** 5-second delay between Stitch calls (configurable)
2. **429 backoff:** Exponential backoff starting at 30 seconds, max 3 retries per prospect via BullMQ config
3. **Daily quota exhaustion:** On repeated 429s after retries, set `prospectingStatus: 'mockup-queued'` (retry later, not skipped)
4. **Circuit breaker:** If 3 consecutive prospects in same batch hit rate limits, pause batch's mockup jobs for 15 minutes
5. **Monitoring:** Log every rate limit hit with timestamp, store counter in prospectingData
6. **Fallback:** After circuit breaker + retries exhausted, advance to Stage 5 without preview

### Slug Collision

- HEAD request to R2 before upload
- If exists: append `-{first 6 chars of companyId}`

### R2 Upload Failure

- Handled by existing BullMQ retry (2 attempts, exponential backoff)

### Stitch MCP Connection Timeout

- MCP client timeout: 5 minutes (generation call)
- Screen polling timeout: 5 minutes (20 polls × 15 seconds)
- BullMQ job timeout: 15 minutes for mockup stage (accounts for generation + polling + download + upload + possible retry)

### Worker Concurrency

The prospect worker currently runs at `concurrency: 3`. For mockup jobs specifically, limit to `concurrency: 1` to avoid slamming the Stitch API with parallel requests. The 5-second throttle delay is per-worker, not global — with concurrency > 1, multiple Stitch calls would fire simultaneously. Set mockup processor concurrency to 1 in the worker registration.

### Sparse Data

- Minimum required: company name
- If only name + industry available, build simpler prompt focused on industry/style
- Everything else is optional prompt enrichment

## Preview Lifecycle

- No automatic deletion. Previews stay up indefinitely.
- **Regeneration:** If the pipeline re-runs for a prospect that already has a preview, overwrite the existing slug's `index.html` and `og-image.png` in R2. The URL stays the same. The `stitchScreenId` is updated to the new screen.
- Future: add TTL or manual cleanup from CRM admin UI.

## Success Criteria

1. Each prospect gets a unique, mobile-friendly landing page (not a cookie-cutter template)
2. Preview pages load in <2 seconds on mobile
3. `buildkitlabs.com/preview/{slug}` resolves and serves the page correctly
4. OG image thumbnails render in cold emails
5. Pipeline completes within 5 minutes per prospect (including Stitch generation time)
6. Rate limits slow the pipeline gracefully without killing it
7. Prospects without previews still advance to outreach
