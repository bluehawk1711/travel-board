import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend: Resend | null = null;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
    this.from = this.configService.get<string>(
      'MAIL_FROM',
      'Travel Boards <noreply@travelboards.app>',
    );
  }

  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    frontendUrl: string,
  ): Promise<void> {
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    if (!this.resend) {
      const masked = `${to.slice(0, 3)}***@${to.split('@')[1] ?? '???'}`;
      this.logger.warn(
        `RESEND_API_KEY not set — password reset email not sent to ${masked}.`,
      );
      return;
    }

    await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Reset your Travel Boards password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
          <h2 style="color: #18181b; font-size: 20px; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #52525b; font-size: 14px; line-height: 1.6;">
            Click the button below to reset your password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #10b981; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 16px 0;">
            Reset password
          </a>
          <p style="color: #a1a1aa; font-size: 12px; line-height: 1.5;">
            If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  }
}
