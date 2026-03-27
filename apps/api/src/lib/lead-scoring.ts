import { db, companies, contacts, deals } from '@buildkit/shared';
import { eq, sql } from 'drizzle-orm';

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

export function calculateLeadScore(
  company: CompanyForScoring,
  contactCount: number,
  dealCount: number,
  hasEmail = false,
  websiteScore?: number,
): number {
  let score = 0;

  // Has email (on any contact): +15
  if (hasEmail) {
    score += 15;
  }

  // Has phone: +10
  if (company.phone != null && company.phone.trim() !== '') {
    score += 10;
  }

  // Has website: +10
  if (company.website != null && company.website.trim() !== '') {
    score += 10;
  }

  // Google rating scoring
  const rating = company.googleRating != null ? parseFloat(company.googleRating) : NaN;
  if (!isNaN(rating)) {
    if (rating >= 4.0) {
      score += 10;
    } else if (rating >= 3.0) {
      score += 5;
    }
  }

  // Industry matches target: +15
  if (company.industry != null) {
    const normalized = company.industry.toLowerCase().trim();
    if (TARGET_INDUSTRIES.some((t) => normalized.includes(t))) {
      score += 15;
    }
  }

  // Source is manual (hand-picked): +10
  if (company.source === 'manual') {
    score += 10;
  }

  // Has at least 1 contact: +10
  if (contactCount > 0) {
    score += 10;
  }

  // Has at least 1 deal: +20
  if (dealCount > 0) {
    score += 20;
  }

  // Website audit score: up to +20
  score += Math.min(Math.round((websiteScore || 0) / 5), 20);

  return Math.min(score, 100);
}

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

  const audit = company.websiteAudit as { score?: number } | null;
  const websiteScore = audit?.score;

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
