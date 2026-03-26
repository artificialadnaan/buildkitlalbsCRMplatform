import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import TopBar from '../components/layout/TopBar.js';
import KanbanBoard from '../components/ui/KanbanBoard.js';
import Modal from '../components/ui/Modal.js';

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

interface DealRow {
  deal: {
    id: string;
    title: string;
    value: number | null;
    stageId: string;
    pipelineId: string;
  };
  companyName: string | null;
  contactName: string | null;
  stageName: string | null;
  stageColor: string | null;
  stagePosition: number | null;
}

interface DealsResponse {
  data: DealRow[];
  total: number;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface CompaniesResponse {
  data: CompanyOption[];
  total: number;
}

interface ContactOption {
  id: string;
  firstName: string;
  lastName: string | null;
}

interface ContactsResponse {
  data: ContactOption[];
  total: number;
}

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [dealForm, setDealForm] = useState({ title: '', value: '', pipelineId: '', stageId: '', companyId: '', contactId: '' });
  const [dealSubmitting, setDealSubmitting] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);

  const loadDeals = () => {
    if (!activePipelineId) return;
    api<DealsResponse>(`/api/deals?pipelineId=${activePipelineId}`)
      .then((res) => setDeals(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    api<Pipeline[]>('/api/pipelines')
      .then((data) => {
        setPipelines(data);
        if (data.length > 0) {
          setActivePipelineId(data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadDeals();
  }, [activePipelineId]);

  // Search companies when typing
  useEffect(() => {
    if (!companySearch.trim()) {
      setCompanyOptions([]);
      return;
    }
    const timeout = setTimeout(() => {
      api<CompaniesResponse>(`/api/companies?search=${encodeURIComponent(companySearch)}&limit=10`)
        .then((res) => setCompanyOptions(res.data))
        .catch(console.error);
    }, 300);
    return () => clearTimeout(timeout);
  }, [companySearch]);

  // Load contacts when company is selected
  useEffect(() => {
    if (!dealForm.companyId) {
      setContactOptions([]);
      return;
    }
    api<ContactsResponse>(`/api/contacts?companyId=${dealForm.companyId}`)
      .then((res) => setContactOptions(res.data))
      .catch(console.error);
  }, [dealForm.companyId]);

  const openCreateDeal = () => {
    if (activePipelineId) {
      const pipeline = pipelines.find((p) => p.id === activePipelineId);
      setDealForm((f) => ({
        ...f,
        pipelineId: activePipelineId,
        stageId: pipeline?.stages[0]?.id || '',
      }));
    }
    setShowCreateDeal(true);
  };

  const handlePipelineChangeDeal = (pipelineId: string) => {
    const pipeline = pipelines.find((p) => p.id === pipelineId);
    setDealForm((f) => ({ ...f, pipelineId, stageId: pipeline?.stages[0]?.id || '' }));
  };

  const handleCreateDeal = async () => {
    if (!dealForm.title.trim() || !dealForm.pipelineId || !dealForm.stageId || !dealForm.companyId) return;
    setDealSubmitting(true);
    try {
      await api('/api/deals', {
        method: 'POST',
        body: JSON.stringify({
          companyId: dealForm.companyId,
          title: dealForm.title,
          value: dealForm.value ? parseInt(dealForm.value, 10) : null,
          pipelineId: dealForm.pipelineId,
          stageId: dealForm.stageId,
          contactId: dealForm.contactId || null,
        }),
      });
      setShowCreateDeal(false);
      setDealForm({ title: '', value: '', pipelineId: '', stageId: '', companyId: '', contactId: '' });
      setCompanySearch('');
      setCompanyOptions([]);
      setContactOptions([]);
      loadDeals();
    } catch (err) {
      console.error('Failed to create deal:', err);
    } finally {
      setDealSubmitting(false);
    }
  };

  const activePipeline = pipelines.find((p) => p.id === activePipelineId);

  return (
    <div>
      <TopBar
        title="Pipelines"
        subtitle={activePipeline?.description ?? undefined}
        actions={
          <button
            onClick={openCreateDeal}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            + Add Deal
          </button>
        }
      />

      <div className="p-6">
        {/* Pipeline Tabs */}
        {pipelines.length > 1 && (
          <div className="mb-4 flex gap-2">
            {pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePipelineId(p.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  p.id === activePipelineId
                    ? 'bg-blue-600 text-white'
                    : 'border border-border bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Kanban */}
        {activePipeline && (
          <KanbanBoard stages={activePipeline.stages} deals={deals} />
        )}
      </div>

      {/* Create Deal Modal */}
      <Modal open={showCreateDeal} onClose={() => setShowCreateDeal(false)} title="Create Deal">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Title *</label>
            <input
              type="text"
              value={dealForm.title}
              onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
              placeholder="Deal title"
              className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Value ($)</label>
            <input
              type="number"
              value={dealForm.value}
              onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })}
              placeholder="0"
              className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Company *</label>
            <input
              type="text"
              value={companySearch}
              onChange={(e) => {
                setCompanySearch(e.target.value);
                if (!e.target.value) setDealForm({ ...dealForm, companyId: '', contactId: '' });
              }}
              placeholder="Search companies..."
              className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
            {companyOptions.length > 0 && !dealForm.companyId && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-border bg-gray-900">
                {companyOptions.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setDealForm({ ...dealForm, companyId: c.id, contactId: '' });
                      setCompanySearch(c.name);
                      setCompanyOptions([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Pipeline *</label>
            <select
              value={dealForm.pipelineId}
              onChange={(e) => handlePipelineChangeDeal(e.target.value)}
              className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select pipeline...</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {dealForm.pipelineId && (
            <div>
              <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Stage *</label>
              <select
                value={dealForm.stageId}
                onChange={(e) => setDealForm({ ...dealForm, stageId: e.target.value })}
                className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              >
                {pipelines.find((p) => p.id === dealForm.pipelineId)?.stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {contactOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium uppercase text-gray-500 mb-1">Contact</label>
              <select
                value={dealForm.contactId}
                onChange={(e) => setDealForm({ ...dealForm, contactId: e.target.value })}
                className="w-full rounded-lg border border-border bg-gray-900 px-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="">None</option>
                {contactOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName ?? ''}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowCreateDeal(false)}
              className="rounded-lg border border-border bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateDeal}
              disabled={dealSubmitting || !dealForm.title.trim() || !dealForm.pipelineId || !dealForm.stageId || !dealForm.companyId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dealSubmitting ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
