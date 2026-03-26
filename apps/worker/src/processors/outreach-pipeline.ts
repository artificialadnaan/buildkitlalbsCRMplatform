import type { Job } from 'bullmq';
import { eq, and, gte, desc, isNotNull } from 'drizzle-orm';
import {
  db,
  outreachCampaigns,
  scrapeJobs,
  companies,
  contacts,
  deals,
  pipelines,
  pipelineStages,
  sequenceEnrollments,
} from '@buildkit/shared';
import type { OutreachPipelineJobData } from '@buildkit/shared';
import { createWebsiteAuditQueue } from '@buildkit/shared';

const TARGET_INDUSTRIES = [
  'construction',
  'plumbing',
  'hvac',
  'electrical',
  'roofing',
  'general contractor',
];

interface CompanyForScoring {
  phone: string | null;
  website: string | null;
  googleRating: string | null;
  industry: string | null;
  source: string;
}

function calculateLeadScore(
  company: CompanyForScoring,
  contactCount: number,
  dealCount: number,
  hasEmail = false,
  websiteScore?: number,
): number {
  let score = 0;

  if (hasEmail) score += 15;
  if (company.phone != null && company.phone.trim() !== '') score += 10;
  if (company.website != null && company.website.trim() !== '') score += 10;

  const rating = company.googleRating != null ? parseFloat(company.googleRating) : NaN;
  if (!isNaN(rating)) {
    if (rating >= 4.0) score += 10;
    else if (rating >= 3.0) score += 5;
  }

  if (company.industry != null) {
    const normalized = company.industry.toLowerCase().trim();
    if (TARGET_INDUSTRIES.some((t) => normalized.includes(t))) score += 15;
  }

  if (company.source === 'manual') score += 10;
  if (contactCount > 0) score += 10;
  if (dealCount > 0) score += 20;

  // websiteScore bonus: up to 10 pts for high-scoring sites
  if (websiteScore != null && websiteScore >= 70) score += 10;

  return Math.min(score, 100);
}

export async function processOutreachPipeline(job: Job<OutreachPipelineJobData>): Promise<void> {
  const { campaignId, phase } = job.data;

  console.log(`[OutreachPipeline] Campaign ${campaignId} — phase: ${phase}`);

  const [campaign] = await db
    .select()
    .from(outreachCampaigns)
    .where(eq(outreachCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    console.error(`[OutreachPipeline] Campaign ${campaignId} not found`);
    return;
  }

  if (campaign.status === 'cancelled') {
    console.log(`[OutreachPipeline] Campaign ${campaignId} is cancelled — skipping`);
    return;
  }

  if (phase === 'audit') {
    await runAuditPhase(campaign);
  } else if (phase === 'score') {
    await runScorePhase(campaign);
  } else if (phase === 'enroll') {
    await runEnrollPhase(campaign);
  }
}

async function runAuditPhase(campaign: typeof outreachCampaigns.$inferSelect): Promise<void> {
  if (!campaign.scrapeJobId) {
    console.error(`[OutreachPipeline] Campaign ${campaign.id} has no scrapeJobId`);
    return;
  }

  // Get the scrape job to know when it started
  const [scrapeJob] = await db
    .select()
    .from(scrapeJobs)
    .where(eq(scrapeJobs.id, campaign.scrapeJobId))
    .limit(1);

  if (!scrapeJob) {
    console.error(`[OutreachPipeline] Scrape job ${campaign.scrapeJobId} not found`);
    return;
  }

  // Get all scraped companies created at or after the scrape job's startedAt (or createdAt fallback)
  const since = scrapeJob.startedAt ?? scrapeJob.createdAt;

  const scraped = await db
    .select({
      id: companies.id,
      website: companies.website,
      websiteAuditedAt: companies.websiteAuditedAt,
    })
    .from(companies)
    .where(
      and(
        eq(companies.source, 'scraped'),
        gte(companies.createdAt, since),
      ),
    );

  console.log(`[OutreachPipeline] Audit phase — found ${scraped.length} scraped companies`);

  // Enqueue website audit for companies with a website that haven't been audited
  let auditQueue: ReturnType<typeof createWebsiteAuditQueue> | null = null;
  function getAuditQueue() {
    if (!auditQueue) auditQueue = createWebsiteAuditQueue();
    return auditQueue;
  }

  let auditEnqueued = 0;
  for (const company of scraped) {
    if (company.website && !company.websiteAuditedAt) {
      try {
        await getAuditQueue().add('audit', {
          companyId: company.id,
          url: company.website,
          campaignId: campaign.id,
        });
        auditEnqueued++;
      } catch (err) {
        console.error(`[OutreachPipeline] Failed to enqueue audit for company ${company.id}:`, err);
      }
    }
  }

  console.log(`[OutreachPipeline] Enqueued ${auditEnqueued} website audits`);

  const existingStats = (campaign.stats ?? {}) as Record<string, unknown>;
  await db
    .update(outreachCampaigns)
    .set({
      status: 'auditing',
      stats: { ...existingStats, totalScraped: scraped.length },
    })
    .where(eq(outreachCampaigns.id, campaign.id));
}

async function runScorePhase(campaign: typeof outreachCampaigns.$inferSelect): Promise<void> {
  if (!campaign.scrapeJobId) {
    console.error(`[OutreachPipeline] Campaign ${campaign.id} has no scrapeJobId`);
    return;
  }

  const [scrapeJob] = await db
    .select()
    .from(scrapeJobs)
    .where(eq(scrapeJobs.id, campaign.scrapeJobId))
    .limit(1);

  if (!scrapeJob) {
    console.error(`[OutreachPipeline] Scrape job ${campaign.scrapeJobId} not found`);
    return;
  }

  await db
    .update(outreachCampaigns)
    .set({ status: 'scoring' })
    .where(eq(outreachCampaigns.id, campaign.id));

  const since = scrapeJob.startedAt ?? scrapeJob.createdAt;

  const scraped = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.source, 'scraped'),
        gte(companies.createdAt, since),
      ),
    );

  console.log(`[OutreachPipeline] Score phase — scoring ${scraped.length} companies`);

  let totalScore = 0;

  for (const company of scraped) {
    // Count contacts for this company
    const companyContacts = await db
      .select({ id: contacts.id, email: contacts.email })
      .from(contacts)
      .where(eq(contacts.companyId, company.id));

    const contactCount = companyContacts.length;
    const hasEmail = companyContacts.some((c) => c.email != null && c.email.trim() !== '');

    // Count deals for this company
    const companyDeals = await db
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.companyId, company.id));

    const dealCount = companyDeals.length;

    const score = calculateLeadScore(
      {
        phone: company.phone,
        website: company.website,
        googleRating: company.googleRating,
        industry: company.industry,
        source: company.source,
      },
      contactCount,
      dealCount,
      hasEmail,
      company.websiteScore ?? undefined,
    );

    await db
      .update(companies)
      .set({ score })
      .where(eq(companies.id, company.id));

    totalScore += score;
  }

  const avgScore = scraped.length > 0 ? Math.round(totalScore / scraped.length) : 0;

  const existingStats = (campaign.stats ?? {}) as Record<string, unknown>;
  await db
    .update(outreachCampaigns)
    .set({
      status: 'enrolling',
      stats: { ...existingStats, avgScore },
    })
    .where(eq(outreachCampaigns.id, campaign.id));

  console.log(`[OutreachPipeline] Score phase complete — avg score: ${avgScore}`);
}

