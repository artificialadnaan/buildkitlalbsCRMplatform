import 'dotenv/config';
import { db } from '@buildkit/shared';
import { sql } from 'drizzle-orm';
import { createApp } from './app.js';

async function runMigrations() {
  const statements = [
    `DO $$ BEGIN CREATE TYPE deal_event_type AS ENUM('stage_change','status_change','sms_sent','call_made','note_added','email_sent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `CREATE TABLE IF NOT EXISTS deal_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE, type deal_event_type NOT NULL, from_value varchar(255), to_value varchar(255), user_id uuid REFERENCES users(id), metadata jsonb, created_at timestamptz NOT NULL DEFAULT now())`,
    `DO $$ BEGIN ALTER TABLE deals ADD COLUMN last_activity_at timestamptz; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE pipeline_stages ADD COLUMN follow_up_days integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE companies ADD COLUMN prospecting_data jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE companies ADD COLUMN prospecting_status varchar(20); EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
    `DO $$ BEGIN ALTER TABLE scrape_jobs ADD COLUMN mode varchar(20) NOT NULL DEFAULT 'standard'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  ];
  for (const stmt of statements) {
    try { await db.execute(sql.raw(stmt)); } catch (e) { console.warn('[migrate]', (e as Error).message); }
  }
  console.log('[migrate] Schema up to date');
}

const app = createApp();
const PORT = process.env.PORT || 3001;

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`BuildKit CRM API running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('[migrate] Failed:', err);
  app.listen(PORT, () => {
    console.log(`BuildKit CRM API running on port ${PORT} (migration failed)`);
  });
});
