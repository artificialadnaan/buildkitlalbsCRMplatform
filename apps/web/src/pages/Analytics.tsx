import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatCurrency } from '../lib/format.js';
import TopBar from '../components/layout/TopBar.js';

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; position: number }[];
}

interface StageData {
  id: string;
  name: string;
  position: number;
  color: string | null;
  dealCount: number;
  avgValue: number;
  totalValue: number;
  avgDaysInStage: number;
  conversionRate: number | null;
}

interface PipelineAnalytics {
  pipelineId: string;
  stages: StageData[];
  summary: {
    totalDeals: number;
    totalPipelineValue: number;
    winRate: number;
    wonCount: number;
    lostCount: number;
    avgCycleDays: number;
  };
}

interface RepPerformance {
  userId: string;
  name: string;
  email: string;
  dealsWon: number;
  wonValue: number;
  dealsLost: number;
  winRate: number;
  avgCycleDays: number;
  activitiesThisMonth: number;
}

interface MonthlyTrend {
  month: string;
  dealCount: number;
  revenue: number;
}

interface OverviewData {
  monthlyTrend: MonthlyTrend[];
  winLoss: { won: number; lost: number; ratio: number };
}

export default function Analytics() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [pipelineData, setPipelineData] = useState<PipelineAnalytics | null>(null);
  const [repData, setRepData] = useState<RepPerformance[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Pipeline[]>('/api/pipelines'),
      api<RepPerformance[]>('/api/analytics/rep-performance'),
      api<OverviewData>('/api/analytics/overview'),
    ]).then(([p, r, o]) => {
      setPipelines(p);
      setRepData(r);
      setOverview(o);
      if (p.length > 0) {
        setSelectedPipeline(p[0].id);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Failed to load analytics:', err);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedPipeline) return;
    api<PipelineAnalytics>(`/api/analytics/pipeline/${selectedPipeline}`)
      .then(setPipelineData)
      .catch(console.error);
  }, [selectedPipeline]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const maxDealCount = pipelineData
    ? Math.max(...pipelineData.stages.map(s => s.dealCount), 1)
    : 1;

  const maxMonthlyCount = overview
    ? Math.max(...overview.monthlyTrend.map(m => m.dealCount), 1)
    : 1;

  return (
    <div>
      <TopBar title="Analytics" />

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        {pipelineData && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Total Deals" value={String(pipelineData.summary.totalDeals)} />
            <SummaryCard label="Pipeline Value" value={formatCurrency(pipelineData.summary.totalPipelineValue)} />
            <SummaryCard label="Win Rate" value={`${pipelineData.summary.winRate}%`} />
            <SummaryCard label="Avg Cycle" value={`${pipelineData.summary.avgCycleDays}d`} />
          </div>
        )}

        {/* Pipeline Selector */}
        {pipelines.length > 1 && (
          <div>
            <select
              value={selectedPipeline}
              onChange={(e) => setSelectedPipeline(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pipeline Funnel */}
          {pipelineData && (
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Pipeline Funnel</h2>
              <div className="space-y-2">
                {pipelineData.stages.map((stage) => {
                  const width = Math.max((stage.dealCount / maxDealCount) * 100, 4);
                  return (
                    <div key={stage.id} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-medium text-gray-600 truncate text-right">
                        {stage.name}
                      </span>
                      <div className="flex-1 h-8 bg-gray-100 rounded-md overflow-hidden relative">
                        <div
                          className="h-full rounded-md bg-blue-500 transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-gray-700">
                          {stage.dealCount} deals
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Trend */}
          {overview && overview.monthlyTrend.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Won Deals (Last 6 Months)</h2>
              <div className="flex items-end gap-2 h-48">
                {overview.monthlyTrend.map((m) => {
                  const height = Math.max((m.dealCount / maxMonthlyCount) * 100, 4);
                  const monthLabel = new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short' });
                  return (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-medium text-gray-700">{m.dealCount}</span>
                      <div className="w-full flex items-end" style={{ height: '160px' }}>
                        <div
                          className="w-full rounded-t-md bg-emerald-500 transition-all duration-500"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{monthLabel}</span>
                    </div>
                  );
                })}
              </div>
              {/* Win/Loss summary */}
              <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                <span className="text-emerald-600 font-medium">{overview.winLoss.won} won</span>
                <span className="text-gray-400">/</span>
                <span className="text-red-500 font-medium">{overview.winLoss.lost} lost</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-600">{overview.winLoss.ratio}x ratio</span>
              </div>
            </div>
          )}
        </div>

        {/* Stage Metrics Table */}
        {pipelineData && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Stage Metrics</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 pr-4 font-medium text-gray-500">Stage</th>
                    <th className="pb-3 pr-4 font-medium text-gray-500 text-right">Deals</th>
                    <th className="pb-3 pr-4 font-medium text-gray-500 text-right">Avg Value</th>
                    <th className="pb-3 pr-4 font-medium text-gray-500 text-right">Total Value</th>
                    <th className="pb-3 pr-4 font-medium text-gray-500 text-right">Avg Days</th>
                    <th className="pb-3 font-medium text-gray-500 text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineData.stages.map((stage) => (
                    <tr key={stage.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 font-medium text-gray-900">{stage.name}</td>
                      <td className="py-3 pr-4 text-right text-gray-700">{stage.dealCount}</td>
                      <td className="py-3 pr-4 text-right text-gray-700">{formatCurrency(stage.avgValue)}</td>
                      <td className="py-3 pr-4 text-right text-gray-700">{formatCurrency(stage.totalValue)}</td>
                      <td className="py-3 pr-4 text-right text-gray-700">{stage.avgDaysInStage}d</td>
                      <td className="py-3 text-right">
                        {stage.conversionRate != null ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            stage.conversionRate >= 50
                              ? 'bg-emerald-100 text-emerald-700'
                              : stage.conversionRate >= 25
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {stage.conversionRate}%
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rep Leaderboard */}
        {repData.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Rep Leaderboard</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 pr-4 font-medium text-gray-500">Rep</th>
                    <th className="pb-3 pr-4 font-medium text-gray-500 text-right">Deals Won</th>
                    <th className="pb-3 pr-4 font-medium text-gray-500 text-right">Revenue</th>
                    <th className="pb-3 pr-4 font-medium text-gray-500 text-right">Win Rate</th>
                    <th className="pb-3 pr-4 font-medium text-gray-500 text-right">Avg Cycle</th>
                    <th className="pb-3 font-medium text-gray-500 text-right">Activities (Mo)</th>
                  </tr>
                </thead>
                <tbody>
                  {repData
                    .sort((a, b) => b.wonValue - a.wonValue)
                    .map((rep) => (
                      <tr key={rep.userId} className="border-b border-border last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-900">{rep.name}</p>
                          <p className="text-xs text-gray-500">{rep.email}</p>
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-700">{rep.dealsWon}</td>
                        <td className="py-3 pr-4 text-right text-gray-700">{formatCurrency(rep.wonValue)}</td>
                        <td className="py-3 pr-4 text-right">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            rep.winRate >= 50
                              ? 'bg-emerald-100 text-emerald-700'
                              : rep.winRate >= 25
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                          }`}>
                            {rep.winRate}%
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-700">{rep.avgCycleDays}d</td>
                        <td className="py-3 text-right text-gray-700">{rep.activitiesThisMonth}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
