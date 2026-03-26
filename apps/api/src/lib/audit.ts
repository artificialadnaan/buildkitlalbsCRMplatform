import { db, auditLog } from '@buildkit/shared';

export function logAudit(params: {
  userId: string;
  action: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string;
  changes?: { before?: unknown; after?: unknown };
}) {
  // Fire-and-forget — don't block the response
  db.insert(auditLog).values(params).catch((err) => {
    console.error('[audit] Failed to log audit entry:', err);
  });
}
