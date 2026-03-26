import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '@buildkit/shared';
import { signToken } from '../src/lib/jwt.js';

// Helper to create auth headers for tests
export function authHeaders(overrides?: { userId?: string; role?: 'admin' | 'rep' }) {
  const token = signToken({
    userId: overrides?.userId || '00000000-0000-0000-0000-000000000001',
    email: 'test@buildkitlabs.com',
    role: overrides?.role || 'admin',
  });
  return { Authorization: `Bearer ${token}` };
}

// Clean test data between tests
export async function cleanDb() {
  await db.execute(sql`TRUNCATE activities, deals, contacts, companies, pipeline_stages, pipelines, users CASCADE`);
}
