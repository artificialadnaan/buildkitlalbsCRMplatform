import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const statements = [
  // Deal event type enum
  `DO $$ BEGIN CREATE TYPE deal_event_type AS ENUM('stage_change','status_change','sms_sent','call_made','note_added','email_sent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // Deal events table
  `CREATE TABLE IF NOT EXISTS deal_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    type deal_event_type NOT NULL,
    from_value varchar(255),
    to_value varchar(255),
    user_id uuid REFERENCES users(id),
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,

  // New columns
  `DO $$ BEGIN ALTER TABLE deals ADD COLUMN last_activity_at timestamptz; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE pipeline_stages ADD COLUMN follow_up_days integer; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE companies ADD COLUMN prospecting_data jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE companies ADD COLUMN prospecting_status varchar(20); EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE scrape_jobs ADD COLUMN mode varchar(20) NOT NULL DEFAULT 'standard'; EXCEPTION WHEN duplicate_column THEN NULL; END $$`,
];

for (const sql of statements) {
  try {
    await client.query(sql);
    console.log('OK:', sql.slice(0, 60) + '...');
  } catch (err) {
    console.error('ERR:', err.message, '—', sql.slice(0, 60));
  }
}

await client.end();
console.log('Migration complete.');
