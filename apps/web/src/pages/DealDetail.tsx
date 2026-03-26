import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatCurrency, formatDate, formatRelativeTime } from '../lib/format.js';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import ActivityItem from '../components/ui/ActivityItem.js';
import Modal from '../components/ui/Modal.js';
import ComposeEmailModal from '../components/email/ComposeEmailModal.js';
import EnrollSequenceModal from '../components/email/EnrollSequenceModal.js';

interface DealResult {
  deal: {
    id: string;
    title: string;
    value: number | null;
    status: 'open' | 'won' | 'lost';
    stageId: string;
    pipelineId: string;
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

interface StageOption {
  id: string;
  name: string;
  position: number;
  pipelineId: string;
}

interface PipelineWithStages {
  id: string;
  name: string;
  stages: StageOption[];
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

interface EmailSend {
  id: string;
  subject: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

interface EmailSendsResponse {
  data: EmailSend[];
  total: number;
}

interface EmailEventsSummary {
  openCount: number;
  clickCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
}

interface EmailEventsResponse {
  summary: EmailEventsSummary;
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
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<StageOption[]>([]);
  const [stageChanging, setStageChanging] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [emailSends, setEmailSends] = useState<EmailSend[]>([]);
  const [emailStats, setEmailStats] = useState<Record<string, EmailEventsSummary>>({});

  const loadEmailTracking = (dealId: string) => {
    api<EmailSendsResponse>(`/api/email-sends?dealId=${dealId}`).then(async (res) => {
      setEmailSends(res.data);
      const stats: Record<string, EmailEventsSummary> = {};
      await Promise.all(
        res.data
          .filter((s) => s.status === 'sent')
          .map(async (s) => {
            try {
              const evts = await api<EmailEventsResponse>(`/api/email-sends/${s.id}/events`);
              stats[s.id] = evts.summary;
            } catch {
              // tracking data may not exist yet
            }
          })
      );
      setEmailStats(stats);
    }).catch(console.error);
  };

  const loadData = () => {
    if (!id) return;
    api<DealResult>(`/api/deals/${id}`).then((r) => {
      setResult(r);
      // Load pipeline stages for stage selector
      api<PipelineWithStages[]>('/api/pipelines').then((pipelines) => {
        const pipeline = pipelines.find((p) => p.id === r.deal.pipelineId);
        if (pipeline) {
          setPipelineStages(pipeline.stages);
        }
      }).catch(console.error);
    }).catch(console.error);
    api<ActivitiesResponse>(`/api/activities?dealId=${id}`).then((res) => setActivities(res.data)).catch(console.error);
    loadEmailTracking(id);
  };

  const handleStageChange = async (stageId: string) => {
    if (!id || !stageId) return;
    setStageChanging(true);
    try {
      await api(`/api/deals/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stageId }),
      });
      setShowStageModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to change stage:', err);
    } finally {
      setStageChanging(false);
    }
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
    { label: 'Value', value: formatCurrency(deal.value) },
    {
      label: 'Stage',
      value: pipelineStages.length > 0 ? (
        <select
          value={deal.stageId}
          onChange={(e) => handleStageChange(e.target.value)}
          disabled={stageChanging}
          className="rounded-md border border-border bg-white px-2 py-1 text-sm text-gray-900 focus:border-brand-500 focus:outline-none disabled:opacity-50"
        >
          {pipelineStages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      ) : (
        result.stageName ?? '--'
      ),
    },
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
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            Log Activity
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        {/* Deal Info */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Deal Information
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {infoFields.map((field) => (
              <div key={field.label}>
                <p className="text-xs font-medium uppercase text-gray-500">{field.label}</p>
                <div className="mt-1 text-sm text-gray-900">{field.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Quick Actions
          </h2>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowEmailModal(true)}
              className="w-full rounded-lg border border-border bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Send Email
            </button>
            <button
              onClick={() => setShowSequenceModal(true)}
              className="w-full rounded-lg border border-border bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Start Sequence
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="w-full rounded-lg border border-border bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Log Activity
            </button>
            <button
              onClick={() => {
                setSelectedStageId(deal.stageId);
                setShowStageModal(true);
              }}
              className="w-full rounded-lg border border-border bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Move Stage
            </button>
            {deal.status === 'open' && (
              <>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => handleStatusChange('won')}
                  className="w-full rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-100"
                >
                  Mark Won
                </button>
                <button
                  onClick={() => handleStatusChange('lost')}
                  className="w-full rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
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
          <h2 className="mb-3 text-base font-semibold text-gray-900">
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

      {/* Email Tracking */}
      {emailSends.length > 0 && (
        <div className="px-6 pb-6">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-3 text-base font-semibold text-gray-900">
              Email Tracking
            </h2>
            <div className="divide-y divide-border">
              {emailSends.map((send) => {
                const stats = emailStats[send.id];
                return (
                  <div key={send.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {send.subject || '(no subject)'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {send.status === 'sent' ? `Sent ${formatRelativeTime(send.sentAt || send.createdAt)}` : send.status}
                      </p>
                    </div>
                    {send.status === 'sent' && stats ? (
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${stats.openCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {stats.openCount > 0 ? `Opened ${stats.openCount}x` : 'Not opened'}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${stats.clickCount > 0 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                          </svg>
                          {stats.clickCount > 0 ? `${stats.clickCount} clicks` : 'No clicks'}
                        </span>
                      </div>
                    ) : send.status === 'sent' ? (
                      <span className="text-xs text-gray-400 ml-4">Loading...</span>
                    ) : (
                      <Badge label={send.status} variant={send.status === 'failed' ? 'red' : 'amber'} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Move Stage Modal */}
      <Modal open={showStageModal} onClose={() => setShowStageModal(false)} title="Move Stage">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Select Stage</label>
            <select
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none"
            >
              {pipelineStages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowStageModal(false)}
              className="rounded-lg border border-border bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => handleStageChange(selectedStageId)}
              disabled={stageChanging || selectedStageId === deal.stageId}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stageChanging ? 'Moving...' : 'Move'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Log Activity Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Activity">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Type</label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none"
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
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Details</label>
            <textarea
              value={activityBody}
              onChange={(e) => setActivityBody(e.target.value)}
              placeholder="Additional details..."
              rows={3}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-border bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleLogActivity}
              disabled={submitting || !activitySubject.trim()}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Activity'}
            </button>
          </div>
        </div>
      </Modal>

      <ComposeEmailModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        dealId={deal.id}
        contactId={deal.contactId || ''}
        contactName={result.contactName || 'Unknown'}
        contactEmail={result.contactEmail || ''}
        onSent={() => {
          api<ActivitiesResponse>(`/api/activities?dealId=${id}`).then((res) => setActivities(res.data));
        }}
      />
      <EnrollSequenceModal
        open={showSequenceModal}
        onClose={() => setShowSequenceModal(false)}
        dealId={deal.id}
        contactId={deal.contactId || ''}
        onEnrolled={() => {
          api<ActivitiesResponse>(`/api/activities?dealId=${id}`).then((res) => setActivities(res.data));
        }}
      />
    </div>
  );
}
