# BuildKit CRM — 12 Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 12 feature enhancements across the BuildKit CRM platform in 3 batches.

**Architecture:** Monorepo with `apps/api` (Express), `apps/web` (React/Vite), `apps/portal`, `apps/portal-api`, `apps/worker`, `packages/shared` (Drizzle schema). All features follow existing patterns: Drizzle ORM, Express routes, React pages with Tailwind CSS.

**Tech Stack:** TypeScript, Express, React 19, Drizzle ORM, PostgreSQL, Tailwind CSS, Recharts, pdfkit, Twilio, Stripe

**Spec:** `docs/superpowers/specs/2026-03-26-buildkit-crm-12-features-design.md`

---

## Pre-Flight: Feature 11 (Mobile Sidebar) — ALREADY DONE

Mobile sidebar is already implemented in `AppLayout.tsx:54-61` (hamburger button) and `Sidebar.tsx` (isOpen/onClose/Escape key handler). No work needed.

---

## BATCH 1: Quick Wins

### Task 1: Dashboard "My Pipeline" Quick Stats (Feature 3)

**Files:**
- Modify: `apps/api/src/routes/dashboard.ts` — add `GET /my-stats` endpoint
- Modify: `apps/web/src/pages/Dashboard.tsx` — add personal stats row

- [ ] **Step 1: Add backend endpoint**

In `apps/api/src/routes/dashboard.ts`, add after existing routes:

```typescript
router.get('/my-stats', async (req, res) => {
  const userId = req.user!.userId;
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [activeDeals, tasksDue, emailsThisWeek, winStats] = await Promise.all([
    db.select({
      count: sql<number>`count(*)::int`,
      totalValue: sql<number>`coalesce(sum(${deals.value}), 0)::int`,
    }).from(deals).where(and(eq(deals.assignedTo, userId), eq(deals.status, 'open'))),

    db.select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(and(
        eq(tasks.assignedTo, userId),
        sql`${tasks.status} != 'done'`,
        sql`${tasks.dueDate}::date <= CURRENT_DATE`,
      )),

    db.select({ count: sql<number>`count(*)::int` })
      .from(emailSends)
      .where(and(eq(emailSends.sentBy, userId), sql`${emailSends.sentAt} >= ${startOfWeek}`)),

    db.select({
      won: sql<number>`count(*) filter (where ${deals.status} = 'won')::int`,
      total: sql<number>`count(*) filter (where ${deals.status} in ('won', 'lost'))::int`,
    }).from(deals).where(and(eq(deals.assignedTo, userId), sql`${deals.closedAt} >= ${ninetyDaysAgo}`)),
  ]);

  const winRate = winStats[0].total > 0 ? Math.round((winStats[0].won / winStats[0].total) * 100) : 0;

  res.json({
    myActiveDeals: activeDeals[0].count,
    myPipelineValue: activeDeals[0].totalValue,
    myTasksDueToday: tasksDue[0].count,
    myEmailsThisWeek: emailsThisWeek[0].count,
    myWinRate: winRate,
  });
});
```

Add imports at top: `tasks`, `emailSends` from `@buildkit/shared`.

- [ ] **Step 2: Add frontend personal stats row**

In `apps/web/src/pages/Dashboard.tsx`, add state and fetch:

```typescript
interface MyStats {
  myActiveDeals: number;
  myPipelineValue: number;
  myTasksDueToday: number;
  myEmailsThisWeek: number;
  myWinRate: number;
}
// In component:
const [myStats, setMyStats] = useState<MyStats | null>(null);
// In useEffect fetch:
api<MyStats>('/dashboard/my-stats').then(setMyStats);
```

Add a "Personal Stats" row of 4 cards below the existing global stats grid, using the same card style with a left-side `border-l-4 border-purple-500` accent:
- My Active Deals ({count}, ${value})
- Tasks Due Today ({count})
- Emails This Week ({count})
- Win Rate ({percentage}%)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/dashboard.ts apps/web/src/pages/Dashboard.tsx
git commit -m "feat: add My Pipeline personal stats to dashboard"
```

---

### Task 2: Bulk Actions on Leads Table (Feature 1)

**Files:**
- Modify: `apps/api/src/routes/companies.ts` — add bulk endpoints
- Modify: `apps/api/src/routes/deals.ts` — add bulk create
- Modify: `apps/web/src/pages/Leads.tsx` — add bulk action bar

- [ ] **Step 1: Add bulk backend endpoints**

In `apps/api/src/routes/companies.ts`, add:

```typescript
// PATCH /bulk-assign
router.patch('/bulk-assign', async (req, res) => {
  const { ids, assignedTo } = req.body as { ids: string[]; assignedTo: string };
  if (!ids?.length || !assignedTo) { res.status(400).json({ error: 'ids and assignedTo required' }); return; }
  await db.update(companies).set({ assignedTo }).where(sql`${companies.id} = ANY(${ids})`);
  res.json({ success: true, updated: ids.length });
});

