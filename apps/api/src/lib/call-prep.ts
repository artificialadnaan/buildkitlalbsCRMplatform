import { eq, desc } from 'drizzle-orm';
import { db, deals, companies, contacts, activities } from '@buildkit/shared';
import type { CallPrep, WebsiteAudit } from '@buildkit/shared';

function buildTalkingPoints(audit: WebsiteAudit | null, googleRating: number | null): string[] {
  const points: string[] = [];

  if (audit) {
    const { checks } = audit;

    if (checks.loadTimeMs > 3000) {
      const seconds = (checks.loadTimeMs / 1000).toFixed(1);
      points.push(`Their website loads in ${seconds}s — we can help bring that under 3 seconds`);
    }

    if (!checks.hasMobileViewport) {
      points.push("Their site isn't mobile-friendly — over 60% of traffic is mobile");
    }

    if (!checks.isHttps) {
      points.push("No SSL certificate — this hurts their Google ranking and customer trust");
    }

    if (!checks.hasContactForm) {
      points.push("No contact form on their website — they're losing leads");
    }

    const currentYear = new Date().getFullYear();
    if (checks.copyrightYear != null && checks.copyrightYear < currentYear - 1) {
      points.push(`Copyright says ${checks.copyrightYear} — site hasn't been updated in years`);
    }

    if (checks.brokenImageCount > 0) {
      points.push(`Found ${checks.brokenImageCount} broken image${checks.brokenImageCount > 1 ? 's' : ''} — unprofessional impression`);
    }

    if (!checks.hasMetaDescription) {
      points.push("Missing meta description — invisible to search engines");
    }
  }

  if (googleRating != null) {
    points.push(`Their Google rating is ${googleRating}/5`);
  }

  return points;
}

function buildEstimatedScope(issueCount: number): { description: string; lowEstimate: number; highEstimate: number } | null {
  if (issueCount === 0) return null;

  if (issueCount <= 2) {
    return { description: 'Website tune-up', lowEstimate: 1500, highEstimate: 3000 };
  }

  if (issueCount <= 4) {
    return { description: 'Website overhaul', lowEstimate: 5000, highEstimate: 10000 };
  }

  return { description: 'Full website redesign', lowEstimate: 8000, highEstimate: 20000 };
}

export async function generateCallPrep(dealId: string): Promise<CallPrep> {
  // Query deal with company and contact
  const [dealRow] = await db
    .select({
      deal: deals,
      company: companies,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
    })
    .from(deals)
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .where(eq(deals.id, dealId))
    .limit(1);

  if (!dealRow) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  const { company } = dealRow;

  // Query last 10 activities for this deal
  const recentActivities = await db
    .select({
      type: activities.type,
      subject: activities.subject,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .where(eq(activities.dealId, dealId))
    .orderBy(desc(activities.createdAt))
    .limit(10);

  const audit = company?.websiteAudit as WebsiteAudit | null ?? null;
  const googleRating = company?.googleRating != null ? Number(company.googleRating) : null;

  const talkingPoints = buildTalkingPoints(audit, googleRating);

  // Count audit issues (all except googleRating talking points)
  const auditIssueCount = talkingPoints.filter(p => !p.startsWith('Their Google rating')).length;

  const location = [company?.city, company?.state].filter(Boolean).join(', ');

  const callPrep: CallPrep = {
    companyOverview: {
      name: company?.name ?? '',
      industry: company?.industry ?? null,
      location,
      website: company?.website ?? null,
      googleRating,
      employeeCount: company?.employeeCount ?? null,
    },
    websiteFindings: audit?.findings ?? null,
    websiteScore: company?.websiteScore ?? null,
    talkingPoints,
    estimatedScope: buildEstimatedScope(auditIssueCount),
    recentActivity: recentActivities.map(a => ({
      type: a.type,
      subject: a.subject ?? '',
      date: a.createdAt.toISOString(),
    })),
    generatedAt: new Date().toISOString(),
  };

  // Persist to deals table
  await db
    .update(deals)
    .set({ callPrep, callPrepGeneratedAt: new Date() })
    .where(eq(deals.id, dealId));

  return callPrep;
}
