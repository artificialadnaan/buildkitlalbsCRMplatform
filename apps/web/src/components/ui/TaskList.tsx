import Badge from './Badge.js';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
  assignedToName: string | null;
}

interface TaskListProps {
  tasks: Task[];
  onToggleStatus: (taskId: string, newStatus: string) => void;
  onTaskClick?: (task: Task) => void;
}

const priorityVariant: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple'> = {
  low: 'gray',
  medium: 'amber',
  high: 'red',
};

const statusCycle: Record<string, string> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

export default function TaskList({ tasks, onToggleStatus, onTaskClick }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-sm text-gray-600 py-4 text-center">
        No tasks yet — add one to get started
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tasks.map(task => (
        <div
          key={task.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 group"
        >
          <button
            onClick={() => onToggleStatus(task.id, statusCycle[task.status])}
            className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition ${
              task.status === 'done'
                ? 'bg-green-500 border-green-500 text-white'
                : task.status === 'in_progress'
                ? 'bg-amber-500/20 border-amber-500'
                : 'border-gray-600 hover:border-gray-400'
            }`}
          >
            {task.status === 'done' && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {task.status === 'in_progress' && (
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </button>

          <div
            className={`flex-1 min-w-0 ${onTaskClick ? 'cursor-pointer' : ''}`}
            onClick={() => onTaskClick?.(task)}
          >
            <div className={`text-sm ${task.status === 'done' ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
              {task.title}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge label={task.priority} variant={priorityVariant[task.priority]} />
              {task.assignedToName && (
                <span className="text-xs text-gray-600">{task.assignedToName}</span>
              )}
              {task.dueDate && (
                <span className="text-xs text-gray-600">
                  Due {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
