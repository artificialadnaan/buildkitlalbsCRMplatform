export type UserRole = 'admin' | 'rep';
export type CompanyType = 'local' | 'construction';
export type CompanySource = 'scraped' | 'manual';
export type DealStatus = 'open' | 'won' | 'lost';
export type ActivityType = 'email' | 'call' | 'text' | 'note' | 'meeting';

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export type PipelineType = 'local' | 'construction';
export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type PausedReason = 'reply_received' | 'manual';
export type EmailSendStatus = 'queued' | 'sent' | 'failed';

export interface TemplateVariables {
  'contact.first_name': string;
  'contact.last_name': string;
  'contact.email': string;
  'company.name': string;
  'company.website': string;
  'company.city': string;
  'company.industry': string;
  'user.name': string;
  'user.email': string;
}

export interface EmailJobPayload {
  emailSendId: string;
  userId: string;
}

export interface SequenceTickPayload {
  enrollmentId: string;
}

export interface GmailSyncPayload {
  userId: string;
}
