interface ActivityItemProps {
  type: string;
  description: string;
  meta: string;
}

const dotColors: Record<string, string> = {
  email: 'bg-blue-400',
  call: 'bg-emerald-400',
  text: 'bg-purple-400',
  note: 'bg-amber-400',
  meeting: 'bg-cyan-400',
};

export default function ActivityItem({ type, description, meta }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColors[type] ?? 'bg-gray-500'}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900 truncate">{description}</p>
        <p className="text-xs text-gray-500 mt-0.5">{meta}</p>
      </div>
    </div>
  );
}
