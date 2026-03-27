# AI Prospecting Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 5-stage AI prospecting pipeline that turns zip code + industry into qualified, enriched leads with personalized outreach materials — integrated into the existing Scraper page.

**Architecture:** Extends the existing BullMQ worker pipeline. Each prospecting stage is a separate processor that chains to the next. Data flows through the existing `companies` and `contacts` tables with a new `prospectingData` JSONB column. Frontend adds an "AI Prospecting" mode toggle to the Scraper page.

**Tech Stack:** TypeScript, Express, BullMQ, Playwright (screenshots + scraping), Claude API (Anthropic SDK), Apollo.io API, Cheerio, pdfkit-free templates, Cloudflare R2

**Spec:** `docs/superpowers/specs/2026-03-26-ai-prospecting-pipeline-design.md`

---

## Task 1: Schema Changes + Queue Setup

**Files:**
- Modify: `packages/shared/src/schema/companies.ts` — add prospecting columns
- Modify: `packages/shared/src/schema/scrape-jobs.ts` — add mode field
- Create: `packages/shared/src/queues/prospect.ts` — BullMQ queue factory
- Modify: `packages/shared/src/index.ts` — export new queue
- Run: migration

- [ ] **Step 1: Add prospecting columns to companies**

In `packages/shared/src/schema/companies.ts`, add to the table:
```typescript
prospectingData: jsonb('prospecting_data'),
prospectingStatus: varchar('prospecting_status', { length: 20 }),
```

- [ ] **Step 2: Add mode to scrape_jobs**

In `packages/shared/src/schema/scrape-jobs.ts`, add:
```typescript
mode: varchar('mode', { length: 20 }).notNull().default('standard'),
```

- [ ] **Step 3: Create prospect queue factory**

Create `packages/shared/src/queues/prospect.ts`:
```typescript
import { Queue } from 'bullmq';
import { getRedisConnection } from './redis.js';

export const PROSPECT_QUEUE_NAME = 'prospect-pipeline';

export interface ProspectJobData {
  companyId: string;
  scrapeJobId: string;
  stage: 'qualify' | 'enrich' | 'mockup' | 'outreach';
}

export function createProspectQueue() {
  return new Queue<ProspectJobData>(PROSPECT_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
  });
}
```

Check where other queue factories live (likely `packages/shared/src/queues/` or inline in shared index). Follow the same pattern. Export from shared index.

- [ ] **Step 4: Generate and apply migration**

```bash
npx drizzle-kit generate
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/ migrations/
git commit -m "feat: add prospecting schema columns + prospect queue factory"
```

---

## Task 2: Stage 1+2 — Smart Discovery + Website Qualification

**Files:**
- Create: `apps/worker/src/processors/prospect-qualify.ts`
- Modify: `apps/worker/src/processors/scrape.ts` — chain to prospect-qualify for AI mode
- Modify: `apps/worker/src/index.ts` — register prospect worker

- [ ] **Step 1: Create prospect-qualify processor**

Create `apps/worker/src/processors/prospect-qualify.ts`:

This processor receives a `ProspectJobData` with `stage: 'qualify'` and a `companyId`. It:
1. Loads the company from DB
2. Checks review count: if `googleRating` count is available and < threshold (20 default), mark `prospectingStatus: 'filtered'` with reason, return
3. Checks if the company has a website. If no website, auto-qualify (score = 0, needs one)
4. If website exists, check `websiteAudit.score`. If audit hasn't run yet, trigger website audit queue and re-queue this job with a delay. If score >= 70, mark as filtered. If < 70, qualify.
5. On qualification pass: update `prospectingStatus: 'qualifying' → 'enriching'`, enqueue next stage (`stage: 'enrich'`)