// DELETE /bulk
router.delete('/bulk', async (req, res) => {
  if (req.user!.role !== 'admin') { res.status(403).json({ error: 'Admin only' }); return; }
  const { ids } = req.body as { ids: string[] };
  if (!ids?.length) { res.status(400).json({ error: 'ids required' }); return; }
  await db.delete(companies).where(sql`${companies.id} = ANY(${ids})`);
  res.json({ success: true, deleted: ids.length });
});
```

**Important:** Place these routes BEFORE the `/:id` routes to avoid route parameter conflicts.

In `apps/api/src/routes/deals.ts`, add:

```typescript
// POST /bulk
router.post('/bulk', async (req, res) => {
  const { companyIds, pipelineId } = req.body as { companyIds: string[]; pipelineId: string };
  if (!companyIds?.length || !pipelineId) { res.status(400).json({ error: 'companyIds and pipelineId required' }); return; }

  // Get first stage of pipeline
  const [firstStage] = await db.select().from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipelineId))
    .orderBy(pipelineStages.position).limit(1);
  if (!firstStage) { res.status(400).json({ error: 'Pipeline has no stages' }); return; }

  const created = [];
  for (const companyId of companyIds) {
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1);
    if (!company) continue;
    const [deal] = await db.insert(deals).values({
      companyId,
      pipelineId,
      stageId: firstStage.id,
      title: `${company.name} — New Deal`,
      assignedTo: req.user!.userId,
    }).returning();
    created.push(deal);
  }
  res.status(201).json({ created: created.length, deals: created });
});
```

Place BEFORE `/:id` routes.

- [ ] **Step 2: Add frontend bulk action bar**

In `apps/web/src/pages/Leads.tsx`:

Add state: `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());`

Track checkbox changes on each row and the "Select All" header checkbox.

When `selectedIds.size > 0`, render a fixed bottom bar:

```tsx
{selectedIds.size > 0 && (
  <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 text-white px-6 py-3 flex items-center gap-4 shadow-2xl md:left-64">
    <span className="text-sm font-medium">{selectedIds.size} selected</span>
    <select onChange={handleBulkAssign} className="bg-slate-800 text-white text-sm rounded px-3 py-1.5">
      <option value="">Assign To...</option>
      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
    <button onClick={handleBulkCreateDeals} className="text-sm bg-blue-600 px-3 py-1.5 rounded hover:bg-blue-700">Create Deals</button>
    <button onClick={() => navigate(`/outreach/new?companyIds=${[...selectedIds].join(',')}`)} className="text-sm bg-purple-600 px-3 py-1.5 rounded hover:bg-purple-700">Add to Campaign</button>
    <button onClick={handleBulkDelete} className="text-sm bg-red-600 px-3 py-1.5 rounded hover:bg-red-700 ml-auto">Delete</button>
  </div>
)}
```

Implement handlers:
- `handleBulkAssign`: calls `PATCH /api/companies/bulk-assign`, refreshes list
- `handleBulkCreateDeals`: shows pipeline picker modal, then calls `POST /api/deals/bulk`
- `handleBulkDelete`: shows confirmation modal, then calls `DELETE /api/companies/bulk`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/companies.ts apps/api/src/routes/deals.ts apps/web/src/pages/Leads.tsx
git commit -m "feat: bulk actions on leads — assign, create deals, delete, add to campaign"
```

---

### Task 3: Lead Scoring Auto-Refresh (Feature 9)

**Files:**
- Modify: `apps/api/src/lib/lead-scoring.ts` — add `rescoreCompany()` function
- Modify: `apps/api/src/routes/companies.ts` — call rescore on contact add
- Modify: `apps/api/src/routes/deals.ts` — call rescore on deal create
- Modify: `apps/api/src/routes/activities.ts` — call rescore on activity create

- [ ] **Step 1: Add rescoreCompany helper**

In `apps/api/src/lib/lead-scoring.ts`, add:

```typescript
import { db, companies, contacts, deals, emailSends } from '@buildkit/shared';
import { eq, sql, and } from 'drizzle-orm';

export async function rescoreCompany(companyId: string): Promise<number> {
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return 0;

  const [contactStats] = await db.select({
    count: sql<number>`count(*)::int`,
    hasEmail: sql<boolean>`bool_or(${contacts.email} IS NOT NULL)`,
  }).from(contacts).where(eq(contacts.companyId, companyId));

  const [dealStats] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(deals).where(eq(deals.companyId, companyId));

  const websiteScore = company.websiteAudit ? (company.websiteAudit as { score?: number }).score : undefined;

  const newScore = calculateLeadScore(
    company,
    contactStats.count,
    dealStats.count,
    contactStats.hasEmail ?? false,
    websiteScore,
  );

  await db.update(companies).set({ score: newScore }).where(eq(companies.id, companyId));
  return newScore;
}
```

- [ ] **Step 2: Wire rescore into existing handlers**

In `apps/api/src/routes/companies.ts` — after contact creation (`POST /:id/contacts`), add:
```typescript
import { rescoreCompany } from '../lib/lead-scoring.js';
// After contact insert:
rescoreCompany(id).catch(err => console.error('[rescore] Error:', err));
```

