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
  console.log('✅ Webhook triggered');

  if (req.method !== 'POST') {
    console.log('❌ Invalid method');
    return res.status(405).end();
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(
      buf.toString(),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Stripe signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('📦 Event type:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const email = session.customer_details?.email || session.customer_email || null;

    // Make sure these keys exactly match your Stripe Payment Link custom field keys
    const fullName = session.custom_fields?.find(f => f.key === 'websiteurlsubdomainssoldseparately')?.text?.value || null;
    const domain   = session.custom_fields?.find(f => f.key === 'websiteurlsubdomainssoldseparately1')?.text?.value || null;

    // Use the session id as a stable reference for your plan ID
    const uuid = session.id;

    console.log('📬 Parsed values:', { email, fullName, domain, uuid });

    try {
      const { error } = await supabase.from('purchases').insert({
        email,
        full_name: fullName,
        domain,
        id: uuid,
        source: 'stripe_checkout',
      });

      if (error) {
        console.error('❌ Supabase insert failed:', error.message);
      } else {
        console.log('✅ Supabase insert successful');
      }
    } catch (dbErr) {
      console.error('❌ Supabase exception:', dbErr?.message || dbErr);
    }

    console.log('▶️ Resend about to send', { to: email });

    try {
      const hasKey = !!(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.length > 10);
      console.log(
        'RESEND_API_KEY present:',
        hasKey,
        'prefix:',
        (process.env.RESEND_API_KEY || '').slice(0, 6)
      );

      if (!email) {
        throw new Error('Missing recipient email');
      }

      // ✅ capture the result so result?.id is defined
      const result = await resend.emails.send({
        from: 'DAPEN <onboarding@resend.dev>', // use your verified domain/sender
        to: email,
        subject: 'DAPEN® Defense Fund Coverage Activated',
        html: `
    <div role="article" aria-roledescription="email" lang="en"
         style="margin:0;padding:0;background:#f1f3f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans','Liberation Sans',sans-serif;line-height:1.5;color:#1b1b1b;">
      <div style="background:#0b4778;color:#fff;padding:8px 0;">
        <div style="max-width:640px;margin:0 auto;padding:0 24px;font-size:13px;">
          <span aria-hidden="true" style="margin-right:6px;">🔒</span>
          Official message from <strong>DAPEN.org</strong>
        </div>
      </div>
      <div style="background:#005ea2;color:#fff;">
        <div style="max-width:640px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;gap:16px;">
          <img src="https://www.dapen.org/assets/images/dapen-logo-3.png" alt="DAPEN Logo" style="height:36px;width:auto;display:block;border:0;"/>
          <div style="border-left:2px solid rgba(255,255,255,0.4);padding-left:12px;">
            <div style="font-size:12px;letter-spacing:.06em;opacity:.9;text-transform:uppercase;">Defense Fund</div>
            <div style="font-size:18px;font-weight:600;">Coverage Confirmation</div>
          </div>
        </div>
      </div>
      <div style="max-width:640px;margin:24px auto;padding:0 24px 32px;">
        <div style="background:#fff;border:1px solid #dfe1e2;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <div style="padding:24px 24px 8px;">
            <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.25;color:#0b4778;">Your DAPEN® Defense Fund coverage is active</h1>
            <p style="margin:0 0 16px 0;font-size:16px;">Your digital ADA defense coverage has been activated. Keep this message for your records.</p>
            <div style="margin:16px 0;border:1px solid #e6e6e6;border-radius:6px;">
              <div style="display:flex;flex-wrap:wrap;">
                <div style="flex:1 1 220px;padding:12px 16px;background:#f9f9f9;border-bottom:1px solid #e6e6e6;">
                  <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5c5c5c;">Plan ID</div>
                  <div style="font-weight:600;">${uuid}</div>
                </div>
                <div style="flex:2 1 300px;padding:12px 16px;background:#fff;border-left:1px solid #e6e6e6;border-bottom:1px solid #e6e6e6;">
                  <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5c5c5c;">Protected URL</div>
                  <div style="word-break:break-all;">${domain || '(not provided)'}</div>
                </div>
                <div style="flex:1 1 100%;padding:12px 16px;background:#fff;">
                  <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5c5c5c;">Coverage Summary</div>
                  <div>Attorney-drafted response &amp; developer remediation for ADA demand letters during your coverage period.</div>
                </div>
              </div>
            </div>
            <h2 style="margin:16px 0 8px 0;font-size:18px;color:#1b1b1b;">What’s included</h2>
            <ul style="margin:0 0 16px 24px;padding:0;">
              <li style="margin:6px 0;">Legal response drafted by an ADA-specialized attorney</li>
              <li style="margin:6px 0;">WCAG&nbsp;2.2-guided developer fixes for identified issues</li>
              <li style="margin:6px 0;">Direct access to experts to reduce risk of escalation</li>
            </ul>
          </div>
          <div role="region" aria-label="Important deadline"
               style="margin:0 24px 8px 24px;background:#e7f6f8;border:1px solid #99deea;border-radius:6px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start;">
            <div aria-hidden="true" style="font-size:18px;line-height:1;">⏱️</div>
            <div>
              <div style="font-weight:700;color:#0b4778;">Important</div>
              <div style="font-size:14px;color:#1b1b1b;">You must submit your ADA demand letter within <strong>72 hours</strong> of receipt to remain eligible for coverage.</div>
            </div>
          </div>
          <div style="padding:8px 24px 24px;">
            <a href="https://forms.gle/yzniCMoCuK4QcBTx7"
               style="display:block;text-align:center;text-decoration:none;background:#005ea2;color:#fff;font-weight:700;padding:14px 18px;border-radius:6px;border:2px solid #005ea2;">
              Submit Demand Letter
            </a>
          </div>
          <hr style="border:0;border-top:1px solid #e6e6e6;margin:0 24px 16px;">
          <div style="padding:0 24px 24px;">
            <p style="margin:0 0 6px 0;font-size:13px;color:#5c5c5c;">
              Questions? <a href="https://forms.gle/UFGhdJLcxXjCJTXg9" style="color:#005ea2;text-decoration:underline;">Contact Us</a>.
            </p>
            <p style="margin:6px 0 0 0;font-size:12px;color:#6f6f6f;text-align:center;">
              <a href="https://www.dapen.org/legal-policies/privacy-policy/" style="color:#5c5c5c;text-decoration:underline;">Privacy Policy</a>
              &nbsp;|&nbsp;
              <a href="https://www.dapen.org/legal-policies/terms-of-service/" style="color:#5c5c5c;text-decoration:underline;">Terms of Service</a>
            </p>
          </div>
        </div>
        <p style="margin:12px 4px 0 4px;font-size:11px;color:#6f6f6f;text-align:center;">
          You’re receiving this message because coverage for ${domain || '(your site)'} was activated with the DAPEN® Defense Fund.
        </p>
      </div>
    </div>
        `,
      });

      console.log('✅ Resend send ok', { id: result?.id || null });
    } catch (e) {
      console.error('❌ Resend send failed:', e?.message || e);
    }
  }

  // Always acknowledge receipt so Stripe doesn't retry
  return res.status(200).json({ received: true });
}