```typescript
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, companies } from '@buildkit/shared';
import type { ProspectJobData } from '@buildkit/shared';
import { createProspectQueue } from '@buildkit/shared';

let prospectQueue: ReturnType<typeof createProspectQueue> | null = null;
function getProspectQueue() {
  if (!prospectQueue) prospectQueue = createProspectQueue();
  return prospectQueue;
}

export async function processProspectQualify(job: Job<ProspectJobData>) {
  const { companyId, scrapeJobId } = job.data;
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return;

  const audit = company.websiteAudit as { score?: number } | null;
  const reviewCount = company.googleReviewCount ?? 0; // may need to parse from Places data
  const websiteScore = audit?.score ?? 0;
  const hasWebsite = !!company.website;

  // Review gate
  const minReviews = (company.prospectingData as any)?.config?.minReviews ?? 20;
  if (reviewCount < minReviews) {
    await db.update(companies).set({
      prospectingStatus: 'filtered',
      prospectingData: { ...((company.prospectingData as object) || {}), filterReason: `Only ${reviewCount} reviews (min: ${minReviews})` },
    }).where(eq(companies.id, companyId));
    return;
  }

  // Website score gate
  const maxScore = (company.prospectingData as any)?.config?.maxWebsiteScore ?? 70;
  if (hasWebsite && websiteScore >= maxScore) {
    await db.update(companies).set({
      prospectingStatus: 'filtered',
      prospectingData: { ...((company.prospectingData as object) || {}), filterReason: `Website score ${websiteScore} (max: ${maxScore})` },
    }).where(eq(companies.id, companyId));
    return;
  }

  // Qualified — advance to enrichment
  await db.update(companies).set({
    prospectingStatus: 'enriching',
    prospectingData: {
      ...((company.prospectingData as object) || {}),
      qualifiedAt: new Date().toISOString(),
      filterHistory: { reviewCount, websiteScore, qualificationPassed: true },
    },
  }).where(eq(companies.id, companyId));

  await getProspectQueue().add('enrich', { companyId, scrapeJobId, stage: 'enrich' });
  console.log(`[prospect-qualify] ${company.name} qualified → enrichment`);
}
```

- [ ] **Step 2: Modify scrape processor to chain for AI mode**

In `apps/worker/src/processors/scrape.ts`, after a company is inserted, check if the scrape job mode is `'ai-prospect'`. If so, set `prospectingStatus: 'qualifying'` on the company and enqueue a prospect-qualify job.

After the scrape loop completes (where companies are inserted), add:
```typescript
// If AI prospect mode, enqueue qualification
if (job.data.mode === 'ai-prospect') {
  const prospectQueue = getProspectQueue();
  await prospectQueue.add('qualify', { companyId: newCompany.id, scrapeJobId: jobId, stage: 'qualify' });
  await db.update(companies).set({ prospectingStatus: 'qualifying', source: 'ai-prospect' }).where(eq(companies.id, newCompany.id));
}
```

Import `createProspectQueue` from shared.

- [ ] **Step 3: Register prospect worker in index.ts**

In `apps/worker/src/index.ts`, add:
```typescript
import { processProspectQualify } from './processors/prospect-qualify.js';
import { processProspectEnrich } from './processors/prospect-enrich.js';
import { processProspectMockup } from './processors/prospect-mockup.js';
import { processProspectOutreach } from './processors/prospect-outreach.js';
import { PROSPECT_QUEUE_NAME } from '@buildkit/shared';

const prospectWorker = new Worker<ProspectJobData>(
  PROSPECT_QUEUE_NAME,
  async (job) => {
    switch (job.data.stage) {
      case 'qualify': return processProspectQualify(job);
      case 'enrich': return processProspectEnrich(job);
      case 'mockup': return processProspectMockup(job);
      case 'outreach': return processProspectOutreach(job);
    }
  },
  { connection, concurrency: 3 },
);
prospectWorker.on('failed', (job, err) => console.error(`[prospect] Job ${job?.id} failed:`, err.message));
```

Create stub files for enrich/mockup/outreach processors that just log and advance to next stage (implemented in later tasks).

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/
git commit -m "feat: prospect pipeline stages 1+2 — smart discovery + website qualification"
```

---

## Task 3: Stage 3 — Decision Maker Enrichment

**Files:**
- Create: `apps/worker/src/processors/prospect-enrich.ts`
- Create: `apps/worker/src/lib/enrichment-sources.ts` — source-specific scrapers

- [ ] **Step 1: Create enrichment source helpers**

Create `apps/worker/src/lib/enrichment-sources.ts` with these functions:

```typescript
// 1. scrapeAboutPage(website: string) → { name, title, email } | null
//    Fetches /about, /team, /our-team pages via fetch + Cheerio
//    Uses Claude to extract owner/CEO name from page text

