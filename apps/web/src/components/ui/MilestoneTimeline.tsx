import Badge from './Badge.js';

interface Milestone {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'done';
  dueDate: string | null;
  position: number;
}

interface MilestoneTimelineProps {
  milestones: Milestone[];
  activeMilestoneId?: string;
  onMilestoneClick?: (milestone: Milestone) => void;
}

const statusVariant: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple'> = {
  pending: 'gray',
  in_progress: 'amber',
  done: 'green',
};

const statusLabel: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

export default function MilestoneTimeline({ milestones, activeMilestoneId, onMilestoneClick }: MilestoneTimelineProps) {
  const sorted = [...milestones].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-1">
      {sorted.map((milestone, index) => {
        const isActive = milestone.id === activeMilestoneId;
        const isLast = index === sorted.length - 1;

        return (
          <div key={milestone.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  milestone.status === 'done'
                    ? 'bg-green-500'
                    : milestone.status === 'in_progress'
                    ? 'bg-amber-500'
                    : 'bg-gray-600'
                }`}
              />
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[24px] ${
                  milestone.status === 'done' ? 'bg-green-500/30' : 'bg-gray-700'
                }`} />
              )}
            </div>

            <div
              onClick={() => onMilestoneClick?.(milestone)}
              className={`flex-1 pb-3 -mt-0.5 ${
                onMilestoneClick ? 'cursor-pointer' : ''
              } ${isActive ? 'bg-white/5 -mx-2 px-2 rounded-md' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${isActive ? 'text-gray-200' : 'text-gray-400'}`}>
                  {milestone.name}
                </span>
                <Badge label={statusLabel[milestone.status]} variant={statusVariant[milestone.status]} />
              </div>
              {milestone.dueDate && (
                <div className="text-xs text-gray-600 mt-0.5">
                  Due {new Date(milestone.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
