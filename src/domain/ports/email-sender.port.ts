export interface SendVerificationEmailParams {
  to: string;
  verificationUrl: string;
}

export interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
}

export interface IEmailSender {
  sendVerificationEmail(params: SendVerificationEmailParams): Promise<void>;
  sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void>;
}