// 2. scrapeBBB(companyName: string, city: string, state: string) → { name, title } | null
//    Searches bbb.org for the business, extracts principal/owner name

// 3. searchTexasSOS(companyName: string) → { name } | null
//    Searches Texas Secretary of State business filings for registered agent

// 4. apolloLookup(domain: string, companyName: string) → { name, email, phone, title, linkedinUrl } | null
//    Uses Apollo.io People API to find owner/CEO by company domain
//    Only called if APOLLO_API_KEY is set
```

Each function returns a normalized result or null. All wrapped in try/catch — failures are silent (return null, log error).

For the Claude extraction (About page), use the Anthropic SDK:
```typescript
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();

async function extractOwnerFromText(pageText: string, companyName: string): Promise<{ name: string; title: string } | null> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: `Extract the owner, CEO, or primary decision maker's name and title from this company page text. Company: ${companyName}\n\nPage text:\n${pageText.slice(0, 3000)}\n\nReturn JSON: { "name": "First Last", "title": "Owner" } or null if not found.` }],
  });
  // Parse response
}
```

- [ ] **Step 2: Create prospect-enrich processor**

Create `apps/worker/src/processors/prospect-enrich.ts`:

```typescript
export async function processProspectEnrich(job: Job<ProspectJobData>) {
  const { companyId, scrapeJobId } = job.data;
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return;

  let ownerData: { name: string; title: string; email?: string; phone?: string; source: string } | null = null;

  // Try sources in order
  // 1. About page
  if (company.website) {
    const aboutResult = await scrapeAboutPage(company.website);
    if (aboutResult) ownerData = { ...aboutResult, source: 'website_about' };
  }

  // 2. BBB
  if (!ownerData && company.city) {
    const bbbResult = await scrapeBBB(company.name, company.city, company.state ?? 'TX');
    if (bbbResult) ownerData = { ...bbbResult, source: 'bbb' };
  }

  // 3. Texas SOS
  if (!ownerData) {
    const sosResult = await searchTexasSOS(company.name);
    if (sosResult) ownerData = { name: sosResult.name, title: 'Registered Agent', source: 'texas_sos' };
  }

  // 4. Apollo fallback
  if (!ownerData && process.env.APOLLO_API_KEY && company.website) {
    const domain = new URL(company.website).hostname;
    const apolloResult = await apolloLookup(domain, company.name);
    if (apolloResult) ownerData = { ...apolloResult, source: 'apollo' };
  }

  if (!ownerData) {
    await db.update(companies).set({
      prospectingStatus: 'no-contact',
      prospectingData: { ...((company.prospectingData as object) || {}), enrichedAt: new Date().toISOString(), enrichmentSources: [] },
    }).where(eq(companies.id, companyId));
    return;
  }

  // Create contact record
  const nameParts = ownerData.name.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || null;

  const [contact] = await db.insert(contacts).values({
    companyId,
    firstName,
    lastName,
    email: ownerData.email ?? null,
    phone: ownerData.phone ?? null,
    title: ownerData.title,
    isPrimary: true,
  }).returning();

  // Update company prospecting data
  await db.update(companies).set({
    prospectingStatus: 'generating',
    prospectingData: {
      ...((company.prospectingData as object) || {}),
      enrichedAt: new Date().toISOString(),
      enrichmentSources: [ownerData.source],
      contactId: contact.id,
    },
  }).where(eq(companies.id, companyId));

  // Advance to mockup stage
  await getProspectQueue().add('mockup', { companyId, scrapeJobId, stage: 'mockup' });
  console.log(`[prospect-enrich] ${company.name} enriched (${ownerData.source}) → mockup`);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/processors/prospect-enrich.ts apps/worker/src/lib/enrichment-sources.ts
git commit -m "feat: prospect stage 3 — decision maker enrichment (About, BBB, SOS, Apollo)"
```

---

## Task 4: Stage 4 — Template Preview Generation

**Files:**
- Create: `apps/worker/src/processors/prospect-mockup.ts`
- Create: `apps/worker/src/templates/prospect/restaurant.html`
- Create: `apps/worker/src/templates/prospect/contractor.html`
- Create: `apps/worker/src/templates/prospect/salon.html`
- Create: `apps/worker/src/templates/prospect/default.html`

- [ ] **Step 1: Create 4 HTML templates**

Each template is a self-contained HTML file (~100 lines) with Tailwind via CDN and placeholder tokens: `{{BUSINESS_NAME}}`, `{{PHONE}}`, `{{ADDRESS}}`, `{{REVIEW_1}}`, `{{REVIEW_2}}`, `{{REVIEW_3}}`, `{{RATING}}`, `{{REVIEW_COUNT}}`.

Templates should be clean, modern, mobile-responsive landing pages that look professional. Each industry variant has different hero imagery (via Unsplash), color schemes, and section layout.

- [ ] **Step 2: Create prospect-mockup processor**

Create `apps/worker/src/processors/prospect-mockup.ts`:

```typescript
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, companies } from '@buildkit/shared';
import type { ProspectJobData } from '@buildkit/shared';
// Import R2 upload helper (check existing pattern in worker codebase)

