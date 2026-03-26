# BuildKit CRM — 12 Feature Enhancement Spec

**Date:** 2026-03-26
**Author:** Claude + Adnaan Iqbal
**Status:** Approved
**Repo:** buildkitlalbsCRMplatform

## Overview

12 features identified during a full E2E test of the BuildKit CRM platform. Organized into 3 batches by dependency and complexity. All features target the existing monorepo: `apps/api`, `apps/web`, `apps/portal`, `apps/portal-api`, `apps/worker`, `packages/shared`.

### Execution Batches

| Batch | Features | Theme |
|-------|----------|-------|
| 1 | 11, 3, 1, 9 | Quick wins — frontend-heavy, minimal backend |
| 2 | 2, 7, 10, 12 | Core pipeline improvements |
| 3 | 4, 5, 6, 8 | Integration-heavy (Twilio, Stripe, Portal) |

---

## Feature 1: Bulk Actions on Leads Table

### Problem
Leads table has row checkboxes but no bulk action bar. Managing 40+ leads one-by-one is tedious.

### Design

**Frontend (`apps/web/src/pages/Leads.tsx`):**
- When 1+ checkboxes selected, a sticky action bar slides up from the bottom
- Action bar contains: selected count badge, "Assign To" dropdown, "Create Deals" button, "Add to Campaign" button, "Delete" button
- "Select All" checkbox in table header selects all visible rows (current page only)
- Delete shows confirmation modal: "Delete X leads? This cannot be undone."
- "Add to Campaign" navigates to `/outreach/new` with company IDs as query params

**Backend (`apps/api/src/routes/companies.ts`):**
- `PATCH /api/companies/bulk-assign` — body: `{ ids: string[], assignedTo: string }`
- `POST /api/deals/bulk` — body: `{ companyIds: string[], pipelineId: string }` — creates one deal per company at stage position 1
- `DELETE /api/companies/bulk` — body: `{ ids: string[] }` — cascades to contacts, deals via FK constraints
- All endpoints require `admin` role except bulk-assign

### Data Changes
None — uses existing tables.

---

## Feature 2: Deal Stage Change History / Timeline

### Problem
Deal Activity History only shows email sends. Stage changes, SMS, and calls are invisible.

### Design

**Schema (`packages/shared/src/schema/deal-events.ts`):**
```
deal_events table:
  id          uuid PK default random
  dealId      uuid FK -> deals.id ON DELETE CASCADE
  type        enum('stage_change', 'status_change', 'sms_sent', 'call_made', 'note_added', 'email_sent')
  fromValue   varchar(255) nullable
  toValue     varchar(255) nullable
  userId      uuid FK -> users.id
  metadata    jsonb nullable
  createdAt   timestamptz NOT NULL DEFAULT NOW()
```

**Backend event logging (automatic, in existing handlers):**
- `PATCH /api/deals/:id` — when `stageId` changes, insert `stage_change` event with from/to stage names
- `PATCH /api/deals/:id` — when `status` changes, insert `status_change` event
- `POST /sms/send` — when `dealId` provided, insert `sms_sent` event
- `POST /sms/call` — insert `call_made` event
- Email send worker — insert `email_sent` event (supplement existing email_sends data)

**API:** `GET /api/deals/:id/events?page=1&limit=50` — returns paginated deal events, newest first.

**Frontend (`apps/web/src/pages/DealDetail.tsx`):**
- Replace current email-only activity list with unified timeline from `/api/deals/:id/events`
- Icons per type: `mail` (email), `swap_horiz` (stage change), `sms` (SMS), `call` (call), `edit_note` (note)
- Stage change entries: "Moved from **New Lead** → **Contacted** by Adnaan Iqbal"
- SMS entries: message preview, status badge
- Call entries: duration, outcome if logged

---

## Feature 3: Dashboard "My Pipeline" Quick Stats

### Problem
Dashboard shows global pipeline stats. No personal performance view.

### Design

**Backend (`apps/api/src/routes/dashboard.ts`):**
- `GET /api/dashboard/my-stats` — returns:
  - `myActiveDeals`: count + total value of open deals where `assignedTo = userId`
  - `myTasksDueToday`: count of tasks where `assignedTo = userId` and `dueDate <= today` and status != 'done'
  - `myEmailsThisWeek`: count of email_sends where `sentBy = userId` and `sentAt >= startOfWeek`
  - `myWinRate`: percentage of my deals won / (won + lost) in last 90 days

