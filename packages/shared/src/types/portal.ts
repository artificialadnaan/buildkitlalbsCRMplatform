export interface PortalUser {
  id: string;
  contactId: string;
  companyId: string;
  email: string;
  magicLinkToken: string | null;
  tokenExpiresAt: Date | null;
  lastLoginAt: Date | null;
}

export interface MagicLinkRequestBody {
  email: string;
}

export interface ProjectStatusView {
  id: string;
  name: string;
  type: 'website' | 'software';
  status: 'active' | 'on_hold' | 'completed';
  startDate: string | null;
  targetLaunchDate: string | null;
  milestones: MilestoneView[];
  progressPercent: number;
}

export interface MilestoneView {
  id: string;
  name: string;
  dueDate: string | null;
  status: 'pending' | 'in_progress' | 'done';
  position: number;
}

export interface MessageView {
  id: string;
  projectId: string;
  senderType: 'team' | 'client';
  senderId: string;
  senderName: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface FileView {
  id: string;
  projectId: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  requiresApproval: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  uploadedBy: string;
  createdAt: string;
  downloadUrl?: string;
}
