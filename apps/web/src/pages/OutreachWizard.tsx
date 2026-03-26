import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';

interface EmailSequence {
  id: string;
  name: string;
  pipelineType: string;
  stepCount: number;
}

interface WizardState {
  // Step 1 - Target
  zipCodes: string;
  industry: string;
  campaignName: string;
  // Step 2 - Sequence
  sequenceId: string;
  // Step 3 - Settings
  topN: number;
  minScore: number;
}

const STEPS = ['Target', 'Sequence', 'Settings', 'Review & Launch'];

export default function OutreachWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [loadingSequences, setLoadingSequences] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<WizardState>({
    zipCodes: '',
    industry: '',
    campaignName: '',
    sequenceId: '',
    topN: 100,
    minScore: 0,
  });

  useEffect(() => {
    if (currentStep === 1 && sequences.length === 0) {
      setLoadingSequences(true);
      api<{ data: EmailSequence[] }>('/api/email-sequences')
        .then((r) => setSequences(r.data))
        .catch(console.error)
        .finally(() => setLoadingSequences(false));
    }
  }, [currentStep, sequences.length]);

  function set<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }

  function validateStep(): boolean {
    const newErrors: Record<string, string> = {};
    if (currentStep === 0) {
      if (!form.campaignName.trim()) newErrors.campaignName = 'Campaign name is required';
      if (!form.zipCodes.trim()) newErrors.zipCodes = 'At least one zip code is required';
      if (!form.industry.trim()) newErrors.industry = 'Industry / search query is required';
    }
    if (currentStep === 1) {
      if (!form.sequenceId) newErrors.sequenceId = 'Please select a sequence';
    }
    if (currentStep === 2) {
      if (form.topN < 1) newErrors.topN = 'Must be at least 1';
      if (form.minScore < 0) newErrors.minScore = 'Cannot be negative';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (!validateStep()) return;
    setCurrentStep((s) => s + 1);
  }

  function handleBack() {
    setCurrentStep((s) => s - 1);
  }

  async function handleLaunch() {
    setLaunching(true);
    try {
      const payload = {
        name: form.campaignName,
        zipCodes: form.zipCodes.split(',').map((z) => z.trim()).filter(Boolean),
        industry: form.industry,
        sequenceId: form.sequenceId,
        topN: form.topN,
        minScore: form.minScore,
      };
      const result = await api<{ id: string }>('/api/outreach', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      navigate(`/outreach/${result.id}`);
    } catch (err) {
      console.error('Failed to launch campaign:', err);
      setErrors({ launch: err instanceof Error ? err.message : 'Failed to launch campaign' });
    } finally {
      setLaunching(false);
    }
  }

  const selectedSequence = sequences.find((s) => s.id === form.sequenceId);

  return (
    <div>
      <TopBar title="New Outreach Campaign" subtitle="Set up autonomous lead outreach" />

      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          {/* Step indicators */}
          <div className="flex items-center mb-8">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                      i < currentStep
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : i === currentStep
                        ? 'border-blue-600 bg-white text-blue-600'
                        : 'border-gray-300 bg-white text-gray-400'
                    }`}
                  >
                    {i < currentStep ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                      i === currentStep ? 'text-blue-600' : i < currentStep ? 'text-gray-700' : 'text-gray-400'
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 mb-5 transition-colors ${
                      i < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="rounded-lg border border-border bg-surface p-6">
            {currentStep === 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-gray-900">Define Your Target</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Campaign Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DFW Roofing Q2 2026"
                    value={form.campaignName}
                    onChange={(e) => set('campaignName', e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                  {errors.campaignName && (
                    <p className="mt-1 text-xs text-red-600">{errors.campaignName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zip Codes <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="76101, 76102, 75201"
                    value={form.zipCodes}
                    onChange={(e) => set('zipCodes', e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Comma-separated list of zip codes to target</p>
                  {errors.zipCodes && (
                    <p className="mt-1 text-xs text-red-600">{errors.zipCodes}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industry / Search Query <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. roofing contractor, HVAC, plumber"
                    value={form.industry}
                    onChange={(e) => set('industry', e.target.value)}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                  {errors.industry && (
                    <p className="mt-1 text-xs text-red-600">{errors.industry}</p>
                  )}
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-gray-900">Choose Email Sequence</h2>
                {loadingSequences ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  </div>
                ) : sequences.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
                    No sequences found.{' '}
                    <a href="/email/sequences/new" className="text-blue-600 hover:underline">
                      Create one first
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sequences.map((seq) => (
                      <label
                        key={seq.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                          form.sequenceId === seq.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-border bg-white hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="sequence"
                          value={seq.id}
                          checked={form.sequenceId === seq.id}
                          onChange={() => set('sequenceId', seq.id)}
                          className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{seq.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {seq.stepCount} step{seq.stepCount !== 1 ? 's' : ''} &middot; {seq.pipelineType}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {errors.sequenceId && (
                  <p className="text-xs text-red-600">{errors.sequenceId}</p>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-gray-900">Enrollment Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Top N leads to enroll
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.topN}
                    onChange={(e) => set('topN', parseInt(e.target.value, 10) || 1)}
                    className="w-40 rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enroll only the top-ranked leads (by score) from scraped results
                  </p>
                  {errors.topN && (
                    <p className="mt-1 text-xs text-red-600">{errors.topN}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum score threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.minScore}
                    onChange={(e) => set('minScore', parseInt(e.target.value, 10) || 0)}
                    className="w-40 rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Skip leads with a score below this value (0 = enroll all)
                  </p>
                  {errors.minScore && (
                    <p className="mt-1 text-xs text-red-600">{errors.minScore}</p>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-gray-900">Review & Launch</h2>
                <div className="rounded-lg border border-border bg-gray-50 divide-y divide-border">
                  <ReviewRow label="Campaign Name" value={form.campaignName} />
                  <ReviewRow label="Zip Codes" value={form.zipCodes} />
                  <ReviewRow label="Industry / Query" value={form.industry} />
                  <ReviewRow
                    label="Email Sequence"
                    value={selectedSequence ? `${selectedSequence.name} (${selectedSequence.stepCount} steps)` : '—'}
                  />
                  <ReviewRow label="Top N Leads" value={String(form.topN)} />
                  <ReviewRow label="Min Score" value={String(form.minScore)} />
                </div>
                {errors.launch && (
                  <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    {errors.launch}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <div className="text-xs text-gray-400">
              Step {currentStep + 1} of {STEPS.length}
            </div>
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {launching ? 'Launching...' : 'Launch Campaign'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="w-40 shrink-0 text-xs font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}
