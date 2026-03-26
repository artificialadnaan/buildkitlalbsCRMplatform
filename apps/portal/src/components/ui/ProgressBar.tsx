interface ProgressBarProps {
  percent: number;
  label?: string;
}

export default function ProgressBar({ percent, label }: ProgressBarProps) {
  const clampedPercent = Math.max(0, Math.min(100, percent));

  return (
    <div>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">{label}</span>
          <span className="text-sm font-medium text-gray-200">{clampedPercent}%</span>
        </div>
      )}
      <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  );
}
