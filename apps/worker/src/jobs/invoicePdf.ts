import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { db, invoices, projects, companies } from '@buildkit/shared';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || 'buildkit-files';

interface InvoicePdfJobData {
  invoiceId: string;
}

export async function processInvoicePdf(data: InvoicePdfJobData): Promise<void> {
  const [invoice] = await db.select()
    .from(invoices)
    .where(eq(invoices.id, data.invoiceId))
    .limit(1);

  if (!invoice) {
    console.error(`Invoice ${data.invoiceId} not found`);
    return;
  }

  const [project] = await db.select()
    .from(projects)
    .where(eq(projects.id, invoice.projectId))
    .limit(1);

  const [company] = await db.select()
    .from(companies)
    .where(eq(companies.id, invoice.companyId))
    .limit(1);

  // Generate PDF
  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    companyName: company?.name || 'Client',
    projectName: project?.name || 'Project',
    lineItems: invoice.lineItems as { description: string; quantity: number; unitPriceCents: number; type: string }[],
    amountCents: invoice.amountCents,
    dueDate: new Date(invoice.dueDate),
    createdAt: new Date(invoice.createdAt),
  });

  // Upload to R2
  const r2Key = `invoices/${invoice.invoiceNumber}.pdf`;
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  }));

  // Update invoice record with PDF key
  await db.update(invoices)
    .set({ pdfR2Key: r2Key })
    .where(eq(invoices.id, invoice.id));

  console.log(`Generated PDF for invoice ${invoice.invoiceNumber} -> ${r2Key}`);
}

function generateInvoicePdf(params: {
  invoiceNumber: string;
  companyName: string;
  projectName: string;
  lineItems: { description: string; quantity: number; unitPriceCents: number; type: string }[];
  amountCents: number;
  dueDate: Date;
  createdAt: Date;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(24).fillColor('#1e293b').text('BuildKit Labs', 50, 50);
    doc.fontSize(8).fillColor('#a8a29e').text('SOFTWARE + WEB DEVELOPMENT', 50, 78);
    doc.moveDown(2);

    // Invoice info
    doc.fontSize(18).fillColor('#1e293b').text(`Invoice ${params.invoiceNumber}`);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#64748b');
    doc.text(`Bill To: ${params.companyName}`);
    doc.text(`Project: ${params.projectName}`);
    doc.text(`Date: ${params.createdAt.toLocaleDateString()}`);
    doc.text(`Due Date: ${params.dueDate.toLocaleDateString()}`);
    doc.moveDown(2);

    // Line items header
    const tableTop = doc.y;
    doc.fontSize(9).fillColor('#94a3b8');
    doc.text('Description', 50, tableTop, { width: 250 });
    doc.text('Qty', 310, tableTop, { width: 50, align: 'right' });
    doc.text('Unit Price', 370, tableTop, { width: 80, align: 'right' });
    doc.text('Amount', 460, tableTop, { width: 80, align: 'right' });

    doc.moveTo(50, tableTop + 15).lineTo(540, tableTop + 15).strokeColor('#e2e8f0').stroke();

    // Line items
    let y = tableTop + 25;
    doc.fontSize(10).fillColor('#1e293b');
    for (const item of params.lineItems) {
      const amount = item.quantity * item.unitPriceCents;
      doc.text(item.description, 50, y, { width: 250 });
      doc.text(String(item.quantity), 310, y, { width: 50, align: 'right' });
      doc.text(`$${(item.unitPriceCents / 100).toFixed(2)}`, 370, y, { width: 80, align: 'right' });
      doc.text(`$${(amount / 100).toFixed(2)}`, 460, y, { width: 80, align: 'right' });
      y += 20;
    }

    // Total
    doc.moveTo(350, y + 5).lineTo(540, y + 5).strokeColor('#e2e8f0').stroke();
    y += 15;
    doc.fontSize(12).fillColor('#1e293b').font('Helvetica-Bold');
    doc.text('Total', 370, y, { width: 80, align: 'right' });
    doc.text(`$${(params.amountCents / 100).toFixed(2)}`, 460, y, { width: 80, align: 'right' });

    // Footer
    doc.fontSize(8).fillColor('#94a3b8').font('Helvetica');
    doc.text('BuildKit Labs — buildkitlabs.com', 50, 720, { align: 'center' });

    doc.end();
  });
}
