import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import DataTable, { type Column } from '../components/ui/DataTable.js';
import Badge, { type BadgeVariant } from '../components/ui/Badge.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';

interface Campaign {
  id: string;
  name: string;
  status: string;
  scrapedCount: number;
  auditedCount: number;
  enrolledCount: number;
  replyCount: number;
  createdAt: string;
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

export default function OutreachCampaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: Campaign[] } | Campaign[]>('/api/outreach')
      .then(r => setCampaigns(Array.isArray(r) ? r : r.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<Campaign>[] = [
    { key: 'name', label: 'Name' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge label={row.status} variant={statusVariant[row.status] ?? 'gray'} />
      ),
    },
    {
      key: 'scrapedCount',
      label: 'Scraped',
      render: (row) => String(row.scrapedCount ?? 0),
    },
    {
      key: 'auditedCount',
      label: 'Audited',
      render: (row) => String(row.auditedCount ?? 0),
    },
    {
      key: 'enrolledCount',
      label: 'Enrolled',
      render: (row) => String(row.enrolledCount ?? 0),
    },
    {
      key: 'replyCount',
      label: 'Replies',
      render: (row) => String(row.replyCount ?? 0),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <TopBar
        title="Outreach Campaigns"
        subtitle="Autonomous lead outreach"
        actions={
          <button
            onClick={() => navigate('/outreach/new')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            + New Campaign
          </button>
        }
      />
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="p-6">
          <DataTable<Campaign>
            columns={columns}
            data={campaigns}
            onRowClick={(row) => navigate(`/outreach/${row.id}`)}
            emptyMessage="No campaigns yet — launch your first outreach campaign"
            emptyAction={{ label: 'New Campaign', onClick: () => navigate('/outreach/new') }}
          />
        </div>
      )}
    </div>
  );
}
