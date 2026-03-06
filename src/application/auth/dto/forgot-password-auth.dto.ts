export interface ForgotPasswordCommand {
  email: string;
  rateLimitKey: string;
}

// No ForgotPasswordResult — execute() returns Promise<void> (anti-enumeration: always 200)
