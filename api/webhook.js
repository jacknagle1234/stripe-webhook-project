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
  console.log("✅ Webhook triggered");

  if (req.method !== 'POST') {
    console.log("❌ Invalid method");
    return res.status(405).end();
  }

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
    console.error("❌ Stripe signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("📦 Event type:", event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const email = session.customer_details?.email;
    const fullName = session.custom_fields?.find(f => f.key === 'websiteurlsubdomainssoldseparately')?.text?.value;
    const domain = session.custom_fields?.find(f => f.key === 'websiteurlsubdomainssoldseparately1')?.text?.value;

    console.log("📬 Parsed values:", { email, fullName, domain });

    const { error } = await supabase.from('purchases').insert({
      email,
      full_name: fullName,
      domain,
    });

    if (error) {
      console.error("❌ Supabase insert failed:", error.message);
    } else {
      console.log("✅ Supabase insert successful");
    }

// 🔽 Add this block right before or instead of your resend.emails.send
  console.log("▶️ Resend about to send", { to: email });

  try {
    const hasKey = !!(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.length > 10);
    console.log(
      "RESEND_API_KEY present:",
      hasKey,
      "prefix:",
      (process.env.RESEND_API_KEY || "").slice(0, 6)
    );

    const result = await resend.emails.send({
      from: "onboarding@resend.dev",   // keep this for testing
      to: email,
      subject: "Test",
      html: "<p>Test works</p>",
    });

    console.log("✅ Resend send ok", { id: result?.id || null });
  } catch (e) {
    console.error("❌ Resend send failed:", e?.message || e);
  }
}

  res.status(200).json({ received: true });
}
