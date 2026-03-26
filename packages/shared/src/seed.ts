import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pipelines, pipelineStages } from './schema/index.js';

async function seed() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // Seed Local Business pipeline
  const [localPipeline] = await db.insert(pipelines).values({
    name: 'Local Business',
    description: 'Web development services for local businesses',
  }).returning();

  const localStages = [
    { name: 'New Lead', position: 1, color: '#6b7280' },
    { name: 'Contacted', position: 2, color: '#3b82f6' },
    { name: 'Audit Sent', position: 3, color: '#8b5cf6' },
    { name: 'Proposal Sent', position: 4, color: '#f59e0b' },
    { name: 'Negotiation', position: 5, color: '#f97316' },
    { name: 'Won', position: 6, color: '#22c55e' },
  ];

  await db.insert(pipelineStages).values(
    localStages.map(s => ({ ...s, pipelineId: localPipeline.id }))
  );

  // Seed Construction pipeline
  const [constructionPipeline] = await db.insert(pipelines).values({
    name: 'Construction',
    description: 'Custom software development for construction companies',
  }).returning();

  const constructionStages = [
    { name: 'Identified', position: 1, color: '#6b7280' },
    { name: 'Touch 1 Sent', position: 2, color: '#3b82f6' },
    { name: 'Touch 2 Sent', position: 3, color: '#6366f1' },
    { name: 'Touch 3 Sent', position: 4, color: '#8b5cf6' },
    { name: 'Meeting Booked', position: 5, color: '#f59e0b' },
    { name: 'Discovery', position: 6, color: '#f97316' },
    { name: 'Proposal', position: 7, color: '#ef4444' },
    { name: 'Won', position: 8, color: '#22c55e' },
  ];

  await db.insert(pipelineStages).values(
    constructionStages.map(s => ({ ...s, pipelineId: constructionPipeline.id }))
  );

  console.log('Seeded pipelines:');
  console.log(`  Local Business (${localStages.length} stages)`);
  console.log(`  Construction (${constructionStages.length} stages)`);

  await pool.end();
}

seed().catch(console.error);
