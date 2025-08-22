// api/webhook.js  (Next.js/Vercel API route, CommonJS)

const { buffer } = require('micro');
const Stripe = require('stripe');
const supabase = require('../lib/supabase');     // make sure this exports a CJS client
const { resend } = require('../lib/resend');     // make sure this exports { resend }

module.exports.config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

module.exports = async function handler(req, res) {
  console.log('✅ Webhook triggered');

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
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
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log('📦 Event type:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const email =
      session.customer_details?.email || session.customer_email || null;

    // ⚠️ Ensure these keys exactly match your Payment Link custom fields
    const fullName = session.custom_fields?.find(
      (f) => f.key === 'websiteurlsubdomainssoldseparately'
    )?.text?.value || null;

    const domain = session.custom_fields?.find(
      (f) => f.key === 'websiteurlsubdomainssoldseparately1'
    )?.text?.value || null;

    const uuid = session.id;

    console.log('📬 Parsed values:', { email, fullName, domain, uuid });

    let rowId = null;
    // ✅ Single insert — ONLY columns that exist in your purchases table
    try {
      const { data, error } = await supabase
        .from('purchases')
        .insert({ email, full_name: fullName, domain })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Supabase insert error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
      } else {
        rowId = data.id;
        console.log('✅ Supabase insert data:', data);
      }
    } catch (dbErr) {
      console.error('💥 Supabase insert threw:', dbErr);
    }

    // 📧 Email via Resend
    console.log('▶️ Resend about to send', { to: email });

    try {
      if (!email) throw new Error('Missing recipient email');

      const sendResult = await resend.emails.send({
        from: 'DAPEN.org® <donotreply@dapen.org>',
        to: email,
        subject: 'DAPEN® Defense Fund Coverage Activated',
        html: `
    <div role="article" aria-roledescription="email" lang="en"
         style="margin:0;padding:0;background:#f1f3f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans','Liberation Sans',sans-serif;line-height:1.5;color:#1b1b1b;">
      
      <!-- Top identifier / banner -->
      <div style="background:#0b4778;color:#fff;padding:8px 0;">
        <div style="max-width:640px;margin:0 auto;padding:0 24px;font-size:13px;">
          <span aria-hidden="true" style="margin-right:6px;">🔒</span>
          Official message from <strong>DAPEN.org®</strong>
        </div>
      </div>

      <!-- Header bar -->
      <div style="background:#005ea2;color:#fff;">
        <div style="max-width:640px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;gap:16px;">
          <div style="font-size:20px;font-weight:700;white-space:nowrap;">DAPEN.org®</div>
          <div style="border-left:2px solid rgba(255,255,255,0.4);padding-left:12px;">
            <div style="font-size:12px;letter-spacing:.06em;opacity:.9;text-transform:uppercase;">Defense Fund</div>
            <div style="font-size:18px;font-weight:600;">Coverage Confirmation</div>
          </div>
        </div>
      </div>

      <!-- Card body -->
      <div style="max-width:640px;margin:24px auto;padding:0 24px 32px;">
        <div style="background:#fff;border:1px solid #dfe1e2;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <div style="padding:24px 24px 8px;">
            <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.25;color:#0b4778;">
              Your DAPEN® Defense Fund coverage is active
            </h1>
            <p style="margin:0 0 16px 0;font-size:16px;">
              Your digital ADA defense coverage has been activated. Keep this message for your records.
            </p>

            <!-- Key details -->
            <div style="margin:16px 0;border:1px solid #e6e6e6;border-radius:6px;">
              <div style="display:flex;flex-wrap:wrap;">
                <div style="flex:1 1 220px;padding:12px 16px;background:#f9f9f9;border-bottom:1px solid #e6e6e6;">
                  <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5c5c5c;">Reference</div>
                  <div style="font-weight:600;">${rowId || '(Contact Us)'}</div>
                </div>
                <div style="flex:2 1 300px;padding:12px 16px;background:#fff;border-left:1px solid #e6e6e6;border-bottom:1px solid #e6e6e6;">
                  <div style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5c5c5c;">Protected URL</div>
                  <div style="word-break:break-all;">${domain || '(Contact Us)'}</div>
                </div>
              </div>
            </div>

            <!-- What's included -->
            <h2 style="margin:16px 0 8px 0;font-size:18px;color:#1b1b1b;">What’s included</h2>
            <ul style="margin:0 0 16px 24px;padding:0;">
              <li style="margin:6px 0;">Legal response drafted by an ADA-specialized attorney</li>
              <li style="margin:6px 0;">WCAG&nbsp;2.2-guided developer fixes for identified issues</li>
            </ul>
          </div>

          <!-- Important alert -->
          <div role="region" aria-label="Important deadline"
               style="margin:0 24px 8px 24px;background:#e7f6f8;border:1px solid #99deea;border-radius:6px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start;">
            <div aria-hidden="true" style="font-size:18px;line-height:1;">⏱️</div>
            <div>
              <div style="font-weight:700;color:#0b4778;">Important</div>
              <div style="font-size:14px;color:#1b1b1b;">
                You must submit your ADA demand letter within <strong>72 hours</strong> of receipt to remain eligible for coverage.
              </div>
            </div>
          </div>

          <!-- Primary action -->
          <div style="padding:8px 24px 24px;">
            <a href="https://forms.gle/yzniCMoCuK4QcBTx7"
               style="display:block;text-align:center;text-decoration:none;background:#005ea2;color:#fff;font-weight:700;padding:14px 18px;border-radius:6px;border:2px solid #005ea2;">
              Submit Demand Letter
            </a>
          </div>

          <!-- Footer meta -->
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

        <!-- Provenance line -->
        <p style="margin:12px 4px 0 4px;font-size:11px;color:#6f6f6f;text-align:center;">
          You’re receiving this message because coverage for ${domain || '(your site)'} was activated with the DAPEN® Defense Fund.
        </p>
      </div>
    </div>
        `,
      });

      // Handle both SDK result shapes
      const msgId = sendResult?.id || sendResult?.data?.id || null;
      const errObj = sendResult?.error || null;

      if (errObj) {
        console.error('❌ Resend send error:', errObj);
      } else {
        console.log('✅ Resend send ok', { id: msgId });
      }
    } catch (e) {
      console.error('❌ Resend send failed:', e?.message || e);
    }
  }

  // Always acknowledge so Stripe doesn't retry
  res.status(200).json({ received: true });
};
