import { Resend } from 'npm:resend@4.1.2';

const resendApiKey = Deno.env.get('RESEND_API_KEY');
const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');
const resendFromName = Deno.env.get('RESEND_FROM_NAME') ?? 'Hisab Kitab';
const logoUrl = Deno.env.get('EMAIL_LOGO_URL');

const resend = resendApiKey ? new Resend(resendApiKey) : null;

type Summary = {
  totalBalance: string;
  income: string;
  expenses: string;
  savings: string;
  savingsRate: string;
  transactionCount: string;
};

type BreakdownItem = {
  name: string;
  amount: string;
  percentage: number;
  color?: string;
};

type BudgetPerformanceItem = {
  name: string;
  limit: string;
  spent: string;
  statusLabel: string;
  statusTone: 'good' | 'warn' | 'danger';
};

type RecentTransactionItem = {
  title: string;
  subtitle: string;
  amount: string;
  tone: 'income' | 'expense' | 'neutral';
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderLogo = () => {
  if (logoUrl) {
    return `
      <img
        src="${escapeHtml(logoUrl)}"
        alt="Hisab Kitab"
        width="46"
        height="46"
        style="display:block;width:46px;height:46px;border-radius:14px;border:0;outline:none;text-decoration:none;"
      />
    `;
  }

  return `
    <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#10b981);text-align:center;line-height:46px;font-size:20px;font-weight:800;color:#ffffff;">
      HK
    </div>
  `;
};

const statusColors = (tone: 'good' | 'warn' | 'danger') => {
  if (tone === 'danger') {
    return { bg: '#FFE4E6', text: '#BE123C' };
  }

  if (tone === 'warn') {
    return { bg: '#FEF3C7', text: '#B45309' };
  }

  return { bg: '#DCFCE7', text: '#15803D' };
};

const amountColor = (tone: 'income' | 'expense' | 'neutral') => {
  if (tone === 'income') {
    return '#059669';
  }

  if (tone === 'expense') {
    return '#E11D48';
  }

  return '#7C3AED';
};

const renderSummaryCards = (summary: Summary) => {
  const cards = [
    { label: 'Total Balance', value: summary.totalBalance, accent: '#7C3AED' },
    { label: 'Income', value: summary.income, accent: '#059669' },
    { label: 'Expenses', value: summary.expenses, accent: '#E11D48' },
    { label: 'Savings', value: summary.savings, accent: '#059669' },
  ].map(
    (card) => `
        <td width="50%" valign="top" style="padding:8px;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:18px;">
            <div style="font-size:11px;line-height:16px;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">
              ${escapeHtml(card.label)}
            </div>
            <div style="margin-top:10px;font-size:24px;line-height:30px;color:${card.accent};font-weight:800;">
              ${escapeHtml(card.value)}
            </div>
          </div>
        </td>
      `,
  );

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
      <tr>${cards.slice(0, 2).join('')}</tr>
      <tr>${cards.slice(2).join('')}</tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
      <tr>
        <td style="background:#0f172a;border-radius:18px;padding:18px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td>
                <div style="font-size:11px;line-height:16px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Savings Rate</div>
                <div style="margin-top:8px;font-size:22px;line-height:28px;color:#ffffff;font-weight:800;">${escapeHtml(summary.savingsRate)}</div>
              </td>
              <td align="right">
                <div style="font-size:11px;line-height:16px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;">Transactions</div>
                <div style="margin-top:8px;font-size:22px;line-height:28px;color:#ffffff;font-weight:800;">${escapeHtml(summary.transactionCount)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
};

const renderBreakdown = (items: BreakdownItem[]) => {
  const rows = items.length
    ? items
        .map(
          (item) => `
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${escapeHtml(item.color || '#7C3AED')};margin-right:8px;"></span>
                      <span style="font-size:14px;line-height:20px;color:#0f172a;font-weight:700;">${escapeHtml(item.name)}</span>
                    </td>
                    <td align="right" style="font-size:14px;line-height:20px;color:#64748b;">
                      ${escapeHtml(item.amount)} - ${item.percentage.toFixed(1)}%
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `,
        )
        .join('')
    : `
      <tr>
        <td style="padding-top:8px;font-size:14px;line-height:22px;color:#64748b;">
          No spending categories were recorded for this month.
        </td>
      </tr>
    `;

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
      <tr>
        <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:22px;padding:22px;">
          <div style="font-size:20px;line-height:26px;color:#0f172a;font-weight:800;">Top Spending Categories</div>
          <div style="margin-top:6px;font-size:13px;line-height:20px;color:#64748b;">The biggest expense buckets from your monthly report.</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
            ${rows}
          </table>
        </td>
      </tr>
    </table>
  `;
};

const renderBudgetPerformance = (items: BudgetPerformanceItem[]) => {
  const rows = items.length
    ? items
        .map((item) => {
          const tone = statusColors(item.statusTone);
          return `
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="font-size:14px;line-height:20px;color:#0f172a;font-weight:700;">${escapeHtml(item.name)}</div>
                      <div style="margin-top:4px;font-size:12px;line-height:18px;color:#64748b;">Budget ${escapeHtml(item.limit)} - Spent ${escapeHtml(item.spent)}</div>
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;padding:7px 10px;border-radius:999px;background:${tone.bg};color:${tone.text};font-size:11px;line-height:16px;font-weight:800;">
                        ${escapeHtml(item.statusLabel)}
                      </span>
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
        <td style="padding-top:8px;font-size:14px;line-height:22px;color:#64748b;">
          No category budgets were created for this month.
        </td>
      </tr>
    `;

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
      <tr>
        <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:22px;padding:22px;">
          <div style="font-size:20px;line-height:26px;color:#0f172a;font-weight:800;">Budget Performance</div>
          <div style="margin-top:6px;font-size:13px;line-height:20px;color:#64748b;">A quick view of how your category budgets tracked against spending.</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
            ${rows}
          </table>
        </td>
      </tr>
    </table>
  `;
};

const renderRecentTransactions = (items: RecentTransactionItem[]) => {
  const rows = items.length
    ? items
        .map(
          (item) => `
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="font-size:14px;line-height:20px;color:#0f172a;font-weight:700;">${escapeHtml(item.title)}</div>
                      <div style="margin-top:4px;font-size:12px;line-height:18px;color:#64748b;">${escapeHtml(item.subtitle)}</div>
                    </td>
                    <td align="right" valign="middle" style="font-size:14px;line-height:20px;color:${amountColor(item.tone)};font-weight:800;">
                      ${escapeHtml(item.amount)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `,
        )
        .join('')
    : `
      <tr>
        <td style="padding-top:8px;font-size:14px;line-height:22px;color:#64748b;">
          No transactions were recorded in this report period.
        </td>
      </tr>
    `;

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;">
      <tr>
        <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:22px;padding:22px;">
          <div style="font-size:20px;line-height:26px;color:#0f172a;font-weight:800;">Recent Transactions</div>
          <div style="margin-top:6px;font-size:13px;line-height:20px;color:#64748b;">Recent activity from the same monthly statement you can preview in the app.</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
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
  reportRange,
  summary,
  spendingBreakdown,
  budgetPerformance,
  recentTransactions,
  ctaLabel,
  ctaUrl,
}: {
  title: string;
  previewText: string;
  intro: string;
  monthLabel: string;
  reportRange: string;
  summary: Summary;
  spendingBreakdown: BreakdownItem[];
  budgetPerformance: BudgetPerformanceItem[];
  recentTransactions: RecentTransactionItem[];
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
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;">
        <tr>
          <td align="center" style="padding:24px 12px 40px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;">
              <tr>
                <td style="background:linear-gradient(135deg,#ffffff,#f4f1fb);border:1px solid #e5e7eb;border-radius:28px;padding:28px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td valign="middle" style="width:58px;">${renderLogo()}</td>
                      <td valign="middle" style="padding-left:12px;">
                        <div style="font-size:12px;line-height:18px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">Personal Finance Report</div>
                        <div style="margin-top:4px;font-size:24px;line-height:30px;font-weight:800;color:#0f172a;">Hisab Kitab</div>
                      </td>
                      <td valign="middle" align="right">
                        <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#ede9fe;color:#6d28d9;font-size:11px;line-height:16px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;">
                          ${escapeHtml(monthLabel)}
                        </div>
                      </td>
                    </tr>
                  </table>

                  <div style="margin-top:22px;font-size:32px;line-height:38px;font-weight:800;color:#0f172a;">
                    ${escapeHtml(title)}
                  </div>
                  <div style="margin-top:8px;font-size:14px;line-height:22px;color:#64748b;">
                    ${escapeHtml(intro)}
                  </div>
                  <div style="margin-top:10px;font-size:13px;line-height:20px;color:#64748b;">
                    Reporting period: ${escapeHtml(reportRange)}
                  </div>

                  ${renderSummaryCards(summary)}
                </td>
              </tr>

              <tr><td>${renderBreakdown(spendingBreakdown)}</td></tr>
              <tr><td>${renderBudgetPerformance(budgetPerformance)}</td></tr>
              <tr><td>${renderRecentTransactions(recentTransactions)}</td></tr>

              <tr>
                <td align="center" style="padding-top:28px;">
                  <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:16px 28px;border-radius:16px;font-size:15px;line-height:22px;font-weight:800;">
                    ${escapeHtml(ctaLabel)}
                  </a>
                </td>
              </tr>

              <tr>
                <td align="center" style="padding-top:28px;border-top:1px solid #e5e7eb;">
                  <div style="font-size:12px;line-height:18px;color:#94a3b8;">
                    You are receiving this email because you requested a monthly report inside Hisab Kitab.
                  </div>
                  <div style="margin-top:10px;font-size:12px;line-height:18px;color:#94a3b8;">
                    © 2026 Hisab Kitab. All rights reserved.
                  </div>
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
    reportRange,
    summary,
    spendingBreakdown,
    budgetPerformance,
    recentTransactions,
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
    !reportRange ||
    !summary ||
    !ctaLabel ||
    !ctaUrl
  ) {
    return Response.json(
      {
        error:
          'Missing required fields. Expected: to, subject, title, previewText, intro, monthLabel, reportRange, summary, ctaLabel, ctaUrl.',
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
      reportRange,
      summary,
      spendingBreakdown: Array.isArray(spendingBreakdown) ? spendingBreakdown : [],
      budgetPerformance: Array.isArray(budgetPerformance) ? budgetPerformance : [],
      recentTransactions: Array.isArray(recentTransactions) ? recentTransactions : [],
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
