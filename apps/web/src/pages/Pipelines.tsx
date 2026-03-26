import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatCurrency } from '../lib/format.js';
import TopBar from '../components/layout/TopBar.js';
import KanbanBoard from '../components/ui/KanbanBoard.js';
import Modal from '../components/ui/Modal.js';
import LoadingSpinner from '../components/ui/LoadingSpinner.js';

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
  const [loading, setLoading] = useState(true);

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
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDeals();
  }, [activePipelineId]);

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

  // Pipeline summary stats
  const totalValue = deals.reduce((sum, d) => sum + (d.deal.value || 0), 0);
  const totalDeals = deals.length;

  return (
    <div>
      <TopBar title="Pipelines" />

      {loading ? <LoadingSpinner /> : (
        <div className="px-6 py-8 max-w-7xl mx-auto space-y-10">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-xl">
              <span className="text-orange-700 font-bold tracking-[0.2em] text-[10px] uppercase mb-2 block">
                Global Operations
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-slate-900 mb-4">
                {activePipeline?.name ?? 'Pipeline'}
              </h2>
              {activePipeline?.description && (
                <p className="text-slate-500 text-lg font-medium leading-relaxed">
                  {activePipeline.description}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const token = localStorage.getItem('token');
                  const baseUrl = import.meta.env.VITE_API_URL || '';
                  window.open(`${baseUrl}/api/export/deals?token=${token}`, '_blank');
                }}
                className="px-6 py-3 bg-[#d5e3fd] text-slate-700 rounded-lg font-bold text-sm tracking-wide shadow-sm hover:-translate-y-px transition-transform"
              >
                EXPORT BLUEPRINTS
              </button>
              <button
                onClick={openCreateDeal}
                className="px-6 py-3 bg-gradient-to-r from-orange-700 to-orange-500 text-white rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-orange-600/20 hover:-translate-y-px transition-transform"
              >
                NEW PIPELINE ENTRY
              </button>
            </div>
          </div>

          {/* Pipeline Tabs */}
          {pipelines.length > 1 && (
            <div className="flex gap-2">
              {pipelines.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePipelineId(p.id)}
                  className={`px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all ${
                    p.id === activePipelineId
                      ? 'bg-gradient-to-r from-orange-700 to-orange-500 text-white rounded-md shadow-lg shadow-orange-600/20'
                      : 'bg-[#e7eeff] text-slate-600 rounded-md hover:bg-[#d8e3fb]'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Kanban Board */}
          {activePipeline && (
            <KanbanBoard stages={activePipeline.stages} deals={deals} onDealMoved={loadDeals} />
          )}

          {/* Pipeline Summary Footer */}
          <div className="bg-slate-900 text-white rounded-xl p-8 flex flex-col md:flex-row justify-between items-center gap-8 border-t-4 border-orange-600">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 w-full">
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 block mb-1">Total Pipeline Value</span>
                <div className="text-3xl font-black tracking-tighter text-white">{formatCurrency(totalValue)}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 block mb-1">Expected MRR</span>
                <div className="text-3xl font-black tracking-tighter text-orange-500">
                  {formatCurrency(Math.round(totalValue * 0.12))}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 block mb-1">Active Deals</span>
                <div className="text-3xl font-black tracking-tighter text-white">{totalDeals}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400 block mb-1">Utilization</span>
                <div className="text-3xl font-black tracking-tighter text-white">
                  {totalDeals > 0 ? `${Math.min(99, Math.round((totalDeals / (activePipeline?.stages.length ?? 1)) * 25))}%` : '0%'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Deal Modal */}
      <Modal open={showCreateDeal} onClose={() => setShowCreateDeal(false)} title="Create Deal">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Title *</label>
            <input
              type="text"
              value={dealForm.title}
              onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
              placeholder="Deal title"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Value ($)</label>
            <input
              type="number"
              value={dealForm.value}
              onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })}
              placeholder="0"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Company *</label>
            <input
              type="text"
              value={companySearch}
              onChange={(e) => {
                setCompanySearch(e.target.value);
                if (!e.target.value) setDealForm({ ...dealForm, companyId: '', contactId: '' });
              }}
              placeholder="Search companies..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
            {companyOptions.length > 0 && !dealForm.companyId && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {companyOptions.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setDealForm({ ...dealForm, companyId: c.id, contactId: '' });
                      setCompanySearch(c.name);
                      setCompanyOptions([]);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-orange-50"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Pipeline *</label>
            <select
              value={dealForm.pipelineId}
              onChange={(e) => handlePipelineChangeDeal(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            >
              <option value="">Select pipeline...</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {dealForm.pipelineId && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Stage *</label>
              <select
                value={dealForm.stageId}
                onChange={(e) => setDealForm({ ...dealForm, stageId: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              >
                {pipelines.find((p) => p.id === dealForm.pipelineId)?.stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {contactOptions.length > 0 && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Contact</label>
              <select
                value={dealForm.contactId}
                onChange={(e) => setDealForm({ ...dealForm, contactId: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
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
              className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateDeal}
              disabled={dealSubmitting || !dealForm.title.trim() || !dealForm.pipelineId || !dealForm.stageId || !dealForm.companyId}
              className="rounded-lg bg-gradient-to-r from-orange-700 to-orange-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition-all hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dealSubmitting ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
