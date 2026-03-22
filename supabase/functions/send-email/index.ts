import { Resend } from 'npm:resend@4.1.2';

const resendApiKey = Deno.env.get('RESEND_API_KEY');
const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');
const resendFromName = Deno.env.get('RESEND_FROM_NAME') ?? 'Hisab Kitab';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

const template = ({
  title,
  body,
  ctaLabel,
  ctaUrl,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}) => `
  <html>
    <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033;">
      <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="background:linear-gradient(135deg,#2d4cf0,#18b8a6);padding:24px 28px;border-radius:24px 24px 0 0;color:#fff;">
          <h1 style="margin:0;font-size:28px;">Hisab Kitab</h1>
          <p style="margin:8px 0 0;opacity:0.9;">Finance communication delivered securely</p>
        </div>
        <div style="background:#ffffff;padding:32px 28px;border-radius:0 0 24px 24px;">
          <h2 style="margin-top:0;">${title}</h2>
          <p style="line-height:1.6;">${body}</p>
          <div style="margin:24px 0;">
            <a href="${ctaUrl}" style="display:inline-block;padding:14px 20px;background:#2d4cf0;color:#fff;text-decoration:none;border-radius:999px;">${ctaLabel}</a>
          </div>
          <div style="padding:20px;border-radius:18px;background:#f4f7fb;">
            <strong>Monthly report summary</strong>
            <p style="margin:10px 0 0;line-height:1.6;">Include transaction summaries and generated chart images from your reporting pipeline before sending production emails.</p>
          </div>
        </div>
      </div>
    </body>
  </html>
`;

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!resendApiKey || !resend) {
    return Response.json(
      {
        error:
          'Missing RESEND_API_KEY secret. Set it in Supabase Dashboard -> Edge Functions -> Secrets.',
      },
      { status: 500 },
    );
  }

  if (!resendFromEmail) {
    return Response.json(
      {
        error:
          'Missing RESEND_FROM_EMAIL secret. Set it to a verified Resend sender address before sending emails.',
      },
      { status: 500 },
    );
  }

  const { to, subject, title, body, ctaLabel, ctaUrl } = await request.json();

  if (!to || !subject || !title || !body || !ctaLabel || !ctaUrl) {
    return Response.json(
      {
        error: 'Missing required fields. Expected: to, subject, title, body, ctaLabel, ctaUrl.',
      },
      { status: 400 },
    );
  }

  const { error } = await resend.emails.send({
    from: `${resendFromName} <${resendFromEmail}>`,
    to,
    subject,
    html: template({ title, body, ctaLabel, ctaUrl }),
  });

  if (error) {
    console.error('Resend send failed', error);
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
});
