import { Resend } from 'resend';
import type {
  IEmailSender,
  SendVerificationEmailParams,
  SendPasswordResetEmailParams,
} from '@domain/ports/email-sender.port.js';

export class ResendEmailAdapter implements IEmailSender {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly fromEmail: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async sendVerificationEmail(params: SendVerificationEmailParams): Promise<void> {
    await this.client.emails.send({
      from: this.fromEmail,
      to: params.to,
      subject: 'Verify your email address',
      html: `<p>Click the link below to verify your email address:</p><p><a href="${params.verificationUrl}">Verify Email</a></p>`,
    });
  }

  async sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void> {
    await this.client.emails.send({
      from: this.fromEmail,
      to: params.to,
      subject: 'Reset your password',
      html: `<p>Click the link below to reset your password:</p><p><a href="${params.resetUrl}">Reset Password</a></p>`,
    });
  }
}
