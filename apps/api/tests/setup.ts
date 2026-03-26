import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, milestoneTemplates, milestoneTemplateItems } from '@buildkit/shared';
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
  await db.execute(sql`TRUNCATE time_entries, tasks, milestones, projects, portal_users, milestone_template_items, milestone_templates, email_sends, sequence_enrollments, sequence_steps, email_sequences, email_templates, activities, deals, contacts, companies, pipeline_stages, pipelines, users CASCADE`);
}

export async function seedMilestoneTemplates() {
  const [websiteTemplate] = await db.insert(milestoneTemplates).values({
    name: 'Website Project',
    projectType: 'website',
  }).returning();

  await db.insert(milestoneTemplateItems).values([
    { templateId: websiteTemplate.id, name: 'Discovery', position: 1 },
    { templateId: websiteTemplate.id, name: 'Design', position: 2 },
    { templateId: websiteTemplate.id, name: 'Development', position: 3 },
    { templateId: websiteTemplate.id, name: 'Launch', position: 4 },
  ]);

  const [softwareTemplate] = await db.insert(milestoneTemplates).values({
    name: 'Software Project',
    projectType: 'software',
  }).returning();

  await db.insert(milestoneTemplateItems).values([
    { templateId: softwareTemplate.id, name: 'Discovery', position: 1 },
    { templateId: softwareTemplate.id, name: 'Architecture', position: 2 },
    { templateId: softwareTemplate.id, name: 'Development', position: 3 },
    { templateId: softwareTemplate.id, name: 'Testing', position: 4 },
    { templateId: softwareTemplate.id, name: 'Staging', position: 5 },
    { templateId: softwareTemplate.id, name: 'Launch', position: 6 },
  ]);
}
