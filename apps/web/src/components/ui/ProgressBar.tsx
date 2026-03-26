interface ProgressBarProps {
  value?: number; // 0-100
  percent?: number; // 0-100 (alias for value, backward compat)
  label?: string;
  color?: string;
  showPercentage?: boolean;
}

export default function ProgressBar({
  value,
  percent,
  label,
  color = 'bg-blue-500',
  showPercentage = true,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value ?? percent ?? 0));

  return (
    <div>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-gray-500">{label}</span>}
          {showPercentage && <span className="text-xs text-gray-500">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
