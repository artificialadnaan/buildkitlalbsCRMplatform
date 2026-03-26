import { usePortalAuth } from '../lib/auth.js';
import ProgressBar from '../components/ui/ProgressBar.js';
import MilestoneTimeline from '../components/ui/MilestoneTimeline.js';

export default function ProjectStatus() {
  const { activeProject } = usePortalAuth();

  if (!activeProject) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">No projects found.</p>
      </div>
    );
  }

  const project = activeProject as {
    id: string;
    name: string;
    type: string;
    status: string;
    startDate: string | null;
    targetLaunchDate: string | null;
    progressPercent: number;
    milestones: { id: string; name: string; status: 'pending' | 'in_progress' | 'done'; dueDate: string | null; position: number }[];
  };

  const statusLabel: Record<string, string> = {
    active: 'In Progress',
    on_hold: 'On Hold',
    completed: 'Completed',
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-200">{project.name}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {statusLabel[project.status] || project.status}
          {project.targetLaunchDate && ` \u2014 Target launch: ${new Date(project.targetLaunchDate).toLocaleDateString()}`}
        </p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 mb-6">
        <ProgressBar percent={project.progressPercent} label="Overall Progress" />
      </div>

      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="font-semibold text-gray-200 mb-4">Milestones</h3>
        {project.milestones && project.milestones.length > 0 ? (
          <MilestoneTimeline milestones={project.milestones} />
        ) : (
          <p className="text-sm text-gray-600">No milestones defined yet.</p>
        )}
      </div>
    </div>
  );
}
