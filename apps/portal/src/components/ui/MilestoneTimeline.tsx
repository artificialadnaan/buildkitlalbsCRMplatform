interface Milestone {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'done';
  dueDate: string | null;
  position: number;
}

interface MilestoneTimelineProps {
  milestones: Milestone[];
}

const statusConfig = {
  done: { color: 'bg-green-500', border: 'border-green-500', text: 'text-green-500', label: 'Completed' },
  in_progress: { color: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', label: 'In Progress' },
  pending: { color: 'bg-gray-700', border: 'border-gray-600', text: 'text-gray-500', label: 'Upcoming' },
};

export default function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  const sorted = [...milestones].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-0">
      {sorted.map((milestone, index) => {
        const config = statusConfig[milestone.status];
        const isLast = index === sorted.length - 1;

        return (
          <div key={milestone.id} className="flex gap-4">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={`w-4 h-4 rounded-full ${config.color} border-2 ${config.border} flex-shrink-0`} />
              {!isLast && <div className="w-0.5 flex-1 min-h-[40px] bg-gray-700" />}
            </div>

            {/* Content */}
            <div className="pb-6">
              <div className="text-sm font-medium text-gray-200">{milestone.name}</div>
              <div className={`text-xs ${config.text} mt-0.5`}>{config.label}</div>
              {milestone.dueDate && (
                <div className="text-xs text-gray-600 mt-0.5">
                  Due: {new Date(milestone.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
