import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import InvoiceForm from '../components/ui/InvoiceForm.js';
import { api } from '../lib/api.js';

interface Project {
  id: string;
  name: string;
  companyId: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  projectId: string;
  amountCents: number;
  status: string;
  dueDate: string;
  lineItems: { description: string; quantity: number; unitPriceCents: number; type: 'time_entry' | 'fixed' }[];
  stripeInvoiceId: string | null;
  pdfR2Key: string | null;
  sentAt: string | null;
  paidAt: string | null;
  projectName: string;
  companyName: string;
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isNew && id) {
      api<Invoice>(`/api/invoices/${id}`).then(setInvoice);
    }
    // Load projects for the "new invoice" form
    if (isNew) {
      api<{ data: { id: string; name: string; companyId: string; status: string }[] }>('/api/projects?status=active')
        .then(r => setProjects(r.data || []))
        .catch(() => setProjects([]));
    }
  }, [id, isNew]);

  async function createInvoice(data: { dueDate: string; lineItems: { description: string; quantity: number; unitPriceCents: number; type: 'time_entry' | 'fixed' }[] }) {
    const result = await api<Invoice>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({ projectId: selectedProjectId, ...data }),
    });
    navigate(`/invoices/${result.id}`);
  }

  async function updateInvoice(data: { dueDate: string; lineItems: { description: string; quantity: number; unitPriceCents: number; type: 'time_entry' | 'fixed' }[] }) {
    if (!invoice) return;
    const result = await api<Invoice>(`/api/invoices/${invoice.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    setInvoice({ ...invoice, ...result });
  }

  async function sendInvoice() {
    if (!invoice) return;
    setSending(true);
    try {
      const result = await api<Invoice>(`/api/invoices/${invoice.id}/send`, { method: 'POST' });
      setInvoice({ ...invoice, ...result });
    } catch (err) {
      console.error('Failed to send invoice:', err);
    } finally {
      setSending(false);
    }
  }

  if (isNew) {
    return (
      <div>
        <TopBar
          title="New Invoice"
          actions={
            <button onClick={() => navigate('/invoices')} className="bg-border border border-gray-700 px-3 py-2 rounded-md text-sm text-gray-400">
              Cancel
            </button>
          }
        />
        <div className="bg-surface border border-border rounded-lg p-6 max-w-2xl">
          <div className="mb-4">
            <label className="text-sm text-gray-400 block mb-1">Project</label>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="bg-slate-900 border border-border rounded-md px-3 py-2 text-sm text-gray-300 w-full max-w-sm"
            >
              <option value="">Select a project...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {selectedProjectId && (
            <InvoiceForm onSubmit={createInvoice} />
          )}
        </div>
      </div>
    );
  }

  if (!invoice) return <div className="text-gray-500">Loading...</div>;

  const statusVariant: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple'> = { draft: 'gray', sent: 'blue', paid: 'green', overdue: 'red' };

  return (
    <div>
      <TopBar
        title={`Invoice ${invoice.invoiceNumber}`}
        subtitle={`${invoice.companyName} \u2014 ${invoice.projectName}`}
        actions={
          <div className="flex gap-2">
            {invoice.status === 'draft' && (
              <button
                onClick={sendInvoice}
                disabled={sending}
                className="bg-blue-600 px-3 py-2 rounded-md text-sm text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Invoice'}
              </button>
            )}
            <button onClick={() => navigate('/invoices')} className="bg-border border border-gray-700 px-3 py-2 rounded-md text-sm text-gray-400">
              Back
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-lg p-4 col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <Badge label={invoice.status} variant={statusVariant[invoice.status] || 'gray'} />
            <span className="text-sm text-gray-500">
              Total: <span className="text-lg font-bold text-gray-200">${(invoice.amountCents / 100).toFixed(2)}</span>
            </span>
          </div>

          {invoice.status === 'draft' ? (
            <InvoiceForm
              initialLineItems={invoice.lineItems}
              initialDueDate={invoice.dueDate.split('T')[0]}
              onSubmit={updateInvoice}
              submitLabel="Update Invoice"
            />
          ) : (
            <div className="space-y-2">
              {invoice.lineItems.map((item, i) => (
                <div key={i} className="flex justify-between text-sm text-gray-300 py-2 border-b border-border last:border-0">
                  <span>{item.description}</span>
                  <span>{item.quantity} x ${(item.unitPriceCents / 100).toFixed(2)} = ${((item.quantity * item.unitPriceCents) / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="font-semibold text-gray-200 mb-3">Details</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500">Due:</span> <span className="text-gray-300">{new Date(invoice.dueDate).toLocaleDateString()}</span></div>
            {invoice.sentAt && <div><span className="text-gray-500">Sent:</span> <span className="text-gray-300">{new Date(invoice.sentAt).toLocaleDateString()}</span></div>}
            {invoice.paidAt && <div><span className="text-gray-500">Paid:</span> <span className="text-green-500">{new Date(invoice.paidAt).toLocaleDateString()}</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
