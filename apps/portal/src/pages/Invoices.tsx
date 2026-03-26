import { useEffect, useState } from 'react';
import { portalApi } from '../lib/api.js';

interface InvoiceRow {
  invoice: {
    id: string;
    invoiceNumber: string;
    amountCents: number;
    status: string;
    dueDate: string;
    sentAt: string | null;
    paidAt: string | null;
  };
  projectName: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  sent: { label: 'Unpaid', color: 'text-amber-500', bg: 'bg-amber-500/15' },
  paid: { label: 'Paid', color: 'text-green-500', bg: 'bg-green-500/15' },
  overdue: { label: 'Overdue', color: 'text-red-500', bg: 'bg-red-500/15' },
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    portalApi<InvoiceRow[]>('/portal/invoices').then(setInvoices);
  }, []);

  async function handlePay(invoiceId: string) {
    setPaying(invoiceId);
    try {
      const { paymentUrl } = await portalApi<{ paymentUrl: string }>(
        `/portal/invoices/${invoiceId}/pay`,
        { method: 'POST' }
      );
      window.location.href = paymentUrl;
    } catch (err) {
      console.error('Payment redirect failed:', err);
      setPaying(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-200">Invoices</h2>
        <p className="text-sm text-gray-500">View and pay your invoices</p>
      </div>

      <div className="space-y-3">
        {invoices.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center text-sm text-gray-600">
            No invoices yet.
          </div>
        ) : (
          invoices.map(({ invoice, projectName }) => {
            const config = statusConfig[invoice.status] || statusConfig.sent;
            const canPay = invoice.status === 'sent' || invoice.status === 'overdue';

            return (
              <div key={invoice.id} className="bg-surface border border-border rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-200">{invoice.invoiceNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {projectName} · Due {new Date(invoice.dueDate).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-gray-200">
                    ${(invoice.amountCents / 100).toFixed(2)}
                  </div>
                  {invoice.paidAt && (
                    <div className="text-xs text-green-500">
                      Paid {new Date(invoice.paidAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {canPay && (
                  <button
                    onClick={() => handlePay(invoice.id)}
                    disabled={paying === invoice.id}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500 disabled:opacity-50 flex-shrink-0"
                  >
                    {paying === invoice.id ? 'Redirecting...' : 'Pay Now'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
