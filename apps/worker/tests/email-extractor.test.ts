import { describe, it, expect } from 'vitest';
import { extractEmailsFromHtml, extractEmailsFromText } from '../src/lib/email-extractor.js';

describe('Email Extractor', () => {
  it('extracts mailto: links from HTML', () => {
    const html = `
      <html>
        <body>
          <a href="mailto:info@testcompany.com">Contact Us</a>
          <a href="mailto:sales@testcompany.com?subject=Hello">Sales</a>
        </body>
      </html>
    `;
    const emails = extractEmailsFromHtml(html);
    expect(emails).toContain('info@testcompany.com');
    expect(emails).toContain('sales@testcompany.com');
  });

  it('extracts emails from plain text using regex', () => {
    const text = `
      Contact us at info@example.com or support@example.com.
      You can also reach john.doe@company.co.uk for inquiries.
    `;
    const emails = extractEmailsFromText(text);
    expect(emails).toContain('info@example.com');
    expect(emails).toContain('support@example.com');
    expect(emails).toContain('john.doe@company.co.uk');
  });

  it('deduplicates emails', () => {
    const html = `
      <a href="mailto:info@test.com">Email 1</a>
      <a href="mailto:info@test.com">Email 2</a>
      <p>Also: info@test.com</p>
    `;
    const emails = extractEmailsFromHtml(html);
    expect(emails).toHaveLength(1);
  });

  it('ignores common non-email patterns', () => {
    const text = `
      Images: photo@2x.png, icon@3x.svg
      CSS: font@import url
    `;
    const emails = extractEmailsFromText(text);
    expect(emails).toHaveLength(0);
  });

  it('lowercases all extracted emails', () => {
    const html = '<a href="mailto:John.Doe@Company.COM">Email</a>';
    const emails = extractEmailsFromHtml(html);
    expect(emails).toContain('john.doe@company.com');
  });

  it('returns empty array for HTML with no emails', () => {
    const html = '<html><body><p>No emails here</p></body></html>';
    const emails = extractEmailsFromHtml(html);
    expect(emails).toHaveLength(0);
  });
});
