import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import Badge, { type BadgeVariant } from '../components/ui/Badge.js';
import DataTable, { type Column } from '../components/ui/DataTable.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';

interface EnrolledLead {
  id: string;
  companyName: string;
  email: string;
  score: number;
  enrolledAt: string;
  replied: boolean;
}

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  industry: string;
  zipCodes: string[];
  scrapedCount: number;
  auditedCount: number;
  enrolledCount: number;
  replyCount: number;
  avgScore: number;
  createdAt: string;
  completedAt: string | null;
  enrolledLeads?: EnrolledLead[];
}

const statusVariant: Record<string, BadgeVariant> = {
  scraping: 'blue',
  auditing: 'amber',
  scoring: 'purple',
  enrolling: 'blue',
  active: 'green',
  completed: 'gray',
  failed: 'red',
};

const PHASES = ['Scraping', 'Auditing', 'Scoring', 'Enrolling', 'Active'];

function phaseIndex(status: string): number {
  const map: Record<string, number> = {
    scraping: 0,
    auditing: 1,
    scoring: 2,
    enrolling: 3,
    active: 4,
    completed: 4,
  };
  return map[status] ?? -1;
}

export default function OutreachDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<CampaignDetail>(`/api/outreach/${id}`)
      .then(setCampaign)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCancel() {
    if (!id || !confirm('Cancel this campaign? This cannot be undone.')) return;
    setCancelling(true);
    try {
      await api(`/api/outreach/${id}`, { method: 'DELETE' });
      navigate('/outreach');
    } catch (err) {
      console.error('Failed to cancel campaign:', err);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!campaign) {
    return (
      <div>
        <TopBar title="Campaign Not Found" />
        <div className="p-6 text-sm text-gray-500">Campaign not found.</div>
      </div>
    );
  }

  const currentPhase = phaseIndex(campaign.status);

  const leadColumns: Column<EnrolledLead>[] = [
    { key: 'companyName', label: 'Company' },
    { key: 'email', label: 'Email' },
    {
      key: 'score',
      label: 'Score',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 text-sm font-medium ${
            row.score >= 70 ? 'text-emerald-600' : row.score >= 40 ? 'text-amber-600' : 'text-gray-500'
          }`}
        >
          {row.score}
        </span>
      ),
    },
    {
      key: 'enrolledAt',
      label: 'Enrolled',
      render: (row) => new Date(row.enrolledAt).toLocaleDateString(),
    },
    {
      key: 'replied',
      label: 'Replied',
      render: (row) =>
        row.replied ? (
          <Badge label="Yes" variant="green" />
        ) : (
          <Badge label="No" variant="gray" />
        ),
    },
  ];

  return (
    <div>
      <TopBar
        title={campaign.name}
        subtitle={`Created ${new Date(campaign.createdAt).toLocaleDateString()}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge label={campaign.status} variant={statusVariant[campaign.status] ?? 'gray'} />
            {campaign.status !== 'completed' && campaign.status !== 'failed' && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Campaign'}
              </button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard label="Scraped" value={String(campaign.scrapedCount)} />
          <StatCard label="Audited" value={String(campaign.auditedCount)} />
          <StatCard label="Enrolled" value={String(campaign.enrolledCount)} />
          <StatCard label="Replies" value={String(campaign.replyCount)} />
          <StatCard label="Avg Score" value={campaign.avgScore != null ? campaign.avgScore.toFixed(1) : '--'} />
        </div>

        {/* Phase progress */}
        {campaign.status !== 'failed' && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Campaign Progress</h2>
            <div className="flex items-center">
              {PHASES.map((phase, i) => (
                <div key={phase} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold border-2 ${
                        i < currentPhase
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : i === currentPhase
                          ? 'border-blue-600 bg-white text-blue-600'
                          : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {i < currentPhase ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`mt-1 text-xs font-medium whitespace-nowrap ${
                        i === currentPhase ? 'text-blue-600' : i < currentPhase ? 'text-gray-700' : 'text-gray-400'
                      }`}
                    >
                      {phase}
                    </span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 mb-5 ${i < currentPhase ? 'bg-blue-600' : 'bg-gray-200'}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enrolled leads table */}
        {campaign.enrolledLeads && campaign.enrolledLeads.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Enrolled Leads</h2>
            <DataTable<EnrolledLead>
              columns={leadColumns}
              data={campaign.enrolledLeads}
            />
          </div>
        )}

        {/* Campaign metadata */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-4">
              <dt className="w-32 shrink-0 font-medium text-gray-500">Industry</dt>
              <dd className="text-gray-900">{campaign.industry ?? '--'}</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-32 shrink-0 font-medium text-gray-500">Zip Codes</dt>
              <dd className="text-gray-900">{campaign.zipCodes?.join(', ') ?? '--'}</dd>
            </div>
            {campaign.completedAt && (
              <div className="flex gap-4">
                <dt className="w-32 shrink-0 font-medium text-gray-500">Completed</dt>
                <dd className="text-gray-900">{new Date(campaign.completedAt).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
