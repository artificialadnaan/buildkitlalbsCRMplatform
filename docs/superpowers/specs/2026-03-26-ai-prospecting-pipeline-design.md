# AI Prospecting Pipeline — Design Spec

**Date:** 2026-03-26
**Author:** Claude + Adnaan Iqbal
**Status:** Approved
**Project:** BuildKit CRM (internal tool)

## Problem

The existing scraper finds businesses via Google Places but returns generic store info (store phone, no owner name). Sales reps waste time calling front desks and pitching to businesses that don't need a website. Two gaps:
1. **No decision maker data** — reps can't reach the owner directly
2. **No qualification filter** — high-quality leads (established business, bad website) are mixed in with businesses that already have good sites

## Solution

A 5-stage automated pipeline that turns a zip code + industry into qualified, enriched leads with personalized outreach materials. Built into the existing BuildKit CRM as a new mode on the Scraper page.

## Pipeline Stages

### Stage 1: Smart Discovery

Same Google Places API scrape as today, but with a built-in quality gate:
- Input: zip codes + industry/search query + max leads
- Filter: only businesses with **20+ Google reviews** advance (configurable threshold)
- Output: companies inserted into `companies` table with `source: 'ai-prospect'`

Uses existing scraper infrastructure. The review count threshold is the key differentiator — 20+ reviews means an established business with real revenue that can afford a website.

### Stage 2: Website Qualification

For each lead from Stage 1:
- Run existing website audit (Playwright-based) to get a score 0-100
- **Gate: only leads with website score < 70 advance** (configurable)
- Leads with score >= 70 are tagged `prospectingStatus: 'filtered'` with reason "website score too high"
- Leads with no website at all advance automatically (score 0 — they clearly need one)

This ensures reps only work leads that genuinely need web services.

### Stage 3: Decision Maker Enrichment

For qualified leads only (passed Stages 1 + 2). AI agent attempts multiple sources in order:

1. **Company website About/Team page** — Playwright navigates to `/about`, `/team`, `/our-team`, scans for names + titles. Claude extracts owner/CEO/manager name from page content.
2. **BBB listing** — Search `bbb.org/search?find_text={company name}&find_loc={city, state}`. Extract registered owner/principal name.
3. **Texas Secretary of State** — Search business filings for registered agent name (Texas-specific, covers DFW).
4. **Apollo.io API fallback** — If free sources fail, use Apollo people search by company name + domain. Returns verified email + direct phone. Costs ~$0.03/lookup.

Data stored in `contacts` table linked to the company:
- `firstName`, `lastName`, `title` (Owner/CEO/Manager)
- `email` (direct, not info@)
- `phone` (direct, not store number)
- `source`: which enrichment source found them

If no decision maker is found after all sources, lead is tagged `prospectingStatus: 'no-contact'` — still visible to reps but flagged.

### Stage 4: Template Preview Generation

For enriched leads:
1. Select industry-matched template from a set of 4-6 pre-built templates:
   - Restaurant/Food Service
   - Contractor/Trades
   - Salon/Beauty
   - Retail/Shop
   - Professional Services
   - Generic/Default
2. Inject business data into template:
   - Business name
   - Logo (from Google Places or website favicon)
   - Top 3 Google reviews (from Places API)
   - Phone number, address
   - Industry-appropriate hero image
3. Render screenshot via Playwright (1200x800)
4. Upload to Cloudflare R2, store URL on company record

Templates are static HTML files in `apps/worker/src/templates/prospect/`. Simple to add new ones.

### Stage 5: Outreach Preparation

For each lead with enrichment + mockup:
1. **Cold email generation** — Claude API call with prompt:
   - Business name, industry, location
   - Website audit findings (specific issues)
   - Review count + rating
   - Owner first name
   - Template preview image URL
   - Generates: subject line + email body (conversational, short, references their specific problems)
2. **Call prep brief** — Claude generates a 3-bullet talking points summary
3. **Auto-enrollment** (optional) — if a sequence is selected in the job config, auto-enroll the lead's contact in that email sequence