**Frontend (`apps/web/src/pages/Dashboard.tsx`):**
- New row of 4 cards below existing global stats
- Subtle "Personal Stats" label
- Same card component as existing stats, with left-side purple accent bar
- Each card links to filtered view (e.g., "My Active Deals" links to Pipelines with "My Pipeline" toggle)

---

## Feature 4: Notification Center

### Problem
Bell icon exists but is non-functional. No way to know about inbound activity without manually checking each page.

### Design

**Schema (`packages/shared/src/schema/notifications.ts`):**
```
notifications table:
  id          uuid PK default random
  userId      uuid FK -> users.id NOT NULL
  type        varchar(50) NOT NULL
  title       varchar(255) NOT NULL
  body        text nullable
  entityType  varchar(50) nullable  -- 'deal', 'invoice', 'conversation', 'task'
  entityId    uuid nullable
  read        boolean NOT NULL DEFAULT false
  createdAt   timestamptz NOT NULL DEFAULT NOW()
```

**Notification types:** `inbound_sms`, `inbound_call`, `stage_change`, `invoice_paid`, `portal_message`, `task_due`, `follow_up_reminder`

**Backend (`apps/api/src/routes/notifications.ts`):**
- `GET /api/notifications?unread=true&limit=20` — list notifications
- `PATCH /api/notifications/:id/read` — mark single as read
- `PATCH /api/notifications/read-all` — mark all as read
- `GET /api/notifications/unread-count` — returns `{ count: number }`
- Helper: `createNotification({ userId, type, title, body?, entityType?, entityId? })`

**Notification creation points (in existing handlers):**
- SMS inbound webhook → notify all admin users
- Voice inbound webhook → notify all admin users
- Deal stage change → notify deal assignee
- Invoice paid (Stripe webhook, Feature 5) → notify deal assignee
- Portal message → notify project assignee
- Follow-up reminder (Feature 7) → notify deal assignee

**Frontend (`apps/web/src/components/layout/AppLayout.tsx`):**
- Bell icon shows red badge with unread count
- Click opens dropdown panel (max-height 400px, scrollable)
- Each notification: icon, title, body preview, relative timestamp, unread dot
- Click notification → navigate to entity, mark as read
- "Mark all as read" link at top
- Poll `GET /api/notifications/unread-count` every 30 seconds

---

## Feature 5: Invoice Payment Tracking / Stripe Checkout

### Problem
Invoices can be created but clients have no way to pay. No payment collection flow.

### Design

**Schema changes (`packages/shared/src/schema/invoices.ts`):**
- Add columns: `stripeSessionId varchar(255)`, `stripePaymentIntentId varchar(255)`, `paidAt timestamptz`
- Add status value: `paid` to invoice status enum

**Backend (`apps/api/src/routes/invoices-stripe.ts`):**
- `POST /api/invoices/:id/checkout` — creates Stripe Checkout Session:
  - Line items from invoice
  - `success_url`: `{PORTAL_URL}/invoices/{id}?paid=true`
  - `cancel_url`: `{PORTAL_URL}/invoices/{id}`
  - Stores `stripeSessionId` on invoice, updates status to `sent`
  - Returns `{ checkoutUrl: string }`

- `POST /api/webhooks/stripe` — handles `checkout.session.completed`:
  - Looks up invoice by `stripeSessionId`
  - Updates status to `paid`, sets `paidAt`, stores `stripePaymentIntentId`
  - Creates notification for deal assignee (Feature 4)

**Frontend changes:**
- "Send Invoice" button on invoice detail: calls checkout endpoint, emails payment link to client
- Invoice status badges: `draft` (gray) → `sent` (amber) → `paid` (green)
- Invoice list and detail pages show `paidAt` timestamp when paid

**Portal (`apps/portal`):**
- Invoices page shows "Pay Now" button with link to Stripe Checkout
- After payment, shows "Paid" badge with date

---

## Feature 6: Client Portal — Project Progress View

### Problem
Portal has no visual project progress. Clients can't see where their project stands.

### Design

**Backend (`apps/portal-api/src/routes/projects.ts`):**
- `GET /portal/projects/:id/progress` — returns:
  - Milestones with status, task counts (total, completed), completion percentage per milestone
  - Overall progress: milestones completed / total, percentage

