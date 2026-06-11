import nodemailer from 'nodemailer';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

export interface IssueEmailData {
  to: string;
  issueTitle: string;
  issueUrl: string;
  issueNumber: number;
  matchedLabels: string[];
}

export async function sendIssueNotification(data: IssueEmailData): Promise<void> {
  const labelsHtml = data.matchedLabels.map((l) => `<span style="background:#e1e4e8;border-radius:3px;padding:2px 6px;font-size:12px;">${l}</span>`).join(' ');

  await transporter.sendMail({
    from: `"Expensify Notifier" <${env.SMTP_USER}>`,
    to: data.to,
    subject: `[Expensify] New Issue #${data.issueNumber}: ${data.issueTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2 style="color:#1a1a1a;">New Matching Issue Found</h2>
        <p><strong>Issue #${data.issueNumber}</strong></p>
        <h3 style="margin:8px 0;">
          <a href="${data.issueUrl}" style="color:#0969da;text-decoration:none;">${data.issueTitle}</a>
        </h3>
        <p>Matched labels: ${labelsHtml}</p>
        <a href="${data.issueUrl}" style="display:inline-block;background:#0969da;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;margin-top:12px;">View Issue on GitHub</a>
        <hr style="margin-top:24px;border:none;border-top:1px solid #eee;">
        <p style="color:#666;font-size:12px;">Expensify Issue Notifier — <a href="${env.API_BASE_URL.replace(':3001', ':3000')}/settings">Manage preferences</a></p>
      </div>
    `,
    text: `New Expensify Issue #${data.issueNumber}: ${data.issueTitle}\n\nView: ${data.issueUrl}\nMatched labels: ${data.matchedLabels.join(', ')}`,
  });

  logger.info({ to: data.to, issueNumber: data.issueNumber }, 'Issue notification email sent');
}
