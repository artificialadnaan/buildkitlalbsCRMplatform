import { describe, it, expect } from 'vitest';
import { buildStitchPrompt } from '../src/lib/prompt-builder.js';

describe('buildStitchPrompt', () => {
  it('builds full prompt with all data', () => {
    const prompt = buildStitchPrompt({
      name: "Sal's Pizza",
      industry: 'restaurant',
      city: 'Arlington',
      state: 'TX',
      googleRating: '4.8',
      phone: '817-555-0123',
      address: '123 Main St',
      reviewCount: 47,
      websiteAuditFindings: 'no online menu, outdated design',
    });
    expect(prompt).toContain("Sal's Pizza");
    expect(prompt).toContain('restaurant');
    expect(prompt).toContain('Arlington');
    expect(prompt).toContain('4.8');
    expect(prompt).toContain('47');
    expect(prompt).toContain('817-555-0123');
    expect(prompt).toContain('no online menu');
    expect(prompt).toContain('Call Now');
  });

  it('builds minimal prompt with just name', () => {
    const prompt = buildStitchPrompt({ name: "Bob's Shop" });
    expect(prompt).toContain("Bob's Shop");
    expect(prompt).toContain('Call Now');
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('null');
  });

  it('includes industry-specific style direction', () => {
    const restaurant = buildStitchPrompt({ name: 'Test', industry: 'restaurant' });
    expect(restaurant).toContain('warm');

    const contractor = buildStitchPrompt({ name: 'Test', industry: 'plumbing' });
    expect(contractor).toContain('professional');
  });
});
