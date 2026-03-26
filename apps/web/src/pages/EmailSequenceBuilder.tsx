import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import { api } from '../lib/api.js';

interface Template {
  id: string;
  name: string;
  subject: string;
  pipelineType: string;
}

interface StepInput {
  templateId: string;
  stepNumber: number;
  delayDays: number;
}

interface SequenceData {
  sequence: { id: string; name: string; pipelineType: string };
  steps: Array<StepInput & { id?: string; templateName?: string; templateSubject?: string }>;
}

export default function EmailSequenceBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [pipelineType, setPipelineType] = useState<'local' | 'construction'>('local');
  const [steps, setSteps] = useState<StepInput[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);

  // Load templates
  useEffect(() => {
    api<{ data: Template[] }>('/api/email-templates').then(r => setTemplates(r.data));
  }, []);

  // Load existing sequence
  useEffect(() => {
    if (!isNew && id) {
      api<SequenceData>(`/api/email-sequences/${id}`).then(data => {
        setName(data.sequence.name);
        setPipelineType(data.sequence.pipelineType as 'local' | 'construction');
        setSteps(data.steps.map(s => ({
          templateId: s.templateId,
          stepNumber: s.stepNumber,
          delayDays: s.delayDays,
        })));
      });
    }
  }, [id, isNew]);

  function addStep() {
    setSteps(prev => [
      ...prev,
      { templateId: '', stepNumber: prev.length + 1, delayDays: prev.length === 0 ? 0 : 3 },
    ]);
  }

  function removeStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepNumber: i + 1 })));
  }

  function updateStep(index: number, updates: Partial<StepInput>) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  }

  async function handleSave() {
    if (!name || steps.length === 0 || steps.some(s => !s.templateId)) return;
    setSaving(true);

    try {
      if (isNew) {
        await api('/api/email-sequences', {
          method: 'POST',
          body: JSON.stringify({ name, pipelineType, steps }),
        });
      } else {
        await api(`/api/email-sequences/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, pipelineType, steps }),
        });
      }
      navigate('/email/sequences');
    } finally {
      setSaving(false);
    }
  }

  const filteredTemplates = templates.filter(t => t.pipelineType === pipelineType);

  return (
    <div>
      <TopBar
        title={isNew ? 'New Sequence' : 'Edit Sequence'}
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !name || steps.length === 0}
              className="bg-blue-600 px-3 py-2 rounded-md text-sm text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Sequence'}
            </button>
            <button
              onClick={() => navigate('/email/sequences')}
              className="bg-border border border-gray-700 px-3 py-2 rounded-md text-sm text-gray-400"
            >
              Cancel
            </button>
          </div>
        }
      />

      <div className="max-w-2xl space-y-4">
        {/* Sequence info */}
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sequence Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Construction 3-Touch Outreach"
              className="w-full bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pipeline Type</label>
            <select
              value={pipelineType}
              onChange={e => { setPipelineType(e.target.value as 'local' | 'construction'); setSteps([]); }}
              className="w-full bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300"
            >
              <option value="local">Local Business</option>
              <option value="construction">Construction</option>
            </select>
          </div>
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-300">Steps</h3>
            <button
              onClick={addStep}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              + Add Step
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={index} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge label={`Step ${step.stepNumber}`} variant="blue" />
                    {index > 0 && (
                      <span className="text-xs text-gray-600">
                        Wait {step.delayDays} day{step.delayDays !== 1 ? 's' : ''} after previous
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeStep(index)}
                    className="text-red-500 hover:text-red-400 text-xs"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Template</label>
                    <select
                      value={step.templateId}
                      onChange={e => updateStep(index, { templateId: e.target.value })}
                      className="w-full bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300"
                    >
                      <option value="">Select template...</option>
                      {filteredTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>
                      ))}
                    </select>
                  </div>
                  {index > 0 && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Delay (days)</label>
                      <input
                        type="number"
                        min={1}
                        value={step.delayDays}
                        onChange={e => updateStep(index, { delayDays: parseInt(e.target.value) || 1 })}
                        className="w-full bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {steps.length === 0 && (
              <div className="bg-surface border border-border border-dashed rounded-lg p-6 text-center">
                <p className="text-sm text-gray-600">No steps yet — click "+ Add Step" to build your sequence</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
