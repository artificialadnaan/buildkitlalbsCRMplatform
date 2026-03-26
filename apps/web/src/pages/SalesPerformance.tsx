import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SequenceConversion {
  sequenceName: string;
  sends: number;
  opens: number;
  replies: number;
}

interface IndustryResponse {
  industry: string;
  replyRate: number;
  total: number;
}

interface HeatmapCell {
  day: number;
  hour: number;
  opens: number;
}

interface SalesPerformanceData {
  sequenceConversion: SequenceConversion[];
  industryResponse: IndustryResponse[];
  sendTimeHeatmap: HeatmapCell[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function heatmapColor(value: number, max: number): string {
  if (max === 0) return 'bg-gray-100';
  const ratio = value / max;
  if (ratio === 0) return 'bg-gray-100';
  if (ratio < 0.25) return 'bg-blue-100';
  if (ratio < 0.5) return 'bg-blue-300';
  if (ratio < 0.75) return 'bg-blue-500';
  return 'bg-blue-700';
}

export default function SalesPerformance() {
  const [data, setData] = useState<SalesPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<SalesPerformanceData>('/api/reports/sales-performance')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  // Build heatmap grid: 7 days x 24 hours
  const heatmapMap = new Map<string, number>();
  let heatmapMax = 0;
  data?.sendTimeHeatmap.forEach((cell) => {
    heatmapMap.set(`${cell.day}-${cell.hour}`, cell.opens);
    if (cell.opens > heatmapMax) heatmapMax = cell.opens;
  });

  return (
    <div>
      <TopBar title="Sales Performance" subtitle="Sequence and outreach analytics" />

      <div className="p-6 space-y-6">
        {/* Sequence Conversion */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Sequence Conversion</h2>
          {data && data.sequenceConversion.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.sequenceConversion} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="sequenceName"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sends" name="Sends" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                <Bar dataKey="opens" name="Opens" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="replies" name="Replies" fill="#1d4ed8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 py-8 text-center">No sequence data yet</p>
          )}
        </div>

        {/* Industry Response Rate */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Industry Response Rate</h2>
          {data && data.industryResponse.length > 0 ? (
            <div className="space-y-3">
              {data.industryResponse
                .sort((a, b) => b.replyRate - a.replyRate)
                .map((item) => (
                  <div key={item.industry} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-xs font-medium text-gray-600 truncate text-right">
                      {item.industry}
                    </span>
                    <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden relative">
                      <div
                        className="h-full rounded-md bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.min(item.replyRate, 100)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-gray-700">
                        {item.replyRate.toFixed(1)}% ({item.total} sent)
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-8 text-center">No industry data yet</p>
          )}
        </div>

        {/* Send Time Heatmap */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Best Send Times</h2>
          <p className="text-xs text-gray-500 mb-3">Darker = more opens</p>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Hour labels */}
              <div className="flex mb-1 ml-10">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="flex-1 text-center text-xs text-gray-400">
                    {h % 6 === 0 ? `${h}h` : ''}
                  </div>
                ))}
              </div>
              {/* Grid rows */}
              {DAYS.map((day, dayIdx) => (
                <div key={day} className="flex items-center mb-0.5">
                  <span className="w-10 shrink-0 text-xs font-medium text-gray-500 text-right pr-2">
                    {day}
                  </span>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const val = heatmapMap.get(`${dayIdx}-${hour}`) ?? 0;
                    return (
                      <div
                        key={hour}
                        title={`${day} ${hour}:00 — ${val} opens`}
                        className={`flex-1 h-5 mx-px rounded-sm ${heatmapColor(val, heatmapMax)}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
