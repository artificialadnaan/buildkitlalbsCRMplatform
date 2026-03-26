import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';

interface CampaignStats {
  totalScraped?: number;
  totalAudited?: number;
  totalEnrolled?: number;
  totalReplies?: number;
  avgScore?: number;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  zipCodes: string[];
  searchQuery: string;
  topN: number;
  minScore: number;
  stats: CampaignStats | null;
  createdAt: string;
  completedAt: string | null;
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  scraping: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  auditing: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  scoring: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  enrolling: { bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
  active: { bg: 'bg-green-500/20', text: 'text-green-400' },
  completed: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400' },
  cancelled: { bg: 'bg-slate-500/20', text: 'text-slate-500' },
};

export default function OutreachCampaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: Campaign[] } | Campaign[]>('/api/outreach')
      .then(r => setCampaigns(Array.isArray(r) ? r : (r as { data: Campaign[] }).data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <TopBar title="Outreach" subtitle="Autonomous campaign management" />

      {loading ? <LoadingSpinner /> : (
        <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <span className="text-orange-700 font-bold tracking-[0.2em] text-[10px] uppercase mb-2 block">
                Campaign Command
              </span>
              <h2 className="text-4xl font-extrabold tracking-tighter text-slate-900">
                Outreach Campaigns
              </h2>
            </div>
            <button
              onClick={() => navigate('/outreach/new')}
              className="px-6 py-3 bg-gradient-to-r from-orange-700 to-orange-500 text-white rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-orange-600/20 hover:-translate-y-px transition-transform"
            >
              NEW CAMPAIGN
            </button>
          </div>

          {/* Campaign List */}
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
              <span className="material-symbols-outlined text-5xl text-slate-300">campaign</span>
              <p className="text-lg font-bold text-slate-900 mt-4">No campaigns yet</p>
              <p className="text-sm text-slate-500 mt-1 mb-6">Launch your first autonomous outreach campaign</p>
              <button
                onClick={() => navigate('/outreach/new')}
                className="px-6 py-3 bg-gradient-to-r from-orange-700 to-orange-500 text-white rounded-lg font-bold text-sm"
              >
                Create Campaign
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map(c => {
                const s = c.stats ?? {};
                const style = statusStyles[c.status] ?? statusStyles.cancelled;
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/outreach/${c.id}`)}
                    className="w-full bg-white rounded-xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-px transition-all text-left"
                    style={{ borderLeft: '4px solid #9d4300' }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{c.name}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {c.searchQuery} · {c.zipCodes?.length ?? 0} zip{(c.zipCodes?.length ?? 0) !== 1 ? 's' : ''} · Created {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${style.bg} ${style.text}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-6">
                      <Stat label="Scraped" value={s.totalScraped ?? 0} />
                      <Stat label="Audited" value={s.totalAudited ?? 0} />
                      <Stat label="Enrolled" value={s.totalEnrolled ?? 0} />
                      <Stat label="Replies" value={s.totalReplies ?? 0} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}
