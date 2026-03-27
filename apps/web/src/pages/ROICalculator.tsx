import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ROIData {
  totalLeadsScraped: number;
  scraperCost: number;
  totalDealsCreated: number;
  totalDealsWon: number;
  totalRevenue: number;
  leadToDealRate: number;
  dealToWonRate: number;
  costPerLead: number;
  costPerDeal: number;
  costPerWon: number;
  roi: number;
  range: string;
}

const RANGES = [
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'YTD', value: 'ytd' },
  { label: 'All Time', value: 'all' },
];

export default function ROICalculator() {
  const [data, setData] = useState<ROIData | null>(null);
  const [range, setRange] = useState('90d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<ROIData>(`/api/reports/roi?range=${range}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [range]);

  const funnelData = data
    ? [
        { name: 'Leads Scraped', value: data.totalLeadsScraped },
        { name: 'Deals Created', value: data.totalDealsCreated },
        { name: 'Deals Won', value: data.totalDealsWon },
      ]
    : [];

  return (
    <div>
      <TopBar title="ROI Calculator" subtitle="Scraper cost vs revenue from closed deals" />

      <div className="p-6 space-y-6">
        {/* Range selector */}
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                range === r.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}

        {!loading && data && data.totalLeadsScraped === 0 && (
          <div className="rounded-lg border border-border bg-surface p-12 text-center">
            <p className="text-sm text-gray-500">Run the scraper to start tracking ROI</p>
          </div>
        )}

        {!loading && data && data.totalLeadsScraped > 0 && (
          <>
            {/* Highlight cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-medium uppercase text-emerald-600">Total Revenue</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  ${data.totalRevenue.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-emerald-600">from won deals in period</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                <p className="text-xs font-medium uppercase text-amber-600">Total Cost</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">
                  ${data.scraperCost.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-amber-600">scraper cost at $0.034/lead</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
                <p className="text-xs font-medium uppercase text-blue-600">ROI</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{data.roi}%</p>
                <p className="mt-1 text-xs text-blue-600">return on scraper spend</p>
              </div>
            </div>

            {/* Funnel bar chart */}
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Pipeline Funnel</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={funnelData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="value" name="Count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <MetricCard label="Cost per Lead" value={`$${data.costPerLead}`} />
              <MetricCard label="Cost per Deal" value={`$${data.costPerDeal}`} />
              <MetricCard label="Cost per Won" value={`$${data.costPerWon}`} />
              <MetricCard label="Lead → Deal" value={`${data.leadToDealRate}%`} />
              <MetricCard label="Deal → Won" value={`${data.dealToWonRate}%`} />
              <MetricCard label="Leads Scraped" value={data.totalLeadsScraped.toLocaleString()} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
