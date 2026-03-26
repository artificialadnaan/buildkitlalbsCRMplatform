import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import TopBar from '../components/layout/TopBar.js';

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string | null;
  pipelineId: string;
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  stages: Stage[];
}

const DEFAULT_COLORS = [
  '#d4a054', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#6b7280', '#f97316', '#14b8a6',
];

const PLATFORM_FEATURES = [
  {
    title: 'Lead Scraper',
    icon: '🔍',
    description: 'Find new business leads by scraping Google Maps across zip codes and cities.',
    howTo: [
      'Navigate to Scraper in the sidebar',
      'Select cities or enter zip codes manually',
      'Choose a business category or enter a custom search',
      'Click "Scrape" and watch leads flow into your pipeline',
    ],
    tips: 'Use the map view to drop a pin and set a radius for geographic targeting. Start with a single city to test before scaling up.',
  },
  {
    title: 'Pipeline Management',
    icon: '📊',
    description: 'Organize your deals through customizable pipeline stages with drag-and-drop kanban boards.',
    howTo: [
      'Go to Pipelines to view your Kanban board',
      'Drag deals between stages to update their status',
      'Click any deal card for full details, notes, and activity history',
      'Use the Settings page below to customize stages',
    ],
    tips: 'Create separate pipelines for different business types (Local vs Construction) to keep your workflow organized.',
  },
  {
    title: 'Email Templates',
    icon: '✉️',
    description: 'Create reusable, humanized email templates with dynamic variables that personalize each send.',
    howTo: [
      'Go to Templates in the sidebar',
      'Click "+ New Template" to create from scratch or start from a pre-built human template',
      'Use variables like {{contact.first_name}} and {{company.name}} for personalization',
      'Preview with sample data before saving',
    ],
    tips: 'The best-performing emails are short (3-5 sentences), ask one question, and sound like they came from a real person — not a marketing team.',
  },
  {
    title: 'Email Sequences',
    icon: '🔄',
    description: 'Build multi-step automated email sequences with configurable delays between each touch.',
    howTo: [
      'Navigate to Sequences in the sidebar',
      'Create a new sequence and select the pipeline type',
      'Add steps, assign templates, and set delay intervals',
      'Enroll leads from the Leads page or Deal Detail view',
    ],
    tips: 'A 3-touch sequence (Day 1, Day 3, Day 7) with a breakup email at the end typically gets the best response rates.',
  },
  {
    title: 'Lead Scoring',
    icon: '🎯',
    description: 'Automatically score leads based on completeness of data, Google ratings, and engagement signals.',
    howTo: [
      'Scores are calculated automatically when leads are imported or scraped',
      'View scores on the Leads table — sort by score to prioritize outreach',
      'Use "Rescore All" to recalculate scores after adding new data',
    ],
    tips: 'Focus your outreach on leads scoring 70+ first. These have the most complete data and highest engagement potential.',
  },
  {
    title: 'Projects & Time Tracking',
    icon: '📁',
    description: 'Manage client projects with milestones, tasks, and built-in time tracking for billing.',
    howTo: [
      'Create a project from the Projects page',
      'Add milestones and break them into tasks',
      'Assign tasks to team members with due dates and priorities',
      'Use Time Tracking to log hours against projects for invoicing',
    ],
    tips: 'Link projects to won deals so you have full visibility from lead → deal → project → invoice.',
  },
  {
    title: 'Invoicing',
    icon: '💰',
    description: 'Generate and manage invoices tied to projects, with line items and payment tracking.',
    howTo: [
      'Navigate to Invoices in the sidebar',
      'Create a new invoice and link it to a project',
      'Add line items, set due dates, and send to clients',
      'Track payment status (Draft, Sent, Paid, Overdue)',
    ],
    tips: 'Use time tracking data to auto-populate invoice line items for accurate billing.',
  },
  {
    title: 'Analytics & Reporting',
    icon: '📈',
    description: 'Track pipeline performance, deal velocity, team activity, and email engagement metrics.',
    howTo: [
      'Go to Analytics for pipeline stage metrics and trends',
      'View rep leaderboards to track team performance',
      'Monitor email open/click rates from the email tracking data',
      'Use the Dashboard for a daily overview of key metrics',
    ],
    tips: 'Check analytics weekly to spot bottlenecks — if deals are stalling at a specific stage, that\'s where to focus improvement efforts.',
  },
  {
    title: 'Client Portal',
    icon: '🌐',
    description: 'Give clients a branded portal to view project status, files, invoices, and messages.',
    howTo: [
      'Clients access the portal via a magic link (no password needed)',
      'They can view their project timeline, milestones, and files',
      'Message threads keep communication organized in one place',
      'Invoices are visible with payment status',
    ],
    tips: 'Send the portal link after closing a deal to immediately establish a professional client experience.',
  },
  {
    title: 'Import & Export',
    icon: '📤',
    description: 'Bulk import leads from CSV files or export your data for external use.',
    howTo: [
      'Use "Export CSV" on the Leads page to download your lead data',
      'Import leads via the Import page with a properly formatted CSV',
      'Select leads and use bulk actions for batch operations',
    ],
    tips: 'When importing, make sure your CSV headers match: name, type, phone, website, city, state, zip, industry.',
  },
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {DEFAULT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded-full border-2 transition-transform ${
            value === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function StageRow({
  stage,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMove,
}: {
  stage: Stage;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (id: string, data: Partial<Stage>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, direction: 'up' | 'down') => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color ?? '#6b7280');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(stage.id, { name, color });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(stage.name);
    setColor(stage.color ?? '#6b7280');
    setEditing(false);
    setConfirmDelete(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await onDelete(stage.id);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50/30 px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field max-w-xs"
            placeholder="Stage name"
            autoFocus
          />
          <span className="text-xs text-gray-400">Position {stage.position}</span>
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary text-xs py-1.5"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            className="btn-secondary text-xs py-1.5"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 group hover:border-gray-200 transition-colors">
      <span
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: stage.color ?? '#6b7280' }}
      />
      <span className="text-sm text-gray-900 font-medium">{stage.name}</span>
      <span className="ml-auto text-xs text-gray-400">Position {stage.position}</span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onMove(stage.id, 'up')}
          disabled={isFirst}
          className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Move up"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={() => onMove(stage.id, 'down')}
          disabled={isLast}
          className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Move down"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-brand-600 transition-colors"
          title="Edit stage"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={saving}
              className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? '...' : 'Confirm'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete stage"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function AddStageForm({
  pipelineId,
  nextPosition,
  onAdded,
}: {
  pipelineId: string;
  nextPosition: number;
  onAdded: (stage: Stage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#d4a054');
  const [position, setPosition] = useState(nextPosition);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPosition(nextPosition);
  }, [nextPosition]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const stage = await api<Stage>(`/api/pipelines/${pipelineId}/stages`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), color, position }),
      });
      onAdded(stage);
      setName('');
      setColor('#d4a054');
      setPosition(nextPosition + 1);
      setOpen(false);
    } catch (err) {
      console.error('Failed to add stage:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-dashed border-gray-200 px-4 py-2.5 text-xs font-medium text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Add Stage
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/30 px-4 py-3 space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field max-w-xs"
          placeholder="Stage name"
          autoFocus
        />
        <input
          type="number"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="input-field w-20"
          placeholder="Pos"
          min={0}
        />
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="btn-primary text-xs py-1.5"
        >
          {saving ? 'Adding...' : 'Add Stage'}
        </button>
        <button
          onClick={() => { setOpen(false); setName(''); }}
          className="btn-secondary text-xs py-1.5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activeSection, setActiveSection] = useState<'guide' | 'pipelines'>('guide');
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);

  const fetchPipelines = () => {
    api<Pipeline[]>('/api/pipelines').then(setPipelines).catch(console.error);
  };

  useEffect(() => {
    fetchPipelines();
  }, []);

  const handleUpdateStage = async (stageId: string, data: Partial<Stage>) => {
    await api<Stage>(`/api/pipelines/stages/${stageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    fetchPipelines();
  };

  const handleDeleteStage = async (stageId: string) => {
    await api<{ success: boolean }>(`/api/pipelines/stages/${stageId}`, {
      method: 'DELETE',
    });
    fetchPipelines();
  };

  const handleMoveStage = async (stageId: string, direction: 'up' | 'down') => {
    for (const pipeline of pipelines) {
      const sorted = [...pipeline.stages].sort((a, b) => a.position - b.position);
      const idx = sorted.findIndex((s) => s.id === stageId);
      if (idx === -1) continue;

      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;

      const current = sorted[idx];
      const swap = sorted[swapIdx];

      await Promise.all([
        api(`/api/pipelines/stages/${current.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ position: swap.position }),
        }),
        api(`/api/pipelines/stages/${swap.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ position: current.position }),
        }),
      ]);
      fetchPipelines();
      return;
    }
  };

  const handleStageAdded = () => {
    fetchPipelines();
  };

  if (user?.role !== 'admin') {
    return (
      <div>
        <TopBar title="Settings" />
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400">Only admins can access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Settings" subtitle="Platform configuration & feature guide" />

      <div className="p-8">
        {/* Section Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveSection('guide')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeSection === 'guide'
                ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent'
            }`}
          >
            Platform Guide
          </button>
          <button
            onClick={() => setActiveSection('pipelines')}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeSection === 'pipelines'
                ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent'
            }`}
          >
            Pipeline Stages
          </button>
        </div>

        {/* Platform Guide */}
        {activeSection === 'guide' && (
          <div className="space-y-3">
            <div className="card p-6 mb-6 bg-gradient-to-r from-brand-50/50 to-white border-brand-100">
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-2">BuildKit CRM Platform Guide</h2>
              <p className="text-sm text-gray-500 max-w-2xl">
                Everything your platform can do, and how to use each feature effectively.
                Click any feature below to expand the full guide.
              </p>
            </div>

            {PLATFORM_FEATURES.map((feature, idx) => (
              <div key={idx} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedFeature(expandedFeature === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{feature.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{feature.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{feature.description}</p>
                    </div>
                  </div>
                  <svg
                    className={`h-5 w-5 text-gray-400 transition-transform ${expandedFeature === idx ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedFeature === idx && (
                  <div className="px-5 pb-5 pt-0 border-t border-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">How to Use</h4>
                        <ol className="space-y-2">
                          {feature.howTo.map((step, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="bg-brand-50 text-brand-600 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span className="text-sm text-gray-700">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Pro Tip</h4>
                        <div className="rounded-xl bg-brand-50/50 border border-brand-100 p-4">
                          <p className="text-sm text-brand-800 leading-relaxed">{feature.tips}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pipeline Stages */}
        {activeSection === 'pipelines' && (
          <div className="space-y-6">
            {pipelines.map((pipeline) => {
              const sortedStages = [...pipeline.stages].sort((a, b) => a.position - b.position);
              const nextPosition = sortedStages.length > 0
                ? sortedStages[sortedStages.length - 1].position + 1
                : 0;

              return (
                <div key={pipeline.id} className="card p-6">
                  <div className="mb-5">
                    <h2 className="text-base font-semibold text-gray-900 tracking-tight">{pipeline.name}</h2>
                    {pipeline.description && (
                      <p className="mt-0.5 text-sm text-gray-400">{pipeline.description}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {sortedStages.map((stage, idx) => (
                      <StageRow
                        key={stage.id}
                        stage={stage}
                        isFirst={idx === 0}
                        isLast={idx === sortedStages.length - 1}
                        onUpdate={handleUpdateStage}
                        onDelete={handleDeleteStage}
                        onMove={handleMoveStage}
                      />
                    ))}
                  </div>

                  <div className="mt-3">
                    <AddStageForm
                      pipelineId={pipeline.id}
                      nextPosition={nextPosition}
                      onAdded={handleStageAdded}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
