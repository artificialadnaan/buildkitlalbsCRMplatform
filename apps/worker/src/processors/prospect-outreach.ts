import Anthropic from '@anthropic-ai/sdk';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, companies, contacts } from '@buildkit/shared';
import type { ProspectJobData } from '@buildkit/shared';

const anthropic = new Anthropic();

export async function processProspectOutreach(job: Job<ProspectJobData>): Promise<void> {
  const { companyId } = job.data;
  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) return;

  const [contact] = await db.select().from(contacts)
    .where(eq(contacts.companyId, companyId)).limit(1);

  const prospData = (company.prospectingData as Record<string, any>) || {};
  const audit = company.websiteAudit as { score?: number; findings?: string; checks?: Record<string, any> } | null;
  const firstName = contact?.firstName ?? 'there';
  const ownerTitle = contact?.title ?? 'owner';
  const websiteScore = company.websiteScore ?? audit?.score ?? 'low';

  // Build audit findings summary
  let auditSummary = 'outdated design, could use improvement';
  if (audit?.findings) {
    auditSummary = audit.findings.slice(0, 300);
  } else if (audit?.checks) {
    const issues: string[] = [];
    const checks = audit.checks as Record<string, { pass?: boolean; label?: string }>;
    for (const [key, val] of Object.entries(checks)) {
      if (val && !val.pass) issues.push(val.label || key);
    }
    if (issues.length > 0) auditSummary = issues.slice(0, 5).join(', ');
  }

  // Generate cold email
  let generatedEmail = { subject: `Quick note about ${company.name}'s website`, body: '' };
  try {
    const emailResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Write a short cold email (under 150 words) from Adnaan at BuildKit Labs to ${firstName}, the ${ownerTitle} of ${company.name} (${company.industry ?? 'local business'} in ${company.city ?? 'DFW area'}).

Key facts:
- Their website scored ${websiteScore}/100 in our audit
- They have a ${company.googleRating ?? 'good'} Google rating with loyal customers
- Specific issues: ${auditSummary}
- We build websites for local businesses starting at $1,000
- We included a preview of what their new site could look like

Tone: conversational, direct, no fluff. Reference their specific business by name. End with a soft CTA to schedule a 10-minute call. Sign off as Adnaan from BuildKit Labs.

Return ONLY valid JSON: {"subject": "...", "body": "..."}`,
      }],
    });
    const text = emailResponse.content[0].type === 'text' ? emailResponse.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed?.subject && parsed?.body) generatedEmail = parsed;
    }
  } catch (err) {
    console.error('[prospect-outreach] Email generation error:', err instanceof Error ? err.message : err);
  }

  // Generate call prep notes
  let callPrepNotes: string[] = [];
  try {
    const callResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Generate 3 concise bullet-point talking points for a cold call to ${firstName} at ${company.name}. They're a ${company.industry ?? 'local business'} in ${company.city ?? 'DFW'}. Website score: ${websiteScore}/100. Issues: ${auditSummary}. We build websites starting at $1,000 with full design/dev/hosting. Be specific to their business. Return ONLY a JSON array of strings.`,
      }],
    });
    const text = callResponse.content[0].type === 'text' ? callResponse.content[0].text : '';
    const match = text.match(/\[[\s\S]*\]/);
    if (match) callPrepNotes = JSON.parse(match[0]);
  } catch (err) {
    console.error('[prospect-outreach] Call prep generation error:', err instanceof Error ? err.message : err);
  }

  // Mark as READY
  await db.update(companies).set({
    prospectingStatus: 'ready',
    prospectingData: {
      ...prospData,
      status: 'ready',
      generatedEmail,
      callPrepNotes,
      outreachGeneratedAt: new Date().toISOString(),
    },
  }).where(eq(companies.id, companyId));

  console.log(`[prospect-outreach] ${company.name} — email + call prep ready`);
}
