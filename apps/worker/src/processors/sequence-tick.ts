import type { Job } from 'bullmq';
import { eq, and, lte } from 'drizzle-orm';
import { db, sequenceEnrollments, sequenceSteps, emailSends, emailTemplates, contacts, companies } from '@buildkit/shared';
import { resolveVariables } from '@buildkit/email';
import { Queue } from 'bullmq';
import { EMAIL_SEND_QUEUE } from '@buildkit/shared';
import type { EmailJobPayload, WebsiteAudit } from '@buildkit/shared';

function getTopIssue(audit: WebsiteAudit | null): string {
  if (!audit) return '';

  const { checks } = audit;

  if (!checks.isHttps) return 'No SSL certificate on your website';
  if (!checks.hasMobileViewport) return "Your website isn't mobile-friendly";
  if (checks.loadTimeMs > 3000) {
    const seconds = (checks.loadTimeMs / 1000).toFixed(1);
    return `Your website takes ${seconds}s to load`;
  }
  if (!checks.hasContactForm) return 'No contact form on your website';
  if (!checks.hasMetaDescription) return 'Missing meta description — you\'re invisible to search engines';
  if (checks.brokenImageCount > 0) return `${checks.brokenImageCount} broken image${checks.brokenImageCount > 1 ? 's' : ''} on your website`;

  const currentYear = new Date().getFullYear();
  if (checks.copyrightYear != null && checks.copyrightYear < currentYear - 1) {
    return `Your website copyright still says ${checks.copyrightYear}`;
  }

  return audit.findings || '';
}

function generateSpecificObservation(audit: WebsiteAudit | null): string {
  if (!audit) return '';

  const { checks } = audit;
  const issues: string[] = [];

  if (checks.loadTimeMs > 3000) {
    const seconds = (checks.loadTimeMs / 1000).toFixed(1);
    issues.push(`loads in ${seconds} seconds`);
  }

  if (!checks.hasMobileViewport) {
    issues.push("isn't mobile-friendly");
  }

  if (!checks.isHttps) {
    issues.push("doesn't have an SSL certificate");
  }

  if (!checks.hasContactForm) {
    issues.push("has no contact form");
  }

  if (issues.length === 0) return '';

  if (issues.length === 1) {
    return `I noticed your website ${issues[0]}`;
  }

  const last = issues.pop();
  return `I noticed your website ${issues.join(', ')} and ${last}`;
}

import { getRedisConnection } from '@buildkit/shared';

const redisConnection = getRedisConnection();

export async function processSequenceTick(job: Job) {
  console.log('[sequence-tick] Checking for enrollments ready to send...');

  const now = new Date();

  // Find all active enrollments where next_send_at <= now
  const readyEnrollments = await db.select()
    .from(sequenceEnrollments)
    .where(and(
      eq(sequenceEnrollments.status, 'active'),
      lte(sequenceEnrollments.nextSendAt, now),
    ));

  console.log(`[sequence-tick] Found ${readyEnrollments.length} enrollments ready to send`);

  const emailSendQueue = new Queue<EmailJobPayload>(EMAIL_SEND_QUEUE, { connection: redisConnection });

  for (const enrollment of readyEnrollments) {
    try {
      // Get the current step
      const [step] = await db.select({
        step: sequenceSteps,
        templateSubject: emailTemplates.subject,
        templateBody: emailTemplates.bodyHtml,
      })
        .from(sequenceSteps)
        .leftJoin(emailTemplates, eq(sequenceSteps.templateId, emailTemplates.id))
        .where(and(
          eq(sequenceSteps.sequenceId, enrollment.sequenceId),
          eq(sequenceSteps.stepNumber, enrollment.currentStep),
        ))
        .limit(1);

      if (!step) {
        // No more steps — mark as completed
        await db.update(sequenceEnrollments)
          .set({ status: 'completed', nextSendAt: null })
          .where(eq(sequenceEnrollments.id, enrollment.id));
        console.log(`[sequence-tick] Enrollment ${enrollment.id} completed — no more steps`);
        continue;
      }

      // Resolve template variables
      const [contact] = await db.select({
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        companyName: companies.name,
        companyWebsite: companies.website,
        companyCity: companies.city,
        companyIndustry: companies.industry,
        websiteAudit: companies.websiteAudit,
        websiteScore: companies.websiteScore,
      })
        .from(contacts)
        .leftJoin(companies, eq(contacts.companyId, companies.id))
        .where(eq(contacts.id, enrollment.contactId))
        .limit(1);

      const audit = (contact?.websiteAudit as WebsiteAudit | null) ?? null;

      const variables: Record<string, string> = {
        'contact.first_name': contact?.firstName || '',
        'contact.last_name': contact?.lastName || '',
        'contact.email': contact?.email || '',
        'company.name': contact?.companyName || '',
        'company.website': contact?.companyWebsite || '',
        'company.city': contact?.companyCity || '',
        'company.industry': contact?.companyIndustry || '',
        'audit.score': String(contact?.websiteScore || 0),
        'audit.load_time': audit ? String((audit.checks.loadTimeMs / 1000).toFixed(1)) : '',
        'audit.findings': audit?.findings || '',
        'audit.top_issue': getTopIssue(audit),
        'audit.specific_observation': generateSpecificObservation(audit),
      };

      const resolvedSubject = resolveVariables(step.templateSubject || '', variables);
      const resolvedBody = resolveVariables(step.templateBody || '', variables);

      // Create email send record
      const [emailSend] = await db.insert(emailSends).values({
        dealId: enrollment.dealId,
        contactId: enrollment.contactId,
        templateId: step.step.templateId,
        sentBy: enrollment.enrolledBy!,
        subject: resolvedSubject,
        bodyHtml: resolvedBody,
        status: 'queued',
      }).returning();

      // Enqueue the email send job
      await emailSendQueue.add('send', {
        emailSendId: emailSend.id,
        userId: enrollment.enrolledBy!,
      });

      // Advance to next step
      const [nextStep] = await db.select().from(sequenceSteps)
        .where(and(
          eq(sequenceSteps.sequenceId, enrollment.sequenceId),
          eq(sequenceSteps.stepNumber, enrollment.currentStep + 1),
        ))
        .limit(1);

      if (nextStep) {
        const nextSendAt = new Date();
        nextSendAt.setDate(nextSendAt.getDate() + nextStep.delayDays);

        await db.update(sequenceEnrollments)
          .set({
            currentStep: enrollment.currentStep + 1,
            nextSendAt,
          })
          .where(eq(sequenceEnrollments.id, enrollment.id));
      } else {
        // This was the last step — mark completed after send
        await db.update(sequenceEnrollments)
          .set({ status: 'completed', nextSendAt: null })
          .where(eq(sequenceEnrollments.id, enrollment.id));
      }

      console.log(`[sequence-tick] Queued step ${enrollment.currentStep} for enrollment ${enrollment.id}`);
    } catch (err) {
      console.error(`[sequence-tick] Error processing enrollment ${enrollment.id}:`, err);
    }
  }

  await emailSendQueue.close();
}
