import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatCurrency, formatDate, formatRelativeTime } from '../lib/format.js';
import TopBar from '../components/layout/TopBar.js';
import Modal from '../components/ui/Modal.js';
import ComposeEmailModal from '../components/email/ComposeEmailModal.js';
import EnrollSequenceModal from '../components/email/EnrollSequenceModal.js';
import SendSmsModal from '../components/ui/SendSmsModal.js';
import ClickToCall from '../components/ui/ClickToCall.js';

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
  contactPhone: string | null;
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

interface DealEvent {
  id: string;
  type: string;
  fromValue: string | null;
  toValue: string | null;
  userName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const statusLabels: Record<string, { text: string; bg: string; border: string }> = {
  open: { text: 'IN PROGRESS', bg: 'bg-orange-100 text-orange-700', border: 'border-orange-600' },
  won: { text: 'WON', bg: 'bg-green-100 text-green-700', border: 'border-green-600' },
  lost: { text: 'LOST', bg: 'bg-red-100 text-red-700', border: 'border-red-600' },
};

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<DealResult | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pipelineName, setPipelineName] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [activityType, setActivityType] = useState<string>('note');
  const [activitySubject, setActivitySubject] = useState('');
  const [activityBody, setActivityBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<StageOption[]>([]);
  const [stageChanging, setStageChanging] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [emailSends, setEmailSends] = useState<EmailSend[]>([]);
  const [emailStats, setEmailStats] = useState<Record<string, EmailEventsSummary>>({});
  const [events, setEvents] = useState<DealEvent[]>([]);

  const loadEmailTracking = (dealId: string) => {
    api<EmailSendsResponse>(`/api/email-sends?dealId=${dealId}`).then(async (res) => {
      setEmailSends(res.data);
      const stats: Record<string, EmailEventsSummary> = {};
      await Promise.all(
        res.data.filter((s) => s.status === 'sent').map(async (s) => {
          try {
            const evts = await api<EmailEventsResponse>(`/api/email-sends/${s.id}/events`);
            stats[s.id] = evts.summary;
          } catch { /* tracking data may not exist */ }
        })
      );
      setEmailStats(stats);
    }).catch(console.error);
  };

  const loadData = () => {
    if (!id) return;
    api<DealResult>(`/api/deals/${id}`).then((r) => {
      setResult(r);
      api<PipelineWithStages[]>('/api/pipelines').then((pipelines) => {
        const pipeline = pipelines.find((p) => p.id === r.deal.pipelineId);
        if (pipeline) {
          setPipelineStages(pipeline.stages);
          setPipelineName(pipeline.name);
        }
      }).catch(console.error);
    }).catch(console.error);
    api<ActivitiesResponse>(`/api/activities?dealId=${id}`).then((res) => setActivities(res.data)).catch(console.error);
    api<{ data: DealEvent[] }>(`/api/deals/${id}/events?limit=20`).then((r) => setEvents(r.data)).catch(console.error);
    loadEmailTracking(id);
  };

  const handleStageChange = async (stageId: string) => {
    if (!id || !stageId) return;
    setStageChanging(true);
    try {
      await api(`/api/deals/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stageId }) });
      setShowStageModal(false);
      loadData();
    } catch (err) { console.error('Failed to change stage:', err); }
    finally { setStageChanging(false); }
  };

  useEffect(() => { loadData(); }, [id]);

  const handleLogActivity = async () => {
    if (!id || !activitySubject.trim()) return;
    setSubmitting(true);
    try {
      await api('/api/activities', {
        method: 'POST',
        body: JSON.stringify({ dealId: id, type: activityType, subject: activitySubject, body: activityBody || null }),
      });
      setModalOpen(false);
      setActivitySubject('');
      setActivityBody('');
      setActivityType('note');
      loadData();
    } catch (err) { console.error('Failed to log activity:', err); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (status: 'won' | 'lost') => {
    if (!id) return;
    try {
      await api(`/api/deals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      loadData();
    } catch (err) { console.error('Failed to update deal status:', err); }
  };

  if (!result) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  const { deal } = result;
  const statusStyle = statusLabels[deal.status] ?? statusLabels.open;
  const currentStage = pipelineStages.find(s => s.id === deal.stageId);
  const stageProgress = currentStage && pipelineStages.length > 0
    ? Math.round((currentStage.position / pipelineStages.length) * 100)
    : 0;

  const contactInitials = result.contactName
    ? result.contactName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'N/A';

  return (
    <div>
      <TopBar title="Deal Details" />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Deal Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <nav className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <button onClick={() => navigate('/pipelines')} className="hover:text-orange-600 transition-colors">Pipelines</button>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-orange-700">{pipelineName || 'Pipeline'}</span>
            </nav>
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tighter">{deal.title}</h2>
            <div className="flex items-center gap-3 pt-2">
              <span className={`px-3 py-1 ${statusStyle.bg} text-[10px] font-black tracking-widest uppercase rounded border-l-4 ${statusStyle.border}`}>
                {result.stageName ?? statusStyle.text}
              </span>
              <span className="text-slate-400 text-sm font-medium">
                {activities.length > 0
                  ? `Last activity: ${formatRelativeTime(activities[0]?.createdAt)}`
                  : `Created ${formatRelativeTime(deal.createdAt)}`}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <button
              onClick={() => window.open(`${import.meta.env.VITE_API_URL}/deals/${id}/pdf`)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              title="Download PDF"
            >
              <span className="material-symbols-outlined text-base">download</span>
              PDF
            </button>
            <div className="bg-white p-6 rounded-xl border-l-8 border-orange-600 shadow-sm min-w-[240px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Quoted Value</p>
              <p className="text-4xl font-black text-slate-900 tracking-tight">
                {deal.value != null ? formatCurrency(deal.value) : '$0'}
                <span className="text-slate-300 text-lg ml-1">USD</span>
              </p>
            </div>
          </div>
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Deal Information */}
            <div className="bg-[#f0f3ff] p-8 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16" />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">info</span>
                Deal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Primary Contact</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center font-bold text-slate-600">{contactInitials}</div>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">{result.contactName ?? 'No contact'}</p>
                      <p className="text-xs text-slate-500">{result.contactEmail ?? ''}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Company</label>
                  <p className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">domain</span>
                    {result.companyName ?? '--'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lead Source</label>
                  <p className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">travel_explore</span>
                    BuildKit CRM
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expected Close Date</label>
                  <p className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">event</span>
                    {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : 'Not set'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Stage</label>
                  <p className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">view_kanban</span>
                    {result.stageName ?? '--'}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pipeline Progress</label>
                  <div className="flex gap-1 mt-1">
                    {pipelineStages.map((s) => (
                      <div
                        key={s.id}
                        className={`h-1.5 flex-1 rounded-full ${s.position <= (currentStage?.position ?? 0) ? 'bg-orange-600' : 'bg-slate-200'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Email Tracking */}
            {emailSends.length > 0 && (
              <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">mark_email_read</span>
                  Email Tracking
                </h3>
                <div className="space-y-3">
                  {emailSends.map((send) => {
                    const stats = emailStats[send.id];
                    return (
                      <div key={send.id} className="p-4 bg-[#f0f3ff] rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{send.subject || '(no subject)'}</p>
                          <p className="text-xs text-slate-500">
                            {send.status === 'sent' ? `Sent ${formatRelativeTime(send.sentAt || send.createdAt)}` : send.status}
                          </p>
                        </div>
                        {send.status === 'sent' && stats && (
                          <div className="flex gap-3">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${stats.openCount > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                              {stats.openCount > 0 ? `${stats.openCount} opens` : 'Not opened'}
                            </span>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${stats.clickCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                              {stats.clickCount > 0 ? `${stats.clickCount} clicks` : 'No clicks'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] px-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">history</span>
                Deal Activity History
              </h3>
              {events.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-4xl text-slate-300">history</span>
                  <p className="text-sm text-slate-400 mt-2">No activity yet — send an email or log a call to get started</p>
                </div>
              ) : (
                <div className="relative ml-4 pl-8 border-l-2 border-slate-200 space-y-6">
                  {events.map((event, i) => {
                    const iconMap: Record<string, string> = {
                      stage_change: 'swap_horiz',
                      status_change: 'flag',
                      sms_sent: 'sms',
                      call_made: 'call',
                      email_sent: 'mail',
                      note_added: 'edit_note',
                    };
                    const icon = iconMap[event.type] ?? 'info';

                    let title: React.ReactNode;
                    if (event.type === 'stage_change') {
                      title = <span>Moved from <strong>{event.fromValue}</strong> → <strong>{event.toValue}</strong></span>;
                    } else if (event.type === 'status_change') {
                      title = <span>Status changed to <strong>{event.toValue}</strong></span>;
                    } else if (event.type === 'sms_sent') {
                      title = <span>{event.toValue}</span>;
                    } else if (event.type === 'call_made') {
                      title = <span>Call to {event.toValue}</span>;
                    } else if (event.type === 'email_sent') {
                      title = <span>{event.toValue}</span>;
                    } else {
                      title = <span>{event.toValue ?? event.type}</span>;
                    }

                    return (
                      <div key={event.id} className="relative">
                        <div className={`absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-white border-4 ${i === 0 ? 'border-orange-600' : 'border-slate-300'}`} />
                        <div className={`bg-white p-4 rounded-lg shadow-sm border border-slate-100 ${i > 2 ? 'opacity-50' : ''}`}>
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm text-slate-400">{icon}</span>
                              <p className="text-sm font-bold text-slate-900">{title}</p>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter shrink-0 ml-4">
                              {formatRelativeTime(event.createdAt)}
                            </span>
                          </div>
                          {event.userName && (
                            <p className="text-xs text-slate-400 ml-6">{event.userName}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Quick Actions */}
          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-8 rounded-xl space-y-6 sticky top-24">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Deal Actions</h3>
              <div className="space-y-3">
                <ActionButton icon="mail" label="Send Email" onClick={() => setShowEmailModal(true)} />
                <ActionButton icon="sms" label="Send SMS" onClick={() => setShowSmsModal(true)} />
                {deal.contactId && result.contactPhone && (
                  <div className="w-full">
                    <ClickToCall
                      contactId={deal.contactId}
                      phone={result.contactPhone}
                      contactName={result.contactName ?? undefined}
                      dealId={deal.id}
                      size="md"
                    />
                  </div>
                )}
                <ActionButton icon="automation" label="Start Sequence" onClick={() => setShowSequenceModal(true)} />
                <ActionButton icon="history_edu" label="Log Activity" onClick={() => setModalOpen(true)} />
                <ActionButton icon="rebase_edit" label="Move Stage" onClick={() => { setSelectedStageId(deal.stageId); setShowStageModal(true); }} />
                <ActionButton icon="description" label="Call Prep" onClick={() => navigate(`/deals/${id}/call-prep`)} />
              </div>
              {deal.status === 'open' && (
                <>
                  <div className="h-px bg-white/10" />
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleStatusChange('won')}
                      className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white font-black py-3 rounded-lg text-xs uppercase tracking-widest transition-all"
                    >
                      Mark Won
                    </button>
                    <button
                      onClick={() => handleStatusChange('lost')}
                      className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-black py-3 rounded-lg text-xs uppercase tracking-widest transition-all"
                    >
                      Mark Lost
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Deal Score */}
            <div className="bg-[#e7eeff] p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pipeline Progress</h4>
                <span className="text-xl font-black text-slate-900">{stageProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-orange-600 h-full rounded-full transition-all" style={{ width: `${stageProgress}%` }} />
              </div>
              <p className="text-[10px] text-slate-500">
                Stage {currentStage?.position ?? 0} of {pipelineStages.length} — {result.stageName}
              </p>
            </div>

            {/* Company Card */}
            {result.companyName && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Company</h4>
                <button
                  onClick={() => navigate(`/leads/${deal.companyId}`)}
                  className="flex items-center gap-3 w-full text-left hover:bg-slate-50 p-2 -m-2 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 rounded bg-orange-100 flex items-center justify-center font-bold text-orange-700">
                    {result.companyName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{result.companyName}</p>
                    <p className="text-xs text-slate-500">View company profile</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Move Stage Modal */}
      <Modal open={showStageModal} onClose={() => setShowStageModal(false)} title="Move Stage">
        <div className="space-y-4">
          <select
            value={selectedStageId}
            onChange={(e) => setSelectedStageId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
          >
            {pipelineStages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowStageModal(false)} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
            <button
              onClick={() => handleStageChange(selectedStageId)}
              disabled={stageChanging || selectedStageId === deal.stageId}
              className="rounded-lg bg-gradient-to-r from-orange-700 to-orange-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-50"
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
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Type</label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            >
              <option value="note">Note</option>
              <option value="email">Email</option>
              <option value="call">Call</option>
              <option value="text">Text</option>
              <option value="meeting">Meeting</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Subject</label>
            <input
              type="text"
              value={activitySubject}
              onChange={(e) => setActivitySubject(e.target.value)}
              placeholder="Activity subject..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Details</label>
            <textarea
              value={activityBody}
              onChange={(e) => setActivityBody(e.target.value)}
              placeholder="Additional details..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setModalOpen(false)} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
            <button
              onClick={handleLogActivity}
              disabled={submitting || !activitySubject.trim()}
              className="rounded-lg bg-gradient-to-r from-orange-700 to-orange-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-50"
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
        onSent={() => { loadData(); }}
      />
      <EnrollSequenceModal
        open={showSequenceModal}
        onClose={() => setShowSequenceModal(false)}
        dealId={deal.id}
        contactId={deal.contactId || ''}
        onEnrolled={() => { loadData(); }}
      />
      <SendSmsModal
        open={showSmsModal}
        onClose={() => setShowSmsModal(false)}
        contactId={deal.contactId || ''}
        contactName={result.contactName || 'Unknown'}
        contactPhone={''}
        dealId={deal.id}
        onSent={() => { loadData(); }}
      />
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-4 rounded-lg text-left flex items-center transition-all group"
    >
      <span className="material-symbols-outlined mr-3 text-orange-500">{icon}</span>
      <span className="text-sm tracking-wide uppercase">{label}</span>
      <span className="material-symbols-outlined ml-auto text-xs opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all">chevron_right</span>
    </button>
  );
}
