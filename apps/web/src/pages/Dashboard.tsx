import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatCurrency, formatRelativeTime } from '../lib/format.js';
import TopBar from '../components/layout/TopBar.js';
import StatCard from '../components/ui/StatCard.js';
import ActivityItem from '../components/ui/ActivityItem.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';

interface DashboardStats {
  activeDeals: number;
  pipelineValue: number;
  wonDeals: number;
  wonValue: number;
  activeProjects: number;
  openTasks: number;
  dueSoonTasks: number;
  emailsSentThisMonth: number;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<DashboardStats>('/api/dashboard/stats').then(setStats),
      api<ActivityRow[]>('/api/dashboard/activity?limit=10').then(setActivity),
      api<MyTask[]>('/api/dashboard/my-tasks').then(setMyTasks),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
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
            className="btn-primary"
          >
            New Lead
          </button>
        }
      />

      {loading && <LoadingSpinner />}
      {!loading && <div className="p-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:grid-cols-3">
          <div className="sm:col-span-1 lg:col-span-1">
            <StatCard
              label="Pipeline Value"
              value={stats ? formatCurrency(stats.pipelineValue) : '--'}
              hero
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2 grid grid-cols-1 gap-5 sm:grid-cols-2">
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
              label="Deals Won"
              value={stats?.wonDeals ?? '--'}
              trend={stats ? formatCurrency(stats.wonValue) + ' total' : undefined}
              trendColor="green"
            />
            <StatCard
              label="Emails Sent"
              value={stats?.emailsSentThisMonth ?? '--'}
              trend="this month"
              trendColor="blue"
            />
          </div>
        </div>

        {/* Two Column: Activity + Tasks */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Activity */}
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 tracking-tight">
              Recent Activity
            </h2>
            {activity.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="rounded-full bg-gray-50 p-3">
                  <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">No activity yet -- log a call or send an email to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
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
          <div className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 tracking-tight">
              My Tasks Due
            </h2>
            <div>
              {myTasks.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="rounded-full bg-emerald-50 p-3">
                    <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">No tasks due -- you're all caught up!</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {myTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-3 rounded-lg py-3 px-2 hover:bg-gray-50 transition-colors">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.priority === 'high' ? 'bg-red-500' :
                        task.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 font-medium">{task.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {task.projectName} · {task.milestoneName}
                          {task.dueDate && ` · Due ${new Date(task.dueDate).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}
