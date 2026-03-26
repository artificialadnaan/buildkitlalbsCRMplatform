import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, invoices, projects } from '@buildkit/shared';
import { portalAuthMiddleware } from '../middleware/portalAuth.js';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
});

router.use(portalAuthMiddleware);

// List invoices for the client's company
router.get('/', async (req, res) => {
  const companyId = req.portalUser!.companyId;

  const companyInvoices = await db.select({
    invoice: invoices,
    projectName: projects.name,
  })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .where(eq(invoices.companyId, companyId));

  // Only show sent/paid/overdue invoices (not drafts)
  const visible = companyInvoices.filter(i => i.invoice.status !== 'draft');

  res.json(visible);
});

// Get payment link for an invoice (redirect to Stripe Checkout)
router.post('/:id/pay', async (req, res) => {
  const companyId = req.portalUser!.companyId;

  const [invoice] = await db.select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, req.params.id),
        eq(invoices.companyId, companyId)
      )
    )
    .limit(1);

  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }

  if (invoice.status === 'paid') {
    res.status(400).json({ error: 'Invoice is already paid' });
    return;
  }

  if (!invoice.stripeInvoiceId) {
    res.status(400).json({ error: 'Invoice has not been sent yet' });
    return;
  }

  try {
    const stripeInvoice = await stripe.invoices.retrieve(invoice.stripeInvoiceId);
    const paymentUrl = stripeInvoice.hosted_invoice_url;

    if (!paymentUrl) {
      res.status(500).json({ error: 'No payment URL available' });
      return;
    }

    res.json({ paymentUrl });
  } catch (err) {
    console.error('Failed to get payment URL:', err);
    res.status(500).json({ error: 'Failed to retrieve payment link' });
  }
});

export default router;
