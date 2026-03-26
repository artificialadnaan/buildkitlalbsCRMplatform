const MAILTO_REGEX = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// File extensions and patterns that look like emails but aren't
const IGNORE_PATTERNS = [
  /@\dx\./i,       // @2x.png, @3x.svg (retina images)
  /@import/i,       // CSS @import
  /@media/i,        // CSS @media
  /@keyframes/i,    // CSS @keyframes
  /@font-face/i,    // CSS @font-face
];

const IGNORE_TLDS = ['.png', '.svg', '.jpg', '.jpeg', '.gif', '.webp', '.css', '.js'];

function isValidEmail(email: string): boolean {
  const lower = email.toLowerCase();

  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(email)) return false;
  }

  for (const tld of IGNORE_TLDS) {
    if (lower.endsWith(tld)) return false;
  }

  // Must have a real TLD (at least 2 chars, no dots)
  const tld = lower.split('.').pop();
  if (!tld || tld.length < 2) return false;

  return true;
}

export function extractEmailsFromHtml(html: string): string[] {
  const emails = new Set<string>();

  // Extract from mailto: links
  let match: RegExpExecArray | null;
  const mailtoRegex = new RegExp(MAILTO_REGEX.source, 'gi');
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = match[1].toLowerCase();
    if (isValidEmail(email)) {
      emails.add(email);
    }
  }

  // Also extract from raw text
  const textEmails = extractEmailsFromText(html);
  for (const email of textEmails) {
    emails.add(email);
  }

  return Array.from(emails);
}

export function extractEmailsFromText(text: string): string[] {
  const emails = new Set<string>();
  const matches = text.match(EMAIL_REGEX) || [];

  for (const raw of matches) {
    const email = raw.toLowerCase();
    if (isValidEmail(email)) {
      emails.add(email);
    }
  }

  return Array.from(emails);
}

export async function extractEmailsFromUrl(url: string, timeoutMs = 8000): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BuildKitBot/1.0)',
        'Accept': 'text/html',
      },
    });

    clearTimeout(timer);

    if (!response.ok) return [];

    const html = await response.text();
    // Only process first 500KB to avoid huge pages
    const truncated = html.slice(0, 500_000);
    return extractEmailsFromHtml(truncated);
  } catch {
    // Timeout, network error, etc. — expected for many small business sites
    return [];
  }
}
