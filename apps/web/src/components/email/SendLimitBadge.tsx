import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

interface DailyCount {
  count: number;
  limit: number;
  remaining: number;
  warningThreshold: boolean;
}

export default function SendLimitBadge() {
  const [data, setData] = useState<DailyCount | null>(null);

  useEffect(() => {
    api<DailyCount>('/api/email-sends/daily-count').then(setData);
  }, []);

  if (!data) return null;

  const percentage = Math.round((data.count / data.limit) * 100);
  const color = data.warningThreshold ? 'text-amber-500' : 'text-gray-500';

  return (
    <div className={`text-xs ${color}`}>
      {data.count}/{data.limit} sent today ({percentage}%)
      {data.warningThreshold && ' — approaching limit'}
    </div>
  );
}
