import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';

interface Deal {
  id: string;
  stage?: { name: string } | null;
  lastActivityAt?: string | null;
}

interface Enrollment {
  id: string;
  status?: string;
}

interface Company {
  id: string;
  website?: string | null;
  websiteAudit?: { score: number } | null;
}

interface ContextualActionButtonProps {
  company: Company;
  deal?: Deal;
  enrollment?: Enrollment;
}

type ActionConfig = {
  label: string;
  urgency: 'high' | 'normal' | 'low';
  onClick: () => void;
};

const DISCOVERY_STAGES = ['discovery', 'prospect', 'qualified', 'initial contact', 'outreach'];

function isStale(lastActivityAt: string | null | undefined): boolean {
  if (!lastActivityAt) return true;
  const diff = Date.now() - new Date(lastActivityAt).getTime();
  return diff > 7 * 24 * 60 * 60 * 1000;
}

function isDiscoveryStage(stageName: string | null | undefined): boolean {
  if (!stageName) return false;
  return DISCOVERY_STAGES.some((s) => stageName.toLowerCase().includes(s));
}

export default function ContextualActionButton({ company, deal, enrollment }: ContextualActionButtonProps) {
  const navigate = useNavigate();

  function getAction(): ActionConfig {
    // No audit + has website → run audit
    if (!company.websiteAudit && company.website) {
      return {
        label: 'Run Website Audit',
        urgency: 'normal',
        onClick: async () => {
          try {
            await api(`/api/companies/${company.id}/audit`, { method: 'POST' });
          } catch (err) {
            console.error('Audit failed:', err);
          }
        },
      };
    }

    // No deals → create deal
    if (!deal) {
      return {
        label: 'Create Deal',
        urgency: 'normal',
        onClick: () => navigate(`/pipelines?companyId=${company.id}`),
      };
    }

    // Deal exists, no enrollment → enroll in sequence
    if (!enrollment) {
      return {
        label: 'Enroll in Sequence',
        urgency: 'normal',
        onClick: () => navigate(`/leads/${company.id}`),
      };
    }

    // Enrollment paused by reply → follow up
    if (enrollment.status === 'paused_by_reply') {
      return {
        label: 'Follow Up',
        urgency: 'high',
        onClick: () => navigate(`/deals/${deal.id}`),
      };
    }

    // Stale deal (no activity in 7+ days) → log activity
    if (isStale(deal.lastActivityAt as string | null)) {
      return {
        label: 'Log Activity',
        urgency: 'high',
        onClick: () => navigate(`/deals/${deal.id}`),
      };
    }

    // Discovery stage → view call prep
    if (isDiscoveryStage(deal.stage?.name)) {
      return {
        label: 'View Call Prep',
        urgency: 'normal',
        onClick: () => navigate(`/deals/${deal.id}/call-prep`),
      };
    }

    // Default → view details
    return {
      label: 'View Details',
      urgency: 'low',
      onClick: () => navigate(`/leads/${company.id}`),
    };
  }

  const action = getAction();

  const colorClass =
    action.urgency === 'high'
      ? 'bg-amber-500 text-white hover:bg-amber-400'
      : action.urgency === 'normal'
        ? 'bg-blue-600 text-white hover:bg-blue-500'
        : 'bg-gray-100 text-gray-700 border border-border hover:bg-gray-200';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        action.onClick();
      }}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${colorClass}`}
    >
      {action.label}
    </button>
  );
}
