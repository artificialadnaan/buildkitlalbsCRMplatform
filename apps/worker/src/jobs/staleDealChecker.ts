import { eq, and, lt, sql, isNull, or } from 'drizzle-orm';
import { db, deals, notifications, notificationPreferences, activities, users } from '@buildkit/shared';

export async function checkStaleDeals(): Promise<void> {
  console.log('[staleDealChecker] Starting stale deal check...');

  // Get all users with their stale deal day preferences
  const allUsers = await db
    .select({
      userId: users.id,
      staleDealDays: sql<number>`COALESCE(np.stale_deal_days, 7)`,
    })
    .from(users)
    .leftJoin(
      notificationPreferences,
      eq(notificationPreferences.userId, users.id),
    );

  let totalStale = 0;

  for (const user of allUsers) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - user.staleDealDays);

    // Find open deals assigned to this user where last activity is older than cutoff
    const openDeals = await db
      .select({ id: deals.id, title: deals.title })
      .from(deals)
      .where(and(eq(deals.status, 'open'), eq(deals.assignedTo, user.userId)));

    for (const deal of openDeals) {
      // Check most recent activity for this deal
      const [lastActivity] = await db
        .select({ createdAt: activities.createdAt })
        .from(activities)
        .where(eq(activities.dealId, deal.id))
        .orderBy(sql`${activities.createdAt} DESC`)
        .limit(1);

      const isStale = !lastActivity || new Date(lastActivity.createdAt) < cutoff;

      if (!isStale) continue;

      // Check if we already sent a stale_deal notification for this deal recently
      const [existingNotif] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, user.userId),
            eq(notifications.type, 'stale_deal'),
            eq(notifications.entityId, deal.id),
            sql`${notifications.createdAt} > NOW() - INTERVAL '1 day'`,
          ),
        )
        .limit(1);

      if (existingNotif) continue;

      // Create notification
      await db.insert(notifications).values({
        userId: user.userId,
        type: 'stale_deal',
        title: `Stale deal: ${deal.title}`,
        body: `No activity in the last ${user.staleDealDays} days. Time to follow up.`,
        entityType: 'deal',
        entityId: deal.id,
      });

      totalStale++;
      console.log(`[staleDealChecker] Created stale deal notification for deal "${deal.title}" (user ${user.userId})`);
    }
  }

  console.log(`[staleDealChecker] Done. Created ${totalStale} stale deal notifications.`);
}
