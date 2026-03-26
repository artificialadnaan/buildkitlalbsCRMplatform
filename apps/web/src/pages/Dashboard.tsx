import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatCurrency, formatRelativeTime } from '../lib/format.js';
import TopBar from '../components/layout/TopBar.js';
import StatCard from '../components/ui/StatCard.js';
import ActivityItem from '../components/ui/ActivityItem.js';

interface DashboardStats {
  activeDeals: number;
  pipelineValue: number;
  wonDeals: number;
  wonValue: number;
  activeProjects: number;
  openTasks: number;
  dueSoonTasks: number;
}

interface ActivityRow {
  activity: {
    id: string;
    type: string;
    subject: string | null;
    body: string | null;
    createdAt: string;
  };
  userName: string | null;
}

interface MyTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  milestoneName: string;
  projectName: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);

  useEffect(() => {
    api<DashboardStats>('/api/dashboard/stats').then(setStats).catch(console.error);
    api<ActivityRow[]>('/api/dashboard/activity?limit=10').then(setActivity).catch(console.error);
    api<MyTask[]>('/api/dashboard/my-tasks').then(setMyTasks).catch(console.error);
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div>
      <TopBar
        title="Dashboard"
        subtitle={today}
        actions={
          <button
            onClick={() => navigate('/leads')}
            className="rounded-lg bg-[#1F4D78] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a4268]"
          >
            New Lead
          </button>
        }
      />

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Deals"
            value={stats?.activeDeals ?? '--'}
          />
          <StatCard
            label="Active Projects"
            value={stats?.activeProjects ?? '--'}
            trend={stats?.openTasks ? `${stats.openTasks} open tasks` : undefined}
            trendColor="blue"
          />
          <StatCard
            label="Pipeline Value"
            value={stats ? formatCurrency(stats.pipelineValue) : '--'}
          />
          <StatCard
            label="Deals Won"
            value={stats?.wonDeals ?? '--'}
            trend={stats ? formatCurrency(stats.wonValue) + ' total' : undefined}
            trendColor="green"
          />
        </div>

        {/* Two Column: Activity + Tasks */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-gray-200 mb-3">
              Recent Activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No recent activity</p>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((row) => (
                  <ActivityItem
                    key={row.activity.id}
                    type={row.activity.type}
                    description={row.activity.subject ?? `${row.activity.type} logged`}
                    meta={`${row.userName ?? 'Unknown'} - ${formatRelativeTime(row.activity.createdAt)}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* My Tasks */}
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-gray-200 mb-3">
              My Tasks Due
            </h2>
            <div className="border-t border-border">
              {myTasks.length === 0 ? (
                <p className="text-sm text-gray-600 py-4 text-center">No tasks assigned to you</p>
              ) : (
                myTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      task.priority === 'high' ? 'bg-red-500' :
                      task.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300">{task.title}</div>
                      <div className="text-xs text-gray-600">
                        {task.projectName} · {task.milestoneName}
                        {task.dueDate && ` · Due ${new Date(task.dueDate).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