Generated content stored in `companies.prospectingData` JSONB:
```json
{
  "status": "ready",
  "qualifiedAt": "2026-03-26T...",
  "enrichedAt": "2026-03-26T...",
  "enrichmentSources": ["website_about", "bbb"],
  "templatePreviewUrl": "https://files.buildkitlabs.com/previews/abc123.png",
  "generatedEmail": {
    "subject": "Noticed something about Sal's Pizza online",
    "body": "Hey Sal, ..."
  },
  "callPrepNotes": ["They have 47 Google reviews but...", "..."],
  "filterHistory": {
    "reviewCount": 47,
    "websiteScore": 35,
    "qualificationPassed": true
  }
}
```

## Data Model

### Schema Changes

**Modify `companies` table:**
- Add `prospectingData jsonb` — stores all AI prospecting pipeline state and outputs
- Add `prospectingStatus varchar(20)` — enum-like: `pending`, `qualifying`, `enriching`, `generating`, `ready`, `filtered`, `no-contact`, `failed`

**Existing tables used as-is:**
- `contacts` — enriched decision maker stored here
- `companies` — lead data (already has websiteAudit, score, googleRating)
- `scrape_jobs` — job tracking (add `mode: 'standard' | 'ai-prospect'` field)

### New Files

| File | Purpose |
|------|---------|
| `apps/worker/src/processors/prospect-qualify.ts` | Stage 2: website audit + qualification gate |
| `apps/worker/src/processors/prospect-enrich.ts` | Stage 3: multi-source decision maker lookup |
| `apps/worker/src/processors/prospect-mockup.ts` | Stage 4: template selection + screenshot |
| `apps/worker/src/processors/prospect-outreach.ts` | Stage 5: Claude email/call prep generation |
| `apps/worker/src/templates/prospect/*.html` | 4-6 industry templates (static HTML) |
| `apps/api/src/routes/scrape.ts` | Modified: add AI prospect mode to existing scrape endpoint |
| `apps/web/src/pages/Scraper.tsx` | Modified: add AI Prospecting toggle + enriched results view |

## Frontend

### Scraper Page Changes

**Job creation:**
- Toggle: "Standard Scrape" | "AI Prospecting"
- When AI Prospecting selected, show additional config:
  - Review threshold (default 20, slider 10-100)
  - Website score threshold (default 70, slider 0-100)
  - Email sequence to auto-enroll (dropdown, optional)
  - Apollo.io fallback enabled (checkbox, default on)

**Results view:**
- New column: "Pipeline Status" showing the 5-stage progress indicator per lead
- Status badges: Qualifying → Enriching → Generating → Ready
- "Ready" leads show: owner name, direct email/phone, template preview thumbnail, generated email preview
- Click to expand: full email draft (editable), call prep notes, enrichment sources used
- Action buttons: "Send Email" (uses generated draft), "Call Owner" (click-to-call direct number), "Add to Pipeline" (creates deal)

### Live Feed Sidebar

Update existing live feed to show AI prospect leads with richer cards:
- Owner name + title
- Website score badge (red for low)
- Review count
- Template preview thumbnail
- "Ready to contact" / "Enriching..." status

## Cost Analysis

| Component | Cost | When |
|-----------|------|------|
| Google Places API | $0.034/lead | Every lead |
| Website audit (Playwright) | Free | Qualified leads |
| BBB/About page scrape | Free | Qualified leads |
| Texas SOS lookup | Free | Qualified leads |
| Apollo.io fallback | ~$0.03/lookup | Only when free sources fail |
| Claude API (email gen) | ~$0.01/lead | Qualified + enriched leads |
| R2 storage (screenshots) | ~$0.00/lead | Negligible |
| **Total per qualified lead** | **~$0.04-$0.07** | |

For a batch of 100 scraped leads: ~40 pass qualification (20+ reviews, bad website), ~30 get enriched, ~30 get mockups + emails = **~$2-3 total cost per batch**.

## Environment Variables

```
APOLLO_API_KEY=your-apollo-key          # Optional, for fallback enrichment
ANTHROPIC_API_KEY=your-claude-key       # For email/call prep generation
R2_BUCKET_NAME=buildkit-files           # Already configured
R2_PUBLIC_URL=https://files.buildkitlabs.com  # Already configured
```

## Success Criteria

1. Sales reps get leads with owner name + direct contact in 80%+ of qualified leads
2. Generated cold emails are usable without major editing (reps may tweak, but structure is solid)
3. Template previews load and look professional
4. End-to-end pipeline completes within 5 minutes per batch of 20 leads
5. Cost stays under $0.10 per qualified lead