async function runEnrollPhase(campaign: typeof outreachCampaigns.$inferSelect): Promise<void> {
  if (!campaign.scrapeJobId || !campaign.sequenceId) {
    console.error(`[OutreachPipeline] Campaign ${campaign.id} missing scrapeJobId or sequenceId`);
    return;
  }

  const [scrapeJob] = await db
    .select()
    .from(scrapeJobs)
    .where(eq(scrapeJobs.id, campaign.scrapeJobId))
    .limit(1);

  if (!scrapeJob) {
    console.error(`[OutreachPipeline] Scrape job ${campaign.scrapeJobId} not found`);
    return;
  }

  const since = scrapeJob.startedAt ?? scrapeJob.createdAt;

  // Get qualifying companies sorted by score DESC
  const scraped = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.source, 'scraped'),
        gte(companies.createdAt, since),
      ),
    )
    .orderBy(desc(companies.score))
    .limit(campaign.topN);

  const qualifying = scraped.filter((c) => c.score >= campaign.minScore);

  console.log(
    `[OutreachPipeline] Enroll phase — ${qualifying.length} qualifying companies (topN: ${campaign.topN}, minScore: ${campaign.minScore})`,
  );

  // Get first available pipeline and its first stage
  const [firstPipeline] = await db.select().from(pipelines).limit(1);
  if (!firstPipeline) {
    console.error('[OutreachPipeline] No pipelines found — cannot create deals');
    return;
  }

  const [firstStage] = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, firstPipeline.id))
    .orderBy(pipelineStages.position)
    .limit(1);

  if (!firstStage) {
    console.error(`[OutreachPipeline] No stages found for pipeline ${firstPipeline.id}`);
    return;
  }

  let totalEnrolled = 0;

  for (const company of qualifying) {
    // Find primary contact with email, fallback to any contact with email
    const companyContacts = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.companyId, company.id),
          isNotNull(contacts.email),
        ),
      )
      .orderBy(desc(contacts.isPrimary))
      .limit(1);

    const primaryContact = companyContacts[0];
    if (!primaryContact || !primaryContact.email) {
      console.log(`[OutreachPipeline] Skipping company ${company.id} — no contact with email`);
      continue;
    }

    // Find or create a deal for this company
    const [existingDeal] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.companyId, company.id))
      .limit(1);

    let dealId: string;

    if (existingDeal) {
      dealId = existingDeal.id;
    } else {
      const [newDeal] = await db
        .insert(deals)
        .values({
          companyId: company.id,
          contactId: primaryContact.id,
          assignedTo: campaign.createdBy,
          pipelineId: firstPipeline.id,
          stageId: firstStage.id,
          title: `Outreach - ${company.name}`,
          status: 'open',
        })
        .returning();
      dealId = newDeal.id;
    }

    // Create sequence enrollment
    try {
      await db.insert(sequenceEnrollments).values({
        dealId,
        sequenceId: campaign.sequenceId,
        contactId: primaryContact.id,
        enrolledBy: campaign.createdBy,
        currentStep: 1,
        status: 'active',
        nextSendAt: new Date(),
      });
      totalEnrolled++;
    } catch (err) {
      // Enrollment may already exist — log and continue
      console.error(
        `[OutreachPipeline] Failed to enroll deal ${dealId} in sequence:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const existingStats = (campaign.stats ?? {}) as Record<string, unknown>;
  await db
    .update(outreachCampaigns)
    .set({
      status: 'active',
      completedAt: new Date(),
      stats: { ...existingStats, totalEnrolled },
    })
    .where(eq(outreachCampaigns.id, campaign.id));

  console.log(`[OutreachPipeline] Enroll phase complete — enrolled: ${totalEnrolled}`);
}
