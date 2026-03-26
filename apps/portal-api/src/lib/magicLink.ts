import crypto from 'crypto';
import nodemailer from 'nodemailer';

export function generateMagicToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getTokenExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const portalUrl = process.env.PORTAL_URL || 'http://localhost:3002';
  const magicLinkUrl = `${portalUrl}/portal/auth/verify/${token}`;

  await transporter.sendMail({
    from: `"BuildKit Labs" <${process.env.MAGIC_LINK_FROM_EMAIL || 'portal@buildkitlabs.com'}>`,
    to: email,
    subject: 'Your BuildKit Labs Portal Login Link',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1e293b; margin-bottom: 16px;">Sign in to your portal</h2>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
          Click the button below to access your BuildKit Labs project portal. This link expires in 15 minutes.
        </p>
        <a href="${magicLinkUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 16px;">
          Sign In to Portal
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          If you didn't request this link, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
