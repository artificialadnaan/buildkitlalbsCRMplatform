export type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  blue: 'bg-brand-50 text-brand-700 border-brand-100',
  gray: 'bg-gray-50 text-gray-600 border-gray-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
};

export default function Badge({ label, variant = 'gray' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}
    >
      {label}
    </span>
  );
}
