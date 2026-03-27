import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, companies, contacts, createProspectQueue, createProspectMockupQueue } from '@buildkit/shared';
import type { ProspectJobData } from '@buildkit/shared';
import { scrapeAboutPage, scrapeBBB, searchTexasSOS, apolloLookup } from '../lib/enrichment-sources.js';

type EnrichResult = { name: string; title: string; email?: string; phone?: string; linkedinUrl?: string; source: string };

let queue: ReturnType<typeof createProspectQueue> | null = null;
function getQueue() {
  if (!queue) queue = createProspectQueue();
  return queue;
}

let mockupQueue: ReturnType<typeof createProspectMockupQueue> | null = null;
function getMockupQueue() {
  if (!mockupQueue) mockupQueue = createProspectMockupQueue();
  return mockupQueue;
}

export async function processProspectEnrich(job: Job<ProspectJobData>): Promise<void> {
  const { companyId, scrapeJobId } = job.data;
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return;
  const prospData = (company.prospectingData as Record<string, unknown>) || {};

  let result: EnrichResult | null = null;

  // Try sources in priority order
  if (company.website) {
    const about = await scrapeAboutPage(company.website);
    if (about) result = { ...about, source: 'website_about' };
  }

  if (!result && company.city) {
    const bbb = await scrapeBBB(company.name, company.city, company.state ?? 'TX');
    if (bbb) result = { ...bbb, source: 'bbb' };
  }

  if (!result) {
    const sos = await searchTexasSOS(company.name);
    if (sos) result = { name: sos.name, title: 'Registered Agent', source: 'texas_sos' };
  }

  if (!result && company.website) {
    try {
      const domain = new URL(company.website).hostname;
      const apollo = await apolloLookup(domain, company.name);
      if (apollo) result = { ...apollo, source: 'apollo' };
    } catch { /* silent */ }
  }

  if (!result) {
    await db.update(companies).set({
      prospectingStatus: 'no-contact',
      prospectingData: { ...prospData, enrichedAt: new Date().toISOString(), enrichmentSources: [] },
    }).where(eq(companies.id, companyId));
    console.log(`[prospect-enrich] ${company.name} — no decision maker found`);
    return;
  }

  // Create contact record
  const nameParts = result.name.split(' ');
  const [contact] = await db.insert(contacts).values({
    companyId,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(' ') || null,
    email: result.email ?? null,
    phone: result.phone ?? null,
    title: result.title,
    isPrimary: true,
    linkedinUrl: result.linkedinUrl ?? null,
  }).returning();

  await db.update(companies).set({
    prospectingStatus: 'generating',
    prospectingData: { ...prospData, enrichedAt: new Date().toISOString(), enrichmentSources: [result.source], contactId: contact.id },
  }).where(eq(companies.id, companyId));

  // Route mockup jobs to dedicated queue to prevent BullMQ job-stealing
  await getMockupQueue().add('mockup', { companyId, scrapeJobId, stage: 'mockup' });
  console.log(`[prospect-enrich] ${company.name} enriched via ${result.source} → mockup`);
}
