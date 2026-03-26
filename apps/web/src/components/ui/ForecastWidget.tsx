import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { formatCurrency } from '../../lib/format.js';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface StageBreakdown {
  stageName: string;
  weightedValue: number;
  dealCount: number;
}

interface ForecastData {
  totalWeightedValue: number;
  stageBreakdown: StageBreakdown[];
}

export default function ForecastWidget() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<ForecastData>('/api/analytics/forecast')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Revenue Forecast</h2>
      <p className="text-xs text-gray-500 mb-4">Weighted pipeline value by stage</p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : !data ? (
        <p className="text-sm text-gray-500 py-4 text-center">No forecast data available</p>
      ) : (
        <>
          <p className="text-3xl font-semibold text-gray-900 mb-4">
            {formatCurrency(data.totalWeightedValue)}
          </p>
          {data.stageBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={data.stageBreakdown}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <XAxis
                  dataKey="stageName"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={((value: unknown) => [formatCurrency(Number(value)), 'Weighted Value']) as never}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="weightedValue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No stage data available</p>
          )}
        </>
      )}
    </div>
  );
}
