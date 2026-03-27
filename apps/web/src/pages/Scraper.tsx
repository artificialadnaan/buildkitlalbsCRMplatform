import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.js';
import { api } from '../lib/api.js';

interface ScrapeJob {
  id: string;
  zipCodes: string[];
  searchQuery: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  totalFound: number;
  newLeads: number;
  duplicatesSkipped: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  userName: string | null;
  mode?: string;
}

interface RecentLead {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  source: string;
  createdAt: string;
  contactEmail?: string | null;
}

interface ProspectData {
  reviewCount?: number;
  filterReason?: string;
  templatePreviewUrl?: string;
  generatedEmail?: { subject: string; body: string };
  callPrepNotes?: string[];
  enrichmentSources?: string[];
}

interface Prospect {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  googleRating: number | null;
  score: number | null;
  websiteScore: number | null;
  prospectingStatus: 'qualifying' | 'enriching' | 'generating' | 'ready' | 'filtered' | 'no-contact' | 'failed';
  prospectingData: ProspectData | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactTitle: string | null;
}

const QUICK_TAGS = ['roofing contractors', 'plumbing', 'hvac', 'electrical', 'general contractor', 'landscaping'];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    qualifying: 'bg-blue-100 text-blue-700',
    enriching: 'bg-purple-100 text-purple-700',
    generating: 'bg-amber-100 text-amber-700',
    ready: 'bg-green-100 text-green-700',
    filtered: 'bg-gray-100 text-gray-500',
    'no-contact': 'bg-orange-100 text-orange-600',
    failed: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

