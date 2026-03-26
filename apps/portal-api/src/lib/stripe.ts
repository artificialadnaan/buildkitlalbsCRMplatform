import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
});

export async function createStripeInvoice(params: {
  customerEmail: string;
  companyName: string;
  lineItems: { description: string; quantity: number; unitAmountCents: number }[];
  dueDate: Date;
  invoiceNumber: string;
}): Promise<{ stripeInvoiceId: string; paymentUrl: string }> {
  // Create or retrieve customer
  const customers = await stripe.customers.list({ email: params.customerEmail, limit: 1 });
  let customer: Stripe.Customer;
  if (customers.data.length > 0) {
    customer = customers.data[0];
  } else {
    customer = await stripe.customers.create({
      email: params.customerEmail,
      name: params.companyName,
    });
  }

  // Create invoice
  const invoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: 'send_invoice',
    days_until_due: Math.max(1, Math.ceil((params.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
    metadata: { invoiceNumber: params.invoiceNumber },
  });

  // Add line items
  for (const item of params.lineItems) {
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_amount: item.unitAmountCents,
      currency: 'usd',
    });
  }

  // Finalize the invoice to get the hosted payment URL
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id!);

  return {
    stripeInvoiceId: finalizedInvoice.id,
    paymentUrl: finalizedInvoice.hosted_invoice_url || '',
  };
}
