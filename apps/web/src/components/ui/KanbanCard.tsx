import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../lib/format.js';

interface KanbanCardProps {
  id: string;
  title: string;
  companyName: string | null;
  value: number | null;
}

export default function KanbanCard({ id, title, companyName, value }: KanbanCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/deals/${id}`)}
      className="w-full rounded-md border border-border bg-white p-3 text-left cursor-pointer transition-all duration-150 ease-out shadow-sm hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5"
    >
      <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
      {companyName && (
        <p className="mt-1 text-xs text-gray-500 truncate">{companyName}</p>
      )}
      {value != null && (
        <p className="mt-1.5 text-xs font-medium text-emerald-600">{formatCurrency(value)}</p>
      )}
    </button>
  );
}
