 import { buffer } from 'micro';
import Stripe from 'stripe';
import supabase from '../lib/supabase';
import { resend } from '../lib/resend';

export const config = {
  api: {
    bodyParser: false, // Required for raw body parsing
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf.toString(),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const email = session.customer_details?.email;
    const fullName = session.custom_fields?.find(f => f.key === 'full_name')?.text?.value;
    const domain = session.custom_fields?.find(f => f.key === 'domain')?.text?.value;

    // Save to Supabase
    await supabase.from('purchases').insert({
      email,
      full_name: fullName,
      domain,
    });

    // Send welcome email
    await resend.emails.send({
      from: 'DAPEN <welcome@dapen.org>',
      to: email,
      subject: 'Welcome to DAPEN',
      html: `<p>Hi ${fullName || 'there'},</p><p>Thanks for joining! We’ve registered your domain: <strong>${domain}</strong>.</p>`,
    });
  }

  res.status(200).json({ received: true });
}