const TEMPLATE_DIR = path.join(import.meta.dirname, '../templates/prospect');

const INDUSTRY_MAP: Record<string, string> = {
  restaurant: 'restaurant.html',
  food: 'restaurant.html',
  cafe: 'restaurant.html',
  pizza: 'restaurant.html',
  coffee: 'restaurant.html',
  contractor: 'contractor.html',
  construction: 'contractor.html',
  roofing: 'contractor.html',
  plumbing: 'contractor.html',
  hvac: 'contractor.html',
  electrical: 'contractor.html',
  salon: 'salon.html',
  beauty: 'salon.html',
  spa: 'salon.html',
  barber: 'salon.html',
};

function pickTemplate(industry: string | null): string {
  if (!industry) return 'default.html';
  const normalized = industry.toLowerCase();
  for (const [keyword, template] of Object.entries(INDUSTRY_MAP)) {
    if (normalized.includes(keyword)) return template;
  }
  return 'default.html';
}

export async function processProspectMockup(job: Job<ProspectJobData>) {
  const { companyId, scrapeJobId } = job.data;
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return;

  // Load and populate template
  const templateFile = pickTemplate(company.industry);
  let html = fs.readFileSync(path.join(TEMPLATE_DIR, templateFile), 'utf-8');

  html = html
    .replace(/\{\{BUSINESS_NAME\}\}/g, company.name)
    .replace(/\{\{PHONE\}\}/g, company.phone ?? '')
    .replace(/\{\{ADDRESS\}\}/g, [company.address, company.city, company.state].filter(Boolean).join(', '))
    .replace(/\{\{RATING\}\}/g, company.googleRating ?? '4.5')
    .replace(/\{\{REVIEW_COUNT\}\}/g, String(company.googleReviewCount ?? 0));

  // TODO: inject top Google reviews if available from Places data

  // Screenshot via Playwright
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const screenshot = await page.screenshot({ type: 'png' });
  await browser.close();

  // Upload to R2
  // Follow existing R2 upload pattern from the codebase
  const key = `previews/${companyId}.png`;
  // const url = await uploadToR2(key, screenshot, 'image/png');
  const previewUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  // Update company
  await db.update(companies).set({
    prospectingStatus: 'generating',
    prospectingData: {
      ...((company.prospectingData as object) || {}),
      templatePreviewUrl: previewUrl,
      templateUsed: templateFile,
    },
  }).where(eq(companies.id, companyId));

  // Advance to outreach
  await getProspectQueue().add('outreach', { companyId, scrapeJobId, stage: 'outreach' });
  console.log(`[prospect-mockup] ${company.name} screenshot generated → outreach`);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/processors/prospect-mockup.ts apps/worker/src/templates/
git commit -m "feat: prospect stage 4 — industry template preview generation"
```

---

## Task 5: Stage 5 — Claude-Powered Outreach Prep

**Files:**
- Create: `apps/worker/src/processors/prospect-outreach.ts`

- [ ] **Step 1: Create prospect-outreach processor**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, companies, contacts } from '@buildkit/shared';
import type { ProspectJobData } from '@buildkit/shared';

const anthropic = new Anthropic();

export async function processProspectOutreach(job: Job<ProspectJobData>) {
  const { companyId } = job.data;
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return;

  const [contact] = await db.select().from(contacts)
    .where(eq(contacts.companyId, companyId))
    .limit(1);

  const prospData = company.prospectingData as Record<string, any> || {};
  const audit = company.websiteAudit as { score?: number; findings?: string } | null;
  const firstName = contact?.firstName ?? 'there';

  // Generate cold email
  const emailResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Write a short cold email (under 150 words) from Adnaan at BuildKit Labs to ${firstName}, the ${contact?.title ?? 'owner'} of ${company.name} (${company.industry ?? 'local business'} in ${company.city ?? 'DFW'}).

Key facts:
- Their website scored ${audit?.score ?? 'poorly'}/100 in our audit
- They have ${company.googleRating ?? 'good'} Google rating with strong reviews
- Specific website issues: ${audit?.findings ?? 'outdated design, slow loading, not mobile-friendly'}
- We included a preview of what their new site could look like

Tone: conversational, direct, no fluff. Reference their specific business. End with a soft CTA to schedule a quick call. Sign off as Adnaan from BuildKit Labs.

Return JSON: { "subject": "...", "body": "..." }`
    }],
  });

  let generatedEmail = { subject: 'Quick note about your website', body: '' };
  try {
    const text = emailResponse.content[0].type === 'text' ? emailResponse.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) generatedEmail = JSON.parse(jsonMatch[0]);
  } catch { /* use default */ }

  // Generate call prep
  const callPrepResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Generate 3 concise bullet-point talking points for a cold call to ${firstName} at ${company.name}. They're a ${company.industry ?? 'local business'} in ${company.city ?? 'DFW'} with a website scoring ${audit?.score ?? 'low'}/100. We build websites for local businesses starting at $1,000. Be specific to their business. Return JSON array of strings.`
    }],
  });

  let callPrepNotes: string[] = [];
  try {
    const text = callPrepResponse.content[0].type === 'text' ? callPrepResponse.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) callPrepNotes = JSON.parse(jsonMatch[0]);
  } catch { /* use empty */ }

  // Update company — READY
  await db.update(companies).set({
    prospectingStatus: 'ready',
    prospectingData: {
      ...prospData,
      status: 'ready',
      generatedEmail,
      callPrepNotes,
      outreachGeneratedAt: new Date().toISOString(),
    },
  }).where(eq(companies.id, companyId));

  console.log(`[prospect-outreach] ${company.name} — email + call prep generated → READY`);
}
```

- [ ] **Step 2: Install Anthropic SDK in worker**

```bash
npm install @anthropic-ai/sdk --workspace=apps/worker
```

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/processors/prospect-outreach.ts apps/worker/package.json
git commit -m "feat: prospect stage 5 — Claude-powered cold email + call prep generation"
```