export default function Scraper() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [zipInput, setZipInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxLeads, setMaxLeads] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Mode toggle
  const [mode, setMode] = useState<'standard' | 'ai-prospect'>('standard');
  const [minReviews, setMinReviews] = useState(20);
  const [maxWebsiteScore, setMaxWebsiteScore] = useState(70);

  // Toggle states
  const [extractEmails, setExtractEmails] = useState(true);
  const [findContact, setFindContact] = useState(true);
  const [aiResearch, setAiResearch] = useState(false);

  // Prospect view state
  const [viewingProspectsJobId, setViewingProspectsJobId] = useState<string | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectsLoading, setProspectsLoading] = useState(false);
  const [prospectsError, setProspectsError] = useState('');

  const validZipCount = zipInput.split(/[,\s\n]+/).filter(z => /^\d{5}$/.test(z.trim())).length;

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api<{ data: ScrapeJob[] }>('/api/scrape/jobs');
      setJobs(res.data);
    } catch {
      // Silently fail on poll
    }
  }, []);

  const fetchRecentLeads = useCallback(async () => {
    try {
      const res = await api<{ data: RecentLead[] }>('/api/companies?source=scraped&limit=8&sort=createdAt&order=desc');
      setRecentLeads(res.data ?? []);
    } catch {
      setRecentLeads([]);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchRecentLeads();
  }, [fetchJobs, fetchRecentLeads]);

  // Poll when jobs are active
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'running');
    if (!hasActive) return;
    const interval = setInterval(() => {
      fetchJobs();
      fetchRecentLeads();
    }, 3000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs, fetchRecentLeads]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const zipCodes = zipInput
      .split(/[,\s\n]+/)
      .map(z => z.trim())
      .filter(z => /^\d{5}$/.test(z));

    if (zipCodes.length === 0) {
      setError('Enter at least one valid 5-digit zip code');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        zipCodes,
        searchQuery: searchQuery.trim() || 'local businesses',
        maxLeads,
      };
      if (mode === 'ai-prospect') {
        body.mode = 'ai-prospect';
        body.prospectConfig = { minReviews, maxWebsiteScore };
      }
      await api('/api/scrape', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setZipInput('');
      setSearchQuery('');
      await fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scrape job');
    } finally {
      setSubmitting(false);
    }
  }

  function handleExportCSV() {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || '';
    window.open(`${baseUrl}/api/export/companies?token=${token}`, '_blank');
  }

  async function handleViewProspects(jobId: string) {
    setViewingProspectsJobId(jobId);
    setProspectsLoading(true);
    setProspectsError('');
    try {
      const res = await api<{ data: Prospect[] }>(`/api/scrape/jobs/${jobId}/prospects`);
      setProspects(res.data ?? []);
    } catch (err) {
      setProspectsError(err instanceof Error ? err.message : 'Failed to load prospects');
    } finally {
      setProspectsLoading(false);
    }
  }

  function handleSendEmail(prospect: Prospect) {
    const prospectData = prospect.prospectingData;
    if (prospectData?.generatedEmail) {
      navigate(`/leads/${prospect.id}?compose=1&subject=${encodeURIComponent(prospectData.generatedEmail.subject)}`);
    } else {
      navigate(`/leads/${prospect.id}`);
    }
  }

  function handleCall(prospect: Prospect) {
    if (!prospect.contactPhone) return;
    api('/api/sms/call', {
      method: 'POST',
      body: JSON.stringify({ contactId: prospect.id }),
    }).catch(console.error);
  }

  async function handleAddToPipeline(prospect: Prospect) {
    try {
      const res = await api<{ data: { id: string } }>('/api/deals', {
        method: 'POST',
        body: JSON.stringify({
          companyId: prospect.id,
          title: prospect.name,
          stage: 'new',
        }),
      });
      navigate(`/deals/${res.data.id}`);
    } catch (err) {
      console.error('Failed to add to pipeline', err);
    }
  }

  function getStatusDisplay(job: ScrapeJob) {
    if (job.status === 'running' || job.status === 'pending') {
      const pct = job.status === 'pending' ? 5 : Math.min(95, Math.max(10, Math.round((job.newLeads / Math.max(job.totalFound, 1)) * 100)));
      return (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 w-24 bg-[#e7eeff] rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] font-bold text-orange-500">{pct}%</span>
        </div>
      );
    }
    if (job.status === 'done') {
      return (
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 uppercase">
          <span className="w-1.5 h-1.5 bg-green-600 rounded-full" /> Completed
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase">
        <span className="w-1.5 h-1.5 bg-red-600 rounded-full" /> Failed
      </span>
    );
  }

  // Prospect results view
  if (viewingProspectsJobId !== null) {
    return (
      <div>
        <TopBar title="AI Prospects" subtitle="Operational Command" />
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setViewingProspectsJobId(null)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to Scraper
            </button>
            <h2 className="text-xl font-black tracking-tighter text-slate-900 uppercase">
              AI Prospect Results
            </h2>
            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
              {prospects.length} prospects
            </span>
          </div>

          {prospectsLoading && (
            <div className="flex items-center justify-center py-24">
              <span className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-3" />
              <span className="text-sm text-slate-500">Loading prospects...</span>
            </div>
          )}

          {prospectsError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-md px-4 py-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {prospectsError}
            </div>
          )}

          {!prospectsLoading && !prospectsError && prospects.length === 0 && (
            <div className="text-center py-24">
              <span className="material-symbols-outlined text-4xl text-slate-300">person_search</span>
              <p className="text-sm text-slate-400 mt-2">No prospects found for this job.</p>
            </div>
          )}

          {!prospectsLoading && prospects.length > 0 && (
            <div className="max-w-3xl space-y-3">
              {prospects.map(prospect => {
                const prospectData = prospect.prospectingData;
                const PIPELINE_STAGES = ['qualifying', 'enriching', 'generating', 'ready'];
                const currentIdx = PIPELINE_STAGES.indexOf(prospect.prospectingStatus);
                return (
                  <div key={prospect.id} className="rounded-lg border border-gray-200 bg-white p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{prospect.name}</h4>
                        <p className="text-xs text-gray-500">
                          {prospect.industry} · {prospect.city}, {prospect.state}
                        </p>
                      </div>
                      <StatusBadge status={prospect.prospectingStatus} />
                    </div>

                    {/* Pipeline progress dots */}
                    <div className="flex items-center gap-1 mb-3">
                      {PIPELINE_STAGES.map((stage, i) => {
                        const isComplete = i <= currentIdx || prospect.prospectingStatus === 'ready';
                        const isCurrent = PIPELINE_STAGES[i] === prospect.prospectingStatus;
                        return (
                          <div key={stage} className="flex items-center">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                isComplete
                                  ? 'bg-green-500'
                                  : isCurrent
                                  ? 'bg-blue-500 animate-pulse'
                                  : 'bg-gray-200'
                              }`}
                            />
                            {i < 3 && (
                              <div className={`w-8 h-0.5 ${isComplete ? 'bg-green-300' : 'bg-gray-200'}`} />
                            )}
                          </div>
                        );
                      })}
                      <span className="text-xs text-gray-400 ml-2">{prospect.prospectingStatus}</span>
                    </div>

                    {/* Owner info */}
                    {prospect.contactFirstName && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <p className="text-sm font-medium">
                          {prospect.contactFirstName} {prospect.contactLastName}
                          {prospect.contactTitle ? ` — ${prospect.contactTitle}` : ''}
                        </p>
                        {prospect.contactEmail && (
                          <p className="text-xs text-blue-600">{prospect.contactEmail}</p>
                        )}
                        {prospect.contactPhone && (
                          <p className="text-xs text-gray-500">{prospect.contactPhone}</p>
                        )}
                      </div>
                    )}

                    {/* Template preview */}
                    {prospectData?.templatePreviewUrl && (
                      <img
                        src={prospectData.templatePreviewUrl}
                        alt="Website preview"
                        className="rounded-lg border mb-3 w-full max-h-48 object-cover object-top"
                      />
                    )}

                    {/* Generated email */}
                    {prospectData?.generatedEmail && (
                      <details className="mb-3">
                        <summary className="text-xs font-medium text-purple-600 cursor-pointer">
                          Generated Email: {prospectData.generatedEmail.subject}
                        </summary>
                        <div className="mt-2 text-sm text-gray-700 bg-gray-50 rounded p-3 whitespace-pre-line">
                          {prospectData.generatedEmail.body}
                        </div>
                      </details>
                    )}

                    {/* Call prep notes */}
                    {prospectData?.callPrepNotes && prospectData.callPrepNotes.length > 0 && (
                      <details className="mb-3">
                        <summary className="text-xs font-medium text-blue-600 cursor-pointer">
                          Call Prep Notes ({prospectData.callPrepNotes.length})
                        </summary>
                        <ul className="mt-2 text-sm text-gray-700 list-disc pl-5">
                          {prospectData.callPrepNotes.map((note: string, i: number) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {/* Filter reason */}
                    {prospect.prospectingStatus === 'filtered' && prospectData?.filterReason && (
                      <p className="text-xs text-amber-600 italic">Filtered: {prospectData.filterReason}</p>
                    )}

                    {/* Action buttons (ready only) */}
                    {prospect.prospectingStatus === 'ready' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <button
                          onClick={() => handleSendEmail(prospect)}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">mail</span>
                          Send Email
                        </button>
                        {prospect.contactPhone && (
                          <button
                            onClick={() => handleCall(prospect)}
                            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">call</span>
                            Call Owner
                          </button>
                        )}
                        <button
                          onClick={() => handleAddToPipeline(prospect)}
                          className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                          Add to Pipeline
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Lead Scraper" subtitle="Operational Command" />

      <div className="p-8 grid grid-cols-12 gap-6">
        {/* Left Column */}
        <section className="col-span-12 lg:col-span-8 space-y-6">
          {/* Scraper Configuration */}
          <form
            onSubmit={handleSubmit}
            className="bg-white p-8 rounded-xl shadow-sm relative"
            style={{ borderLeft: '4px solid #9d4300' }}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black tracking-tighter text-slate-900 uppercase mb-1">Scraper Configuration</h3>
                <p className="text-sm text-slate-500 font-medium">Define parameters for technical lead acquisition.</p>
              </div>
              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                Engine 2.0
              </span>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-4">
              <button
                type="button"
                onClick={() => setMode('standard')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'standard' ? 'bg-slate-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Standard Scrape
              </button>
              <button
                type="button"
                onClick={() => setMode('ai-prospect')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'ai-prospect'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="material-symbols-outlined text-sm align-middle mr-1">psychology</span>
                AI Prospecting
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Target Zip Codes</label>
                <textarea
                  value={zipInput}
                  onChange={e => setZipInput(e.target.value)}
                  placeholder="75201, 75202, 75203..."
                  rows={3}
                  className="w-full bg-[#d8e3fb] border-0 border-b-2 border-slate-300 focus:border-orange-600 focus:ring-0 text-slate-900 p-4 font-mono text-sm leading-relaxed"
                />
                <p className="text-[10px] text-slate-400 italic">
                  {validZipCount} valid zip{validZipCount !== 1 ? 's' : ''} entered. Separate with commas or line breaks.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Search Query</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="e.g. roofing contractors"
                  className="w-full bg-[#d8e3fb] border-0 border-b-2 border-slate-300 focus:border-orange-600 focus:ring-0 text-slate-900 p-4 font-bold text-lg"
                />
                <div className="flex gap-2 mt-3 flex-wrap">
                  {QUICK_TAGS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSearchQuery(tag)}
                      className="bg-[#e7eeff] px-2 py-1 rounded text-[10px] font-bold text-slate-600 hover:bg-orange-100 hover:text-orange-700 transition-colors"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Lead Limit */}
            <div className="border-t border-[#e7eeff] pt-6 mb-6">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 block">Max Leads to Scrape</label>
              <div className="flex gap-2">
                {[10, 20, 50, 100, 200].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxLeads(n)}
                    className={`px-4 py-2 rounded text-sm font-bold transition-all ${
                      maxLeads === n
                        ? 'bg-gradient-to-r from-orange-700 to-orange-500 text-white shadow-lg shadow-orange-600/20'
                        : 'bg-[#e7eeff] text-slate-600 hover:bg-[#d8e3fb]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 italic">
                Estimated cost: ~${((maxLeads * 0.034)).toFixed(2)} ({maxLeads} leads at $0.034/lead)
              </p>
            </div>

            {/* AI Prospecting Config */}
            {mode === 'ai-prospect' && (
              <div className="mt-4 p-4 rounded-lg border border-purple-200 bg-purple-50/50 mb-6">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-3">AI Prospecting Config</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Min Google Reviews</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={minReviews}
                      onChange={e => setMinReviews(parseInt(e.target.value) || 20)}
                      className="w-full text-sm border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Max Website Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={maxWebsiteScore}
                      onChange={e => setMaxWebsiteScore(parseInt(e.target.value) || 70)}
                      className="w-full text-sm border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Only businesses with &gt;= {minReviews} reviews and website score &lt; {maxWebsiteScore} will be enriched
                </p>
              </div>
            )}

            {/* Intelligence Settings */}
            <div className="border-t border-[#e7eeff] pt-6">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-900 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">psychology</span>
                Scrape Intelligence Settings
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <ToggleCard
                  label="Extract Emails"
                  sublabel="Verify domain records"
                  enabled={extractEmails}
                  onToggle={() => setExtractEmails(v => !v)}
                />
                <ToggleCard
                  label="Auto Website Audit"
                  sublabel="Score & analyze sites"
                  enabled={findContact}
                  onToggle={() => setFindContact(v => !v)}
                />
                <ToggleCard
                  label="AI-powered Research"
                  sublabel="Deep company insights"
                  enabled={aiResearch}
                  onToggle={() => setAiResearch(v => !v)}
                />
              </div>
            </div>

            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 text-red-600 text-sm rounded-md px-4 py-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className={`px-8 py-3 text-white rounded-lg font-bold text-sm tracking-wide shadow-lg hover:-translate-y-px transition-transform disabled:opacity-50 disabled:cursor-not-allowed ${
                  mode === 'ai-prospect'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 shadow-purple-600/20'
                    : 'bg-gradient-to-r from-orange-700 to-orange-500 shadow-orange-600/20'
                }`}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deploying...
                  </span>
                ) : mode === 'ai-prospect' ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">psychology</span>
                    Launch AI Prospector
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">rocket_launch</span>
                    Launch Scraper
                  </span>
                )}
              </button>
            </div>
          </form>

          {/* Operational Log */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-8 py-6 flex justify-between items-center border-b border-[#e7eeff]">
              <h3 className="text-lg font-black tracking-tighter text-slate-900 uppercase">Operational Log</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {jobs.length} job{jobs.length !== 1 ? 's' : ''} total
              </span>
            </div>

            {jobs.length === 0 ? (
              <div className="px-8 py-12 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300">search_off</span>
                <p className="text-sm text-slate-400 mt-2">No scrape jobs yet. Configure and launch above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f0f3ff] text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-8 py-4">Job</th>
                      <th className="px-4 py-4">Zip Codes</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Leads</th>
                      <th className="px-8 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e7eeff]">
                    {jobs.map(job => (
                      <tr key={job.id} className="hover:bg-[#f0f3ff]/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">{job.searchQuery}</p>
                            {job.mode === 'ai-prospect' && (
                              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">psychology</span>
                                AI
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {new Date(job.createdAt).toLocaleString()}
                          </p>
                          {job.userName && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Started by {job.userName}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex gap-1 flex-wrap">
                            {job.zipCodes.slice(0, 2).map(z => (
                              <span key={z} className="px-1.5 py-0.5 bg-[#e7eeff] rounded text-[10px] font-mono">{z}</span>
                            ))}
                            {job.zipCodes.length > 2 && (
                              <span className="px-1.5 py-0.5 bg-[#e7eeff] rounded text-[10px] font-mono">
                                +{job.zipCodes.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-5">{getStatusDisplay(job)}</td>
                        <td className="px-4 py-5 font-mono font-bold text-slate-900">{job.newLeads}</td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {job.status === 'done' && (
                              <button
                                onClick={() => {
                                  const token = localStorage.getItem('token');
                                  const baseUrl = import.meta.env.VITE_API_URL || '';
                                  window.open(`${baseUrl}/api/export/scrape/${job.id}?token=${token}`, '_blank');
                                }}
                                className="border border-slate-300 text-slate-600 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest hover:border-orange-500 hover:text-orange-600 transition-all"
                              >
                                Export CSV
                              </button>
                            )}
                            {job.mode === 'ai-prospect' && job.status === 'done' && (
                              <button
                                onClick={() => handleViewProspects(job.id)}
                                className="bg-purple-100 text-purple-700 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[11px]">psychology</span>
                                View Prospects
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/leads?scrapeJobId=${job.id}`)}
                              className="bg-[#d5e3fd] text-slate-700 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest group-hover:bg-orange-600 group-hover:text-white transition-all"
                            >
                              View Results
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Live Feed */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="bg-slate-900 text-white p-8 rounded-xl shadow-lg relative overflow-hidden h-full flex flex-col">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="material-symbols-outlined text-[120px]">analytics</span>
            </div>

            <div className="relative z-10 mb-6">
              <h3 className="text-xl font-black tracking-tighter uppercase mb-1">Live Feed</h3>
              <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">
                Recently Unearthed Leads
              </p>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
              {recentLeads.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-600">person_search</span>
                  <p className="text-xs text-slate-500">No scraped leads yet</p>
                </div>
              ) : (
                recentLeads.map((lead, i) => (
                  <button
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="w-full text-left p-4 bg-white/5 border-l-4 rounded-r-lg hover:bg-white/10 transition-all"
                    style={{ borderLeftColor: i === 0 ? '#f97316' : '#475569' }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-sm truncate">{lead.name}</h4>
                      {i === 0 && (
                        <span className="text-[8px] font-bold bg-orange-600 px-1.5 py-0.5 rounded shrink-0 ml-2">NEW</span>
                      )}
                    </div>
                    {lead.phone && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-xs text-orange-300">call</span>
                        <span className="text-[10px] font-mono text-slate-300">{lead.phone}</span>
                      </div>
                    )}
                    <div className="bg-white/5 p-2 rounded text-[10px] flex items-center gap-2">
                      {lead.contactEmail ? (
                        <>
                          <span className="material-symbols-outlined text-xs text-orange-400" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                          <span className="italic font-medium text-slate-300 truncate">{lead.contactEmail}</span>
                        </>
                      ) : lead.website ? (
                        <>
                          <span className="material-symbols-outlined text-xs text-slate-500">language</span>
                          <span className="italic font-medium text-slate-400 truncate">{lead.website}</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-xs text-slate-600">hourglass_top</span>
                          <span className="italic text-slate-500 text-[9px] uppercase tracking-tight">No contact info</span>
                        </>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={handleExportCSV}
              className="mt-6 w-full py-4 bg-gradient-to-r from-orange-700 to-orange-500 rounded text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              Export New Leads (.CSV)
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Reusable toggle card */
function ToggleCard({
  label,
  sublabel,
  enabled,
  onToggle,
}: {
  label: string;
  sublabel: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between p-4 bg-[#f0f3ff] rounded-lg text-left hover:bg-[#e7eeff] transition-colors"
    >
      <div>
        <p className="font-bold text-sm text-slate-900">{label}</p>
        <p className="text-[10px] text-slate-500">{sublabel}</p>
      </div>
      <div className={`w-10 h-5 rounded-full relative shadow-inner transition-colors ${enabled ? 'bg-orange-600' : 'bg-slate-300'}`}>
        <div
          className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${enabled ? 'right-1' : 'left-1'}`}
        />
      </div>
    </button>
  );
}