In `apps/api/src/routes/deals.ts` — after deal creation (`POST /`), add:
```typescript
rescoreCompany(deal.companyId).catch(err => console.error('[rescore] Error:', err));
```

In `apps/api/src/routes/activities.ts` — after activity creation, look up companyId via deal or contact and rescore.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/lib/lead-scoring.ts apps/api/src/routes/companies.ts apps/api/src/routes/deals.ts apps/api/src/routes/activities.ts
git commit -m "feat: auto-refresh lead scores on contact add, deal create, activity"
```

---

## BATCH 2: Core Pipeline Improvements

### Task 4: Deal Events Schema + Migration (Feature 2 foundation)

**Files:**
- Create: `packages/shared/src/schema/deal-events.ts`
- Modify: `packages/shared/src/schema/index.ts` — export deal events
- Run: `npx drizzle-kit generate` then `npx drizzle-kit push --force`

- [ ] **Step 1: Create deal events schema**

Create `packages/shared/src/schema/deal-events.ts`:

```typescript
import { pgTable, uuid, varchar, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { deals } from './deals.js';
import { users } from './users.js';

export const dealEventTypeEnum = pgEnum('deal_event_type', [
  'stage_change', 'status_change', 'sms_sent', 'call_made', 'note_added', 'email_sent',
]);

export const dealEvents = pgTable('deal_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  type: dealEventTypeEnum('type').notNull(),
  fromValue: varchar('from_value', { length: 255 }),
  toValue: varchar('to_value', { length: 255 }),
  userId: uuid('user_id').references(() => users.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Export and add lastActivityAt to deals**

Add to `packages/shared/src/schema/index.ts`:
```typescript
export * from './deal-events.js';
```

Add to `packages/shared/src/schema/deals.ts`:
```typescript
lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
```

Add to `packages/shared/src/schema/pipelines.ts` (pipelineStages table):
```typescript
followUpDays: integer('follow_up_days'),
```

- [ ] **Step 3: Generate and apply migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push --force
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schema/ migrations/
git commit -m "feat: add deal_events table, deals.lastActivityAt, pipelineStages.followUpDays"
```

---

### Task 5: Deal Event Logging + Timeline API (Feature 2)

**Files:**
- Create: `apps/api/src/lib/deal-event.ts` — helper to log events
- Modify: `apps/api/src/routes/deals.ts` — log stage/status changes, add GET events endpoint
- Modify: `apps/api/src/routes/sms.ts` — log SMS/call events

- [ ] **Step 1: Create deal event helper**

Create `apps/api/src/lib/deal-event.ts`:

```typescript
import { db, dealEvents, deals } from '@buildkit/shared';
import { eq } from 'drizzle-orm';

interface LogDealEventParams {
  dealId: string;
  type: 'stage_change' | 'status_change' | 'sms_sent' | 'call_made' | 'note_added' | 'email_sent';
  fromValue?: string;
  toValue?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function logDealEvent(params: LogDealEventParams) {
  await db.insert(dealEvents).values(params);
  await db.update(deals).set({ lastActivityAt: new Date() }).where(eq(deals.id, params.dealId));
}
```

- [ ] **Step 2: Log stage/status changes in deals PATCH handler**

In `apps/api/src/routes/deals.ts`, in the PATCH `/:id` handler, after computing `dealBefore` and before the update:

```typescript
import { logDealEvent } from '../lib/deal-event.js';

// After the update succeeds:
if (updates.stageId && updates.stageId !== dealBefore.stageId) {
  const [fromStage] = await db.select({ name: pipelineStages.name }).from(pipelineStages).where(eq(pipelineStages.id, dealBefore.stageId)).limit(1);
  const [toStage] = await db.select({ name: pipelineStages.name }).from(pipelineStages).where(eq(pipelineStages.id, updates.stageId)).limit(1);
  logDealEvent({
    dealId: id,
    type: 'stage_change',
    fromValue: fromStage?.name,
    toValue: toStage?.name,
    userId: req.user!.userId,
  });
}
if (updates.status && updates.status !== dealBefore.status) {
  logDealEvent({
    dealId: id,
    type: 'status_change',
    fromValue: dealBefore.status,
    toValue: updates.status,
    userId: req.user!.userId,
  });
}
```

- [ ] **Step 3: Add GET /deals/:id/events endpoint**

```typescript
router.get('/:id/events', async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;

  const [events, countResult] = await Promise.all([
    db.select({
      id: dealEvents.id,
      type: dealEvents.type,
      fromValue: dealEvents.fromValue,
      toValue: dealEvents.toValue,
      userId: dealEvents.userId,
      metadata: dealEvents.metadata,
      createdAt: dealEvents.createdAt,
      userName: users.name,
    })
      .from(dealEvents)
      .leftJoin(users, eq(dealEvents.userId, users.id))
      .where(eq(dealEvents.dealId, id))
      .orderBy(desc(dealEvents.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(dealEvents).where(eq(dealEvents.dealId, id)),
  ]);

  res.json({ data: events, total: countResult[0].count, page, limit });
});
```

- [ ] **Step 4: Log SMS/call events in sms.ts**

In `apps/api/src/routes/sms.ts`:
- In `POST /send` handler, after sending SMS, if `dealId` provided:
  ```typescript
  if (dealId) logDealEvent({ dealId, type: 'sms_sent', toValue: body.slice(0, 100), userId: req.user!.userId });
  ```
- In `POST /call` handler, after initiating call:
  ```typescript
  if (dealId) logDealEvent({ dealId, type: 'call_made', toValue: contactName, userId: req.user!.userId });
  ```

- [ ] **Step 5: Update DealDetail.tsx to use unified timeline**

In `apps/web/src/pages/DealDetail.tsx`, replace the email-only activity history section with a fetch from `/api/deals/${id}/events` and render a unified timeline with icons per type:
- `stage_change`: swap_horiz icon, "{fromValue} → {toValue} by {userName}"
- `status_change`: flag icon, "Status changed to {toValue}"
- `sms_sent`: sms icon, message preview
- `call_made`: call icon, "Call to {toValue}"
- `email_sent`: mail icon, subject line

Keep existing email tracking section as-is (it serves a different purpose).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/deal-event.ts apps/api/src/routes/deals.ts apps/api/src/routes/sms.ts apps/web/src/pages/DealDetail.tsx
git commit -m "feat: unified deal timeline — stage changes, SMS, calls, status changes"
```

---

### Task 6: Automated Follow-up Reminders (Feature 7)

**Files:**
- Create: `apps/worker/src/jobs/follow-up-reminders.ts`
- Modify: `apps/worker/src/index.ts` — register cron
- Modify: `apps/web/src/pages/Settings.tsx` — add followUpDays field per stage
- Modify: `apps/api/src/routes/pipelines.ts` — accept followUpDays in stage PATCH

- [ ] **Step 1: Create follow-up reminder worker job**

Create `apps/worker/src/jobs/follow-up-reminders.ts`:

```typescript
import { db, deals, pipelineStages, tasks, notifications } from '@buildkit/shared';
import { eq, and, sql, lt, isNotNull } from 'drizzle-orm';

export async function checkFollowUpReminders() {
  console.log('[follow-up] Checking for stale deals...');

  const staleDeals = await db.execute(sql`
    SELECT d.id, d.title, d.assigned_to, ps.name AS stage_name, ps.follow_up_days,
           d.last_activity_at
    FROM deals d
    INNER JOIN pipeline_stages ps ON d.stage_id = ps.id
    WHERE d.status = 'open'
      AND ps.follow_up_days IS NOT NULL
      AND ps.follow_up_days > 0
      AND (d.last_activity_at IS NULL OR d.last_activity_at < NOW() - (ps.follow_up_days || ' days')::interval)
      AND NOT EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.deal_id = d.id
          AND t.title LIKE 'No activity on%'
          AND t.status != 'done'
      )
  `);

  for (const deal of staleDeals.rows as any[]) {
    const daysSinceActivity = deal.last_activity_at
      ? Math.floor((Date.now() - new Date(deal.last_activity_at).getTime()) / (1000 * 60 * 60 * 24))
      : deal.follow_up_days;

    await db.insert(tasks).values({
      dealId: deal.id,
      title: `No activity on ${deal.title} for ${daysSinceActivity} days — follow up?`,
      status: 'todo',
      priority: 'high',
      assignedTo: deal.assigned_to,
    });

    if (deal.assigned_to) {
      await db.insert(notifications).values({
        userId: deal.assigned_to,
        type: 'stale_deal',
        title: `Follow-up reminder: ${deal.title}`,
        body: `This deal has been in "${deal.stage_name}" for ${daysSinceActivity} days with no activity.`,
        entityType: 'deal',
        entityId: deal.id,
      });
    }
  }

  console.log(`[follow-up] Created reminders for ${staleDeals.rows.length} stale deals`);
}
```

- [ ] **Step 2: Register cron in worker**

In `apps/worker/src/index.ts`, add:
```typescript
import cron from 'node-cron';
import { checkFollowUpReminders } from './jobs/follow-up-reminders.js';

// Daily at 9:00 AM CT (14:00 UTC)
cron.schedule('0 14 * * *', () => checkFollowUpReminders());
```

- [ ] **Step 3: Add followUpDays to Settings UI**

In `apps/web/src/pages/Settings.tsx`, in each pipeline stage card, add an input field:
```tsx
<div className="flex items-center gap-2 mt-2">
  <span className="text-xs text-gray-500">Follow-up after</span>
  <input type="number" min="0" max="30" value={stage.followUpDays ?? ''} onChange={...}
    className="w-16 text-sm border rounded px-2 py-1" placeholder="days" />
  <span className="text-xs text-gray-500">days</span>
</div>
```

Save calls `PATCH /api/pipelines/:pipelineId/stages/:stageId` with `{ followUpDays }`.

- [ ] **Step 4: Accept followUpDays in pipelines route**

In `apps/api/src/routes/pipelines.ts`, in the stage PATCH handler, include `followUpDays` in the allowed update fields.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/jobs/follow-up-reminders.ts apps/worker/src/index.ts apps/web/src/pages/Settings.tsx apps/api/src/routes/pipelines.ts
git commit -m "feat: automated follow-up reminders for stale deals"
```

---

### Task 7: ROI Calculator with Real Data (Feature 10)

**Files:**
- Modify: `apps/api/src/routes/reports.ts` — add GET /roi endpoint
- Modify: `apps/web/src/pages/ROICalculator.tsx` — build full UI

- [ ] **Step 1: Add ROI backend endpoint**

In `apps/api/src/routes/reports.ts`, add:

```typescript
router.get('/roi', async (req, res) => {
  const range = (req.query.range as string) || '90d';
  let dateFilter: Date;
  const now = new Date();

  switch (range) {
    case '30d': dateFilter = new Date(now.getTime() - 30 * 86400000); break;
    case '90d': dateFilter = new Date(now.getTime() - 90 * 86400000); break;
    case 'ytd': dateFilter = new Date(now.getFullYear(), 0, 1); break;
    default: dateFilter = new Date(0); // all time
  }

  const [leadStats] = await db.select({
    totalScraped: sql<number>`count(*) filter (where ${companies.source} = 'scraped' and ${companies.createdAt} >= ${dateFilter})::int`,
  }).from(companies);

  const [dealStats] = await db.select({
    created: sql<number>`count(*) filter (where ${deals.createdAt} >= ${dateFilter})::int`,
    won: sql<number>`count(*) filter (where ${deals.status} = 'won' and ${deals.closedAt} >= ${dateFilter})::int`,
    revenue: sql<number>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'won' and ${deals.closedAt} >= ${dateFilter}), 0)::int`,
  }).from(deals);

  const totalLeads = leadStats.totalScraped;
  const scraperCost = +(totalLeads * 0.034).toFixed(2);
  const totalDeals = dealStats.created;
  const totalWon = dealStats.won;
  const totalRevenue = dealStats.revenue;

  res.json({
    totalLeadsScraped: totalLeads,
    scraperCost,
    totalDealsCreated: totalDeals,
    totalDealsWon: totalWon,
    totalRevenue,
    leadToDealRate: totalLeads > 0 ? +((totalDeals / totalLeads) * 100).toFixed(1) : 0,
    dealToWonRate: totalDeals > 0 ? +((totalWon / totalDeals) * 100).toFixed(1) : 0,
    costPerLead: totalLeads > 0 ? +(scraperCost / totalLeads).toFixed(2) : 0,
    costPerDeal: totalDeals > 0 ? +(scraperCost / totalDeals).toFixed(2) : 0,
    costPerWon: totalWon > 0 ? +(scraperCost / totalWon).toFixed(2) : 0,
    roi: scraperCost > 0 ? +(((totalRevenue - scraperCost) / scraperCost) * 100).toFixed(0) : 0,
    range,
  });
});
```

- [ ] **Step 2: Build ROI Calculator UI**

Rewrite `apps/web/src/pages/ROICalculator.tsx`:
- Time range selector buttons: 30d / 90d / YTD / All
- Top row: 3 highlight cards (Total Revenue green, Total Cost amber, ROI % blue)
- Recharts `BarChart` funnel: Leads → Deals → Won
- Metrics grid: cost per lead, cost per deal, conversion rates
- Empty state: "Run the scraper to start tracking ROI"
- Use existing `formatCurrency()` from `lib/format.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/reports.ts apps/web/src/pages/ROICalculator.tsx
git commit -m "feat: ROI calculator with real pipeline and scraper data"
```

---

### Task 8: Deal Summary PDF Export (Feature 12)

**Files:**
- Modify: `apps/api/src/routes/deals.ts` — add GET /:id/pdf endpoint
- Modify: `apps/web/src/pages/DealDetail.tsx` — add Download PDF button

- [ ] **Step 1: Add PDF generation endpoint**

In `apps/api/src/routes/deals.ts`, add (pdfkit is already a dependency):

```typescript
import PDFDocument from 'pdfkit';

router.get('/:id/pdf', async (req, res) => {
  const { id } = req.params;

  // Fetch deal with relations
  const [deal] = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  if (!deal) { res.status(404).json({ error: 'Deal not found' }); return; }

  const [company] = deal.companyId ? await db.select().from(companies).where(eq(companies.id, deal.companyId)).limit(1) : [null];
  const [contact] = deal.contactId ? await db.select().from(contacts).where(eq(contacts.id, deal.contactId)).limit(1) : [null];
  const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, deal.stageId)).limit(1);
  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, deal.pipelineId)).limit(1);

  // Fetch recent events (if table exists, fallback to email_sends)
  let events: any[] = [];
  try {
    const result = await db.select().from(dealEvents).where(eq(dealEvents.dealId, id)).orderBy(desc(dealEvents.createdAt)).limit(20);
    events = result;
  } catch { /* deal_events table may not exist yet */ }

  const emailStats = await db.select({
    sent: sql<number>`count(*)::int`,
    opens: sql<number>`coalesce(sum((${emailSends.metadata}->>'opens')::int), 0)::int`,
  }).from(emailSends).where(eq(emailSends.dealId, id));

  // Generate PDF
  const doc = new PDFDocument({ margin: 50 });
  const filename = `deal-summary-${deal.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('BuildKit Labs', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text('Deal Summary', { align: 'center' });
  doc.moveDown(1.5);

  // Deal info
  doc.fontSize(16).font('Helvetica-Bold').text(deal.title);
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Pipeline: ${pipeline?.name ?? '--'}  |  Stage: ${stage?.name ?? '--'}  |  Status: ${deal.status}`);
  doc.text(`Value: $${(deal.value ?? 0).toLocaleString()}  |  Created: ${new Date(deal.createdAt).toLocaleDateString()}`);
  if (company) doc.text(`Company: ${company.name}`);
  if (contact) doc.text(`Contact: ${contact.firstName} ${contact.lastName ?? ''} — ${contact.email ?? ''}`);
  doc.moveDown(1);

  // Email tracking
  doc.fontSize(12).font('Helvetica-Bold').text('Email Tracking');
  doc.fontSize(10).font('Helvetica');
  doc.text(`Emails Sent: ${emailStats[0]?.sent ?? 0}  |  Total Opens: ${emailStats[0]?.opens ?? 0}`);
  doc.moveDown(1);

  // Activity timeline
  if (events.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').text('Recent Activity');
    doc.fontSize(9).font('Helvetica');
    for (const event of events) {
      const date = new Date(event.createdAt).toLocaleDateString();
      doc.text(`${date} — ${event.type}: ${event.toValue || event.fromValue || ''}`);
    }
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).text(`Generated by BuildKit Labs CRM — ${new Date().toLocaleString()}`, { align: 'center' });

  doc.end();
});
```

- [ ] **Step 2: Add Download PDF button to DealDetail**

In `apps/web/src/pages/DealDetail.tsx`, in the header actions area, add:
```tsx
<button
  onClick={() => window.open(`${import.meta.env.VITE_API_URL}/api/deals/${id}/pdf`)}
  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
>
  <span className="material-symbols-outlined text-base">download</span>
  PDF
</button>
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/deals.ts apps/web/src/pages/DealDetail.tsx
git commit -m "feat: deal summary PDF export with branded layout"
```

---

## BATCH 3: Integration Features

### Task 9: Notification Center Frontend (Feature 4)

**Files:**
- Modify: `apps/web/src/components/layout/AppLayout.tsx` — add notification dropdown
- Create: `apps/web/src/components/ui/NotificationDropdown.tsx`
- Modify: `apps/api/src/routes/sms.ts` — create notifications on inbound SMS/calls
- Modify: `apps/api/src/routes/deals.ts` — create notifications on stage change

The backend CRUD already exists at `apps/api/src/routes/notifications.ts`. The notification types enum needs expanding.

- [ ] **Step 1: Expand notification type enum**

The current enum has: `stale_deal`, `hot_lead`, `sequence_digest`, `task_due`, `milestone_completed`, `reply_received`, `campaign_update`.

Create a migration to add new values:
```sql
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'inbound_sms';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'inbound_call';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'stage_change';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invoice_paid';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'portal_message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'follow_up_reminder';
```

Update the enum in `packages/shared/src/schema/notifications.ts` to include all values.

- [ ] **Step 2: Create notification helper**

Create `apps/api/src/lib/notify.ts`:
```typescript
import { db, notifications, users } from '@buildkit/shared';
import { eq } from 'drizzle-orm';

interface NotifyParams {
  userId?: string;
  allAdmins?: boolean;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

export async function notify(params: NotifyParams) {
  const userIds: string[] = [];

  if (params.userId) userIds.push(params.userId);
  if (params.allAdmins) {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
    userIds.push(...admins.map(a => a.id));
  }

  for (const userId of [...new Set(userIds)]) {
    await db.insert(notifications).values({
      userId,
      type: params.type as any,
      title: params.title,
      body: params.body,
      entityType: params.entityType,
      entityId: params.entityId,
    });
  }
}
```

- [ ] **Step 3: Wire notifications into existing webhooks**

In `apps/api/src/routes/sms.ts`:
- Inbound SMS webhook: `notify({ allAdmins: true, type: 'inbound_sms', title: 'New SMS from ${contactName}', entityType: 'conversation', entityId: conversationId })`
- Inbound voice webhook: `notify({ allAdmins: true, type: 'inbound_call', title: 'Incoming call from ${contactName}', entityType: 'conversation', entityId: conversationId })`

In `apps/api/src/routes/deals.ts`:
- Stage change: `notify({ userId: deal.assignedTo, type: 'stage_change', title: 'Deal moved to ${toStageName}', entityType: 'deal', entityId: id })`

- [ ] **Step 4: Build NotificationDropdown component**

Create `apps/web/src/components/ui/NotificationDropdown.tsx`:
- Polls `/api/notifications/unread-count` every 30s
- Shows red badge with count on bell icon
- Click toggles dropdown panel (max-h-96 overflow-y-auto, w-80)
- Each item: icon per type, title, body preview, relative time, unread dot
- Click item: navigate to entity, mark as read
- "Mark all as read" link at top
- Close on click outside (useEffect with document click handler)

- [ ] **Step 5: Integrate into layout**

In `apps/web/src/components/layout/TopBar.tsx` (or wherever the bell icon is rendered), replace the static bell button with `<NotificationDropdown />`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schema/notifications.ts apps/api/src/lib/notify.ts apps/api/src/routes/sms.ts apps/api/src/routes/deals.ts apps/web/src/components/ui/NotificationDropdown.tsx
git commit -m "feat: notification center — bell dropdown, inbound SMS/call alerts, stage changes"
```

---

### Task 10: Invoice Payment via Stripe Checkout (Feature 5)

**Files:**
- Modify: `apps/api/src/routes/invoices-stripe.ts` — add checkout session endpoint
- Modify: `apps/web/src/pages/InvoiceDetail.tsx` — send invoice button calls checkout
- Modify: `apps/portal/src/pages/Invoices.tsx` — add Pay Now button

Invoice schema already has `paidAt`, `stripeInvoiceId`, status `paid`. `invoices-stripe.ts` already exists.

- [ ] **Step 1: Add Stripe Checkout session endpoint**

In `apps/api/src/routes/invoices-stripe.ts`, add:

```typescript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.post('/:id/checkout', async (req, res) => {
  const { id } = req.params;
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

  const lineItems = (invoice.lineItems as any[]).map(item => ({
    price_data: {
      currency: 'usd',
      product_data: { name: item.description || 'Service' },
      unit_amount: Math.round(item.unitPrice * 100),
    },
    quantity: item.quantity || 1,
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `${process.env.PORTAL_URL || process.env.FRONTEND_URL}/invoices/${id}?paid=true`,
    cancel_url: `${process.env.PORTAL_URL || process.env.FRONTEND_URL}/invoices/${id}`,
    metadata: { invoiceId: id },
  });

  await db.update(invoices).set({
    stripeInvoiceId: session.id,
    status: 'sent',
    sentAt: new Date(),
  }).where(eq(invoices.id, id));

  res.json({ checkoutUrl: session.url });
});
```

- [ ] **Step 2: Add Stripe webhook for payment completion**

```typescript
router.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;
    if (invoiceId) {
      await db.update(invoices).set({
        status: 'paid',
        paidAt: new Date(),
      }).where(eq(invoices.id, invoiceId));

      // Notify deal assignee
      // (lookup invoice → project → deal → assignedTo)
    }
  }

  res.json({ received: true });
});
```

**Note:** The Stripe webhook needs raw body. Ensure Express doesn't parse JSON for this route — use `express.raw({ type: 'application/json' })` middleware on this specific route.

- [ ] **Step 3: Update Send Invoice button in InvoiceDetail**

In `apps/web/src/pages/InvoiceDetail.tsx`, "Send Invoice" button:
```typescript
const handleSendInvoice = async () => {
  const { checkoutUrl } = await api<{ checkoutUrl: string }>(`/invoices-stripe/${id}/checkout`, { method: 'POST' });
  // Copy payment link or open in new tab
  window.open(checkoutUrl, '_blank');
  toast('Payment link generated and invoice marked as sent');
  loadInvoice(); // refresh status
};
```

- [ ] **Step 4: Add Pay Now to portal Invoices page**

In `apps/portal/src/pages/Invoices.tsx`, for invoices with status `sent`, show a "Pay Now" button that opens the Stripe checkout URL.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/invoices-stripe.ts apps/web/src/pages/InvoiceDetail.tsx apps/portal/src/pages/Invoices.tsx
git commit -m "feat: invoice payment via Stripe Checkout with webhook + portal Pay Now"
```

---

### Task 11: Client Portal Project Progress View (Feature 6)

**Files:**
- Modify: `apps/portal-api/src/routes/projects.ts` — add progress endpoint
- Modify: `apps/portal/src/pages/ProjectStatus.tsx` — build progress UI

- [ ] **Step 1: Add progress API endpoint**

In `apps/portal-api/src/routes/projects.ts`, add:

```typescript
router.get('/:id/progress', async (req, res) => {
  const { id } = req.params;
  const milestones = await db.select({
    id: dbMilestones.id,
    name: dbMilestones.name,
    status: dbMilestones.status,
    position: dbMilestones.position,
  }).from(dbMilestones).where(eq(dbMilestones.projectId, id)).orderBy(dbMilestones.position);

  const milestonesWithTasks = await Promise.all(milestones.map(async (m) => {
    const taskStats = await db.select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
    }).from(tasks).where(eq(tasks.milestoneId, m.id));

    const total = taskStats[0]?.total ?? 0;
    const completed = taskStats[0]?.completed ?? 0;

    return {
      ...m,
      taskTotal: total,
      taskCompleted: completed,
      completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }));

  const completedMilestones = milestonesWithTasks.filter(m => m.status === 'completed').length;

  res.json({
    milestones: milestonesWithTasks,
    overallProgress: milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0,
    completedCount: completedMilestones,
    totalCount: milestones.length,
  });
});
```

- [ ] **Step 2: Build ProjectStatus.tsx UI**

In `apps/portal/src/pages/ProjectStatus.tsx`:
- Overall progress bar at top: "2 of 4 milestones complete — 50%"
- Horizontal stepper: each milestone as a step with circle icon (check for complete, circle for active, empty for pending)
- Active milestone highlighted with brand purple
- Below: current milestone card with read-only task checklist showing task names and done/todo status
- Styled to match portal's clean white aesthetic

- [ ] **Step 3: Commit**

```bash
git add apps/portal-api/src/routes/projects.ts apps/portal/src/pages/ProjectStatus.tsx
git commit -m "feat: client portal project progress view with milestone timeline"
```

---

### Task 12: Call Recording & Notes (Feature 8)

**Files:**
- Modify: `apps/api/src/lib/twilio.ts` — add record + callbacks to makeCall
- Modify: `apps/api/src/routes/sms.ts` — add recording webhook, enhance call status webhook
- Modify: `apps/web/src/pages/Inbox.tsx` — add recording playback + call notes modal

- [ ] **Step 1: Enable recording in makeCall**

In `apps/api/src/lib/twilio.ts`, modify `makeCall()`:

```typescript
export async function makeCall(to: string): Promise<{ sid: string; status: string }> {
  const apiBaseUrl = process.env.API_BASE_URL || process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'https://buildkitapi-production.up.railway.app';

  const call = await twilioClient.calls.create({
    to,
    from: TWILIO_PHONE_NUMBER,
    url: 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical&Message=Connecting+you+now',
    record: true,
    recordingStatusCallback: `${apiBaseUrl}/sms/webhook/recording`,
    statusCallback: `${apiBaseUrl}/sms/webhook/call-status`,
    statusCallbackEvent: ['completed'],
  });

  return { sid: call.sid, status: call.status };
}
```

- [ ] **Step 2: Add recording webhook**

In `apps/api/src/routes/sms.ts`, add:

```typescript
router.post('/webhook/recording', async (req, res) => {
  try {
    const { RecordingSid, RecordingUrl, RecordingDuration, CallSid } = req.body;
    if (CallSid && RecordingUrl) {
      const [msg] = await db.select().from(conversationMessages).where(eq(conversationMessages.twilioSid, CallSid)).limit(1);
      if (msg) {
        const existingMeta = (msg.metadata as Record<string, unknown>) || {};
        await db.update(conversationMessages).set({
          metadata: {
            ...existingMeta,
            recordingSid: RecordingSid,
            recordingUrl: RecordingUrl,
            recordingDuration: parseInt(RecordingDuration) || 0,
          },
        }).where(eq(conversationMessages.id, msg.id));
      }
    }
  } catch (err) {
    console.error('[recording/webhook] Error:', err instanceof Error ? err.message : err);
  }
  res.sendStatus(200);
});
```

- [ ] **Step 3: Add recording playback to Inbox**

In `apps/web/src/pages/Inbox.tsx`, in the message rendering for call messages:
- If `message.metadata?.recordingUrl`, show an audio player:
```tsx
{metadata.recordingUrl && (
  <audio controls className="mt-2 w-full max-w-xs">
    <source src={`${metadata.recordingUrl}.mp3`} type="audio/mpeg" />
  </audio>
)}
```

- [ ] **Step 4: Add call notes modal**

After a call message appears with status 'completed', show a "Log Notes" button that opens a modal:
- Duration display
- Notes textarea
- Outcome dropdown: Interested / Not Interested / Follow Up / Voicemail / No Answer
- Save creates an activity via `POST /api/activities` with the deal context

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/twilio.ts apps/api/src/routes/sms.ts apps/web/src/pages/Inbox.tsx
git commit -m "feat: call recording via Twilio + playback in Comms + call notes"
```

---

## Summary

| Task | Feature | Batch | Estimated Complexity |
|------|---------|-------|---------------------|
| 1 | My Pipeline Stats | 1 | Small |
| 2 | Bulk Actions | 1 | Medium |
| 3 | Lead Rescoring | 1 | Small |
| 4 | Deal Events Schema | 2 | Small (migration) |
| 5 | Deal Timeline | 2 | Medium |
| 6 | Follow-up Reminders | 2 | Medium |
| 7 | ROI Calculator | 2 | Medium |
| 8 | Deal PDF Export | 2 | Medium |
| 9 | Notification Center | 3 | Large |
| 10 | Stripe Checkout | 3 | Large |
| 11 | Portal Progress | 3 | Medium |
| 12 | Call Recording | 3 | Medium |

**Total: 12 tasks across 3 batches. Feature 11 (Mobile Sidebar) already implemented — no work needed.**
