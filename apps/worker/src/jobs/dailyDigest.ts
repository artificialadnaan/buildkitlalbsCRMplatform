import { eq, and, gte, lt, sql } from 'drizzle-orm';
import { db, notifications, notificationPreferences, users, emailSends, sequenceEnrollments, companies } from '@buildkit/shared';

export async function sendDailyDigest(): Promise<void> {
  console.log('[dailyDigest] Starting daily digest...');

  const now = new Date();
  const yesterdayStart = new Date(now);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(now);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
  yesterdayEnd.setHours(23, 59, 59, 999);

  // Get all users with digest enabled
  const usersWithDigest = await db
    .select({ userId: notificationPreferences.userId })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.dailyDigestEnabled, true));

  console.log(`[dailyDigest] Sending digest to ${usersWithDigest.length} users`);

  for (const { userId } of usersWithDigest) {
    try {
      // Count emails sent yesterday by this user
      const [emailsSentResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(emailSends)
        .where(
          and(
            eq(emailSends.sentBy, userId),
            eq(emailSends.status, 'sent'),
            gte(emailSends.sentAt, yesterdayStart),
            lt(emailSends.sentAt, now),
          ),
        );

      // Count replies received yesterday (enrollments paused with reply_received)
      const [repliesResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(sequenceEnrollments)
        .where(
          and(
            eq(sequenceEnrollments.enrolledBy, userId),
            eq(sequenceEnrollments.status, 'paused'),
            eq(sequenceEnrollments.pausedReason, 'reply_received'),
            gte(sequenceEnrollments.enrolledAt, yesterdayStart),
            lt(sequenceEnrollments.enrolledAt, now),
          ),
        );

      // Count new companies (leads) scraped yesterday
      const [newLeadsResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(companies)
        .where(
          and(
            eq(companies.source, 'scraped'),
            gte(companies.createdAt, yesterdayStart),
            lt(companies.createdAt, now),
          ),
        );

      const emailsSent = emailsSentResult?.count ?? 0;
      const repliesReceived = repliesResult?.count ?? 0;
      const newLeads = newLeadsResult?.count ?? 0;

      const body = [
        `Emails sent: ${emailsSent}`,
        `Replies received: ${repliesReceived}`,
        `New leads scraped: ${newLeads}`,
      ].join(' · ');

      await db.insert(notifications).values({
        userId,
        type: 'sequence_digest',
        title: `Daily digest — ${yesterdayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        body,
      });

      console.log(`[dailyDigest] Digest created for user ${userId}: ${body}`);
    } catch (err) {
      console.error(`[dailyDigest] Failed to create digest for user ${userId}:`, err);
    }
  }

  console.log('[dailyDigest] Done.');
}
