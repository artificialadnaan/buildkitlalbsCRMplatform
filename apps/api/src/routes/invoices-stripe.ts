import { Router, type Request } from 'express';
import { eq } from 'drizzle-orm';
import { db, invoices, companies, contacts } from '@buildkit/shared';
import { authMiddleware } from '../middleware/auth.js';
import Stripe from 'stripe';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

type IdParams = { id: string };

const router = Router();

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY required');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion });
  }
  return _stripe;
}

let _invoiceQueue: Queue | null = null;
function getInvoiceQueue(): Queue {
  if (!_invoiceQueue) {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    _invoiceQueue = new Queue('invoice', { connection: redis });
  }
  return _invoiceQueue;
}

// Send invoice via Stripe (transitions draft -> sent)
router.post('/:id/send', authMiddleware, async (req: Request<IdParams>, res) => {
  const [invoice] = await db.select()
    .from(invoices)
    .where(eq(invoices.id, req.params.id))
    .limit(1);

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  if (invoice.status !== 'draft') {
    res.status(400).json({ error: 'Only draft invoices can be sent' });
    return;
  }

  // Get company and primary contact email
  const [company] = await db.select()
    .from(companies)
    .where(eq(companies.id, invoice.companyId))
    .limit(1);

  const [contact] = await db.select()
    .from(contacts)
    .where(eq(contacts.companyId, invoice.companyId))
    .limit(1);

  if (!contact?.email) {
    res.status(400).json({ error: 'No contact email found for this company' });
    return;
  }

  try {
    // Create or retrieve Stripe customer
    const customers = await getStripe().customers.list({ email: contact.email, limit: 1 });
    let customer: Stripe.Customer;
    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      customer = await getStripe().customers.create({
        email: contact.email,
        name: company?.name || 'Client',
      });
    }

    // Create Stripe invoice
    const stripeInvoice = await getStripe().invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: Math.max(1, Math.ceil((new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
      metadata: { invoiceNumber: invoice.invoiceNumber, internalId: invoice.id },
    });

    // Add line items
    const lineItems = invoice.lineItems as { description: string; quantity: number; unitPriceCents: number }[];
    for (const item of lineItems) {
      await getStripe().invoiceItems.create({
        customer: customer.id,
        invoice: stripeInvoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_amount: item.unitPriceCents,
        currency: 'usd',
      } as Stripe.InvoiceItemCreateParams);
    }

    // Finalize and send
    const finalized = await getStripe().invoices.finalizeInvoice(stripeInvoice.id!);
    await getStripe().invoices.sendInvoice(stripeInvoice.id!);

    // Update our invoice record
    const [updated] = await db.update(invoices)
      .set({
        status: 'sent',
        stripeInvoiceId: finalized.id,
        sentAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id))
      .returning();

    // Trigger PDF generation
    await getInvoiceQueue().add('generate-invoice-pdf', { invoiceId: invoice.id });

    res.json(updated);
  } catch (err) {
    console.error('Stripe invoice send error:', err);
    res.status(500).json({ error: 'Failed to send invoice via Stripe' });
  }
});

// Stripe webhook handler
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      JSON.stringify(req.body),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  if (event.type === 'invoice.paid') {
    const stripeInvoice = event.data.object as Stripe.Invoice;

    await db.update(invoices)
      .set({
        status: 'paid',
        paidAt: new Date(),
      })
      .where(eq(invoices.stripeInvoiceId, stripeInvoice.id));
  }

  if (event.type === 'invoice.overdue' || event.type === 'invoice.payment_failed') {
    const stripeInvoice = event.data.object as Stripe.Invoice;

    await db.update(invoices)
      .set({ status: 'overdue' })
      .where(eq(invoices.stripeInvoiceId, stripeInvoice.id));
  }

  res.json({ received: true });
});

export default router;
