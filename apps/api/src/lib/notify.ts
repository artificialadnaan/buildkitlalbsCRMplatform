import { db, notifications, users } from '@buildkit/shared';
import { eq } from 'drizzle-orm';

interface NotifyParams {
  userId?: string;
  allAdmins?: boolean;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

export async function notify(params: NotifyParams) {
  const userIds: string[] = [];
  if (params.userId) userIds.push(params.userId);
  if (params.allAdmins) {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
    userIds.push(...admins.map((a) => a.id));
  }

  for (const userId of [...new Set(userIds)]) {
    await db.insert(notifications).values({
      userId,
      type: params.type as any,
      title: params.title,
      body: params.body,
      entityType: params.entityType,
      entityId: params.entityId,
    });
  }
}
