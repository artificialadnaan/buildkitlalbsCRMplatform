import * as https from 'node:https';
import * as http from 'node:http';
import { URL } from 'node:url';
import { load } from 'cheerio';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, companies, contacts } from '@buildkit/shared';
import type { EnrichmentJobData } from '@buildkit/shared';
import { extractEmailsFromHtml } from '../lib/email-extractor.js';

const REQUEST_TIMEOUT_MS = 8000;

// SSRF protection — same list as website-audit
const BLOCKED_HOSTNAMES = ['localhost', 'metadata.google.internal'];
const BLOCKED_IP_PREFIXES = [
  '127.', '10.', '0.', '192.168.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '169.254.', '::1', 'fc00:', 'fd00:', 'fe80:',
];

function isBlockedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) return true;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.includes(host)) return true;
    if (BLOCKED_IP_PREFIXES.some(prefix => host.startsWith(prefix))) return true;
    return false;
  } catch {
    return true;
  }
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.get(
      url,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BuildKitBot/1.0)' },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        // Follow a single redirect
        if (
          res.statusCode != null &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          req.destroy();
          fetchUrl(res.headers.location).then(resolve).catch(reject);
          return;
        }

        if (!res.statusCode || res.statusCode >= 400) {
          req.destroy();
          resolve('');
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').slice(0, 500_000)));
        res.on('error', reject);
      },
    );

    req.on('timeout', () => req.destroy(new Error(`Timeout fetching ${url}`)));
    req.on('error', reject);
  });
}

// Keywords that indicate an about/team page
const TEAM_PAGE_KEYWORDS = ['about', 'team', 'our-team', 'staff', 'leadership', 'who-we-are', 'meet-the-team', 'meet-us', 'about-us'];

function findTeamPageUrl(html: string, baseUrl: string): string | null {
  const $ = load(html);
  const origin = new URL(baseUrl).origin;

  let found: string | null = null;

  $('a[href]').each((_, el) => {
    if (found) return false;
    const href = $(el).attr('href') ?? '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const resolved = new URL(href, baseUrl);
      // Must be same origin
      if (resolved.origin !== origin) return;
      const path = resolved.pathname.toLowerCase();
      if (TEAM_PAGE_KEYWORDS.some(kw => path.includes(kw))) {
        found = resolved.toString();
      }
    } catch {
      // skip malformed href
    }
  });

  return found;
}

// Title keywords to look for (case-insensitive)
const TITLE_KEYWORDS = [
  'owner', 'co-owner', 'ceo', 'chief executive', 'president', 'vice president', 'vp',
  'founder', 'co-founder', 'managing director', 'director', 'manager', 'principal',
  'partner', 'operator',
];

// Regex: two or three capitalized words (a person's name)
const NAME_REGEX = /\b([A-Z][a-z]{1,20})\s+([A-Z][a-z]{1,20})(?:\s+([A-Z][a-z]{1,20}))?\b/g;

interface ExtractedPerson {
  name: string;
  title: string;
}

function extractPeopleFromHtml(html: string): ExtractedPerson[] {
  const $ = load(html);
  const results: ExtractedPerson[] = [];
  const seen = new Set<string>();

  // Strategy 1: structured team-member elements
  // Look for containers where a heading/strong is followed by a title-like element
  $('[class*="team"], [class*="staff"], [class*="member"], [class*="person"], [class*="bio"], [class*="employee"]').each((_, el) => {
    const container = $(el);
    const nameEl = container.find('h1, h2, h3, h4, strong, b').first();
    const titleEl = container.find('p, span, em, small').first();

    const rawName = nameEl.text().trim();
    const rawTitle = titleEl.text().trim();

    if (!rawName || !rawTitle) return;

    const titleLower = rawTitle.toLowerCase();
    const matchedTitle = TITLE_KEYWORDS.find(kw => titleLower.includes(kw));
    if (!matchedTitle) return;

    const nameMatch = NAME_REGEX.exec(rawName);
    NAME_REGEX.lastIndex = 0;
    if (!nameMatch) return;

    const name = [nameMatch[1], nameMatch[2], nameMatch[3]].filter(Boolean).join(' ');
    if (seen.has(name)) return;
    seen.add(name);

    // Capitalize the matched title keyword for display
    const displayTitle = rawTitle.slice(0, 100);
    results.push({ name, title: displayTitle });
  });

  if (results.length > 0) return results;

  // Strategy 2: scan full text for names adjacent to title keywords
  const bodyText = $('body').text();
  const lines = bodyText.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    const matchedTitle = TITLE_KEYWORDS.find(kw => lineLower.includes(kw));
    if (!matchedTitle) continue;

    // Check current line and adjacent lines (±2) for a name
    const window = lines.slice(Math.max(0, i - 2), i + 3).join(' ');
    NAME_REGEX.lastIndex = 0;
    const nameMatch = NAME_REGEX.exec(window);
    NAME_REGEX.lastIndex = 0;
    if (!nameMatch) continue;

    const name = [nameMatch[1], nameMatch[2], nameMatch[3]].filter(Boolean).join(' ');
    // Skip if the "name" is actually common sentence words
    if (['The', 'Our', 'This', 'That', 'With', 'From', 'For', 'And', 'All'].some(w => name.startsWith(w))) continue;
    if (seen.has(name)) continue;
    seen.add(name);

    // Extract the title: take the matching keyword in title-case
    const displayTitle = matchedTitle.charAt(0).toUpperCase() + matchedTitle.slice(1);
    results.push({ name, title: displayTitle });

    if (results.length >= 3) break;
  }

  return results;
}

