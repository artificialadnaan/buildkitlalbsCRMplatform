import { eq, and, lt, or } from 'drizzle-orm';
import { db, invoices, companies, contacts, projects } from '@buildkit/shared';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function processInvoiceReminders(): Promise<void> {
  const now = new Date();

  // Find overdue invoices (sent but not paid, past due date)
  const overdueInvoices = await db.select({
    invoice: invoices,
    companyName: companies.name,
    projectName: projects.name,
  })
    .from(invoices)
    .leftJoin(companies, eq(invoices.companyId, companies.id))
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .where(
      and(
        or(eq(invoices.status, 'sent'), eq(invoices.status, 'overdue')),
        lt(invoices.dueDate, now)
      )
    );

  console.log(`Found ${overdueInvoices.length} overdue invoices`);

  for (const { invoice, companyName, projectName } of overdueInvoices) {
    // Update status to overdue if still 'sent'
    if (invoice.status === 'sent') {
      await db.update(invoices)
        .set({ status: 'overdue' })
        .where(eq(invoices.id, invoice.id));
    }

    // Get primary contact email
    const [contact] = await db.select()
      .from(contacts)
      .where(eq(contacts.companyId, invoice.companyId))
      .limit(1);

    if (!contact?.email) {
      console.warn(`No contact email for company ${invoice.companyId}, skipping reminder`);
      continue;
    }

    // Send reminder email
    const daysOverdue = Math.ceil((now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));

    try {
      await transporter.sendMail({
        from: `"BuildKit Labs" <${process.env.MAGIC_LINK_FROM_EMAIL || 'billing@buildkitlabs.com'}>`,
        to: contact.email,
        subject: `Payment Reminder: Invoice ${invoice.invoiceNumber} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #1e293b;">Payment Reminder</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
              This is a friendly reminder that invoice <strong>${invoice.invoiceNumber}</strong>
              for <strong>${projectName || 'your project'}</strong> was due on
              <strong>${new Date(invoice.dueDate).toLocaleDateString()}</strong> and is now
              <strong>${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}</strong> overdue.
            </p>
            <p style="color: #64748b; font-size: 14px;">
              <strong>Amount due:</strong> $${(invoice.amountCents / 100).toFixed(2)}
            </p>
            <p style="color: #64748b; font-size: 14px;">
              Please log in to your client portal to make a payment, or contact us if you have any questions.
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
              BuildKit Labs — buildkitlabs.com
            </p>
          </div>
        `,
      });
      console.log(`Sent overdue reminder for ${invoice.invoiceNumber} to ${contact.email}`);
    } catch (err) {
      console.error(`Failed to send reminder for ${invoice.invoiceNumber}:`, err);
    }
  }
}
