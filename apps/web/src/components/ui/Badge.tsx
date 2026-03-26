export type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'gray';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  blue: 'bg-[#1F4D78]/20 text-[#5a8fc4] border-[#1F4D78]/30',
  gray: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export default function Badge({ label, variant = 'gray' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}
    >
      {label}
    </span>
  );
}
