type TrendColor = 'green' | 'red' | 'gray' | 'blue';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: TrendColor;
  hero?: boolean;
}

export default function StatCard({ label, value, trend, trendColor = 'gray', hero = false }: StatCardProps) {
  const trendColors: Record<TrendColor, string> = {
    green: 'text-emerald-600',
    red: 'text-red-600',
    gray: 'text-gray-500',
    blue: 'text-[#1F4D78]',
  };

  if (hero) {
    return (
      <div className="rounded-lg bg-surface border border-border border-l-4 border-l-[#1F4D78] p-7 flex flex-col justify-center h-full shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
        <p className="mt-3 text-4xl font-bold text-gray-900">{value}</p>
        {trend && (
          <p className={`mt-2 text-xs ${trendColors[trendColor]}`}>{trend}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-surface border border-border p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {trend && (
        <p className={`mt-1 text-xs ${trendColors[trendColor]}`}>{trend}</p>
      )}
    </div>
  );
}
