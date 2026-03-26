import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';

interface ActivityEntry {
  date: string;
  subject: string;
  type: string;
}

interface CallPrepData {
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
    lowEstimate: number;
    highEstimate: number;
    description: string;
  } | null;
  recentActivity: ActivityEntry[];
  generatedAt: string;
}

export default function CallPrepView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CallPrepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api<CallPrepData>(`/api/deals/${id}/call-prep`);
      setData(result);
    } catch (err) {
      console.error('Failed to load call prep:', err);
      setError(err instanceof Error ? err.message : 'Failed to load call prep brief');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!id) return;
    setRegenerating(true);
    try {
      const result = await api<CallPrepData>(`/api/deals/${id}/call-prep`, { method: 'POST' });
      setData(result);
    } catch (err) {
      console.error('Failed to regenerate call prep:', err);
    } finally {
      setRegenerating(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <TopBar
        title="Call Prep Brief"
        subtitle={data?.companyOverview.name ?? 'Loading...'}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {regenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-[#1F4D78] px-3 py-2 text-sm font-medium text-white hover:bg-[#1a4268]"
            >
              Print
            </button>
          </div>
        }
      />

      <div className="p-6 max-w-3xl mx-auto space-y-6 print:p-0 print:max-w-none print:space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Company Overview */}
            <section className="rounded-lg border border-border bg-surface p-5">
              <h2 className="mb-3 text-base font-semibold text-gray-900">Company Overview</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="font-medium text-gray-500">Company</dt>
                  <dd className="text-gray-900">{data.companyOverview.name}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Industry</dt>
                  <dd className="text-gray-900">{data.companyOverview.industry ?? '--'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Location</dt>
                  <dd className="text-gray-900">{data.companyOverview.location || '--'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Website</dt>
                  <dd>
                    {data.companyOverview.website ? (
                      <a
                        href={data.companyOverview.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {data.companyOverview.website}
                      </a>
                    ) : (
                      '--'
                    )}
                  </dd>
                </div>
                {data.companyOverview.googleRating != null && (
                  <div>
                    <dt className="font-medium text-gray-500">Google Rating</dt>
                    <dd className="text-gray-900">{data.companyOverview.googleRating} / 5</dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Website Findings */}
            {data.websiteFindings && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-gray-900">Website Findings</h2>
                  {data.websiteScore != null && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        data.websiteScore >= 70
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                          : data.websiteScore >= 40
                          ? 'border-amber-200 bg-amber-100 text-amber-700'
                          : 'border-gray-200 bg-gray-100 text-gray-600'
                      }`}
                    >
                      Score: {data.websiteScore}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line">{data.websiteFindings}</p>
              </section>
            )}

            {/* Talking Points */}
            {data.talkingPoints.length > 0 && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="mb-3 text-base font-semibold text-gray-900">Talking Points</h2>
                <ol className="space-y-2">
                  {data.talkingPoints.map((point, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {i + 1}
                      </span>
                      {point}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Estimated Scope */}
            {data.estimatedScope && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="mb-3 text-base font-semibold text-gray-900">Estimated Scope</h2>
                <p className="text-2xl font-semibold text-gray-900 mb-2">
                  ${data.estimatedScope.lowEstimate.toLocaleString()} – ${data.estimatedScope.highEstimate.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">{data.estimatedScope.description}</p>
              </section>
            )}

            {/* Recent Activity */}
            {data.recentActivity.length > 0 && (
              <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="mb-3 text-base font-semibold text-gray-900">Recent Activity</h2>
                <div className="space-y-3">
                  {data.recentActivity.map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        {i < data.recentActivity.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="pb-3 min-w-0">
                        <p className="text-sm text-gray-900">{item.subject}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.type} &middot; {new Date(item.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          nav, aside, header { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
