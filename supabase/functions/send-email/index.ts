import { Resend } from 'npm:resend@4.1.2';

const resendApiKey = Deno.env.get('RESEND_API_KEY');
const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');
const resendFromName = Deno.env.get('RESEND_FROM_NAME') ?? 'Hisab Kitab';
const logoUrl = Deno.env.get('EMAIL_LOGO_URL');

const resend = resendApiKey ? new Resend(resendApiKey) : null;

type Summary = {
  totalBalance: string;
  savingsRate: string;
  totalSaved: string;
  accountCount: string;
};

type Stats = {
  income: string;
  expenses: string;
  net: string;
};

type BreakdownItem = {
  name: string;
  amount: string;
  percentage: number;
  color?: string;
};

type TopSpendingItem = {
  title: string;
  subtitle: string;
  amount: string;
  categoryName: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const hexToRgba = (hex: string, alpha: string) => {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(29,78,216,${alpha})`;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

const renderLogo = () => {
  if (logoUrl) {
    return `
      <img
        src="${escapeHtml(logoUrl)}"
        alt="Hisab Kitab"
        width="44"
        height="44"
        style="display:block;width:44px;height:44px;border-radius:14px;border:0;outline:none;text-decoration:none;"
      />
    `;
  }

  return `
    <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#10b981,#1d4ed8);text-align:center;line-height:44px;font-size:20px;font-weight:800;color:#ffffff;">
      H
    </div>
  `;
};

const renderHero = (summary: Summary) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
    <tr>
      <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:28px;">
        <div style="font-size:12px;line-height:18px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">
          Total Balance
        </div>
        <div style="margin-top:8px;font-size:36px;line-height:42px;font-weight:800;color:#0f172a;">
          ${escapeHtml(summary.totalBalance)}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
          <tr>
            <td width="50%" valign="top" style="padding-right:8px;">
              <div style="background:#eefbf5;border:1px solid #cceedd;border-radius:18px;padding:16px;">
                <div style="font-size:11px;line-height:16px;color:#047857;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Savings Rate</div>
                <div style="margin-top:6px;font-size:24px;line-height:30px;font-weight:800;color:#064e3b;">${escapeHtml(summary.savingsRate)}</div>
              </div>
            </td>
            <td width="50%" valign="top" style="padding-left:8px;">
              <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:18px;padding:16px;">
                <div style="font-size:11px;line-height:16px;color:#4338ca;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Total Saved</div>
                <div style="margin-top:6px;font-size:24px;line-height:30px;font-weight:800;color:#312e81;">${escapeHtml(summary.totalSaved)}</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

const renderStats = (stats: Stats, summary: Summary) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
    <tr>
      <td width="33.33%" valign="top" style="padding-right:8px;">
        <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:18px;padding:18px 16px;">
          <div style="font-size:11px;line-height:16px;color:#047857;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Income</div>
          <div style="margin-top:8px;font-size:22px;line-height:28px;font-weight:800;color:#064e3b;">${escapeHtml(stats.income)}</div>
        </div>
      </td>
      <td width="33.33%" valign="top" style="padding-left:4px;padding-right:4px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:18px;padding:18px 16px;">
          <div style="font-size:11px;line-height:16px;color:#475569;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Expenses</div>
          <div style="margin-top:8px;font-size:22px;line-height:28px;font-weight:800;color:#0f172a;">${escapeHtml(stats.expenses)}</div>
        </div>
      </td>
      <td width="33.33%" valign="top" style="padding-left:8px;">
        <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:18px;padding:18px 16px;">
          <div style="font-size:11px;line-height:16px;color:#4338ca;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Accounts</div>
          <div style="margin-top:8px;font-size:22px;line-height:28px;font-weight:800;color:#312e81;">${escapeHtml(summary.accountCount)}</div>
        </div>
      </td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
    <tr>
      <td style="background:#0f172a;border-radius:20px;padding:18px 20px;text-align:center;">
        <div style="font-size:11px;line-height:16px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Net Result</div>
        <div style="margin-top:8px;font-size:24px;line-height:30px;font-weight:800;color:#ffffff;">${escapeHtml(stats.net)}</div>
      </td>
    </tr>
  </table>
`;

const renderBreakdown = (items: BreakdownItem[], monthShort: string) => {
  const bars = items.length
    ? items
        .map((item) => {
          const color = item.color || '#1d4ed8';
          return `
            <tr>
              <td valign="middle" style="padding:8px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td valign="middle" style="width:14px;">
                      <div style="width:10px;height:10px;border-radius:999px;background:${escapeHtml(color)};"></div>
                    </td>
                    <td valign="middle" style="font-size:14px;line-height:20px;color:#475569;font-weight:600;">
                      ${escapeHtml(item.name)}
                    </td>
                    <td valign="middle" align="right" style="font-size:14px;line-height:20px;color:#0f172a;font-weight:800;">
                      ${item.percentage}%
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
        })
        .join('')
    : `
      <tr>
        <td style="padding-top:10px;font-size:14px;line-height:22px;color:#64748b;">
          No spending distribution available for this month.
        </td>
      </tr>
    `;

  const chips = items.length
    ? items
        .map((item) => {
          const color = item.color || '#1d4ed8';
          return `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size:14px;line-height:20px;color:#475569;font-weight:600;">
                      <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${escapeHtml(color)};margin-right:8px;"></span>
                      ${escapeHtml(item.name)}
                    </td>
                    <td align="right" style="font-size:14px;line-height:20px;color:#0f172a;font-weight:800;">
                      ${escapeHtml(item.amount)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
        })
        .join('')
    : '';

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
      <tr>
        <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:24px;">
          <div style="font-size:20px;line-height:26px;color:#0f172a;font-weight:800;">Spending Distribution</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
            <tr>
              <td width="38%" valign="top" align="center" style="padding-right:14px;">
                <div style="width:130px;height:130px;border-radius:999px;background:conic-gradient(#1d4ed8 0% 45%, #34d399 45% 70%, #818cf8 70% 85%, #f59e0b 85% 100%);margin:0 auto;position:relative;">
                  <div style="position:relative;top:15px;left:15px;width:100px;height:100px;border-radius:999px;background:#ffffff;text-align:center;">
                    <div style="padding-top:28px;font-size:11px;line-height:16px;color:#94a3b8;font-weight:700;text-transform:uppercase;">${escapeHtml(monthShort)}</div>
                    <div style="font-size:18px;line-height:24px;color:#0f172a;font-weight:800;">100%</div>
                  </div>
                </div>
              </td>
              <td width="62%" valign="top">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  ${bars}
                </table>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
            ${chips}
          </table>
        </td>
      </tr>
    </table>
  `;
};

const renderTopSpending = (items: TopSpendingItem[]) => {
  const rows = items.length
    ? items
        .map((item, index) => {
          const bg = index === 0 ? '#f8fafc' : '#ffffff';
          return `
            <tr>
              <td style="padding:16px 0;border-bottom:${index === items.length - 1 ? '0' : '1px solid #f1f5f9'};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td valign="middle" style="width:48px;">
                      <div style="width:40px;height:40px;border-radius:14px;background:${bg};border:1px solid #e2e8f0;text-align:center;line-height:40px;font-size:16px;font-weight:800;color:#475569;">
                        ${index + 1}
                      </div>
                    </td>
                    <td valign="middle" style="padding-left:12px;">
                      <div style="font-size:15px;line-height:21px;color:#0f172a;font-weight:800;">${escapeHtml(item.title)}</div>
                      <div style="font-size:12px;line-height:18px;color:#64748b;">${escapeHtml(item.subtitle)} • ${escapeHtml(item.categoryName)}</div>
                    </td>
                    <td valign="middle" align="right" style="font-size:15px;line-height:21px;color:#0f172a;font-weight:800;">
                      ${escapeHtml(item.amount)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
        })
        .join('')
    : `
      <tr>
        <td style="padding-top:12px;font-size:14px;line-height:22px;color:#64748b;">
          No expense entries recorded this month.
        </td>
      </tr>
    `;

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
      <tr>
        <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="font-size:20px;line-height:26px;color:#0f172a;font-weight:800;">Top Spending</td>
              <td align="right" style="font-size:11px;line-height:16px;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">
                Most Impact
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;">
            ${rows}
          </table>
        </td>
      </tr>
    </table>
  `;
};

const template = ({
  title,
  previewText,
  intro,
  monthLabel,
  monthShort,
  summary,
  stats,
  spendingBreakdown,
  topSpending,
  ctaLabel,
  ctaUrl,
}: {
  title: string;
  previewText: string;
  intro: string;
  monthLabel: string;
  monthShort: string;
  summary: Summary;
  stats: Stats;
  spendingBreakdown: BreakdownItem[];
  topSpending: TopSpendingItem[];
  ctaLabel: string;
  ctaUrl: string;
}) => `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
        ${escapeHtml(previewText)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;margin:0;padding:0;">
        <tr>
          <td align="center" style="padding:24px 12px 40px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;">
              <tr>
                <td style="padding:0 8px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                    <tr>
                      <td style="padding:14px 0;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                          <tr>
                            <td valign="middle" style="width:56px;">${renderLogo()}</td>
                            <td valign="middle" style="padding-left:10px;">
                              <div style="font-size:22px;line-height:28px;font-weight:800;color:#047857;">Hisab Kitab</div>
                              <div style="font-size:12px;line-height:18px;color:#64748b;">Smart monthly finance summary</div>
                            </td>
                            <td valign="middle" align="right">
                              <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:11px;line-height:16px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">
                                ${escapeHtml(monthLabel)}
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px;">
                    <tr>
                      <td>
                        <div style="font-size:30px;line-height:36px;font-weight:800;color:#0f172a;">${escapeHtml(title)}</div>
                        <div style="margin-top:8px;font-size:15px;line-height:24px;color:#64748b;">${escapeHtml(intro)}</div>
                      </td>
                    </tr>
                  </table>
                  ${renderHero(summary)}
                  ${renderStats(stats, summary)}
                  ${renderBreakdown(spendingBreakdown, monthShort)}
                  ${renderTopSpending(topSpending)}
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                    <tr>
                      <td align="center">
                        <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#6c63ff;color:#ffffff;text-decoration:none;padding:16px 28px;border-radius:16px;font-size:15px;line-height:22px;font-weight:800;box-shadow:0 10px 24px ${hexToRgba('#6c63ff', '0.22')};">
                          ${escapeHtml(ctaLabel)}
                        </a>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:32px;border-top:1px solid #e2e8f0;">
                    <tr>
                      <td align="center" style="padding-top:24px;">
                        <div style="font-size:12px;line-height:18px;color:#94a3b8;">You are receiving this email because you requested a monthly summary inside Hisab Kitab.</div>
                        <div style="margin-top:10px;font-size:12px;line-height:18px;color:#94a3b8;">© 2026 Hisab Kitab. All rights reserved.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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

  const {
    to,
    subject,
    title,
    previewText,
    intro,
    monthLabel,
    monthShort,
    summary,
    stats,
    spendingBreakdown,
    topSpending,
    ctaLabel,
    ctaUrl,
  } = await request.json();

  if (
    !to ||
    !subject ||
    !title ||
    !previewText ||
    !intro ||
    !monthLabel ||
    !monthShort ||
    !summary ||
    !stats ||
    !ctaLabel ||
    !ctaUrl
  ) {
    return Response.json(
      {
        error:
          'Missing required fields. Expected: to, subject, title, previewText, intro, monthLabel, monthShort, summary, stats, ctaLabel, ctaUrl.',
      },
      { status: 400 },
    );
  }

  const { error } = await resend.emails.send({
    from: `${resendFromName} <${resendFromEmail}>`,
    to,
    subject,
    html: template({
      title,
      previewText,
      intro,
      monthLabel,
      monthShort,
      summary,
      stats,
      spendingBreakdown: Array.isArray(spendingBreakdown) ? spendingBreakdown : [],
      topSpending: Array.isArray(topSpending) ? topSpending : [],
      ctaLabel,
      ctaUrl,
    }),
  });

  if (error) {
    console.error('Resend send failed', error);
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
});
