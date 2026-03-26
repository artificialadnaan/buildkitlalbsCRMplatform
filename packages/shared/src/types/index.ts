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

export type ScrapeJobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface ScrapeJobInput {
  zipCodes: string[];
  searchQuery: string;
  startedBy: string;
}

export type ProjectType = 'website' | 'software';
export type ProjectStatus = 'active' | 'on_hold' | 'completed';
export type MilestoneStatus = 'pending' | 'in_progress' | 'done';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

// Website Audit types
export interface WebsiteAuditChecks {
  loadTimeMs: number;
  isHttps: boolean;
  hasMobileViewport: boolean;
  hasTitle: boolean;
  titleText: string | null;
  hasMetaDescription: boolean;
  metaDescription: string | null;
  hasOgTags: boolean;
  brokenImageCount: number;
  totalImageCount: number;
  copyrightYear: number | null;
  hasContactForm: boolean;
  hasH1: boolean;
  h1Text: string | null;
  hasRobotsTxt: boolean;
  pagesCrawled: string[];
}

export interface WebsiteAudit {
  score: number;
  findings: string;
  checks: WebsiteAuditChecks;
  auditedAt: string;
}

// Call Prep types
export interface CallPrep {
  companyOverview: {
    name: string;
    industry: string | null;
    location: string;
    website: string | null;
    googleRating: number | null;
    employeeCount: number | null;
  };
  websiteFindings: string | null;
  websiteScore: number | null;
  talkingPoints: string[];
  estimatedScope: {
    description: string;
    lowEstimate: number;
    highEstimate: number;
  } | null;
  recentActivity: Array<{
    type: string;
    subject: string;
    date: string;
  }>;
  generatedAt: string;
}

// Outreach Campaign types
export type CampaignStatus = 'scraping' | 'auditing' | 'scoring' | 'enrolling' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface CampaignStats {
  totalScraped: number;
  totalAudited: number;
  totalEnrolled: number;
  totalReplies: number;
  avgScore: number;
  topScoreCompany: string;
}

export interface OutreachPipelineJobData {
  campaignId: string;
  phase: 'audit' | 'score' | 'enroll';
}

// Notification types
export type NotificationType = 'stale_deal' | 'hot_lead' | 'sequence_digest' | 'task_due' | 'milestone_completed' | 'reply_received' | 'campaign_update';

// Change Request types
export type ChangeRequestStatus = 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'completed';

// Report types
export type ReportType = 'client_monthly' | 'sales_performance' | 'roi';
export type ReportFrequency = 'weekly' | 'monthly';

// Website Audit job
export interface WebsiteAuditJobData {
  companyId: string;
  url: string;
  campaignId?: string;
}

// Notification job
export interface NotificationJobData {
  type: NotificationType;
  userId: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

// Report job
export interface ReportJobData {
  projectId: string;
  type: ReportType;
}

// Search result
export interface SearchResult {
  type: 'company' | 'contact' | 'deal' | 'project';
  id: string;
  title: string;
  subtitle?: string;
}

// Timeline event
export interface TimelineEvent {
  id: string;
  type: 'activity' | 'email_sent' | 'email_opened' | 'email_clicked' | 'deal_created' | 'deal_stage_changed' | 'deal_won' | 'deal_lost' | 'project_created' | 'milestone_completed';
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export * from './portal.js';
export * from './invoices.js';
