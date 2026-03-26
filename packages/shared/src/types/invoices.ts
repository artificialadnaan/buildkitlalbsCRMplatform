export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface LineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  type: 'time_entry' | 'fixed';
}

export interface InvoiceView {
  id: string;
  projectId: string;
  companyId: string;
  invoiceNumber: string;
  amountCents: number;
  status: InvoiceStatus;
  dueDate: string;
  lineItems: LineItem[];
  stripeInvoiceId: string | null;
  pdfR2Key: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface CreateInvoiceBody {
  projectId: string;
  dueDate: string;
  lineItems: LineItem[];
}