**Frontend (`apps/portal/src/pages/ProjectStatus.tsx`):**
- Already exists as a page stub. Enhance with:
- Horizontal stepper/timeline at top: Discovery → Design → Development → Launch
- Each step shows: status icon (pending/in-progress/complete), name, completion percentage
- Active milestone highlighted with brand color
- Below timeline: current milestone detail card with read-only task checklist
- Overall progress bar at top: "2 of 4 milestones complete — 50%"
- Last updated timestamp

---

## Feature 7: Automated Follow-up Reminders

### Problem
Deals can sit in a stage indefinitely with no reminder to follow up.

### Design

**Schema changes:**
- Add `followUpDays integer` column to `pipeline_stages` table (nullable, default 7)
- Add `lastActivityAt timestamptz` column to `deals` table (updated on any deal event)

**Worker (`apps/worker/src/jobs/follow-up-reminders.ts`):**
- Cron: runs daily at 9:00 AM CT
- Query: deals where `status = 'open'` AND `lastActivityAt < NOW() - stage.followUpDays` AND no existing open task with title matching "No activity on%"
- For each stale deal:
  - Create task: title "No activity on [Deal Title] for X days — follow up?", priority "high", linked to deal
  - Create notification (Feature 4): "Follow-up reminder: [Deal Title] has been in [Stage] for X days"

**Backend updates:**
- PATCH `/api/deals/:id` handler: update `lastActivityAt` when stage changes
- SMS send / call / email send handlers: update deal's `lastActivityAt`

**Frontend (`apps/web/src/pages/Settings.tsx`):**
- Each pipeline stage card shows editable "Follow-up after X days" field
- 0 or empty = no reminders for that stage
- Save calls `PATCH /api/pipelines/:pipelineId/stages/:stageId` with `{ followUpDays }`

---

## Feature 8: Call Recording & Notes

### Problem
Calls initiated via Twilio but no recording or post-call notes.

### Design

**Backend (`apps/api/src/lib/twilio.ts`):**
- Modify `makeCall()` to include:
  - `record: true`
  - `recordingStatusCallback: ${apiBaseUrl}/sms/webhook/recording`
  - `statusCallback: ${apiBaseUrl}/sms/webhook/call-status`

**New webhook (`apps/api/src/routes/sms.ts`):**
- `POST /sms/webhook/recording` — receives `RecordingSid`, `RecordingUrl`, `RecordingDuration`, `CallSid`
  - Finds conversation message by `twilioSid = CallSid`
  - Updates `metadata` with recording URL, duration, and SID
- `POST /sms/webhook/call-status` — receives `CallSid`, `CallStatus`, `CallDuration`
  - Updates conversation message status and metadata

**Frontend:**
- Conversation message card: when `metadata.recordingUrl` exists, show play button (audio element with Twilio recording URL + `.mp3`)
- After call ends (status becomes 'completed'), show "Log Call Notes" modal:
  - Duration display (from metadata)
  - Notes textarea
  - Outcome dropdown: Interested / Not Interested / Follow Up / Voicemail / No Answer
- Notes saved as activity on the deal via `POST /api/activities`
- Deal event logged (Feature 2)

---

## Feature 9: Lead Scoring Auto-Refresh

### Problem
Lead scores are calculated once at creation and never updated.

### Design

**Backend (`apps/api/src/lib/lead-scoring.ts`):**
- New function `rescoreCompany(companyId: string)`:
  - Queries current company data, contact count, deal count, has website audit
  - Calls existing `calculateLeadScore()` with fresh data
  - Updates company `score` column
  - Returns new score

**Trigger points (in existing handlers):**
- `POST /api/companies/:id/contacts` → call `rescoreCompany(companyId)`
- Enrichment worker completion → call `rescoreCompany(companyId)`
- `POST /api/deals` (deal created) → call `rescoreCompany(deal.companyId)`
- `POST /api/activities` → call `rescoreCompany(activity.companyId)` (via deal or contact lookup)
- Website audit completion → call `rescoreCompany(companyId)`

**No frontend changes needed** — existing score display and "Sort by Score" work automatically.

---

## Feature 10: ROI Calculator with Real Data

### Problem
ROI Calculator page exists at `/reports/roi` but is empty.

### Design

