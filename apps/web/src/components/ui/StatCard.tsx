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
    blue: 'text-brand-600',
  };

  if (hero) {
    return (
      <div className="card relative overflow-hidden border-l-4 border-l-brand-500 p-7 flex flex-col justify-center h-full">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-brand-50 to-transparent rounded-bl-full opacity-60" />
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{label}</p>
        <p className="mt-3 text-4xl font-bold text-gray-900 tracking-tight">{value}</p>
        {trend && (
          <p className={`mt-2 text-xs font-medium ${trendColors[trendColor]}`}>{trend}</p>
        )}
      </div>
    );
  }

  return (
    <div className="card p-5 group hover:border-gray-200">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      {trend && (
        <p className={`mt-1.5 text-xs font-medium ${trendColors[trendColor]}`}>{trend}</p>
      )}
    </div>
  );
}
