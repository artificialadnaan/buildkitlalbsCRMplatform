ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "assigned_to" uuid REFERENCES "users"("id");
