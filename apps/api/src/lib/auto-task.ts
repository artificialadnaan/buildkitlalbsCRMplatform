import { eq } from 'drizzle-orm';
import { db, tasks, deals } from '@buildkit/shared';

export async function createFollowUpTask(opts: {
  dealId?: string;
  assignedTo?: string;
  title: string;
  description?: string;
  source: 'system';
  priority?: 'low' | 'medium' | 'high';
}): Promise<void> {
  let assignedTo = opts.assignedTo ?? null;

  // If no assignedTo provided but dealId is given, look up deal.assignedTo
  if (!assignedTo && opts.dealId) {
    const [deal] = await db
      .select({ assignedTo: deals.assignedTo })
      .from(deals)
      .where(eq(deals.id, opts.dealId))
      .limit(1);
    assignedTo = deal?.assignedTo ?? null;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD

  await db.insert(tasks).values({
    dealId: opts.dealId ?? null,
    assignedTo: assignedTo ?? undefined,
    title: opts.title,
    description: opts.description ?? null,
    source: opts.source,
    priority: opts.priority ?? 'medium',
    status: 'todo',
    dueDate: dueDateStr,
  });

  console.log(`[auto-task] Created task: "${opts.title}" (dealId=${opts.dealId ?? 'none'}, assignedTo=${assignedTo ?? 'unassigned'})`);
}
