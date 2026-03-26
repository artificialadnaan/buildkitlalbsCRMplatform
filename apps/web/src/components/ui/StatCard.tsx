type TrendColor = 'green' | 'red' | 'gray' | 'blue';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: TrendColor;
}

export default function StatCard({ label, value, trend, trendColor = 'gray' }: StatCardProps) {
  const trendColors: Record<TrendColor, string> = {
    green: 'text-emerald-400',
    red: 'text-red-400',
    gray: 'text-gray-500',
    blue: 'text-[#1F4D78]',
  };

  return (
    <div className="rounded-lg bg-surface border border-border p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-100">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs ${trendColors[trendColor]}`}>{trend}</p>
      )}
    </div>
  );
}
