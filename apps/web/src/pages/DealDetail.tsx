import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatCurrency, formatDate, formatRelativeTime } from '../lib/format.js';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import ActivityItem from '../components/ui/ActivityItem.js';
import Modal from '../components/ui/Modal.js';

interface DealResult {
  deal: {
    id: string;
    title: string;
    value: number | null;
    status: 'open' | 'won' | 'lost';
    stageId: string;
    companyId: string;
    contactId: string | null;
    assignedTo: string | null;
    expectedCloseDate: string | null;
    closedAt: string | null;
    createdAt: string;
  };
  companyName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  stageName: string | null;
}

interface Activity {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  createdAt: string;
  dealId: string | null;
  userId: string;
}

interface ActivitiesResponse {
  data: Activity[];
}

const statusVariants: Record<string, 'blue' | 'green' | 'red'> = {
  open: 'blue',
  won: 'green',
  lost: 'red',
};

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<DealResult | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activityType, setActivityType] = useState<string>('note');
  const [activitySubject, setActivitySubject] = useState('');
  const [activityBody, setActivityBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    if (!id) return;
    api<DealResult>(`/api/deals/${id}`).then(setResult).catch(console.error);
    api<ActivitiesResponse>(`/api/activities?dealId=${id}`).then((res) => setActivities(res.data)).catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleLogActivity = async () => {
    if (!id || !activitySubject.trim()) return;
    setSubmitting(true);
    try {
      await api('/api/activities', {
        method: 'POST',
        body: JSON.stringify({
          dealId: id,
          type: activityType,
          subject: activitySubject,
          body: activityBody || null,
        }),
      });
      setModalOpen(false);
      setActivitySubject('');
      setActivityBody('');
      setActivityType('note');
      loadData();
    } catch (err) {
      console.error('Failed to log activity:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (status: 'won' | 'lost') => {
    if (!id) return;
    try {
      await api(`/api/deals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      loadData();
    } catch (err) {
      console.error('Failed to update deal status:', err);
    }
  };

  if (!result) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const { deal } = result;

  const infoFields = [
    { label: 'Status', value: <Badge label={deal.status} variant={statusVariants[deal.status] ?? 'gray'} /> },
    { label: 'Stage', value: result.stageName ?? '--' },
    { label: 'Value', value: formatCurrency(deal.value) },
    { label: 'Contact', value: result.contactName ?? '--' },
    { label: 'Close Date', value: formatDate(deal.expectedCloseDate) },
    { label: 'Created', value: formatDate(deal.createdAt) },
  ];

  return (
    <div>
      <TopBar
        title={deal.title}
        subtitle={result.companyName ?? undefined}
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            Log Activity
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        {/* Deal Info */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Deal Information
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {infoFields.map((field) => (
              <div key={field.label}>
                <p className="text-xs font-medium uppercase text-gray-500">{field.label}</p>
                <div className="mt-1 text-sm text-gray-200">{field.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Quick Actions
          </h2>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="w-full rounded-lg border border-border bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Send Email
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="w-full rounded-lg border border-border bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Move Stage
            </button>
            {deal.status === 'open' && (
              <>
                <button
                  onClick={() => handleStatusChange('won')}
                  className="w-full rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-4 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
                >
                  Mark Won
                </button>
                <button
                  onClick={() => handleStatusChange('lost')}
                  className="w-full rounded-lg bg-red-600/20 border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/30"
                >
                  Mark Lost
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="px-6 pb-6">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Activity Timeline
          </h2>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No activities yet</p>
          ) : (
            <div className="divide-y divide-border">
              {activities.map((a) => (
                <ActivityItem
                  key={a.id}
                  type={a.type}
                  description={a.subject ?? `${a.type} logged`}
                  meta={formatRelativeTime(a.createdAt)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log Activity Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Activity">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Type</label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="note">Note</option>
              <option value="email">Email</option>
              <option value="call">Call</option>
              <option value="text">Text</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Subject</label>
            <input
              type="text"
              value={activitySubject}
              onChange={(e) => setActivitySubject(e.target.value)}
              placeholder="Activity subject..."
              className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Details</label>
            <textarea
              value={activityBody}
              onChange={(e) => setActivityBody(e.target.value)}
              placeholder="Additional details..."
              rows={3}
              className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-border bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleLogActivity}
              disabled={submitting || !activitySubject.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Activity'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
