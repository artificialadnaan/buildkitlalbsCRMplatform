import { db, tasks, notifications } from '@buildkit/shared';
import { sql } from 'drizzle-orm';

export async function checkFollowUpReminders(): Promise<void> {
  console.log('[follow-up] Checking for stale deals...');

  const staleDeals = await db.execute(sql`
    SELECT d.id, d.title, d.assigned_to, ps.name AS stage_name, ps.follow_up_days,
           d.last_activity_at
    FROM deals d
    INNER JOIN pipeline_stages ps ON d.stage_id = ps.id
    WHERE d.status = 'open'
      AND ps.follow_up_days IS NOT NULL
      AND ps.follow_up_days > 0
      AND (d.last_activity_at IS NULL OR d.last_activity_at < NOW() - (ps.follow_up_days || ' days')::interval)
      AND NOT EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.deal_id = d.id
          AND t.title LIKE 'No activity on%'
          AND t.status != 'done'
      )
  `);

  for (const deal of staleDeals.rows as any[]) {
    const daysSinceActivity = deal.last_activity_at
      ? Math.floor((Date.now() - new Date(deal.last_activity_at).getTime()) / (1000 * 60 * 60 * 24))
      : deal.follow_up_days;

    await db.insert(tasks).values({
      dealId: deal.id,
      title: `No activity on ${deal.title} for ${daysSinceActivity} days — follow up?`,
      status: 'todo',
      priority: 'high',
      assignedTo: deal.assigned_to,
    });

    if (deal.assigned_to) {
      await db.insert(notifications).values({
        userId: deal.assigned_to,
        type: 'stale_deal',
        title: `Follow-up reminder: ${deal.title}`,
        body: `This deal has been in "${deal.stage_name}" for ${daysSinceActivity} days with no activity.`,
        entityType: 'deal',
        entityId: deal.id,
      });
    }
  }

  console.log(`[follow-up] Created reminders for ${staleDeals.rows.length} stale deals`);
}
