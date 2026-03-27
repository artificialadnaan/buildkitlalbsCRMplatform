import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, companies, createProspectQueue } from '@buildkit/shared';
import type { ProspectJobData } from '@buildkit/shared';

let prospectQueue: ReturnType<typeof createProspectQueue> | null = null;
function getQueue() {
  if (!prospectQueue) prospectQueue = createProspectQueue();
  return prospectQueue;
}

export async function processProspectQualify(job: Job<ProspectJobData>): Promise<void> {
  const { companyId, scrapeJobId } = job.data;
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return;

  const prospData = (company.prospectingData as Record<string, unknown>) || {};
  const config = (prospData.config as Record<string, unknown>) || {};
  const minReviews = (config.minReviews as number) ?? 20;
  const maxScore = (config.maxWebsiteScore as number) ?? 70;

  const reviewCount = (prospData.reviewCount as number) ?? 0;
  const websiteScore = company.websiteScore ?? 0;
  const hasWebsite = !!company.website;

  // Review gate
  if (reviewCount < minReviews) {
    await db.update(companies).set({
      prospectingStatus: 'filtered',
      prospectingData: {
        ...prospData,
        filterReason: `Only ${reviewCount} reviews (min: ${minReviews})`,
        filteredAt: new Date().toISOString(),
      },
    }).where(eq(companies.id, companyId));
    console.log(`[prospect-qualify] ${company.name} filtered — ${reviewCount} reviews < ${minReviews}`);
    return;
  }

  // Website score gate (skip if no website — they definitely need one)
  if (hasWebsite && websiteScore >= maxScore) {
    await db.update(companies).set({
      prospectingStatus: 'filtered',
      prospectingData: {
        ...prospData,
        filterReason: `Website score ${websiteScore} (max: ${maxScore})`,
        filteredAt: new Date().toISOString(),
      },
    }).where(eq(companies.id, companyId));
    console.log(`[prospect-qualify] ${company.name} filtered — score ${websiteScore} >= ${maxScore}`);
    return;
  }

  // Qualified — advance to enrichment
  await db.update(companies).set({
    prospectingStatus: 'enriching',
    prospectingData: {
      ...prospData,
      qualifiedAt: new Date().toISOString(),
      filterHistory: { reviewCount, websiteScore, hasWebsite, qualificationPassed: true },
    },
  }).where(eq(companies.id, companyId));

  await getQueue().add('enrich', { companyId, scrapeJobId, stage: 'enrich' });
  console.log(`[prospect-qualify] ${company.name} qualified (reviews: ${reviewCount}, score: ${websiteScore}) → enrichment`);
}