// Generic emails to skip for contact enrichment
const GENERIC_EMAIL_PREFIXES = ['info', 'contact', 'hello', 'admin', 'support', 'sales', 'office', 'mail', 'team', 'help', 'noreply', 'no-reply', 'webmaster'];

function isGenericEmail(email: string): boolean {
  const local = email.split('@')[0].toLowerCase();
  return GENERIC_EMAIL_PREFIXES.some(prefix => local === prefix);
}

export async function processEnrichment(job: Job<EnrichmentJobData>): Promise<void> {
  const { companyId, website, companyName } = job.data;
  console.log(`[Enrichment] Starting for company ${companyId} — ${companyName} (${website})`);

  const targetUrl = website.startsWith('http') ? website : `https://${website}`;

  // SSRF protection
  if (isBlockedUrl(targetUrl)) {
    console.log(`[Enrichment] Blocked internal URL for company ${companyId}: ${targetUrl}`);
    await db.update(companies).set({ enrichmentStatus: 'failed' }).where(eq(companies.id, companyId));
    return;
  }

  try {
    // Step 1: fetch homepage
    let homepageHtml = '';
    try {
      homepageHtml = await fetchUrl(targetUrl);
    } catch (err) {
      console.log(`[Enrichment] Could not fetch homepage for ${companyId}: ${err instanceof Error ? err.message : err}`);
      await db.update(companies).set({ enrichmentStatus: 'failed' }).where(eq(companies.id, companyId));
      return;
    }

    if (!homepageHtml) {
      console.log(`[Enrichment] Empty homepage for ${companyId}`);
      await db.update(companies).set({ enrichmentStatus: 'not_found' }).where(eq(companies.id, companyId));
      return;
    }

    // Step 2: look for a team/about page link
    const teamPageUrl = findTeamPageUrl(homepageHtml, targetUrl);
    let teamPageHtml = '';
    if (teamPageUrl && !isBlockedUrl(teamPageUrl)) {
      console.log(`[Enrichment] Found team page for ${companyId}: ${teamPageUrl}`);
      try {
        teamPageHtml = await fetchUrl(teamPageUrl);
      } catch {
        // non-fatal — we still have the homepage
        console.log(`[Enrichment] Could not fetch team page ${teamPageUrl} for ${companyId}, continuing with homepage only`);
      }
    }

    // Step 3: extract people — prefer team page over homepage
    const htmlToSearch = teamPageHtml || homepageHtml;
    const people = extractPeopleFromHtml(htmlToSearch);

    // If the team page had nothing, also try the homepage
    const allPeople = people.length > 0 ? people : extractPeopleFromHtml(homepageHtml);

    // Extract emails — prefer team page (more likely to be personal)
    const allEmails = extractEmailsFromHtml(teamPageHtml || homepageHtml);
    const personalEmail = allEmails.find(e => !isGenericEmail(e)) ?? null;

    if (allPeople.length === 0 && !personalEmail) {
      console.log(`[Enrichment] No person found for ${companyId} (${companyName})`);
      await db.update(companies).set({ enrichmentStatus: 'not_found' }).where(eq(companies.id, companyId));
      return;
    }

    // Step 4: update the placeholder contact for this company
    const [existingContact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.companyId, companyId))
      .limit(1);

    const topPerson = allPeople[0];
    const nameParts = topPerson?.name.split(' ') ?? [];
    const firstName = nameParts[0] ?? null;
    const lastName = nameParts.slice(1).join(' ') || null;

    if (existingContact) {
      await db.update(contacts)
        .set({
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(topPerson?.title ? { title: topPerson.title } : {}),
          ...(personalEmail ? { email: personalEmail } : {}),
          isPrimary: true,
        })
        .where(eq(contacts.id, existingContact.id));
    } else if (firstName) {
      // No placeholder yet — create one
      await db.insert(contacts).values({
        companyId,
        firstName,
        lastName,
        title: topPerson?.title ?? null,
        email: personalEmail,
        isPrimary: true,
      });
    }

    await db.update(companies).set({ enrichmentStatus: 'enriched' }).where(eq(companies.id, companyId));
    console.log(`[Enrichment] Enriched company ${companyId} — ${topPerson?.name ?? 'email only'} (${topPerson?.title ?? ''})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Enrichment] Failed for company ${companyId}:`, message);
    // Best-effort: mark failed and do not rethrow so pipeline continues
    try {
      await db.update(companies).set({ enrichmentStatus: 'failed' }).where(eq(companies.id, companyId));
    } catch {
      // ignore secondary failure
    }
  }
}
