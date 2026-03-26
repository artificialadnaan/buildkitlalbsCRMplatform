import type { Job } from 'bullmq';
import { eq, and, lte } from 'drizzle-orm';
import { db, sequenceEnrollments, sequenceSteps, emailSends, emailTemplates, contacts, companies } from '@buildkit/shared';
import { resolveVariables } from '@buildkit/email';
import { Queue } from 'bullmq';
import { EMAIL_SEND_QUEUE } from '@buildkit/shared';
import type { EmailJobPayload } from '@buildkit/shared';

const redisConnection = { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') };

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
      })
        .from(contacts)
        .leftJoin(companies, eq(contacts.companyId, companies.id))
        .where(eq(contacts.id, enrollment.contactId))
        .limit(1);

      const variables: Record<string, string> = {
        'contact.first_name': contact?.firstName || '',
        'contact.last_name': contact?.lastName || '',
        'contact.email': contact?.email || '',
        'company.name': contact?.companyName || '',
        'company.website': contact?.companyWebsite || '',
        'company.city': contact?.companyCity || '',
        'company.industry': contact?.companyIndustry || '',
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
