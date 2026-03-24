import nodemailer from 'nodemailer';

const emailEnabled = String(process.env.EMAIL_NOTIFICATIONS_ENABLED || '').toLowerCase() === 'true';
const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = Number(process.env.SMTP_PORT || '587');
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpFrom = process.env.SMTP_FROM || smtpUser || '';
const appBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!emailEnabled) return null;
  if (!smtpHost || !smtpFrom) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });
  }
  return transporter;
}

export function isEmailNotificationEnabled(): boolean {
  return getTransporter() !== null;
}

export async function sendNotificationEmail(args: {
  to: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  const tx = getTransporter();
  if (!tx) return;
  const linkUrl = args.link
    ? `${appBaseUrl.replace(/\/$/, '')}${args.link.startsWith('/') ? args.link : `/${args.link}`}`
    : '';
  const text = [args.body || '', linkUrl ? `Open: ${linkUrl}` : ''].filter(Boolean).join('\n\n');
  await tx.sendMail({
    from: smtpFrom,
    to: args.to,
    subject: `[Peer Review] ${args.title}`,
    text: text || args.title,
  });
}