**Backend (`apps/api/src/routes/reports.ts`):**
- `GET /api/reports/roi?range=90d` — returns:
  - `totalLeadsScraped`: count of companies where source = 'scraped' in range
  - `scraperCost`: totalLeadsScraped * 0.034
  - `totalDealsCreated`: count of deals created in range
  - `totalDealsWon`: count of deals with status = 'won' in range
  - `totalRevenue`: sum of won deal values
  - `leadToDealRate`: totalDealsCreated / totalLeadsScraped * 100
  - `dealToWonRate`: totalDealsWon / totalDealsCreated * 100
  - `costPerLead`: scraperCost / totalLeadsScraped
  - `costPerDeal`: scraperCost / totalDealsCreated
  - `costPerWon`: scraperCost / totalDealsWon
  - `roi`: (totalRevenue - scraperCost) / scraperCost * 100
- Range options: `30d`, `90d`, `ytd`, `all`

**Frontend (`apps/web/src/pages/ROICalculator.tsx`):**
- Time range selector: Last 30 Days / 90 Days / YTD / All Time
- Top row: 3 highlight cards — Total Revenue, Total Cost, ROI Percentage
- Funnel visualization (Recharts): Leads Scraped → Deals Created → Deals Won
- Metrics table: cost per lead, cost per deal, conversion rates
- Guard: if no scraped leads, show empty state "Run the scraper to start tracking ROI"

---

## Feature 11: Mobile-Responsive Sidebar

### Problem
Sidebar doesn't collapse on mobile. Content is cramped or hidden.

### Design

**Hook (`apps/web/src/lib/useMobile.ts`):**
- `useMobile()` returns `{ isMobile: boolean }` — checks `window.innerWidth < 768` with resize listener and debounce

**Layout (`apps/web/src/components/layout/AppLayout.tsx`):**
- Desktop (>= 768px): existing fixed sidebar, no changes
- Mobile (< 768px): sidebar becomes off-canvas drawer
  - Hidden by default
  - Hamburger button (3 bars) in top-left of header bar
  - Sidebar slides in from left with dark backdrop overlay
  - Closes on: backdrop click, nav link click, X button, Escape key
  - CSS transition: `transform translateX` with 200ms ease
- FAB "New Project Lead" button: reposition to avoid overlap with mobile bottom area

**No backend changes.**

---

## Feature 12: Export/PDF for Deal Summary

### Problem
No way to export deal information for team reviews or client handoffs.

### Design

**Backend (`apps/api/src/routes/deals.ts`):**
- `GET /api/deals/:id/pdf` — generates branded PDF using `pdfkit`:
  - Header: BuildKit Labs logo + "Deal Summary"
  - Deal info section: title, value, pipeline, stage, status, contact, company, created date, expected close
  - Pipeline progress: text-based stage indicator (e.g., "● New Lead → ● Contacted → ○ Audit Sent → ...")
  - Activity timeline: last 20 deal events (from Feature 2, falls back to email_sends if deal_events table doesn't exist yet)
  - Email tracking: total sent, total opens, total clicks
  - Footer: "Generated by BuildKit Labs CRM — [timestamp]"
- Returns `Content-Disposition: attachment; filename="deal-summary-{title}.pdf"` with `Content-Type: application/pdf`

**Frontend (`apps/web/src/pages/DealDetail.tsx`):**
- "Download PDF" button in the header actions area (download icon)
- Calls `window.open('/api/deals/:id/pdf')` — browser handles download

---

## Migration Summary

| Table | Change | Feature |
|-------|--------|---------|
| `deal_events` | New table | 2 |
| `notifications` | New table | 4 |
| `invoices` | Add `stripeSessionId`, `stripePaymentIntentId`, `paidAt` | 5 |
| `pipeline_stages` | Add `followUpDays` | 7 |
| `deals` | Add `lastActivityAt` | 7 |

## New Files Summary

| File | Purpose | Feature |
|------|---------|---------|
| `packages/shared/src/schema/deal-events.ts` | Deal events schema | 2 |
| `packages/shared/src/schema/notifications.ts` | Notifications schema | 4 |
| `apps/api/src/routes/notifications.ts` | Notification CRUD API | 4 |
| `apps/api/src/lib/lead-scoring.ts` | `rescoreCompany()` helper | 9 |
| `apps/web/src/lib/useMobile.ts` | Mobile detection hook | 11 |
| `apps/worker/src/jobs/follow-up-reminders.ts` | Daily cron for stale deals | 7 |
