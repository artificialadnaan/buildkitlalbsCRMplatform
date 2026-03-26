import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatCurrency, formatRelativeTime } from '../lib/format.js';
import TopBar from '../components/layout/TopBar.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';
import ForecastWidget from '../components/ui/ForecastWidget.js';

interface MyStats {
  myActiveDeals: number;
  myActiveDealValue: number;
  myTasksDueToday: number;
  myEmailsThisWeek: number;
  myWinRate: number;
}

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

const activityIcons: Record<string, { icon: string; bg: string; text: string }> = {
  email: { icon: 'mail', bg: 'bg-blue-100', text: 'text-blue-600' },
  call: { icon: 'call', bg: 'bg-green-100', text: 'text-green-600' },
  meeting: { icon: 'calendar_today', bg: 'bg-orange-100', text: 'text-orange-600' },
  note: { icon: 'ink_pen', bg: 'bg-purple-100', text: 'text-purple-600' },
  text: { icon: 'sms', bg: 'bg-teal-100', text: 'text-teal-600' },
};

function getActivityStyle(type: string) {
  return activityIcons[type] || { icon: 'info', bg: 'bg-gray-100', text: 'text-gray-600' };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [myStats, setMyStats] = useState<MyStats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<DashboardStats>('/api/dashboard/stats').then(setStats),
      api<MyStats>('/api/dashboard/my-stats').then(setMyStats),
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

  const urgentCount = myTasks.filter(t => t.priority === 'high').length;

  return (
    <div>
      <TopBar title="Project Overview" subtitle={today} />

      {loading && <LoadingSpinner />}
      {!loading && (
        <div className="p-8 space-y-8">
          {/* Hero Metric Cards */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard
              label="Pipeline Value"
              value={stats ? formatCurrency(stats.pipelineValue) : '--'}
              beamColor="bg-orange-700"
              trend={stats ? '+8.2% vs last month' : undefined}
              trendIcon="trending_up"
              trendColor="text-green-600"
            />
            <MetricCard
              label="Active Deals"
              value={String(stats?.activeDeals ?? '--')}
              beamColor="bg-orange-500"
              trend={stats?.dueSoonTasks ? `${stats.dueSoonTasks} Closing this week` : undefined}
              trendIcon="history"
              trendColor="text-slate-600"
            />
            <MetricCard
              label="Deals Won"
              value={String(stats?.wonDeals ?? '--')}
              beamColor="bg-slate-500"
              trend={stats ? `YTD ${formatCurrency(stats.wonValue)}` : undefined}
              trendIcon="check_circle"
              trendColor="text-slate-600"
            />
            <MetricCard
              label="Active Projects"
              value={String(stats?.activeProjects ?? '--')}
              beamColor="bg-orange-700"
              trend={stats?.openTasks ? `${stats.openTasks} open tasks` : undefined}
              trendIcon="assignment"
              trendColor="text-slate-600"
            />
          </section>

          {/* Personal Stats */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Stats</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#e7eeff] p-6 relative overflow-hidden border-l-4 border-purple-500">
                <p className="text-xs font-label uppercase tracking-[0.15em] text-slate-500 mb-1">My Active Deals</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{myStats?.myActiveDeals ?? '--'}</h3>
                <p className="mt-2 text-xs font-bold text-slate-500">{myStats ? formatCurrency(myStats.myActiveDealValue) : '--'}</p>
              </div>
              <div className="bg-[#e7eeff] p-6 relative overflow-hidden border-l-4 border-purple-500">
                <p className="text-xs font-label uppercase tracking-[0.15em] text-slate-500 mb-1">Tasks Due Today</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{myStats?.myTasksDueToday ?? '--'}</h3>
                <div className="mt-2 flex items-center text-xs font-bold text-slate-500">
                  <span className="material-symbols-outlined text-sm mr-1">task_alt</span>
                  pending
                </div>
              </div>
              <div className="bg-[#e7eeff] p-6 relative overflow-hidden border-l-4 border-purple-500">
                <p className="text-xs font-label uppercase tracking-[0.15em] text-slate-500 mb-1">Emails This Week</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{myStats?.myEmailsThisWeek ?? '--'}</h3>
                <div className="mt-2 flex items-center text-xs font-bold text-slate-500">
                  <span className="material-symbols-outlined text-sm mr-1">mail</span>
                  since Sunday
                </div>
              </div>
              <div className="bg-[#e7eeff] p-6 relative overflow-hidden border-l-4 border-purple-500">
                <p className="text-xs font-label uppercase tracking-[0.15em] text-slate-500 mb-1">Win Rate</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{myStats != null ? `${myStats.myWinRate}%` : '--'}</h3>
                <div className="mt-2 flex items-center text-xs font-bold text-slate-500">
                  <span className="material-symbols-outlined text-sm mr-1">emoji_events</span>
                  last 90 days
                </div>
              </div>
            </div>
          </div>

          {/* Main Grid: Activity + Tasks */}
          <div className="grid grid-cols-12 gap-8">
            {/* Left: Activity Feed */}
            <div className="col-span-12 lg:col-span-8 space-y-8">
              {/* Stats Bar */}
              <section className="bg-[#e7eeff] p-1 overflow-hidden">
                <div className="bg-slate-900 p-6 flex justify-between items-center">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                      <h4 className="text-white font-black uppercase tracking-widest text-sm">Live Activity Feed</h4>
                    </div>
                    <p className="text-slate-400 text-xs mt-1">
                      {activity.length > 0 ? `${activity.length} recent interactions` : 'No recent activity'}
                    </p>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-[#f0f3ff]">
                    <div>
                      <p className="text-xs font-label uppercase tracking-wider text-slate-500">Emails Sent</p>
                      <p className="text-2xl font-black text-slate-900">{stats?.emailsSentThisMonth ?? '--'}</p>
                    </div>
                    <span className="material-symbols-outlined text-orange-500 text-3xl opacity-20">mail</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-[#f0f3ff]">
                    <div>
                      <p className="text-xs font-label uppercase tracking-wider text-slate-500">Open Tasks</p>
                      <p className="text-2xl font-black text-slate-900">{stats?.openTasks ?? '--'}</p>
                    </div>
                    <span className="material-symbols-outlined text-orange-500 text-3xl opacity-20">task_alt</span>
                  </div>
                </div>
              </section>

              {/* Recent Activity */}
              <section className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <h4 className="text-lg font-black uppercase tracking-tighter text-slate-900">Recent Activity</h4>
                  <button
                    onClick={() => navigate('/analytics')}
                    className="text-xs font-label uppercase tracking-widest text-orange-700 font-bold hover:underline"
                  >
                    View All Logs
                  </button>
                </div>
                <div className="bg-white overflow-hidden">
                  {activity.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                      <span className="material-symbols-outlined text-4xl text-slate-300">forum</span>
                      <p className="text-sm text-slate-500">No activity yet — log a call or send an email to get started</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {activity.map((row) => {
                        const style = getActivityStyle(row.activity.type);
                        return (
                          <div key={row.activity.id} className="p-4 flex items-center space-x-4 hover:bg-slate-50 transition-colors">
                            <div className={`w-10 h-10 rounded ${style.bg} flex items-center justify-center ${style.text}`}>
                              <span className="material-symbols-outlined">{style.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {row.activity.subject ?? `${row.activity.type} logged`}
                              </p>
                              <p className="text-xs text-slate-500">{row.userName ?? 'Unknown'}</p>
                            </div>
                            <p className="text-[10px] font-label uppercase text-slate-400 shrink-0">
                              {formatRelativeTime(row.activity.createdAt)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* Forecast */}
              <ForecastWidget />
            </div>

            {/* Right: Tasks */}
            <div className="col-span-12 lg:col-span-4">
              <section className="bg-[#e7eeff] h-full p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-lg font-black uppercase tracking-tighter text-slate-900">My Tasks Due</h4>
                  {urgentCount > 0 && (
                    <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      {urgentCount} URGENT
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {myTasks.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                      <span className="material-symbols-outlined text-4xl text-slate-300">check_circle</span>
                      <p className="text-sm text-slate-500">No tasks due — you're all caught up!</p>
                    </div>
                  ) : (
                    myTasks.map(task => (
                      <div
                        key={task.id}
                        className={`bg-white p-4 relative group ${
                          task.priority === 'high'
                            ? 'border-l-4 border-orange-700'
                            : 'border-l-4 border-slate-300'
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-900 group-hover:text-orange-700 transition-colors">
                          {task.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {task.projectName} · {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}
                        </p>
                        <div className="mt-4 flex justify-end">
                          {task.priority === 'high' ? (
                            <button className="bg-orange-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-sm hover:bg-orange-600 transition-all">
                              Execute
                            </button>
                          ) : (
                            <button className="text-slate-500 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-sm border border-slate-200 hover:bg-slate-50 transition-all">
                              Review
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-8">
                  <button
                    onClick={() => navigate('/projects')}
                    className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center space-x-2 hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Create New Task</span>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Metric Card Component
function MetricCard({
  label,
  value,
  beamColor,
  trend,
  trendIcon,
  trendColor,
}: {
  label: string;
  value: string;
  beamColor: string;
  trend?: string;
  trendIcon?: string;
  trendColor?: string;
}) {
  return (
    <div className="bg-[#e7eeff] p-6 relative overflow-hidden group">
      <div className={`w-1 h-full absolute left-0 top-0 ${beamColor}`} />
      <p className="text-xs font-label uppercase tracking-[0.15em] text-slate-500 mb-1">{label}</p>
      <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h3>
      {trend && (
        <div className={`mt-4 flex items-center text-xs font-bold ${trendColor || 'text-slate-600'}`}>
          {trendIcon && <span className="material-symbols-outlined text-sm mr-1">{trendIcon}</span>}
          {trend}
        </div>
      )}
    </div>
  );
}
