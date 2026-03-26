import { pgTable, uuid, varchar, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'rep']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  role: userRoleEnum('role').notNull().default('rep'),
  googleTokens: jsonb('google_tokens'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
