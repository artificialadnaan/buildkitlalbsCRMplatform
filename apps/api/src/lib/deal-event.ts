import { db, dealEvents, deals } from '@buildkit/shared';
import { eq } from 'drizzle-orm';

interface LogDealEventParams {
  dealId: string;
  type: 'stage_change' | 'status_change' | 'sms_sent' | 'call_made' | 'note_added' | 'email_sent';
  fromValue?: string;
  toValue?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export async function logDealEvent(params: LogDealEventParams) {
  await db.insert(dealEvents).values(params);
  await db.update(deals).set({ lastActivityAt: new Date() }).where(eq(deals.id, params.dealId));
}