---

## Task 6: Backend API — Prospecting Mode on Scrape Route

**Files:**
- Modify: `apps/api/src/routes/scrape.ts` — accept mode param, return prospecting data

- [ ] **Step 1: Update POST / to accept mode**

In `apps/api/src/routes/scrape.ts`, in the `POST /` handler:
- Accept `mode` from `req.body` (default `'standard'`)
- Accept `minReviews` and `maxWebsiteScore` config params
- Pass `mode` to the scrape job data
- Save `mode` on the `scrape_jobs` row

- [ ] **Step 2: Add GET /jobs/:id/prospects endpoint**

Returns companies linked to a scrape job that have `source: 'ai-prospect'` and `prospectingStatus` set. Include contact data (owner name, email, phone) and prospecting data (generated email, template preview URL, status).

```typescript
router.get('/jobs/:id/prospects', async (req, res) => {
  const { id } = req.params;
  const prospects = await db.select({
    id: companies.id,
    name: companies.name,
    phone: companies.phone,
    website: companies.website,
    city: companies.city,
    state: companies.state,
    industry: companies.industry,
    googleRating: companies.googleRating,
    score: companies.score,
    prospectingStatus: companies.prospectingStatus,
    prospectingData: companies.prospectingData,
    websiteAudit: companies.websiteAudit,
    contactFirstName: contacts.firstName,
    contactLastName: contacts.lastName,
    contactEmail: contacts.email,
    contactPhone: contacts.phone,
    contactTitle: contacts.title,
  })
    .from(companies)
    .leftJoin(contacts, and(eq(contacts.companyId, companies.id), eq(contacts.isPrimary, true)))
    .where(and(eq(companies.scrapeJobId, id), eq(companies.source, 'ai-prospect')))
    .orderBy(desc(companies.createdAt));

  res.json({ data: prospects });
});
```

