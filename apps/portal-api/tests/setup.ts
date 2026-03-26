import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '@buildkit/shared';

// Clean portal-related test data between tests
export async function cleanPortalDb() {
  await db.execute(sql`TRUNCATE messages, files, invoices, portal_users, milestones, tasks, time_entries, projects CASCADE`);
}

// Helper to create a session header for authenticated portal requests
export function portalSessionHeader(sessionId: string) {
  return { 'x-portal-session': sessionId };
}
