import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/layout/TopBar.js';
import Badge from '../components/ui/Badge.js';
import DataTable from '../components/ui/DataTable.js';
import { api } from '../lib/api.js';

interface InvoiceRow {
  invoice: {
    id: string;
    invoiceNumber: string;
    amountCents: number;
    status: string;
    dueDate: string;
    sentAt: string | null;
    paidAt: string | null;
    createdAt: string;
  };
  projectName: string;
  companyName: string;
}

const statusVariants: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple'> = {
  draft: 'gray',
  sent: 'blue',
  paid: 'green',
  overdue: 'red',
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api<{ data: InvoiceRow[] }>('/api/invoices').then(r => setInvoices(r.data));
  }, []);

  const columns = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (row: InvoiceRow) => row.invoice.invoiceNumber },
    { key: 'companyName', label: 'Client', render: (row: InvoiceRow) => row.companyName || '\u2014' },
    { key: 'projectName', label: 'Project', render: (row: InvoiceRow) => row.projectName || '\u2014' },
    {
      key: 'amount', label: 'Amount',
      render: (row: InvoiceRow) => `$${(row.invoice.amountCents / 100).toFixed(2)}`,
    },
    {
      key: 'status', label: 'Status',
      render: (row: InvoiceRow) => (
        <Badge label={row.invoice.status} variant={statusVariants[row.invoice.status] || 'gray'} />
      ),
    },
    {
      key: 'dueDate', label: 'Due Date',
      render: (row: InvoiceRow) => new Date(row.invoice.dueDate).toLocaleDateString(),
    },
  ];

  // DataTable expects { id } at root level
  const tableData = invoices.map(row => ({ id: row.invoice.id, ...row }));

  return (
    <div>
      <TopBar
        title="Invoices"
        actions={
          <button
            onClick={() => navigate('/invoices/new')}
            className="bg-blue-600 px-3 py-2 rounded-md text-sm text-white hover:bg-blue-500"
          >
            + New Invoice
          </button>
        }
      />
      <DataTable
        columns={columns}
        data={tableData}
        onRowClick={row => navigate(`/invoices/${row.id}`)}
      />
    </div>
  );
}