Note: `companies` table needs a `scrapeJobId` column — or link via `prospectingData.scrapeJobId`. Check which approach fits better with the existing schema. If `scrapeJobId` doesn't exist, filter by the scrape job's created leads instead.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/scrape.ts
git commit -m "feat: API support for AI prospecting mode on scrape endpoint"
```

---

## Task 7: Frontend — AI Prospecting Mode on Scraper Page

**Files:**
- Modify: `apps/web/src/pages/Scraper.tsx` — add mode toggle + prospecting results view

- [ ] **Step 1: Add AI Prospecting toggle to job creation form**

In the scraper configuration section, add a toggle/tab above the existing form:
```tsx
<div className="flex gap-2 mb-4">
  <button onClick={() => setMode('standard')} className={mode === 'standard' ? activeStyle : inactiveStyle}>
    Standard Scrape
  </button>
  <button onClick={() => setMode('ai-prospect')} className={mode === 'ai-prospect' ? activeStyle : inactiveStyle}>
    AI Prospecting
  </button>
</div>
```

When `mode === 'ai-prospect'`, show additional config inputs below the existing zip/query/max fields:
- "Min Reviews" number input (default 20)
- "Max Website Score" number input (default 70)

Pass `mode`, `minReviews`, `maxWebsiteScore` in the POST body when launching.

- [ ] **Step 2: Add prospecting results view**

When viewing results for an AI prospect job, fetch from `/scrape/jobs/${jobId}/prospects` instead of the standard results.

Render a richer results card per lead:
- Pipeline status indicator: 5 dots (Discovered → Qualified → Enriched → Mockup → Ready), colored by current stage
- Owner info: name, title, direct email, direct phone (from enrichment)
- Template preview thumbnail (from `prospectingData.templatePreviewUrl`)
- Generated email preview (expandable, editable textarea)
- Call prep notes (bullet list)
- Action buttons: "Send Email" (pre-fills compose with generated email), "Call Owner" (click-to-call direct number), "Add to Pipeline" (creates deal)

For leads with status `filtered` or `no-contact`, show a muted card with the reason.

- [ ] **Step 3: Update Live Feed sidebar**

For AI prospect leads, show richer cards with owner name, website score badge, and status.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Scraper.tsx
git commit -m "feat: AI Prospecting mode on scraper — config, results view, actions"
```

---

## Summary

| Task | Description | Complexity |
|------|-------------|------------|
| 1 | Schema + queue setup | Small |
| 2 | Stages 1+2: discovery + qualification | Medium |
| 3 | Stage 3: decision maker enrichment | Large |
| 4 | Stage 4: template preview generation | Medium |
| 5 | Stage 5: Claude outreach prep | Medium |
| 6 | Backend API for prospecting mode | Small |
| 7 | Frontend AI prospecting UI | Large |

**Dependencies:** Task 1 → Task 2 → Tasks 3,4,5 (can run sequentially) → Task 6 → Task 7

**Environment Variables Required:**
```
ANTHROPIC_API_KEY=sk-ant-...      # For Claude email/call prep generation
APOLLO_API_KEY=...                 # Optional, for fallback enrichment
R2_BUCKET_NAME=buildkit-files      # Already configured
R2_PUBLIC_URL=https://files.buildkitlabs.com  # Already configured
```
