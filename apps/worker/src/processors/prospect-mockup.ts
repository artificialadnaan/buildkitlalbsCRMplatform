import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, companies, createProspectQueue } from '@buildkit/shared';
import type { ProspectJobData } from '@buildkit/shared';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, '../templates/prospect');

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

const INDUSTRY_MAP: Record<string, string> = {
  restaurant: 'restaurant.html', food: 'restaurant.html', cafe: 'restaurant.html',
  pizza: 'restaurant.html', coffee: 'restaurant.html', bakery: 'restaurant.html',
  contractor: 'contractor.html', construction: 'contractor.html', roofing: 'contractor.html',
  plumbing: 'contractor.html', hvac: 'contractor.html', electrical: 'contractor.html',
  landscaping: 'contractor.html', painting: 'contractor.html',
  salon: 'salon.html', beauty: 'salon.html', spa: 'salon.html', barber: 'salon.html',
  nails: 'salon.html', hair: 'salon.html',
};

function pickTemplate(industry: string | null): string {
  if (!industry) return 'default.html';
  const norm = industry.toLowerCase();
  for (const [kw, tmpl] of Object.entries(INDUSTRY_MAP)) {
    if (norm.includes(kw)) return tmpl;
  }
  return 'default.html';
}

export async function processProspectMockup(job: Job<ProspectJobData>): Promise<void> {
  const { companyId, scrapeJobId } = job.data;
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return;

  const prospData = (company.prospectingData as Record<string, unknown>) || {};

  // Load and populate template
  const templateFile = pickTemplate(company.industry ?? null);
  let html = fs.readFileSync(path.join(TEMPLATE_DIR, templateFile), 'utf-8');
  html = html
    .replace(/\{\{BUSINESS_NAME\}\}/g, company.name)
    .replace(/\{\{PHONE\}\}/g, company.phone ?? '(555) 000-0000')
    .replace(/\{\{ADDRESS\}\}/g, [company.address, company.city, company.state].filter(Boolean).join(', '))
    .replace(/\{\{RATING\}\}/g, company.googleRating ?? '4.5')
    .replace(/\{\{REVIEW_COUNT\}\}/g, String((prospData.reviewCount as number | undefined) ?? 0));

  // Screenshot via Playwright
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const screenshot = await page.screenshot({ type: 'png' });
  await browser.close();

  // Upload to R2
  const key = `previews/${companyId}.png`;
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: screenshot,
    ContentType: 'image/png',
  }));
  const previewUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

  // Update company record
  await db.update(companies).set({
    prospectingData: {
      ...prospData,
      templatePreviewUrl: previewUrl,
      templateUsed: templateFile,
      mockupGeneratedAt: new Date().toISOString(),
    },
  }).where(eq(companies.id, companyId));

  // Advance to outreach
  await getQueue().add('outreach', { companyId, scrapeJobId, stage: 'outreach' });
  console.log(`[prospect-mockup] ${company.name} screenshot → ${previewUrl} → outreach`);
}
