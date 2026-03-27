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
