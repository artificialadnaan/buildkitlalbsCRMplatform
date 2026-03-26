import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../lib/format.js';

interface KanbanCardProps {
  id: string;
  title: string;
  companyName: string | null;
  value: number | null;
  stageColor?: string | null;
  stagePosition?: number | null;
  totalStages?: number;
}

export default function KanbanCard({ id, title, companyName, value, stageColor, stagePosition, totalStages }: KanbanCardProps) {
  const navigate = useNavigate();

  // Progress based on position in pipeline
  const progress = stagePosition != null && totalStages
    ? Math.round((stagePosition / totalStages) * 100)
    : 0;

  // Determine beam color
  const beamColor = stageColor ?? '#9d4300';

  // Generate initials from company name for avatar
  const initials = companyName
    ? companyName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'N/A';

  return (
    <button
      onClick={() => navigate(`/deals/${id}`)}
      className="w-full bg-[#e7eeff] rounded-lg p-5 text-left cursor-pointer transition-all duration-150 ease-out shadow-sm hover:shadow-md hover:-translate-y-0.5 relative"
      style={{ borderLeft: `4px solid ${beamColor}` }}
    >
      {/* Header: Tag + Value */}
      <div className="flex justify-between items-start mb-3">
        {companyName && (
          <span className="bg-orange-100 text-orange-800 text-[9px] font-black px-2 py-1 rounded-sm uppercase tracking-tight truncate max-w-[60%]">
            {companyName}
          </span>
        )}
        {value != null && (
          <span className="text-[11px] font-bold text-slate-500 shrink-0 ml-2">
            {formatCurrency(value)}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="font-bold text-slate-900 text-base leading-tight mb-3 line-clamp-2">{title}</h4>

      {/* Avatar */}
      <div className="flex items-center mb-4">
        <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-[8px] font-bold text-slate-600">
          {initials}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.max(progress, 5)}%`,
            background: `linear-gradient(45deg, #9d4300, #f97316)`,
          }}
        />
      </div>
    </button>
  );
}
