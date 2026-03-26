import type { Job, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, scrapeJobs, companies, contacts } from '@buildkit/shared';
import type { ScrapeJobData, ScrapeJobProgress, WebsiteAuditJobData } from '@buildkit/shared';
import { createWebsiteAuditQueue } from '@buildkit/shared';
import { searchPlaces, parsePlace } from '../lib/google-places.js';
import { extractEmailsFromUrl } from '../lib/email-extractor.js';

let auditQueue: Queue<WebsiteAuditJobData> | null = null;
function getAuditQueue(): Queue<WebsiteAuditJobData> {
  if (!auditQueue) auditQueue = createWebsiteAuditQueue();
  return auditQueue;
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

export async function processScrapeJob(job: Job<ScrapeJobData>): Promise<void> {
  const { jobId, zipCodes, searchQuery, maxLeads = 50 } = job.data;

  // Mark job as running
  await db.update(scrapeJobs)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(scrapeJobs.id, jobId));

  let totalFound = 0;
  let newLeads = 0;
  let duplicatesSkipped = 0;

  try {
    for (let i = 0; i < zipCodes.length; i++) {
      const zipCode = zipCodes[i];
      console.log(`[Scrape] Searching "${searchQuery}" in zip ${zipCode} (${i + 1}/${zipCodes.length})`);

      const places = await searchPlaces(searchQuery, zipCode, API_KEY);
      totalFound += places.length;

      for (const place of places) {
        // Stop if we've hit the lead limit
        if (newLeads >= maxLeads) {
          console.log(`[Scrape] Reached max leads limit (${maxLeads}), stopping.`);
          break;
        }

        const parsed = parsePlace(place);

        // Dedup check by google_place_id
        const existing = await db.select({ id: companies.id })
          .from(companies)
          .where(eq(companies.googlePlaceId, parsed.googlePlaceId))
          .limit(1);

        if (existing.length > 0) {
          duplicatesSkipped++;
          continue;
        }

        // Extract emails from website if available
        let email: string | null = null;
        if (parsed.website) {
          const emails = await extractEmailsFromUrl(parsed.website, 8000);
          email = emails[0] || null;
        }

        // Insert company
        const [newCompany] = await db.insert(companies).values({
          name: parsed.name,
          type: 'local',
          website: parsed.website,
          phone: parsed.phone,
          address: parsed.address,
          city: parsed.city,
          state: parsed.state,
          zip: parsed.zip,
          googlePlaceId: parsed.googlePlaceId,
          googleRating: parsed.googleRating?.toString() ?? null,
          industry: parsed.industry,
          source: 'scraped',
          scrapeJobId: jobId,
        }).returning();

        // Auto-create contact if email or phone was found
        if (email || parsed.phone) {
          await db.insert(contacts).values({
            companyId: newCompany.id,
            firstName: parsed.name.split(' ')[0] || 'Contact',
            email,
            phone: parsed.phone,
            isPrimary: true,
          });
        }

        // Enqueue website audit if a URL is available
        if (parsed.website) {
          await getAuditQueue().add('audit', {
            companyId: newCompany.id,
            url: parsed.website,
          });
        }

        newLeads++;
      }

      // Stop outer loop if limit reached
      if (newLeads >= maxLeads) break;

      // Update progress after each zip code
      const progress: ScrapeJobProgress = {
        zipCode,
        processed: i + 1,
        total: zipCodes.length,
        newLeads,
        duplicatesSkipped,
      };
      await job.updateProgress(progress);

      // Update scrape_jobs row with running totals
      await db.update(scrapeJobs)
        .set({ totalFound, newLeads, duplicatesSkipped })
        .where(eq(scrapeJobs.id, jobId));
    }

    // Mark job as done
    await db.update(scrapeJobs)
      .set({
        status: 'done',
        totalFound,
        newLeads,
        duplicatesSkipped,
        completedAt: new Date(),
      })
      .where(eq(scrapeJobs.id, jobId));

    console.log(`[Scrape] Job ${jobId} complete — found: ${totalFound}, new: ${newLeads}, dupes: ${duplicatesSkipped}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Scrape] Job ${jobId} failed:`, message);

    await db.update(scrapeJobs)
      .set({
        status: 'failed',
        totalFound,
        newLeads,
        duplicatesSkipped,
        errorMessage: message.slice(0, 1000),
        completedAt: new Date(),
      })
      .where(eq(scrapeJobs.id, jobId));

    throw err;
  }
}
