import * as https from 'node:https';
import * as http from 'node:http';
import { URL } from 'node:url';
import { load } from 'cheerio';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, companies } from '@buildkit/shared';
import type { WebsiteAuditJobData, WebsiteAudit, WebsiteAuditChecks } from '@buildkit/shared';
import { isBlockedUrl, fetchUrl } from '../lib/http-utils.js';

const REQUEST_TIMEOUT_MS = 8000;
const MAX_IMAGES_TO_CHECK = 20;

function headUrl(url: string): Promise<number> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(
        url,
        { method: 'HEAD', timeout: REQUEST_TIMEOUT_MS },
        (res) => resolve(res.statusCode ?? 0),
      );
      req.on('timeout', () => {
        req.destroy();
        resolve(0);
      });
      req.on('error', () => resolve(0));
      req.end();
    } catch {
      resolve(0);
    }
  });
}

function resolveImageUrl(src: string, base: string): string | null {
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

function generateFindings(checks: WebsiteAuditChecks): string {
  const issues: string[] = [];

  if (!checks.isHttps) issues.push('Site is not served over HTTPS.');
  if (!checks.hasMobileViewport) issues.push('No mobile viewport meta tag found.');
  if (!checks.hasTitle) issues.push('Page is missing a title tag.');
  if (!checks.hasMetaDescription) issues.push('No meta description found.');
  if (!checks.hasOgTags) issues.push('No Open Graph tags detected.');
  if (!checks.hasH1) issues.push('No H1 heading found on the page.');
  if (!checks.hasContactForm) issues.push('No contact form detected on the homepage.');
  if (!checks.hasRobotsTxt) issues.push('robots.txt is missing or inaccessible.');

  const currentYear = new Date().getFullYear();
  if (checks.copyrightYear == null) {
    issues.push('No copyright year detected — footer may be outdated or missing.');
  } else if (checks.copyrightYear < currentYear - 1) {
    issues.push(`Copyright year (${checks.copyrightYear}) appears stale.`);
  }

  if (checks.loadTimeMs >= 5000) {
    issues.push(`Page load time is very slow (${(checks.loadTimeMs / 1000).toFixed(1)}s).`);
  } else if (checks.loadTimeMs >= 3000) {
    issues.push(`Page load time is slow (${(checks.loadTimeMs / 1000).toFixed(1)}s).`);
  } else if (checks.loadTimeMs >= 2000) {
    issues.push(`Page load time could be improved (${(checks.loadTimeMs / 1000).toFixed(1)}s).`);
  }

  if (checks.brokenImageCount > 0) {
    issues.push(
      `${checks.brokenImageCount} broken image${checks.brokenImageCount > 1 ? 's' : ''} detected.`,
    );
  }

  if (issues.length === 0) return 'No major issues found. Site looks healthy.';
  return issues.join(' ');
}

function calculateScore(checks: WebsiteAuditChecks): number {
  let score = 0;

  // Speed: up to 20 pts
  if (checks.loadTimeMs < 2000) score += 20;
  else if (checks.loadTimeMs < 3000) score += 15;
  else if (checks.loadTimeMs < 5000) score += 10;
  else if (checks.loadTimeMs < 8000) score += 5;

  // Mobile viewport: 15 pts
  if (checks.hasMobileViewport) score += 15;

  // SSL: 15 pts
  if (checks.isHttps) score += 15;

  // Meta description: 10 pts
  if (checks.hasMetaDescription) score += 10;

  // Images (no broken): 10 pts
  const brokenRatio =
    checks.totalImageCount > 0 ? checks.brokenImageCount / checks.totalImageCount : 0;
  if (checks.brokenImageCount === 0) score += 10;
  else if (brokenRatio < 0.1) score += 5;

  // Copyright: 5 pts
  const currentYear = new Date().getFullYear();
  if (
    checks.copyrightYear != null &&
    (checks.copyrightYear === currentYear || checks.copyrightYear === currentYear - 1)
  ) {
    score += 5;
  }

  // Contact form: 15 pts
  if (checks.hasContactForm) score += 15;

  // H1: 5 pts
  if (checks.hasH1) score += 5;

  // robots.txt: 5 pts
  if (checks.hasRobotsTxt) score += 5;

  return score;
}

export async function processWebsiteAudit(job: Job<WebsiteAuditJobData>): Promise<void> {
  const { companyId, url } = job.data;
  console.log(`[WebsiteAudit] Starting audit for company ${companyId} — ${url}`);

  try {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;

    // SSRF protection: block internal/private URLs
    if (isBlockedUrl(targetUrl)) {
      console.log(`[WebsiteAudit] Blocked internal URL: ${targetUrl}`);
      return;
    }

    const origin = new URL(targetUrl).origin;

    // Fetch homepage
    const { body, statusCode, elapsed } = await fetchUrl(targetUrl);
    console.log(`[WebsiteAudit] Fetched ${targetUrl} — ${statusCode} in ${elapsed}ms`);

    const $ = load(body);

    // --- Checks ---
    const isHttps = targetUrl.startsWith('https://');

    const hasMobileViewport = $('meta[name="viewport"]').length > 0;

    const titleEl = $('title').first();
    const hasTitle = titleEl.length > 0 && titleEl.text().trim() !== '';
    const titleText = hasTitle ? titleEl.text().trim() : null;

    const metaDescEl = $('meta[name="description"]').first();
    const hasMetaDescription =
      metaDescEl.length > 0 && (metaDescEl.attr('content') ?? '').trim() !== '';
    const metaDescription = hasMetaDescription ? (metaDescEl.attr('content') ?? null) : null;

    const hasOgTags = $('meta[property^="og:"]').length > 0;

    const h1El = $('h1').first();
    const hasH1 = h1El.length > 0;
    const h1Text = hasH1 ? h1El.text().trim() : null;

    // Contact form: form containing email-related input
    let hasContactForm = false;
    $('form').each((_, form) => {
      const emailInput = $(form).find(
        'input[type="email"], input[name*="email" i], input[name*="contact" i]',
      );
      if (emailInput.length > 0) {
        hasContactForm = true;
        return false; // break
      }
    });

    // Copyright year
    const bodyText = $('body').text();
    const copyrightMatch = /(?:©|copyright)\s*(\d{4})/i.exec(bodyText);
    const copyrightYear = copyrightMatch ? parseInt(copyrightMatch[1], 10) : null;

    // Images — collect srcs, check for broken (capped at MAX_IMAGES_TO_CHECK)
    const imageSrcs: string[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.startsWith('data:')) {
        const resolved = resolveImageUrl(src, targetUrl);
        if (resolved) imageSrcs.push(resolved);
      }
    });
    const totalImageCount = imageSrcs.length;
    const imagesToCheck = imageSrcs.slice(0, MAX_IMAGES_TO_CHECK);
    const headResults = await Promise.all(imagesToCheck.map((src) => headUrl(src)));
    const brokenImageCount = headResults.filter((code) => code >= 400 || code === 0).length;

    // Auto-discover internal links (2-3, same domain, not anchors)
    const pagesCrawled: string[] = [targetUrl];
    $('a[href]').each((_, el) => {
      if (pagesCrawled.length >= 3) return false;
      const href = $(el).attr('href') ?? '';
      if (href.startsWith('#') || href === '' || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const resolved = new URL(href, targetUrl);
        if (
          resolved.origin === origin &&
          resolved.pathname !== '/' &&
          !pagesCrawled.includes(resolved.toString())
        ) {
          pagesCrawled.push(resolved.toString());
        }
      } catch {
        // skip malformed href
      }
    });

    // robots.txt
    let hasRobotsTxt = false;
    try {
      const { statusCode: robotsStatus } = await fetchUrl(`${origin}/robots.txt`);
      hasRobotsTxt = robotsStatus >= 200 && robotsStatus < 300;
    } catch {
      hasRobotsTxt = false;
    }

    const checks: WebsiteAuditChecks = {
      loadTimeMs: elapsed,
      isHttps,
      hasMobileViewport,
      hasTitle,
      titleText,
      hasMetaDescription,
      metaDescription,
      hasOgTags,
      brokenImageCount,
      totalImageCount,
      copyrightYear,
      hasContactForm,
      hasH1,
      h1Text,
      hasRobotsTxt,
      pagesCrawled,
    };

    const score = calculateScore(checks);
    const findings = generateFindings(checks);

    const audit: WebsiteAudit = {
      score,
      findings,
      checks,
      auditedAt: new Date().toISOString(),
    };

    await db
      .update(companies)
      .set({
        websiteAudit: audit,
        websiteScore: score,
        websiteAuditedAt: new Date(),
      })
      .where(eq(companies.id, companyId));

    console.log(`[WebsiteAudit] Company ${companyId} scored ${score}/100 — ${findings.slice(0, 80)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[WebsiteAudit] Failed for company ${companyId}:`, message);
    throw err;
  }
}
