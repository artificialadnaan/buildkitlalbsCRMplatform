import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import { formatCurrency } from '../lib/format.js';

interface FunnelStep {
  label: string;
  count: number;
  conversionRate: number | null;
}

interface ROIData {
  funnel: FunnelStep[];
  totalRevenue: number;
  avgDealSize: number;
}

function defaultDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const FUNNEL_COLORS = [
  'bg-blue-600',
  'bg-blue-500',
  'bg-blue-400',
  'bg-emerald-500',
  'bg-emerald-400',
  'bg-emerald-300',
];

export default function ROICalculator() {
  const [from, setFrom] = useState(defaultDate(-90));
  const [to, setTo] = useState(defaultDate(0));
  const [data, setData] = useState<ROIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await api<ROIData>(`/api/reports/roi?from=${from}&to=${to}`);
      setData(result);
    } catch (err) {
      console.error('Failed to load ROI data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ROI data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const maxCount = data ? Math.max(...data.funnel.map((s) => s.count), 1) : 1;

  return (
    <div>
      <TopBar title="ROI Calculator" subtitle="Revenue funnel and return on outreach" />

      <div className="p-6 space-y-6">
        {/* Date range */}
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Funnel visualization */}
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="mb-6 text-base font-semibold text-gray-900">Outreach Funnel</h2>
              <div className="space-y-3">
                {data.funnel.map((step, i) => {
                  const widthPct = Math.max((step.count / maxCount) * 100, 4);
                  return (
                    <div key={step.label} className="flex items-center gap-4">
                      <span className="w-24 shrink-0 text-xs font-medium text-gray-600 text-right">
                        {step.label}
                      </span>
                      <div className="flex-1 relative">
                        <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
                          <div
                            className={`h-full rounded-lg transition-all duration-500 ${FUNNEL_COLORS[i] ?? 'bg-blue-400'}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <div className="absolute inset-0 flex items-center px-4">
                          <span className="text-sm font-semibold text-white drop-shadow-sm">
                            {step.count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="w-20 shrink-0 text-xs text-gray-500 text-right">
                        {step.conversionRate != null
                          ? `${step.conversionRate.toFixed(1)}% conv.`
                          : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Revenue summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="text-xs font-medium uppercase text-gray-500">Total Revenue</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {formatCurrency(data.totalRevenue)}
                </p>
                <p className="mt-1 text-xs text-gray-400">from won deals in period</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="text-xs font-medium uppercase text-gray-500">Avg Deal Size</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  {formatCurrency(data.avgDealSize)}
                </p>
                <p className="mt-1 text-xs text-gray-400">per closed deal</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
